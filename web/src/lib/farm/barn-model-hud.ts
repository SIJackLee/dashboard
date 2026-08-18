/** 모델 탭 HUD — 투명 + ring-foreground/30. 카드·입구·방 편집이 같은 줄을 쓴다. */
const RING = "ring-1 ring-foreground/30";
const BTN =
  `inline-flex items-center justify-center bg-transparent text-foreground/80 ${RING} hover:bg-foreground/10 hover:text-foreground hover:ring-foreground/45`;

export const barnModelHud = {
  btn: `${BTN} rounded-md`,
  icon: `${BTN} size-7 shrink-0 rounded-md`,
  door: `${BTN} size-11 rounded-lg`,
  chip: `relative z-[1] h-5 min-w-[2.4rem] rounded-sm bg-transparent px-1 text-center text-[10px] font-medium tabular-nums text-foreground outline-none ${RING}`,
  count: `h-5 w-7 rounded-sm bg-transparent px-0.5 text-center text-[10px] font-medium tabular-nums outline-none ${RING}`,
  stepper: `flex size-5 items-center justify-center rounded-sm bg-transparent text-foreground/70 ${RING} hover:bg-foreground/10 hover:text-foreground`,
} as const;
