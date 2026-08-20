/**
 * 실행: npx tsx src/lib/farm/kakao-maps-loader.test.ts
 */
import assert from "node:assert/strict";
import { leafletZoomToKakaoLevel } from "./kakao-maps-loader";

assert.equal(leafletZoomToKakaoLevel(18), 1);
assert.equal(leafletZoomToKakaoLevel(17), 2);
assert.equal(leafletZoomToKakaoLevel(13), 6);
assert.equal(leafletZoomToKakaoLevel(5), 14);

console.log("kakao-maps-loader.test.ts: ok");
