// Chỉ bộ nhớ của document hiện tại; không serialize ra storage hoặc gửi máy chủ.
const clearStores = new Set<() => void>();

export function clearTransientDrafts() {
  for (const clear of clearStores) clear();
}

export function createTransientDraftStore<T>(limit = 20, ttlMs = 10 * 60 * 1000) {
  const entries = new Map<string, { baseline: string; value: T; expiresAt: number }>();
  clearStores.add(() => entries.clear());
  return {
    read(key: string, baseline: string, now = Date.now()): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (entry.baseline !== baseline || entry.expiresAt <= now) {
        entries.delete(key);
        return undefined;
      }
      return structuredClone(entry.value);
    },
    write(key: string, baseline: string, value: T, now = Date.now()) {
      entries.delete(key);
      entries.set(key, { baseline, value: structuredClone(value), expiresAt: now + ttlMs });
      while (entries.size > limit) entries.delete(entries.keys().next().value!);
    },
    remove(key: string) { entries.delete(key); },
  };
}
