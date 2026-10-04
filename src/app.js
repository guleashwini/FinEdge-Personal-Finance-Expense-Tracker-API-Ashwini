import express from 'express';
import { authenticate } from './middleware/authenticate.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { requestLogger } from './middleware/request-logger.js';
import healthRoutes from './routes/health.routes.js';
import { createAuthRoutes } from './routes/auth.routes.js';
import { createBudgetRoutes } from './routes/budget.routes.js';
import { createUserRoutes } from './routes/user.routes.js';
import { createTransactionRoutes } from './routes/transaction.routes.js';
import { createSummaryRoutes } from './routes/summary.routes.js';
import { config } from './config.js';
import { createBudgetService } from './services/budget.service.js';
import { createCache } from './services/cache.service.js';
import { createSummaryService } from './services/summary.service.js';
import { tokenService as defaultTokenService } from './services/token.service.js';
import { transactionService as defaultTransactionService } from './services/transaction.service.js';
import { userService as defaultUserService } from './services/user.service.js';

export function createApp({
	userService = defaultUserService,
	transactionService = defaultTransactionService,
	tokenService = defaultTokenService,
	budgetService = createBudgetService({ transactionService }),
	summaryService,
	cache,
} = {}) {
	const app = express();
	const summaryCache = cache ?? createCache({ ttlMs: config.cacheTtlMs });
	const activeSummaryService = summaryService ?? createSummaryService({
		transactionService,
		cache: summaryCache,
	});

	app.use(requestLogger);
	app.use(express.json());
	app.use(healthRoutes);
	app.use(createUserRoutes(userService));
	app.use(createAuthRoutes(userService, tokenService));
	const requireAuth = authenticate(tokenService);
	app.use('/transactions', requireAuth, createTransactionRoutes(transactionService, activeSummaryService));
	app.use('/budgets', requireAuth, createBudgetRoutes(budgetService));
	app.use('/summary', requireAuth, createSummaryRoutes(activeSummaryService));
	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
}

export default createApp();
