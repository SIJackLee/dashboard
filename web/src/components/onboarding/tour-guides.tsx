"use client";

/**
 * 스포트라이트 투어 — 툴팁 내부 확장 가이드.
 * - GaugeAnatomy: 컨트롤러 카드 게이지 바 읽는 법(확대 모식도).
 * - PanelPillsGuide: 그래프·설정·모터 버튼 역할 설명.
 */

const ANATOMY_ITEMS = [
  { n: 1, label: "현재값", desc: "주황 구간 — 지금 측정된 값" },
  { n: 2, label: "설정값", desc: "보라 구간 — 설정 온도~온도 편차" },
  { n: 3, label: "환기량", desc: "분홍 구간 — 설정값 중 현재값 구간" },
  { n: 4, label: "범위 이탈", desc: "마커가 범위를 벗어나면 주의·경고 색" },
] as const;

export function GaugeAnatomy() {
  return (
    <div className="rounded-lg border bg-muted/30 p-3.5">
      <p className="mb-2 text-sm font-semibold text-muted-foreground">
        게이지 바 읽는 법
      </p>
      {/* 확대 모식도 — CardMetricGauge와 동일 요소(주황 채움·보라 설정대역·흰 마커) */}
      <div className="relative mb-2 select-none pt-0.5">
        <div
          className="relative h-4 w-full overflow-hidden rounded-md border bg-muted/40"
          role="img"
          aria-label="게이지 예시 — 알람 하한~상한, 설정온도±편차, 현재값 마커"
        >
          {/* 보라: 설정온도 ± 온도편차 */}
          <div
            className="pointer-events-none absolute inset-y-0 z-[1] rounded-sm bg-violet-500/40 ring-1 ring-inset ring-violet-600/45"
            style={{ left: "25%", width: "50%" }}
            aria-hidden
          />
          {/* 주황: 하한 → 현재값 채움 */}
          <div
            className="absolute inset-y-0 left-0 z-[0] rounded-md bg-orange-500"
            style={{ width: "42%" }}
            aria-hidden
          />
          <div
            className="absolute inset-y-0 right-0 bg-muted/20"
            style={{ width: "58%" }}
            aria-hidden
          />
          {/* 흰(foreground) 현재값 마커 */}
          <div
            className="absolute top-[-1px] z-[2] h-[1.125rem] w-3 rounded-full bg-foreground"
            style={{ left: "42%", transform: "translateX(-50%)" }}
            aria-hidden
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>하한</span>
          <span>상한</span>
        </div>
      </div>
      <ul className="space-y-1.5">
        {ANATOMY_ITEMS.map((it) => (
          <li key={it.n} className="flex items-start gap-2 text-sm leading-snug">
            <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[0.65rem] font-bold text-white">
              {it.n}
            </span>
            <span>
              <span className="font-semibold">{it.label}</span>
              <span className="text-muted-foreground"> — {it.desc}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const PILL_ITEMS = [
  {
    name: "그래프",
    desc: "온도·습도·팬 채널의 기간별 추이 차트를 펼칩니다.",
  },
  {
    name: "설정",
    desc: "알람 상·하한과 설정온도·환기 범위를 이 카드에만 적용합니다.",
  },
  {
    name: "모터",
    desc: "A·B·C 채널의 팬 출력 상태와 출력 이력을 보여줍니다.",
  },
] as const;

export function PanelPillsGuide() {
  return (
    <div className="rounded-lg border bg-muted/30 p-3.5">
      <ul className="space-y-2">
        {PILL_ITEMS.map((p) => (
          <li key={p.name} className="flex items-start gap-2.5 text-sm leading-snug">
            <span className="shrink-0 rounded-full border bg-background px-2.5 py-0.5 text-xs font-semibold">
              {p.name}
            </span>
            <span className="text-muted-foreground">{p.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
