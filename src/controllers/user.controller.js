export function createUserController(userService) {
  return {
    async register(req, res, next) {
      try {
        const user = await userService.register(req.body ?? {});
        res.status(201).json({ user });
      } catch (error) {
        next(error);
      }
    },
  };
}
