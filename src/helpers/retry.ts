export type RetryOptions = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio?: number; // 0..1
};

export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export function calcBackoffDelayMs(attempt: number, opts: RetryOptions): number {
  const exp = opts.baseDelayMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exp, opts.maxDelayMs);
  const jitterRatio = opts.jitterRatio ?? 0.2;
  const jitter = capped * jitterRatio * (Math.random() * 2 - 1);
  return Math.max(0, Math.round(capped + jitter));
}

export function isRetriableStatus(status: number): boolean {
  if (status >= 500) return true;
  if (status === 429) return true;
  return false;
}

export function isRetriableError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  const m = msg.toLowerCase();
  return (
    msg.includes("ETIMEDOUT") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ECONNREFUSED") ||
    msg.includes("EAI_AGAIN") ||
    m.includes("timeout") ||
    m.includes("socket hang up")
  );
}

export function parseRetryAfterMs(headers: Record<string, string>): number | null {
  const ra = headers["retry-after"] ?? headers["Retry-After"] ?? headers["RETRY-AFTER"];
  if (!ra) return null;

  const seconds = Number(ra);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));

  const dateMs = Date.parse(ra);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    return Math.max(0, delta);
  }

  return null;
}

export function isRetryAfterEligibleStatus(status: number): boolean {
  return status === 429 || status === 503;
}
