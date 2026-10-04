import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readJsonFile, writeJsonFile } from './json-file.service.js';
import { AppError } from '../utils/app-error.js';

const defaultUsersFilePath = fileURLToPath(new URL('../../data/users.json', import.meta.url));

export function createUserService({
  usersFilePath = defaultUsersFilePath,
  hashPassword = (password) => bcrypt.hash(password, 10),
} = {}) {
  const toPublicUser = ({ id, name, email, createdAt }) => ({ id, name, email, createdAt });

  return {
    async login({ email, password }) {
      const invalidCredentials = () => new AppError('Invalid email or password.', 401);

      if (typeof email !== 'string' || typeof password !== 'string') {
        throw invalidCredentials();
      }

      const users = await readJsonFile(usersFilePath, []);
      const user = users.find((item) => item.email === email.trim().toLowerCase());
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        throw invalidCredentials();
      }

      return toPublicUser(user);
    },

    async register({ name, email, password }) {
      if (typeof name !== 'string' || !name.trim()) {
        throw new AppError('Name is required.', 400);
      }

      if (typeof email !== 'string' || !email.trim()) {
        throw new AppError('Email is required.', 400);
      }

      const normalizedEmail = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new AppError('A valid email is required.', 400);
      }

      if (typeof password !== 'string' || password.length < 8) {
        throw new AppError('Password must be at least 8 characters long.', 400);
      }

      const users = await readJsonFile(usersFilePath, []);
      if (users.some((user) => user.email === normalizedEmail)) {
        throw new AppError('An account with this email already exists.', 409);
      }

      const passwordHash = await hashPassword(password);
      const user = {
        id: randomUUID(),
        name: name.trim(),
        email: normalizedEmail,
        passwordHash,
        createdAt: new Date().toISOString(),
      };

      await writeJsonFile(usersFilePath, [...users, user]);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      };
    },
  };
}

export const userService = createUserService();
