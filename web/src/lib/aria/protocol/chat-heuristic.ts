/**
 * CHAT 휴리스틱 — OpenAI 없을 때·폴백용. 동일 의도라도 문장 변주.
 * 톤: 합니다체 우선 (FARM/CTRL과 맞춤).
 * 브랜드: 델린(DELIN). CHAT에 영문 풀네임·기획 메타문구 금지.
 */
import { phraseIndex, phraseSeed } from "@/lib/aria/protocol/route";

const WEATHER_RE = /날씨|기상|비\s*올|비\s*와|기온/;
const WELLBEING_RE =
  /^(괜찮니|괜찮아|괜찮아요|괜찮습니까|잘\s*지내|너는\s*괜찮|(ARIA|DELIN|델린)\s*괜찮)/i;
const AMBIG_HOW_RE = /^(지금\s*)?어때\??$/;
const THANKS_RE = /고마|감사/;
const BYE_RE = /잘\s*자|바이|안녕히/;
const WHO_RE = /뭐야|누구|소개|ARIA|DELIN|델린/;
const HELP_RE = /도움|help|할\s*수\s*있|뭐\s*물어|어떻게\s*쓰/i;
const HELLO_RE = /^(안녕|안녕하세요|하이|헬로|hi|hello)\b/i;

export function chatHeuristicReply(question: string): string {
  const q = question.trim();

  if (WEATHER_RE.test(q)) {
    return pick(
      q,
      [
        "날씨 안내는 아직 준비 중입니다. 지금은 축사 현황을 「상황 어때?」로 물어봐 주세요.",
        "기상 정보는 곧 공공데이터로 연결할 예정입니다. 농장 이상은 「뭐가 문제야」로 확인해 보세요.",
        "밖 날씨보다 축사 이상이 급하면 「상황 어때?」라고 말씀해 주세요.",
      ],
      "weather",
    );
  }

  if (WELLBEING_RE.test(q)) {
    return pick(
      q,
      [
        "저요? 잘 듣고 있습니다. 델린은 정상입니다. 농장 쪽이 걱정되면 「상황 어때?」라고 물어봐 주세요.",
        "괜찮습니다, 대기 중입니다. 축사 상태는 「오늘 상황 어때」로 바로 확인해 드리겠습니다.",
        "네, 문제없습니다. 제가 아니라 농장이 궁금하시면 「이상상황」이라고 말씀해 주세요.",
      ],
      "wellbeing",
    );
  }

  if (AMBIG_HOW_RE.test(q)) {
    return "농장 현황이시면 「상황 어때」, 저한테 안부를 물으신 거면 괜찮습니다. 어떤 쪽일까요?";
  }

  if (THANKS_RE.test(q)) {
    return pick(
      q,
      [
        "천만에요. 필요하면 「상황 어때?」로 다시 불러 주세요.",
        "도움이 되어 기쁩니다. 이상상황이 있으면 「뭐가 문제야」라고 물어보세요.",
        "네. 컨트롤러가 궁금하면 「어느 컨트롤러」라고 말씀해 주세요.",
      ],
      "thanks",
    );
  }

  if (BYE_RE.test(q)) {
    return pick(
      q,
      [
        "안녕히 주무세요. 필요할 때 다시 「상황 어때?」로 불러 주세요.",
        "네, 나중에 또 말씀해 주세요.",
        "쉬세요. 다음엔 현황부터 도와드리겠습니다.",
      ],
      "bye",
    );
  }

  if (HELP_RE.test(q)) {
    return pick(
      q,
      [
        "델린은 텍스트로 축사 현황을 안내합니다. 「상황 어때?」, 「뭐가 문제야」, 「환기 어떻게」처럼 물어봐 주세요.",
        "이렇게 물어보시면 됩니다. 현황은 「상황 어때?」, 이상은 「뭐가 문제야」, 대응은 「환기 어떻게」입니다.",
        "도와드릴 수 있습니다. 농장 이상은 「오늘 상황 어때」, 컨트롤러는 「어느 컨트롤러」로 이어가 주세요.",
      ],
      "help",
    );
  }

  if (WHO_RE.test(q)) {
    return pick(
      q,
      [
        "델린은 축사 환경과 가축 현황을 말로 안내하는 AI입니다. 이상상황·온도는 「상황 어때?」로 물어봐 주세요.",
        "저는 델린입니다. 축사 이상과 대응 안내를 도와드립니다. 「뭐가 문제야」처럼 물어보시면 됩니다.",
        "델린입니다. 정식 명칭으로 현황을 말씀드리고, 알람 설정값은 바꾸지 않습니다.",
      ],
      "who",
    );
  }

  if (HELLO_RE.test(q) || q.length <= 4) {
    return pick(
      q,
      [
        "안녕하세요. 저는 델린입니다. 농장 현황은 「상황 어때?」처럼 질문해 주세요.",
        "네, 델린입니다. 축사 이상이 궁금하시면 「오늘 상황 어때」라고 말씀해 주세요.",
        "안녕하세요. 잡담도 괜찮고, 현황은 「상황 어때?」로 이어가 주세요.",
      ],
      "hello",
    );
  }

  return pick(
    q,
    [
      "안녕하세요. 저는 델린입니다. 농장 현황은 「상황 어때?」처럼 질문해 주세요.",
      "네, 델린입니다. 축사 이상이 궁금하시면 「오늘 상황 어때」라고 말씀해 주세요.",
      "델린입니다. 도움이 필요하시면 「도움」이라고 하시거나 「상황 어때?」로 물어봐 주세요.",
    ],
    "hello",
  );
}

function pick(seed: string, options: string[], intent: string): string {
  return (
    options[phraseIndex(phraseSeed(intent, seed), options.length)] ??
    options[0]!
  );
}
