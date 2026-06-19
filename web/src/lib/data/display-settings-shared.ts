/** 표시 토글 키 — 페이지.요소 (클라이언트·서버 공유) */

export const DISPLAY_SETTING_GROUPS = [
  {
    page: "공통",
    pageId: "global",
    items: [{ key: "global.piggyMenu", label: "사이드바 오락 메뉴" }],
  },
  {
    page: "농장",
    pageId: "farm",
    items: [
      { key: "farm.map", label: "농장 지도" },
      { key: "farm.legend", label: "지도 범례" },
      { key: "farm.mapList", label: "지도 하단 축사유형 목록" },
      { key: "farm.resetButton", label: "위치 초기화 버튼" },
      { key: "farm.barnTable", label: "축사 목록(목록 탭)" },
    ],
  },
  {
    page: "컨트롤러",
    pageId: "controller",
    items: [
      { key: "controller.contextBar", label: "농장·축사유형 선택 바" },
      { key: "controller.controllerList", label: "컨트롤러 목록" },
      { key: "controller.liveMonitor", label: "LIVE 모니터" },
      { key: "controller.sliders", label: "설정 슬라이더" },
      { key: "controller.commandHistory", label: "명령 이력" },
    ],
  },
  {
    page: "알람",
    pageId: "alarm",
    items: [
      { key: "alarm.filterBar", label: "알람 필터·검색" },
      { key: "alarm.detailPanel", label: "설정값 패널" },
      { key: "global.topBarBell", label: "TopBar 알림 벨" },
    ],
  },
] as const;

export type DisplaySettingKey =
  (typeof DISPLAY_SETTING_GROUPS)[number]["items"][number]["key"];

export type DisplaySettings = Record<DisplaySettingKey, boolean>;

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  "farm.map": true,
  "farm.legend": true,
  "farm.mapList": true,
  "farm.resetButton": true,
  "farm.barnTable": true,
  "controller.contextBar": true,
  "controller.controllerList": true,
  "controller.liveMonitor": true,
  "controller.sliders": true,
  "controller.commandHistory": true,
  "alarm.filterBar": true,
  "alarm.detailPanel": true,
  "global.topBarBell": true,
  "global.piggyMenu": false,
};

export function isDisplayEnabled(
  settings: DisplaySettings,
  key: DisplaySettingKey
): boolean {
  return settings[key] ?? DEFAULT_DISPLAY_SETTINGS[key];
}

export function parseDisplaySettings(raw: unknown): DisplaySettings {
  const base = { ...DEFAULT_DISPLAY_SETTINGS };
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_DISPLAY_SETTINGS) as DisplaySettingKey[]) {
    if (typeof obj[key] === "boolean") base[key] = obj[key];
  }
  return base;
}
