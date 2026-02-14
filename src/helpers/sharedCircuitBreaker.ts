import fs from "node:fs/promises";
import path from "node:path";

export type SharedCircuitBreakerOptions = {
  stateDir: string;
  stateFileName: string;
  lockFileName: string;
  failureThreshold: number;
  coolDownMs: number;
  lockStaleMs: number;
};

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

type State = "CLOSED" | "OPEN";

type SharedState = {
  version: 1;
  state: State;
  consecutiveFailures: number;
  openedUntilMs: number | null;
  lastUpdatedMs: number;
  openedBy?: { pid: number; workerIndex?: string; reason?: string; atMs: number };
};

function now() {
  return Date.now();
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function fileExists(p: string) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function acquireLock(lockPath: string, staleMs: number, timeoutMs = 5000): Promise<() => Promise<void>> {
  const start = now();

  while (true) {
    try {
      const handle = await fs.open(lockPath, "wx");
      await handle.writeFile(String(process.pid), "utf-8");
      await handle.close();

      return async () => {
        try {
          await fs.unlink(lockPath);
        } catch {
          // ignore
        }
      };
    } catch {
      const elapsed = now() - start;
      if (elapsed > timeoutMs) {
        try {
          const st = await fs.stat(lockPath);
          const age = now() - st.mtimeMs;
          if (age > staleMs) {
            await fs.unlink(lockPath);
            continue;
          }
        } catch {
          // ignore
        }
        throw new Error(`Failed to acquire lock within ${timeoutMs}ms: ${lockPath}`);
      }

      await new Promise((r) => setTimeout(r, 50));
    }
  }
}

async function readState(statePath: string): Promise<SharedState> {
  if (!(await fileExists(statePath))) {
    return {
      version: 1,
      state: "CLOSED",
      consecutiveFailures: 0,
      openedUntilMs: null,
      lastUpdatedMs: now()
    };
  }

  try {
    const raw = await fs.readFile(statePath, "utf-8");
    const parsed = JSON.parse(raw) as SharedState;
    if (parsed?.version !== 1) throw new Error("Unknown state version");
    return parsed;
  } catch {
    return {
      version: 1,
      state: "CLOSED",
      consecutiveFailures: 0,
      openedUntilMs: null,
      lastUpdatedMs: now()
    };
  }
}

async function writeState(statePath: string, state: SharedState) {
  const tmp = `${statePath}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), "utf-8");
  await fs.rename(tmp, statePath);
}

export class SharedCircuitBreaker {
  private readonly statePath: string;
  private readonly lockPath: string;

  constructor(private readonly opts: SharedCircuitBreakerOptions) {
    this.statePath = path.join(opts.stateDir, opts.stateFileName);
    this.lockPath = path.join(opts.stateDir, opts.lockFileName);
  }

  async canPass(): Promise<
    | { ok: true }
    | { ok: false; reason: string; openedUntilMs?: number | null; snapshot: SharedState }
  > {
    await ensureDir(this.opts.stateDir);

    const st = await readState(this.statePath);

    if (st.state === "OPEN") {
      const until = st.openedUntilMs ?? 0;
      if (now() < until) {
        return {
          ok: false,
          reason: `OPEN until ${new Date(until).toISOString()}`,
          openedUntilMs: until,
          snapshot: st
        };
      }

      const release = await acquireLock(this.lockPath, this.opts.lockStaleMs);
      try {
        const fresh = await readState(this.statePath);
        if (fresh.state === "OPEN" && (fresh.openedUntilMs ?? 0) <= now()) {
          const next: SharedState = {
            ...fresh,
            state: "CLOSED",
            consecutiveFailures: 0,
            openedUntilMs: null,
            lastUpdatedMs: now()
          };
          await writeState(this.statePath, next);
          return { ok: true };
        }

        return fresh.state === "OPEN" && now() < (fresh.openedUntilMs ?? 0)
          ? { ok: false, reason: `OPEN until ${new Date(fresh.openedUntilMs!).toISOString()}`, openedUntilMs: fresh.openedUntilMs, snapshot: fresh }
          : { ok: true };
      } finally {
        await release();
      }
    }

    return { ok: true };
  }

  async onSuccess() {
    await ensureDir(this.opts.stateDir);
    const release = await acquireLock(this.lockPath, this.opts.lockStaleMs);
    try {
      const st = await readState(this.statePath);
      if (st.consecutiveFailures === 0 && st.state === "CLOSED") return;

      const next: SharedState = {
        ...st,
        state: "CLOSED",
        consecutiveFailures: 0,
        openedUntilMs: null,
        lastUpdatedMs: now()
      };
      await writeState(this.statePath, next);
    } finally {
      await release();
    }
  }

  async onFailureRetriable(reason?: string) {
    await ensureDir(this.opts.stateDir);
    const release = await acquireLock(this.lockPath, this.opts.lockStaleMs);
    try {
      const st = await readState(this.statePath);
      const nextFailures = (st.consecutiveFailures ?? 0) + 1;

      if (nextFailures >= this.opts.failureThreshold) {
        const until = now() + this.opts.coolDownMs;
        const next: SharedState = {
          ...st,
          state: "OPEN",
          consecutiveFailures: nextFailures,
          openedUntilMs: until,
          lastUpdatedMs: now(),
          openedBy: {
            pid: process.pid,
            workerIndex: process.env.TEST_WORKER_INDEX,
            reason,
            atMs: now()
          }
        };
        await writeState(this.statePath, next);
        return;
      }

      const next: SharedState = {
        ...st,
        state: "CLOSED",
        consecutiveFailures: nextFailures,
        openedUntilMs: null,
        lastUpdatedMs: now()
      };
      await writeState(this.statePath, next);
    } finally {
      await release();
    }
  }

  async snapshot(): Promise<SharedState> {
    await ensureDir(this.opts.stateDir);
    return readState(this.statePath);
  }

  makeOpenError(extra?: string) {
    return new CircuitBreakerOpenError(extra ?? "Shared circuit breaker is OPEN");
  }
}
