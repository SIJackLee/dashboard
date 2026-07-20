"use client";

/**
 * 스포트라이트 투어 — 툴팁 내부 확장 가이드.
 * - GaugeAnatomy: 컨트롤러 카드 게이지 바 읽는 법(확대 모식도).
 * - PanelPillsGuide: 그래프·설정 버튼 역할 설명.
 * - HeaderIconsGuide: 상단 헤더 아이콘(테마·연결·알림·계정).
 */

import { Bell, Moon, UserRound, Wifi } from "lucide-react";

const ANATOMY_ITEMS = [
  { n: 1, label: "현재값", desc: "주황 구간 — 지금 측정된 값" },
  { n: 2, label: "설정값", desc: "보라 구간 — 설정 온도~온도 편차" },
  { n: 3, label: "환기량", desc: "분홍 구간 — 설정값 중 현재값 구간" },
  { n: 4, label: "범위 이탈", desc: "마커가 범위를 벗어나면 주의·경고 색" },
] as const;

type GuideProps = {
  /** 모바일 bottom sheet — B 스케일 */
  compact?: boolean;
};

export function GaugeAnatomy({ compact = false }: GuideProps) {
  return (
    <div className={cnBox(compact)}>
      <p
        className={
          compact
            ? "mb-1.5 text-xs font-semibold text-muted-foreground"
            : "mb-2 text-sm font-semibold text-muted-foreground"
        }
      >
        게이지 바 읽는 법
      </p>
      <div className={compact ? "relative mb-1.5 select-none pt-0.5" : "relative mb-2 select-none pt-0.5"}>
        <div
          className={
            compact
              ? "relative h-3 w-full overflow-hidden rounded-md border bg-muted/40"
              : "relative h-4 w-full overflow-hidden rounded-md border bg-muted/40"
          }
          role="img"
          aria-label="게이지 예시 — 알람 하한~상한, 설정온도±편차, 현재값 마커"
        >
          <div
            className="pointer-events-none absolute inset-y-0 z-[1] rounded-sm bg-violet-500/40 ring-1 ring-inset ring-violet-600/45"
            style={{ left: "25%", width: "50%" }}
            aria-hidden
          />
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
          <div
            className={
              compact
                ? "absolute top-[-1px] z-[2] h-3.5 w-2.5 rounded-full bg-foreground"
                : "absolute top-[-1px] z-[2] h-[1.125rem] w-3 rounded-full bg-foreground"
            }
            style={{ left: "42%", transform: "translateX(-50%)" }}
            aria-hidden
          />
        </div>
        <div
          className={
            compact
              ? "mt-0.5 flex justify-between text-[0.65rem] text-muted-foreground"
              : "mt-1 flex justify-between text-xs text-muted-foreground"
          }
        >
          <span>하한</span>
          <span>상한</span>
        </div>
      </div>
      <ul className={compact ? "space-y-1" : "space-y-1.5"}>
        {ANATOMY_ITEMS.map((it) => (
          <li
            key={it.n}
            className={
              compact
                ? "flex items-start gap-1.5 text-xs leading-snug"
                : "flex items-start gap-2 text-sm leading-snug"
            }
          >
            <span
              className={
                compact
                  ? "mt-px flex size-3.5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[0.55rem] font-bold text-white"
                  : "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[0.65rem] font-bold text-white"
              }
            >
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
    name: "모터",
    desc: "온도·습도·채널 추이. 카드 하단 패널에서 확인. 채널 셀 탭으로 해당 채널 출력 추이.",
  },
  {
    name: "설정",
    desc: "알람·설정온도·환기 범위. 카드 하단 패널에서 변경.",
  },
] as const;

export function PanelPillsGuide({ compact = false }: GuideProps) {
  return (
    <div className={cnBox(compact)}>
      <ul className={compact ? "space-y-1.5" : "space-y-2"}>
        {PILL_ITEMS.map((p) => (
          <li
            key={p.name}
            className={
              compact
                ? "flex items-start gap-2 text-xs leading-snug"
                : "flex items-start gap-2.5 text-sm leading-snug"
            }
          >
            <span
              className={
                compact
                  ? "shrink-0 rounded-full border bg-background px-2 py-0.5 text-[0.65rem] font-semibold"
                  : "shrink-0 rounded-full border bg-background px-2.5 py-0.5 text-xs font-semibold"
              }
            >
              {p.name}
            </span>
            <span className="text-muted-foreground">{p.desc}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function cnBox(compact: boolean) {
  return compact
    ? "rounded-lg border bg-muted/30 p-2.5"
    : "rounded-lg border bg-muted/30 p-3.5";
}

const HEADER_ICON_ITEMS = [
  {
    key: "theme",
    label: "라이트 · 다크",
    desc: "달·태양 아이콘으로 화면 밝기를 전환합니다. 선택은 이 기기에 저장됩니다.",
    Icon: Moon,
  },
  {
    key: "connectivity",
    label: "컨트롤러 연결",
    desc: "WiFi 아이콘과 숫자는 등록된 컨트롤러 수입니다. 오프라인이 있으면 붉게 표시되며, 탭하면 연결·오프라인 대수를 확인할 수 있습니다.",
    Icon: Wifi,
  },
  {
    key: "alarms",
    label: "알림",
    desc: "벨 아이콘에서 센서·기상 알림을 확인합니다. 미확인 건수가 배지로 표시됩니다.",
    Icon: Bell,
  },
  {
    key: "account",
    label: "계정",
    desc: "프로필 메뉴에서 기능 안내 다시 보기, 최근 활동, 농장 주소 등을 이용할 수 있습니다.",
    Icon: UserRound,
  },
] as const;

export function HeaderIconsGuide({ compact = false }: GuideProps) {
  return (
    <div className={cnBox(compact)}>
      <p
        className={
          compact
            ? "mb-1.5 text-xs font-semibold text-muted-foreground"
            : "mb-2 text-sm font-semibold text-muted-foreground"
        }
      >
        상단 아이콘 안내
      </p>
      <ul className={compact ? "space-y-2" : "space-y-2.5"}>
        {HEADER_ICON_ITEMS.map((item) => (
          <li
            key={item.key}
            className={
              compact
                ? "flex items-start gap-2 text-xs leading-snug"
                : "flex items-start gap-2.5 text-sm leading-snug"
            }
          >
            <span
              className={
                compact
                  ? "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-background"
                  : "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background"
              }
              aria-hidden
            >
              <item.Icon className={compact ? "size-3.5" : "size-4"} />
            </span>
            <span>
              <span className="font-semibold">{item.label}</span>
              <span className="text-muted-foreground"> — {item.desc}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
