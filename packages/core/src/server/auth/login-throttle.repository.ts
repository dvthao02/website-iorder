import { and, eq, or, sql } from "drizzle-orm";

import { getDb } from "@iorder/core/db/client";
import { loginThrottleBuckets } from "@iorder/core/db/schema";

export type LoginThrottleKey = {
  hash: string;
  limit: number;
  scope: "ip" | "username";
};

export type LoginThrottleResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export async function consumeLoginThrottle(keys: readonly LoginThrottleKey[], now: Date, windowMilliseconds: number, database = getDb()): Promise<LoginThrottleResult> {
  const orderedKeys = [...keys].sort((left, right) => `${left.scope}:${left.hash}`.localeCompare(`${right.scope}:${right.hash}`));
  const windowExpiresAt = new Date(now.getTime() + windowMilliseconds);

  return database.transaction(async (tx) => {
    for (const key of orderedKeys) {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${key.scope}:${key.hash}`}, 0::bigint))`);
    }

    const conditions = orderedKeys.map((key) => and(eq(loginThrottleBuckets.scope, key.scope), eq(loginThrottleBuckets.keyHash, key.hash)));
    const rows = await tx.select().from(loginThrottleBuckets).where(or(...conditions));
    const byKey = new Map(rows.map((row) => [`${row.scope}:${row.keyHash}`, row]));
    const blocked = orderedKeys
      .map((key) => ({ key, row: byKey.get(`${key.scope}:${key.hash}`) }))
      .filter(({ key, row }) => row && row.windowExpiresAt > now && row.attempts >= key.limit);

    if (blocked.length) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(...blocked.map(({ row }) => Math.max(1, Math.ceil((row!.windowExpiresAt.getTime() - now.getTime()) / 1_000)))),
      };
    }

    for (const key of orderedKeys) {
      const row = byKey.get(`${key.scope}:${key.hash}`);
      if (row) {
        await tx.update(loginThrottleBuckets)
          .set({ attempts: row.windowExpiresAt > now ? row.attempts + 1 : 1, windowExpiresAt: row.windowExpiresAt > now ? row.windowExpiresAt : windowExpiresAt, updatedAt: now })
          .where(and(eq(loginThrottleBuckets.scope, key.scope), eq(loginThrottleBuckets.keyHash, key.hash)));
      } else {
        await tx.insert(loginThrottleBuckets).values({ scope: key.scope, keyHash: key.hash, attempts: 1, windowExpiresAt, updatedAt: now });
      }
    }

    return { allowed: true };
  });
}

export async function clearLoginThrottle(keys: readonly LoginThrottleKey[], database = getDb()) {
  if (!keys.length) return;
  await database.delete(loginThrottleBuckets).where(or(...keys.map((key) => and(eq(loginThrottleBuckets.scope, key.scope), eq(loginThrottleBuckets.keyHash, key.hash)))));
}

export async function cleanupExpiredLoginThrottles(now: Date, limit = 500, database = getDb()) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5_000) throw new Error("Giới hạn dọn quota đăng nhập không hợp lệ.");
  const result = await database.execute(sql`
    with expired as (
      select ctid from login_throttle_buckets
      where window_expires_at <= ${now.toISOString()}::timestamptz
      order by window_expires_at
      limit ${limit}
    )
    delete from login_throttle_buckets
    where ctid in (select ctid from expired)
  `);
  return result.count;
}
