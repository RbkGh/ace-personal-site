import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.js",
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    ...(process.env.PW_CHANNEL ? { channel: process.env.PW_CHANNEL } : {}),
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "node tests/e2e/server.js",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
  },
});
