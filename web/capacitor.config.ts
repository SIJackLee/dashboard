import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Live URL shell: WebView loads the deployed Next dashboard.
 * Override with CAPACITOR_SERVER_URL when syncing locally.
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ||
  "https://smart.autofankorea.com";

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
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
