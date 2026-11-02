import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

test("vercel.json routes and gates the dashboard", () => {
  assert.equal(cfg.cleanUrls, true);
  assert.deepEqual(cfg.rewrites, [{ source: "/dashboard", destination: "/api/dashboard-page" }]);
  assert.deepEqual(cfg.redirects, [
    { source: "/dashboard/", destination: "/dashboard", permanent: false },
    { source: "/dashboard/:path+", destination: "/dashboard", permanent: false },
  ]);
  assert.deepEqual(cfg.crons, [{ path: "/api/cron/anonymize-ips", schedule: "0 3 * * *" }]);
  assert.equal(cfg.functions["api/dashboard-page.js"].includeFiles, "dashboard/**");
});
