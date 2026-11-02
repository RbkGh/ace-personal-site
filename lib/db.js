import { neon } from "@neondatabase/serverless";

// Query = (text, params?) => Promise<object[]>
export function makeQuery(databaseUrl) {
  const sql = neon(databaseUrl);
  return (text, params = []) => sql.query(text, params);
}

export function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
