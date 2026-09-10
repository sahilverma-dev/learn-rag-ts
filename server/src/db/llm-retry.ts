/**
 * Rate-limit-aware retry helpers for LLM calls.
 *
 * The Google Generative AI API returns structured errors that include a
 * suggested retry delay (RetryInfo.retryDelay) plus the standard HTTP status
 * code (429). We extract that delay and back off accordingly, which is far
 * better than fixed short sleeps when the free-tier quota is exhausted.
 */

export function parseRetryDelaySeconds(error: unknown): number | null {
  if (!error || typeof error !== "object") return null;

  // The gcloud error library surfaces this on the thrown Error as `.code` / `.details`
  const details = (error as any).details as unknown[] | undefined;
  if (Array.isArray(details)) {
    for (const detail of details) {
      const retryDelay = (detail as any)?.retryDelay as string | undefined;
      if (retryDelay) {
        // format is like "57.236320244s"
        const parsed = parseDurationSeconds(retryDelay);
        if (parsed !== null) return parsed;
      }
    }
  }
  return null;
}

function parseDurationSeconds(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)s$/.exec(value.trim());
  if (!match) return null;
  const seconds = Number(match[1]);
  return Number.isFinite(seconds) ? seconds : null;
}

export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = (error as any)?.status;
  const code = (error as any)?.code ?? status;
  if (code === 429 || code === "429") return true;
  const message = String((error as any)?.message ?? "");
  return /429|quota|rate limit|too many requests/i.test(message);
}

export class LLMRateLimitError extends Error {
  readonly retryAfterSeconds: number | null;
  constructor(message: string, retryAfterSeconds: number | null) {
    super(message);
    this.name = "LLMRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface RetryOptions {
  /** max attempts including the first call */
  maxAttempts: number;
  /** base delay when the server does not supply a retryAfter (seconds) */
  baseDelayMs: number;
  /** exponential backoff factor between attempts */
  factor: number;
  /** hard cap on any single delayed retry (ms) */
  maxDelayMs: number;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 2500,
  factor: 2,
  maxDelayMs: 30_000,
};

/**
 * Wraps an async call with rate-limit-aware retry. On a 429 / quota error it
 * waits for the server-supplied retryDelay (capped) before retrying; otherwise
 * it uses exponential backoff. When the retries are exhausted it rethrows a
 * friendly LLMRateLimitError.
 */
export async function withRateLimitRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts: RetryOptions = {
    maxAttempts: options.maxAttempts ?? DEFAULT_RETRY_OPTIONS.maxAttempts,
    baseDelayMs: options.baseDelayMs ?? DEFAULT_RETRY_OPTIONS.baseDelayMs,
    factor: options.factor ?? DEFAULT_RETRY_OPTIONS.factor,
    maxDelayMs: options.maxDelayMs ?? DEFAULT_RETRY_OPTIONS.maxDelayMs,
  };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (err) {
      console.error(`[Attempt ${attempt}/${opts.maxAttempts}] Operation failed:`, err);
      lastError = err;
      if (attempt >= opts.maxAttempts) break;

      const suggestedSeconds = parseRetryDelaySeconds(err);
      if (isRateLimitError(err)) {
        const delayMs = suggestedSeconds != null
          ? Math.min(suggestedSeconds * 1000, opts.maxDelayMs)
          : Math.min(opts.baseDelayMs * Math.pow(opts.factor, attempt - 1), opts.maxDelayMs);
        await sleep(delayMs);
        continue;
      }
      // Non-rate-limit errors (connection, 5xx) — exponential backoff, no wait
      // if one isn't suggested.
      if (isRetryableError(err)) {
        const delayMs = Math.min(opts.baseDelayMs * Math.pow(opts.factor, attempt - 1), opts.maxDelayMs);
        await sleep(delayMs);
        continue;
      }
      // Unrecoverable — rethrow immediately.
      throw err;
    }
  }

  if (lastError && !isRateLimitError(lastError)) {
    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError));
  }

  throw new LLMRateLimitError(
    "The AI provider is rate-limited right now. Please try again shortly.",
    parseRetryDelaySeconds(lastError),
  );
}

function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return true;
  const code = (error as any)?.code ?? (error as any)?.status;
  if (typeof code === "number" && code >= 500 && code < 600) return true;
  return /network|econnreset|socket hang up|fetch failed/i.test(String((error as any)?.message ?? ""));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}