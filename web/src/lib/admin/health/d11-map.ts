import type { D11Hint, HealthPoint, HealthStatus, ModuleHealthRow } from "@/lib/admin/health/types";

const D11_CATALOG: Record<string, { title: string; summary: string }> = {
  S1: {
    title: "측정이 안 옴",
    summary: "다른 농장에 새 데이터가 오는지 확인 → R2 vs R3 분기",
  },
  S2: {
    title: "화면에 안 보임",
    summary: "live View·ctrl 상한·decode 오류 확인 (R4)",
  },
  S3: {
    title: "오래된 값만 보임",
    summary: "마지막 측정 시각·모듈 주기(D9) 확인",
  },
  S4: {
    title: "명령이 안 먹음",
    summary: "uplink 정상 후 명령 대기열 pending/sent 확인",
  },
  S5: {
    title: "일부만 끊김",
    summary: "단일 모듈·장비만 이상 — R1/R2 drill-down",
  },
  "S6-A": {
    title: "외부 FTP 미구현",
    summary: "snapshot·View까지 정상이면 전송 단계 미지원 (D10)",
  },
  "S6-B": {
    title: "외부 snapshot/View",
    summary: "연계 스냅샷·View 행·freshness 점검",
  },
  S7: {
    title: "로그인·권한",
    summary: "역할·농장 허용(user_access) 확인",
  },
};

export function d11HintFromId(id: string): D11Hint {
  const meta = D11_CATALOG[id] ?? { title: id, summary: "D11 incident-quickref 참조" };
  return { id, title: meta.title, summary: meta.summary };
}

export function collectD11Hints(ids: Iterable<string>): D11Hint[] {
  const seen = new Set<string>();
  const out: D11Hint[] = [];
  for (const id of ids) {
    if (!id || id === "—" || seen.has(id)) continue;
    seen.add(id);
    out.push(d11HintFromId(id));
  }
  return out;
}

export function hintsFromPoints(points: HealthPoint[]): D11Hint[] {
  return collectD11Hints(
    points.map((p) => p.d11Hint).filter((h): h is string => Boolean(h))
  );
}

export function hintsFromModules(modules: ModuleHealthRow[]): D11Hint[] {
  return collectD11Hints(modules.map((m) => m.d11Hint).filter((h) => h !== "—"));
}

export function d11HintForInsertRate(recentZero: boolean): string | undefined {
  return recentZero ? "S1" : undefined;
}

export function d11HintForLiveCap(liveCount: number, limit: number): string | undefined {
  const moduleEstimate = Math.ceil(liveCount / 50);
  if (moduleEstimate > limit / 50) return "S2";
  return undefined;
}

export function scopeFromModules(modules: ModuleHealthRow[]): string | null {
  const bad = modules.filter((m) => m.status === "critical" || m.status === "warn");
  if (bad.length === 0) return null;
  const farms = new Set(bad.map((m) => m.farmId));
  if (bad.length === 1 && farms.size === 1) return "R2";
  if (farms.size === 1) return "R2";
  if (bad.length >= modules.length * 0.5) return "R3";
  return "R2";
}

export function statusToD11(status: HealthStatus, context: "uplink" | "query" | "export"): string {
  if (status === "not_implemented") return "S6-A";
  if (status === "critical" && context === "uplink") return "S1";
  if (status === "warn" && context === "uplink") return "S3";
  if (status === "critical" && context === "query") return "S2";
  return "—";
}
