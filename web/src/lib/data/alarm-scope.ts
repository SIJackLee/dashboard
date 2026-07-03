import type { BarnReading } from "@/lib/data/iot";
import type { FarmKey } from "@/lib/data/farm-key";
import { farmKeyId } from "@/lib/data/farm-key";
import { farmShortLabelFromId } from "@/lib/data/farm-summaries";
import {
  stallKeyFromReading,
} from "@/lib/data/reading-hierarchy";
import { normalizeStallTyCode, formatStallTypeLabel } from "@/lib/data/stall-type";
import {
  DEFAULT_ALARM_THRESHOLDS,
  type AlarmSettings,
  type AlarmThresholds,
} from "@/lib/data/alarms";

export type AlarmScopeParts = {
  farmId: string;
  sp?: string;
  stall?: string;
  controllerKey?: string;
};

export function buildAlarmScopeKey(parts: AlarmScopeParts): string {
  const segments = [`farm:${parts.farmId}`];
  if (parts.sp) segments.push(`sp:${parts.sp}`);
  if (parts.stall) segments.push(`stall:${parts.stall}`);
  if (parts.controllerKey) {
    segments.push(`ctrl:${encodeURIComponent(parts.controllerKey)}`);
  }
  return segments.join("|");
}

export function parseAlarmScopeKey(key: string): AlarmScopeParts | null {
  if (!key.startsWith("farm:")) return null;
  const parts: AlarmScopeParts = { farmId: "" };
  for (const seg of key.split("|")) {
    if (seg.startsWith("farm:")) parts.farmId = seg.slice(5);
    else if (seg.startsWith("sp:")) parts.sp = seg.slice(3);
    else if (seg.startsWith("stall:")) parts.stall = seg.slice(6);
    else if (seg.startsWith("ctrl:")) {
      parts.controllerKey = decodeURIComponent(seg.slice(5));
    }
  }
  return parts.farmId ? parts : null;
}

export function scopeCandidatesForReading(r: BarnReading): string[] {
  const farmId = farmKeyId(r.farmKey);
  const sp = normalizeStallTyCode(r.stallTyCode);
  const stall = stallKeyFromReading(r);
  const keys: string[] = [];

  if (r.controllerKey) {
    keys.push(
      buildAlarmScopeKey({
        farmId,
        sp,
        stall,
        controllerKey: r.controllerKey,
      })
    );
  }
  keys.push(buildAlarmScopeKey({ farmId, sp, stall }));
  keys.push(buildAlarmScopeKey({ farmId, sp }));
  keys.push(buildAlarmScopeKey({ farmId }));
  return keys;
}

export function resolveThresholdsForReading(
  settings: AlarmSettings,
  r: BarnReading
): AlarmThresholds {
  for (const key of scopeCandidatesForReading(r)) {
    const hit = settings.byScope?.[key];
    if (hit) return hit;
  }

  const sp = normalizeStallTyCode(r.stallTyCode);
  if (sp !== "UNK" && settings.byStallTyCode[sp]) {
    return settings.byStallTyCode[sp];
  }

  return settings.global;
}

export function resolveThresholdsForScope(
  settings: AlarmSettings,
  scopeKey: string | null
): AlarmThresholds {
  if (!scopeKey) return settings.global;

  const parts = parseAlarmScopeKey(scopeKey);
  if (!parts) return settings.global;

  const chain: string[] = [];
  if (parts.controllerKey && parts.stall && parts.sp) {
    chain.push(
      buildAlarmScopeKey({
        farmId: parts.farmId,
        sp: parts.sp,
        stall: parts.stall,
        controllerKey: parts.controllerKey,
      })
    );
  }
  if (parts.stall && parts.sp) {
    chain.push(
      buildAlarmScopeKey({
        farmId: parts.farmId,
        sp: parts.sp,
        stall: parts.stall,
      })
    );
  }
  if (parts.sp) {
    chain.push(buildAlarmScopeKey({ farmId: parts.farmId, sp: parts.sp }));
  }
  chain.push(buildAlarmScopeKey({ farmId: parts.farmId }));

  for (const key of chain) {
    const hit = settings.byScope?.[key];
    if (hit) return hit;
  }

  if (parts.sp && settings.byStallTyCode[parts.sp]) {
    return settings.byStallTyCode[parts.sp];
  }

  return settings.global;
}

export function activeScopeKeyFromSelection(
  farmId: string,
  spCode: string,
  stallKey: string,
  controllerReadingKey: string,
  readings: BarnReading[]
): string | null {
  if (!farmId || !spCode) return null;

  if (controllerReadingKey) {
    const hit = readings.find((r) => r.key === controllerReadingKey);
    if (hit) {
      return buildAlarmScopeKey({
        farmId,
        sp: spCode,
        stall: stallKey || stallKeyFromReading(hit),
        controllerKey: hit.controllerKey,
      });
    }
  }

  if (stallKey) {
    return buildAlarmScopeKey({ farmId, sp: spCode, stall: stallKey });
  }

  return buildAlarmScopeKey({ farmId, sp: spCode });
}

export function describeAlarmScope(
  farmId: string,
  spCode: string,
  stallKey: string,
  controllerReadingKey: string,
  readings: BarnReading[]
): string {
  if (!farmId) return "농장을 선택하세요.";
  if (!spCode) return "축사유형을 선택하세요.";

  const farmLabel = farmShortLabelFromId(farmId);
  const spLabel = formatStallTypeLabel(spCode);
  if (!stallKey && !controllerReadingKey) {
    return `${farmLabel} · ${spLabel} — 축사유형 일괄 (해당 유형 전체 컨트롤러)`;
  }
  if (stallKey && !controllerReadingKey) {
    return `${farmLabel} · ${spLabel} · 축사 ${stallKey} — 축사 전체`;
  }
  const hit = readings.find((r) => r.key === controllerReadingKey);
  if (hit) {
    return `${farmLabel} · ${spLabel} · 축사 ${stallKey || stallKeyFromReading(hit)} · ${hit.label || hit.eqpmnNo}`;
  }
  return `${farmLabel} · ${spLabel}`;
}

export function filterReadingsForAlarmScope(
  readings: BarnReading[],
  farmId: string,
  spCode: string,
  stallKey: string,
  controllerReadingKey: string
): BarnReading[] {
  if (!farmId || !spCode) return [];

  return readings.filter((r) => {
    if (farmKeyId(r.farmKey) !== farmId) return false;
    if (normalizeStallTyCode(r.stallTyCode) !== spCode) return false;
    if (stallKey && stallKeyFromReading(r) !== stallKey) return false;
    if (controllerReadingKey && r.key !== controllerReadingKey) return false;
    return true;
  });
}

export function countAlarmScopeOverrides(settings: AlarmSettings): number {
  return Object.keys(settings.byScope ?? {}).length + Object.keys(settings.byStallTyCode).length;
}

export function mergeScopeThreshold(
  settings: AlarmSettings,
  scopeKey: string,
  thresholds: AlarmThresholds
): AlarmSettings {
  return {
    ...settings,
    byScope: {
      ...(settings.byScope ?? {}),
      [scopeKey]: thresholds,
    },
  };
}

/** ancestorKey 하위(stall·controller) scope override 여부 */
export function isDescendantScopeKey(
  scopeKey: string,
  ancestorScopeKey: string
): boolean {
  if (scopeKey === ancestorScopeKey) return false;
  return scopeKey.startsWith(`${ancestorScopeKey}|`);
}

/** SP scope 하위 stall·controller override 제거 */
export function clearDescendantScopeOverrides(
  settings: AlarmSettings,
  ancestorScopeKey: string
): { settings: AlarmSettings; cleared: number } {
  const byScope = settings.byScope;
  if (!byScope || Object.keys(byScope).length === 0) {
    return { settings, cleared: 0 };
  }
  const next = { ...byScope };
  let cleared = 0;
  for (const key of Object.keys(next)) {
    if (isDescendantScopeKey(key, ancestorScopeKey)) {
      delete next[key];
      cleared += 1;
    }
  }
  if (cleared === 0) return { settings, cleared: 0 };
  return { settings: { ...settings, byScope: next }, cleared };
}

export type BulkSpAlarmApplyResult = {
  settings: AlarmSettings;
  spScopeKeys: string[];
  clearedOverrides: number;
};

/**
 * 일괄적용 — farm+sp scope 임계값 저장 + 하위 override cascade 제거.
 * 대상 컨트롤러가 SP 일괄값을 그대로 상속하도록 byScope descendant·byStallTyCode[sp] 정리.
 */
export function applyBulkSpAlarmThresholds(
  settings: AlarmSettings,
  targets: BarnReading[],
  selectedSps: ReadonlySet<string>,
  thresholds: AlarmThresholds
): BulkSpAlarmApplyResult {
  let next = settings;
  const spScopeKeys: string[] = [];
  const seen = new Set<string>();
  let clearedOverrides = 0;

  for (const r of targets) {
    const sp = normalizeStallTyCode(r.stallTyCode);
    if (!selectedSps.has(sp)) continue;
    const scopeKey = buildAlarmScopeKey({ farmId: farmKeyId(r.farmKey), sp });
    if (seen.has(scopeKey)) continue;
    seen.add(scopeKey);
    spScopeKeys.push(scopeKey);

    const clearedDesc = clearDescendantScopeOverrides(next, scopeKey);
    next = clearedDesc.settings;
    clearedOverrides += clearedDesc.cleared;

    if (next.byStallTyCode[sp]) {
      const byStallTyCode = { ...next.byStallTyCode };
      delete byStallTyCode[sp];
      next = { ...next, byStallTyCode };
      clearedOverrides += 1;
    }

    next = mergeScopeThreshold(next, scopeKey, thresholds);
  }

  return { settings: next, spScopeKeys, clearedOverrides };
}

export function clearScopeThreshold(
  settings: AlarmSettings,
  scopeKey: string
): AlarmSettings {
  if (!settings.byScope?.[scopeKey]) return settings;
  const next = { ...settings.byScope };
  delete next[scopeKey];
  return { ...settings, byScope: next };
}

export function hasScopeOverride(
  settings: AlarmSettings,
  scopeKey: string | null
): boolean {
  return Boolean(scopeKey && settings.byScope?.[scopeKey]);
}