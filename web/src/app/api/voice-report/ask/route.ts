import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { parseFarmKeyFromQuery, type FarmKey } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import {
  runAriaProtocol,
  ariaProtocolV1Enabled,
  routeByRules,
} from "@/lib/aria/protocol/pipeline";
import { parseAriaSession } from "@/lib/aria/protocol/route";
import { recordAriaTurnLog } from "@/lib/aria/protocol/turn-log";
import type { AriaSession } from "@/lib/aria/protocol/types";
import {
  buildFarmFacts,
  buildTemplateSummary,
  canReadFarm,
  factsToPromptJson,
} from "@/lib/voice-report/build-farm-facts";
import { buildDelinAnswerExtras } from "@/lib/voice-report/delin-chart-handoff";
import { estimateAskCostUsd } from "@/lib/voice-report/estimate-cost";
import {
  VOICE_LIMITS,
  voiceReportEnabled,
} from "@/lib/voice-report/limits";
import {
  openaiConfigured,
  summarizeFarmWithOpenAI,
  synthesizeSpeechWithOpenAI,
  transcribeAudioWithOpenAI,
} from "@/lib/voice-report/openai-client";
import {
  resolveFarmFromQuestion,
  truncateChars,
} from "@/lib/voice-report/parse-farm-from-question";
import type {
  VoiceAskError,
  VoiceAskMode,
  VoiceAskSuccess,
} from "@/lib/voice-report/types";
import {
  canAffordVoiceRequest,
  checkVoiceRateLimit,
  getVoiceUsage,
  markVoiceRequest,
  recordVoiceSpend,
} from "@/lib/voice-report/usage-store";

function err(
  status: number,
  error: VoiceAskError["error"],
  message: string,
  usage?: VoiceAskError["usage"],
) {
  const body: VoiceAskError = { ok: false, error, message, usage };
  return NextResponse.json(body, { status });
}

function parseCurrentFarm(input: {
  currentLsind?: string | null;
  currentItem?: string | null;
  currentFarm?: string | null;
}): FarmKey | null {
  if (input.currentLsind && input.currentItem) {
    return parseFarmKeyFromQuery(input.currentLsind, input.currentItem);
  }
  const raw = input.currentFarm?.trim();
  if (!raw) return null;
  const slash = raw.indexOf("/");
  if (slash > 0) {
    return parseFarmKeyFromQuery(raw.slice(0, slash), raw.slice(slash + 1));
  }
  return parseFarmKeyFromQuery(raw, "P00");
}

type ParsedAsk = {
  mode: VoiceAskMode;
  question: string | null;
  audio: Blob | null;
  audioFilename: string;
  durationSec: number;
  withTts: boolean;
  currentFarm: FarmKey | null;
  ariaSession: AriaSession | null;
};

function parseSessionFromForm(form: FormData): AriaSession | null {
  const raw = String(form.get("ariaSession") ?? "").trim();
  if (!raw) return null;
  try {
    return parseAriaSession(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function parseAskRequest(request: Request): Promise<ParsedAsk | { parseError: true }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const audioEntry = form.get("audio");
    const audio =
      audioEntry instanceof Blob && audioEntry.size > 0 ? audioEntry : null;
    const filename =
      audioEntry instanceof File && audioEntry.name
        ? audioEntry.name
        : "question.webm";
    const questionRaw = String(form.get("question") ?? "");
    const durationSec = Number(form.get("durationSec") ?? 0);
    const withTts = String(form.get("withTts") ?? "1") !== "0";
    return {
      mode: audio ? "audio" : "text",
      question: questionRaw.trim() ? questionRaw : null,
      audio,
      audioFilename: filename,
      durationSec: Number.isFinite(durationSec) ? durationSec : 0,
      withTts,
      currentFarm: parseCurrentFarm({
        currentLsind: String(form.get("currentLsind") ?? ""),
        currentItem: String(form.get("currentItem") ?? ""),
        currentFarm: String(form.get("currentFarm") ?? ""),
      }),
      ariaSession: parseSessionFromForm(form),
    };
  }

  try {
    const body = (await request.json()) as {
      question?: string;
      currentLsind?: string;
      currentItem?: string;
      currentFarm?: string;
      withTts?: boolean;
      ariaSession?: unknown;
    };
    return {
      mode: "text",
      question: typeof body.question === "string" ? body.question : null,
      audio: null,
      audioFilename: "question.webm",
      durationSec: 0,
      withTts: Boolean(body.withTts),
      currentFarm: parseCurrentFarm(body),
      ariaSession: body.ariaSession
        ? parseAriaSession(body.ariaSession)
        : null,
    };
  } catch {
    return { parseError: true };
  }
}

/**
 * 텍스트 또는 음성 질문 → ARIA 프로토콜(또는 레거시 요약) (+선택 TTS).
 */
export async function POST(request: Request) {
  if (!voiceReportEnabled()) {
    return err(503, "disabled", "음성 AI 리포팅이 비활성화되어 있습니다.");
  }

  const user = await getCurrentUser();
  if (!user) {
    return err(401, "unauthorized", "로그인이 필요합니다.");
  }
  if (!user.hasAccess) {
    return err(403, "no_access", "조회 권한이 없습니다.");
  }

  const usage = getVoiceUsage(user.id);
  const rate = checkVoiceRateLimit(user.id);
  if (!rate.ok) {
    return err(
      429,
      rate.reason,
      rate.reason === "cooldown"
        ? "잠시 후 다시 질문해 주세요."
        : "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.",
      usage,
    );
  }

  const parsed = await parseAskRequest(request);
  if ("parseError" in parsed) {
    return err(400, "invalid_body", "잘못된 요청 본문입니다.", usage);
  }

  const { currentFarm, withTts } = parsed;
  if (!currentFarm) {
    return err(
      400,
      "farm_unresolved",
      "현재 농장 정보(currentFarm)가 필요합니다.",
      usage,
    );
  }

  const useOpenAI = openaiConfigured();
  let mode: VoiceAskMode = parsed.mode;
  let question = "";
  let sttSec = 0;

  if (parsed.audio) {
    if (parsed.audio.size > VOICE_LIMITS.maxUploadBytes()) {
      return err(
        400,
        "upload_too_large",
        "녹음 파일이 너무 큽니다. 더 짧게 말해 주세요.",
        usage,
      );
    }
    const dur =
      parsed.durationSec > 0
        ? parsed.durationSec
        : Math.max(1, parsed.audio.size / 16_000);
    if (dur > VOICE_LIMITS.maxRecordSec() + 1) {
      return err(
        400,
        "record_too_long",
        `질문은 ${VOICE_LIMITS.maxRecordSec()}초 이내로 말해 주세요.`,
        usage,
      );
    }
    if (dur < VOICE_LIMITS.minRecordSec()) {
      return err(400, "question_empty", "녹음이 너무 짧습니다.", usage);
    }
    if (!useOpenAI) {
      return err(
        503,
        "openai_error",
        "음성 인식에는 OPENAI_API_KEY가 필요합니다. 텍스트로 질문해 주세요.",
        usage,
      );
    }
    sttSec = dur;
    try {
      question = await transcribeAudioWithOpenAI(
        parsed.audio,
        parsed.audioFilename,
      );
    } catch (e) {
      console.error("[voice-report] stt", e);
      return err(
        502,
        "openai_error",
        "음성 인식에 실패했습니다. 다시 말하거나 텍스트로 질문해 주세요.",
        usage,
      );
    }
    mode = "audio";
  } else {
    const rawQ = parsed.question ?? "";
    question = truncateChars(rawQ, VOICE_LIMITS.maxQuestionChars());
    if (!question) {
      return err(400, "question_empty", "질문을 입력하거나 말해 주세요.", usage);
    }
    if (rawQ.trim().length > VOICE_LIMITS.maxQuestionChars()) {
      return err(
        400,
        "question_too_long",
        `질문은 ${VOICE_LIMITS.maxQuestionChars()}자 이내로 해 주세요.`,
        usage,
      );
    }
  }

  if (!question) {
    return err(400, "question_empty", "질문을 인식하지 못했습니다.", usage);
  }

  const { farmKey } = resolveFarmFromQuestion(question, currentFarm);
  if (!canReadFarm(user, farmKey)) {
    return err(
      403,
      "farm_denied",
      "해당 농장 조회 권한이 없습니다.",
      usage,
    );
  }

  markVoiceRequest(user.id);

  const useProtocol = ariaProtocolV1Enabled();
  const ariaSessionIn = parsed.ariaSession;
  const routeHint = useProtocol ? routeByRules(question) : null;

  let facts = null as Awaited<ReturnType<typeof buildFarmFacts>> | null;
  if (!useProtocol || routeHint !== "CHAT") {
    try {
      facts = await buildFarmFacts(farmKey);
    } catch (e) {
      console.error("[voice-report] facts", e);
      return err(
        500,
        "openai_error",
        "농장 데이터를 불러오지 못했습니다.",
        usage,
      );
    }
  }

  const factsJson = facts ? factsToPromptJson(facts) : "";
  const maxAnswer = VOICE_LIMITS.maxAnswerChars();
  const promptChars = question.length + factsJson.length + 400;
  const wantTts = withTts && useOpenAI;

  const est = estimateAskCostUsd({
    sttSec,
    promptChars,
    answerChars: maxAnswer,
    withTts: wantTts,
  });

  if (useOpenAI || sttSec > 0) {
    const afford = canAffordVoiceRequest(user.id, Math.max(est, 0.0001));
    if (!afford.ok) {
      return err(
        429,
        afford.reason,
        afford.reason === "monthly_cap"
          ? "이번 달 AI 음성 한도에 도달했습니다."
          : "요청당 비용 한도를 초과합니다.",
        getVoiceUsage(user.id),
      );
    }
  }

  let text: string;
  let source: VoiceAskSuccess["source"];
  let ariaSessionOut: VoiceAskSuccess["ariaSession"];
  let ariaRoute: VoiceAskSuccess["ariaRoute"];
  const farmKeyOut = facts?.farmKey ?? farmKey;
  const farmLabelOut = facts?.farmLabel ?? farmShortLabel(farmKey);

  try {
    if (useProtocol) {
      const result = await runAriaProtocol({
        question,
        facts,
        session: ariaSessionIn,
        useOpenAI,
        route: routeHint ?? undefined,
      });
      text = result.text;
      source = result.source;
      ariaSessionOut = result.session;
      ariaRoute = result.route;
    } else if (useOpenAI && facts) {
      text = await summarizeFarmWithOpenAI(question, facts, factsJson);
      source = "openai";
      ariaSessionOut = undefined;
      ariaRoute = undefined;
    } else if (facts) {
      text = buildTemplateSummary(facts, maxAnswer);
      source = "template";
      ariaSessionOut = undefined;
      ariaRoute = undefined;
    } else {
      return err(500, "openai_error", "농장 데이터를 불러오지 못했습니다.", usage);
    }
  } catch (e) {
    console.error("[voice-report] summarize", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.startsWith("openai_quota")) {
      return err(
        502,
        "openai_error",
        "OpenAI 할당량(quota)이 부족합니다. 플랫폼 결제·한도를 확인해 주세요.",
        getVoiceUsage(user.id),
      );
    }
    return err(
      502,
      "openai_error",
      "요약 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      getVoiceUsage(user.id),
    );
  }

  let audioBase64: string | null = null;
  let audioMimeType: string | null = null;
  let ttsOk = false;
  let ttsSkipped: VoiceAskSuccess["ttsSkipped"] = null;

  if (withTts && !useOpenAI) {
    ttsSkipped = "openai_missing";
  } else if (wantTts) {
    try {
      const speech = await synthesizeSpeechWithOpenAI(text);
      audioBase64 = speech.base64;
      audioMimeType = speech.mimeType;
      ttsOk = true;
    } catch (e) {
      console.error("[voice-report] tts", e);
      ttsSkipped = "tts_failed";
    }
  }

  const cost =
    useOpenAI || sttSec > 0
      ? estimateAskCostUsd({
          sttSec,
          promptChars,
          answerChars: text.length,
          withTts: ttsOk,
        })
      : 0;

  const nextUsage =
    cost > 0 ? recordVoiceSpend(user.id, cost) : getVoiceUsage(user.id);

  if (useProtocol && ariaRoute && ariaSessionOut) {
    void recordAriaTurnLog({
      userId: user.id,
      farmKey: farmKeyOut,
      question,
      route: ariaRoute,
      depth: ariaRoute === "FARM" ? ariaSessionOut.depth : null,
      source,
      sessionIn: ariaSessionIn,
      sessionOut: ariaSessionOut,
      answer: text,
      protocolV1: true,
    });
  }

  const extras = buildDelinAnswerExtras({
    route: ariaRoute ?? null,
    facts: facts ?? null,
    focusStallType: ariaSessionOut?.focusStallType,
    focusStallNo: ariaSessionOut?.focusStallNo,
  });

  const ok: VoiceAskSuccess = {
    ok: true,
    text,
    question,
    farmKey: farmKeyOut,
    farmLabel: farmLabelOut,
    source,
    mode,
    usage: nextUsage,
    estimatedCostUsd: cost,
    audioBase64,
    audioMimeType,
    ttsSkipped,
    ariaSession: ariaSessionOut,
    ariaRoute,
    evidenceChips: extras.evidenceChips,
    chartHandoff: extras.chartHandoff,
  };
  return NextResponse.json(ok);
}
