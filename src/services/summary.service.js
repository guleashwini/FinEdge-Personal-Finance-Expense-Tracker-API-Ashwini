const summaryCacheKey = (userId) => `summary:${userId}`;

function roundMoney(amount) {
  return Number(amount.toFixed(2));
}

export function createSummaryService({ transactionService, cache }) {
  return {
    async getSummary(userId) {
      const cachedSummary = cache.get(summaryCacheKey(userId));
      if (cachedSummary !== undefined) {
        return cachedSummary;
      }

      const transactions = await transactionService.list(userId);
      const totalIncome = transactions
        .filter((transaction) => transaction.type === 'income')
        .reduce((total, transaction) => total + transaction.amount, 0);
      const totalExpenses = transactions
        .filter((transaction) => transaction.type === 'expense')
        .reduce((total, transaction) => total + transaction.amount, 0);

      const monthlyTotals = new Map();
      for (const transaction of transactions) {
        const monthKey = transaction.date?.slice(0, 7);
        if (!monthKey) {
          continue;
        }

        if (!monthlyTotals.has(monthKey)) {
          monthlyTotals.set(monthKey, {
            month: monthKey,
            income: 0,
            expenses: 0,
          });
        }

        const monthEntry = monthlyTotals.get(monthKey);
        if (transaction.type === 'income') {
          monthEntry.income += transaction.amount;
        }

        if (transaction.type === 'expense') {
          monthEntry.expenses += transaction.amount;
        }
      }

      const monthlyTrend = [...monthlyTotals.values()]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map(({ month, income, expenses }) => ({
          month,
          income: roundMoney(income),
          expenses: roundMoney(expenses),
          balance: roundMoney(income - expenses),
        }));

      const summary = {
        totalIncome: roundMoney(totalIncome),
        totalExpenses: roundMoney(totalExpenses),
        balance: roundMoney(totalIncome - totalExpenses),
        monthlyTrend,
      };

      cache.set(summaryCacheKey(userId), summary);
      return summary;
    },

    invalidate(userId) {
      cache.delete(summaryCacheKey(userId));
    },
  };
}
