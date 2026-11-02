import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { freshDb } from "./helpers/pg.js";

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

test("schema applies twice without error", async () => {
  const db = await freshDb();
  try {
    await db.query(schema);
  } finally {
    await db.close();
  }
});

test("pageviews defaults", async () => {
  const db = await freshDb();
  try {
    const id = "11111111-1111-4111-8111-111111111111";
    await db.query("insert into pageviews (page_id) values ($1)", [id]);
    const [row] = await db.query("select * from pageviews where page_id = $1", [id]);
    assert.equal(row.engaged_ms, 0);
    assert.equal(row.max_scroll_pct, 0);
    assert.equal(row.ip_anonymized, false);
    assert.ok(row.created_at);
  } finally {
    await db.close();
  }
});
