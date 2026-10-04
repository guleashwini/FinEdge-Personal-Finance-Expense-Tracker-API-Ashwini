export function createCache({ ttlMs = 30_000, now = Date.now } = {}) {
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new RangeError('Cache TTL must be a positive number of milliseconds.');
  }

  const entries = new Map();

  return {
    get(key) {
      const entry = entries.get(key);
      if (!entry) {
        return undefined;
      }

      if (entry.expiresAt <= now()) {
        entries.delete(key);
        return undefined;
      }

      return entry.value;
    },

    set(key, value) {
      entries.set(key, {
        value,
        expiresAt: now() + ttlMs,
      });
      return value;
    },

    delete(key) {
      entries.delete(key);
    },

    clear() {
      entries.clear();
    },
  };
}
