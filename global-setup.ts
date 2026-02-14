import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

async function safeUnlink(p: string) {
  try {
    await fs.unlink(p);
  } catch {
    // ignore
  }
}

export default async function globalSetup() {
 
  if (!process.env.TEST_RUN_ID) {
    process.env.TEST_RUN_ID = crypto.randomUUID();
  }

  const stateDir = process.env.API_CB_STATE_DIR ?? ".tmp";
  const statePath = path.join(stateDir, "cb-state.json");
  const lockPath = path.join(stateDir, "cb-state.lock");

  await fs.mkdir(stateDir, { recursive: true });

  await safeUnlink(lockPath);
  await safeUnlink(statePath);
}
