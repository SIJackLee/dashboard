"use client";

/**
 * 스포트라이트 투어 — 툴팁 내부 확장 가이드.
 * - GaugeAnatomy: 컨트롤러 카드 게이지 바 읽는 법(확대 모식도).
 * - PanelPillsGuide: 그래프·설정 아이콘 역할 설명.
 * - ListModeIconsGuide: 목록 상단 보기 모드 아이콘.
 * - HeaderIconsGuide: 상단 헤더 도구·알림·물음표·계정.
 */

import {
  Bell,
  CircleHelp,
  FileText,
  LayoutGrid,
  LineChart,
  Moon,
  Settings,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ControllerDeviceIcon } from "@/components/icons/controller-device-icon";
import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

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
                  ? "mt-px flex size-3.5 shrink-0 items-center justify-center rounded-full bg-primary text-[0.55rem] font-bold text-primary-foreground"
                  : "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[0.65rem] font-bold text-primary-foreground"
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

const PILL_ITEMS: {
  name: string;
  desc: string;
  Icon: LucideIcon | typeof ControllerDeviceIcon;
}[] = [
  {
    name: "순환",
    desc: "카드 우측 버튼 — 컨트롤러 → 그래프 → 설정 → 컨트롤러 순으로 전환·접기.",
    Icon: ControllerDeviceIcon,
  },
  {
    name: "그래프",
    desc: "추이 패널을 엽니다. 다시 누르면 설정으로 갑니다.",
    Icon: LineChart,
  },
  {
    name: "설정",
    desc: "알람·설정온도·환기. 다시 누르면 컨트롤러로 접습니다.",
    Icon: Settings,
  },
];

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
                  ? "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-background"
                  : "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background"
              }
              aria-hidden
            >
              <p.Icon
                className={compact ? "size-3.5" : "size-4"}
                strokeWidth={dashboardUi.iconStroke}
              />
            </span>
            <span>
              <span className="font-semibold">{p.name}</span>
              <span className="text-muted-foreground"> — {p.desc}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const LIST_MODE_ITEMS: {
  name: string;
  desc: string;
  Icon: LucideIcon | typeof ControllerDeviceIcon;
}[] = [
  {
    name: "컨트롤러",
    desc: "게이지·현재값 중심 목록.",
    Icon: ControllerDeviceIcon,
  },
  {
    name: "그래프",
    desc: "카드 아래(또는 시트)에 추이 표시.",
    Icon: LineChart,
  },
  {
    name: "설정",
    desc: "알람·설정온도·환기 범위 조정.",
    Icon: Settings,
  },
  {
    name: "그룹별 보기",
    desc: "축사 유형별 묶음 / 평면 목록 전환.",
    Icon: LayoutGrid,
  },
];

export function ListModeIconsGuide({ compact = false }: GuideProps) {
  return (
    <div className={cnBox(compact)}>
      <p
        className={
          compact
            ? "mb-1.5 text-xs font-semibold text-muted-foreground"
            : "mb-2 text-sm font-semibold text-muted-foreground"
        }
      >
        목록 아이콘 안내
      </p>
      <ul className={compact ? "space-y-1.5" : "space-y-2"}>
        {LIST_MODE_ITEMS.map((p) => (
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
                  ? "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg border bg-background"
                  : "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background"
              }
              aria-hidden
            >
              <p.Icon
                className={compact ? "size-3.5" : "size-4"}
                strokeWidth={dashboardUi.iconStroke}
              />
            </span>
            <span>
              <span className="font-semibold">{p.name}</span>
              <span className="text-muted-foreground"> — {p.desc}</span>
            </span>
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

const HEADER_ICON_ITEMS: {
  key: string;
  label: string;
  desc: string;
  Icon: LucideIcon;
}[] = [
  {
    key: "alarms",
    label: "이상상황",
    desc: "모듈이 올린 활성 경보 건수. 누르면 목록으로 이동합니다.",
    Icon: Bell,
  },
  {
    key: "ops-report",
    label: "운영 · 일보",
    desc: "관리자는 운영 화면으로, 오늘의 리포트 PDF를 받을 수 있습니다.",
    Icon: FileText,
  },
  {
    key: "style",
    label: "레이아웃 · 테마",
    desc: "PC/모바일 미리보기와 라이트/다크를 전환합니다.",
    Icon: Moon,
  },
  {
    key: "help",
    label: "기능 안내",
    desc: "물음표를 누르면 지금 보고 있는 탭(현장·차트·델린) 안내가 시작됩니다.",
    Icon: CircleHelp,
  },
  {
    key: "account",
    label: "계정",
    desc: "프로필 메뉴에서 농장·활동·계정 탭과 요약 한 줄을 이용할 수 있습니다.",
    Icon: UserRound,
  },
];

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
        헤더 도구 안내
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
              <item.Icon
                className={compact ? "size-3.5" : "size-4"}
                strokeWidth={dashboardUi.iconStroke}
              />
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
