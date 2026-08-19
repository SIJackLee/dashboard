/**
 * 일보 PDF 캔버스 테마 — 레터헤드 (브랜드 초록, 빨강은 상태만).
 */

export type DailyReportPdfTheme = {
  header: "rule" | "letterhead";
  wordmark: string;
  title: string;
  meta: string;
  rule: string;
  letterheadBg: string;
  letterheadFg: string;
  letterheadMuted: string;
  section: string;
  tableHeadBg: string;
  tableHeadFg: string;
  footer: "hairline" | "bar";
  footerBg: string;
  footerFg: string;
  footerMuted: string;
};

const INK = "#111827";
const LETTERHEAD = "#14532D";

export const DAILY_REPORT_PDF_THEME: DailyReportPdfTheme = {
  header: "letterhead",
  wordmark: "#A7F3D0",
  title: "#FFFFFF",
  meta: "#D1FAE5",
  rule: LETTERHEAD,
  letterheadBg: LETTERHEAD,
  letterheadFg: "#FFFFFF",
  letterheadMuted: "#A7F3D0",
  section: LETTERHEAD,
  tableHeadBg: "#ECFDF5",
  tableHeadFg: INK,
  footer: "bar",
  footerBg: LETTERHEAD,
  footerFg: "#FFFFFF",
  footerMuted: "#A7F3D0",
};
