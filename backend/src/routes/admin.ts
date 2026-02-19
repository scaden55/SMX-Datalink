import { Router } from 'express';
import { AuthService } from '../services/auth.js';
import { UserService } from '../services/user.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import type { CreateUserRequest } from '@acars/shared';

export function adminRouter(): Router {
  const router = Router();
  const authService = new AuthService();
  const userService = new UserService();

  // POST /api/admin/users — create user with specified role
  router.post('/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { email, password, firstName, lastName, role, rank } = req.body as CreateUserRequest;

      if (!email || !password || !firstName || !lastName || !role) {
        res.status(400).json({ error: 'email, password, firstName, lastName, and role are required' });
        return;
      }

      if (role !== 'admin' && role !== 'pilot') {
        res.status(400).json({ error: 'role must be "admin" or "pilot"' });
        return;
      }

      if (userService.emailExists(email)) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      const passwordHash = await authService.hashPassword(password);
      const user = userService.create({
        email,
        passwordHash,
        firstName,
        lastName,
        role,
        rank,
      });

      res.status(201).json(userService.toProfile(user));
    } catch (err) {
      console.error('[Admin] Create user error:', err);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // GET /api/admin/users — list all users
  router.get('/admin/users', authMiddleware, adminMiddleware, (_req, res) => {
    try {
      const users = userService.findAll().map(u => userService.toProfile(u));
      res.json(users);
    } catch (err) {
      console.error('[Admin] List users error:', err);
      res.status(500).json({ error: 'Failed to list users' });
    }
  });

  return router;
}
