"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Bot, Loader2, Mic, Square, Volume2, X } from "lucide-react";
import type { FarmKey } from "@/lib/data/farm-key";
import { farmKeyId } from "@/lib/data/farm-key";
import type {
  VoiceAskError,
  VoiceAskSuccess,
  VoiceUsageSnapshot,
} from "@/lib/voice-report/types";
import { cn } from "@/lib/utils";

const MAX_RECORD_SEC = 15;
const MIN_RECORD_SEC = 0.8;
const emptySubscribe = () => () => {};

type Props = {
  currentFarm: FarmKey;
  /** 모바일 — 하단 탭 위에 fixed */
  compact?: boolean;
  className?: string;
};

type Status =
  | "idle"
  | "recording"
  | "uploading"
  | "analyzing"
  | "speaking"
  | "error";

/**
 * 차트 뷰 우측 하단 AI 패널 — 마이크 STT + TTS + 텍스트 폴백.
 */
export function VoiceReportFab({ currentFarm, compact = false, className }: Props) {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const [usage, setUsage] = useState<VoiceUsageSnapshot | null>(null);
  const [status, setStatus] = useState<Status>("idle");
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
        setMeta(
          `${data.farmLabel} · ${data.source === "openai" ? "AI 요약" : "템플릿"} · ${data.mode === "audio" ? "음성" : "텍스트"}${data.audioBase64 ? " · TTS" : ""}`,
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
      clearAudioUrl,
      currentFarm.itemCode,
      currentFarm.lsindRegistNo,
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
      setStatus("recording");

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
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
      data-tour-id="voice-report-fab"
    >
      {open ? (
        <div
          className={cn(
            "pointer-events-auto w-[min(100vw-1.5rem,20rem)] rounded-xl border border-border/80",
            "bg-popover/95 p-3 shadow-lg backdrop-blur-sm",
          )}
          role="dialog"
          aria-label="농장 음성 AI 요약"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">농장 AI 요약</p>
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
            기준 {farmKeyId(currentFarm)} · “FARM02 …”로 다른 농장 질문 가능
          </p>

          <div className="mb-2 flex gap-1.5">
            {status === "recording" ? (
              <button
                type="button"
                onClick={stopRecording}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg",
                  "bg-destructive px-2 py-2 text-xs font-medium text-destructive-foreground",
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
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg",
                  "bg-primary px-2 py-2 text-xs font-medium text-primary-foreground",
                  "disabled:opacity-50",
                )}
              >
                {status === "uploading" ||
                status === "analyzing" ||
                status === "speaking" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Mic className="size-3.5" />
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

          <label className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <input
              type="checkbox"
              checked={ttsEnabled}
              disabled={busy}
              onChange={(e) => {
                const on = e.target.checked;
                setTtsEnabled(on);
                /* 사용자 제스처에서 오디오 언락 — 이후 자동재생 성공률↑ */
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
            음성으로 읽어주기 (TTS)
          </label>

          <div className="mb-2 flex gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void runSoundCheck()}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border/80",
                "bg-background px-2 py-1.5 text-[10px] font-medium disabled:opacity-50",
              )}
            >
              <Volume2 className="size-3" />
              사운드 체크
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runMicTest()}
              className={cn(
                "inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border/80",
                "bg-background px-2 py-1.5 text-[10px] font-medium disabled:opacity-50",
              )}
            >
              <Mic className="size-3" />
              {micTesting ? "테스트 중…" : "마이크 테스트"}
            </button>
          </div>
          {micTesting ? (
            <div
              className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-[width] duration-motion-fast"
                style={{ width: `${micLevel}%` }}
              />
            </div>
          ) : null}
          {soundBlocked ? (
            <button
              type="button"
              className="mb-2 inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-2 py-1.5 text-[10px] font-medium text-primary-foreground"
              onClick={() => void runSoundCheck()}
            >
              <Volume2 className="size-3" />
              비프 다시 재생
            </button>
          ) : null}
          {deviceMsg ? (
            <p className="mb-2 text-[10px] text-muted-foreground" role="status">
              {deviceMsg}
            </p>
          ) : null}

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={2}
            maxLength={200}
            disabled={busy}
            className={cn(
              "mb-2 w-full resize-none rounded-lg border border-border/70 bg-background px-2 py-1.5",
              "text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            placeholder="또는 텍스트: 오늘 농장 상황 어때?"
          />
          <button
            type="button"
            disabled={busy || !question.trim()}
            onClick={() => void submitAsk({ text: question })}
            className={cn(
              "mb-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg",
              "border border-border/80 bg-background px-2 py-1.5 text-xs font-medium",
              "disabled:opacity-50",
            )}
          >
            텍스트로 요약
          </button>

          {error ? (
            <p className="text-[11px] text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {ttsHint ? (
            <p className="mb-2 text-[11px] text-amber-700 dark:text-amber-300" role="status">
              {ttsHint}
            </p>
          ) : null}
          {answer ? (
            <div className="mt-1 rounded-lg bg-muted/50 p-2">
              {meta ? (
                <p className="mb-1 text-[10px] text-muted-foreground">{meta}</p>
              ) : null}
              <p className="text-xs leading-relaxed text-foreground">{answer}</p>
              {audioUrl ? (
                <button
                  type="button"
                  className={cn(
                    "mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-medium",
                    needsTapToPlay
                      ? "bg-primary text-primary-foreground"
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
            </div>
          ) : null}
          {usage ? (
            <p className="mt-2 text-[10px] text-muted-foreground">
              이번 달 추정 ${usage.spentUsd.toFixed(3)} / ${usage.softCapUsd}
              {usage.softWarn ? " · 한도 주의" : ""}
            </p>
          ) : null}
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
        aria-label={open ? "AI 패널 닫기" : "농장 AI 요약 열기"}
        aria-expanded={open}
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
