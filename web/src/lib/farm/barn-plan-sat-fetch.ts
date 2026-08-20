import "server-only";

import {
  barnPlanSatEsriTileUrl,
  barnPlanSatTileInRange,
  barnPlanSatVworldWmtsUrl,
} from "@/lib/farm/barn-plan-sat-overlay";

function overlaySiteDomain(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

function isJpeg(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

async function fetchJpeg(url: string, referer?: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "image/jpeg,image/png,image/*,*/*",
        "User-Agent": "sungil-farm-plan/1.0",
        ...(referer ? { Referer: referer } : {}),
      },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 32 || buf.length > 2_000_000) return null;
    if (!isJpeg(buf)) return null;
    return buf;
  } catch {
    return null;
  }
}

export async function fetchBarnPlanSatTile(input: {
  z: number;
  x: number;
  y: number;
}): Promise<Buffer | null> {
  if (!barnPlanSatTileInRange(input.z, input.x, input.y)) return null;
  const vworldKey = process.env.VWORLD_API_KEY?.trim() ?? "";
  const domain = overlaySiteDomain();
  if (vworldKey) {
    const vworld = await fetchJpeg(
      barnPlanSatVworldWmtsUrl(input.z, input.x, input.y, vworldKey),
      domain,
    );
    if (vworld) return vworld;
  }
  return fetchJpeg(barnPlanSatEsriTileUrl(input.z, input.x, input.y));
}
