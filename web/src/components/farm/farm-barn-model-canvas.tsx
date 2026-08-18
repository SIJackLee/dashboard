"use client";

import { FarmBarnModelScene } from "@/components/farm/farm-barn-model-scene";
import type { BarnModelSceneProps } from "@/components/farm/farm-barn-model-types";

export type { BarnModelOpenController } from "@/components/farm/farm-barn-model-types";

export function FarmBarnModelCanvas(props: BarnModelSceneProps) {
  return <FarmBarnModelScene {...props} />;
}
