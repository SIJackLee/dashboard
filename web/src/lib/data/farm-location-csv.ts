import { findRegion } from "@/lib/geo/korea-regions";
import type { FarmKey } from "@/lib/data/farm-key";
import { farmKeyId } from "@/lib/data/farm-key";
import type { EditableFarmOption } from "@/lib/data/farm-location";

export type FarmLocationCsvRow = {
  farmKey: FarmKey;
  sido: string;
  sigungu: string;
  addressDetail?: string;
};

const HEADER =
  "lsind_regist_no,item_code,sido,sigungu,address_detail";

export function exportFarmLocationsCsv(
  options: EditableFarmOption[]
): string {
  const lines = [HEADER];
  for (const o of options) {
    if (!o.location) continue;
    const detail = (o.location.addressDetail ?? "").replace(/"/g, '""');
    lines.push(
      [
        o.farmKey.lsindRegistNo,
        o.farmKey.itemCode,
        o.location.sido,
        o.location.sigungu,
        detail.includes(",") ? `"${detail}"` : detail,
      ].join(",")
    );
  }
  return lines.join("\n");
}

export function exportFarmLocationTemplateCsv(
  options: EditableFarmOption[]
): string {
  const lines = [HEADER];
  for (const o of options) {
    lines.push(
      [
        o.farmKey.lsindRegistNo,
        o.farmKey.itemCode,
        o.location?.sido ?? "",
        o.location?.sigungu ?? "",
        o.location?.addressDetail ?? "",
      ].join(",")
    );
  }
  return lines.join("\n");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function parseFarmLocationsCsv(text: string): {
  rows: FarmLocationCsvRow[];
  errors: string[];
} {
  const errors: string[] = [];
  const rows: FarmLocationCsvRow[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { rows, errors: ["CSV가 비어 있습니다."] };
  }

  let start = 0;
  const first = lines[0]!.toLowerCase();
  if (first.includes("lsind_regist_no")) start = 1;

  for (let i = start; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const [lsind, item, sido, sigungu, detail] = cols;
    if (!lsind?.trim() || !item?.trim()) {
      errors.push(`${i + 1}행: lsind_regist_no, item_code 필요`);
      continue;
    }
    if (!sido?.trim() || !sigungu?.trim()) {
      errors.push(`${i + 1}행: sido, sigungu 필요`);
      continue;
    }
    if (!findRegion(sido.trim(), sigungu.trim())) {
      errors.push(`${i + 1}행: 잘못된 시·도/시·군·구 (${sido}/${sigungu})`);
      continue;
    }
    rows.push({
      farmKey: { lsindRegistNo: lsind.trim(), itemCode: item.trim() },
      sido: sido.trim(),
      sigungu: sigungu.trim(),
      addressDetail: detail?.trim() || undefined,
    });
  }

  return { rows, errors };
}

export function mergeCsvRowsWithOptions(
  rows: FarmLocationCsvRow[],
  options: EditableFarmOption[]
): { valid: FarmLocationCsvRow[]; errors: string[] } {
  const allowed = new Set(options.map((o) => farmKeyId(o.farmKey)));
  const errors: string[] = [];
  const valid: FarmLocationCsvRow[] = [];
  for (const row of rows) {
    const id = farmKeyId(row.farmKey);
    if (!allowed.has(id)) {
      errors.push(`${id}: 편집 가능한 농장 목록에 없습니다.`);
      continue;
    }
    valid.push(row);
  }
  return { valid, errors };
}
