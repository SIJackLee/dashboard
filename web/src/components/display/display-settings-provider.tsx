"use client";

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import {
  DEFAULT_DISPLAY_SETTINGS,
  type DisplaySettingKey,
  type DisplaySettings,
} from "@/lib/data/display-settings-shared";

const DisplaySettingsContext = createContext<DisplaySettings>(
  DEFAULT_DISPLAY_SETTINGS
);

export function DisplaySettingsProvider({
  settings,
  children,
}: {
  settings: DisplaySettings;
  children: ReactNode;
}) {
  const value = useMemo(() => settings, [settings]);
  return (
    <DisplaySettingsContext.Provider value={value}>
      {children}
    </DisplaySettingsContext.Provider>
  );
}

export function useDisplaySettings() {
  return useContext(DisplaySettingsContext);
}

export function useDisplayEnabled(key: DisplaySettingKey): boolean {
  const settings = useDisplaySettings();
  return settings[key] ?? DEFAULT_DISPLAY_SETTINGS[key];
}

export function DisplayGate({
  setting,
  children,
}: {
  setting: DisplaySettingKey;
  children: ReactNode;
}) {
  const enabled = useDisplayEnabled(setting);
  if (!enabled) return null;
  return children;
}
