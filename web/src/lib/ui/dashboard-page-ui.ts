/**
 * 대시보드 공통 — 타이포·레이아웃 스케일
 * md 이상은 `--density-*-md` (comfortable≈2× / compact=조밀). docs/UI_DENSITY.md
 *
 * 역할 기반 타이포: canvases/dashboard-typography-guide.canvas.tsx 참고
 */
export const dashboardTypography = {
  pageTitle:
    "text-[length:var(--density-page-title)] font-bold md:text-[length:var(--density-page-title-md)]",
  cardTitle:
    "text-[length:var(--density-card-title)] font-semibold leading-tight md:text-[length:var(--density-card-title-md)]",
  sectionTitle:
    "text-[length:var(--density-section)] font-medium md:text-[length:var(--density-section-md)]",
  cardDesc:
    "text-[length:var(--density-meta)] text-muted-foreground leading-snug md:text-[length:var(--density-meta-md)]",
  formLabel:
    "text-[length:var(--density-body)] font-medium text-muted-foreground leading-snug md:text-[length:var(--density-section-md)]",
  body: "text-[length:var(--density-body)] leading-snug md:text-[length:var(--density-body-md)]",
  meta: "text-[length:var(--density-meta)] text-muted-foreground leading-snug md:text-[length:var(--density-meta-md)]",
  tableCell:
    "text-[length:var(--density-meta)] leading-snug md:text-[length:var(--density-meta-md)]",
  tableHead:
    "text-[length:var(--density-body)] font-medium md:text-[length:var(--density-section-md)]",
  control:
    "text-[length:var(--density-body)] leading-snug md:text-[length:var(--density-body-md)]",
  badge:
    "text-[length:var(--density-badge)] font-medium md:text-[length:var(--density-badge-md)]",
  value:
    "text-[length:var(--density-body)] font-mono font-semibold tabular-nums tracking-[var(--tracking-readout)] leading-none md:text-[length:var(--density-body-md)]",
  valueLg:
    "text-[length:var(--density-value-lg)] font-mono font-bold tabular-nums tracking-[var(--tracking-readout)] leading-none md:text-[length:var(--density-value-lg-md)]",
  tabNav:
    "text-[length:var(--density-meta)] font-medium md:text-[length:var(--density-meta-md)]",
  /** 필드 덮개 — md 2× 없이. 값은 valueLg. */
  envCoverIdentity:
    "text-[length:var(--density-body)] font-semibold leading-tight",
  envCoverMeta:
    "text-[length:var(--density-meta)] leading-tight",
  envCoverStatus:
    "text-[length:var(--density-meta)] font-medium leading-tight",
} as const;

/**
 * 갭2 — 허브 계기판 타이포 (숫자 vs 단위/라벨 대비).
 * docs/UI_DENSITY.md · UI_VISUAL_QA.md
 */
export const dashboardReadout = {
  /** 주 수치 (카드·칩) */
  value:
    "font-mono font-semibold tabular-nums tracking-[var(--tracking-readout)] leading-none text-[length:var(--density-readout)] md:text-[length:var(--density-readout-md)]",
  /** 강조 수치 (목록 EnvMetric · 큰 그리드) */
  valueLg:
    "font-mono font-bold tabular-nums tracking-[var(--tracking-readout)] leading-none text-[length:var(--density-readout-lg)] md:text-[length:var(--density-readout-lg-md)]",
  /** 단위 — 숫자보다 작고 muted, sans (값 옆) */
  unit:
    "ml-0.5 align-baseline font-sans font-medium tracking-normal text-muted-foreground text-[length:var(--density-readout-unit)] md:text-[length:var(--density-readout-unit-md)]",
  /** 단위 — margin 없음 (칩 내부 등) */
  unitBare:
    "align-baseline font-sans font-medium tracking-normal text-muted-foreground text-[length:var(--density-readout-unit)] md:text-[length:var(--density-readout-unit-md)]",
  /** 보조 라벨 (온도/습도 등) */
  label:
    "font-sans font-medium tracking-[var(--tracking-readout-label)] text-muted-foreground leading-none text-[length:var(--density-readout-label)] md:text-[length:var(--density-readout-label-md)]",
} as const;

export const dashboardControl = {
  input:
    "h-[length:var(--density-control-h)] min-h-[length:var(--density-control-h)] px-3 text-[length:var(--density-control-text)] leading-snug md:h-[length:var(--density-control-h-md)] md:min-h-[length:var(--density-control-h-md)] md:text-[length:var(--density-control-text-md)]",
  selectTrigger:
    "h-[length:var(--density-control-h)] min-h-[length:var(--density-control-h)] w-full px-3 text-[length:var(--density-control-text)] leading-snug md:h-[length:var(--density-control-h-md)] md:min-h-[length:var(--density-control-h-md)] md:text-[length:var(--density-control-text-md)] [&_svg]:size-4 md:[&_svg]:size-5",
  selectItem:
    "py-2 pl-2.5 text-[length:var(--density-control-text)] leading-snug md:py-2.5 md:text-[length:var(--density-control-text-md)]",
  button:
    "h-[length:var(--density-control-h)] min-h-[length:var(--density-control-h)] px-4 text-[length:var(--density-control-text)] font-medium leading-snug md:h-[length:var(--density-control-h-md)] md:min-h-[length:var(--density-control-h-md)] md:px-5 md:text-[length:var(--density-control-text-md)]",
  buttonOutline:
    "h-[length:var(--density-control-h-sm)] min-h-[length:var(--density-control-h-sm)] px-3 text-[length:var(--density-control-text)] font-medium leading-snug md:h-[length:var(--density-control-h-sm-md)] md:min-h-[length:var(--density-control-h-sm-md)] md:px-4 md:text-[length:var(--density-control-text-md)]",
} as const;

/**
 * 운영(/admin/ops) 전용 컴팩트 스케일.
 * 대시보드 md 2배 타이포를 쓰지 않고, 역할별 크기를 고정한다.
 */
export const opsTypography = {
  sectionTitle: "text-sm font-semibold leading-tight md:text-base",
  sectionDesc: "text-xs text-muted-foreground leading-snug md:text-sm",
  body: "text-sm leading-snug",
  meta: "text-xs text-muted-foreground leading-snug",
  /** 경로 칩 — 모바일 short만, PC 라벨 확대 */
  chipLabel:
    "block truncate text-center text-[0.65rem] font-semibold leading-tight md:text-left md:text-sm lg:text-base",
  chipMeta:
    "mt-0.5 hidden truncate text-xs text-muted-foreground leading-tight md:block md:text-sm",
  nav: "text-xs text-muted-foreground",
  alert: "text-sm leading-snug",
} as const;

export const opsControl = {
  button:
    "h-9 min-h-9 rounded-lg px-3 text-sm font-medium leading-snug md:h-10 md:min-h-10",
  buttonOutline:
    "h-9 min-h-9 rounded-lg px-3 text-sm font-medium leading-snug md:h-10 md:min-h-10",
  input: "h-9 min-h-9 px-3 text-sm leading-snug md:h-10 md:min-h-10",
  select:
    "mt-1 w-full rounded-lg border bg-background px-2 py-2 text-sm text-foreground",
  /** 경로 칩 — 모바일 균등 분배, PC 고정 크기 */
  pathStrip: "flex w-full flex-nowrap items-center gap-0.5 md:gap-2",
  pathStep: "flex min-w-0 flex-1 items-center gap-0.5 md:flex-none md:gap-2",
  pathArrow: "hidden shrink-0 text-muted-foreground/50 md:inline",
  chip:
    "inline-flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 text-center transition-colors hover:bg-muted/60 md:w-auto md:min-w-[5.5rem] md:flex-row md:items-center md:gap-1.5 md:px-3 md:py-2 md:text-left lg:min-w-[6.5rem]",
  chipSub:
    "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
} as const;

export const opsLayout = {
  stack: "flex flex-col gap-3 md:gap-4",
  stackTight: "flex flex-col gap-2 md:gap-3",
  sectionGap: "gap-3 md:gap-4",
  /** PC 명령 전체 — 페이지 길이 캡, 내부 스크롤 */
  commandTableScroll:
    "max-h-[min(40vh,28rem)] overflow-auto overscroll-contain rounded-lg border",
  commandTableStickyTh:
    "sticky top-0 z-10 bg-card after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border",
} as const;

/**
 * 운영 상태 팔레트 — 정상 / 경고 / 위험 / 선택 / 비활성.
 * 경로 칩·배지·필터 칩에서 동일 규칙을 쓴다.
 */
export const opsStatus = {
  /** 정상·선택 — brand primary */
  ok: "border-primary/60 bg-primary/10 text-primary dark:bg-primary/15",
  warn: "border-amber-400/70 bg-amber-50 text-amber-950 dark:border-amber-300/60 dark:bg-amber-950/30 dark:text-amber-100",
  danger: "border-red-400/70 bg-red-50 text-red-950 dark:border-red-300/60 dark:bg-red-950/30 dark:text-red-100",
  /** 정보·미구현 — channel-info */
  info: "border-channel-info/40 bg-channel-info/10 text-channel-info",
  selected: "border-primary bg-primary/10 text-primary dark:bg-primary/15",
  idle: "border-border text-muted-foreground hover:bg-muted/60 hover:text-foreground",
  chipFocus:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
} as const;

export const dashboardUi = {
  /* 레이아웃 — 사이드바·탑바 */
  sidebarWidth: "w-[20rem] shrink-0",
  sidebarBrand: "flex min-h-[5.5rem] items-center gap-3 px-5 py-3",
  sidebarBrandTitle:
    "text-[length:var(--density-section-md)] font-semibold leading-tight",
  sidebarBrandSub:
    "text-[length:var(--density-badge-md)] text-muted-foreground",
  sidebarBrandIcon: "size-11 rounded-lg",
  sidebarBrandIconInner: "size-7",
  navLink:
    "flex w-full min-h-[3.25rem] items-center gap-4 rounded-xl px-5 py-4 text-[length:var(--density-nav)] font-semibold leading-snug transition-colors",
  navIcon: "size-9 shrink-0 [&_svg]:size-9",
  accountBlock: "space-y-3 border-t p-4",
  accountAvatar: "flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-xl font-medium",
  accountName: "truncate text-2xl font-medium leading-tight",
  accountRole: "text-xl text-muted-foreground",
  logoutBtn:
    "flex w-full items-center gap-4 rounded-xl px-5 py-3.5 text-2xl font-medium leading-snug text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",

  headerNavLink:
    "inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg px-3 py-2 text-[length:var(--density-meta)] font-medium leading-snug transition-colors md:px-4 md:text-[length:var(--density-meta-md)]",
  headerNavIcon: "size-5 shrink-0 md:size-7 [&_svg]:size-5 md:[&_svg]:size-7",
  headerBrand:
    "flex min-w-0 flex-1 items-center gap-2.5 pr-1 sm:flex-none sm:shrink-0 md:gap-3 md:pr-2",
  headerBrandIcon:
    "relative shrink-0 overflow-hidden rounded-lg bg-muted/40 max-sm:h-11 max-sm:w-[7.5rem] sm:h-[1.3lh] sm:w-[1.3lh]",
  headerBrandTitle:
    "hidden truncate text-2xl font-semibold leading-tight sm:block",
  headerAccountAvatar:
    "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-medium md:size-10 md:text-xl",
  headerAccountName: "truncate text-xl font-medium leading-tight",
  headerAccountRole: "text-lg text-muted-foreground",

  topBar:
    "relative z-30 flex min-h-14 flex-nowrap items-center justify-between gap-2 border-b bg-background px-3 py-2 max-md:pt-safe md:min-h-[5.5rem] md:flex-wrap md:gap-4 md:px-6 md:py-3",
  pageTitle: "text-[length:var(--density-page-title-md)] font-bold",
  topBadge:
    "!h-auto min-h-[2.25rem] gap-2 px-4 py-1.5 text-[length:var(--density-badge-md)] font-medium leading-none",
  topBadgeDot: "size-2.5 shrink-0 rounded-full",
  topBadgeIcon: "size-5 shrink-0",
  topIconBtn: "relative rounded-lg p-3 hover:bg-muted",
  /** ThemeToggle · 도구 메뉴 · 알람 — bordered 헤더 액션 버튼 */
  topHeaderActionBtn:
    "relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:size-11",
  topHeaderActionBtnAlert:
    "border-red-300/60 bg-red-50/80 text-red-600 hover:text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 dark:hover:text-red-400",
  /** 헤더·내비 — 활성(운영 등) 크롬 tint (H3: 낮은 채도) */
  headerActionBtnActive:
    "border-primary/30 bg-primary/5 text-foreground hover:bg-primary/[0.07] hover:text-foreground dark:bg-primary/10 dark:text-foreground",
  /** 메뉴/리스트 행 선택 — 크롬 */
  menuItemActive: "bg-primary/5 dark:bg-primary/10",
  /** LIVE 등 브랜드 미니 칩 — 크롬 */
  brandChip:
    "shrink-0 rounded border border-primary/25 bg-primary/5 px-1.5 py-0.5 text-[10px] font-medium text-foreground",
  /** 차트 레이어 툴바 루트 — 크롬 (채널 뱃지는 아래 고채도 유지) */
  chartLayerActionBtn:
    "border-primary/30 bg-primary/5 text-foreground hover:bg-primary/10 hover:text-foreground dark:bg-primary/10",
  chartLayerActionBtnIdle:
    "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
  chartLayerGroupTemp:
    "border-channel-temp/50 bg-channel-temp/10 text-channel-temp",
  chartLayerGroupHum:
    "border-channel-hum/50 bg-channel-hum/10 text-channel-hum",
  chartLayerGroupMotor:
    "border-channel-motor/50 bg-channel-motor/10 text-channel-motor",
  chartLayerBadge: "bg-primary text-primary-foreground",
  chartLayerBadgeTemp: "bg-channel-temp text-white",
  chartLayerBadgeHum: "bg-channel-hum text-white",
  chartLayerBadgeMotor: "bg-channel-motor text-white",
  /** 채널·정보 tint (온습/추이 탭 등) */
  channelTintTemp:
    "border-channel-temp/60 bg-channel-temp/10 text-channel-temp",
  channelTintHum:
    "border-channel-hum/60 bg-channel-hum/10 text-channel-hum",
  channelTintMotor:
    "border-channel-motor/60 bg-channel-motor/10 text-channel-motor",
  channelTintInfo:
    "border-channel-info/60 bg-channel-info/10 text-channel-info",
  channelSolidTemp: "bg-channel-temp text-white",
  channelSolidHum: "bg-channel-hum text-white",
  channelSolidMotor: "bg-channel-motor text-white",
  channelAccentTrack: "bg-channel-hum/35",
  channelTextInfo: "text-channel-info",
  channelTextTemp: "text-channel-temp",
  channelTextHum: "text-channel-hum",
  channelTextMotor: "text-channel-motor",
  /** 오늘의 리포트 — PDF 강조(문서 아이콘) */
  topHeaderActionBtnReport:
    "border-red-300/70 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 disabled:opacity-40 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/60 dark:hover:text-red-300",
  /**
   * 헤더 도구 패널 행 — 트리거(⋮)와 동일 rounded-lg border 계열.
   * 왼쪽: size-9 아이콘 칩 · 오른쪽: 라벨/요약.
   */
  headerToolsCard:
    "mx-1 mb-1 flex w-[calc(100%-0.5rem)] items-start gap-2.5 rounded-lg border bg-background px-2 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/50",
  headerToolsCardAlert:
    "border-red-300/60 bg-red-50/50 hover:bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 dark:hover:bg-red-950/30",
  headerToolsCardIcon:
    "relative inline-flex size-9 shrink-0 items-center justify-center rounded-lg border text-muted-foreground",
  headerToolsCardIconAlert:
    "border-red-300/60 bg-red-50/80 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400",
  headerToolsCardBody: "min-w-0 flex-1",
  headerToolsCardTitle: "flex items-center gap-2 text-sm font-medium leading-tight",
  headerToolsCardMeta: "mt-0.5 text-xs leading-snug text-muted-foreground",
  /**
   * 통합 FAB 상세 — 짧은 요약용 캡슐 (리포트 등 1줄).
   */
  hubDetailPopover:
    "relative w-[min(92vw,17.5rem)] overflow-visible rounded-full border border-border/80 bg-popover py-2.5 pl-2.5 pr-3.5 text-popover-foreground shadow-sm",
  /** 이상상황 — 접힘/펼침 공통 카드 (캡슐 대신) */
  hubDetailPopoverAlarm:
    "relative flex max-h-[min(70dvh,28rem)] w-[min(92vw,18.5rem)] flex-col overflow-hidden rounded-2xl border border-border/80 bg-popover px-3 py-2.5 text-popover-foreground shadow-md",
  /** @deprecated 펼침 전용 — hubDetailPopoverAlarm 사용 */
  hubDetailPopoverList:
    "relative flex max-h-[min(70dvh,28rem)] w-[min(92vw,20rem)] flex-col overflow-hidden rounded-2xl border border-border/80 bg-popover py-2.5 pl-2.5 pr-3 text-popover-foreground shadow-sm",
  hubDetailPopoverAlert:
    "border-red-300/70 shadow-red-500/5 dark:border-red-900/50",
  /** FAB/궤도 쪽을 가리키는 작은 원형 노치 */
  hubDetailNotch:
    "pointer-events-none absolute top-1/2 size-3 -translate-y-1/2 rounded-full border border-border/80 bg-popover",
  hubDetailNotchEnd: "right-0 translate-x-1/2",
  hubDetailNotchStart: "left-0 -translate-x-1/2",
  hubDetailNotchAlert:
    "border-red-300/60 dark:border-red-900/40",
  hubDetailLeadIcon:
    "relative inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground",
  hubDetailLeadIconAlert:
    "border-red-300/60 bg-red-50/80 text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400",
  hubDetailLeadIconReport:
    "border-red-300/70 bg-red-50 text-red-600 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400",
  hubDetailBody: "min-w-0 flex-1 self-center",
  hubDetailBodyList: "flex min-h-0 min-w-0 flex-1 flex-col self-stretch gap-1",
  hubDetailTitle:
    "flex min-h-5 items-center gap-2 text-sm font-medium leading-tight tracking-tight",
  hubDetailMeta: "mt-0.5 text-xs leading-snug text-muted-foreground",
  hubDetailAction:
    "mt-1 text-left text-xs font-medium text-primary transition-colors hover:underline",
  /** 이상상황 카드 CTA — 칩 버튼 */
  hubDetailAlarmToggle:
    "mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-lg border border-border/70 bg-muted/30 px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/60",
  hubDetailRow: "flex items-center gap-2.5",
  hubDetailRowList: "flex min-h-0 flex-1 items-start gap-2.5",
  /** hub 캡슐 안 액션 행(리포트) */
  hubDetailActionRow:
    "flex w-full items-center gap-2.5 rounded-full text-left outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring/40",
  topBellIcon: "size-7",
  /** 컨트롤러 · 알람 bell 아이콘 (배지 오버레이용) */
  topHeaderOverlayIcon: "size-7",
  topHeaderCountBadge:
    "absolute -right-0.5 -top-0.5 flex min-h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-0.5 text-[10px] font-bold leading-none tabular-nums text-white lg:min-h-[1.5rem] lg:min-w-[1.5rem] lg:px-1 lg:text-[1rem]",
  topHeaderCountBadgeAlert: "bg-red-500",
  topHeaderCountBadgeOk: "bg-primary text-primary-foreground",
  topAlarmDot: "absolute right-1.5 top-1.5 size-2.5 rounded-full bg-red-500",
  topLogoutBtn:
    "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[length:var(--density-meta)] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:px-4 md:py-2.5 md:text-[length:var(--density-section-md)]",
  topLogoutIcon: "size-5 md:size-6",

  alarmMenuContent:
    "w-[min(100vw-1rem,calc(100vw-1rem))] max-md:min-w-0 p-2 text-[length:var(--density-body)] leading-snug md:w-[min(100vw-2rem,38rem)] md:min-w-[28rem] md:text-[length:var(--density-body-md)]",
  alarmMenuLabel:
    "px-4 py-3 text-[length:var(--density-section-md)] font-medium text-foreground data-inset:pl-4",
  alarmMenuItem:
    "cursor-pointer flex-col items-start gap-1 rounded-lg px-4 py-3 text-[length:var(--density-alarm)] leading-snug",
  alarmMenuMeta: "text-[length:var(--density-alarm-meta)] leading-snug text-muted-foreground",
  alarmMenuTime: "text-[length:var(--density-alarm-time)] leading-snug text-muted-foreground",
  alarmMenuEmpty:
    "px-4 py-6 text-center text-[length:var(--density-alarm)] leading-snug text-muted-foreground",
  alarmMenuFooter:
    "justify-center rounded-lg py-3.5 text-[length:var(--density-alarm)] font-medium text-primary",

  mainPad:
    "flex-1 overflow-y-auto p-3 md:p-6 md:pb-8",
  /** 모니터링·운영 등 wide — 좌우 dead space 최소화 */
  mainPadWide:
    "flex-1 overflow-y-auto p-3 md:p-5 md:pb-5",
  /** 하단 모바일 네비 — fixed bar 높이 + safe-area */
  mobileBottomNav:
    "z-40 flex border-t bg-background/95 pb-safe backdrop-blur supports-[backdrop-filter]:bg-background/90",
  mobileBottomNavFixed: "fixed bottom-0 left-0 right-0",
  /** DashboardViewportShell 내부 — 폰 너비 컬럼에 맞춤 */
  mobileBottomNavDocked: "absolute inset-x-0 bottom-0",
  /** 투어 bottom sheet — mobileBottomNav + 여백 */
  mobileBottomNavInset:
    "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
  mobileBottomNavItem:
    "flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 text-xs font-medium leading-tight transition-colors",
  pageStack: "mx-auto space-y-6 md:space-y-8",
  pageStackWide: "w-full max-w-none space-y-4 md:space-y-5",

  /* 농장 요약 스트립 · 컨텍스트 패널 */
  overviewStrip: "grid grid-cols-1 items-stretch gap-6 2xl:grid-cols-12",
  overviewCol: "flex h-full w-full min-h-0",
  overviewPanelMinH: "min-h-[18rem]",
  contextPanel:
    "rounded-xl border bg-card p-5 shadow-sm ring-1 ring-foreground/15 md:p-6 dark:shadow-none dark:ring-foreground/10",

  /* 카드·박스 — elevation: docs/UI_ELEVATION.md (0 canvas · 1 recessed · 2 card · 3 overlay) */
  section:
    "rounded-xl border bg-card p-5 shadow-[var(--surface-shadow-tile)] ring-1 ring-[color:var(--surface-ring)] md:p-6",
  sectionMuted:
    "rounded-xl border border-[color:var(--surface-well-border)] bg-[color:var(--surface-well)] p-5 md:p-6",
  innerCard: "rounded-xl border p-5",
  sliderCard: "min-w-0 rounded-xl border p-5",
  sliderGrid: "mt-3 grid gap-4 md:grid-cols-1 lg:grid-cols-2",
  chipCard: "rounded-xl border p-4",
  chipWidth: "w-[17rem]",
  chipMinH: "min-h-[8.5rem]",
  metricTile: "rounded-xl border bg-background p-3 md:p-4",
  valueBox: "min-w-[7rem] rounded-lg border bg-muted/50 px-3 py-2.5 text-center",
  valueBoxPrimary:
    "min-w-[7rem] rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5 text-center",
  valuePill:
    "rounded-lg border border-primary/50 bg-primary/5 px-3 py-2.5 text-primary",
  deltaBadge:
    "inline-flex min-h-[2rem] items-center rounded-full bg-amber-500/15 px-3 py-1 text-xl font-semibold text-amber-800 tabular-nums dark:text-amber-200",
  badgeLg:
    "!h-auto min-h-[2.5rem] gap-2 px-4 py-1.5 text-2xl font-medium leading-none",
  badgeMd:
    "!h-auto min-h-[2rem] gap-1.5 px-3 py-1 text-xl font-medium leading-none",
  banner: "rounded-xl border px-5 py-4",
  swipeZone:
    "rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-5 text-center touch-none",
  swipePanel:
    "rounded-xl border bg-muted/40 p-3 text-center md:p-5",

  /* StatCard */
  statCard: "rounded-xl border bg-card",
  statCardPad: "flex items-start justify-between gap-4 p-5 md:p-6",
  statLabel: "text-[length:var(--density-stat-label)] text-muted-foreground",
  statValue: "text-[length:var(--density-stat-value)] font-bold leading-tight",
  statUnit: "ml-1 text-[length:var(--density-stat-unit)] font-medium",
  statSub: "text-[length:var(--density-stat-sub)] text-muted-foreground",
  statIconWrap: "rounded-lg bg-muted p-3",
  statIcon: "size-8",
  statCompact:
    "flex items-center justify-between gap-2 rounded-xl border bg-muted/40 px-3 py-2 md:gap-3 md:px-4 md:py-3",
  statCompactLabel:
    "text-xs text-muted-foreground leading-tight md:text-[length:var(--density-stat-compact-label-md)]",
  statCompactValue:
    "text-xl font-bold leading-tight md:text-[length:var(--density-stat-compact-value-md)]",
  statCompactUnit:
    "ml-1 text-sm font-medium md:text-[length:var(--density-stat-compact-label-md)]",
  statCompactSub:
    "truncate text-xs text-muted-foreground md:text-[length:var(--density-stat-compact-label-md)]",
  statCompactIcon: "size-5 shrink-0 opacity-70 md:size-7",

  /* 타이포 — density 토큰 (comfortable / compact) */
  sectionTitle:
    "text-[length:var(--density-section)] font-medium text-muted-foreground md:text-[length:var(--density-section-md)]",
  label:
    "text-[length:var(--density-body)] text-muted-foreground md:text-[length:var(--density-section-md)]",
  body: "text-[length:var(--density-body)] leading-snug md:text-[length:var(--density-body-md)]",
  value:
    "text-[length:var(--density-body)] font-mono font-semibold tabular-nums tracking-[var(--tracking-readout)] leading-none md:text-[length:var(--density-body-md)]",
  valueMd:
    "text-[length:var(--density-section)] font-mono font-bold tabular-nums tracking-[var(--tracking-readout)] leading-none md:text-[length:var(--density-card-title-md)]",
  valueLg:
    "text-[length:var(--density-value-lg)] font-mono font-bold tabular-nums tracking-[var(--tracking-readout)] leading-none md:text-[length:var(--density-value-lg-md)]",
  footer:
    "text-[length:var(--density-body)] text-muted-foreground leading-snug md:text-[length:var(--density-section-md)]",
  bannerTitle:
    "text-[length:var(--density-section)] font-semibold md:text-[length:var(--density-section-md)]",
  cardTitle:
    "text-[length:var(--density-card-title)] font-semibold md:text-[length:var(--density-card-title-md)]",
  cardDesc:
    "text-[length:var(--density-meta)] text-muted-foreground md:text-[length:var(--density-meta-md)]",
  table:
    "text-[length:var(--density-meta)] md:text-[length:var(--density-meta-md)]",
  tableHead:
    "text-[length:var(--density-body)] font-medium md:text-[length:var(--density-section-md)]",
  tableMeta:
    "text-[length:var(--density-meta)] text-muted-foreground leading-snug md:text-[length:var(--density-meta-md)]",
  filterLabel:
    "text-[length:var(--density-body)] font-medium text-muted-foreground leading-snug md:text-[length:var(--density-section-md)]",
  tabNav:
    "rounded-lg px-3 py-2 text-[length:var(--density-meta)] font-medium md:px-5 md:py-3 md:text-[length:var(--density-meta-md)]",

  /* 간격 */
  stack: "space-y-5",
  gridGap: "gap-3 md:gap-4",
  chipStripGap: "gap-3",
  valueSlotMinH: "min-h-[11rem]",

  /* 아이콘 */
  iconSm: "size-4 shrink-0 md:size-[length:var(--density-icon-sm-md)]",
  iconMd: "size-5 shrink-0 md:size-[length:var(--density-icon-md-md)]",
  /** Lucide·커스텀 공통 선 두께 (아이콘 패밀리 A안) */
  iconStroke: 1.75 as const,

  /* 컨트롤 */
  slider: "ctrl-range min-w-0 flex-1",
  btnSave:
    "h-[length:var(--density-control-h)] min-w-0 gap-2 px-4 text-[length:var(--density-control-text)] font-medium md:h-[length:var(--density-control-h-md)] md:min-w-[9rem] md:px-6 md:text-[length:var(--density-control-text-md)]",
  btnMicro:
    "h-[length:var(--density-control-h-sm)] min-w-0 gap-1.5 px-3 text-[length:var(--density-control-text)] md:h-[length:var(--density-control-h-sm-md)] md:min-w-[5.5rem] md:gap-2 md:px-4 md:text-[length:var(--density-control-text-md)]",
  btnMenuTab:
    "h-[length:var(--density-control-h-sm)] px-3 text-[length:var(--density-control-text)] md:h-[length:var(--density-control-h-sm-md)] md:px-5 md:text-[length:var(--density-control-text-md)]",
  btnDefault:
    "h-[length:var(--density-control-h-sm)] px-3 text-[length:var(--density-control-text)] font-medium md:h-[length:var(--density-control-h-sm-md)] md:px-5 md:text-[length:var(--density-control-text-md)]",
  btnSmAction:
    "h-[length:var(--density-control-h-sm)] min-h-[length:var(--density-control-h-sm)] px-3 text-[length:var(--density-control-text)] font-medium leading-snug md:h-[length:var(--density-control-h-sm-md)] md:min-h-[length:var(--density-control-h-sm-md)] md:px-4 md:text-[length:var(--density-control-text-md)]",
  spChip:
    "rounded-full border px-4 py-2.5 text-[length:var(--density-sp-chip)] font-medium",
  refreshBtn:
    "rounded-lg border px-4 py-2.5 text-[length:var(--density-refresh)] font-medium",

  /* ScopeBar — farm · SP · stall (새로고침·레이어는 TopBar) */
  scopeBar:
    "relative overflow-visible rounded-xl border bg-muted/40 px-4 py-3 md:px-5 md:py-4",
  scopeBarSticky:
    "sticky top-0 z-20 overflow-visible border-b backdrop-blur supports-[backdrop-filter]:bg-background/90",
  scopeChip:
    "rounded-full border px-4 py-2 text-[length:var(--density-scope-chip)] font-medium leading-snug",
  scopeLabel:
    "text-[length:var(--density-scope-label)] font-medium text-muted-foreground",

  /** OpsScopeBar — Active Pill + Popover (FarmRegionPanel 스타일) */
  opsScopeBar: "py-3 md:py-4",
  scopePill:
    "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-1.5 text-left font-medium transition-colors",
  scopePillText:
    "text-[length:var(--density-meta)] leading-snug md:text-[length:var(--density-meta-md)]",
  scopePillActive:
    "border-primary/40 bg-primary/5 text-foreground dark:bg-primary/10",
  scopePillIdle:
    "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
  scopePillMenu:
    "max-h-80 min-w-[14rem] overflow-y-auto rounded-xl p-2 text-[length:var(--density-meta)] leading-snug md:text-[length:var(--density-meta-md)]",
  scopePillMenuItem:
    "gap-2 rounded-lg px-3 py-1.5 text-[length:var(--density-meta)] leading-snug md:text-[length:var(--density-meta-md)]",
  scopePillSeparator: "size-5 shrink-0 text-muted-foreground/70",

  /* SectionCard lg */
  cardHeaderLg: "px-4 pt-4 pb-3 md:px-6 md:pt-6 md:pb-4",
  cardContentLg: "px-4 pb-4 md:px-6 md:pb-6",

  /** 운영 3열 좌·우 사이드 패널 — compact typography */
  opsSideBody: "text-sm leading-snug",
  opsSideMeta: "text-xs text-muted-foreground leading-snug",
  opsSideTableHead: "text-xs font-medium",
  opsSideTableCell: "text-sm leading-snug",
  opsSideBadge: "text-xs font-medium",
  opsSideFieldLabel: "text-xs font-medium text-muted-foreground",
  opsSideBtn: "h-8 min-h-8 gap-1.5 px-3 text-sm font-medium leading-snug",
  opsSideInnerCard: "rounded-lg border p-3",

  /* 차트·지도 */
  chartLabel: "text-[length:var(--density-chart-label)] font-medium",
  chartLegend: "text-[length:var(--density-chart-legend)]",
  chartValue: "text-[length:var(--density-chart-value)] font-bold",
  mapCardTitle: "text-xl font-semibold leading-tight",
  mapCardMeta: "text-lg text-muted-foreground",

  /** ChannelCell · FarmMapCard EnvChip — 맵은 큰 계기판 수치 유지 */
  gridCellMetaCompact: dashboardReadout.unitBare,
  gridCellValueCompact:
    "font-mono font-bold tabular-nums tracking-[var(--tracking-readout)] leading-none text-[length:var(--density-map-value-compact)] md:text-[length:var(--density-map-value-compact-md)]",
  gridCellValueDefault:
    "font-mono font-bold tabular-nums tracking-[var(--tracking-readout)] leading-none text-[length:var(--density-map-value)] md:text-[length:var(--density-map-value-md)]",
  /** 축사 카드 제목 — 수치 스타일 금지 (갭2) */
  gridCellTitleCompact:
    "font-sans font-semibold leading-tight text-[length:var(--density-meta)] md:text-[length:var(--density-meta-md)]",
  gridCellTitleDefault:
    "font-sans font-semibold leading-tight truncate text-[length:var(--density-section)] md:text-[length:var(--density-section-md)]",
  gridCellIconCompact: "size-5 shrink-0 sm:size-6",
  gridCellIconDefault: "size-6 shrink-0 sm:size-7",
} as const;

/**
 * H3 채도 역할 — docs/UI_CHROMA.md
 * 크롬(내비/탭/선택)은 낮은 채도, 데이터·알람은 고채도 유지.
 */
export const dashboardChroma = {
  /** 크롬 선택 텍스트 (탭 라벨 등) */
  chromeActiveText: "text-foreground",
  chromeIdleText: "text-muted-foreground hover:text-foreground",
  /** 크롬 선택 면 */
  chromeSelected:
    "border-primary/30 bg-primary/5 text-foreground dark:bg-primary/10",
  /** 뷰 탭 슬라이딩 필 — 카드 면 + ring. 다크도 트랙(muted)과 층을 나눔 */
  viewTabPill:
    "bg-card shadow-sm ring-1 ring-border/80 dark:shadow-none",
  /** 빈 상태 본문 */
  emptyState:
    "px-4 py-8 text-center text-[length:var(--density-meta)] text-muted-foreground leading-snug md:text-[length:var(--density-meta-md)]",
  /** 스켈레톤 본 */
  skeletonBone: "animate-pulse rounded-md bg-muted/40",
} as const;

/**
 * Elevation 프리셋 — docs/UI_ELEVATION.md
 * 본문 카드에 강한 shadow / 호버 shadow 승격 금지 (verify:ui-elevation).
 */
export const dashboardElevation = {
  /** 2 — raised card (갭5: --surface-shadow-tile / --surface-ring) */
  card:
    "rounded-xl border bg-card shadow-[var(--surface-shadow-tile)] ring-1 ring-[color:var(--surface-ring)]",
  /** 2 + 약한 ring (컨텍스트 강조) */
  cardEmphasis:
    "rounded-xl border bg-card shadow-[var(--surface-shadow-tile)] ring-1 ring-[color:var(--surface-ring)]",
  /** 1 — recessed */
  recessed:
    "rounded-xl border border-[color:var(--surface-well-border)] bg-[color:var(--surface-well)]",
  /**
   * 1 — hub 그리드·목록 우물 (갭1/5).
   */
  well:
    "rounded-xl border border-[color:var(--surface-well-border)] bg-[color:var(--surface-well)]",
  /**
   * 2 — hub 축사/컨트롤러 타일 (갭1/5).
   */
  tile:
    "rounded-lg border bg-card shadow-[var(--surface-shadow-tile)] ring-1 ring-[color:var(--surface-ring)]",
  /**
   * 1 — 주 지표 포켓 (갭1/5).
   */
  metricPocket: "rounded-md bg-[color:var(--surface-pocket)]",
  /** 3 — popover / 메뉴 */
  overlay:
    "rounded-lg border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10",
  /** 3 — 강한 플로팅 (토스트·모달 셸) */
  overlayStrong:
    "rounded-lg border bg-popover text-popover-foreground shadow-lg ring-1 ring-foreground/10",
  float: "rounded-lg border bg-background shadow-lg",
  /**
   * 상호작용 피드백 — elevation 승격 없음 (ring만).
   */
  interactiveHover:
    "hover:ring-1 hover:ring-foreground/20 dark:hover:ring-foreground/15",
} as const;

/** 허브 면·여백 (갭1) — elevation + 간격만 */
export const dashboardHubSurface = {
  well: dashboardElevation.well,
  tile: dashboardElevation.tile,
  metricPocket: dashboardElevation.metricPocket,
  /** 그리드 셀 간격 — 도구 격자감 완화 */
  gridGap: "gap-2.5 p-3 md:gap-3 md:p-4",
} as const;

/**
 * 갭4 — ARIA 탭 셸 (프로토콜 로직 비접촉).
 * docs/UI_ARIA_PRESENCE.md · UI_VISUAL_QA.md
 */
export const dashboardAriaShell = {
  /** 탭 전체 스테이지 — 테마 토큰 (--aria-stage-*) */
  stage:
    "relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-b from-[color:var(--aria-stage-from)] via-background to-[color:var(--aria-stage-to)] dark:border-primary/18",
  /** 오브 뒤 방사 글로우 */
  stageGlow: "aria-shell-stage-glow",
  title:
    "text-[length:var(--density-page-title)] font-semibold tracking-tight text-primary md:text-[length:var(--density-page-title-md)]",
  eyebrow:
    "text-[length:var(--density-readout-label)] font-medium tracking-[var(--tracking-readout-label)] text-primary/70 md:text-[length:var(--density-readout-label-md)]",
  farmMeta:
    "text-[length:var(--density-meta)] text-muted-foreground md:text-[length:var(--density-meta-md)]",
  warnMeta: "text-[length:var(--density-meta)] text-status-warn md:text-[length:var(--density-meta-md)]",
  hint:
    "mt-2 max-w-[20rem] shrink-0 px-3 text-center text-[length:var(--density-meta)] leading-snug text-muted-foreground break-keep text-balance md:max-w-none md:text-[length:var(--density-meta-md)]",
  orbZone: "relative z-[1] flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-2 pt-2",
  dockSlot:
    "pointer-events-none absolute inset-x-0 bottom-0 z-[3] px-3 pb-3 pt-1 md:px-4 md:pb-4",
  /** 하단 입력 도크 */
  dock:
    "rounded-2xl border border-primary/25 bg-card/90 p-3 shadow-[var(--surface-shadow-tile)] ring-1 ring-primary/15 backdrop-blur-md dark:border-primary/20 dark:bg-card/90 md:p-4",
  /** 도크 드래그 핸들 */
  dockDragHandle:
    "mb-1.5 flex w-full cursor-grab items-center justify-center rounded-md py-1 text-muted-foreground/70 hover:bg-muted/40 hover:text-muted-foreground active:cursor-grabbing",
  stageBody:
    "relative z-[1] flex min-h-0 flex-1 flex-col gap-2 px-3 pb-1 pt-1 md:flex-row md:items-stretch md:gap-3 md:px-4",
  /** 입력 도크 오버레이와 겹치지 않게 스테이지 하단 예약 */
  stageBodyDockClear:
    "pb-[var(--aria-dock-clearance,17rem)]",
  metricsSlot: "aria-stage-metrics order-2 min-h-0 md:order-1",
  metricsSlotHidden: "aria-stage-metrics-collapsed",
  metricsSlotRail:
    "aria-stage-metrics-rail w-full shrink-0 md:w-[min(38%,17rem)] md:self-center",
  /** 결과면 — 우측 축소 오브만 피함(하단 도크는 stageBodyDockClear) */
  metricsSlotHero:
    "aria-stage-metrics-hero flex min-h-[9rem] min-w-0 flex-1 flex-col pr-[5.5rem] md:min-h-0 md:w-auto md:pr-[6.5rem]",
  orbSlot:
    "aria-stage-orb flex flex-col items-center justify-center gap-0",
  orbSlotCenter:
    "aria-stage-orb-center order-1 min-h-0 w-full flex-1 md:order-2 md:flex-1",
  /** speak/결과면 — 도크 예약 위·우측 */
  orbSlotCorner:
    "aria-stage-orb-corner absolute right-2 z-[4] w-[5.25rem] shrink-0 md:right-3 md:w-[6rem] bottom-[calc(var(--aria-dock-clearance,17rem)+0.5rem)] md:bottom-[calc(var(--aria-dock-clearance,17rem)+0.75rem)]",
  /** @deprecated 코너 앵커로 대체 · 호환용 */
  orbSlotSide:
    "aria-stage-orb-side w-full shrink-0 md:w-[7.5rem] md:shrink-0 md:self-center",
  /** 오브+상태+힌트를 한 덩어리로 중앙 정렬 */
  orbStack: "flex w-full max-w-lg flex-col items-center justify-center gap-2 px-2",
  metricsPanel:
    "aria-stage-metrics-panel flex h-full min-h-0 flex-col rounded-xl border border-primary/20 bg-card/80 p-3 shadow-[var(--surface-shadow-tile)] backdrop-blur-sm md:p-3.5",
  metricsEyebrow:
    "text-[length:var(--density-readout-label)] font-medium tracking-[var(--tracking-readout-label)] text-primary/70",
  metricsTitle:
    "text-[length:var(--density-section)] font-semibold tracking-tight text-foreground md:text-[length:var(--density-section-md)]",
  metricsBlurb:
    "mt-0.5 text-[length:var(--density-meta)] text-muted-foreground",
  metricsBody:
    "mt-3 flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-6",
  metricsNavBtn:
    "inline-flex size-7 items-center justify-center rounded-md border border-border/80 text-sm text-muted-foreground hover:bg-muted/50",
  metricsSlideBody: "aria-stage-slide-body",
} as const;

