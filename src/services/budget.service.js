import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readJsonFile, writeJsonFile } from './json-file.service.js';
import { AppError } from '../utils/app-error.js';

const defaultBudgetsFilePath = fileURLToPath(new URL('../../data/budgets.json', import.meta.url));

const roundMoney = (amount) => Number(amount.toFixed(2));

export function createBudgetService({ budgetsFilePath = defaultBudgetsFilePath, transactionService } = {}) {
  async function readBudgets() {
    const budgets = await readJsonFile(budgetsFilePath, []);
    if (!Array.isArray(budgets)) {
      throw new AppError('Budget data must be a JSON array.', 500);
    }
    return budgets;
  }

  const notFound = () => new AppError('Budget not found.', 404);

  return {
    async create(userId, budgetData) {
      const budgets = await readBudgets();
      if (budgets.some((item) => item.userId === userId && item.month === budgetData.month)) {
        throw new AppError(`A budget for ${budgetData.month} already exists.`, 409);
      }

      const now = new Date().toISOString();
      const budget = { id: randomUUID(), ...budgetData, userId, createdAt: now, updatedAt: now };

      await writeJsonFile(budgetsFilePath, [...budgets, budget]);
      return budget;
    },

    async list(userId) {
      const budgets = await readBudgets();
      return budgets
        .filter((item) => item.userId === userId)
        .sort((a, b) => a.month.localeCompare(b.month));
    },

    async getById(userId, id) {
      const budgets = await readBudgets();
      const budget = budgets.find((item) => item.id === id && item.userId === userId);
      if (!budget) {
        throw notFound();
      }
      return budget;
    },

    async getProgress(userId, id) {
      const budget = await this.getById(userId, id);
      const transactions = await transactionService.list(userId);
      const inMonth = transactions.filter((item) => item.date?.slice(0, 7) === budget.month);

      const sumOf = (type) => inMonth
        .filter((item) => item.type === type)
        .reduce((total, item) => total + item.amount, 0);
      const spent = sumOf('expense');
      const saved = sumOf('income') - spent;

      return {
        spent: roundMoney(spent),
        remaining: roundMoney(budget.monthlyGoal - spent),
        overBudget: spent > budget.monthlyGoal,
        saved: roundMoney(saved),
        savingsRemaining: roundMoney(budget.savingsTarget - saved),
        savingsTargetMet: saved >= budget.savingsTarget,
      };
    },

    async update(userId, id, updates) {
      const budgets = await readBudgets();
      const index = budgets.findIndex((item) => item.id === id && item.userId === userId);
      if (index === -1) {
        throw notFound();
      }

      const budget = { ...budgets[index], ...updates, updatedAt: new Date().toISOString() };
      budgets[index] = budget;
      await writeJsonFile(budgetsFilePath, budgets);
      return budget;
    },

    async remove(userId, id) {
      const budgets = await readBudgets();
      if (!budgets.some((item) => item.id === id && item.userId === userId)) {
        throw notFound();
      }

      await writeJsonFile(budgetsFilePath, budgets.filter((item) => item.id !== id));
    },
  };
}
