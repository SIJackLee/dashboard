import "server-only";

import { VOICE_LIMITS, VOICE_MODELS } from "@/lib/voice-report/limits";
import type { VoiceFarmFacts } from "@/lib/voice-report/types";
import { truncateChars } from "@/lib/voice-report/parse-farm-from-question";

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY missing");
  return key;
}

export function openaiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function summarizeFarmWithOpenAI(
  question: string,
  facts: VoiceFarmFacts,
  factsJson: string,
): Promise<string> {
  const maxAnswer = VOICE_LIMITS.maxAnswerChars();
  const system =
    "당신은 축사 IoT 모니터링 요약 도우미입니다. " +
    "제공된 JSON 사실만 사용해 한국어로 짧게 답하세요. " +
    "JSON에 없는 수치·농장·알람을 만들지 마세요. " +
    `대시보드 용어를 유지하세요(예: 임신사, 이상상황 N건). ` +
    `답변은 ${maxAnswer}자 이내, 3~5문장.`;

  const user =
    `질문: ${question}\n\n사실 JSON:\n${factsJson}\n\n` +
    `농장 라벨: ${facts.farmLabel}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VOICE_MODELS.chat,
      temperature: 0.2,
      max_tokens: 400,
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
  return truncateChars(content, maxAnswer);
}

/**
 * 음성 → 텍스트 (한국어).
 * 기본 모델 실패 시 whisper-1 한 번 재시도.
 */
export async function transcribeAudioWithOpenAI(
  file: Blob,
  filename: string,
): Promise<string> {
  const models = [VOICE_MODELS.stt, "whisper-1"] as const;
  let lastErr = "";

  for (const model of models) {
    const form = new FormData();
    form.append("file", file, filename);
    form.append("model", model);
    form.append("language", "ko");
    form.append("response_format", "text");

    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey()}` },
      body: form,
    });

    if (res.ok) {
      const text = (await res.text()).trim();
      if (!text) throw new Error("openai_stt_empty");
      return truncateChars(text, VOICE_LIMITS.maxQuestionChars());
    }

    lastErr = `${model}:${res.status}:${(await res.text().catch(() => "")).slice(0, 120)}`;
    if (res.status !== 404 && res.status !== 400) break;
  }

  throw new Error(`openai_stt_${lastErr}`);
}

/** 텍스트 → mp3 (base64) */
export async function synthesizeSpeechWithOpenAI(
  text: string,
): Promise<{ base64: string; mimeType: string }> {
  const spoken = truncateChars(text, VOICE_LIMITS.maxAnswerChars());
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VOICE_MODELS.tts,
      voice: process.env.VOICE_TTS_VOICE?.trim() || "alloy",
      input: spoken,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`openai_tts_${res.status}:${body.slice(0, 200)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return {
    base64: buf.toString("base64"),
    mimeType: "audio/mpeg",
  };
}
