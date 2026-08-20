# 축사 3D 모델 (은퇴)

허브 **모델** 탭은 2D 부지·건물 배치입니다. 정본: [`BARN_PLAN.md`](./BARN_PLAN.md).

- URL: `view=model`. 옛 `view=plan`은 같은 탭으로 정규화.
- 게이트: `NEXT_PUBLIC_BARN_PLAN_ENABLED` (로컬·Preview on, Production 숨김).
- 3D WebGL 씬(`FarmBarnModelView`, `barn-model-layout`, `barn-model-mode`)은 제거됨.

2D가 쓰는 공유 코드만 남김:

- `barn-model-dim.ts` · `barn-model-hud.ts` · `barn-model-prefs.ts` (FillPatch)
- `farm-barn-model-fill-card.tsx`

`NEXT_PUBLIC_BARN_MODEL_ENABLED`는 쓰지 않습니다.
