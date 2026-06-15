"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { SectionCard } from "@/components/common/section-card";
import { ControllerNameLabel } from "@/components/common/controller-name-label";
import { StatusBadge } from "@/components/common/status-badge";
import { FanIndicator } from "@/components/common/fan-indicator";
import { useControllerMeta } from "@/components/controllers/controller-meta-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ControllerReading } from "@/lib/data/iot";
import { ctrlUi } from "@/lib/ui/controller-page-ui";
import { sensorValueForDisplay } from "@/lib/data/reading-display";

type ListProps = {
  items?: ControllerReading[];
  selectedKey?: string;
  onSelect?: (key: string) => void;
};

function ControllerNameEditOverlay({
  reading,
  draft,
  pending,
  onDraft,
  onSave,
  onCancel,
}: {
  reading: ControllerReading;
  draft: string;
  pending: boolean;
  onDraft: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      className="absolute right-0 top-0 z-40 w-[13rem] rounded-lg border bg-popover p-2.5 shadow-lg ring-1 ring-foreground/10"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="text-xs font-medium text-muted-foreground">컨트롤러 이름</p>
      <Input
        className="mt-1.5 h-8 text-sm"
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        placeholder={`예) ${reading.eqpmnNo}번 라인`}
        maxLength={32}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
      />
      <div className="mt-1.5 flex gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 flex-1 text-xs"
          disabled={pending}
          onClick={onSave}
        >
          {pending ? "저장 중…" : "저장"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          disabled={pending}
          onClick={onCancel}
        >
          취소
        </Button>
      </div>
    </div>
  );
}

function ControllerListStrip({ items = [], selectedKey, onSelect }: ListProps) {
  const { resolveName, canEdit, saveDisplayName } = useControllerMeta();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const openEdit = (c: ControllerReading) => {
    setEditingKey(c.key);
    setDraft(resolveName(c.controllerKey, c.eqpmnNo) ?? "");
  };

  const closeEdit = () => {
    setEditingKey(null);
    setDraft("");
  };

  const handleSave = async (c: ControllerReading) => {
    setPending(true);
    const result = await saveDisplayName(c.controllerKey, c.eqpmnNo, draft);
    setPending(false);
    if (result.ok) closeEdit();
  };

  if (items.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        컨트롤러 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className={cn("flex overflow-x-auto pb-1", ctrlUi.chipStripGap)}>
      {items.map((c) => {
        const isSelected = c.key === selectedKey;
        const isEditing = editingKey === c.key;
        const showPencil = canEdit && hoverKey === c.key && !isEditing;

        return (
          <div
            key={c.key}
            className="relative shrink-0"
            onMouseEnter={() => setHoverKey(c.key)}
            onMouseLeave={() => setHoverKey((k) => (k === c.key ? null : k))}
          >
            <button
              type="button"
              onClick={() => {
                if (!isEditing) onSelect?.(c.key);
              }}
              className={cn(
                "flex shrink-0 flex-col gap-2 text-left transition-colors hover:bg-muted/50",
                ctrlUi.chipWidth,
                ctrlUi.chipMinH,
                ctrlUi.chipCard,
                isSelected && "border-emerald-500 bg-emerald-50/50"
              )}
            >
              <div className="flex items-center justify-between gap-1 pr-8">
                <ControllerNameLabel
                  className={cn(ctrlUi.body, "font-medium leading-tight truncate")}
                  name={resolveName(c.controllerKey, c.eqpmnNo)}
                  label={c.label}
                  stallNo={c.stallNo}
                  controllerKey={c.controllerKey}
                  eqpmnNo={c.eqpmnNo}
                />
                <StatusBadge tone={c.status} compact large />
              </div>
              <div className={cn("grid grid-cols-3", ctrlUi.gridGap)}>
                <FanIndicator
                  kind="supply"
                  value={sensorValueForDisplay(c.status, c.fanSupply)}
                  compact
                  large
                />
                <FanIndicator
                  kind="exhaust"
                  value={sensorValueForDisplay(c.status, c.fanExhaust)}
                  compact
                  large
                />
                <FanIndicator
                  kind="intake"
                  value={sensorValueForDisplay(c.status, c.fanIntake)}
                  compact
                  large
                />
              </div>
            </button>

            <div className="absolute right-1.5 top-1.5 z-30">
              {isEditing ? (
                <ControllerNameEditOverlay
                  reading={c}
                  draft={draft}
                  pending={pending}
                  onDraft={setDraft}
                  onSave={() => void handleSave(c)}
                  onCancel={closeEdit}
                />
              ) : showPencil ? (
                <button
                  type="button"
                  aria-label="이름 편집"
                  className="rounded-md border border-muted-foreground/20 bg-background p-1 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(c);
                  }}
                >
                  <Pencil className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

type Props = ListProps & {
  spLabel?: string;
  embedded?: boolean;
};

export function ControllerListPanel({
  items = [],
  selectedKey,
  onSelect,
  spLabel,
  embedded = false,
}: Props) {
  const { resolveName } = useControllerMeta();
  const desc = spLabel ? `${spLabel} · ${items.length}대` : `${items.length}대`;

  if (embedded) {
    return (
      <div className="space-y-2">
        <p className={ctrlUi.sectionTitle}>{desc}</p>
        <ControllerListStrip
          items={items}
          selectedKey={selectedKey}
          onSelect={onSelect}
        />
      </div>
    );
  }

  return (
    <SectionCard title="컨트롤러 목록" description={desc}>
      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            컨트롤러 데이터가 없습니다.
          </p>
        ) : (
          items.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => onSelect?.(c.key)}
              className={cn(
                "w-full space-y-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
                c.key === selectedKey && "border-emerald-500 bg-emerald-50/50"
              )}
            >
              <div className="flex items-center justify-between">
                <ControllerNameLabel
                  name={resolveName(c.controllerKey, c.eqpmnNo)}
                  label={c.label}
                  stallNo={c.stallNo}
                  controllerKey={c.controllerKey}
                  eqpmnNo={c.eqpmnNo}
                />
                <StatusBadge tone={c.status} />
              </div>
              <div className="flex gap-4">
                <FanIndicator
                  kind="supply"
                  value={sensorValueForDisplay(c.status, c.fanSupply)}
                  compact
                />
                <FanIndicator
                  kind="exhaust"
                  value={sensorValueForDisplay(c.status, c.fanExhaust)}
                  compact
                />
                <FanIndicator
                  kind="intake"
                  value={sensorValueForDisplay(c.status, c.fanIntake)}
                  compact
                />
              </div>
            </button>
          ))
        )}
      </div>
    </SectionCard>
  );
}

export { ControllerListStrip };
