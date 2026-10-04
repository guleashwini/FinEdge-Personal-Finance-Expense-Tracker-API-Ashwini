import { Router } from 'express';
import { createSummaryController } from '../controllers/summary.controller.js';

export function createSummaryRoutes(summaryService) {
  const router = Router();
  const controller = createSummaryController(summaryService);

  router.get('/', controller.getSummary);

  return router;
}
