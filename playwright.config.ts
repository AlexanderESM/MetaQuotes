import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html"]] : [["html"]],
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: "https://petstore.swagger.io",
    trace: "on-first-retry"
  }
});
