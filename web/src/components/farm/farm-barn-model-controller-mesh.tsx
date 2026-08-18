"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { BARN_CTRL_H, BARN_CTRL_W } from "@/lib/farm/barn-model-layout";
import { normalizeEqpmnNo } from "@/lib/data/controller-key";
import type { BarnReading } from "@/lib/data/iot";
import { channelBySlot } from "@/lib/data/iot-channel";
import { type ChannelPercents } from "@/lib/farm/controller-summary-display";

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

function channelPctLabel(n: number | null, lit: boolean): string {
  if (!lit || n == null || !Number.isFinite(n)) return "—";
  return String(Math.round(Math.max(0, Math.min(100, n))));
}

/** 어두운 표시창 위 흰 글자. Troika Text는 한글·폰트 로딩 때 Canvas를 비운다. */
function ControllerFaceLabel({
  text,
  width,
  height,
}: {
  text: string;
  width: number;
  height: number;
}) {
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = "700 52px system-ui, 'Malgun Gothic', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fafafa";
    ctx.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  }, [text]);

  useEffect(() => {
    return () => {
      texture?.dispose();
    };
  }, [texture]);

  if (!texture) return null;

  return (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function FaceReadout({
  position,
  width,
  height,
  text,
}: {
  position: [number, number, number];
  width: number;
  height: number;
  text: string;
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[width, height, 0.008]} />
        <meshStandardMaterial color="#111827" roughness={0.28} />
      </mesh>
      <group position={[0, 0, 0.005]}>
        <ControllerFaceLabel
          text={text}
          width={width * 0.88}
          height={height * 0.68}
        />
      </group>
    </group>
  );
}

export function channelsFromReading(reading: BarnReading | undefined): ChannelPercents | undefined {
  if (!reading?.channels?.length) return undefined;
  return {
    A: channelBySlot(reading.channels, "A")?.fanPct ?? null,
    B: channelBySlot(reading.channels, "B")?.fanPct ?? null,
    C: channelBySlot(reading.channels, "C")?.fanPct ?? null,
  };
}

function ControllerSelectRimBar({
  position,
  size,
  opacity,
  additive = false,
}: {
  position: [number, number, number];
  size: [number, number, number];
  opacity: number;
  additive?: boolean;
}) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial
        color="#3d9a4a"
        toneMapped={false}
        transparent={opacity < 0.99}
        opacity={opacity}
        depthWrite={false}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
      />
    </mesh>
  );
}

function ControllerSelectRimFrame({
  w,
  h,
  z,
  t,
  depth,
  opacity,
  additive,
}: {
  w: number;
  h: number;
  z: number;
  t: number;
  depth: number;
  opacity: number;
  additive?: boolean;
}) {
  return (
    <group>
      <ControllerSelectRimBar
        position={[0, h / 2 + t / 2, z]}
        size={[w + t * 2, t, depth]}
        opacity={opacity}
        additive={additive}
      />
      <ControllerSelectRimBar
        position={[0, -h / 2 - t / 2, z]}
        size={[w + t * 2, t, depth]}
        opacity={opacity}
        additive={additive}
      />
      <ControllerSelectRimBar
        position={[-w / 2 - t / 2, 0, z]}
        size={[t, h, depth]}
        opacity={opacity}
        additive={additive}
      />
      <ControllerSelectRimBar
        position={[w / 2 + t / 2, 0, z]}
        size={[t, h, depth]}
        opacity={opacity}
        additive={additive}
      />
    </group>
  );
}

function ControllerSelectRim({
  w,
  h,
  z,
}: {
  w: number;
  h: number;
  z: number;
}) {
  return (
    <group>
      <ControllerSelectRimFrame
        w={w}
        h={h}
        z={z - 0.002}
        t={0.03}
        depth={0.004}
        opacity={0.16}
        additive
      />
      <ControllerSelectRimFrame
        w={w}
        h={h}
        z={z}
        t={0.018}
        depth={0.006}
        opacity={0.42}
        additive
      />
      <ControllerSelectRimFrame
        w={w}
        h={h}
        z={z + 0.001}
        t={0.009}
        depth={0.008}
        opacity={1}
      />
    </group>
  );
}

export function BleonControllerMesh({
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
  const w = 0.34;
  const h = 0.24;
  const d = 0.08;
  const z = d / 2 + 0.002;
  const meshScaleX = BARN_CTRL_W / w;
  const meshScaleY = BARN_CTRL_H / h;
  const digits = (() => {
    if (tempC == null || !lit) return [8, 8, 8] as const;
    const t = Math.abs(tempC);
    const whole = Math.min(99, Math.floor(t));
    const frac = Math.floor((t - Math.floor(t)) * 10);
    return [Math.floor(whole / 10), whole % 10, frac] as const;
  })();
  const plateW = w * 0.34;
  const plateH = h * 0.2;
  const plateX = -w / 2 + 0.01 + plateW / 2;
  const plateY = h / 2 - 0.012 - plateH / 2;
  const barLeft = plateX + plateW / 2 + 0.008;
  const barRight = w / 2 - 0.01;
  const cellGap = 0.008;
  const cellW = (w - 0.02 - 2 * cellGap) / 3;
  const cellH = h * 0.26;
  const cellY = -h / 2 + 0.01 + cellH / 2;
  const channelSlots = ["A", "B", "C"] as const;
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
      <group scale={[meshScaleX, meshScaleY, meshScaleX]}>
      {selected ? (
        <ControllerSelectRim w={w} h={h} z={z + 0.006} />
      ) : null}
      <mesh>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial
          color="#f4f4f5"
          roughness={0.42}
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
      <mesh position={[(barLeft + barRight) / 2, plateY, z]}>
        <boxGeometry args={[Math.max(0.04, barRight - barLeft), plateH * 0.55, 0.004]} />
        <meshStandardMaterial color="#15803d" roughness={0.4} />
      </mesh>
      <group position={[0.06, 0.012, z + 0.004]} scale={1.35}>
        <mesh position={[0.016, 0, -0.003]}>
          <boxGeometry args={[0.13, 0.05, 0.006]} />
          <meshStandardMaterial color="#111827" roughness={0.25} />
        </mesh>
        <SevenSegDigit
          digit={digits[0]}
          position={[-0.024, 0, 0.002]}
          on={lit}
        />
        <SevenSegDigit
          digit={digits[1]}
          position={[0.002, 0, 0.002]}
          on={lit}
        />
        <mesh position={[0.018, -0.012, 0.002]}>
          <boxGeometry args={[0.003, 0.003, 0.002]} />
          <meshStandardMaterial
            color={lit ? "#ff3b3b" : "#3f1212"}
            emissive={lit ? "#ff1f1f" : "#000000"}
            emissiveIntensity={lit ? 1.2 : 0}
          />
        </mesh>
        <SevenSegDigit
          digit={digits[2]}
          position={[0.04, 0, 0.002]}
          on={lit}
        />
      </group>
      {eqpmnNo ? (
        <FaceReadout
          position={[plateX, plateY, z + 0.004]}
          width={plateW}
          height={plateH}
          text={normalizeEqpmnNo(eqpmnNo)}
        />
      ) : null}
      {channelSlots.map((slot, i) => (
        <FaceReadout
          key={slot}
          position={[(i - 1) * (cellW + cellGap), cellY, z + 0.004]}
          width={cellW}
          height={cellH}
          text={`${slot}  ${channelPctLabel(channels?.[slot] ?? null, lit)}`}
        />
      ))}
      </group>
    </group>
  );
}
