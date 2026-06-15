import type { ControllerThermoSettings } from "@/lib/controllers/controller-settings";
import type { ThermoCommand } from "@/lib/data/commands";
import type { FarmKey } from "@/lib/data/farm-key";
import { getItemCodeName } from "@/lib/data/item-code";
import { normalizeStallTyCode } from "@/lib/data/stall-type";

import { dashboardUi } from "@/lib/ui/dashboard-page-ui";

/** 슬라이더 카드 — 값/비교 영역 고정 높이 (드래그 시 레이아웃 점프 방지) */
export const SLIDER_VALUE_SLOT_MIN_H = dashboardUi.valueSlotMinH;

export function settingsSourceLabel(
  source: ControllerThermoSettings["source"]
): string {
  switch (source) {
    case "live":
      return "장치 실측값";
    case "applied":
      return "설정 적용 완료";
    case "sent":
      return "전송됨 · 적용 확인 중";
    case "pending":
      return "명령 등록됨 · 전송 대기";
    default:
      return "설정값";
  }
}

export function pipelineDetailMessage(
  status: ThermoCommand["status"],
  errorMsg?: string | null
): string {
  switch (status) {
    case "applied":
      return "컨트롤러에 설정값이 반영되었습니다.";
    case "sent":
      return "통신모듈로 전송됨 · 장치 반영 확인 중";
    case "pending":
      return "명령을 등록했습니다 · 통신모듈 전송 대기 중";
    case "failed":
      return errorMsg
        ? formatUserError(errorMsg)
        : "명령 처리에 실패했습니다.";
    case "cancelled":
      return "명령이 취소되었습니다.";
    default:
      return "";
  }
}

export const UNKNOWN_SETTINGS_HINT =
  "컨트롤러 설정값을 아직 받지 못했습니다. 조정 후 저장하면 명령으로 등록됩니다.";

export const COMMAND_REGISTER_SUCCESS =
  "명령을 등록했습니다. 장치 전송을 기다리는 중입니다.";

export function formatUserError(error: string): string {
  if (error === "invalid_vent_range") {
    return "환기 범위를 확인하세요. (0~100%, 최저 ≤ 최고)";
  }
  if (error === "unauthorized") return "권한이 없습니다.";
  if (error.includes("row-level security")) {
    return "이 컨트롤러에 대한 명령 권한이 없습니다.";
  }
  return "요청을 처리하지 못했습니다. 관리자에게 문의하세요.";
}

export function isDevDiagnosticsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEV_DIAGNOSTICS === "1";
}

export function formatFarmItemLabel(
  farmKey: FarmKey,
  stallTyCode?: string | null
): string {
  const item = stallTyCode
    ? normalizeStallTyCode(stallTyCode)
    : getItemCodeName(farmKey.itemCode);
  return `${farmKey.lsindRegistNo} · ${item}`;
}

/** v0x0A 슬롯 라벨 — 축사 번호 + 장비 번호 */
export function formatControllerSlotLabel(opts: {
  stallNo?: string | null;
  eqpmnNo?: string;
  /** @deprecated legacy v0x09 */
  idx?: number;
}): string {
  const stall = opts.stallNo?.trim();
  const eq = opts.eqpmnNo?.trim();
  if (stall && eq) return `축사 ${stall} · ${eq}번`;
  if (eq) return `컨트롤러 ${eq}`;
  if (opts.idx !== undefined) return `컨트롤러 #${opts.idx + 1}`;
  return "컨트롤러";
}

/** 사용자 지정 이름 뒤에 붙일 짧은 슬롯 표기 (03·02) */
export function formatControllerSlotSuffix(opts: {
  stallNo?: string | null;
  eqpmnNo?: string;
}): string {
  const stall = opts.stallNo?.trim();
  const eq = opts.eqpmnNo?.trim();
  if (stall && eq) return ` (${stall}·${eq})`;
  if (eq) return ` (${eq}번)`;
  return "";
}

export function formatControllerRef(opts: {
  farmKey: FarmKey;
  eqpmnNo?: string;
  stallNo?: string | null;
  ctrlIdx?: number;
  stallTyCode?: string | null;
}): string {
  const base = formatFarmItemLabel(opts.farmKey, opts.stallTyCode);
  const slot = formatControllerSlotLabel({
    stallNo: opts.stallNo,
    eqpmnNo: opts.eqpmnNo,
    idx: opts.ctrlIdx,
  });
  return `${base} · ${slot}`;
}

export function formatCommandTarget(cmd: ThermoCommand): string {
  return formatControllerRef({
    farmKey: cmd.farmKey,
    stallTyCode: cmd.stallTyCode,
    stallNo: cmd.stallNo,
    eqpmnNo: cmd.eqpmnNo,
  });
}

export function replayPanelTitle(
  controllerKey: string,
  opts?: { stallNo?: string | null; eqpmnNo?: string }
): string {
  const label = opts?.eqpmnNo
    ? formatControllerSlotLabel({ stallNo: opts.stallNo, eqpmnNo: opts.eqpmnNo })
    : controllerKey;
  return `연결 복구 이력 — ${label}`;
}

export const REPLAY_PANEL_DESCRIPTION =
  "통신 재연결 시 백필된 온습도 샘플 · 자세한 기록은 설정 → 연결 복구";

export const REPLAY_EMPTY_HINT =
  "연결 복구 이력 없음 (통신 재연결 시 이전 구간 데이터가 채워집니다)";

export function liveSummaryBadge(wireVer?: number | null): string {
  return wireVer != null ? "LIVE 연결" : "LIVE";
}

export function liveControllerCountLabel(
  total: number,
  maxSlots: number
): string {
  return `${total}대 / 최대 ${maxSlots}대`;
}

export function chartLiveDescription(maxControllers: number): string {
  return `LIVE 컨트롤러 1~${maxControllers}`;
}

export function packetModeLabel(mode: string | null | undefined): string {
  if (!mode) return "--";
  if (mode.toLowerCase() === "live") return "실시간";
  if (mode.toLowerCase() === "replay") return "연결 복구";
  return mode;
}

export function wireDiagnosticsLine(
  wireVer: number,
  packetMode: string | null | undefined
): string {
  return `wire 0x${wireVer.toString(16)} · ${packetMode ?? "--"}`;
}

export function formatCommandDetail(
  errorMsg?: string | null,
  note?: string | null
): string {
  if (errorMsg) return formatUserError(errorMsg);
  if (note?.trim()) return note.trim();
  return "—";
}
