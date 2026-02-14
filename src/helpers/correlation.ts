import crypto from "node:crypto";

export function getRunId(): string {
  return process.env.TEST_RUN_ID ?? crypto.randomUUID();
}

export function buildCorrelationId(params: {
  runId: string;
  workerIndex: string;
  requestSeq: number;
  attempt: number;
}): string {
  return `${params.runId}|w${params.workerIndex}|req${params.requestSeq}|a${params.attempt}`;
}
