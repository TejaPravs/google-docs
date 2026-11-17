import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type DB = NeonHttpDatabase<typeof schema>;

/**
 * Network errors where the TCP connection was never established. Retrying these
 * is always safe — the query never reached Neon, so a write can't be applied twice.
 * (Errors after connecting, e.g. ECONNRESET mid-response, are NOT retried.)
 */
const RETRYABLE_CONNECT_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
]);
const RETRY_DELAYS_MS = [300, 1000];

function connectErrorCode(err: unknown): string | undefined {
  const cause = (err as { cause?: { code?: string } })?.cause;
  return cause?.code;
}

export async function fetchWithConnectRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  baseFetch: typeof fetch = fetch,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await baseFetch(input, init);
    } catch (err) {
      const code = connectErrorCode(err);
      if (attempt >= RETRY_DELAYS_MS.length || !code || !RETRYABLE_CONNECT_CODES.has(code)) throw err;
      console.warn(`[db] ${code} reaching Neon, retry ${attempt + 1}/${RETRY_DELAYS_MS.length}`);
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
}

neonConfig.fetchFunction = (input: RequestInfo | URL, init?: RequestInit) =>
  fetchWithConnectRetry(input, init);

let _db: DB | undefined;

/**
 * Lazily-created Drizzle client over Neon's HTTP driver (one HTTPS request per
 * query — ideal for serverless). Lazy so `next build` doesn't need DATABASE_URL.
 * Services take `db` as a parameter so tests can inject a PGlite instance.
 */
export function getDb(): DB {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
    // Next 14 patches global fetch and caches responses by default. The Neon HTTP
    // driver sends every SQL query through fetch, so opt out or reads go stale.
    _db = drizzle(neon(url, { fetchOptions: { cache: "no-store" } }), { schema });
  }
  return _db;
}
