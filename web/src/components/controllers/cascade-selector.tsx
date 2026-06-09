"use client";

import { RefreshCw } from "lucide-react";
import { FilterBar } from "@/components/common/filter-bar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Option = { value: string; label: string };

type Props = {
  farmOptions: Option[];
  moduleOptions: Option[];
  controllerOptions: Option[];
  farm: string;
  module: string;
  controller: string;
  onFarmChange: (v: string) => void;
  onModuleChange: (v: string) => void;
  onControllerChange: (v: string) => void;
  onRefresh?: () => void;
};

function Field({
  label,
  value,
  options,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__none__" disabled>
              데이터 없음
            </SelectItem>
          ) : (
            options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

// 농장 > 통신박스 > 컨트롤러 계층 선택
export function CascadeSelector({
  farmOptions,
  moduleOptions,
  controllerOptions,
  farm,
  module,
  controller,
  onFarmChange,
  onModuleChange,
  onControllerChange,
  onRefresh,
}: Props) {
  return (
    <FilterBar className="justify-between">
      <div className="flex flex-wrap items-end gap-3">
        <Field
          label="농장 선택"
          placeholder="농장 선택"
          value={farm}
          options={farmOptions}
          onChange={onFarmChange}
        />
        <Field
          label="통신박스 선택"
          placeholder="통신박스 선택"
          value={module}
          options={moduleOptions}
          onChange={onModuleChange}
        />
        <Field
          label="컨트롤러 선택"
          placeholder="컨트롤러 선택"
          value={controller}
          options={controllerOptions}
          onChange={onControllerChange}
        />
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm hover:bg-muted"
      >
        <RefreshCw className="size-4" /> 새로고침
      </button>
    </FilterBar>
  );
}
