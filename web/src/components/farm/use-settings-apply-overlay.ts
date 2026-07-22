"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ThermoCommand } from "@/lib/data/commands";
import { commandStatusLabel } from "@/lib/controllers/controller-settings";
import type { CommandPipelineFlash } from "@/components/controllers/use-command-pipeline-tracker";
import type { CommandPipelineOverlayState } from "@/components/farm/command-pipeline-overlay";
import {
  pipelineDetailMessage,
  pipelineStatusDetail,
} from "@/lib/ui/controller-labels";

type Args = {
  isSaving: boolean;
  command: ThermoCommand | null;
  liveConfirmed: boolean;
  flash: CommandPipelineFlash | null;
  panelError: string | null;
  isCommandOverlayDismissed: (commandId: string | undefined) => boolean;
  onAcknowledgeCommandOverlay?: (commandId: string) => void;
  isUserInitiatedCommand: (commandId: string | undefined) => boolean;
};

export function useSettingsApplyOverlay({
  isSaving,
  command,
  liveConfirmed,
  flash,
  panelError,
  isCommandOverlayDismissed,
  onAcknowledgeCommandOverlay,
  isUserInitiatedCommand,
}: Args) {
  const [dismissed, setDismissed] = useState(false);
  const [alarmSavedFlash, setAlarmSavedFlash] = useState(false);
  const prevSavingRef = useRef(isSaving);
  const commandIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (command?.id && command.id !== commandIdRef.current) {
      commandIdRef.current = command.id;
      if (isUserInitiatedCommand(command.id)) {
        setDismissed(false);
      }
    }
  }, [command?.id, isUserInitiatedCommand]);

  useEffect(() => {
    const wasSaving = prevSavingRef.current;
    prevSavingRef.current = isSaving;
    if (wasSaving && !isSaving && !command) {
      setAlarmSavedFlash(true);
      const t = window.setTimeout(() => setAlarmSavedFlash(false), 2800);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [isSaving, command]);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setAlarmSavedFlash(false);
    if (command?.id) {
      onAcknowledgeCommandOverlay?.(command.id);
    }
  }, [command?.id, onAcknowledgeCommandOverlay]);

  const overlay = useMemo((): CommandPipelineOverlayState => {
    if (isSaving) {
      return {
        visible: true,
        phase: "loading",
        title: "적용 중…",
        detail: "설정을 저장하고 있습니다.",
        autoDismiss: false,
      };
    }

    if (dismissed || isCommandOverlayDismissed(command?.id)) {
      return { visible: false, phase: "info", title: "", autoDismiss: true };
    }

    if (panelError) {
      return {
        visible: true,
        phase: "error",
        title: "적용 실패",
        detail: panelError,
        autoDismiss: true,
      };
    }

    if (liveConfirmed && isUserInitiatedCommand(command?.id)) {
      const setpoint =
        command?.setpointTemp != null ? `${command.setpointTemp}℃` : null;
      return {
        visible: true,
        phase: "success",
        title: "현장 반영 완료",
        detail:
          flash?.text ??
          (setpoint
            ? `LIVE 설정온도 ${setpoint}가 명령과 일치합니다. 패널의 현재값을 확인하세요.`
            : "LIVE 설정값이 명령과 일치합니다. 패널의 현재값을 확인하세요."),
        autoDismiss: true,
        /** 성공 체감용 — 탭으로 언제든 닫기 가능 */
        autoDismissMs: 6500,
      };
    }

    if (alarmSavedFlash) {
      return {
        visible: true,
        phase: "success",
        title: "저장 완료",
        detail: "알람·설정이 적용되었습니다.",
        autoDismiss: true,
        autoDismissMs: 4000,
      };
    }

    if (command?.status === "failed" && isUserInitiatedCommand(command.id)) {
      return {
        visible: true,
        phase: "error",
        title: commandStatusLabel(command.status),
        detail: pipelineDetailMessage(command.status, command.errorMsg),
        autoDismiss: true,
      };
    }

    // 이력에 남은 pending/sent/applied는 오버레이 금지 — 이번 세션 적용(registerCommand)만
    if (
      command &&
      isUserInitiatedCommand(command.id) &&
      (command.status === "pending" || command.status === "sent")
    ) {
      return {
        visible: true,
        phase: "info",
        title: commandStatusLabel(command.status),
        detail: pipelineStatusDetail(
          command.status,
          command.errorMsg,
          liveConfirmed,
        ),
        autoDismiss: false,
      };
    }

    if (
      command?.status === "applied" &&
      !liveConfirmed &&
      isUserInitiatedCommand(command.id)
    ) {
      return {
        visible: true,
        phase: "info",
        title: commandStatusLabel(command.status),
        detail: pipelineStatusDetail(
          command.status,
          command.errorMsg,
          liveConfirmed,
        ),
        autoDismiss: false,
      };
    }

    if (flash) {
      const isLiveConfirmFlash =
        flash.tone === "ok" &&
        (flash.text.includes("현장 반영") ||
          flash.text.includes("LIVE 설정온도") ||
          flash.text.includes("LIVE 설정값이 명령과 일치"));
      if (
        isLiveConfirmFlash &&
        (!isUserInitiatedCommand(command?.id) ||
          dismissed ||
          isCommandOverlayDismissed(command?.id))
      ) {
        return { visible: false, phase: "info", title: "", autoDismiss: true };
      }
      return {
        visible: true,
        phase:
          flash.tone === "error"
            ? "error"
            : flash.tone === "ok"
              ? "success"
              : "info",
        title: command ? commandStatusLabel(command.status) : "상태",
        detail: flash.text,
        autoDismiss: flash.tone !== "info",
      };
    }

    return { visible: false, phase: "info", title: "", autoDismiss: true };
  }, [
    alarmSavedFlash,
    command,
    dismissed,
    flash,
    isCommandOverlayDismissed,
    isSaving,
    isUserInitiatedCommand,
    liveConfirmed,
    panelError,
  ]);

  return { overlay, dismiss };
}
