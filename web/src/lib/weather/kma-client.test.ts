import assert from "node:assert/strict";
import { fetchKmaReading } from "@/lib/weather/kma-client";

const NCST_FIXTURE = {
  response: {
    header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
    body: {
      items: {
        item: [
          { category: "T1H", obsrValue: "27.3" },
          { category: "REH", obsrValue: "62" },
          { category: "WSD", obsrValue: "1.2" },
          { category: "RN1", obsrValue: "0" },
        ],
      },
    },
  },
};

const FCST_FIXTURE = {
  response: {
    header: { resultCode: "00", resultMsg: "NORMAL_SERVICE" },
    body: {
      items: {
        item: [
          {
            category: "T1H",
            fcstDate: "20260811",
            fcstTime: "1500",
            fcstValue: "28",
          },
          {
            category: "REH",
            fcstDate: "20260811",
            fcstTime: "1500",
            fcstValue: "58",
          },
          {
            category: "T1H",
            fcstDate: "20260811",
            fcstTime: "1600",
            fcstValue: "29",
          },
          {
            category: "REH",
            fcstDate: "20260811",
            fcstTime: "1600",
            fcstValue: "55",
          },
        ],
      },
    },
  },
};

async function run() {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("getUltraSrtNcst")) {
      return new Response(JSON.stringify(NCST_FIXTURE), { status: 200 });
    }
    if (url.includes("getUltraSrtFcst")) {
      return new Response(JSON.stringify(FCST_FIXTURE), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const res = await fetchKmaReading(37.5665, 126.978, "test-key", new Date());
    assert.equal(res.ok, true);
    if (!res.ok) throw new Error("expected ok");
    assert.equal(res.reading.tempC, 27.3);
    assert.equal(res.reading.humidityPct, 62);
    assert.equal(res.reading.windMs, 1.2);
    assert.equal(res.reading.precipMm, 0);
    assert.equal(res.reading.forecastPoints.length, 2);
    assert.equal(res.reading.forecastPoints[0]?.tempC, 28);
    assert.equal(res.reading.fetchOk, true);
    console.log("kma-client.test.ts ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
