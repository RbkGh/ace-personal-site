import { readFileSync } from "node:fs";
import { makeQuery } from "../lib/db.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Export it (see .env.example) and re-run.");
  process.exit(1);
}

const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");
const statements = schema.split(";").map((s) => s.trim()).filter(Boolean);

const query = makeQuery(url);
for (const stmt of statements) {
  await query(stmt);
}
console.log(`Applied ${statements.length} statements.`);
