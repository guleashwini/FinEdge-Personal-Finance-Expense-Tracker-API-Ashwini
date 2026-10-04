import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import test from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { createBudgetService } from '../src/services/budget.service.js';
import { createTransactionService } from '../src/services/transaction.service.js';
import { asUser, tokenService } from './helpers/auth.js';

async function createTestApp(t) {
  const directory = await mkdtemp(join(tmpdir(), 'finedge-budgets-'));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const transactionService = createTransactionService({
    transactionsFilePath: join(directory, 'transactions.json'),
  });
  const budgetService = createBudgetService({
    budgetsFilePath: join(directory, 'budgets.json'),
    transactionService,
  });
  const app = createApp({ transactionService, budgetService, tokenService });
  return { app, api: asUser(app) };
}

const validBudget = { month: '2026-10', monthlyGoal: 1000, savingsTarget: 300 };

test('budget endpoints support create, list, view, update, and delete', async (t) => {
  const { api } = await createTestApp(t);

  const created = await api.post('/budgets').send(validBudget);
  assert.equal(created.status, 201);
  assert.equal(created.body.budget.month, '2026-10');
  assert.equal(created.body.budget.userId, 'user-a');
  assert.ok(created.body.budget.id);

  const id = created.body.budget.id;
  assert.equal((await api.get('/budgets')).body.budgets.length, 1);
  assert.equal((await api.get(`/budgets/${id}`)).body.budget.id, id);

  const updated = await api.patch(`/budgets/${id}`).send({ monthlyGoal: 1200 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.budget.monthlyGoal, 1200);
  assert.equal(updated.body.budget.savingsTarget, 300);

  assert.equal((await api.delete(`/budgets/${id}`)).status, 204);
  assert.deepEqual((await api.get('/budgets')).body.budgets, []);
});

test('budget endpoints reject invalid data and month changes', async (t) => {
  const { api } = await createTestApp(t);
  const invalidBudgets = [
    { ...validBudget, month: '2026-13' },
    { ...validBudget, month: 'October' },
    { ...validBudget, monthlyGoal: 0 },
    { ...validBudget, savingsTarget: -1 },
    { month: '2026-10' },
  ];

  for (const budget of invalidBudgets) {
    assert.equal((await api.post('/budgets').send(budget)).status, 400);
  }

  const { body } = await api.post('/budgets').send(validBudget);
  assert.equal((await api.patch(`/budgets/${body.budget.id}`).send({ month: '2026-11' })).status, 400);
  assert.equal((await api.patch(`/budgets/${body.budget.id}`).send({ unrelated: 1 })).status, 400);
});

test('only one budget is allowed per user per month', async (t) => {
  const { app, api } = await createTestApp(t);

  assert.equal((await api.post('/budgets').send(validBudget)).status, 201);
  assert.equal((await api.post('/budgets').send(validBudget)).status, 409);
  assert.equal((await asUser(app, 'user-b').post('/budgets').send(validBudget)).status, 201);
});

test('budgets require a token and are private to their owner', async (t) => {
  const { app, api } = await createTestApp(t);
  const userB = asUser(app, 'user-b');

  assert.equal((await request(app).get('/budgets')).status, 401);

  const { body } = await api.post('/budgets').send(validBudget);
  const id = body.budget.id;

  assert.deepEqual((await userB.get('/budgets')).body.budgets, []);
  assert.equal((await userB.get(`/budgets/${id}`)).status, 404);
  assert.equal((await userB.patch(`/budgets/${id}`).send({ monthlyGoal: 1 })).status, 404);
  assert.equal((await userB.delete(`/budgets/${id}`)).status, 404);
  assert.equal((await api.get(`/budgets/${id}`)).status, 200);
});

test('GET /budgets/:id reports progress from that month\'s transactions only', async (t) => {
  const { app, api } = await createTestApp(t);
  const { body } = await api.post('/budgets').send(validBudget);

  const transactions = [
    { type: 'income', category: 'salary', amount: 1500, date: '2026-10-01' },
    { type: 'expense', category: 'rent', amount: 900, date: '2026-10-05' },
    { type: 'expense', category: 'food', amount: 250.5, date: '2026-10-20' },
    { type: 'expense', category: 'food', amount: 500, date: '2026-09-30' },
  ];
  for (const transaction of transactions) {
    await api.post('/transactions').send(transaction);
  }
  await asUser(app, 'user-b').post('/transactions').send(
    { type: 'expense', category: 'food', amount: 999, date: '2026-10-02' },
  );

  const { progress } = (await api.get(`/budgets/${body.budget.id}`)).body;
  assert.deepEqual(progress, {
    spent: 1150.5,
    remaining: -150.5,
    overBudget: true,
    saved: 349.5,
    savingsRemaining: -49.5,
    savingsTargetMet: true,
  });
});
