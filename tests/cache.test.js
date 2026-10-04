import assert from 'node:assert/strict';
import test from 'node:test';
import { createCache } from '../src/services/cache.service.js';

test('cache returns a value before its TTL expires', () => {
  let currentTime = 1_000;
  const cache = createCache({ ttlMs: 100, now: () => currentTime });

  cache.set('summary', { balance: 250 });
  currentTime += 99;

  assert.deepEqual(cache.get('summary'), { balance: 250 });
});

test('cache treats a value as missing when its TTL expires', () => {
  let currentTime = 1_000;
  const cache = createCache({ ttlMs: 100, now: () => currentTime });

  cache.set('summary', { balance: 250 });
  currentTime += 100;

  assert.equal(cache.get('summary'), undefined);
});

test('clear removes all cached values', () => {
  const cache = createCache();
  cache.set('summary', { balance: 250 });
  cache.set('other', 'value');

  cache.clear();

  assert.equal(cache.get('summary'), undefined);
  assert.equal(cache.get('other'), undefined);
});

test('cache requires a positive finite TTL', () => {
  assert.throws(() => createCache({ ttlMs: 0 }), RangeError);
  assert.throws(() => createCache({ ttlMs: Number.POSITIVE_INFINITY }), RangeError);
});
