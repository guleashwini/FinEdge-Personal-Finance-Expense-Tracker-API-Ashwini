import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { asUser, tokenService } from './helpers/auth.js';
import { createCache } from '../src/services/cache.service.js';
import { createSummaryService } from '../src/services/summary.service.js';
import { createTransactionService } from '../src/services/transaction.service.js';

async function createTestApp(t) {
  const directory = await mkdtemp(join(tmpdir(), 'finedge-summary-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const transactionService = createTransactionService({
    transactionsFilePath: join(directory, 'transactions.json'),
  });
  const app = createApp({ transactionService, tokenService });
  return { app, api: asUser(app) };
}

test('GET /summary reports totals and refreshes after transaction changes', async (t) => {
  const { api } = await createTestApp(t);

  const emptySummary = await api.get('/summary');
  assert.equal(emptySummary.status, 200);
  assert.deepEqual(emptySummary.body.summary, {
    totalIncome: 0,
    totalExpenses: 0,
    balance: 0,
    monthlyTrend: [],
  });

  const incomeResponse = await api.post('/transactions').send({
    type: 'income',
    category: 'salary',
    amount: 100.25,
    date: '2026-10-03',
  });
  assert.equal(incomeResponse.status, 201);

  const expenseResponse = await api.post('/transactions').send({
    type: 'expense',
    category: 'food',
    amount: 30.1,
    date: '2026-10-03',
  });
  assert.equal(expenseResponse.status, 201);

  const summaryAfterCreate = await api.get('/summary');
  assert.deepEqual(summaryAfterCreate.body.summary, {
    totalIncome: 100.25,
    totalExpenses: 30.1,
    balance: 70.15,
    monthlyTrend: [{ month: '2026-10', income: 100.25, expenses: 30.1, balance: 70.15 }],
  });

  const expenseId = expenseResponse.body.transaction.id;
  const updateResponse = await api
    .patch(`/transactions/${expenseId}`)
    .send({ amount: 35 });
  assert.equal(updateResponse.status, 200);

  const summaryAfterUpdate = await api.get('/summary');
  assert.deepEqual(summaryAfterUpdate.body.summary, {
    totalIncome: 100.25,
    totalExpenses: 35,
    balance: 65.25,
    monthlyTrend: [{ month: '2026-10', income: 100.25, expenses: 35, balance: 65.25 }],
  });

  const deleteResponse = await api
    .delete(`/transactions/${incomeResponse.body.transaction.id}`);
  assert.equal(deleteResponse.status, 204);

  const summaryAfterDelete = await api.get('/summary');
  assert.deepEqual(summaryAfterDelete.body.summary, {
    totalIncome: 0,
    totalExpenses: 35,
    balance: -35,
    monthlyTrend: [{ month: '2026-10', income: 0, expenses: 35, balance: -35 }],
  });
});

test('GET /summary includes a monthly trend for all active months', async (t) => {
  const { api } = await createTestApp(t);

  await api.post('/transactions').send({
    type: 'income',
    category: 'salary',
    amount: 2500,
    date: '2026-09-01',
  });
  await api.post('/transactions').send({
    type: 'expense',
    category: 'rent',
    amount: 1000,
    date: '2026-09-15',
  });
  await api.post('/transactions').send({
    type: 'income',
    category: 'freelance',
    amount: 700,
    date: '2026-10-10',
  });
  await api.post('/transactions').send({
    type: 'expense',
    category: 'food',
    amount: 250,
    date: '2026-10-20',
  });

  const response = await api.get('/summary');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body.summary.monthlyTrend, [
    { month: '2026-09', income: 2500, expenses: 1000, balance: 1500 },
    { month: '2026-10', income: 700, expenses: 250, balance: 450 },
  ]);
});

test('summary service uses cached results until expiry or invalidation', async () => {
  let currentTime = 1_000;
  let listCalls = 0;
  const cache = createCache({ ttlMs: 100, now: () => currentTime });
  const transactionService = {
    async list() {
      listCalls += 1;
      return [{ type: 'income', amount: 10 }];
    },
  };
  const summaryService = createSummaryService({ transactionService, cache });

  await summaryService.getSummary('user-a');
  await summaryService.getSummary('user-a');
  assert.equal(listCalls, 1);

  currentTime += 100;
  await summaryService.getSummary('user-a');
  assert.equal(listCalls, 2);

  summaryService.invalidate('user-a');
  await summaryService.getSummary('user-a');
  assert.equal(listCalls, 3);
});

test('summary cache is kept separately for each user', async () => {
  const cache = createCache({ ttlMs: 10_000 });
  const transactionService = {
    async list(userId) {
      return [{ type: 'income', amount: userId === 'user-a' ? 10 : 99 }];
    },
  };
  const summaryService = createSummaryService({ transactionService, cache });

  assert.equal((await summaryService.getSummary('user-a')).totalIncome, 10);
  assert.equal((await summaryService.getSummary('user-b')).totalIncome, 99);

  summaryService.invalidate('user-a');
  assert.equal(cache.get('summary:user-b').totalIncome, 99);
});

test('GET /summary only counts the signed-in user and requires a token', async (t) => {
  const { app, api } = await createTestApp(t);
  const userB = asUser(app, 'user-b');

  await api.post('/transactions').send({ type: 'income', category: 'salary', amount: 100, date: '2026-10-01' });
  await userB.post('/transactions').send({ type: 'income', category: 'salary', amount: 5, date: '2026-10-01' });

  assert.equal((await api.get('/summary')).body.summary.totalIncome, 100);
  assert.equal((await userB.get('/summary')).body.summary.totalIncome, 5);

  const anonymous = await request(app).get('/summary');
  assert.equal(anonymous.status, 401);
});
