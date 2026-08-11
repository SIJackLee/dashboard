"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Bot, ChevronDown, Loader2, Mic, Square, Volume2, X } from "lucide-react";
import type { FarmKey } from "@/lib/data/farm-key";
import { farmShortLabel } from "@/lib/data/farm-summaries";
import { DELIN_NAME, type VoiceReportStatus } from "@/lib/aria/aria-mode";
import type {
  VoiceAskError,
  VoiceAskSuccess,
  VoiceUsageSnapshot,
} from "@/lib/voice-report/types";
import {
  applyFarmChartScopeParams,
  applyFarmChartZoomParams,
} from "@/lib/farm/farm-chart-scope";
import {
  applyChartViewParams,
  currentFarmSearchParams,
  replaceFarmUrlShallow,
  requestFarmHubViewResync,
} from "@/lib/farm/farm-view-url";
import {
  zoomHintFromDelinHandoff,
  type DelinChartHandoff,
} from "@/lib/voice-report/delin-chart-handoff";
import { motionClass } from "@/lib/ui/motion-classes";
import { dashboardAriaShell } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";

const MAX_RECORD_SEC = 15;
const MIN_RECORD_SEC = 0.8;
const emptySubscribe = () => () => {};

/** U1 — 첫 화면 CTA 보조. 프로토콜 트리거와 맞춘 짧은 칩 */
const DELIN_SUGGESTION_CHIPS = [
  { label: "농장 어때?", ask: "오늘 농장 상황 어때?" },
  { label: "위험만", ask: "위험만 알려줘" },
  { label: "환기는?", ask: "환기는 어떻게 하면 돼?" },
] as const;

type Props = {
  currentFarm: FarmKey;
  /** 모바일 — 하단 탭 위에 fixed (fab 레이아웃만) */
  compact?: boolean;
  /** fab: 플로팅 버튼 · dock: ARIA 하단 도크 (FAB 없음) */
  layout?: "fab" | "dock";
  /** fab 레이아웃 — 진입 시 패널 펼침 */
  defaultOpen?: boolean;
  /**
   * true — 도크/패널 안 답변 카드·차트 CTA 숨김
   * (스테이지 AriaAnswerStage가 결과면 소유)
   */
  suppressAnswerSurface?: boolean;
  onStatusChange?: (
    status: VoiceReportStatus,
    meta: { micTesting: boolean },
  ) => void;
  /** 0~100 — 녹음·마이크 테스트 RMS */
  onMicLevelChange?: (levelPct: number) => void;
  /** 차트 딥링크 CTA 직후 (모바일 시트 닫기 등) */
  onChartHandoffComplete?: () => void;
  /** 스테이지 결과면 — 답변 extras */
  onAnswerReady?: (payload: {
    text: string;
    evidenceChips: string[];
    chartHandoff: NonNullable<VoiceAskSuccess["chartHandoff"]> | null;
  }) => void;
  className?: string;
};

/**
 * ARIA / 음성 AI — fab(플로팅) 또는 dock(하단 도크).
 */
export function VoiceReportFab({
  currentFarm,
  compact = false,
  layout = "fab",
  defaultOpen = false,
  suppressAnswerSurface = false,
  onStatusChange,
  onMicLevelChange,
  onChartHandoffComplete,
  onAnswerReady,
  className,
}: Props) {
  const isDock = layout === "dock";
  const [open, setOpen] = useState(defaultOpen || isDock);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const [evidenceChips, setEvidenceChips] = useState<string[]>([]);
  const [chartHandoff, setChartHandoff] = useState<
    NonNullable<VoiceAskSuccess["chartHandoff"]> | null
  >(null);
  const [usage, setUsage] = useState<VoiceUsageSnapshot | null>(null);
  const [status, setStatus] = useState<VoiceReportStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [recordSec, setRecordSec] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [needsTapToPlay, setNeedsTapToPlay] = useState(false);
  const [ttsHint, setTtsHint] = useState<string | null>(null);
  const [deviceMsg, setDeviceMsg] = useState<string | null>(null);
  const [micLevel, setMicLevel] = useState(0);
  const [micTesting, setMicTesting] = useState(false);
  const [soundBlocked, setSoundBlocked] = useState(false);
  const [deviceToolsOpen, setDeviceToolsOpen] = useState(false);
  const [textAskOpen, setTextAskOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [ariaSession, setAriaSession] = useState<
    VoiceAskSuccess["ariaSession"] | null
  >(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const micTestCleanupRef = useRef<(() => void) | null>(null);
  const beepCtxRef = useRef<AudioContext | null>(null);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  /** compact는 overflow/transform 조상에서 잘리므로 모바일 프레임(또는 body) 포털 */
  const portalEl =
    compact && mounted
      ? (document.querySelector("[data-mobile-preview-frame]") ?? document.body)
      : null;
  const portalToBody = portalEl === document.body;

  const busy =
    status === "recording" ||
    status === "uploading" ||
    status === "analyzing" ||
    status === "speaking" ||
    micTesting;

  const clearAudioUrl = useCallback(() => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current = null;
    }
  }, []);

  const stopMicTest = useCallback(() => {
    micTestCleanupRef.current?.();
    micTestCleanupRef.current = null;
    setMicTesting(false);
    setMicLevel(0);
  }, []);

  useEffect(() => {
    return () => {
      if (tickRef.current != null) window.clearInterval(tickRef.current);
      if (stopTimerRef.current != null) window.clearTimeout(stopTimerRef.current);
      mediaRef.current?.stop();
      micTestCleanupRef.current?.();
      void beepCtxRef.current?.close();
      clearAudioUrl();
    };
  }, [clearAudioUrl]);

  useEffect(() => {
    onStatusChange?.(status, { micTesting });
  }, [status, micTesting, onStatusChange]);

  useEffect(() => {
    onMicLevelChange?.(micLevel);
  }, [micLevel, onMicLevelChange]);

  /** 스피커/자동재생 경로 점검 — Web Audio 비프 (로컬, 과금 없음) */
  const runSoundCheck = useCallback(async () => {
    setDeviceMsg(null);
    setSoundBlocked(false);
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) {
        setDeviceMsg("이 브라우저는 오디오 재생을 지원하지 않습니다.");
        return;
      }
      const ctx = beepCtxRef.current ?? new AC();
      beepCtxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t0 = ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      osc.start(t0);
      osc.stop(t0 + 0.3);
      setDeviceMsg("사운드 체크 OK — 비프가 들리면 스피커 정상입니다.");
    } catch {
      setSoundBlocked(true);
      setDeviceMsg(
        "자동 재생이 차단되었습니다. 아래 「비프 다시 재생」을 탭해 주세요.",
      );
    }
  }, []);

  /** 마이크 권한·입력 레벨·짧은 녹음 재생 (로컬, 과금 없음) */
  const runMicTest = useCallback(async () => {
    if (busy) return;
    stopMicTest();
    setDeviceMsg(null);
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setDeviceMsg("이 브라우저는 마이크를 지원하지 않습니다.");
      return;
    }

    setMicTesting(true);
    setDeviceMsg("마이크 권한을 요청합니다…");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      let raf = 0;
      const tickLevel = () => {
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i]!;
        setMicLevel(Math.min(100, Math.round((sum / data.length / 255) * 140)));
        raf = requestAnimationFrame(tickLevel);
      };
      raf = requestAnimationFrame(tickLevel);

      const chunks: Blob[] = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);

      const cleanup = () => {
        cancelAnimationFrame(raf);
        if (rec.state !== "inactive") {
          try {
            rec.stop();
          } catch {
            /* ignore */
          }
        }
        stream.getTracks().forEach((t) => t.stop());
        void audioCtx.close();
        setMicLevel(0);
      };
      micTestCleanupRef.current = cleanup;

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        cancelAnimationFrame(raf);
        stream.getTracks().forEach((t) => t.stop());
        void audioCtx.close();
        setMicTesting(false);
        setMicLevel(0);
        micTestCleanupRef.current = null;
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (blob.size < 80) {
          setDeviceMsg(
            "마이크 입력이 거의 없습니다. 권한·음소거·다른 앱 점유를 확인해 주세요.",
          );
          return;
        }
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        void audio
          .play()
          .then(() => {
            setDeviceMsg(
              "마이크 테스트 OK — 방금 녹음이 재생되면 입력·재생 모두 정상입니다.",
            );
          })
          .catch(() => {
            setDeviceMsg(
              "녹음은 됐지만 재생이 차단되었습니다. 볼륨·자동재생 설정을 확인해 주세요.",
            );
          })
          .finally(() => {
            window.setTimeout(() => URL.revokeObjectURL(url), 4000);
          });
      };

      setDeviceMsg("2초간 말해 보세요…");
      rec.start(100);
      window.setTimeout(() => {
        if (rec.state !== "inactive") rec.stop();
      }, 2000);
    } catch {
      setMicTesting(false);
      setDeviceMsg(
        "마이크 권한이 필요합니다. 브라우저 주소창에서 마이크를 허용해 주세요.",
      );
    }
  }, [busy, stopMicTest]);

  const playBase64 = useCallback(
    async (base64: string, mimeType: string) => {
      clearAudioUrl();
      setNeedsTapToPlay(false);
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: mimeType || "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      setAudioUrl(url);
      const audio = new Audio(url);
      audioElRef.current = audio;
      setStatus("speaking");
      try {
        await audio.play();
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
        });
      } catch {
        /* fetch 이후 모바일 자동재생 차단 → 탭하여 듣기 */
        setNeedsTapToPlay(true);
      } finally {
        setStatus("idle");
      }
    },
    [clearAudioUrl],
  );

  const submitAsk = useCallback(
    async (opts: { text?: string; audio?: Blob; durationSec?: number }) => {
      setError(null);
      setAnswer(null);
      setMeta(null);
      setEvidenceChips([]);
      setChartHandoff(null);
      setTtsHint(null);
      setNeedsTapToPlay(false);
      clearAudioUrl();
      setStatus(opts.audio ? "uploading" : "analyzing");

      try {
        let res: Response;
        if (opts.audio) {
          const form = new FormData();
          form.append("audio", opts.audio, "question.webm");
          form.append("currentLsind", currentFarm.lsindRegistNo);
          form.append("currentItem", currentFarm.itemCode);
          form.append("durationSec", String(opts.durationSec ?? 0));
          form.append("withTts", ttsEnabled ? "1" : "0");
          if (ariaSession) {
            form.append("ariaSession", JSON.stringify(ariaSession));
          }
          res = await fetch("/api/voice-report/ask", {
            method: "POST",
            body: form,
          });
        } else {
          const q = (opts.text ?? "").trim();
          if (!q) {
            setError("질문을 입력하거나 말해 주세요.");
            setStatus("error");
            return;
          }
          setStatus("analyzing");
          res = await fetch("/api/voice-report/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              question: q,
              currentLsind: currentFarm.lsindRegistNo,
              currentItem: currentFarm.itemCode,
              withTts: ttsEnabled,
              ariaSession: ariaSession ?? undefined,
            }),
          });
        }

        const data = (await res.json()) as VoiceAskSuccess | VoiceAskError;
        if (!data.ok) {
          setError(data.message);
          if (data.usage) setUsage(data.usage);
          setStatus("error");
          return;
        }

        if (data.question) setQuestion(data.question);
        setAnswer(data.text);
        setUsage(data.usage);
        setEvidenceChips(data.evidenceChips ?? []);
        setChartHandoff(data.chartHandoff ?? null);
        onAnswerReady?.({
          text: data.text,
          evidenceChips: data.evidenceChips ?? [],
          chartHandoff: data.chartHandoff ?? null,
        });
        if (data.ariaSession) setAriaSession(data.ariaSession);
        const sourceLabel =
          data.source === "protocol" || data.source === "protocol_heuristic"
            ? "프로토콜"
            : data.source === "chat"
              ? "대화"
              : data.source === "openai"
                ? "AI 요약"
                : "템플릿";
        const routeLabel = data.ariaRoute ? ` · ${data.ariaRoute}` : "";
        setMeta(
          `${data.farmLabel} · ${sourceLabel}${routeLabel}${data.audioBase64 ? " · TTS" : ""}`,
        );

        if (data.audioBase64) {
          await playBase64(
            data.audioBase64,
            data.audioMimeType ?? "audio/mpeg",
          );
        } else {
          setStatus("idle");
          if (ttsEnabled) {
            if (data.ttsSkipped === "openai_missing") {
              setTtsHint(
                "OPENAI_API_KEY가 없어 템플릿 요약만 반환되었습니다. TTS를 쓰려면 배포 환경변수에 키를 넣어 주세요.",
              );
            } else if (data.ttsSkipped === "tts_failed") {
              setTtsHint(
                "음성 생성에 실패했습니다. OpenAI TTS 할당량·키를 확인해 주세요.",
              );
            } else {
              setTtsHint("음성이 포함되지 않았습니다.");
            }
          }
        }
      } catch {
        setError("요청에 실패했습니다.");
        setStatus("error");
      }
    },
    [
      ariaSession,
      clearAudioUrl,
      currentFarm.itemCode,
      currentFarm.lsindRegistNo,
      onAnswerReady,
      playBase64,
      ttsEnabled,
    ],
  );

  const stopRecording = useCallback(() => {
    const rec = mediaRef.current;
    if (!rec || rec.state === "inactive") return;
    rec.stop();
  }, []);

  const startRecording = useCallback(async () => {
    if (busy) return;
    setError(null);
    setAnswer(null);
    clearAudioUrl();

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("이 브라우저는 마이크를 지원하지 않습니다.");
      setStatus("error");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      mediaRef.current = rec;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setRecordSec(0);
      setMicLevel(0);
      setStatus("recording");

      const audioCtx = new (
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext
      )();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const freq = new Uint8Array(analyser.frequencyBinCount);
      let levelRaf = 0;
      const tickLevel = () => {
        analyser.getByteFrequencyData(freq);
        let sum = 0;
        for (let i = 0; i < freq.length; i++) sum += freq[i]!;
        setMicLevel(
          Math.min(100, Math.round((sum / freq.length / 255) * 140)),
        );
        levelRaf = requestAnimationFrame(tickLevel);
      };
      levelRaf = requestAnimationFrame(tickLevel);

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        cancelAnimationFrame(levelRaf);
        void audioCtx.close();
        setMicLevel(0);
        stream.getTracks().forEach((t) => t.stop());
        if (tickRef.current != null) {
          window.clearInterval(tickRef.current);
          tickRef.current = null;
        }
        if (stopTimerRef.current != null) {
          window.clearTimeout(stopTimerRef.current);
          stopTimerRef.current = null;
        }
        mediaRef.current = null;
        const elapsed = (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        if (elapsed < MIN_RECORD_SEC || blob.size < 200) {
          setError("녹음이 너무 짧습니다. 다시 말해 주세요.");
          setStatus("error");
          return;
        }
        void submitAsk({ audio: blob, durationSec: elapsed });
      };

      rec.start(200);
      tickRef.current = window.setInterval(() => {
        setRecordSec(
          Math.min(
            MAX_RECORD_SEC,
            (Date.now() - startedAtRef.current) / 1000,
          ),
        );
      }, 200);
      stopTimerRef.current = window.setTimeout(() => {
        stopRecording();
      }, MAX_RECORD_SEC * 1000);
    } catch {
      setError("마이크 권한이 필요합니다. 브라우저에서 허용해 주세요.");
      setStatus("error");
    }
  }, [busy, clearAudioUrl, stopRecording, submitAsk]);

  const statusLabel =
    status === "recording"
      ? `듣는 중… ${recordSec.toFixed(1)}s / ${MAX_RECORD_SEC}s`
      : status === "uploading"
        ? "음성 업로드 중…"
        : status === "analyzing"
          ? "분석 중…"
          : status === "speaking"
            ? "읽는 중…"
            : null;

  const openChartHandoff = useCallback(
    (handoff: DelinChartHandoff) => {
      const params = new URLSearchParams(currentFarmSearchParams().toString());
      applyChartViewParams(params);
      applyFarmChartScopeParams(params, handoff.scope);
      applyFarmChartZoomParams(params, zoomHintFromDelinHandoff(handoff));
      replaceFarmUrlShallow(params);
      requestFarmHubViewResync();
      onChartHandoffComplete?.();
    },
    [onChartHandoffComplete],
  );

  const showSuggestionChips =
    !busy &&
    !micTesting &&
    (status === "idle" || status === "error" || status === "speaking");

  const panelControls = (
    <>
      {showSuggestionChips && isDock ? (
        <div
          className="mb-2 flex flex-wrap justify-center gap-1.5"
          role="group"
          aria-label="추천 질문"
        >
          {DELIN_SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={busy}
              onClick={() => {
                setQuestion(chip.ask);
                void submitAsk({ text: chip.ask });
              }}
              className={cn(
                "rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1",
                "text-[11px] font-medium text-foreground/90",
                "hover:border-primary/40 hover:bg-primary/10",
                "disabled:opacity-50",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className={cn("mb-2 flex gap-1.5", isDock && "mb-3")}>
        {status === "recording" ? (
          <button
            type="button"
            onClick={stopRecording}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl",
              "bg-destructive px-3 py-2.5 text-sm font-medium text-destructive-foreground",
              isDock && "py-3",
            )}
          >
            <Square className="size-3.5 fill-current" />
            중지 · 분석
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void startRecording()}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl",
              "bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground",
              "disabled:opacity-50",
              isDock && "py-3.5 text-base shadow-sm",
            )}
          >
            {status === "uploading" ||
            status === "analyzing" ||
            status === "speaking" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Mic className={cn("size-4", isDock && "size-5")} />
            )}
            말하기
          </button>
        )}
      </div>

      {statusLabel ? (
        <p className="mb-2 text-[11px] text-muted-foreground" aria-live="polite">
          {statusLabel}
        </p>
      ) : null}

      {status === "recording" || micTesting ? (
        <div
          className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-motion-fast"
            style={{ width: `${micLevel}%` }}
          />
        </div>
      ) : null}

      {showSuggestionChips && !isDock ? (
        <div
          className="mb-2 flex flex-wrap justify-center gap-1.5"
          role="group"
          aria-label="추천 질문"
        >
          {DELIN_SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={busy}
              onClick={() => {
                setQuestion(chip.ask);
                void submitAsk({ text: chip.ask });
              }}
              className={cn(
                "rounded-full border border-primary/25 bg-primary/5 px-2.5 py-1",
                "text-[11px] font-medium text-foreground/90",
                "hover:border-primary/40 hover:bg-primary/10",
                "disabled:opacity-50",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mb-2">
        <button
          type="button"
          disabled={busy}
          aria-expanded={textAskOpen}
          onClick={() => setTextAskOpen((v) => !v)}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1 rounded-lg px-2 py-1.5",
            "text-[11px] font-medium text-muted-foreground",
            "hover:bg-muted/40 hover:text-foreground",
            "disabled:opacity-50",
            textAskOpen && "bg-muted/30 text-foreground",
          )}
          data-testid="delin-text-ask-toggle"
        >
          글로 묻기
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform duration-motion-fast",
              textAskOpen && "rotate-180",
            )}
          />
        </button>
        {textAskOpen ? (
          <div className="mt-2 space-y-2">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={isDock ? 2 : 2}
              maxLength={200}
              disabled={busy}
              autoFocus
              className={cn(
                "w-full resize-none rounded-lg border border-border/70 bg-background px-2 py-1.5",
                "text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              placeholder="질문을 입력하세요…"
              aria-label="텍스트 질문"
            />
            <button
              type="button"
              disabled={busy || !question.trim()}
              onClick={() => void submitAsk({ text: question })}
              className={cn(
                "inline-flex w-full items-center justify-center gap-1.5 rounded-lg",
                "bg-secondary px-2 py-2 text-xs font-medium text-secondary-foreground",
                "disabled:opacity-50",
              )}
            >
              보내기
            </button>
          </div>
        ) : null}
      </div>

      <div className="mb-1 border-t border-border/30 pt-1.5">
        <button
          type="button"
          disabled={busy && !micTesting}
          aria-expanded={optionsOpen || deviceToolsOpen || soundBlocked || micTesting}
          onClick={() => setOptionsOpen((v) => !v)}
          className={cn(
            "inline-flex w-full items-center justify-center gap-1 rounded-md px-1 py-0.5",
            "text-[10px] text-muted-foreground/60 hover:text-muted-foreground/90",
            "disabled:opacity-50",
          )}
          data-testid="delin-options-toggle"
        >
          옵션
          <ChevronDown
            className={cn(
              "size-3 shrink-0 transition-transform duration-motion-fast",
              (optionsOpen || deviceToolsOpen || soundBlocked || micTesting) &&
                "rotate-180",
            )}
          />
        </button>

        {optionsOpen || deviceToolsOpen || soundBlocked || micTesting ? (
          <div className="mt-1.5 space-y-2 px-0.5">
            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80">
              <input
                type="checkbox"
                checked={ttsEnabled}
                disabled={busy}
                onChange={(e) => {
                  const on = e.target.checked;
                  setTtsEnabled(on);
                  if (on && typeof Audio !== "undefined") {
                    try {
                      const unlock = new Audio(
                        "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=",
                      );
                      void unlock.play().then(() => {
                        unlock.pause();
                      });
                    } catch {
                      /* ignore */
                    }
                  }
                }}
                className="size-3"
              />
              읽어주기
            </label>

            <div>
              <button
                type="button"
                disabled={busy && !micTesting}
                aria-expanded={deviceToolsOpen || soundBlocked || micTesting}
                onClick={() => setDeviceToolsOpen((v) => !v)}
                className={cn(
                  "inline-flex w-full items-center justify-between gap-1 rounded-lg px-0.5 py-0.5",
                  "text-[10px] text-muted-foreground/70 hover:text-muted-foreground",
                  "disabled:opacity-50",
                )}
              >
                <span>장치 테스트</span>
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 transition-transform duration-motion-fast",
                    (deviceToolsOpen || soundBlocked || micTesting) &&
                      "rotate-180",
                  )}
                />
              </button>

              {deviceToolsOpen || soundBlocked || micTesting ? (
                <div className="mt-1.5 space-y-1.5 rounded-lg border border-border/40 bg-muted/10 p-2">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void runSoundCheck()}
                      className={cn(
                        "inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border/70",
                        "bg-background px-2 py-1.5 text-[10px] font-medium disabled:opacity-50",
                      )}
                    >
                      <Volume2 className="size-3" />
                      사운드
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setDeviceToolsOpen(true);
                        void runMicTest();
                      }}
                      className={cn(
                        "inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border/70",
                        "bg-background px-2 py-1.5 text-[10px] font-medium disabled:opacity-50",
                      )}
                    >
                      <Mic className="size-3" />
                      {micTesting ? "테스트 중…" : "마이크"}
                    </button>
                  </div>
                  {soundBlocked ? (
                    <button
                      type="button"
                      className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-[10px] font-medium text-primary-foreground"
                      onClick={() => void runSoundCheck()}
                    >
                      <Volume2 className="size-3" />
                      비프 다시 재생
                    </button>
                  ) : null}
                  {deviceMsg ? (
                    <p className="text-[10px] text-muted-foreground" role="status">
                      {deviceMsg}
                    </p>
                  ) : null}
                </div>
              ) : deviceMsg ? (
                <p className="mt-1 text-[10px] text-muted-foreground" role="status">
                  {deviceMsg}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <p
          className={cn("mt-2 text-[11px] text-destructive", motionClass.ariaReplyIn)}
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {ttsHint ? (
        <p
          className={cn(
            "mb-2 mt-2 text-[11px] text-amber-700 dark:text-amber-300",
            motionClass.ariaReplyIn,
          )}
          role="status"
        >
          {ttsHint}
        </p>
      ) : null}
      {answer && !suppressAnswerSurface ? (
        <div
          key={answer.slice(0, 48)}
          className={cn(
            "mt-2 max-h-[min(40vh,16rem)] overflow-y-auto rounded-xl border border-primary/20 bg-card/80 p-3",
            motionClass.ariaReplyIn,
          )}
          data-testid="delin-answer-card"
        >
          <p className="text-sm leading-relaxed text-foreground">{answer}</p>
          {evidenceChips.length > 0 ? (
            <div
              className="mt-2 flex flex-wrap gap-1"
              aria-label="답변 근거"
            >
              {evidenceChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  {chip}
                </span>
              ))}
            </div>
          ) : null}
          {chartHandoff ? (
            <button
              type="button"
              className={cn(
                "mt-2.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg",
                "bg-primary px-2.5 py-2 text-xs font-medium text-primary-foreground",
              )}
              onClick={() => openChartHandoff(chartHandoff)}
            >
              {chartHandoff.ctaLabel}
            </button>
          ) : null}
          {audioUrl ? (
            <button
              type="button"
              className={cn(
                "mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium",
                needsTapToPlay
                  ? "border border-primary/30 text-primary"
                  : "text-primary",
              )}
              onClick={() => {
                const a = new Audio(audioUrl);
                setNeedsTapToPlay(false);
                void a.play();
              }}
            >
              <Volume2 className="size-3.5" />
              {needsTapToPlay ? "탭하여 듣기" : "다시 듣기"}
            </button>
          ) : null}
          {meta ? (
            <p className="mt-2 text-[10px] text-muted-foreground/80">{meta}</p>
          ) : null}
        </div>
      ) : null}
      {usage ? (
        <p className="mt-2 text-[10px] text-muted-foreground">
          이번 달 추정 ${usage.spentUsd.toFixed(3)} / ${usage.softCapUsd}
          {usage.softWarn ? " · 한도 주의" : ""}
        </p>
      ) : null}
    </>
  );

  if (isDock) {
    return (
      <div
        className={cn(
          "pointer-events-auto w-full max-w-lg",
          dashboardAriaShell.dock,
          motionClass.ariaDockIn,
          className,
        )}
        data-testid="voice-report-dock"
        role="region"
        aria-label={`${DELIN_NAME} 입력`}
      >
        {panelControls}
      </div>
    );
  }

  const fab = (
    <div
      className={cn(
        "pointer-events-none z-50 flex flex-col items-end gap-2",
        compact
          ? portalToBody
            ? "fixed bottom-[4.75rem] right-3"
            : "absolute bottom-[4.75rem] right-3"
          : "absolute bottom-3 right-3",
        className,
      )}
      data-testid="voice-report-fab"
    >
      {open ? (
        <div
          className={cn(
            "pointer-events-auto w-[min(100vw-1.5rem,20rem)] rounded-xl border border-border/80",
            "bg-popover/95 p-3 shadow-lg backdrop-blur-sm",
            motionClass.ariaPanelIn,
          )}
          role="dialog"
          aria-label={`${DELIN_NAME} 음성 AI`}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">{DELIN_NAME}</p>
            <button
              type="button"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="닫기"
              disabled={status === "recording"}
              onClick={() => {
                if (status === "recording") stopRecording();
                setOpen(false);
              }}
            >
              <X className="size-3.5" />
            </button>
          </div>
          <p className="mb-2 text-[10px] text-muted-foreground">
            기준 {farmShortLabel(currentFarm)} · 말로 다른 농장도 질문 가능
          </p>
          {panelControls}
        </div>
      ) : null}

      <button
        type="button"
        className={cn(
          "pointer-events-auto inline-flex size-11 items-center justify-center rounded-full",
          "border border-border/80 bg-primary text-primary-foreground shadow-md",
          "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          status === "recording" && "animate-pulse bg-destructive",
        )}
        aria-label={open ? `${DELIN_NAME} 패널 닫기` : `${DELIN_NAME} 열기`}
        aria-expanded={open}
        data-tour-id="delin-voice-fab"
        onClick={() => setOpen((v) => !v)}
      >
        <Bot className="size-5" />
      </button>
    </div>
  );

  if (compact) {
    if (!portalEl) return null;
    return createPortal(fab, portalEl);
  }
  return fab;
}
