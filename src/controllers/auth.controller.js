export function createAuthController(userService, tokenService) {
  return {
    async login(req, res, next) {
      try {
        const user = await userService.login(req.body ?? {});
        const token = tokenService.signToken({ sub: user.id, email: user.email });
        res.status(200).json({ token, user });
      } catch (error) {
        next(error);
      }
    },
  };
}
