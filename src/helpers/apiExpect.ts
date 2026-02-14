import { expect as pwExpect } from "@playwright/test";

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

function wrapMatchers<T extends object>(obj: T): T {
  return new Proxy(obj, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);

      if (value && typeof value === "object") {
        return wrapMatchers(value as object) as any;
      }

      if (typeof value === "function") {
        return (...args: any[]) => {
          try {
            return (value as Function).apply(target, args);
          } catch (e) {
            throw enhanceError(e);
          }
        };
      }

      return value;
    }
  }) as T;
}

function apiExpect(actual: any, messageOrOptions?: any) {
  return wrapMatchers(pwExpect(actual, messageOrOptions));
}

apiExpect.soft = (actual: any, messageOrOptions?: any) => {
  return wrapMatchers((pwExpect as any).soft(actual, messageOrOptions));
};

apiExpect.poll = (pwExpect as any).poll?.bind(pwExpect);
apiExpect.extend = (pwExpect as any).extend?.bind(pwExpect);
apiExpect.configure = (pwExpect as any).configure?.bind(pwExpect);
apiExpect.getState = (pwExpect as any).getState?.bind(pwExpect);
apiExpect.setState = (pwExpect as any).setState?.bind(pwExpect);

export const expect = apiExpect as typeof pwExpect;
