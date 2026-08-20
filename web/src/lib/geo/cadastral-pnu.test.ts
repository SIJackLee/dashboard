/**
 * 실행: npx tsx src/lib/geo/cadastral-pnu.test.ts
 */
import assert from "node:assert/strict";
import {
  cadastralLotLabel,
  cadastralPnu,
  isCadastralSiteNeighbor,
  vworldLonLatBox,
} from "./cadastral-pnu";
import { barnPlanRingFromCoords, simplifyBarnPlanRing } from "../farm/barn-plan-boundary";

assert.equal(
  cadastralPnu({
    bCode: "4165037025",
    mountainYn: "N",
    mainNo: "588",
    subNo: "4",
  }),
  "4165037025105880004",
);

assert.equal(
  cadastralPnu({
    bCode: "4165037025",
    mountainYn: "Y",
    mainNo: "12",
    subNo: "",
  }),
  "4165037025200120000",
);

assert.equal(
  cadastralPnu({ bCode: "41650", mainNo: "1", subNo: "0" }),
  null,
);

assert.equal(
  vworldLonLatBox(127.343, 38.006, 0.0005),
  "BOX(127.3425,38.0055,127.3435,38.0065)",
);
assert.equal(isCadastralSiteNeighbor("588-4목"), true);
assert.equal(isCadastralSiteNeighbor("588-5 답"), true);
assert.equal(isCadastralSiteNeighbor("588-1천"), false);
assert.equal(isCadastralSiteNeighbor("280-2도"), false);
assert.equal(cadastralLotLabel("588-41답"), "41답");
assert.equal(cadastralLotLabel("588-4목"), "4목");
assert.equal(cadastralLotLabel("1523구"), "1523구");

{
  const ring = Array.from({ length: 80 }, (_, i) => {
    const t = (i / 80) * Math.PI * 2;
    return { lat: 38.006 + 0.001 * Math.sin(t), lng: 127.343 + 0.001 * Math.cos(t) };
  });
  const slim = simplifyBarnPlanRing(ring, 24);
  assert.ok(slim.length >= 3 && slim.length <= 24);
  const closed = [...ring, ring[0]!];
  const from = barnPlanRingFromCoords(closed);
  assert.ok(from && from.length >= 3 && from.length <= 48);
}

console.log("cadastral-pnu.test.ts: ok");
