import { test as base } from "@playwright/test";
import { PetstoreClient } from "../api/petstore.client.js";
import { SharedCircuitBreaker } from "../helpers/sharedCircuitBreaker.js";
import { attachJson } from "../helpers/attachments.js";
import { expect } from "../helpers/apiExpect.js";

type ApiFixtures = {
  petstore: PetstoreClient;
  sharedCb: SharedCircuitBreaker;
  apiStep: <T>(title: string, fn: () => Promise<T> | T) => Promise<T>;
};

type GlobalApiCtx = {
  petstore?: { getLastCallInfo: () => any };
};

function getCtx(): GlobalApiCtx {
  return (globalThis as any).__apiTestContext ?? {};
}

function enhanceError(e: unknown) {
  if (!(e instanceof Error)) return e;

  const ctx = getCtx();
  const last = ctx.petstore?.getLastCallInfo?.();
  if (!last) return e;

  e.message +=
    `\n\n--- API context ---` +
    `\n${last.method} ${last.url}` +
    `\nworkerIndex=w${last.workerIndex} runId=${last.runId}` +
    `\ncorrelationId=${last.correlationId}` +
    `\nSee attachments: ${last.baseName}.request / ${last.baseName}.response.* / ${last.baseName}.retry.log`;

  return e;
}

export const test = base.extend<ApiFixtures>({
  sharedCb: async ({}, use) => {
    const cb = new SharedCircuitBreaker({
      stateDir: process.env.API_CB_STATE_DIR ?? ".tmp",
      stateFileName: "cb-state.json",
      lockFileName: "cb-state.lock",
      failureThreshold: Number(process.env.API_CB_FAILURE_THRESHOLD ?? 6),
      coolDownMs: Number(process.env.API_CB_COOLDOWN_MS ?? 30_000),
      lockStaleMs: Number(process.env.API_CB_LOCK_STALE_MS ?? 10_000)
    });
    await use(cb);
  },

  petstore: async ({ request }, use, testInfo) => {
    const client = new PetstoreClient(request, testInfo);
    (globalThis as any).__apiTestContext = { petstore: client };
    await use(client);
  },

  apiStep: async ({}, use) => {
    await use(async (title, fn) => {
      return base.step(title, async () => {
        try {
          return await fn();
        } catch (e) {
          throw enhanceError(e);
        }
      });
    });
  }
});

test.afterEach(async ({ sharedCb, petstore }, testInfo) => {
  (globalThis as any).__apiTestContext = {};

  const failed =
    testInfo.status !== testInfo.expectedStatus ||
    testInfo.status === "failed" ||
    testInfo.status === "timedOut";

  if (!failed) return;

  const snap = await sharedCb.snapshot();
  await attachJson(testInfo, "shared-circuit-breaker.snapshot", {
    ...snap,
    openedUntilIso: snap.openedUntilMs ? new Date(snap.openedUntilMs).toISOString() : null,
    lastUpdatedIso: new Date(snap.lastUpdatedMs).toISOString()
  });

  const last = petstore.getLastCallInfo?.() ?? null;
  if (last) {
    await attachJson(testInfo, "api.lastCallInfo", last);
  }
});

export { expect };
