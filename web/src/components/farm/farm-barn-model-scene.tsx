"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html, Line, MapControls } from "@react-three/drei";
import { DoorOpen, RotateCw } from "lucide-react";
import * as THREE from "three";
import {
  BARN_MODEL_DIM,
  barnModelCameraPose,
  barnModelEditCameraPose,
  barnModelYardBounds,
  barnModelYardGridSize,
  barnModelEntranceCardScale,
  barnModelStatusHex,
  ghostBuildingFromPlan,
  BARN_CTRL_H,
  BARN_CTRL_W,
  mountBarnControllers,
  planFromRowDrag,
  planFromSideHandleDelta,
  readingsForStallType,
  rotateY,
  rowsFromDragLength,
  type BarnModelBuilding,
  type BarnModelCameraShot,
  type BarnModelPen,
  type BarnModelRoomPlan,
  type BarnModelYard,
} from "@/lib/farm/barn-model-layout";
import { barnModelAisleX, barnModelTypeSpec } from "@/lib/farm/barn-model-dim";
import { snapBarnFootprint } from "@/lib/farm/barn-model-prefs";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";
import {
  BarnModelRoofCard,
  type BarnModelLiveTrend,
} from "@/components/farm/farm-barn-model-live-hud";
import type { BarnReading } from "@/lib/data/iot";
import { channelBySlot } from "@/lib/data/iot-channel";
import {
  formatControllerNoLabel,
  type ChannelPercents,
} from "@/lib/farm/controller-summary-display";
import { cn } from "@/lib/utils";

export type BarnModelOpenController = {
  barnId: string;
  controllerKey: string;
};

type SceneProps = {
  yard: BarnModelYard;
  shot: BarnModelCameraShot;
  selectedBarnId: string | null;
  placing?: boolean;
  placingDraft?: { plan: BarnModelRoomPlan; label: string } | null;
  onSelectBarn: (barnId: string) => void;
  onOpenController: (payload: BarnModelOpenController) => void;
  onMoveBarn?: (barnId: string, x: number, z: number) => void;
  onRotateBarn?: (barnId: string, rotDeg: number) => void;
  onResizeBarn?: (
    barnId: string,
    plan: BarnModelRoomPlan,
    opts?: { pin?: "front" | "back" },
  ) => void;
  onMoveBarnEnd?: () => void;
  onPlaceAt?: (x: number, z: number) => void;
  readings?: BarnReading[];
  peekKey?: string | null;
  onPeekKeyChange?: (key: string) => void;
  liveTrend?: BarnModelLiveTrend;
  editingBarnId?: string | null;
  onEditBarn?: (barnId: string) => void;
  onDeleteBarn?: (barnId: string) => void;
  onEntranceBarn?: (barnId: string) => void;
  onBackToField?: () => void;
  onPrevBarn?: () => void;
  onNextBarn?: () => void;
  onCycleType?: () => void;
  onPeekControllers?: () => void;
  highlightControllerKey?: string | null;
};

function applyRoofCameraPose(
  camera: THREE.Camera,
  pose: { position: [number, number, number]; lookAt: [number, number, number] },
  controls?: { target: THREE.Vector3; update: () => void } | null,
) {
  camera.up.set(0, 1, 0);
  camera.position.set(...pose.position);
  camera.lookAt(...pose.lookAt);
  if (controls) {
    controls.target.set(...pose.lookAt);
    controls.update();
  }
}

const ROOF_POLAR = Math.atan2(1.6, 62);

function CameraRig({
  shot,
  selectedBarnId,
  yard,
}: Pick<SceneProps, "shot" | "selectedBarnId" | "yard">) {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const next = barnModelCameraPose(shot, yard, selectedBarnId);
    camera.up.set(0, 1, 0);
    camera.position.set(...next.position);
    camera.lookAt(...next.lookAt);
  }, [camera, shot, selectedBarnId, yard]);
  useFrame(() => {
    const next = barnModelCameraPose(shot, yard, selectedBarnId);
    camera.up.set(0, 1, 0);
    camera.position.set(...next.position);
    camera.lookAt(...next.lookAt);
  });
  return null;
}

type RoofMapControls = {
  target: THREE.Vector3;
  update: () => void;
  enabled: boolean;
  enableDamping: boolean;
};

function roofPoseFor(
  yard: BarnModelYard,
  editingBarnId?: string | null,
) {
  if (editingBarnId) {
    const barn = yard.barns.find((b) => b.id === editingBarnId);
    if (barn) return barnModelEditCameraPose(barn);
  }
  return barnModelCameraPose("roof", yard, null);
}

function RoofControls({
  yard,
  dragging,
  editingBarnId,
}: {
  yard: BarnModelYard;
  dragging: boolean;
  editingBarnId?: string | null;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<RoofMapControls>(null);
  const origUpdate = useRef<(() => void) | null>(null);
  const destPos = useRef(new THREE.Vector3());
  const destLook = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const flying = useRef(false);
  const editId = editingBarnId ?? null;
  const [session, setSession] = useState<{
    editId: string | null;
    locked: boolean;
    h: number | null;
  }>({ editId: null, locked: false, h: null });

  if (session.editId !== editId) {
    setSession({
      editId,
      locked: true,
      h: editId ? roofPoseFor(yard, editId).position[1] : null,
    });
  }
  const camLocked = session.locked;
  const roofH =
    session.h ?? barnModelCameraPose("roof", yard, null).position[1];

  useLayoutEffect(() => {
    const snap = barnModelCameraPose("roof", yard, null);
    applyRoofCameraPose(camera, snap, controlsRef.current);
    destPos.current.set(...snap.position);
    destLook.current.set(...snap.lookAt);
    look.current.set(...snap.lookAt);
    const id = requestAnimationFrame(() => {
      applyRoofCameraPose(camera, snap, controlsRef.current);
    });
    return () => cancelAnimationFrame(id);
    // 첫 필드 진입만 스냅.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);

  useLayoutEffect(() => {
    if (!camLocked) return;
    const next = roofPoseFor(yard, editingBarnId);
    destPos.current.set(...next.position);
    destLook.current.set(...next.lookAt);
    const controls = controlsRef.current;
    if (controls) look.current.copy(controls.target);
    else look.current.copy(destLook.current);
    flying.current = true;
    if (controls) {
      if (!origUpdate.current) origUpdate.current = controls.update.bind(controls);
      controls.update = () => undefined;
      controls.enabled = false;
      controls.enableDamping = false;
    }
    // 편집 시작/종료만 이동. 칸을 늘려도 줌·거리를 빼앗지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camLocked, editingBarnId]);

  useFrame((_, dt) => {
    const controls = controlsRef.current;
    if (!flying.current) {
      if (controls && origUpdate.current) {
        controls.update = origUpdate.current;
        controls.enableDamping = true;
        controls.enabled = !dragging;
      }
      return;
    }
    const t = 1 - Math.exp(-dt * 3.2);
    camera.position.lerp(destPos.current, t);
    look.current.lerp(destLook.current, t);
    camera.up.set(0, 1, 0);
    camera.lookAt(look.current);
    if (
      camera.position.distanceTo(destPos.current) < 0.08 &&
      look.current.distanceTo(destLook.current) < 0.08
    ) {
      if (controls && origUpdate.current) {
        controls.update = origUpdate.current;
      }
      applyRoofCameraPose(
        camera,
        {
          position: [
            destPos.current.x,
            destPos.current.y,
            destPos.current.z,
          ],
          lookAt: [
            destLook.current.x,
            destLook.current.y,
            destLook.current.z,
          ],
        },
        controls,
      );
      look.current.copy(destLook.current);
      flying.current = false;
      if (controls) {
        controls.enableDamping = true;
        controls.enabled = !dragging;
      }
      setSession((prev) =>
        prev.locked ? { ...prev, locked: false } : prev,
      );
    }
  }, -2);

  return (
    <MapControls
      ref={controlsRef}
      makeDefault
      enableRotate={false}
      enableDamping={!camLocked}
      enabled={!dragging && !camLocked}
      minDistance={roofH * 0.4}
      maxDistance={roofH * 2.1}
      minPolarAngle={ROOF_POLAR}
      maxPolarAngle={ROOF_POLAR}
    />
  );
}

function PenMesh({
  barnId,
  pen,
  typeControllerKey,
  editing,
  onOpenController,
}: {
  barnId: string;
  pen: BarnModelPen;
  typeControllerKey: string | null;
  editing?: boolean;
  onOpenController: (payload: BarnModelOpenController) => void;
}) {
  const color = barnModelStatusHex(pen.status);
  const live = pen.status !== "empty";
  const [penW, penL] = pen.size;

  return (
    <mesh
      position={pen.localPos}
      receiveShadow
      onClick={(e) => {
        e.stopPropagation();
        if (editing) return;
        if (typeControllerKey) {
          onOpenController({ barnId, controllerKey: typeControllerKey });
        }
      }}
    >
      <boxGeometry args={[penW, editing ? 0.16 : 0.08, penL]} />
      <meshStandardMaterial
        color={color}
        transparent
        opacity={editing ? (live ? 0.88 : 0.35) : live ? 0.55 : 0.22}
      />
    </mesh>
  );
}

function roofPitch(width: number, roofRise: number) {
  const halfW = width / 2;
  return {
    pitch: Math.atan2(roofRise, halfW),
    slopeLen: Math.hypot(halfW, roofRise),
  };
}

function GablePeak({
  width,
  wallH,
  roofRise,
  z,
  color,
  ghost,
}: {
  width: number;
  wallH: number;
  roofRise: number;
  z: number;
  color: string;
  ghost?: boolean;
}) {
  const geom = useMemo(() => {
    const hw = width / 2;
    const shape = new THREE.Shape();
    shape.moveTo(-hw, wallH);
    shape.lineTo(0, wallH + roofRise + 0.02);
    shape.lineTo(hw, wallH);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.16,
      bevelEnabled: false,
    });
  }, [width, wallH, roofRise]);
  return (
    <mesh geometry={geom} position={[0, 0, z]}>
      <meshStandardMaterial
        color={color}
        transparent={ghost}
        opacity={ghost ? 0.2 : 1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

const SEG_ON = [
  [1, 1, 1, 1, 1, 1, 0],
  [0, 1, 1, 0, 0, 0, 0],
  [1, 1, 0, 1, 1, 0, 1],
  [1, 1, 1, 1, 0, 0, 1],
  [0, 1, 1, 0, 0, 1, 1],
  [1, 0, 1, 1, 0, 1, 1],
  [1, 0, 1, 1, 1, 1, 1],
  [1, 1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 1, 1],
] as const;

function LedSeg({
  position,
  size,
  on,
}: {
  position: [number, number, number];
  size: [number, number, number];
  on: boolean;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={on ? "#ff3b3b" : "#3f1212"}
        emissive={on ? "#ff1f1f" : "#000000"}
        emissiveIntensity={on ? 1.4 : 0}
        roughness={0.35}
      />
    </mesh>
  );
}

function SevenSegDigit({
  digit,
  position,
  on,
}: {
  digit: number;
  position: [number, number, number];
  on: boolean;
}) {
  const n = Number.isFinite(digit) ? Math.max(0, Math.min(9, Math.trunc(digit))) : 8;
  const bits = SEG_ON[n] ?? SEG_ON[8];
  const lit = (i: number) => on && bits[i] === 1;
  const hx = 0.012;
  const hy = 0.0024;
  const vx = 0.0024;
  const vy = 0.011;
  const t = 0.0018;
  return (
    <group position={position}>
      <LedSeg position={[0, 0.013, 0]} size={[hx, hy, t]} on={lit(0)} />
      <LedSeg position={[0.006, 0.0065, 0]} size={[vx, vy, t]} on={lit(1)} />
      <LedSeg position={[0.006, -0.0065, 0]} size={[vx, vy, t]} on={lit(2)} />
      <LedSeg position={[0, -0.013, 0]} size={[hx, hy, t]} on={lit(3)} />
      <LedSeg position={[-0.006, -0.0065, 0]} size={[vx, vy, t]} on={lit(4)} />
      <LedSeg position={[-0.006, 0.0065, 0]} size={[vx, vy, t]} on={lit(5)} />
      <LedSeg position={[0, 0, 0]} size={[hx, hy, t]} on={lit(6)} />
    </group>
  );
}

function RoundKey({
  position,
  color,
}: {
  position: [number, number, number];
  color: string;
}) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.009, 0.009, 0.006, 14]} />
      <meshStandardMaterial color={color} roughness={0.32} />
    </mesh>
  );
}

function channelPctLabel(n: number | null, lit: boolean): string {
  if (!lit || n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(Math.max(0, Math.min(100, n))));
}

function channelsFromReading(reading: BarnReading | undefined): ChannelPercents | undefined {
  if (!reading?.channels?.length) return undefined;
  return {
    A: channelBySlot(reading.channels, "A")?.fanPct ?? null,
    B: channelBySlot(reading.channels, "B")?.fanPct ?? null,
    C: channelBySlot(reading.channels, "C")?.fanPct ?? null,
  };
}

function BleonControllerMesh({
  onClick,
  lit = true,
  tempC = null,
  eqpmnNo,
  selected = false,
  channels,
}: {
  onClick?: () => void;
  lit?: boolean;
  tempC?: number | null;
  eqpmnNo?: string;
  selected?: boolean;
  channels?: ChannelPercents;
}) {
  const meshScale = BARN_CTRL_W / 0.34;
  const w = 0.34;
  const h = 0.24;
  const d = 0.08;
  const z = d / 2 + 0.002;
  const digits = (() => {
    if (tempC == null || !lit) return [8, 8, 8] as const;
    const t = Math.abs(tempC);
    const whole = Math.min(99, Math.floor(t));
    const frac = Math.floor((t - Math.floor(t)) * 10);
    return [Math.floor(whole / 10), whole % 10, frac] as const;
  })();
  const keys: { x: number; y: number; color: string }[] = [];
  for (let r = 0; r < 3; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      const red = r === 2 && c === 2;
      const green = r === 2 && c === 3;
      keys.push({
        x: 0.035 + c * 0.024,
        y: -0.012 - r * 0.024,
        color: red ? "#dc2626" : green ? "#16a34a" : "#d4d4d8",
      });
    }
  }
  const barOn = lit ? 6 : 0;
  return (
    <group
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {selected ? (
        <pointLight
          position={[0, 0, 0.28]}
          color="#7dd3fc"
          intensity={1.8}
          distance={1.8}
        />
      ) : null}
      <group scale={meshScale}>
      {selected ? (
        <mesh position={[0, 0, -0.012]}>
          <boxGeometry args={[w + 0.07, h + 0.07, 0.03]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#38bdf8"
            emissiveIntensity={1.4}
            transparent
            opacity={0.55}
          />
        </mesh>
      ) : null}
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color={selected ? "#e0f2fe" : "#f4f4f5"}
          roughness={0.42}
          emissive={selected ? "#38bdf8" : "#000000"}
          emissiveIntensity={selected ? 0.85 : 0}
        />
      </mesh>
      <mesh position={[-0.07, h / 2 + 0.012, 0]}>
        <boxGeometry args={[0.04, 0.02, 0.03]} />
        <meshStandardMaterial color="#d4d4d8" />
      </mesh>
      <mesh position={[0.07, h / 2 + 0.012, 0]}>
        <boxGeometry args={[0.04, 0.02, 0.03]} />
        <meshStandardMaterial color="#d4d4d8" />
      </mesh>
      <mesh position={[0, h / 2 - 0.016, z]}>
        <boxGeometry args={[w * 0.94, 0.026, 0.004]} />
        <meshStandardMaterial color="#15803d" roughness={0.4} />
      </mesh>
      <mesh position={[-w / 2 + 0.038, 0.012, z + 0.004]}>
        <boxGeometry args={[0.03, 0.058, 0.014]} />
        <meshStandardMaterial color="#171717" roughness={0.28} />
      </mesh>
      <mesh position={[-w / 2 + 0.038, 0.022, z + 0.012]} rotation={[0.18, 0, 0]}>
        <boxGeometry args={[0.026, 0.022, 0.006]} />
        <meshStandardMaterial color="#262626" />
      </mesh>
      {[0.055, 0.032, 0.009, -0.014].map((y, i) => (
        <mesh key={`led-${i}`} position={[-w / 2 + 0.072, y, z + 0.003]}>
          <boxGeometry args={[0.008, 0.008, 0.003]} />
          <meshStandardMaterial
            color={lit && i < 2 ? "#ef4444" : "#7f1d1d"}
            emissive={lit && i < 2 ? "#ef4444" : "#000000"}
            emissiveIntensity={lit && i < 2 ? 1.1 : 0}
          />
        </mesh>
      ))}
      {Array.from({ length: 10 }, (_, i) => {
        const on = i < barOn;
        return (
          <mesh
            key={`bar-${i}`}
            position={[-0.055, -0.055 + i * 0.011, z + 0.003]}
          >
            <boxGeometry args={[0.016, 0.008, 0.003]} />
            <meshStandardMaterial
              color={on ? "#22c55e" : "#14532d"}
              emissive={on ? "#16a34a" : "#000000"}
              emissiveIntensity={on ? 0.7 : 0}
            />
          </mesh>
        );
      })}
      <mesh position={[0.07, 0.052, z + 0.001]}>
        <boxGeometry args={[0.13, 0.05, 0.006]} />
        <meshStandardMaterial color="#111827" roughness={0.25} />
      </mesh>
      <SevenSegDigit
        digit={digits[0]}
        position={[0.03, 0.052, z + 0.006]}
        on={lit}
      />
      <SevenSegDigit
        digit={digits[1]}
        position={[0.056, 0.052, z + 0.006]}
        on={lit}
      />
      <mesh position={[0.072, 0.04, z + 0.006]}>
        <boxGeometry args={[0.003, 0.003, 0.002]} />
        <meshStandardMaterial
          color={lit ? "#ff3b3b" : "#3f1212"}
          emissive={lit ? "#ff1f1f" : "#000000"}
          emissiveIntensity={lit ? 1.2 : 0}
        />
      </mesh>
      <SevenSegDigit
        digit={digits[2]}
        position={[0.094, 0.052, z + 0.006]}
        on={lit}
      />
      {keys.map((k) => (
        <RoundKey
          key={`${k.x}-${k.y}`}
          position={[k.x, k.y, z + 0.004]}
          color={k.color}
        />
      ))}
      </group>
      {eqpmnNo ? (
        <Html
          transform
          occlude={false}
          center
          position={[0, BARN_CTRL_H / 2 + 0.08, 0.08]}
          scale={0.22}
          zIndexRange={[80, 10]}
          style={{ pointerEvents: "none" }}
        >
          <div className="rounded-md bg-neutral-900 px-1.5 py-0.5 text-[11px] font-bold text-white shadow-sm">
            {formatControllerNoLabel(eqpmnNo)}
          </div>
        </Html>
      ) : null}
      <Html
        transform
        occlude={false}
        center
        position={[-BARN_CTRL_W * 0.28, -BARN_CTRL_H / 2 - 0.02, 0.06]}
        scale={0.18}
        zIndexRange={[80, 10]}
        style={{ pointerEvents: "none" }}
      >
        <div className="flex items-baseline gap-1.5 rounded-md bg-neutral-900/92 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white shadow-sm">
          {(["A", "B", "C"] as const).map((slot) => (
            <span key={slot} className="whitespace-nowrap">
              <span className="text-white/70">{slot}-</span>
              <span className={cn(dashboardUi.channelTextMotor)}>
                {channelPctLabel(channels?.[slot] ?? null, lit)}
              </span>
            </span>
          ))}
        </div>
      </Html>
    </group>
  );
}

function BarnMesh({
  building,
  selected,
  editing,
  showLabels,
  showEntranceCard,
  editMode,
  ghost,
  typeReadings,
  peekKey,
  liveTrend,
  onSelectBarn,
  onEditBarn,
  onDeleteBarn,
  onEntranceBarn,
  onBackToField,
  onPrevBarn,
  onNextBarn,
  onCycleType,
  onPeekControllers,
  highlightControllerKey,
  onOpenController,
  onDragStart,
  onRotateStart,
  onLengthStart,
  onSideStart,
}: {
  building: BarnModelBuilding;
  selected: boolean;
  editing: boolean;
  showLabels: boolean;
  showEntranceCard?: boolean;
  editMode: boolean;
  ghost?: boolean;
  typeReadings: BarnReading[];
  peekKey: string | null;
  liveTrend?: BarnModelLiveTrend;
  onSelectBarn: (barnId: string) => void;
  onEditBarn?: (barnId: string) => void;
  onDeleteBarn?: (barnId: string) => void;
  onEntranceBarn?: (barnId: string) => void;
  onBackToField?: () => void;
  onPrevBarn?: () => void;
  onNextBarn?: () => void;
  onCycleType?: () => void;
  onPeekControllers?: () => void;
  highlightControllerKey?: string | null;
  onOpenController: (payload: BarnModelOpenController) => void;
  onDragStart: (barnId: string) => void;
  onRotateStart?: (barnId: string, hit: THREE.Vector3) => void;
  onLengthStart?: (barnId: string) => void;
  onSideStart?: (barnId: string, side: "left" | "right") => void;
}) {
  const { wallH, aisleW, roofRise } = BARN_MODEL_DIM;
  const { width, length } = building;
  const aisleX = barnModelAisleX(building.plan, width);
  const color = ghost ? "#38bdf8" : barnModelStatusHex(building.status);
  const wall = ghost ? "#7dd3fc" : "#d6d3d1";
  const rot = (building.rotDeg * Math.PI) / 180;
  const aisleLeft = aisleX - aisleW / 2;
  const aisleRight = aisleX + aisleW / 2;
  const roofSeeThrough = Boolean(ghost || editing);
  const roofOp = ghost ? 0.16 : editing ? 0.12 : 1;
  const wallSeeThrough = Boolean(ghost || editing);
  const wallOp = ghost ? 0.2 : editing ? 0.32 : 1;
  const wallMat = {
    color: wall,
    transparent: wallSeeThrough,
    opacity: wallOp,
    depthWrite: !wallSeeThrough,
    side: wallSeeThrough ? THREE.DoubleSide : THREE.FrontSide,
  };
  const wallDims = { width, length, aisleX, aisleW };
  const controllerMounts =
    ghost || !showEntranceCard
      ? []
      : mountBarnControllers(typeReadings, wallDims);

  return (
    <group position={building.origin} rotation={[0, rot, 0]}>
      <mesh
        position={[0, 0.02, 0]}
        receiveShadow
        onPointerDown={
          ghost
            ? undefined
            : (e) => {
                e.stopPropagation();
                if (e.button === 2) return;
                onSelectBarn(building.id);
                if (editMode && editing) onDragStart(building.id);
              }
        }
        onContextMenu={
          ghost
            ? undefined
            : (e) => {
                e.stopPropagation();
                e.nativeEvent.preventDefault();
                onEditBarn?.(building.id);
              }
        }
      >
        <boxGeometry args={[width, 0.04, length]} />
        <meshStandardMaterial
          color={ghost ? "#38bdf8" : selected ? "#78716c" : "#a8a29e"}
          transparent={ghost}
          opacity={ghost ? 0.22 : 1}
        />
      </mesh>
      <mesh position={[aisleX, 0.03, 0]} receiveShadow>
        <boxGeometry args={[aisleW, 0.05, length - 0.2]} />
        <meshStandardMaterial
          color={ghost ? "#38bdf8" : "#78716c"}
          transparent={ghost}
          opacity={ghost ? 0.2 : 1}
        />
      </mesh>

      <mesh position={[-(width / 2 - 0.08), wallH / 2, 0]}>
        <boxGeometry args={[0.16, wallH, length]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      <mesh position={[width / 2 - 0.08, wallH / 2, 0]}>
        <boxGeometry args={[0.16, wallH, length]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      <mesh position={[0, wallH / 2, -(length / 2 - 0.08)]}>
        <boxGeometry args={[width, wallH, 0.16]} />
        <meshStandardMaterial {...wallMat} />
      </mesh>
      {(() => {
        const segs = [
          { from: -width / 2, to: aisleLeft },
          { from: aisleRight, to: width / 2 },
        ].filter((s) => s.to - s.from > 0.2);
        return segs.map((s) => (
          <mesh
            key={`${s.from}-${s.to}`}
            position={[(s.from + s.to) / 2, wallH / 2, length / 2 - 0.08]}
          >
            <boxGeometry args={[s.to - s.from, wallH, 0.16]} />
            <meshStandardMaterial {...wallMat} />
          </mesh>
        ));
      })()}

      {editing ? null : (
        <>
          <GablePeak
            width={width}
            wallH={wallH}
            roofRise={roofRise}
            z={length / 2 - 0.16}
            color={wall}
            ghost={ghost}
          />
          <GablePeak
            width={width}
            wallH={wallH}
            roofRise={roofRise}
            z={-(length / 2)}
            color={wall}
            ghost={ghost}
          />
          {(() => {
            const { pitch, slopeLen } = roofPitch(width, roofRise);
            const y = wallH + roofRise / 2;
            return (
              <>
                <mesh
                  position={[-width / 4, y, 0]}
                  rotation={[0, 0, pitch]}
                >
                  <boxGeometry args={[slopeLen + 0.08, 0.08, length + 0.24]} />
                  <meshStandardMaterial
                    color={color}
                    transparent={roofSeeThrough}
                    opacity={roofOp}
                    depthWrite={!roofSeeThrough}
                  />
                </mesh>
                <mesh
                  position={[width / 4, y, 0]}
                  rotation={[0, 0, -pitch]}
                >
                  <boxGeometry args={[slopeLen + 0.08, 0.08, length + 0.24]} />
                  <meshStandardMaterial
                    color={color}
                    transparent={roofSeeThrough}
                    opacity={roofOp}
                    depthWrite={!roofSeeThrough}
                  />
                </mesh>
              </>
            );
          })()}
        </>
      )}

      {ghost
        ? null
        : building.pens.map((pen) => (
            <PenMesh
              key={pen.id}
              barnId={building.id}
              pen={pen}
              typeControllerKey={building.controllerKey}
              editing={editing}
              onOpenController={onOpenController}
            />
          ))}

      {controllerMounts.map((mount) => {
        const reading = typeReadings.find(
          (r) => r.controllerKey === mount.controllerKey,
        );
        return (
        <group
          key={mount.controllerKey}
          position={mount.position}
          rotation={[0, mount.rotY, 0]}
        >
          <BleonControllerMesh
            eqpmnNo={mount.eqpmnNo}
            lit={mount.status !== "offline"}
            tempC={mount.tempC}
            selected={highlightControllerKey === mount.controllerKey}
            channels={channelsFromReading(reading)}
            onClick={() => {
              onOpenController({
                barnId: building.id,
                controllerKey: mount.controllerKey,
              });
            }}
          />
        </group>
        );
      })}

      {editing && editMode && !ghost ? (
        <BarnEditGizmos
          plan={building.plan}
          stallTyCode={building.stallTyCode}
          width={width}
          length={length}
          rotDeg={building.rotDeg}
          onRotateStart={(hit) => onRotateStart?.(building.id, hit)}
          onLengthStart={() => onLengthStart?.(building.id)}
          onSideStart={(side) => onSideStart?.(building.id, side)}
        />
      ) : null}

      {showLabels && !ghost && !editing ? (
        <Html
          position={[0, wallH + roofRise + 1.2, 0]}
          center
          zIndexRange={[120, 20]}
          style={{ pointerEvents: "auto" }}
        >
          <BarnModelRoofCard
            stallTyCode={building.stallTyCode}
            stallNo={building.stallNo}
            status={building.status}
            tempC={building.tempC}
            humidityPct={building.humidityPct}
            reading={
              typeReadings.find((r) => r.controllerKey === peekKey) ??
              typeReadings[0] ??
              null
            }
            trend={liveTrend ?? {}}
            onDelete={
              onDeleteBarn ? () => onDeleteBarn(building.id) : undefined
            }
          />
        </Html>
      ) : null}

      {showLabels && !ghost && !editing ? (
        <BarnEntranceGui
          aisleX={aisleX}
          length={length}
          onClick={() => onEntranceBarn?.(building.id)}
        />
      ) : null}

      {showEntranceCard && !ghost ? (
        <Html
          transform
          occlude={false}
          center
          position={[aisleX, wallH + 0.22, length / 2 + 0.1]}
          scale={barnModelEntranceCardScale(width)}
          zIndexRange={[8, 1]}
          style={{ pointerEvents: "auto" }}
        >
          <BarnModelRoofCard
            stallTyCode={building.stallTyCode}
            stallNo={building.stallNo}
            status={building.status}
            tempC={building.tempC}
            humidityPct={building.humidityPct}
            reading={
              typeReadings.find((r) => r.controllerKey === peekKey) ??
              typeReadings[0] ??
              null
            }
            trend={liveTrend ?? {}}
            onDelete={
              onDeleteBarn ? () => onDeleteBarn(building.id) : undefined
            }
            onBackToField={onBackToField}
            onPrevBarn={onPrevBarn}
            onNextBarn={onNextBarn}
            onCycleType={onCycleType}
            onPeekControllers={onPeekControllers}
          />
        </Html>
      ) : null}
    </group>
  );
}

function BarnEntranceGui({
  aisleX,
  length,
  onClick,
}: {
  aisleX: number;
  length: number;
  onClick: () => void;
}) {
  return (
    <Html
      position={[aisleX, 0.9, length / 2 + 1.15]}
      center
      style={{ pointerEvents: "auto" }}
    >
      <button
        type="button"
        className="inline-flex size-14 items-center justify-center rounded-lg bg-background shadow-md ring-1 ring-border text-foreground"
        aria-label="입구 보기"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <DoorOpen
          className="size-8"
          strokeWidth={dashboardUi.iconStroke}
          aria-hidden
        />
      </button>
    </Html>
  );
}

function StretchHandle({
  position,
  yaw,
  color,
  onPointerDown,
}: {
  position: [number, number, number];
  yaw: number;
  color: string;
  onPointerDown: () => void;
}) {
  return (
    <group position={position} rotation={[0, yaw, 0]}>
      <mesh
        onPointerDown={(e) => {
          markGizmoEvent(e);
          onPointerDown();
        }}
        onPointerUp={markGizmoEvent}
        onClick={markGizmoEvent}
      >
        <boxGeometry args={[0.32, 0.32, 1.35]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh
        position={[0, 0, 0.82]}
        rotation={[Math.PI / 2, 0, 0]}
        onPointerDown={(e) => {
          markGizmoEvent(e);
          onPointerDown();
        }}
        onPointerUp={markGizmoEvent}
        onClick={markGizmoEvent}
      >
        <coneGeometry args={[0.34, 0.72, 10]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

function RoomRowHandle({
  position,
  penDepth,
  onPointerDown,
}: {
  position: [number, number, number];
  penDepth: number;
  onPointerDown: () => void;
}) {
  const w = Math.min(Math.max(penDepth * 0.72, 0.95), 2.1);
  const grab = (e: { stopPropagation: () => void }) => {
    markGizmoEvent(e);
    onPointerDown();
  };
  return (
    <group position={position}>
      <mesh
        onPointerDown={grab}
        onPointerUp={markGizmoEvent}
        onClick={markGizmoEvent}
      >
        <boxGeometry args={[w, 0.2, 0.38]} />
        <meshStandardMaterial color="#16a34a" />
      </mesh>
      {[-0.22, 0, 0.22].map((x) => (
        <mesh
          key={x}
          position={[x, 0.16, 0]}
          onPointerDown={grab}
          onPointerUp={markGizmoEvent}
          onClick={markGizmoEvent}
        >
          <boxGeometry args={[0.09, 0.14, 0.3]} />
          <meshStandardMaterial color="#14532d" />
        </mesh>
      ))}
    </group>
  );
}

function sideRoomHandleLocal(
  plan: BarnModelRoomPlan,
  stallTyCode: string,
  width: number,
  length: number,
  side: "left" | "right",
): [number, number, number] {
  const spec = barnModelTypeSpec(stallTyCode);
  const aisleX = barnModelAisleX(plan, width);
  const xSign = side === "left" ? -1 : 1;
  const x = aisleX + xSign * (BARN_MODEL_DIM.aisleW / 2 + spec.penDepth / 2);
  const index = Math.max(plan[side] - 1, 0);
  const rows = Math.max(plan.left, plan.right, 1);
  const penLen = (length - spec.endPad * 0.24) / rows;
  const zRoom = length / 2 - penLen * (index + 0.5);
  return [x, 0.42, zRoom - penLen / 2 - 0.32];
}

let suppressGroundClick = false;

function markGizmoEvent(e: { stopPropagation: () => void }) {
  e.stopPropagation();
  suppressGroundClick = true;
}

const DIM_COLOR = "#44403c";

function BarnDimLine({
  a,
  b,
  value,
}: {
  a: [number, number, number];
  b: [number, number, number];
  value: number;
}) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.05) return null;
  const dir = new THREE.Vector3(dx, dy, dz).normalize();
  const hint =
    Math.abs(dir.y) > 0.85
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
  const tick = new THREE.Vector3().crossVectors(dir, hint);
  if (tick.lengthSq() < 1e-6) {
    tick.crossVectors(dir, new THREE.Vector3(0, 0, 1));
  }
  tick.normalize().multiplyScalar(0.14);
  const mid: [number, number, number] = [
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    (a[2] + b[2]) / 2,
  ];
  const tickA: [[number, number, number], [number, number, number]] = [
    [a[0] - tick.x, a[1] - tick.y, a[2] - tick.z],
    [a[0] + tick.x, a[1] + tick.y, a[2] + tick.z],
  ];
  const tickB: [[number, number, number], [number, number, number]] = [
    [b[0] - tick.x, b[1] - tick.y, b[2] - tick.z],
    [b[0] + tick.x, b[1] + tick.y, b[2] + tick.z],
  ];
  return (
    <group>
      <Line points={[a, b]} color={DIM_COLOR} lineWidth={1.6} raycast={() => {}} />
      <Line points={tickA} color={DIM_COLOR} lineWidth={1.4} raycast={() => {}} />
      <Line points={tickB} color={DIM_COLOR} lineWidth={1.4} raycast={() => {}} />
      <Html position={mid} center style={{ pointerEvents: "none" }}>
        <span className="rounded-sm bg-background/90 px-1 py-px text-[10px] font-medium tabular-nums text-foreground ring-1 ring-border">
          {value.toFixed(1)}
        </span>
      </Html>
    </group>
  );
}

function BarnEditGizmos({
  plan,
  stallTyCode,
  width,
  length,
  rotDeg,
  onRotateStart,
  onLengthStart,
  onSideStart,
}: {
  plan: BarnModelRoomPlan;
  stallTyCode: string;
  width: number;
  length: number;
  rotDeg: number;
  onRotateStart: (hit: THREE.Vector3) => void;
  onLengthStart: () => void;
  onSideStart: (side: "left" | "right") => void;
}) {
  const { camera } = useThree();
  const rootRef = useRef<THREE.Group>(null);
  const localCam = useRef(new THREE.Vector3());
  const [face, setFace] = useState({ x: -1, z: 1 });
  useFrame(() => {
    const root = rootRef.current;
    if (!root) return;
    localCam.current.copy(camera.position);
    root.worldToLocal(localCam.current);
    const x = localCam.current.x >= 0 ? 1 : -1;
    const z = localCam.current.z >= 0 ? 1 : -1;
    setFace((prev) => (prev.x === x && prev.z === z ? prev : { x, z }));
  });
  const ringR = Math.max(width, length) * 0.42 + 2.4;
  const ticks = [0, 90, 180, 270] as const;
  const hx = (width / 2) * face.x;
  const hz = (length / 2) * face.z;
  return (
    <group ref={rootRef}>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0.12, 0]}
        onPointerDown={(e) => {
          markGizmoEvent(e);
          onRotateStart(e.point);
        }}
        onPointerUp={markGizmoEvent}
        onClick={markGizmoEvent}
      >
        <ringGeometry args={[ringR - 0.42, ringR + 0.42, 64]} />
        <meshBasicMaterial
          color="#0ea5e9"
          transparent
          opacity={0.38}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0.16, 0]}
        onPointerDown={(e) => {
          markGizmoEvent(e);
          onRotateStart(e.point);
        }}
        onPointerUp={markGizmoEvent}
        onClick={markGizmoEvent}
      >
        <torusGeometry args={[ringR, 0.08, 8, 48]} />
        <meshStandardMaterial color="#0369a1" />
      </mesh>
      {ticks.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <mesh
            key={deg}
            position={[Math.sin(rad) * ringR, 0.28, Math.cos(rad) * ringR]}
          >
            <boxGeometry args={[0.22, 0.22, 0.22]} />
            <meshStandardMaterial color={deg === 0 ? "#0369a1" : "#7dd3fc"} />
          </mesh>
        );
      })}
      <Html
        position={[0, 1.15, ringR]}
        center
        style={{ pointerEvents: "none" }}
      >
        <div className="flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-primary-foreground shadow-sm">
          <RotateCw className="size-3.5" />
          <span className="text-[10px] font-medium tabular-nums">
            {Math.round(rotDeg)}°
          </span>
        </div>
      </Html>
      <BarnDimLine
        a={[-width / 2, 0.1, hz + face.z * 0.42]}
        b={[width / 2, 0.1, hz + face.z * 0.42]}
        value={width}
      />
      <BarnDimLine
        a={[hx + face.x * 0.48, 0.1, -length / 2]}
        b={[hx + face.x * 0.48, 0.1, length / 2]}
        value={length}
      />
      <BarnDimLine
        a={[hx + face.x * 0.22, 0, hz + face.z * 0.22]}
        b={[hx + face.x * 0.22, BARN_MODEL_DIM.wallH, hz + face.z * 0.22]}
        value={BARN_MODEL_DIM.wallH}
      />
      <StretchHandle
        position={[0, 0.42, length / 2 + 0.85]}
        yaw={0}
        color="#d97706"
        onPointerDown={() => onLengthStart()}
      />
      {(["left", "right"] as const).map((side) => (
        <RoomRowHandle
          key={side}
          position={sideRoomHandleLocal(plan, stallTyCode, width, length, side)}
          penDepth={barnModelTypeSpec(stallTyCode).penDepth}
          onPointerDown={() => onSideStart(side)}
        />
      ))}
    </group>
  );
}

type EditDrag =
  | { type: "move"; id: string }
  | {
      type: "rotate";
      id: string;
      ox: number;
      oz: number;
      startAtan: number;
      startRot: number;
    }
  | {
      type: "length";
      id: string;
      ox: number;
      oz: number;
      rotDeg: number;
      plan: BarnModelRoomPlan;
    }
  | {
      type: "side";
      id: string;
      ox: number;
      oz: number;
      rotDeg: number;
      plan: BarnModelRoomPlan;
      side: "left" | "right";
      startLz?: number;
    };

function YardContents(props: SceneProps & { dragging: boolean; setDragging: (v: boolean) => void }) {
  const showLabels = props.shot === "roof";
  const editMode = props.shot === "roof";
  const yardBounds = barnModelYardBounds(props.yard);
  const gridSize = barnModelYardGridSize(yardBounds.span);
  const [gridX, , gridZ] = props.yard.center;
  const { camera, gl } = useThree();
  const dragRef = useRef<EditDrag | null>(null);
  const [ghostAt, setGhostAt] = useState<[number, number] | null>(null);
  const moveBarn = props.onMoveBarn;
  const rotateBarn = props.onRotateBarn;
  const resizeBarn = props.onResizeBarn;
  const moveEnd = props.onMoveBarnEnd;
  const setDragging = props.setDragging;
  const placing = Boolean(props.placing && props.placingDraft);
  const placingPlan = props.placingDraft?.plan ?? null;
  const placingTy = props.placingDraft?.stallTyCode ?? "";
  const barns = props.yard.barns;

  useEffect(() => {
    if (!editMode) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hitOf = (e: PointerEvent) => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      const raycaster = new THREE.Raycaster();
      const hit = new THREE.Vector3();
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(plane, hit)) return null;
      return hit;
    };
    const onMove = (e: PointerEvent) => {
      const hit = hitOf(e);
      if (!hit) return;
      if (placing && placingPlan) {
        const [sx, sz] = snapBarnFootprint(
          hit.x,
          hit.z,
          placingPlan,
          placingTy,
        );
        setGhostAt([sx, sz]);
        return;
      }
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.type === "move") {
        moveBarn?.(drag.id, hit.x, hit.z);
        return;
      }
      if (drag.type === "rotate") {
        const atan = Math.atan2(hit.x - drag.ox, hit.z - drag.oz);
        const deg =
          drag.startRot + ((atan - drag.startAtan) * 180) / Math.PI;
        rotateBarn?.(drag.id, deg);
        return;
      }
      const [, lz] = rotateY(hit.x - drag.ox, hit.z - drag.oz, -drag.rotDeg);
      const ty =
        barns.find((b) => b.id === drag.id)?.stallTyCode ?? "";
      if (drag.type === "length") {
        const rows = rowsFromDragLength(Math.abs(lz) * 2, ty);
        resizeBarn?.(drag.id, planFromRowDrag(drag.plan, rows));
        return;
      }
      if (drag.startLz === undefined) drag.startLz = lz;
      const next = planFromSideHandleDelta(
        drag.plan,
        drag.side,
        drag.startLz - lz,
        ty,
      );
      if (next === drag.plan) return;
      resizeBarn?.(drag.id, next, { pin: "front" });
    };
    const onUp = () => {
      if (placing) return;
      if (!dragRef.current) return;
      dragRef.current = null;
      suppressGroundClick = true;
      setDragging(false);
      moveEnd?.();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [
    editMode,
    placing,
    placingPlan,
    placingTy,
    barns,
    camera,
    gl,
    moveBarn,
    rotateBarn,
    resizeBarn,
    moveEnd,
    setDragging,
  ]);

  const ghost =
    placing && props.placingDraft && ghostAt
      ? ghostBuildingFromPlan(
          props.placingDraft.plan,
          props.placingDraft.label,
          [ghostAt[0], 0, ghostAt[1]],
          0,
          props.placingDraft.stallTyCode,
        )
      : null;

  return (
    <>
      <gridHelper
        args={[gridSize, gridSize, "#e2e8f0", "#e2e8f0"]}
        position={[gridX, 0.01, gridZ]}
      />
      <gridHelper
        args={[gridSize, Math.max(8, gridSize / 5), "#64748b", "#94a3b8"]}
        position={[gridX, 0.02, gridZ]}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          if (suppressGroundClick) {
            suppressGroundClick = false;
            return;
          }
          if (props.shot === "entrance") return;
          if (props.editingBarnId) return;
          if (props.placing && props.onPlaceAt) {
            if (ghostAt) {
              props.onPlaceAt(ghostAt[0], ghostAt[1]);
              return;
            }
            if (props.placingDraft) {
              const [sx, sz] = snapBarnFootprint(
                e.point.x,
                e.point.z,
                props.placingDraft.plan,
                props.placingDraft.stallTyCode,
              );
              props.onPlaceAt(sx, sz);
              return;
            }
            return;
          }
          props.onSelectBarn("");
        }}
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#bbf7d0" />
      </mesh>
      {props.yard.barns.map((building) => (
        <BarnMesh
          key={building.id}
          building={building}
          selected={props.selectedBarnId === building.id}
          editing={props.editingBarnId === building.id}
          showLabels={showLabels}
          showEntranceCard={
            props.shot === "entrance" &&
            props.selectedBarnId === building.id &&
            props.editingBarnId !== building.id
          }
          editMode={editMode && !props.placing}
          typeReadings={readingsForStallType(
            building.stallTyCode,
            props.readings ?? [],
          )}
          peekKey={props.peekKey ?? null}
          liveTrend={props.liveTrend}
          onSelectBarn={props.onSelectBarn}
          onEditBarn={props.onEditBarn}
          onDeleteBarn={props.onDeleteBarn}
          onEntranceBarn={props.onEntranceBarn}
          onBackToField={props.onBackToField}
          onPrevBarn={props.onPrevBarn}
          onNextBarn={props.onNextBarn}
          onCycleType={props.onCycleType}
          onPeekControllers={props.onPeekControllers}
          highlightControllerKey={props.highlightControllerKey}
          onOpenController={props.onOpenController}
          onDragStart={(id) => {
            if (props.placing) return;
            dragRef.current = { type: "move", id };
            props.setDragging(true);
          }}
          onRotateStart={(id, hit) => {
            const barn = props.yard.barns.find((b) => b.id === id);
            if (!barn) return;
            const [ox, , oz] = barn.origin;
            dragRef.current = {
              type: "rotate",
              id,
              ox,
              oz,
              startAtan: Math.atan2(hit.x - ox, hit.z - oz),
              startRot: barn.rotDeg,
            };
            props.setDragging(true);
          }}
          onLengthStart={(id) => {
            const barn = props.yard.barns.find((b) => b.id === id);
            if (!barn) return;
            dragRef.current = {
              type: "length",
              id,
              ox: barn.origin[0],
              oz: barn.origin[2],
              rotDeg: barn.rotDeg,
              plan: barn.plan,
            };
            props.setDragging(true);
          }}
          onSideStart={(id, side) => {
            const barn = props.yard.barns.find((b) => b.id === id);
            if (!barn) return;
            dragRef.current = {
              type: "side",
              id,
              ox: barn.origin[0],
              oz: barn.origin[2],
              rotDeg: barn.rotDeg,
              plan: barn.plan,
              side,
            };
            props.setDragging(true);
          }}
        />
      ))}
      {ghost ? (
        <BarnMesh
          building={ghost}
          selected={false}
          editing={false}
          showLabels
          editMode={false}
          ghost
          typeReadings={[]}
          peekKey={null}
          onSelectBarn={() => undefined}
          onOpenController={() => undefined}
          onDragStart={() => undefined}
        />
      ) : null}
    </>
  );
}

export function FarmBarnModelScene(props: SceneProps) {
  const [dragging, setDragging] = useState(false);
  return (
    <Canvas
      camera={{ position: [0, 62, 1.6], fov: 42, near: 0.1, far: 400 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#e2e8f0"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[18, 28, 12]} intensity={1.05} />
      {props.shot === "roof" ? (
        <RoofControls
          yard={props.yard}
          dragging={dragging}
          editingBarnId={props.editingBarnId}
        />
      ) : (
        <CameraRig
          shot={props.shot}
          selectedBarnId={props.selectedBarnId}
          yard={props.yard}
        />
      )}
      <YardContents
        {...props}
        dragging={dragging}
        setDragging={setDragging}
      />
    </Canvas>
  );
}
