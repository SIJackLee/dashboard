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
import type { BarnReading } from "@/lib/data/iot";

type Props = {
  readings: BarnReading[];
  initialMetas: ControllerMetaEntry[];
  notice?: { tone: "ok" | "error"; text: string } | null;
};

export function ControllerMetaForm({ readings, initialMetas, notice }: Props) {
  const slots = useMemo(() => {
    const map = new Map<string, BarnReading>();
    for (const r of readings) {
      if (!map.has(r.controllerKey)) map.set(r.controllerKey, r);
    }
    return [...map.values()].sort((a, b) =>
      a.controllerKey.localeCompare(b.controllerKey, "ko", { numeric: true })
    );
  }, [readings]);

  const [names, setNames] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const m of initialMetas) init[m.controllerKey] = m.displayName;
    return init;
  });

  const payload = useMemo(
    () =>
      JSON.stringify(
        slots.map((r) => ({
          controllerKey: r.controllerKey,
          eqpmnNo: r.eqpmnNo,
          displayName: (names[r.controllerKey] ?? "").trim(),
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
        description="LIVE 컨트롤러(축사·장비번호)에 사용자 지정 이름을 부여합니다."
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
              <TableHead className="w-36">식별 키</TableHead>
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
                  <TableCell className="font-mono text-xs">{r.controllerKey}</TableCell>
                  <TableCell>{r.eqpmnNo}</TableCell>
                  <TableCell>
                    <Input
                      value={names[r.controllerKey] ?? ""}
                      onChange={(e) =>
                        setNames((prev) => ({
                          ...prev,
                          [r.controllerKey]: e.target.value,
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
