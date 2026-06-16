"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { dashboardControl, dashboardTypography } from "@/lib/ui/dashboard-page-ui";
import { cn } from "@/lib/utils";
import { resolveFilterSelectLabel } from "@/lib/ui/filter-all";

export type ComboSearchOption = {
  value: string;
  label: string;
};

const DEFAULT_MAX_SUGGESTIONS = 8;

type Props = {
  label?: string;
  options: ComboSearchOption[];
  value?: string;
  onValueChange?: (value: string) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  emptyHint?: string;
  searchPlaceholder?: string;
  maxSuggestions?: number;
  className?: string;
};

export function ComboSearchBar({
  label,
  options,
  value,
  onValueChange,
  searchQuery,
  onSearchQueryChange,
  emptyHint = "검색…",
  searchPlaceholder = "검색…",
  maxSuggestions = DEFAULT_MAX_SUGGESTIONS,
  className,
}: Props) {
  const [searchActive, setSearchActive] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchActive) inputRef.current?.focus();
  }, [searchActive]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q)
    );
  }, [options, searchQuery]);

  const suggestionOptions = useMemo(
    () => filteredOptions.slice(0, maxSuggestions),
    [filteredOptions, maxSuggestions]
  );

  const selectedLabel = value
    ? resolveFilterSelectLabel(value, options, emptyHint)
    : "";

  const enterSearch = () => {
    setSearchActive(true);
    setHighlightIndex(-1);
  };

  const exitSearch = () => {
    setSearchActive(false);
    setHighlightIndex(-1);
  };

  const pickOption = (option: ComboSearchOption) => {
    onValueChange?.(option.value);
    onSearchQueryChange(option.label);
    exitSearch();
  };

  useEffect(() => {
    if (!searchActive) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        exitSearch();
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [searchActive]);

  const showSuggestions =
    searchActive && (suggestionOptions.length > 0 || searchQuery.trim());

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <label className={dashboardTypography.formLabel}>{label}</label>
      ) : null}
      <div ref={rootRef} className="relative">
        <div
          className={cn(
            "flex min-h-12 overflow-hidden rounded-lg border bg-background",
            dashboardControl.input.split(" ").filter((c) => !c.startsWith("h-"))
          )}
        >
          <div
            className="flex min-w-0 flex-1 cursor-text items-center px-3"
            title="클릭하여 검색"
            onClick={enterSearch}
            onDoubleClick={enterSearch}
          >
            {searchActive ? (
              <input
                ref={inputRef}
                type="text"
                className="w-full min-w-0 bg-transparent text-[1.75rem] leading-snug outline-none placeholder:text-muted-foreground"
                value={searchQuery}
                placeholder={searchPlaceholder}
                aria-label={label ? `${label} 검색` : "검색"}
                aria-expanded={showSuggestions ? true : false}
                aria-autocomplete="list"
                onChange={(e) => {
                  onSearchQueryChange(e.target.value);
                  setHighlightIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    exitSearch();
                    return;
                  }
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightIndex((i) =>
                      Math.min(i + 1, suggestionOptions.length - 1)
                    );
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightIndex((i) => Math.max(i - 1, 0));
                    return;
                  }
                  if (e.key === "Enter" && highlightIndex >= 0) {
                    e.preventDefault();
                    const picked = suggestionOptions[highlightIndex];
                    if (picked) pickOption(picked);
                  }
                }}
              />
            ) : (
              <span
                className={cn(
                  "truncate text-[1.75rem] leading-snug",
                  value ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {value ? selectedLabel : emptyHint}
              </span>
            )}
          </div>
        </div>

        {showSuggestions ? (
          <ul
            role="listbox"
            className="absolute z-50 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border bg-popover py-1 shadow-md"
          >
            {suggestionOptions.length === 0 ? (
              <li
                className={cn(
                  "px-3 py-2 text-muted-foreground",
                  dashboardTypography.body
                )}
              >
                검색 결과 없음
              </li>
            ) : (
              suggestionOptions.map((o, i) => (
                <li key={o.value} role="option" aria-selected={highlightIndex === i}>
                  <button
                    type="button"
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-muted",
                      dashboardTypography.body,
                      highlightIndex === i && "bg-muted"
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickOption(o)}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
