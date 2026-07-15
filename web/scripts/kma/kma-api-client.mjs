import { FCST_ZONE_OPS, WTHR_WRN_OPS } from "../../src/lib/kma/kma-api-config.ts";

function unwrapItems(body) {
  const raw = body?.items?.item;
  if (raw == null) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export function parseKmaResponse(json) {
  const header = json?.response?.header ?? json?.header;
  const body = json?.response?.body ?? json?.body;
  const resultCode = header?.resultCode ?? header?.resultcode;
  const resultMsg = header?.resultMsg ?? header?.resultmsg ?? "";
  const items = body ? unwrapItems(body) : [];
  return {
    ok: resultCode === "00",
    resultCode: resultCode ?? "unknown",
    resultMsg,
    totalCount: Number(body?.totalCount ?? items.length),
    items,
    raw: json,
  };
}

async function fetchKmaJson(url, serviceKey, params = {}) {
  const search = new URLSearchParams({
    serviceKey: serviceKey,
    pageNo: "1",
    numOfRows: "1000",
    dataType: "JSON",
    ...params,
  });
  const res = await fetch(`${url}?${search.toString()}`);
  const text = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      httpStatus: res.status,
      resultCode: "http_error",
      resultMsg: text.slice(0, 200),
      items: [],
      raw: null,
    };
  }
  try {
    const json = JSON.parse(text);
    const parsed = parseKmaResponse(json);
    return { ...parsed, httpStatus: res.status };
  } catch {
    return {
      ok: false,
      httpStatus: res.status,
      resultCode: "parse_error",
      resultMsg: text.slice(0, 200),
      items: [],
      raw: null,
    };
  }
}

async function fetchAllPages(url, serviceKey, params = {}, maxPages = 20) {
  const all = [];
  for (let page = 1; page <= maxPages; page++) {
    const search = new URLSearchParams({
      serviceKey: serviceKey,
      pageNo: String(page),
      numOfRows: "1000",
      dataType: "JSON",
      ...params,
    });
    const res = await fetch(`${url}?${search.toString()}`);
    const text = await res.text();
    if (!res.ok) break;
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      break;
    }
    const parsed = parseKmaResponse(json);
    if (!parsed.ok) break;
    all.push(...parsed.items);
    const total = parsed.totalCount || all.length;
    if (all.length >= total || parsed.items.length === 0) break;
  }
  return all;
}

export function fetchPwnStatus(serviceKey) {
  return fetchKmaJson(WTHR_WRN_OPS.pwnStatus, serviceKey);
}

export function fetchPwnCd(serviceKey) {
  return fetchKmaJson(WTHR_WRN_OPS.pwnCd, serviceKey, {
    numOfRows: "100",
  });
}

/** @see getFcstZoneCd — regSp(지상코드) 필수. 미지정 시 HTTP 403 */
const FCST_ZONE_DEFAULT_REG_SP = "A";

export async function fetchFcstZoneCodes(serviceKey) {
  return fetchAllPages(FCST_ZONE_OPS.zoneCd, serviceKey, {
    regSp: FCST_ZONE_DEFAULT_REG_SP,
  });
}

/** 첫 페이지 호출 — HTTP/resultCode 진단용 */
export function fetchFcstZoneProbe(serviceKey) {
  return fetchKmaJson(FCST_ZONE_OPS.zoneCd, serviceKey, {
    numOfRows: "10",
    regSp: FCST_ZONE_DEFAULT_REG_SP,
  });
}

/** ServiceKey 없이 엔드포인트 존재 여부만 확인 */
export async function probeEndpoint(url) {
  const search = new URLSearchParams({
    serviceKey: "probe",
    pageNo: "1",
    numOfRows: "1",
    dataType: "JSON",
  });
  const res = await fetch(`${url}?${search.toString()}`);
  const text = await res.text();
  return {
    httpStatus: res.status,
    reachable: res.status !== 404,
    unauthorized: /Unauthorized|SERVICE_KEY|인증|KEY/i.test(text),
    snippet: text.slice(0, 120),
  };
}
