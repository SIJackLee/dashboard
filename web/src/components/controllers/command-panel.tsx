"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendThermoCommandAction } from "@/app/(dashboard)/controllers/actions";
import type { ControllerReading } from "@/lib/data/iot";

const fields = [
  { key: "min_vent_pct", label: "최저환기", unit: "%", step: "1" },
  { key: "max_vent_pct", label: "최고환기", unit: "%", step: "1" },
  { key: "setpoint_temp", label: "설정온도", unit: "℃", step: "0.1" },
  { key: "temp_deviation", label: "온도편차", unit: "℃", step: "0.1" },
] as const;

type Props = {
  target: ControllerReading | undefined;
  canCommand: boolean;
};

function formatError(error: string): string {
  if (error === "invalid_vent_range") {
    return "환기 범위를 확인하세요. (0~100%, 최저 ≤ 최고)";
  }
  if (error === "unauthorized") return "권한이 없습니다.";
  if (error.includes("row-level security")) {
    return "명령 권한이 없습니다. (RLS: 해당 컨트롤러 can_command 확인)";
  }
  return `명령 등록에 실패했습니다. (${error})`;
}

export function CommandPanel({ target, canCommand }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    tone: "ok" | "error";
    text: string;
  } | null>(null);
  const [values, setValues] = useState({
    min_vent_pct: "10",
    max_vent_pct: "100",
    setpoint_temp: "25",
    temp_deviation: "2",
  });

  if (!canCommand) {
    return (
      <SectionCard title="원격 제어 명령">
        <p className="text-sm text-muted-foreground">
          명령 권한이 없습니다. 관리자에게 컨트롤러 명령 권한을 요청하세요.
        </p>
      </SectionCard>
    );
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!target) {
      setMessage({ tone: "error", text: "대상 컨트롤러를 선택하세요." });
      return;
    }

    setMessage(null);
    const formData = new FormData();
    formData.set("lsind_regist_no", target.farmKey.lsindRegistNo);
    formData.set("item_code", target.farmKey.itemCode);
    formData.set("module_uid", String(target.moduleUid));
    formData.set("ctrl_idx", String(target.idx));
    for (const f of fields) {
      formData.set(f.key, values[f.key]);
    }

    startTransition(async () => {
      const result = await sendThermoCommandAction(formData);
      if (result.ok) {
        setMessage({ tone: "ok", text: "명령을 등록했습니다. (pending)" });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: formatError(result.error) });
      }
    });
  };

  return (
    <SectionCard title="원격 제어 명령">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-muted-foreground">
          대상:{" "}
          {target ? (
            <span className="font-medium text-foreground">
              {target.farmKey.lsindRegistNo}/{target.farmKey.itemCode} · 통신박스 {target.moduleUid} · ctrl{" "}
              {target.eqpmnNo} (idx {target.idx})
            </span>
          ) : (
            "컨트롤러를 선택하세요"
          )}
        </p>

        <div className="grid grid-cols-2 gap-4">
          {fields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                {f.label} ({f.unit})
              </Label>
              <Input
                type="number"
                step={f.step}
                required
                value={values[f.key]}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>

        {message && (
          <p
            className={
              message.tone === "ok"
                ? "text-xs text-emerald-700"
                : "text-xs text-red-600"
            }
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={pending || !target}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-emerald-600 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Send className="size-4" />
          )}
          명령 전송
        </button>
      </form>
    </SectionCard>
  );
}
