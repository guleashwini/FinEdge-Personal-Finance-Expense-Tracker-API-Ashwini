export function createTransactionController(transactionService, summaryService) {
  return {
    async create(req, res, next) {
      try {
        const transaction = await transactionService.create(req.user.id, req.validatedTransaction);
        summaryService.invalidate(req.user.id);
        res.status(201).json({ transaction });
      } catch (error) {
        next(error);
      }
    },

    async list(req, res, next) {
      try {
        const transactions = await transactionService.list(req.user.id, {
          category: req.query.category,
          from: req.query.from,
          to: req.query.to,
        });
        res.status(200).json({ transactions });
      } catch (error) {
        next(error);
      }
    },

    async getById(req, res, next) {
      try {
        const transaction = await transactionService.getById(req.user.id, req.params.id);
        res.status(200).json({ transaction });
      } catch (error) {
        next(error);
      }
    },

    async update(req, res, next) {
      try {
        const transaction = await transactionService.update(
          req.user.id,
          req.params.id,
          req.validatedTransaction,
        );
        summaryService.invalidate(req.user.id);
        res.status(200).json({ transaction });
      } catch (error) {
        next(error);
      }
    },

    async remove(req, res, next) {
      try {
        await transactionService.remove(req.user.id, req.params.id);
        summaryService.invalidate(req.user.id);
        res.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  };
}
