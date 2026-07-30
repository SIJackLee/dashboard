import { chatHeuristicReply } from "../src/lib/aria/protocol/chat-heuristic";
import { phraseIndex } from "../src/lib/aria/protocol/route";

const farm = "FARM01 · 양돈";
const bits = "임신사 1건, 분만사 3건, 자돈사 1건";
const crit = "위험 3건 포함";
const n = 5;

function d1(seed: string) {
  const opts = [
    `${farm} 기준, 전체 이상상황 ${n}건입니다(${crit}). ${bits}.`,
    `지금 ${farm}을 보면 이상상황이 ${n}건 잡혀 있어요(${crit}). 축사별로 ${bits}.`,
    `${farm} 현황입니다. 이상 ${n}건(${crit}). ${bits} 쪽을 먼저 보시면 됩니다.`,
    `확인 결과 ${farm}에 이상 ${n}건입니다(${crit}). ${bits}.`,
  ];
  return opts[phraseIndex(seed, opts.length)]!;
}

const utters = [
  "상황 어때",
  "오늘 상황 어때",
  "농장 상태 어때",
  "전체 요약해줘",
  "지금 어때",
  "농장 현황",
  "이상 있어?",
  "문제 있어?",
  "브리핑",
  "한눈에 알려줘",
  "전체적으로",
  "상태 요약",
  "지금 농장",
  "리포트",
  "현황 말해봐",
];
for (const u of utters) console.log(`${u}\t${d1(u)}`);
console.log(`날씨 어때\t${chatHeuristicReply("날씨 어때")}`);
console.log(`괜찮니\t${chatHeuristicReply("괜찮니")}`);
console.log(`안녕\t${chatHeuristicReply("안녕")}`);
console.log(`하이\t${chatHeuristicReply("하이")}`);
console.log(`고마워\t${chatHeuristicReply("고마워")}`);
