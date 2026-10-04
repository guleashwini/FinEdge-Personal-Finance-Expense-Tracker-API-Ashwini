import { AppError } from '../utils/app-error.js';

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const updatableFields = ['monthlyGoal', 'savingsTarget'];

export function validateBudget({ partial = false } = {}) {
  return function budgetValidationMiddleware(req, _res, next) {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return next(new AppError('Request body must be a JSON object.', 400));
    }

    if (partial && Object.hasOwn(body, 'month')) {
      return next(new AppError('Month cannot be changed. Delete the budget and create a new one.', 400));
    }

    const fields = partial
      ? updatableFields.filter((field) => Object.hasOwn(body, field))
      : ['month', ...updatableFields];

    if (partial && fields.length === 0) {
      return next(new AppError('Provide monthlyGoal or savingsTarget to update.', 400));
    }

    const errors = [];

    if (fields.includes('month') && (typeof body.month !== 'string' || !monthPattern.test(body.month))) {
      errors.push('Month must be in YYYY-MM format.');
    }

    if (fields.includes('monthlyGoal')
      && (typeof body.monthlyGoal !== 'number' || !Number.isFinite(body.monthlyGoal) || body.monthlyGoal <= 0)) {
      errors.push('Monthly goal must be a positive number.');
    }

    if (fields.includes('savingsTarget')
      && (typeof body.savingsTarget !== 'number' || !Number.isFinite(body.savingsTarget) || body.savingsTarget < 0)) {
      errors.push('Savings target must be zero or a positive number.');
    }

    if (errors.length > 0) {
      return next(new AppError(errors.join(' '), 400));
    }

    req.validatedBudget = Object.fromEntries(fields.map((field) => [field, body[field]]));
    next();
  };
}
