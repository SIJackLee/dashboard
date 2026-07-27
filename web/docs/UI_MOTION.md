# UI Motion System (Phase 1)

PC·모바일·브라우저 공통 **motion token + L2 preset** 레이어.  
Phase 1은 **규칙·프리셋·검증**까지 — 컴포넌트 전면 마이그레이션은 Phase 2~3.

## 아키텍처

```
L1  motion-tokens.ts + globals.css :root (--motion-*)
      ↓
L2  motion-classes.ts + globals.css (.ui-motion-*)
      ↓
     motion-preset.ts (intent → className)
      ↓
L3  컴포넌트 (button, dialog, farm/* …)
```

| 파일 | 역할 |
|------|------|
| `src/lib/ui/motion-tokens.ts` | duration·easing·distance·intent 매핑 |
| `src/lib/ui/motion-classes.ts` | Tailwind + surface class 프리셋 |
| `src/lib/ui/motion-preset.ts` | `motionPresetForIntent("enter")` 헬퍼 |
| `src/app/globals.css` | `@keyframes` · `.ui-motion-*` surfaces |
| `scripts/verify-motion-tokens.mjs` | TS ↔ CSS 동기 검증 |

검증: `npm run verify:motion-tokens`

---

## L1 — Duration

| Token | ms | 용도 |
|-------|-----|------|
| `fast` | 120 | hover, focus, chip, badge |
| `normal` | 200 | dialog, dropdown, toast enter, fade |
| `moderate` | 280 | panel expand, collapsible, stagger |
| `emphasis` | 360 | heat morph, 강조 전환 |
| `exit` | 150 | toast/modal exit |
| `viewCrossfade` / `view` | 150 | map ↔ list opacity |

## L1 — Easing

| Token | curve | 용도 |
|-------|-------|------|
| `standard` | decel-accel | 일반 transition |
| `enter` | decelerate | 등장 |
| `exit` | accelerate | 퇴장 |
| `emphasis` | soft bounce | morph·강조 |

## L1 — Distance

| Token | px |
|-------|-----|
| `sm` | 4 |
| `md` | 8 |
| `lg` | 16 |
| `slidePercent` | 28 (`--motion-distance-slide: 28%`, 캐러셀 전용) |

Stagger step: **40ms** (`motionStaggerStepMs`) — PC·모바일 동일.

---

## L2 — Intent → Preset

| Intent | Duration | Easing | Preset / Surface |
|--------|----------|--------|------------------|
| `micro` | fast | standard | `motionClass.microInteractive` |
| `surface` | normal | standard | `motionClass.surfaceRing` |
| `enter` | normal | enter | `ui-motion-enter-fade` |
| `exit` | exit | exit | `ui-motion-exit-fade` |
| `layout` | moderate | standard | `ui-motion-panel-expand` |
| `emphasis` | emphasis | emphasis | `farm-heat-morph` |
| `view` | view | standard | `motionClass.viewCrossfade` |

### 코드 예

```tsx
import { motionClass } from "@/lib/ui/motion-classes";
import { motionPresetForIntent } from "@/lib/ui/motion-preset";

// Micro hover
<button className={cn(motionClass.microInteractive, "rounded-lg px-3")} />

// Enter fade surface
<div className={motionPresetForIntent("enter")} />

// Panel expand (data-open 토글)
<div className={motionClass.panelExpand} data-open={open}>
  <div className={motionClass.panelExpandInner}>{children}</div>
</div>

// Stagger — index * motionStaggerStepMs
<div
  className={motionClass.staggerIn}
  style={{ animationDelay: `${index * 40}ms` }}
/>

// shadcn portal
<DialogContent className={cn(motionClass.portalEnter, motionClass.durationNormal)} />
```

---

## L2 — Surface classes (globals.css)

| Class | 용도 |
|-------|------|
| `ui-motion-enter-fade` | fade in |
| `ui-motion-exit-fade` | fade out |
| `ui-motion-enter-slide-up` | slide + fade in |
| `ui-motion-panel-expand` | `grid-template-rows` expand |
| `ui-motion-panel-expand-inner` | expand inner clip |
| `ui-motion-stagger-in` | stagger item |
| `ui-motion-toast` | toast enter/exit |
| `ui-motion-modal-backdrop` / `ui-motion-modal-panel` | bulk modal |
| `ui-motion-command-overlay` / `ui-motion-command-card` | command pipeline |
| `settings-collapsible-*` | 설정 collapsible |
| `farm-heat-morph` | 그리드 확대 morph |
| `farm-detail-carousel` | 컨트롤러 상세 캐러셀 클립 컨테이너 |
| `farm-detail-slide-enter-next` / `enter-prev` | 캐러셀 enter (버튼 방향에서 진입) |
| `farm-detail-slide-exit-next` / `exit-prev` | 캐러셀 exit (반대쪽으로 퇴장, enter와 겹침) |
| `farm-detail-slide-next` / `farm-detail-slide-prev` | enter 별칭 (하위 호환) |
| `header-tools-panel` / `header-tools-section` | 헤더 도구 세로 펼침 stagger |
| `barn-list-panel-shell` | 목록 패널 (domain, Phase 2) |

---

## Do / Don't

**Do**

- `motionClass.*` · `motionPresetForIntent()` · `.ui-motion-*` 만 사용
- `transition-[property]` 로 속성 명시
- enter 200ms / exit 150ms 비대칭 유지
- `prefers-reduced-motion` — 토큰이 0ms로 자동 축소

**Don't**

- `transition-all`
- `duration-300`, `duration-500` 등 임의 Tailwind duration
- 모바일만 다른 ms (레이아웃만 다르게)
- hover마다 다른 easing

---

## PC · 모바일 · 브라우저

| 항목 | 정책 |
|------|------|
| duration / easing | **동일** |
| bottom sheet | `motionClass.sheetEnter` + `durationModerate` |
| portal (dialog) | `motionClass.portalEnter` + `durationNormal` |
| scroll-driven | 모바일 `auto` (투어·vv 대응), duration은 동일 |
| preview frame | `[data-viewport-preview="mobile"]` — duration 동일, max-height만 조정 |

---

## Phase roadmap

| Phase | 범위 | 상태 |
|-------|------|------|
| **0** | L1 tokens, CSS vars | ✅ |
| **1** | L2 presets, intent map, verify script, this doc | ✅ |
| **2** | ui/* shadcn + farm domain 마이그레이션 | ✅ |
| **3** | ESLint guard, Playwright motion snapshots | ✅ |

### Phase 2 적용 요약

**ui/** — `button`, `badge`, `tabs`, `input`, `checkbox`, `table`, `select`, `dialog`  
→ `microInteractive` / `microHover` / `portalEnter` + easing

**farm/** — `farm-page-content` 탭, `farm-map-canvas`/`mobile-stage` 카드,  
`barn-table` refresh ring, `bulk-apply` 스위치, `barn-controller-mobile-sheet` 트랙,  
툴바·기간 토글·패널 닫기·피커·게이지 pill·목록 SP 칩 등  
→ 임의 `duration-300` / `transition-all` 제거, L2 preset 치환

### Phase 3 가드레일

| 명령 | 역할 |
|------|------|
| `npm run lint` | `no-restricted-syntax` — `transition-all`, `duration-N` (non-motion) |
| `npm run verify:motion-classes` | src 전체 문자열 스캔 (ESLint 보완) |
| `npm run audit:motion-reduced` | CSS reduce 정적 검수 + Playwright 런타임 (BASE 가용 시) |
| `npm run verify:motion` | tokens + classes + reduced 일괄 |

런타임 강제: `STRICT_MOTION_RUNTIME=1 npm run audit:motion-reduced`

---

## prefers-reduced-motion

`globals.css` `@media (prefers-reduced-motion: reduce)`:

- `--motion-duration-*` → `0ms`
- `.ui-motion-*` animation/transition 비활성화
- `.ui-motion-panel-expand`, `.barn-list-panel-shell`, `[data-farm-view-panel]` transition off
