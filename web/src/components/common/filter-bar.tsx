import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FilterBar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-lg border bg-background p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

type SimpleSelectProps = {
  label?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
  className?: string;
};

// 데이터 매칭 전, 옵션은 placeholder 로만 구성.
export function SimpleSelect({
  label,
  placeholder = "전체",
  options = [],
  className,
}: SimpleSelectProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <Select>
        <SelectTrigger className="w-40">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 ? (
            <SelectItem value="__all__">{placeholder}</SelectItem>
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
