import type { LocalModelTone } from "../hooks/useLocalHealth";

/** Status dot / accent color for each local-model state. */
export const TONE_COLOR: Record<LocalModelTone, string> = {
  ready: "var(--green)",
  warning: "var(--orange)",
  error: "var(--red)",
  loading: "var(--ink-3)",
};

/** Softer background used behind status details. */
export const TONE_TINT: Record<LocalModelTone, string> = {
  ready: "var(--green-tint)",
  warning: "var(--orange-tint)",
  error: "var(--red-tint)",
  loading: "var(--hover-2)",
};
