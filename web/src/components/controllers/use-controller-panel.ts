"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendThermoCommandAction } from "@/app/(dashboard)/controllers/actions";
import type { ControllerReading } from "@/lib/data/iot";
import {
  clampMenuValue,
  EDIT_START_DRAFT,
  MENU_STEPS,
  type PanelMenuId,
} from "@/lib/controllers/controller-panel-map";
import {
  thermoValuesMatch,
  type ControllerThermoSettings,
} from "@/lib/controllers/controller-settings";
import type { ChannelSlot } from "@/lib/data/iot-channel";
import { formatUserError } from "@/lib/ui/controller-labels";

type ThermoValues = Pick<
  ControllerThermoSettings,
  "setpointTemp" | "tempDeviation" | "minVentPct" | "maxVentPct"
>;

export type PanelDraft = {
  setpointTemp: number;
  tempDeviation: number;
  minVentPct: number;
  maxVentPct: number;
};

function draftFromSettings(s: ControllerThermoSettings): PanelDraft {
  return {
    setpointTemp: s.setpointTemp,
    tempDeviation: s.tempDeviation,
    minVentPct: s.minVentPct,
    maxVentPct: s.maxVentPct,
  };
}

function getDraftField(draft: PanelDraft, menu: PanelMenuId): number {
  switch (menu) {
    case "setpoint":
      return draft.setpointTemp;
    case "deviation":
      return draft.tempDeviation;
    case "minVent":
      return draft.minVentPct;
    case "maxVent":
      return draft.maxVentPct;
  }
}

function setDraftField(
  draft: PanelDraft,
  menu: PanelMenuId,
  value: number,
): PanelDraft {
  switch (menu) {
    case "setpoint":
      return { ...draft, setpointTemp: value };
    case "deviation":
      return { ...draft, tempDeviation: value };
    case "minVent":
      return { ...draft, minVentPct: value };
    case "maxVent":
      return { ...draft, maxVentPct: value };
  }
}

function draftsEqual(a: PanelDraft | null, b: PanelDraft | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.setpointTemp === b.setpointTemp &&
    a.tempDeviation === b.tempDeviation &&
    a.minVentPct === b.minVentPct &&
    a.maxVentPct === b.maxVentPct
  );
}

function settingsSyncKey(s: ControllerThermoSettings | null): string {
  if (!s) return "";
  return [
    s.setpointTemp,
    s.tempDeviation,
    s.minVentPct,
    s.maxVentPct,
    s.source ?? "",
  ].join(":");
}

function panelDraftOrNull(
  draft: PanelDraft | null,
  knownSettings: ControllerThermoSettings | null,
): PanelDraft | null {
  if (draft) return draft;
  return knownSettings ? draftFromSettings(knownSettings) : null;
}

function panelDraftOrDefault(
  draft: PanelDraft | null,
  knownSettings: ControllerThermoSettings | null,
): PanelDraft {
  return panelDraftOrNull(draft, knownSettings) ?? EDIT_START_DRAFT;
}

function panelDraftToFields(d: PanelDraft): Record<PanelMenuId, number> {
  return {
    setpoint: d.setpointTemp,
    deviation: d.tempDeviation,
    minVent: d.minVentPct,
    maxVent: d.maxVentPct,
  };
}

function draftToThermo(d: PanelDraft): ThermoValues {
  return {
    setpointTemp: d.setpointTemp,
    tempDeviation: d.tempDeviation,
    minVentPct: d.minVentPct,
    maxVentPct: d.maxVentPct,
  };
}

function fieldsToThermo(
  f: Record<PanelMenuId, number>,
): ThermoValues {
  return {
    setpointTemp: f.setpoint,
    tempDeviation: f.deviation,
    minVentPct: f.minVent,
    maxVentPct: f.maxVent,
  };
}

function thermoToFields(t: ThermoValues): Record<PanelMenuId, number> {
  return {
    setpoint: t.setpointTemp,
    deviation: t.tempDeviation,
    minVent: t.minVentPct,
    maxVent: t.maxVentPct,
  };
}

export function useControllerPanel(
  target: ControllerReading | undefined,
  knownSettings: ControllerThermoSettings | null,
  canCommand: boolean,
  activeChannel?: ChannelSlot,
  channelEqpmnCode?: string,
  onCommandRegistered?: (command: import("@/lib/data/commands").ThermoCommand) => void,
  /** LIVE 디코드 설정 — dirty/「현재」표시 기준 (낙관 knownSettings와 분리) */
  liveBaseline?: ThermoValues | null,
) {
  const [pending, setPending] = useState(false);
  const [activeMenu, setActiveMenu] = useState<PanelMenuId>("setpoint");
  const [draft, setDraft] = useState<PanelDraft | null>(null);
  const [hasEdited, setHasEdited] = useState(false);
  /** Apply 성공 직후 dirty 기준 — LIVE 반영 전 동일값 재전송 방지 */
  const [saveBaseline, setSaveBaseline] = useState<PanelDraft | null>(null);
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);

  const hasEditedRef = useRef(hasEdited);
  const knownSettingsRef = useRef(knownSettings);
  useEffect(() => {
    hasEditedRef.current = hasEdited;
  });
  useEffect(() => {
    knownSettingsRef.current = knownSettings;
  });

  const settingsKnown = knownSettings != null;
  const targetKey = target?.key;
  const channelKey = activeChannel ?? "";
  const settingsKey = settingsSyncKey(knownSettings);
  const panelIdentity = `${targetKey ?? ""}|${channelKey}`;
  const [prevPanelIdentity, setPrevPanelIdentity] = useState(panelIdentity);

  /** 컨트롤러·채널 전환 시 편집 상태 초기화 */
  if (panelIdentity !== prevPanelIdentity) {
    setPrevPanelIdentity(panelIdentity);
    setHasEdited(false);
    setSaveBaseline(null);
    setMessage(null);
    setDraft(knownSettings ? draftFromSettings(knownSettings) : null);
  }

  /** LIVE가 제출값과 일치하면 saveBaseline 해제 → 이후 dirty는 LIVE 기준 */
  if (
    saveBaseline &&
    liveBaseline &&
    thermoValuesMatch(draftToThermo(saveBaseline), liveBaseline)
  ) {
    setSaveBaseline(null);
  }

  /**
   * 폴링·LIVE 갱신 시: 편집 중이면 draft 유지.
   * 편집 중이 아니면 서버 설정값으로 draft 동기화.
   * settingsKey(값)만 dep — 참조만 바뀌는 knownSettings로 무한 setState/레이스 방지.
   */
  useEffect(() => {
    if (!targetKey) return;
    const s = knownSettingsRef.current;
    if (!s) {
      setDraft((prev) => (hasEditedRef.current ? prev : null));
      return;
    }
    const next = draftFromSettings(s);
    setDraft((prev) => {
      if (hasEditedRef.current && prev) return prev;
      return draftsEqual(prev, next) ? prev : next;
    });
  }, [settingsKey, targetKey]);

  const ensureDraft = useCallback((): PanelDraft => {
    if (draft) return draft;
    const start = panelDraftOrDefault(draft, knownSettings);
    setDraft(start);
    setHasEdited(true);
    return start;
  }, [draft, knownSettings]);

  const resolveDraftBase = useCallback(
    (): PanelDraft => panelDraftOrDefault(draft, knownSettings),
    [draft, knownSettings],
  );

  const setField = useCallback(
    (menu: PanelMenuId, raw: number) => {
      const clamped = clampMenuValue(menu, raw);
      setDraft((prev) => {
        const base = prev ?? resolveDraftBase();
        return setDraftField(base, menu, clamped);
      });
      setHasEdited(true);
    },
    [resolveDraftBase],
  );

  const setTempControl = useCallback(
    (setpointTemp: number, tempDeviation: number) => {
      setDraft((prev) => {
        const base = prev ?? resolveDraftBase();
        return {
          ...base,
          setpointTemp: clampMenuValue("setpoint", setpointTemp),
          tempDeviation: clampMenuValue("deviation", tempDeviation),
        };
      });
      setHasEdited(true);
    },
    [resolveDraftBase],
  );

  const setVentRange = useCallback(
    (minVentPct: number, maxVentPct: number) => {
      setDraft((prev) => {
        const base = prev ?? resolveDraftBase();
        let min = clampMenuValue("minVent", minVentPct);
        let max = clampMenuValue("maxVent", maxVentPct);
        if (min > max) [min, max] = [max, min];
        return { ...base, minVentPct: min, maxVentPct: max };
      });
      setHasEdited(true);
    },
    [resolveDraftBase],
  );

  const adjust = useCallback(
    (direction: 1 | -1, menu?: PanelMenuId) => {
      const targetMenu = menu ?? activeMenu;
      const cfg = MENU_STEPS[targetMenu];
      const base = ensureDraft();
      const current = getDraftField(base, targetMenu);
      const next = clampMenuValue(
        targetMenu,
        current + direction * cfg.step,
      );
      setDraft((prev) => setDraftField(prev ?? base, targetMenu, next));
      setHasEdited(true);
    },
    [activeMenu, ensureDraft],
  );

  const applyDefaults = useCallback(() => {
    setDraft({ ...EDIT_START_DRAFT });
    setHasEdited(true);
    setMessage(null);
  }, []);

  const save = useCallback(() => {
    if (pending) return;
    if (!target) {
      setMessage({ tone: "error", text: "대상 컨트롤러를 선택하세요." });
      return;
    }
    if (!canCommand) {
      setMessage({ tone: "error", text: "명령 권한이 없습니다." });
      return;
    }

    const values = panelDraftOrNull(draft, knownSettings);
    if (!values) {
      setMessage({
        tone: "error",
        text: "설정값을 올림·내림으로 입력한 뒤 저장하세요.",
      });
      return;
    }
    if (values.minVentPct > values.maxVentPct) {
      setMessage({ tone: "error", text: "최저 환기는 최고 환기 이하여야 합니다." });
      return;
    }

    setMessage(null);
    const formData = new FormData();
    formData.set("lsind_regist_no", target.farmKey.lsindRegistNo);
    formData.set("item_code", target.farmKey.itemCode);
    formData.set("module_uid", String(target.moduleUid));
    formData.set("stall_ty_code", target.stallTyCode ?? "SP01");
    formData.set("stall_no", target.stallNo ?? "01");
    formData.set("eqpmn_no", target.eqpmnNo);
    formData.set("min_vent_pct", String(values.minVentPct));
    formData.set("max_vent_pct", String(values.maxVentPct));
    formData.set("setpoint_temp", String(values.setpointTemp));
    formData.set("temp_deviation", String(values.tempDeviation));
    if (activeChannel && channelEqpmnCode) {
      formData.set("channel", activeChannel);
      formData.set("eqpmn_code", channelEqpmnCode);
    }

    const NETWORK_ERROR_TEXT =
      "네트워크 오류입니다. 연결을 확인한 뒤 다시 시도하세요.";
    const SAVE_TIMEOUT_MS = 8_000;

    setPending(true);
    void (async () => {
      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          setMessage({ tone: "error", text: NETWORK_ERROR_TEXT });
          return;
        }
        const result = await Promise.race([
          sendThermoCommandAction(formData),
          new Promise<never>((_, reject) => {
            window.setTimeout(
              () => reject(new Error("network_timeout")),
              SAVE_TIMEOUT_MS,
            );
          }),
        ]);
        if (result.ok) {
          onCommandRegistered?.(result.command);
          setSaveBaseline({ ...values });
          setHasEdited(false);
        } else {
          setMessage({ tone: "error", text: formatUserError(result.error) });
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err ?? "");
        const networkLike =
          /network_timeout|Failed to fetch|NetworkError|Load failed|fetch/i.test(
            raw,
          ) ||
          (typeof navigator !== "undefined" && navigator.onLine === false);
        setMessage({
          tone: "error",
          text: networkLike ? NETWORK_ERROR_TEXT : formatUserError(raw || "unknown"),
        });
      } finally {
        setPending(false);
      }
    })();
  }, [
    activeChannel,
    canCommand,
    channelEqpmnCode,
    draft,
    knownSettings,
    onCommandRegistered,
    pending,
    target,
  ]);

  const displayValue = useMemo(() => {
    const d = panelDraftOrNull(draft, knownSettings);
    return d ? getDraftField(d, activeMenu) : null;
  }, [activeMenu, draft, knownSettings]);

  const displayCfg = MENU_STEPS[activeMenu];

  const fieldValues = useMemo((): Record<PanelMenuId, number> | null => {
    const d = panelDraftOrNull(draft, knownSettings);
    return d ? panelDraftToFields(d) : null;
  }, [draft, knownSettings]);

  /** 슬라이더·스와이프 UI용 수치 (미확인 시 편집 시작값) */
  const sliderValues = useMemo(
    (): Record<PanelMenuId, number> =>
      panelDraftToFields(panelDraftOrDefault(draft, knownSettings)),
    [draft, knownSettings],
  );

  /**
   * 「현재」표시 — 적용·명령값(knownSettings) 우선.
   * 통신 연결 시 명령은 곧 컨트롤러에 전달된다는 신뢰 모델 (LIVE/ACK 대기 불필요).
   */
  const currentValues = useMemo((): Record<PanelMenuId, number> | null => {
    if (knownSettings) return panelDraftToFields(draftFromSettings(knownSettings));
    if (liveBaseline) return thermoToFields(liveBaseline);
    return null;
  }, [knownSettings, liveBaseline]);

  /**
   * dirty 기준 — 방금 제출한 값 > 명령/낙관 knownSettings > LIVE.
   */
  const dirtyBaseline = useMemo((): Record<PanelMenuId, number> | null => {
    if (saveBaseline) return panelDraftToFields(saveBaseline);
    if (knownSettings) return panelDraftToFields(draftFromSettings(knownSettings));
    if (liveBaseline) return thermoToFields(liveBaseline);
    return null;
  }, [saveBaseline, knownSettings, liveBaseline]);

  const isFieldChanged = useCallback(
    (menu: PanelMenuId): boolean => {
      if (!dirtyBaseline) return hasEdited;
      const a = sliderValues[menu];
      const b = dirtyBaseline[menu];
      if (menu === "setpoint" || menu === "deviation") {
        return Math.abs(a - b) > 0.05;
      }
      return a !== b;
    },
    [dirtyBaseline, hasEdited, sliderValues],
  );

  const hasChanges = useMemo(() => {
    if (!hasEdited && !dirtyBaseline) return false;
    if (!dirtyBaseline) return hasEdited;
    return !thermoValuesMatch(
      fieldsToThermo(sliderValues),
      fieldsToThermo(dirtyBaseline),
    );
  }, [dirtyBaseline, hasEdited, sliderValues]);

  return {
    activeMenu,
    setActiveMenu,
    displayValue,
    displayCfg,
    fieldValues,
    sliderValues,
    currentValues,
    isFieldChanged,
    hasChanges,
    setField,
    setTempControl,
    setVentRange,
    adjust,
    applyDefaults,
    save,
    pending,
    message,
    canCommand,
    settingsKnown,
    settingsSource: knownSettings?.source ?? null,
    hasEdited,
  };
}
