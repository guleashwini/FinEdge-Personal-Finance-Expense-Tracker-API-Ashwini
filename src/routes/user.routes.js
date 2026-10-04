import { Router } from 'express';
import { createUserController } from '../controllers/user.controller.js';

export function createUserRoutes(userService) {
  const router = Router();
  const userController = createUserController(userService);

  router.post('/users', userController.register);

  return router;
}
