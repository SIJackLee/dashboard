"use client";

import {
  type ProfilePinToolId,
  DEFAULT_PROFILE_PINNED_TOOLS,
  readProfilePinnedToolsFromStorage,
  setProfilePinHeaderMode,
  writeProfilePinnedToolsToStorage,
  PROFILE_PIN_MAX,
} from "@/lib/ui/profile-pin-tools";

export type ProfilePinExpandedPanel = "alarm" | "pdf" | null;

const listeners = new Set<() => void>();

let pinned: ProfilePinToolId[] = [...DEFAULT_PROFILE_PINNED_TOOLS];
let editMode = false;
let accountMenuOpen = false;
let expandedPanel: ProfilePinExpandedPanel = null;
let draggingTool: ProfilePinToolId | null = null;
let hydrated = false;

function notify(): void {
  listeners.forEach((l) => l());
}

function hydrateFromStorage(): void {
  if (hydrated || typeof window === "undefined") return;
  pinned = readProfilePinnedToolsFromStorage();
  hydrated = true;
}

export function subscribeProfilePinStore(listener: () => void): () => void {
  hydrateFromStorage();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getProfilePinnedTools(): ProfilePinToolId[] {
  hydrateFromStorage();
  return pinned;
}

export function getProfilePinEditMode(): boolean {
  return editMode;
}

export function getProfileAccountMenuOpen(): boolean {
  return accountMenuOpen;
}

export function getProfilePinExpandedPanel(): ProfilePinExpandedPanel {
  return expandedPanel;
}

export function getProfilePinDraggingTool(): ProfilePinToolId | null {
  return draggingTool;
}

export function setProfilePinnedTools(next: ProfilePinToolId[]): void {
  pinned = next.slice(0, PROFILE_PIN_MAX);
  if (pinned.length > 0) {
    setProfilePinHeaderMode(false);
  }
  writeProfilePinnedToolsToStorage(pinned);
  notify();
}

export function resetProfilePinnedTools(): void {
  setProfilePinHeaderMode(true);
  pinned = [];
  writeProfilePinnedToolsToStorage([]);
  expandedPanel = null;
  notify();
}

export function pinProfileTool(id: ProfilePinToolId): boolean {
  hydrateFromStorage();
  if (pinned.includes(id) || pinned.length >= PROFILE_PIN_MAX) return false;
  setProfilePinnedTools([...pinned, id]);
  return true;
}

export function unpinProfileTool(id: ProfilePinToolId): void {
  hydrateFromStorage();
  if (!pinned.includes(id)) return;
  setProfilePinnedTools(pinned.filter((x) => x !== id));
  if (expandedPanel === "alarm" && id === "alarm") expandedPanel = null;
  if (expandedPanel === "pdf" && id === "pdf") expandedPanel = null;
  notify();
}

export function setProfilePinEditMode(next: boolean): void {
  editMode = next;
  if (!next) draggingTool = null;
  notify();
}

export function setProfileAccountMenuOpen(next: boolean): void {
  accountMenuOpen = next;
  if (!next) {
    editMode = false;
    expandedPanel = null;
    draggingTool = null;
  }
  notify();
}

export function setProfilePinExpandedPanel(
  next: ProfilePinExpandedPanel,
): void {
  expandedPanel = next;
  notify();
}

export function toggleProfilePinExpandedPanel(
  id: "alarm" | "pdf",
): void {
  expandedPanel = expandedPanel === id ? null : id;
  notify();
}

export function setProfilePinDraggingTool(
  next: ProfilePinToolId | null,
): void {
  draggingTool = next;
  notify();
}
