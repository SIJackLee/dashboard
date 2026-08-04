import { config as loadEnv } from "dotenv";
import type { CapacitorConfig } from "@capacitor/cli";

loadEnv({ path: ".env.local" });
loadEnv();

/**
 * Live URL shell: WebView loads the deployed Next dashboard.
 * Override with CAPACITOR_SERVER_URL when syncing locally.
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  "https://smart.autofankorea.com";

const kakaoNativeAppKey =
  process.env.KAKAO_NATIVE_APP_KEY?.trim() ||
  process.env.NEXT_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim() ||
  "";

const config: CapacitorConfig = {
  appId: "com.autofankorea.dashboard",
  appName: "SUNG-IL IoT",
  webDir: "capacitor-www",
  server: {
    url: serverUrl,
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    SocialLogin: {
      providers: {
        google: true,
        facebook: false,
        apple: false,
        twitter: false,
      },
    },
    ...(kakaoNativeAppKey
      ? {
          KakaoLogin: {
            appKey: kakaoNativeAppKey,
          },
        }
      : {}),
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
