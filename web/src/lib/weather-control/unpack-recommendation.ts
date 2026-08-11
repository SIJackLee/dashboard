import { getStallTypeName } from "@/lib/data/stall-type";
import type {
  UnpackedWeatherNudge,
  WeatherNudgeView,
} from "@/lib/weather-control/weather-nudge-view";

function fmtTemp(c: number): string {
  return `${c.toFixed(1).replace(/\.0$/, "")}°C`;
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

function thermoLine(
  prefix: string,
  setpoint: number,
  minVent: number,
  maxVent: number,
): string {
  return `${prefix} — 목표 ${fmtTemp(setpoint)} · 최저환기 ${fmtPct(minVent)} · 최고환기 ${fmtPct(maxVent)}`;
}

function formatControllerDisplay(
  stallTyCode: string | undefined,
  stallNo: string | undefined,
  eqpmnNo: string | undefined,
  fallback: string,
): string {
  if (!stallTyCode) return fallback;
  const stallName = getStallTypeName(stallTyCode);
  const parts = [stallName];
  if (stallNo) parts.push(`${stallNo}번`);
  if (eqpmnNo) parts.push(`${eqpmnNo}번`);
  return parts.join(" ");
}

/** Parse "SP03 01번 06번" style controllerLabel from Phase B read helper. */
function parseControllerParts(label: string): {
  stallTyCode?: string;
  stallNo?: string;
  eqpmnNo?: string;
} {
  const m = label.match(/^(\S+)\s+(\d+)번(?:\s+(\d+)번)?$/);
  if (!m) return {};
  return {
    stallTyCode: m[1],
    stallNo: m[2],
    eqpmnNo: m[3],
  };
}

function headlineForRule(view: WeatherNudgeView): string {
  const f = view.reasonFacts;
  switch (view.ruleId) {
    case "wx_rise_vent": {
      const now = f.externalNow;
      const max = f.forecastMax3h;
      if (now != null && max != null) {
        return `앞으로 3시간 외기가 ${fmtTemp(now)}에서 ${fmtTemp(max)}로 오를 예정입니다.`;
      }
      break;
    }
    case "wx_drop_heat": {
      const now = f.externalNow;
      const min = f.forecastMin3h;
      if (now != null && min != null) {
        return `앞으로 3시간 외기가 ${fmtTemp(now)}에서 ${fmtTemp(min)}로 내려갈 예정입니다.`;
      }
      break;
    }
    case "wx_humid_vent": {
      const ext = f.externalHumidity;
      const int = f.internalHumidity;
      if (ext != null && int != null) {
        return `외기 습도 ${fmtPct(ext)}·축사 습도 ${fmtPct(int)}로 높습니다.`;
      }
      if (ext != null) {
        return `외기 습도 ${fmtPct(ext)}로 높습니다.`;
      }
      break;
    }
    default:
      break;
  }
  return view.reasonKo;
}

function contextLineForRule(view: WeatherNudgeView): string | null {
  const f = view.reasonFacts;
  const internal = f.internalTemp;
  const display =
    view.controllerDisplayName ||
    formatControllerDisplay(
      parseControllerParts(view.controllerLabel).stallTyCode,
      parseControllerParts(view.controllerLabel).stallNo,
      parseControllerParts(view.controllerLabel).eqpmnNo,
      view.controllerLabel,
    );

  if (internal != null) {
    return `${display} 컨트롤러 기준 내부 ${fmtTemp(internal)}입니다.`;
  }
  return `${display} 컨트롤러 기준입니다.`;
}

export function unpackWeatherNudge(view: WeatherNudgeView): UnpackedWeatherNudge {
  return {
    headline: headlineForRule(view),
    contextLine: contextLineForRule(view),
    currentLine: thermoLine(
      "현재",
      view.current.setpointTemp,
      view.current.minVentPct,
      view.current.maxVentPct,
    ),
    proposedLine: thermoLine(
      "권장",
      view.proposed.setpointTemp,
      view.proposed.minVentPct,
      view.proposed.maxVentPct,
    ),
    actionLine: view.reasonKo,
  };
}
