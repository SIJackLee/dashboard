"use client";

import { useMemo, useState } from "react";
import { saveControllerMetasAction } from "@/app/(dashboard)/settings/actions";
import { SectionCard } from "@/components/common/section-card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ControllerMetaEntry } from "@/lib/data/controller-meta";
import { FIRMWARE_CTRL_IDX_MAX } from "@/lib/data/iot-firmware";
import type { BarnReading } from "@/lib/data/iot";

type Props = {
  readings: BarnReading[];
  initialMetas: ControllerMetaEntry[];
  notice?: { tone: "ok" | "error"; text: string } | null;
};

export function ControllerMetaForm({ readings, initialMetas, notice }: Props) {
  const slots = useMemo(() => {
    const map = new Map<number, BarnReading>();
    for (const r of readings) {
      if (!map.has(r.idx)) map.set(r.idx, r);
    }
    return [...map.values()].sort((a, b) => a.idx - b.idx);
  }, [readings]);

  const [names, setNames] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    for (const m of initialMetas) init[m.idx] = m.displayName;
    return init;
  });

  const payload = useMemo(
    () =>
      JSON.stringify(
        slots.map((r) => ({
          idx: r.idx,
          eqpmnNo: r.eqpmnNo,
          displayName: (names[r.idx] ?? "").trim(),
        }))
      ),
    [slots, names]
  );

  return (
    <form action={saveControllerMetasAction} className="space-y-4">
      <input type="hidden" name="controllers_json" value={payload} readOnly />
      {notice && (
        <p
          className={
            notice.tone === "ok"
              ? "text-sm text-emerald-700"
              : "text-sm text-destructive"
          }
        >
          {notice.text}
        </p>
      )}
      <SectionCard
        title="4. 컨트롤러 이름(메타데이터) 설정"
        description={`LIVE 컨트롤러(idx 0~${FIRMWARE_CTRL_IDX_MAX})에 사용자 지정 이름을 부여합니다. REPLAY는 SW 그룹별 ctrl 이력으로 확인합니다.`}
        action={
          <button
            type="submit"
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            저장
          </button>
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">idx</TableHead>
              <TableHead className="w-28">장비 번호</TableHead>
              <TableHead>사용자 지정 이름</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {slots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  LIVE 데이터 없음
                </TableCell>
              </TableRow>
            ) : (
              slots.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>{r.idx}</TableCell>
                  <TableCell>{r.eqpmnNo}</TableCell>
                  <TableCell>
                    <Input
                      value={names[r.idx] ?? ""}
                      onChange={(e) =>
                        setNames((prev) => ({
                          ...prev,
                          [r.idx]: e.target.value,
                        }))
                      }
                      placeholder={`예) ${r.eqpmnNo}번 라인`}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </SectionCard>
    </form>
  );
}
