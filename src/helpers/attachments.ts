import type { TestInfo } from "@playwright/test";

export async function attachJson(testInfo: TestInfo, name: string, data: unknown) {
  await testInfo.attach(name, {
    body: Buffer.from(JSON.stringify(data, null, 2), "utf-8"),
    contentType: "application/json",
  });
}

export async function attachText(testInfo: TestInfo, name: string, text: string) {
  await testInfo.attach(name, {
    body: Buffer.from(text, "utf-8"),
    contentType: "text/plain",
  });
}

export async function attachRetryLog(testInfo: TestInfo, name: string, lines: string[]) {
  await attachText(testInfo, name, lines.join("\n"));
}
