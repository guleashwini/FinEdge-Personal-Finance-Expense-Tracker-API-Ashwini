import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { mkdtemp, rm } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { readJsonFile } from '../src/services/json-file.service.js';
import { createUserService } from '../src/services/user.service.js';

async function createTestApp(t) {
  const directory = await mkdtemp(join(tmpdir(), 'finedge-users-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const usersFilePath = join(directory, 'users.json');
  const userService = createUserService({ usersFilePath });
  return { app: createApp({ userService }), usersFilePath };
}

test('POST /users creates a user and stores only a password hash', async (t) => {
  const { app, usersFilePath } = await createTestApp(t);
  const response = await request(app).post('/users').send({
    name: '  Ada Lovelace  ',
    email: ' ADA@example.com ',
    password: 'safe-password-123',
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.user.name, 'Ada Lovelace');
  assert.equal(response.body.user.email, 'ada@example.com');
  assert.ok(response.body.user.id);
  assert.ok(response.body.user.createdAt);
  assert.equal('password' in response.body.user, false);
  assert.equal('passwordHash' in response.body.user, false);

  const [storedUser] = await readJsonFile(usersFilePath, []);
  assert.notEqual(storedUser.passwordHash, 'safe-password-123');
  assert.equal(await bcrypt.compare('safe-password-123', storedUser.passwordHash), true);
});

test('POST /users rejects invalid registration fields', async (t) => {
  const { app } = await createTestApp(t);
  const invalidUsers = [
    { name: '', email: 'ada@example.com', password: 'safe-password-123' },
    { name: 'Ada', email: 'not-an-email', password: 'safe-password-123' },
    { name: 'Ada', email: 'ada@example.com', password: 'short' },
  ];

  for (const user of invalidUsers) {
    const response = await request(app).post('/users').send(user);
    assert.equal(response.status, 400);
    assert.equal(typeof response.body.error.message, 'string');
  }
});

test('POST /users rejects an email that is already registered', async (t) => {
  const { app } = await createTestApp(t);
  const user = {
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    password: 'safe-password-123',
  };

  const firstResponse = await request(app).post('/users').send(user);
  const duplicateResponse = await request(app).post('/users').send({
    ...user,
    email: 'ADA@example.com',
  });

  assert.equal(firstResponse.status, 201);
  assert.equal(duplicateResponse.status, 409);
  assert.equal(duplicateResponse.body.error.message, 'An account with this email already exists.');
});
