import { Router } from 'express';
import { createBudgetController } from '../controllers/budget.controller.js';
import { validateBudget } from '../middleware/validate-budget.js';

export function createBudgetRoutes(budgetService) {
  const router = Router();
  const controller = createBudgetController(budgetService);

  router.post('/', validateBudget(), controller.create);
  router.get('/', controller.list);
  router.get('/:id', controller.getById);
  router.patch('/:id', validateBudget({ partial: true }), controller.update);
  router.delete('/:id', controller.remove);

  return router;
}
