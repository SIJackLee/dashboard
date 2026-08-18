"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import { RotateCw } from "lucide-react";
import * as THREE from "three";
import type { BarnModelDimAxis } from "@/lib/farm/barn-model-dim";
import { cn } from "@/lib/utils";
import {
  barnModelPointer,
  markGizmoEvent,
} from "@/components/farm/farm-barn-model-pointer";

const DIM_COLOR = "#44403c";
const DIM_LABEL: Record<BarnModelDimAxis, string> = {
  length: "길이",
  width: "폭",
  height: "높이",
};

function DimValue({
  value,
  axis,
  onCommit,
  editable = true,
}: {
  value: number;
  axis: BarnModelDimAxis;
  onCommit: (n: number) => void;
  editable?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlur = useRef(false);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  const startEdit = () => {
    barnModelPointer.suppressGroundClick = true;
    setText(value.toFixed(1));
    setEditing(true);
  };

  const commit = () => {
    setEditing(false);
    const n = Number(text.replace(",", ".").trim());
    if (!Number.isFinite(n)) return;
    onCommit(n);
  };

  const chip =
    "rounded-sm bg-background/90 px-1 py-px text-[10px] font-medium tabular-nums text-foreground ring-1 ring-border";

  if (!editable) {
    return (
      <span className={chip} aria-label={`${DIM_LABEL[axis]} ${value.toFixed(1)}미터`}>
        {value.toFixed(1)}
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        aria-label={DIM_LABEL[axis]}
        inputMode="decimal"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (skipBlur.current) {
            skipBlur.current = false;
            return;
          }
          commit();
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          barnModelPointer.suppressGroundClick = true;
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            skipBlur.current = true;
            setEditing(false);
          }
        }}
        className={cn(chip, "w-14 text-center outline-none")}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={`${DIM_LABEL[axis]} ${value.toFixed(1)}미터, 눌러서 수정`}
      onPointerDown={(e) => {
        e.stopPropagation();
        barnModelPointer.suppressGroundClick = true;
      }}
      onClick={(e) => {
        e.stopPropagation();
        startEdit();
      }}
      className={chip}
    >
      {value.toFixed(1)}
    </button>
  );
}

function BarnDimLine({
  a,
  b,
  value,
  axis,
  onCommit,
  editable = true,
}: {
  a: [number, number, number];
  b: [number, number, number];
  value: number;
  axis: BarnModelDimAxis;
  onCommit: (n: number) => void;
  editable?: boolean;
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
      <Html
        position={mid}
        center
        style={{ pointerEvents: editable ? "auto" : "none" }}
      >
        <DimValue
          value={value}
          axis={axis}
          onCommit={onCommit}
          editable={editable}
        />
      </Html>
    </group>
  );
}

function barnEditRingR(width: number, length: number) {
  return Math.max(width, length) * 0.42 + 2.4;
}

export function barnEditDimStand(width: number, length: number) {
  const ringR = barnEditRingR(width, length);
  return Math.max(ringR - width / 2, ringR - length / 2) + 1.8;
}

export function BarnEditGizmos({
  width,
  length,
  wallH,
  rotDeg,
  onRotateStart,
  onDimCommit,
}: {
  width: number;
  length: number;
  wallH: number;
  rotDeg: number;
  onRotateStart: (hit: THREE.Vector3) => void;
  onDimCommit: (axis: BarnModelDimAxis, meters: number) => void;
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
  const ringR = barnEditRingR(width, length);
  const ticks = [0, 90, 180, 270] as const;
  const hx = (width / 2) * face.x;
  const hz = (length / 2) * face.z;
  /** 회전 고리·각도 표시 바깥까지 띄워 폭 숫자가 안 가리게. */
  const dimStand = barnEditDimStand(width, length);
  const dimX = hx + face.x * dimStand;
  const dimZ = hz + face.z * dimStand;
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
        a={[-width / 2, 0.1, dimZ]}
        b={[width / 2, 0.1, dimZ]}
        value={width}
        axis="width"
        editable={false}
        onCommit={(n) => onDimCommit("width", n)}
      />
      <BarnDimLine
        a={[dimX, 0.1, -length / 2]}
        b={[dimX, 0.1, length / 2]}
        value={length}
        axis="length"
        editable={false}
        onCommit={(n) => onDimCommit("length", n)}
      />
      <BarnDimLine
        a={[dimX, 0, dimZ]}
        b={[dimX, wallH, dimZ]}
        value={wallH}
        axis="height"
        onCommit={(n) => onDimCommit("height", n)}
      />
    </group>
  );
}

