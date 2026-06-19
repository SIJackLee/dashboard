"use client";



import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { useRouter } from "next/navigation";

import { sendThermoCommandAction } from "@/app/(dashboard)/controllers/actions";

import type { ControllerReading } from "@/lib/data/iot";

import {

  clampMenuValue,

  EDIT_START_DRAFT,

  MENU_STEPS,

  PANEL_MENU_ITEMS,

  type PanelMenuId,

} from "@/lib/controllers/controller-panel-map";

import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { ChannelSlot } from "@/lib/data/iot-channel";

import { formatUserError } from "@/lib/ui/controller-labels";



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

  value: number

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



export function useControllerPanel(

  target: ControllerReading | undefined,

  knownSettings: ControllerThermoSettings | null,

  canCommand: boolean,

  activeChannel?: ChannelSlot,

  channelEqpmnCode?: string

) {

  const router = useRouter();

  const [pending, startTransition] = useTransition();

  const [activeMenu, setActiveMenu] = useState<PanelMenuId>("setpoint");

  const [draft, setDraft] = useState<PanelDraft | null>(null);

  const [hasEdited, setHasEdited] = useState(false);

  const [message, setMessage] = useState<{

    tone: "ok" | "error";

    text: string;

  } | null>(null);



  const hasEditedRef = useRef(hasEdited);

  hasEditedRef.current = hasEdited;



  const settingsKnown = knownSettings != null;

  const targetKey = target?.key;

  const channelKey = activeChannel ?? "";

  /** 컨트롤러·채널 전환 시 편집 상태 초기화 */
  useEffect(() => {
    setHasEdited(false);
    setMessage(null);
    if (knownSettings) {
      setDraft(draftFromSettings(knownSettings));
    } else {
      setDraft(null);
    }
  }, [targetKey, channelKey]);



  /**

   * 폴링·LIVE 갱신 시: 편집 중이면 draft 유지, baseline(currentValues)만 갱신.

   * 편집 중이 아니면 서버 설정값으로 draft 동기화.

   * 채널 전환은 위 effect가 처리 — channelKey는 deps에 넣지 않음.

   */

  useEffect(() => {

    if (!targetKey) return;



    if (!knownSettings) {

      setDraft((prev) => (hasEditedRef.current ? prev : null));

      return;

    }



    setDraft((prev) => {

      if (hasEditedRef.current && prev) return prev;

      return draftFromSettings(knownSettings);

    });

  }, [knownSettings, targetKey]);



  const ensureDraft = useCallback((): PanelDraft => {

    if (draft) return draft;

    const start = knownSettings

      ? draftFromSettings(knownSettings)

      : EDIT_START_DRAFT;

    setDraft(start);

    setHasEdited(true);

    return start;

  }, [draft, knownSettings]);



  const resolveDraftBase = useCallback((): PanelDraft => {

    if (draft) return draft;

    if (knownSettings) return draftFromSettings(knownSettings);

    return EDIT_START_DRAFT;

  }, [draft, knownSettings]);



  const setField = useCallback(

    (menu: PanelMenuId, raw: number) => {

      const clamped = clampMenuValue(menu, raw);

      setDraft((prev) => {

        const base = prev ?? resolveDraftBase();

        return setDraftField(base, menu, clamped);

      });

      setHasEdited(true);

    },

    [resolveDraftBase]

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

    [resolveDraftBase]

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

    [resolveDraftBase]

  );



  const adjust = useCallback(

    (direction: 1 | -1, menu?: PanelMenuId) => {

      const targetMenu = menu ?? activeMenu;

      const cfg = MENU_STEPS[targetMenu];

      const base = ensureDraft();

      const current = getDraftField(base, targetMenu);

      const next = clampMenuValue(

        targetMenu,

        current + direction * cfg.step

      );

      setDraft((prev) => setDraftField(prev ?? base, targetMenu, next));

      setHasEdited(true);

    },

    [activeMenu, ensureDraft]

  );



  const applyDefaults = useCallback(() => {
    setDraft({ ...EDIT_START_DRAFT });
    setHasEdited(true);
    setMessage(null);
  }, []);

  const save = useCallback(() => {
    if (!target) {
      setMessage({ tone: "error", text: "대상 컨트롤러를 선택하세요." });
      return;
    }

    if (!canCommand) {

      setMessage({ tone: "error", text: "명령 권한이 없습니다." });

      return;

    }

    const values = draft ?? (knownSettings ? draftFromSettings(knownSettings) : null);

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



    startTransition(async () => {

      const result = await sendThermoCommandAction(formData);

      if (result.ok) {

        setMessage({

          tone: "ok",

          text: "명령이 등록되었습니다. 하단 상태 배너에서 전송·적용을 확인하세요.",

        });

        setHasEdited(false);

        router.refresh();

      } else {

        setMessage({ tone: "error", text: formatUserError(result.error) });

      }

    });

  }, [activeChannel, canCommand, channelEqpmnCode, draft, knownSettings, router, target]);



  const displayValue = useMemo(() => {

    if (!draft && !knownSettings) return null;

    const d = draft ?? (knownSettings ? draftFromSettings(knownSettings) : null);

    if (!d) return null;

    return getDraftField(d, activeMenu);

  }, [activeMenu, draft, knownSettings]);



  const displayCfg = MENU_STEPS[activeMenu];



  const fieldValues = useMemo((): Record<PanelMenuId, number> | null => {

    const d =

      draft ??

      (knownSettings ? draftFromSettings(knownSettings) : null);

    if (!d) return null;

    return {

      setpoint: d.setpointTemp,

      deviation: d.tempDeviation,

      minVent: d.minVentPct,

      maxVent: d.maxVentPct,

    };

  }, [draft, knownSettings]);



  /** 슬라이더·스와이프 UI용 수치 (미확인 시 편집 시작값) */

  const sliderValues = useMemo((): Record<PanelMenuId, number> => {

    const d = draft ?? (knownSettings ? draftFromSettings(knownSettings) : null);

    if (d) {

      return {

        setpoint: d.setpointTemp,

        deviation: d.tempDeviation,

        minVent: d.minVentPct,

        maxVent: d.maxVentPct,

      };

    }

    return {

      setpoint: EDIT_START_DRAFT.setpointTemp,

      deviation: EDIT_START_DRAFT.tempDeviation,

      minVent: EDIT_START_DRAFT.minVentPct,

      maxVent: EDIT_START_DRAFT.maxVentPct,

    };

  }, [draft, knownSettings]);



  /** 장치·LIVE 기준 현재 설정 (편집 전 baseline — 폴링 시 갱신) */

  const currentValues = useMemo((): Record<PanelMenuId, number> | null => {

    if (!knownSettings) return null;

    return {

      setpoint: knownSettings.setpointTemp,

      deviation: knownSettings.tempDeviation,

      minVent: knownSettings.minVentPct,

      maxVent: knownSettings.maxVentPct,

    };

  }, [knownSettings]);



  const isFieldChanged = useCallback(

    (menu: PanelMenuId): boolean => {

      if (!currentValues) return hasEdited;

      return sliderValues[menu] !== currentValues[menu];

    },

    [currentValues, hasEdited, sliderValues]

  );



  const hasChanges = useMemo(() => {

    if (!currentValues) return hasEdited;

    return PANEL_MENU_ITEMS.some(

      (item) => sliderValues[item.id] !== currentValues[item.id]

    );

  }, [currentValues, hasEdited, sliderValues]);



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


