/**
 * Fixed-window rate limiter backed by process memory.
 *
 * Scope and limitation: this protects a single application instance. Behind a
 * load balancer each instance keeps its own counters, so a distributed attacker
 * gets `instances × limit`. That is an acceptable trade-off for credential
 * stuffing on a self-hosted single-user app; if you run more than one instance,
 * swap `hits` for a shared store (Redis `INCR` + `EXPIRE`) — the interface is
 * deliberately narrow so that is a one-file change.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Keeps the map from growing without bound in a long-running process. */
function sweep(now: number): void {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: limit - bucket.count,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}

/** Clears the counter after a successful action (e.g. a correct password). */
export function resetRateLimit(key: string): void {
  buckets.delete(key);
}

/** Test helper. */
export function clearAllRateLimits(): void {
  buckets.clear();
}
