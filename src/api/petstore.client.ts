import type { APIRequestContext, APIResponse, TestInfo } from "@playwright/test";
import { expect } from "@playwright/test";

import { attachJson, attachText, attachRetryLog } from "../helpers/attachments.js";
import { logApiEvent } from "../helpers/ciLogger.js";
import { getRunId, buildCorrelationId } from "../helpers/correlation.js";
import {
  RetryOptions,
  calcBackoffDelayMs,
  isRetriableError,
  isRetriableStatus,
  sleep,
  parseRetryAfterMs,
  isRetryAfterEligibleStatus
} from "../helpers/retry.js";
import { SharedCircuitBreaker } from "../helpers/sharedCircuitBreaker.js";
import type { Pet } from "../helpers/data.builders.js";

import { API_PREFIX } from "./constants.js";



type CallMeta = {
  method: string;
  url: string;
  requestBody?: unknown;
};

type LastCallInfo = {
  baseName: string;
  method: string;
  url: string;
  workerIndex: string;
  runId: string;
  requestSeq: number;
  attempt: number;
  correlationId: string;
};

export class PetstoreClient {
  private readonly retryOpts: RetryOptions = {
    maxAttempts: Number(process.env.API_RETRY_ATTEMPTS ?? 3),
    baseDelayMs: Number(process.env.API_RETRY_BASE_DELAY_MS ?? 200),
    maxDelayMs: Number(process.env.API_RETRY_MAX_DELAY_MS ?? 2000),
    jitterRatio: 0.2
  };

  private readonly sharedCb = new SharedCircuitBreaker({
    stateDir: process.env.API_CB_STATE_DIR ?? ".tmp",
    stateFileName: "cb-state.json",
    lockFileName: "cb-state.lock",
    failureThreshold: Number(process.env.API_CB_FAILURE_THRESHOLD ?? 6),
    coolDownMs: Number(process.env.API_CB_COOLDOWN_MS ?? 30_000),
    lockStaleMs: Number(process.env.API_CB_LOCK_STALE_MS ?? 10_000)
  });

  private readonly runId = getRunId();
  private readonly workerIndex = process.env.TEST_WORKER_INDEX ?? "0";
  private requestSeq = 0;

  private lastCallInfo: LastCallInfo | null = null;

  constructor(
    private readonly request: APIRequestContext,
    private readonly testInfo: TestInfo
  ) {}

  getLastCallInfo(): LastCallInfo | null {
    return this.lastCallInfo;
  }

  private nextSeq() {
    this.requestSeq += 1;
    return this.requestSeq;
  }

  private attachBaseName(meta: CallMeta, seq: number) {
    const safeUrl = meta.url
      .replaceAll("/", "_")
      .replaceAll("?", "_")
      .replaceAll("{", "_")
      .replaceAll("}", "_");

    return `api.${seq}.${meta.method}.${safeUrl}`;
  }

  private async safeBodyText(res: APIResponse): Promise<string> {
    try {
      return await res.text();
    } catch {
      return "<no body>";
    }
  }

  private async attachCall(
    baseName: string,
    meta: CallMeta & { correlationId: string; attempt: number; requestSeq: number },
    res: APIResponse,
    bodyText: string
  ) {
    await attachJson(this.testInfo, `${baseName}.request`, {
      method: meta.method,
      url: meta.url,
      workerIndex: this.workerIndex,
      runId: this.runId,
      requestSeq: meta.requestSeq,
      attempt: meta.attempt,
      correlationId: meta.correlationId,
      body: meta.requestBody ?? null
    });

    await attachJson(this.testInfo, `${baseName}.response.meta`, {
      status: res.status(),
      headers: res.headers(),
      workerIndex: this.workerIndex,
      runId: this.runId,
      requestSeq: meta.requestSeq,
      attempt: meta.attempt,
      correlationId: meta.correlationId
    });

    await attachText(this.testInfo, `${baseName}.response.body`, bodyText);
  }

  private async callWithRetry(
    meta: CallMeta,
    fn: (headers: Record<string, string>) => Promise<APIResponse>
  ): Promise<APIResponse> {
    const log: string[] = [];
    const { maxAttempts } = this.retryOpts;

    const gate = await this.sharedCb.canPass();
    if (!gate.ok) {
      log.push(`[SharedCB] blocked: ${gate.reason}`);
      log.push(`[SharedCB] snapshot: ${JSON.stringify(gate.snapshot)}`);
      await attachRetryLog(this.testInfo, `api.retry.${meta.method}.${meta.url}`, log);

      logApiEvent({
        kind: "cb_block",
        reason: gate.reason,
        openedUntilIso: gate.openedUntilMs
          ? new Date(gate.openedUntilMs).toISOString()
          : null
      });

      throw this.sharedCb.makeOpenError(gate.reason);
    }

    const reqSeq = this.nextSeq();
    const baseName = this.attachBaseName(meta, reqSeq);

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const correlationId = buildCorrelationId({
        runId: this.runId,
        workerIndex: this.workerIndex,
        requestSeq: reqSeq,
        attempt
      });

      const headers = { "x-correlation-id": correlationId };
      const prefix = `[${meta.method} ${meta.url}] w${this.workerIndex} req${reqSeq} attempt ${attempt}/${maxAttempts}`;

      logApiEvent({
        kind: "request",
        workerIndex: this.workerIndex,
        method: meta.method,
        url: meta.url,
        requestSeq: reqSeq,
        attempt,
        maxAttempts,
        correlationId
      });

      try {
        const res = await fn(headers);
        const status = res.status();
        const bodyText = await this.safeBodyText(res);
        const resHeaders = res.headers();

        log.push(`${prefix} -> status ${status} cid=${correlationId}`);

        await this.attachCall(
          baseName,
          { ...meta, correlationId, attempt, requestSeq: reqSeq },
          res,
          bodyText
        );

        this.lastCallInfo = {
          baseName,
          method: meta.method,
          url: meta.url,
          workerIndex: this.workerIndex,
          runId: this.runId,
          requestSeq: reqSeq,
          attempt,
          correlationId
        };

        if (attempt < maxAttempts && isRetryAfterEligibleStatus(status)) {
          const raMs = parseRetryAfterMs(resHeaders);
          if (raMs !== null && raMs > 0) {
            logApiEvent({
              kind: "response",
              workerIndex: this.workerIndex,
              method: meta.method,
              url: meta.url,
              requestSeq: reqSeq,
              attempt,
              maxAttempts,
              correlationId,
              status,
              retryInMs: raMs
            });

            await this.sharedCb.onFailureRetriable(`status=${status} retry-after`);
            await sleep(raMs);
            continue;
          }
        }

        if (attempt < maxAttempts && isRetriableStatus(status)) {
          const delay = calcBackoffDelayMs(attempt, this.retryOpts);

          logApiEvent({
            kind: "response",
            workerIndex: this.workerIndex,
            method: meta.method,
            url: meta.url,
            requestSeq: reqSeq,
            attempt,
            maxAttempts,
            correlationId,
            status,
            retryInMs: delay
          });

          await this.sharedCb.onFailureRetriable(`status=${status}`);
          await sleep(delay);
          continue;
        }

        if (isRetriableStatus(status))
          await this.sharedCb.onFailureRetriable(`status=${status}`);
        else
          await this.sharedCb.onSuccess();

        await attachRetryLog(this.testInfo, `${baseName}.retry.log`, log);
        return res;
      } catch (e) {
        lastError = e;

        if (attempt < maxAttempts && isRetriableError(e)) {
          const delay = calcBackoffDelayMs(attempt, this.retryOpts);
          await this.sharedCb.onFailureRetriable("network error");
          await sleep(delay);
          continue;
        }

        await attachRetryLog(this.testInfo, `${baseName}.retry.log`, log);
        throw e;
      }
    }

    await this.sharedCb.onFailureRetriable("exhausted attempts");
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async createPet(pet: Pet): Promise<APIResponse> {
    const url = `${API_PREFIX}/pet`;

    const res = await this.callWithRetry(
      { method: "POST", url, requestBody: pet },
      (headers) => this.request.post(url, { data: pet, headers })
    );

    expect([200, 201]).toContain(res.status());
    return res;
  }

  async getPet(petId: number): Promise<APIResponse> {
    const url = `${API_PREFIX}/pet/${petId}`;

    return this.callWithRetry(
      { method: "GET", url },
      (headers) => this.request.get(url, { headers })
    );
  }

  async updatePetWithForm(
    petId: number,
    form: { name?: string; status?: string }
  ): Promise<APIResponse> {
    const url = `${API_PREFIX}/pet/${petId}`;

    return this.callWithRetry(
      { method: "POST", url, requestBody: { form } },
      (headers) => this.request.post(url, { form, headers })
    );
  }
}
