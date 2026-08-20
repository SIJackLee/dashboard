export function leafletZoomToKakaoLevel(zoom: number): number {
  const level = 19 - Math.round(zoom);
  return Math.max(1, Math.min(14, level));
}

declare global {
  interface Window {
    kakao?: {
      maps?: {
        load?: (cb: () => void) => void;
        Map?: unknown;
      };
    };
  }
}

function kakaoMapsReady(): boolean {
  const maps = window.kakao?.maps as { Map?: unknown } | undefined;
  return typeof maps?.Map === "function";
}

let loadOnce: Promise<void> | null = null;

export function loadKakaoMapsSdk(appKey: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("kakao_maps_window"));
  }
  if (kakaoMapsReady()) return Promise.resolve();
  if (loadOnce) return loadOnce;
  loadOnce = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.dataset.sungilKakaoMaps = "1";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.onload = () => {
      const maps = window.kakao?.maps;
      if (!maps?.load) {
        loadOnce = null;
        reject(new Error("kakao_maps_missing"));
        return;
      }
      maps.load(() => resolve());
    };
    script.onerror = () => {
      loadOnce = null;
      reject(new Error("kakao_maps_script"));
    };
    document.head.appendChild(script);
  });
  return loadOnce;
}
