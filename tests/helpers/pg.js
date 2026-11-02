import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../../db/schema.sql", import.meta.url), "utf8");

// In-memory Postgres with the production schema applied.
// Returns { query, close } where query matches the app's Query type.
export async function freshDb() {
  const db = new PGlite();
  await db.exec(schema);
  const query = async (text, params) => {
    if (params === undefined) {
      // exec supports multi-statement scripts (the extended protocol does not)
      const results = await db.exec(text);
      return results.length ? results[results.length - 1].rows : [];
    }
    return (await db.query(text, params)).rows;
  };
  return { query, close: () => db.close() };
}
