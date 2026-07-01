import { WTHR_WRN_OPS } from "@/lib/kma/kma-api-config";

type KmaItem = Record<string, unknown>;

function unwrapItems(body: { items?: { item?: KmaItem | KmaItem[] } }): KmaItem[] {
  const raw = body?.items?.item;
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export type KmaFetchResult = {
  ok: boolean;
  resultCode: string;
  resultMsg: string;
  totalCount: number;
  items: KmaItem[];
  httpStatus?: number;
};

export function parseKmaResponse(json: {
  response?: {
    header?: { resultCode?: string; resultMsg?: string };
    body?: { totalCount?: number; items?: { item?: KmaItem | KmaItem[] } };
  };
}): Omit<KmaFetchResult, "httpStatus"> {
  const header = json?.response?.header;
  const body = json?.response?.body;
  const resultCode = header?.resultCode ?? "unknown";
  const resultMsg = header?.resultMsg ?? "";
  const items = body ? unwrapItems(body) : [];
  return {
    ok: resultCode === "00",
    resultCode,
    resultMsg,
    totalCount: Number(body?.totalCount ?? items.length),
    items,
  };
}

export async function fetchPwnStatus(serviceKey: string): Promise<KmaFetchResult> {
  const search = new URLSearchParams({
    serviceKey,
    pageNo: "1",
    numOfRows: "1000",
    dataType: "JSON",
  });
  const res = await fetch(`${WTHR_WRN_OPS.pwnStatus}?${search.toString()}`);
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      httpStatus: res.status,
      resultCode: "http_error",
      resultMsg: text.slice(0, 200),
      items: [],
      totalCount: 0,
    };
  }
  try {
    const json = JSON.parse(text) as Parameters<typeof parseKmaResponse>[0];
    return { ...parseKmaResponse(json), httpStatus: res.status };
  } catch {
    return {
      ok: false,
      httpStatus: res.status,
      resultCode: "parse_error",
      resultMsg: text.slice(0, 200),
      items: [],
      totalCount: 0,
    };
  }
}
