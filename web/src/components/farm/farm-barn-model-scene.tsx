"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import {
  BARN_MODEL_DIM,
  barnModelFieldView,
  barnModelYardBounds,
  barnModelYardGridSize,
  barnModelStatusHex,
  ghostBuildingFromPlan,
  mountBarnControllers,
  readingsForStallType,
  type BarnModelBuilding,
  type BarnModelPen,
} from "@/lib/farm/barn-model-layout";
import { barnModelAisleCenters, type BarnModelDimAxis } from "@/lib/farm/barn-model-dim";
import {
  snapBarnFootprint,
  type BarnModelFillPatch,
  BARN_MODEL_SNAP_FINE_M,
} from "@/lib/farm/barn-model-prefs";
import { BarnModelFillCard } from "@/components/farm/farm-barn-model-fill-card";
import {
  BarnModelRoofCard,
  type BarnModelLiveTrend,
} from "@/components/farm/farm-barn-model-live-hud";
import type { BarnReading } from "@/lib/data/iot";
import { BarnModelCamera } from "@/components/farm/farm-barn-model-camera";
import {
  BleonControllerMesh,
  channelsFromReading,
} from "@/components/farm/farm-barn-model-controller-mesh";
import {
  BarnEditGizmos,
  barnEditDimStand,
} from "@/components/farm/farm-barn-model-gizmos";
import {
  BarnEntranceGui,
  BarnFieldCardHtml,
} from "@/components/farm/farm-barn-model-field-hud";
import { barnModelPointer } from "@/components/farm/farm-barn-model-pointer";
import type {
  BarnModelOpenController,
  BarnModelSceneProps,
} from "@/components/farm/farm-barn-model-types";

export type { BarnModelOpenController };

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
  onSetBarnShell,
  onSetBarnFill,
  onCycleTypeBarn,
  onOpenTrend,
  fillEditOpen,
  fillEditDirty,
  onFillEditOpenChange,
  onFillEditRevert,
  compactHud,
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
  onSetBarnShell?: (
    barnId: string,
    axis: BarnModelDimAxis,
    meters: number,
  ) => void;
  onSetBarnFill?: (barnId: string, patch: BarnModelFillPatch) => void;
  onCycleTypeBarn?: (barnId: string, dir: 1 | -1) => void;
  onOpenTrend?: (barnId: string) => void;
  fillEditOpen?: boolean;
  fillEditDirty?: boolean;
  onFillEditOpenChange?: (open: boolean) => void;
  onFillEditRevert?: () => void;
  compactHud?: boolean;
}) {
  const { roofRise } = BARN_MODEL_DIM;
  const { width, length, wallH, fill } = building;
  const aisleW = fill.aisleW;
  const aisleXs = barnModelAisleCenters(width, fill.banks, fill.penDepth, aisleW);
  const aisleX = aisleXs[0] ?? 0;
  const color = ghost ? "#38bdf8" : barnModelStatusHex(building.status);
  const wall = ghost ? "#7dd3fc" : "#d6d3d1";
  const rot = (building.rotDeg * Math.PI) / 180;
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
  const wallDims = { width, length, aisleX, aisleW, wallH };
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
      >
        <boxGeometry args={[width, 0.04, length]} />
        <meshStandardMaterial
          color={ghost ? "#38bdf8" : selected ? "#78716c" : "#a8a29e"}
          transparent={ghost}
          opacity={ghost ? 0.22 : 1}
        />
      </mesh>
      {aisleXs.map((ax) => (
        <mesh key={ax} position={[ax, 0.03, 0]} receiveShadow>
          <boxGeometry args={[aisleW, 0.05, length - 0.2]} />
          <meshStandardMaterial
            color={ghost ? "#38bdf8" : BARN_MODEL_DIM.aisleHex}
            transparent={ghost}
            opacity={ghost ? 0.2 : 1}
          />
        </mesh>
      ))}

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
        const segs: { from: number; to: number }[] = [];
        let cursor = -width / 2;
        for (const ax of aisleXs) {
          const aLeft = ax - aisleW / 2;
          if (aLeft - cursor > 0.2) segs.push({ from: cursor, to: aLeft });
          cursor = ax + aisleW / 2;
        }
        if (width / 2 - cursor > 0.2) {
          segs.push({ from: cursor, to: width / 2 });
        }
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

      {editing && editMode && !ghost && !compactHud ? (
        <BarnEditGizmos
          width={width}
          length={length}
          wallH={wallH}
          rotDeg={building.rotDeg}
          onRotateStart={(hit) => onRotateStart?.(building.id, hit)}
          onDimCommit={(axis, meters) =>
            onSetBarnShell?.(building.id, axis, meters)
          }
        />
      ) : null}

      {editing && editMode && !ghost && !compactHud ? (
        <Html
          position={[
            0,
            0.2,
            length / 2 + barnEditDimStand(width, length) + 0.5,
          ]}
          zIndexRange={[90, 40]}
          style={{ pointerEvents: "auto" }}
        >
          <div
            style={{ transform: "translate(-50%, 40px)" }}
            onPointerDown={(e) => {
              e.stopPropagation();
              barnModelPointer.suppressGroundClick = true;
            }}
          >
            <BarnModelFillCard
              fill={fill}
              open={Boolean(fillEditOpen)}
              dirty={Boolean(fillEditDirty)}
              onOpenChange={(next) => onFillEditOpenChange?.(next)}
              onRevert={onFillEditRevert}
              onChange={(patch) => onSetBarnFill?.(building.id, patch)}
            />
          </div>
        </Html>
      ) : null}

      {showLabels && !ghost && !editing ? (
        <BarnFieldCardHtml
          width={width}
          length={length}
          height={wallH + roofRise}
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
            onPrevBarn={
              onCycleTypeBarn
                ? () => onCycleTypeBarn(building.id, -1)
                : undefined
            }
            onNextBarn={
              onCycleTypeBarn
                ? () => onCycleTypeBarn(building.id, 1)
                : undefined
            }
            onTrend={onOpenTrend ? () => onOpenTrend(building.id) : undefined}
          />
        </BarnFieldCardHtml>
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
          position={[aisleX, wallH, length / 2 + 0.04]}
          zIndexRange={[120, 20]}
          style={{ pointerEvents: "auto" }}
        >
          <div style={{ transform: "translate(-50%, -100%)" }}>
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
          </div>
        </Html>
      ) : null}
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
    };

function YardContents(props: BarnModelSceneProps & { dragging: boolean; setDragging: (v: boolean) => void }) {
  const showLabels = props.shot === "roof";
  const compactHud = Boolean(props.compactHud);
  const hudBarnId = props.selectedBarnId ?? props.roofFocusId ?? null;
  const showBarnHud = (id: string) =>
    showLabels && (!compactHud || id === hudBarnId);
  const editMode = props.shot === "roof";
  const yardBounds = barnModelYardBounds(props.yard);
  const field = barnModelFieldView(props.yard);
  const placing = Boolean(props.placing && props.placingDraft);
  const layoutGrid = Boolean(placing || props.yardEditing);
  const gridSize = layoutGrid
    ? Math.ceil(field.span / 10) * 10
    : barnModelYardGridSize(yardBounds.span);
  const gridX = layoutGrid ? field.centerX : props.yard.center[0];
  const gridZ = layoutGrid ? field.centerZ : props.yard.center[2];
  const { camera, gl } = useThree();
  const dragRef = useRef<EditDrag | null>(null);
  const [ghostAt, setGhostAt] = useState<[number, number] | null>(null);
  const moveBarn = props.onMoveBarn;
  const rotateBarn = props.onRotateBarn;
  const moveEnd = props.onMoveBarnEnd;
  const setDragging = props.setDragging;
  const placingPlan = props.placingDraft?.plan ?? null;
  const placingTy = props.placingDraft?.stallTyCode ?? "";

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
          undefined,
          BARN_MODEL_SNAP_FINE_M,
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
      }
    };
    const onUp = () => {
      if (placing) return;
      if (!dragRef.current) return;
      dragRef.current = null;
      barnModelPointer.suppressGroundClick = true;
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
    camera,
    gl,
    moveBarn,
    rotateBarn,
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
      {placing || props.yardEditing ? (
        <gridHelper
          args={[gridSize, gridSize, "#e2e8f0", "#e2e8f0"]}
          position={[gridX, 0.01, gridZ]}
        />
      ) : null}
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
          if (barnModelPointer.suppressGroundClick) {
            barnModelPointer.suppressGroundClick = false;
            return;
          }
          if (props.shot === "entrance") return;
          if (props.roofFocusId) {
            props.onRoofFocusClear?.();
            return;
          }
          if (props.placing && props.onPlaceAt && props.placingDraft) {
            const [sx, sz] = snapBarnFootprint(
              e.point.x,
              e.point.z,
              props.placingDraft.plan,
              props.placingDraft.stallTyCode,
              undefined,
              BARN_MODEL_SNAP_FINE_M,
            );
            props.onPlaceAt(sx, sz);
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
          editing={Boolean(props.yardEditing)}
          showLabels={showBarnHud(building.id)}
          showEntranceCard={
            props.shot === "entrance" &&
            props.selectedBarnId === building.id
          }
          editMode={editMode && !props.placing}
          typeReadings={readingsForStallType(
            building.stallTyCode,
            props.readings ?? [],
          )}
          peekKey={props.peekKey ?? null}
          liveTrend={props.liveTrend}
          onSelectBarn={props.onSelectBarn}
          onDeleteBarn={props.onDeleteBarn}
          onEntranceBarn={props.onEntranceBarn}
          onBackToField={props.onBackToField}
          onPrevBarn={props.onPrevBarn}
          onNextBarn={props.onNextBarn}
          onCycleType={props.onCycleType}
          onPeekControllers={props.onPeekControllers}
          highlightControllerKey={props.highlightControllerKey}
          onOpenController={props.onOpenController}
          onSetBarnShell={props.onSetBarnShell}
          onSetBarnFill={props.onSetBarnFill}
          onCycleTypeBarn={props.onCycleTypeBarn}
          onOpenTrend={props.onOpenTrend}
          fillEditOpen={props.fillEditId === building.id}
          fillEditDirty={
            props.fillEditId === building.id && Boolean(props.fillEditDirty)
          }
          compactHud={compactHud}
          onFillEditOpenChange={(open) =>
            props.onFillEditOpenChange?.(building.id, open)
          }
          onFillEditRevert={props.onFillEditRevert}
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
        />
      ))}
      {ghost ? (
        <BarnMesh
          building={ghost}
          selected={false}
          editing={false}
          showLabels={!compactHud}
          editMode={false}
          ghost
          compactHud={compactHud}
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

export function FarmBarnModelScene(props: BarnModelSceneProps) {
  const [dragging, setDragging] = useState(false);
  return (
    <Canvas
      camera={{ position: [0, 62, 1.6], fov: 42, near: 0.1, far: 600 }}
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: false }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#e2e8f0"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[18, 28, 12]} intensity={1.05} />
      <Suspense fallback={null}>
        <BarnModelCamera
          shot={props.shot}
          selectedBarnId={props.selectedBarnId}
          yard={props.yard}
          dragging={dragging}
          yardEditing={props.yardEditing}
          onEntranceArrived={props.onEntranceArrived}
          roofFocusId={props.roofFocusId}
          fillEditId={props.fillEditId}
        />
        <YardContents
          {...props}
          dragging={dragging}
          setDragging={setDragging}
        />
      </Suspense>
    </Canvas>
  );
}
