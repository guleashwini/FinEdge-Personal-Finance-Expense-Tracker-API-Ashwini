import { AppError } from '../utils/app-error.js';

const allowedFields = ['type', 'category', 'amount', 'date'];

export function validateTransaction({ partial = false } = {}) {
  return function transactionValidationMiddleware(req, _res, next) {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return next(new AppError('Request body must be a JSON object.', 400));
    }

    const fields = partial
      ? allowedFields.filter((field) => Object.hasOwn(body, field))
      : allowedFields;

    if (partial && fields.length === 0) {
      return next(new AppError('Provide at least one transaction field to update.', 400));
    }

    const errors = [];

    if (!partial || fields.includes('type')) {
      if (!['income', 'expense'].includes(body.type)) {
        errors.push('Type must be either income or expense.');
      }
    }

    if (!partial || fields.includes('category')) {
      if (typeof body.category !== 'string' || !body.category.trim()) {
        errors.push('Category is required and must be a non-empty string.');
      }
    }

    if (!partial || fields.includes('amount')) {
      if (typeof body.amount !== 'number' || !Number.isFinite(body.amount) || body.amount <= 0) {
        errors.push('Amount must be a positive number.');
      }
    }

    if (!partial || fields.includes('date')) {
      if (typeof body.date !== 'string' || Number.isNaN(Date.parse(body.date))) {
        errors.push('Date must be a valid date string.');
      }
    }

    if (errors.length > 0) {
      return next(new AppError(errors.join(' '), 400));
    }

    req.validatedTransaction = Object.fromEntries(
      fields.map((field) => [
        field,
        field === 'category' ? body[field].trim() : body[field],
      ]),
    );
    next();
  };
}
