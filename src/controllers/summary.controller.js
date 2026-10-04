export function createSummaryController(summaryService) {
  return {
    async getSummary(req, res, next) {
      try {
        const summary = await summaryService.getSummary(req.user.id);
        res.status(200).json({ summary });
      } catch (error) {
        next(error);
      }
    },
  };
}
