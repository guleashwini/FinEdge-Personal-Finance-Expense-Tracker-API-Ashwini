import { Router } from 'express';
import { createTransactionController } from '../controllers/transaction.controller.js';
import { validateTransaction } from '../middleware/validate-transaction.js';

export function createTransactionRoutes(transactionService, summaryService) {
  const router = Router();
  const controller = createTransactionController(transactionService, summaryService);

  router.post('/', validateTransaction(), controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.patch('/:id', validateTransaction({ partial: true }), controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
