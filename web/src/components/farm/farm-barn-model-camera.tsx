"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MapControls } from "@react-three/drei";
import type { MapControls as MapControlsImpl } from "three-stdlib";
import * as THREE from "three";
import {
  barnModelCameraPose,
  barnModelEditCameraPose,
  barnModelFillEditCameraPose,
  barnModelFieldCameraPose,
  type BarnModelCameraShot,
  type BarnModelYard,
} from "@/lib/farm/barn-model-layout";
import type { BarnModelSceneProps } from "@/components/farm/farm-barn-model-types";

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

function destPoseFor(
  shot: BarnModelCameraShot,
  yard: BarnModelYard,
  selectedBarnId: string | null,
  yardEditing?: boolean,
  roofFocusId?: string | null,
  fillEditId?: string | null,
) {
  if (shot === "roof" && fillEditId) {
    const barn = yard.barns.find((b) => b.id === fillEditId);
    if (barn) return barnModelFillEditCameraPose(barn);
  }
  if (shot === "roof" && yardEditing) return barnModelFieldCameraPose(yard);
  if (shot === "roof" && roofFocusId) {
    const barn = yard.barns.find((b) => b.id === roofFocusId);
    if (barn) return barnModelEditCameraPose(barn);
  }
  return barnModelCameraPose(shot, yard, selectedBarnId);
}

function cameraFlyKey(
  shot: BarnModelCameraShot,
  selectedBarnId: string | null,
  yardEditing?: boolean,
  roofFocusId?: string | null,
  fillEditId?: string | null,
) {
  if (shot === "entrance") return `entrance|${selectedBarnId ?? ""}`;
  if (fillEditId) return `roof|fill|${fillEditId}`;
  if (yardEditing) return "roof|e";
  return `roof|${roofFocusId ?? ""}`;
}

function freezeMapControls(
  controls: MapControlsImpl | null,
  origUpdate: { current: (() => void) | null },
) {
  if (!controls) return;
  if (!origUpdate.current) origUpdate.current = controls.update.bind(controls);
  controls.update = () => undefined;
  controls.enabled = false;
  controls.enableDamping = false;
}

export function BarnModelCamera({
  shot,
  selectedBarnId,
  yard,
  dragging,
  yardEditing,
  onEntranceArrived,
  roofFocusId,
  fillEditId,
}: Pick<
  BarnModelSceneProps,
  | "shot"
  | "selectedBarnId"
  | "yard"
  | "yardEditing"
  | "onEntranceArrived"
  | "roofFocusId"
  | "fillEditId"
> & {
  dragging: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<MapControlsImpl>(null);
  const origUpdate = useRef<(() => void) | null>(null);
  const destPos = useRef(new THREE.Vector3());
  const destLook = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());
  const flyingRef = useRef(false);
  const [flying, setFlying] = useState(false);
  const prevFlyKey = useRef<string | null>(null);
  const arrivedRef = useRef(onEntranceArrived);

  useLayoutEffect(() => {
    arrivedRef.current = onEntranceArrived;
  }, [onEntranceArrived]);
  const flyKey = cameraFlyKey(
    shot,
    selectedBarnId,
    yardEditing,
    roofFocusId,
    fillEditId,
  );
  const roofIdle = shot === "roof";
  const destH = destPoseFor(
    shot,
    yard,
    selectedBarnId,
    yardEditing,
    roofFocusId,
    fillEditId,
  ).position[1];
  const roofH = destH;

  useLayoutEffect(() => {
    const next = destPoseFor(
      shot,
      yard,
      selectedBarnId,
      yardEditing,
      roofFocusId,
      fillEditId,
    );
    destPos.current.set(...next.position);
    destLook.current.set(...next.lookAt);
    const controls = controlsRef.current;
    const prev = prevFlyKey.current;
    if (prev === null) {
      applyRoofCameraPose(camera, next, controls);
      look.current.set(...next.lookAt);
      prevFlyKey.current = flyKey;
      return;
    }
    if (prev === flyKey) return;
    prevFlyKey.current = flyKey;
    if (prev.startsWith("roof") && prev !== "roof|e" && controls) {
      look.current.copy(controls.target);
    }
    flyingRef.current = true;
    setFlying(true);
    freezeMapControls(controls, origUpdate);
    // 샷·선택 동·편집만 이동. LIVE yard 갱신으로 보간을 다시 시작하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, flyKey]);

  useFrame((_, dt) => {
    const controls = controlsRef.current;
    const holdEntrance = shot === "entrance";

    if (flyingRef.current) {
      freezeMapControls(controls, origUpdate);
      const t = 1 - Math.exp(-dt * 3.2);
      camera.position.lerp(destPos.current, t);
      look.current.lerp(destLook.current, t);
      camera.up.set(0, 1, 0);
      camera.lookAt(look.current);
      if (
        camera.position.distanceTo(destPos.current) < 0.08 &&
        look.current.distanceTo(destLook.current) < 0.08
      ) {
        const arrived = {
          position: [
            destPos.current.x,
            destPos.current.y,
            destPos.current.z,
          ] as [number, number, number],
          lookAt: [
            destLook.current.x,
            destLook.current.y,
            destLook.current.z,
          ] as [number, number, number],
        };
        look.current.copy(destLook.current);
        flyingRef.current = false;
        setFlying(false);
        if (roofIdle) {
          if (origUpdate.current && controls) {
            controls.update = origUpdate.current;
          }
          applyRoofCameraPose(camera, arrived, controls);
          if (controls) {
            controls.enableDamping = true;
            controls.enabled = !dragging;
          }
        } else {
          applyRoofCameraPose(camera, arrived, null);
          freezeMapControls(controls, origUpdate);
          if (holdEntrance) arrivedRef.current?.();
        }
      }
      return;
    }

    if (holdEntrance) {
      freezeMapControls(controls, origUpdate);
      const next = destPoseFor(
        shot,
        yard,
        selectedBarnId,
        yardEditing,
        roofFocusId,
        fillEditId,
      );
      camera.up.set(0, 1, 0);
      camera.position.set(...next.position);
      camera.lookAt(...next.lookAt);
      look.current.set(...next.lookAt);
      return;
    }

    if (controls && origUpdate.current) {
      controls.update = origUpdate.current;
      controls.enableDamping = true;
      controls.enabled = !dragging;
    }
  }, -2);

  return (
    <MapControls
      ref={controlsRef}
      makeDefault
      enableRotate={false}
      enableDamping={roofIdle && !flying}
      enabled={!dragging && roofIdle && !flying}
      minDistance={roofIdle ? roofH * 0.4 : 0.4}
      maxDistance={roofIdle ? roofH * 2.1 : 120}
      minPolarAngle={roofIdle ? ROOF_POLAR : 0}
      maxPolarAngle={roofIdle ? ROOF_POLAR : Math.PI}
    />
  );
}
