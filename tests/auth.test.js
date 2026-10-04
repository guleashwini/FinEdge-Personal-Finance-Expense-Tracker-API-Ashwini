import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { authenticate } from '../src/middleware/authenticate.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { createTokenService } from '../src/services/token.service.js';
import { createUserService } from '../src/services/user.service.js';

const credentials = { email: 'ada@example.com', password: 'safe-password-123' };

async function createTestApp(t) {
  const directory = await mkdtemp(join(tmpdir(), 'finedge-auth-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const userService = createUserService({ usersFilePath: join(directory, 'users.json') });
  const tokenService = createTokenService({ secret: 'test-secret' });
  const app = createApp({ userService, tokenService });

  await request(app).post('/users').send({ name: 'Ada', ...credentials });
  return { app, tokenService };
}

test('POST /auth/login returns a token that verifies for the user', async (t) => {
  const { app, tokenService } = await createTestApp(t);
  const response = await request(app).post('/auth/login').send({
    email: ' ADA@example.com ',
    password: credentials.password,
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.email, 'ada@example.com');
  assert.equal('passwordHash' in response.body.user, false);

  const payload = tokenService.verifyToken(response.body.token);
  assert.equal(payload.sub, response.body.user.id);
});

test('POST /auth/login gives the same 401 for a wrong password and an unknown email', async (t) => {
  const { app } = await createTestApp(t);
  const wrongPassword = await request(app)
    .post('/auth/login')
    .send({ email: credentials.email, password: 'wrong-password' });
  const unknownEmail = await request(app)
    .post('/auth/login')
    .send({ email: 'nobody@example.com', password: credentials.password });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.equal(wrongPassword.body.error.message, unknownEmail.body.error.message);
});

test('verifyToken rejects tampered, malformed and expired tokens', () => {
  let currentTime = 1_000_000;
  const tokenService = createTokenService({
    secret: 'test-secret',
    expiresInSeconds: 60,
    now: () => currentTime,
  });
  const token = tokenService.signToken({ sub: 'user-1', email: 'ada@example.com' });
  const [header, , signature] = token.split('.');
  const forgedPayload = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9_999_999_999 })).toString('base64url');

  assert.equal(tokenService.verifyToken(token).sub, 'user-1');
  assert.throws(() => tokenService.verifyToken(`${header}.${forgedPayload}.${signature}`), { statusCode: 401 });
  assert.throws(() => tokenService.verifyToken('not-a-token'), { statusCode: 401 });

  currentTime += 61_000;
  assert.throws(() => tokenService.verifyToken(token), { statusCode: 401 });
});

test('authenticate middleware accepts a valid bearer token and rejects everything else', async () => {
  const tokenService = createTokenService({ secret: 'test-secret' });
  const app = express();
  app.get('/protected', authenticate(tokenService), (req, res) => res.json({ user: req.user }));
  app.use(errorHandler);

  const token = tokenService.signToken({ sub: 'user-1', email: 'ada@example.com' });
  const allowed = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
  const missing = await request(app).get('/protected');
  const bad = await request(app).get('/protected').set('Authorization', 'Bearer nope');

  assert.equal(allowed.status, 200);
  assert.deepEqual(allowed.body.user, { id: 'user-1', email: 'ada@example.com' });
  assert.equal(missing.status, 401);
  assert.equal(bad.status, 401);
});
