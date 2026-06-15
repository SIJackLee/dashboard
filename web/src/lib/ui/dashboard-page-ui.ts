/**
 * 대시보드 공통 — 타이포·레이아웃 스케일 (기준 대비 약 2배)
 * 컨트롤러·농장·축사·알람·로그·설정·관리 페이지 및 레이아웃 공유
 */
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

  topBar: "flex min-h-[5.5rem] items-center justify-between border-b bg-background px-6 py-3",
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

  mainPad: "flex-1 overflow-y-auto p-6 md:p-8",
  pageStack: "mx-auto space-y-6 md:space-y-8",

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
  tableMeta: "text-xl text-muted-foreground",
  filterLabel: "text-2xl font-medium text-muted-foreground",
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
  btnSmAction: "h-11 min-h-[2.75rem] px-4 text-xl font-medium",
  spChip: "rounded-full border px-4 py-2.5 text-2xl font-medium",
  refreshBtn: "rounded-lg border px-4 py-2.5 text-xl font-medium",

  /* SectionCard lg */
  cardHeaderLg: "px-6 pt-6 pb-4",
  cardContentLg: "px-6 pb-6",

  /* 차트·지도 */
  chartLabel: "text-2xl font-medium",
  chartLegend: "text-xl",
  chartValue: "text-4xl font-bold",
  mapCardTitle: "text-xl font-semibold leading-tight",
  mapCardMeta: "text-lg text-muted-foreground",
} as const;
