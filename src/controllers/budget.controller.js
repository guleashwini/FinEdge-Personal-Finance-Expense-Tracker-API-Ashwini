export function createBudgetController(budgetService) {
  return {
    async create(req, res, next) {
      try {
        const budget = await budgetService.create(req.user.id, req.validatedBudget);
        res.status(201).json({ budget });
      } catch (error) {
        next(error);
      }
    },

    async list(req, res, next) {
      try {
        const budgets = await budgetService.list(req.user.id);
        res.status(200).json({ budgets });
      } catch (error) {
        next(error);
      }
    },

    async getById(req, res, next) {
      try {
        const budget = await budgetService.getById(req.user.id, req.params.id);
        const progress = await budgetService.getProgress(req.user.id, req.params.id);
        res.status(200).json({ budget, progress });
      } catch (error) {
        next(error);
      }
    },

    async update(req, res, next) {
      try {
        const budget = await budgetService.update(req.user.id, req.params.id, req.validatedBudget);
        res.status(200).json({ budget });
      } catch (error) {
        next(error);
      }
    },

    async remove(req, res, next) {
      try {
        await budgetService.remove(req.user.id, req.params.id);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  };
}
