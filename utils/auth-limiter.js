import { createHash } from "node:crypto";

// Per-process protection. Never trust client-provided forwarded IP headers.
export function createAuthLimiter({ limit = 20, windowMs = 15 * 60 * 1000, maxKeys = 10000, now = Date.now } = {}) {
  for (const value of [limit, windowMs, maxKeys]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error("Invalid authentication limit");
  }
  const buckets = new Map();
  return (req, res, next) => {
    const time = now();
    const key = createHash("sha256").update(req.socket.remoteAddress || "unknown").digest("hex");
    let bucket = buckets.get(key);
    if (bucket && bucket.resetAt <= time) {
      buckets.delete(key);
      bucket = undefined;
    }
    if (!bucket && buckets.size >= maxKeys) {
      for (const [storedKey, stored] of buckets) {
        if (stored.resetAt <= time) buckets.delete(storedKey);
      }
    }
    const reject = resetAt => res.set("Retry-After", String(Math.max(1, Math.ceil((resetAt - time) / 1000))))
      .status(429).json({ message: "Too many account attempts. Please try again later." });
    if (!bucket) {
      // Fail closed rather than evict active limits when the bounded store fills.
      if (buckets.size >= maxKeys) {
        let earliest = Infinity;
        for (const stored of buckets.values()) earliest = Math.min(earliest, stored.resetAt);
        return reject(earliest);
      }
      bucket = { count: 0, resetAt: time + windowMs };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit) return reject(bucket.resetAt);
    bucket.count += 1;
    return next();
  };
}
