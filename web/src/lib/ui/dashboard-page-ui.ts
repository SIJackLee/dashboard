/**
 * 대시보드 공통 — 타이포·레이아웃 스케일 (기준 대비 약 2배)
 * 컨트롤러·농장·축사·알람·로그·설정·관리 페이지 및 레이아웃 공유
 *
 * 역할 기반 타이포: canvases/dashboard-typography-guide.canvas.tsx 참고
 */
export const dashboardTypography = {
  pageTitle: "text-4xl font-bold",
  cardTitle: "text-[2rem] font-semibold leading-tight",
  sectionTitle: "text-2xl font-medium",
  cardDesc: "text-[1.75rem] text-muted-foreground leading-snug",
  formLabel: "text-2xl font-medium text-muted-foreground leading-snug",
  body: "text-[1.75rem] leading-snug",
  meta: "text-[1.75rem] text-muted-foreground leading-snug",
  tableCell: "text-[1.75rem] leading-snug",
  tableHead: "text-2xl font-medium",
  control: "text-[1.75rem] leading-snug",
  badge: "text-xl font-medium",
  value: "text-[1.75rem] font-mono font-semibold tabular-nums leading-tight",
  valueLg: "text-4xl font-mono font-bold tabular-nums leading-tight",
  tabNav: "text-[1.75rem] font-medium",
} as const;

export const dashboardControl = {
  input:
    "h-12 min-h-12 px-3 text-[1.75rem] leading-snug md:text-[1.75rem]",
  selectTrigger:
    "h-12 min-h-12 w-full px-3 text-[1.75rem] leading-snug md:text-[1.75rem] [&_svg]:size-5",
  selectItem: "py-2.5 pl-2.5 text-[1.75rem] leading-snug",
  button: "h-12 min-h-12 px-5 text-[1.75rem] font-medium leading-snug",
  buttonOutline: "h-11 min-h-11 px-4 text-[1.75rem] font-medium leading-snug",
} as const;

export const dashboardUi = {
  /* 레이아웃 — 사이드바·탑바 */
  sidebarWidth: "w-[20rem] shrink-0",
  sidebarBrand: "flex min-h-[5.5rem] items-center gap-3 px-5 py-3",
  sidebarBrandTitle: "text-2xl font-semibold leading-tight",
  sidebarBrandSub: "text-xl text-muted-foreground",
  sidebarBrandIcon: "size-11 rounded-lg",
  sidebarBrandIconInner: "size-7",
  navLink:
    "flex w-full min-h-[3.25rem] items-center gap-4 rounded-xl px-5 py-4 text-[1.625rem] font-semibold leading-snug transition-colors",
  navIcon: "size-9 shrink-0 [&_svg]:size-9",
  accountBlock: "space-y-3 border-t p-4",
  accountAvatar: "flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-xl font-medium",
  accountName: "truncate text-2xl font-medium leading-tight",
  accountRole: "text-xl text-muted-foreground",
  logoutBtn:
    "flex w-full items-center gap-4 rounded-xl px-5 py-3.5 text-2xl font-medium leading-snug text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",

  headerNavLink:
    "inline-flex min-h-[2.75rem] items-center gap-2 rounded-lg px-3 py-2 text-[1.75rem] font-medium leading-snug transition-colors md:px-4",
  headerNavIcon: "size-7 shrink-0 [&_svg]:size-7",
  headerBrand:
    "flex min-w-0 items-center gap-2.5 pr-1 md:gap-3 md:pr-2",
  headerBrandIcon: "size-10 rounded-lg md:size-11",
  headerBrandTitle:
    "hidden truncate text-2xl font-semibold leading-tight sm:block",
  headerAccountAvatar:
    "flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-medium md:size-10 md:text-xl",
  headerAccountName: "truncate text-xl font-medium leading-tight",
  headerAccountRole: "text-lg text-muted-foreground",

  topBar: "flex min-h-[5.5rem] flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-3 md:gap-4 md:px-6",
  pageTitle: "text-4xl font-bold",
  topBadge:
    "!h-auto min-h-[2.25rem] gap-2 px-4 py-1.5 text-xl font-medium leading-none",
  topBadgeDot: "size-2.5 shrink-0 rounded-full",
  topBadgeIcon: "size-5 shrink-0",
  topIconBtn: "relative rounded-lg p-3 hover:bg-muted",
  topBellIcon: "size-7",
  topAlarmDot: "absolute right-1.5 top-1.5 size-2.5 rounded-full bg-red-500",
  topLogoutBtn:
    "flex items-center gap-2 rounded-lg border px-4 py-2.5 text-2xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
  topLogoutIcon: "size-6",

  alarmMenuContent:
    "w-[min(100vw-2rem,38rem)] min-w-[28rem] p-2 text-[1.75rem] leading-snug",
  alarmMenuLabel:
    "px-4 py-3 text-2xl font-medium text-foreground data-inset:pl-4",
  alarmMenuItem:
    "cursor-pointer flex-col items-start gap-1 rounded-lg px-4 py-3 text-[1.75rem] leading-snug",
  alarmMenuMeta: "text-[1.5rem] leading-snug text-muted-foreground",
  alarmMenuTime: "text-[1.375rem] leading-snug text-muted-foreground",
  alarmMenuEmpty:
    "px-4 py-6 text-center text-[1.75rem] leading-snug text-muted-foreground",
  alarmMenuFooter:
    "justify-center rounded-lg py-3.5 text-[1.75rem] font-medium text-emerald-700",

  mainPad: "flex-1 overflow-y-auto p-6 md:p-8",
  /** 모니터링·운영 등 wide — 좌우 dead space 최소화 */
  mainPadWide: "flex-1 overflow-y-auto p-4 md:p-5",
  pageStack: "mx-auto space-y-6 md:space-y-8",
  pageStackWide: "w-full max-w-none space-y-4 md:space-y-5",

  /* 농장 요약 스트립 · 컨텍스트 패널 */
  overviewStrip: "grid grid-cols-1 items-stretch gap-6 2xl:grid-cols-12",
  overviewCol: "flex h-full w-full min-h-0",
  overviewPanelMinH: "min-h-[18rem]",
  contextPanel:
    "rounded-xl border bg-card p-5 ring-1 ring-foreground/10 md:p-6",

  /* 카드·박스 */
  section: "rounded-xl border bg-card p-5 md:p-6",
  sectionMuted: "rounded-xl border bg-muted/30 p-5 md:p-6",
  innerCard: "rounded-xl border p-5",
  sliderCard: "min-w-0 rounded-xl border p-5",
  sliderGrid: "mt-3 grid gap-4 md:grid-cols-1 lg:grid-cols-2",
  chipCard: "rounded-xl border p-4",
  chipWidth: "w-[17rem]",
  chipMinH: "min-h-[8.5rem]",
  metricTile: "rounded-xl border bg-background p-4",
  valueBox: "min-w-[7rem] rounded-lg border bg-muted/40 px-3 py-2.5 text-center",
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
  swipePanel: "rounded-xl border bg-muted/20 p-5 text-center",

  /* StatCard */
  statCard: "rounded-xl border bg-card",
  statCardPad: "flex items-start justify-between gap-4 p-5 md:p-6",
  statLabel: "text-2xl text-muted-foreground",
  statValue: "text-4xl font-bold leading-tight",
  statUnit: "ml-1 text-2xl font-medium",
  statSub: "text-xl text-muted-foreground",
  statIconWrap: "rounded-lg bg-muted p-3",
  statIcon: "size-8",
  statCompact:
    "flex items-center justify-between gap-3 rounded-xl border bg-muted/20 px-4 py-3",
  statCompactLabel: "text-xl text-muted-foreground leading-tight",
  statCompactValue: "text-3xl font-bold leading-tight",
  statCompactUnit: "ml-1 text-xl font-medium",
  statCompactSub: "truncate text-xl text-muted-foreground",
  statCompactIcon: "size-7 shrink-0 opacity-70",

  /* 타이포 */
  sectionTitle: "text-2xl font-medium text-muted-foreground",
  label: "text-2xl text-muted-foreground",
  body: "text-[1.75rem] leading-snug",
  value: "text-[1.75rem] font-mono font-semibold tabular-nums leading-tight",
  valueMd: "text-[2rem] font-mono font-bold tabular-nums leading-tight",
  valueLg: "text-4xl font-mono font-bold tabular-nums leading-tight",
  footer: "text-2xl text-muted-foreground leading-snug",
  bannerTitle: "text-2xl font-semibold",
  cardTitle: "text-[2rem] font-semibold",
  cardDesc: "text-[1.75rem] text-muted-foreground",
  table: "text-[1.75rem]",
  tableHead: "text-2xl font-medium",
  tableMeta: "text-[1.75rem] text-muted-foreground leading-snug",
  filterLabel: "text-2xl font-medium text-muted-foreground leading-snug",
  tabNav: "rounded-lg px-5 py-3 text-[1.75rem] font-medium",

  /* 간격 */
  stack: "space-y-5",
  gridGap: "gap-3 md:gap-4",
  chipStripGap: "gap-3",
  valueSlotMinH: "min-h-[11rem]",

  /* 아이콘 */
  iconSm: "size-7 shrink-0",
  iconMd: "size-8 shrink-0",

  /* 컨트롤 */
  slider: "ctrl-range min-w-0 flex-1",
  btnSave: "h-12 min-w-[9rem] gap-2 px-6 text-[1.75rem] font-medium",
  btnMicro: "h-11 min-w-[5.5rem] gap-2 px-4 text-[1.75rem]",
  btnMenuTab: "h-11 px-5 text-[1.75rem]",
  btnDefault: "h-11 px-5 text-[1.75rem] font-medium",
  btnSmAction: "h-11 min-h-[2.75rem] px-4 text-[1.75rem] font-medium leading-snug",
  spChip: "rounded-full border px-4 py-2.5 text-2xl font-medium",
  refreshBtn: "rounded-lg border px-4 py-2.5 text-xl font-medium",

  /* ScopeBar — Phase 2 통합 (farm · SP · stall · Refresh) */
  scopeBar:
    "rounded-xl border bg-muted/20 px-4 py-3 md:px-5 md:py-4",
  scopeBarSticky:
    "sticky top-0 z-20 border-b backdrop-blur supports-[backdrop-filter]:bg-background/90",
  scopeChip: "rounded-full border px-4 py-2 text-[1.625rem] font-medium leading-snug",
  scopeLabel: "text-2xl font-medium text-muted-foreground",

  /** OpsScopeBar — Active Pill + Popover (FarmRegionPanel 스타일) */
  opsScopeBar: "py-3 md:py-4",
  scopePill:
    "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-1.5 text-left font-medium transition-colors",
  scopePillText: "text-[1.75rem] leading-snug",
  scopePillActive:
    "border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  scopePillIdle:
    "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
  scopePillMenu:
    "max-h-80 min-w-[14rem] overflow-y-auto rounded-xl p-2 text-[1.75rem] leading-snug",
  scopePillMenuItem:
    "gap-2 rounded-lg px-3 py-1.5 text-[1.75rem] leading-snug",
  scopePillSeparator: "size-5 shrink-0 text-muted-foreground/70",

  /* SectionCard lg */
  cardHeaderLg: "px-6 pt-6 pb-4",
  cardContentLg: "px-6 pb-6",

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
  chartLabel: "text-2xl font-medium",
  chartLegend: "text-xl",
  chartValue: "text-4xl font-bold",
  mapCardTitle: "text-xl font-semibold leading-tight",
  mapCardMeta: "text-lg text-muted-foreground",
} as const;
