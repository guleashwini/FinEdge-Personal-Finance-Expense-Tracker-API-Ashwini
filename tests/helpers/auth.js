import request from 'supertest';
import { createTokenService } from '../../src/services/token.service.js';

export const tokenService = createTokenService({ secret: 'test-secret' });

export function asUser(app, userId = 'user-a') {
  const token = tokenService.signToken({ sub: userId, email: `${userId}@example.com` });
  return request.agent(app).set('Authorization', `Bearer ${token}`);
}
