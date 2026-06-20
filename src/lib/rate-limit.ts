/**
 * 内存限流器（审计 I9）。
 *
 * 按 key（如 IP + email）在固定时间窗口内计数，超限返回 false。
 * 使用进程内 Map，适用于单实例部署；多实例应换 Redis（@upstash/ratelimit）。
 *
 * 注意：Next.js 开发模式下路由可能在多个 worker 进程，此实现按进程隔离，
 * 生产单实例足够；如需严格全局限流请迁移到 Upstash。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// 定期清理过期桶，防止内存无限增长
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [k, b] of buckets) {
    if (b.resetAt <= now) buckets.delete(k);
  }
}

/**
 * 检查是否允许请求，并在允许时计数 +1。
 * @param key 限流键（如 `signup:${ip}:${email}`）
 * @param limit 时间窗内最大次数
 * @param windowMs 时间窗（毫秒）
 * @returns { allowed: boolean; remaining: number; resetAt: number }
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  cleanup(now);
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt };
}

/**
 * 从 Next.js Request 提取客户端 IP（兼容反向代理）。
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
