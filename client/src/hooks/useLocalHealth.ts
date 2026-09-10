import { useCallback, useEffect, useState } from "react";
import { fetchLocalHealth, type LocalHealth } from "../lib/api";

export type LocalModelTone = "ready" | "warning" | "error" | "loading";

export type LocalModelState = {
  tone: LocalModelTone;
  label: string;
  detail: string;
};

/**
 * Turns a health payload into a single presentable state, naming the first
 * thing the user needs to fix.
 */
export function describeLocalModelState(
  health: LocalHealth | null,
  loading: boolean,
  error: string | null,
): LocalModelState {
  if (loading && !health) {
    return { tone: "loading", label: "Checking local models…", detail: "" };
  }

  if (error || !health) {
    return {
      tone: "error",
      label: "Server unreachable",
      detail: error ?? "Could not read local model status.",
    };
  }

  if (!health.ollama.reachable) {
    return {
      tone: "error",
      label: "Ollama unreachable",
      detail:
        health.ollama.error ??
        `Could not reach Ollama. Start it with OLLAMA_HOST=0.0.0.0:11434 ollama serve`,
    };
  }

  if (!health.ollama.llmModelAvailable) {
    return {
      tone: "warning",
      label: `${health.ollama.llmModel} not pulled`,
      detail: `Run: ollama pull ${health.ollama.llmModel}`,
    };
  }

  if (!health.ollama.embeddingModelAvailable) {
    return {
      tone: "warning",
      label: `${health.ollama.embeddingModel} not pulled`,
      detail: `Run: ollama pull ${health.ollama.embeddingModel}`,
    };
  }

  if (!health.index?.exists || health.index.recordCount === 0) {
    return {
      tone: "warning",
      label: "Index empty",
      detail: "Run: bun src/local-embedding-pipeline.ts",
    };
  }

  return {
    tone: "ready",
    label: health.llmModel,
    detail: `${health.index.recordCount} vectors in "${health.index.name}"`,
  };
}

/** Reads the local model readiness endpoint. */
export function useLocalHealth() {
  const [health, setHealth] = useState<LocalHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const applyHealth = useCallback(
    (data: LocalHealth | null, message: string | null) => {
      setHealth(data);
      setError(message);
      setLoading(false);
    },
    [],
  );

  const onFailure = useCallback(
    (err: unknown) => (err instanceof Error ? err.message : String(err)),
    [],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    return fetchLocalHealth()
      .then((data) => applyHealth(data, null))
      .catch((err: unknown) => applyHealth(null, onFailure(err)));
  }, [applyHealth, onFailure]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLocalHealth(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) applyHealth(data, null);
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) applyHealth(null, onFailure(err));
      });
    return () => controller.abort();
  }, [applyHealth, onFailure]);

  return { health, loading, error, refresh };
}
