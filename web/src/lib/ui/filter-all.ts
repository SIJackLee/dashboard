/** 필터 Select «전체» sentinel — UI에는 «전체»만 노출 */
export const FILTER_ALL = "__all__";

export const FILTER_ALL_LABEL = "전체";

export function isFilterAll(value: string | null | undefined): boolean {
  return !value || value === FILTER_ALL;
}

export function resolveFilterSelectLabel(
  value: string | undefined,
  options: { value: string; label: string }[],
  placeholder = FILTER_ALL_LABEL
): string {
  if (isFilterAll(value)) return placeholder;
  return options.find((o) => o.value === value)?.label ?? placeholder;
}
