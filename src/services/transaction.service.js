import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readJsonFile, writeJsonFile } from './json-file.service.js';
import { AppError } from '../utils/app-error.js';

const defaultTransactionsFilePath = fileURLToPath(
  new URL('../../data/transactions.json', import.meta.url),
);

export function createTransactionService({ transactionsFilePath = defaultTransactionsFilePath } = {}) {
  async function readTransactions() {
    const transactions = await readJsonFile(transactionsFilePath, []);
    if (!Array.isArray(transactions)) {
      throw new AppError('Transaction data must be a JSON array.', 500);
    }
    return transactions;
  }

  return {
    async create(userId, transactionData) {
      const transactions = await readTransactions();
      const now = new Date().toISOString();
      const transaction = {
        id: randomUUID(),
        ...transactionData,
        userId,
        createdAt: now,
        updatedAt: now,
      };

      await writeJsonFile(transactionsFilePath, [...transactions, transaction]);
      return transaction;
    },

    async list(userId, filters = {}) {
      const transactions = await readTransactions();
      const { category, from, to } = filters;

      let filteredTransactions = transactions.filter((transaction) => transaction.userId === userId);

      if (category !== undefined && category !== null && String(category).trim() !== '') {
        const normalizedCategory = String(category).trim().toLowerCase();
        filteredTransactions = filteredTransactions.filter(
          (transaction) => transaction.category?.toLowerCase() === normalizedCategory,
        );
      }

      const parseDateFilter = (value, label) => {
        if (value === undefined || value === null || String(value).trim() === '') {
          return null;
        }

        const timestamp = Date.parse(String(value));
        if (Number.isNaN(timestamp)) {
          throw new AppError(`The ${label} date is not a valid date.`, 400);
        }

        return timestamp;
      };

      const fromTimestamp = parseDateFilter(from, 'from');
      const toTimestamp = parseDateFilter(to, 'to');

      if (fromTimestamp !== null && toTimestamp !== null && fromTimestamp > toTimestamp) {
        throw new AppError('The "from" date cannot be after the "to" date.', 400);
      }

      if (fromTimestamp !== null) {
        filteredTransactions = filteredTransactions.filter(
          (transaction) => Date.parse(transaction.date) >= fromTimestamp,
        );
      }

      if (toTimestamp !== null) {
        filteredTransactions = filteredTransactions.filter(
          (transaction) => Date.parse(transaction.date) <= toTimestamp,
        );
      }

      return filteredTransactions;
    },

    async getById(userId, id) {
      const transactions = await readTransactions();
      const transaction = transactions.find((item) => item.id === id && item.userId === userId);
      if (!transaction) {
        throw new AppError('Transaction not found.', 404);
      }
      return transaction;
    },

    async update(userId, id, updates) {
      const transactions = await readTransactions();
      const index = transactions.findIndex((item) => item.id === id && item.userId === userId);
      if (index === -1) {
        throw new AppError('Transaction not found.', 404);
      }

      const transaction = {
        ...transactions[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      transactions[index] = transaction;
      await writeJsonFile(transactionsFilePath, transactions);
      return transaction;
    },

    async remove(userId, id) {
      const transactions = await readTransactions();
      const transaction = transactions.find((item) => item.id === id && item.userId === userId);
      if (!transaction) {
        throw new AppError('Transaction not found.', 404);
      }

      await writeJsonFile(
        transactionsFilePath,
        transactions.filter((item) => item.id !== id),
      );
      return transaction;
    },
  };
}

export const transactionService = createTransactionService();
