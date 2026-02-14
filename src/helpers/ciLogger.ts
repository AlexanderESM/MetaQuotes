export type ApiLogEvent =
  | {
      kind: "request";
      workerIndex: string;
      method: string;
      url: string;
      requestSeq: number;
      attempt: number;
      maxAttempts: number;
      correlationId: string;
    }
  | {
      kind: "response";
      workerIndex: string;
      method: string;
      url: string;
      requestSeq: number;
      attempt: number;
      maxAttempts: number;
      correlationId: string;
      status: number;
      retryInMs?: number;
    }
  | {
      kind: "error";
      workerIndex: string;
      method: string;
      url: string;
      requestSeq: number;
      attempt: number;
      maxAttempts: number;
      correlationId: string;
      message: string;
      retryInMs?: number;
    }
  | {
      kind: "cb_block";
      reason: string;
      openedUntilIso?: string | null;
    };

export function isCi(): boolean {
  return !!process.env.CI;
}

export function logApiEvent(e: ApiLogEvent) {
  if (!isCi()) return;

  if (e.kind === "cb_block") {
    const until = e.openedUntilIso ? ` until ${e.openedUntilIso}` : "";
    console.log(`[API] SharedCB OPEN${until} (blocked): ${e.reason}`);
    return;
  }

  const base = `[API] w${e.workerIndex} ${e.method} ${e.url} req${e.requestSeq} a${e.attempt}/${e.maxAttempts} cid=${e.correlationId}`;

  if (e.kind === "request") {
    console.log(`${base} -> sending`);
    return;
  }

  if (e.kind === "response") {
    if (e.retryInMs && e.retryInMs > 0) console.log(`${base} -> ${e.status} (retry in ${e.retryInMs}ms)`);
    else console.log(`${base} -> ${e.status}`);
    return;
  }

  if (e.kind === "error") {
    if (e.retryInMs && e.retryInMs > 0) console.log(`${base} -> ERROR ${e.message} (retry in ${e.retryInMs}ms)`);
    else console.log(`${base} -> ERROR ${e.message}`);
  }
}
