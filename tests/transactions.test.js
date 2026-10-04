import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { asUser, tokenService } from './helpers/auth.js';
import { createTransactionService } from '../src/services/transaction.service.js';

async function createTestApp(t) {
  const directory = await mkdtemp(join(tmpdir(), 'finedge-transactions-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const transactionsFilePath = join(directory, 'transactions.json');
  const transactionService = createTransactionService({ transactionsFilePath });
  const app = createApp({ transactionService, tokenService });
  return { app, api: asUser(app) };
}

const validTransaction = {
  type: 'expense',
  category: '  groceries  ',
  amount: 45.75,
  date: '2026-10-03',
};

test('transaction endpoints support create, list, view, update, and delete', async (t) => {
  const { api } = await createTestApp(t);

  const createResponse = await api
    .post('/transactions')
    .send(validTransaction);
  assert.equal(createResponse.status, 201);
  assert.equal(createResponse.body.transaction.category, 'groceries');
  assert.equal(createResponse.body.transaction.type, 'expense');
  assert.ok(createResponse.body.transaction.id);
  assert.ok(createResponse.body.transaction.createdAt);
  assert.ok(createResponse.body.transaction.updatedAt);

  const id = createResponse.body.transaction.id;
  const listResponse = await api.get('/transactions');
  assert.equal(listResponse.status, 200);
  assert.equal(listResponse.body.transactions.length, 1);

  const getResponse = await api.get(`/transactions/${id}`);
  assert.equal(getResponse.status, 200);
  assert.equal(getResponse.body.transaction.id, id);

  const updateResponse = await api
    .patch(`/transactions/${id}`)
    .send({ amount: 50, category: 'food' });
  assert.equal(updateResponse.status, 200);
  assert.equal(updateResponse.body.transaction.amount, 50);
  assert.equal(updateResponse.body.transaction.category, 'food');
  assert.equal(updateResponse.body.transaction.type, 'expense');

  const deleteResponse = await api.delete(`/transactions/${id}`);
  assert.equal(deleteResponse.status, 204);

  const finalListResponse = await api.get('/transactions');
  assert.deepEqual(finalListResponse.body.transactions, []);
});

test('transaction endpoints reject invalid create and update data', async (t) => {
  const { api } = await createTestApp(t);
  const invalidResponse = await api
    .post('/transactions')
    .send({ ...validTransaction, amount: -1 });

  assert.equal(invalidResponse.status, 400);
  assert.match(invalidResponse.body.error.message, /Amount must be a positive number/);

  const emptyUpdateResponse = await api
    .patch('/transactions/not-used')
    .send({ unrelated: 'field' });
  assert.equal(emptyUpdateResponse.status, 400);
});

test('transaction endpoints return 404 when the record does not exist', async (t) => {
  const { api } = await createTestApp(t);
  const response = await api.get('/transactions/missing-id');

  assert.equal(response.status, 404);
  assert.equal(response.body.error.message, 'Transaction not found.');
});

test('GET /transactions supports category and date filtering', async (t) => {
  const { api } = await createTestApp(t);

  await api.post('/transactions').send({
    type: 'expense',
    category: 'food',
    amount: 12,
    date: '2026-10-01',
  });
  await api.post('/transactions').send({
    type: 'expense',
    category: 'travel',
    amount: 50,
    date: '2026-10-05',
  });
  await api.post('/transactions').send({
    type: 'income',
    category: 'salary',
    amount: 300,
    date: '2026-10-15',
  });

  const categoryResponse = await api.get('/transactions?category=food');
  assert.equal(categoryResponse.status, 200);
  assert.equal(categoryResponse.body.transactions.length, 1);
  assert.equal(categoryResponse.body.transactions[0].category, 'food');

  const dateResponse = await api.get('/transactions?from=2026-10-02&to=2026-10-16');
  assert.equal(dateResponse.status, 200);
  assert.equal(dateResponse.body.transactions.length, 2);
  assert.ok(dateResponse.body.transactions.every((transaction) =>
    transaction.date >= '2026-10-02' && transaction.date <= '2026-10-16',
  ));

  const invalidDateResponse = await api.get('/transactions?from=invalid-date');
  assert.equal(invalidDateResponse.status, 400);
  assert.match(invalidDateResponse.body.error.message, /valid date/i);
});

test('transaction endpoints require a valid token', async (t) => {
  const { app } = await createTestApp(t);
  const anonymous = request(app);

  assert.equal((await anonymous.get('/transactions')).status, 401);
  assert.equal((await anonymous.post('/transactions').send(validTransaction)).status, 401);
  assert.equal((await anonymous.get('/transactions').set('Authorization', 'Bearer bad')).status, 401);
});

test('users can only see and change their own transactions', async (t) => {
  const { app, api: userA } = await createTestApp(t);
  const userB = asUser(app, 'user-b');

  const created = await userA.post('/transactions').send(validTransaction);
  const id = created.body.transaction.id;
  assert.equal(created.body.transaction.userId, 'user-a');

  assert.deepEqual((await userB.get('/transactions')).body.transactions, []);
  assert.equal((await userB.get(`/transactions/${id}`)).status, 404);
  assert.equal((await userB.patch(`/transactions/${id}`).send({ amount: 1 })).status, 404);
  assert.equal((await userB.delete(`/transactions/${id}`)).status, 404);

  const stillThere = await userA.get(`/transactions/${id}`);
  assert.equal(stillThere.status, 200);
  assert.equal(stillThere.body.transaction.amount, 45.75);
});

test('a userId in the request body cannot be used to write as someone else', async (t) => {
  const { api } = await createTestApp(t);
  const response = await api.post('/transactions').send({ ...validTransaction, userId: 'user-b' });

  assert.equal(response.status, 201);
  assert.equal(response.body.transaction.userId, 'user-a');
});
