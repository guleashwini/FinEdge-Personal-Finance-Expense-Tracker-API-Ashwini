function numberFromEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set when NODE_ENV is production.');
}

export const config = {
  port: numberFromEnv('PORT', 3000),
  cacheTtlMs: numberFromEnv('CACHE_TTL_MS', 30_000),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresInSeconds: numberFromEnv('JWT_EXPIRES_IN_SECONDS', 3600),
};
