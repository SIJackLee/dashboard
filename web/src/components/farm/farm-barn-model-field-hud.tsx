"use client";

import { useCallback, type ReactNode } from "react";
import { Html } from "@react-three/drei";
import { DoorOpen } from "lucide-react";
import * as THREE from "three";
import { barnModelHud } from "@/lib/farm/barn-model-hud";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

const _cardP = new THREE.Vector3();

/** 축사 AABB를 화면 상자로 투영한 뒤, 상자 위 중앙에 카드를 둔다. */
function barnCardScreenPos(
  el: THREE.Object3D,
  camera: THREE.Camera,
  size: { width: number; height: number },
  halfW: number,
  halfL: number,
  height: number,
): [number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  for (let ix = 0; ix < 2; ix += 1) {
    for (let iy = 0; iy < 2; iy += 1) {
      for (let iz = 0; iz < 2; iz += 1) {
        _cardP.set(ix ? halfW : -halfW, iy ? height : 0, iz ? halfL : -halfL);
        el.localToWorld(_cardP);
        _cardP.project(camera);
        const sx = (_cardP.x * 0.5 + 0.5) * size.width;
        const sy = (-_cardP.y * 0.5 + 0.5) * size.height;
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
        minX = Math.min(minX, sx);
        minY = Math.min(minY, sy);
        maxX = Math.max(maxX, sx);
      }
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX)) {
    _cardP.setFromMatrixPosition(el.matrixWorld);
    _cardP.project(camera);
    return [
      (_cardP.x * 0.5 + 0.5) * size.width,
      (-_cardP.y * 0.5 + 0.5) * size.height,
    ];
  }
  return [(minX + maxX) / 2, minY];
}

export function BarnFieldCardHtml({
  width,
  length,
  height,
  children,
}: {
  width: number;
  length: number;
  height: number;
  children: ReactNode;
}) {
  const halfW = width / 2;
  const halfL = length / 2;
  const calculatePosition = useCallback(
    (
      el: THREE.Object3D,
      camera: THREE.Camera,
      size: { width: number; height: number },
    ) => barnCardScreenPos(el, camera, size, halfW, halfL, height),
    [halfW, halfL, height],
  );
  return (
    <Html
      position={[0, 0, 0]}
      calculatePosition={calculatePosition}
      zIndexRange={[120, 20]}
      style={{
        pointerEvents: "auto",
        transform: "translate(-50%, calc(-100% - 10px))",
      }}
    >
      {children}
    </Html>
  );
}

export function BarnEntranceGui({
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
      position={[aisleX, 0.2, length / 2 + 0.16]}
      zIndexRange={[80, 30]}
      style={{ pointerEvents: "auto" }}
    >
      <div style={{ transform: "translate(-50%, 10px)" }}>
        <button
          type="button"
          className={barnModelHud.door}
          aria-label="입구 보기"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <DoorOpen
            className="size-6"
            strokeWidth={dashboardUi.iconStroke}
            aria-hidden
          />
        </button>
      </div>
    </Html>
  );
}
