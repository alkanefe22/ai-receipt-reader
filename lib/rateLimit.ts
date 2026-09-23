/**
 * Simple fixed-window rate limiter for live mode.
 *
 * Default store is in-memory: fine for a single instance / local dev, but on
 * serverless each instance keeps its own counters. Set UPSTASH_REDIS_REST_* to
 * share counters across instances (plain REST calls, no extra dependency).
 */

export type RateLimitResult = { ok: boolean; limit: number; remaining: number; resetAt: number };
type Options = { max: number; windowSeconds: number; upstash?: { url: string; token: string } };

const memory = new Map<string, { count: number; resetAt: number }>();

function sweep(now: number) {
  if (memory.size < 5000) return;
  for (const [key, entry] of memory) if (entry.resetAt <= now) memory.delete(key);
}

function memoryHit(key: string, { max, windowSeconds }: Options, now: number): RateLimitResult {
  sweep(now);
  let entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowSeconds * 1000 };
    memory.set(key, entry);
  }
  entry.count++;
  return { ok: entry.count <= max, limit: max, remaining: Math.max(0, max - entry.count), resetAt: entry.resetAt };
}

async function upstashHit(key: string, opts: Options, now: number): Promise<RateLimitResult> {
  const { url, token } = opts.upstash!;
  const redisKey = `rl:${key}:${Math.floor(now / 1000 / opts.windowSeconds)}`;
  const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["EXPIRE", redisKey, String(opts.windowSeconds), "NX"],
    ]),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash responded ${res.status}`);
  const [{ result: count }] = (await res.json()) as [{ result: number }, unknown];
  const windowMs = opts.windowSeconds * 1000;
  return {
    ok: count <= opts.max,
    limit: opts.max,
    remaining: Math.max(0, opts.max - count),
    resetAt: (Math.floor(now / windowMs) + 1) * windowMs,
  };
}

export async function rateLimit(key: string, opts: Options, now = Date.now()): Promise<RateLimitResult> {
  if (opts.upstash) {
    try {
      return await upstashHit(key, opts, now);
    } catch (err) {
      // Fail over to in-memory rather than blocking every request.
      console.warn("[rateLimit] Upstash unavailable, using in-memory limiter:", (err as Error).message);
    }
  }
  return memoryHit(key, opts, now);
}

/** Best-effort client IP; Vercel sets x-forwarded-for with the client first. */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip") || "anonymous";
}

/** Test hook. */
export function __resetMemoryRateLimit() {
  memory.clear();
}
