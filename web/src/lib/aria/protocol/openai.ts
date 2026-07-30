import "server-only";

import { VOICE_LIMITS, VOICE_MODELS } from "@/lib/voice-report/limits";
import { truncateChars } from "@/lib/voice-report/parse-farm-from-question";

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY missing");
  return key;
}

async function chatCompletion(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VOICE_MODELS.chat,
      temperature: 0.1,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) {
      throw new Error(`openai_quota:${body.slice(0, 200)}`);
    }
    throw new Error(`openai_chat_${res.status}:${body.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("openai_empty");
  return content;
}

/** FARM/CTRL — 프로토콜 코드만 출력 */
export async function judgeProtocolWithOpenAI(
  packText: string,
): Promise<string> {
  const system =
    "당신은 축사 IoT 판단기입니다. 한국어 문장을 쓰지 마세요. " +
    "오직 아래 형식의 프로토콜 라인만 출력하세요. " +
    "ROUTE / DEPTH / JUDGE / FOCUS / SAY / NEXT_HINT 또는 " +
    "ROUTE / JUDGE / REC / SAY 만 사용. " +
    "SAY는 DEPTH에 해당하는 레이어만: D1=TYPE_SUMMARY, D2=ALARM_LIST, D3=CTRL_LIST, D4=DIAG " +
    "(이전 레이어 반복 금지). OK,NEED_CLARIFY,REC_TEXT 도 허용. " +
    "JUDGE는 OK,WARN,CRIT,RECOMMEND,CLARIFY. " +
    "CTRL REC는 현장 대응만: RAISE_MAX_VENT,CHECK_COOLING,CHECK_HEATING," +
    "CHECK_HUMIDITY,INSTRUCT_WORKER,CHECK_OFFLINE,NONE. " +
    "알람 임계값·상하한 변경 코드 금지. " +
    "DEPTH_REQ를 존중하되 「자세히」면 DEPTH 4. " +
    "내부 ID·JSON·설명 문장 금지.";

  return chatCompletion(system, packText, 220);
}

/** CHAT — 짧은 잡담 (농장 수치 금지) */
export async function chatReplyWithOpenAI(question: string): Promise<string> {
  const maxAnswer = VOICE_LIMITS.maxAnswerChars();
  const system =
    "당신은 델린(DELIN, 축사 환경·가축 현황 도우미)입니다. " +
    "짧은 한국어로 친근히 답하세요. 농장 수치·알람·컨트롤러 데이터를 만들지 마세요. " +
    "영문 풀네임은 읽지 마세요. 「괜찮니」는 본인 안부, 「지금 어때」는 농장/안부 확인 질문을 하세요. " +
    "날씨는 아직 준비 중이라고만 짧게 안내하세요. " +
    "농장 현황을 물으면 「상황 어때?」로 다시 물어보라고 안내하세요. " +
    `답변 ${maxAnswer}자 이내, 1~3문장.`;

  const content = await chatCompletion(system, `질문: ${question}`, 200);
  return truncateChars(content, maxAnswer);
}
