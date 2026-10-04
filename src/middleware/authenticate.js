import { AppError } from '../utils/app-error.js';

export function authenticate(tokenService) {
  return function authenticationMiddleware(req, _res, next) {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      return next(new AppError('Authentication required.', 401));
    }

    try {
      const { sub, email } = tokenService.verifyToken(token);
      req.user = { id: sub, email };
      next();
    } catch (error) {
      next(error);
    }
  };
}
