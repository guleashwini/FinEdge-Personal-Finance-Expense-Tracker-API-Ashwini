import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';

export function createAuthRoutes(userService, tokenService) {
  const router = Router();
  const controller = createAuthController(userService, tokenService);

  router.post('/auth/login', controller.login);

  return router;
}
