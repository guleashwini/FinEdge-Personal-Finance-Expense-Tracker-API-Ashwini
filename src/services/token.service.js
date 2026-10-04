import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config.js';
import { AppError } from '../utils/app-error.js';

const header = { alg: 'HS256', typ: 'JWT' };

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function createTokenService({
  secret = config.jwtSecret,
  expiresInSeconds = config.jwtExpiresInSeconds,
  now = Date.now,
} = {}) {
  const sign = (data) => createHmac('sha256', secret).update(data).digest('base64url');

  return {
    signToken({ sub, email }) {
      const issuedAt = Math.floor(now() / 1000);
      const payload = { sub, email, iat: issuedAt, exp: issuedAt + expiresInSeconds };
      const unsigned = `${encode(header)}.${encode(payload)}`;
      return `${unsigned}.${sign(unsigned)}`;
    },

    verifyToken(token) {
      const invalid = () => new AppError('Invalid or expired token.', 401);

      const parts = typeof token === 'string' ? token.split('.') : [];
      if (parts.length !== 3) {
        throw invalid();
      }

      const [encodedHeader, encodedPayload, signature] = parts;
      const expected = Buffer.from(sign(`${encodedHeader}.${encodedPayload}`));
      const received = Buffer.from(signature);
      if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
        throw invalid();
      }

      let payload;
      try {
        payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
      } catch {
        throw invalid();
      }

      if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(now() / 1000)) {
        throw invalid();
      }

      return payload;
    },
  };
}

export const tokenService = createTokenService();
