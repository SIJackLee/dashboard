"use client";

import type { AlarmRow } from "@/lib/data/alarms";
import { AlarmDetailPanel } from "@/components/alarms/alarm-detail-panel";

type AlarmTriagePanelProps = {
  alarm?: AlarmRow;
};

/** 이상 탭 상세 — 알람 정보만 표시 (컨트롤러 패널은 장비 탭에서 제어) */
export function AlarmTriagePanel({ alarm }: AlarmTriagePanelProps) {
  return <AlarmDetailPanel alarm={alarm} />;
}
