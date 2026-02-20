import { Router } from 'express';
import { AuthService } from '../services/auth.js';
import { UserService } from '../services/user.js';
import { UserAdminService } from '../services/user-admin.js';
import { AuditService } from '../services/audit.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import type { AdminUserFilters } from '@acars/shared';

export function adminUsersRouter(): Router {
  const router = Router();
  const authService = new AuthService();
  const userService = new UserService();
  const userAdminService = new UserAdminService();
  const auditService = new AuditService();

  // GET /api/admin/users — paginated user list
  router.get('/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const filters: AdminUserFilters = {
        role: req.query.role as any,
        status: req.query.status as any,
        search: req.query.search as string | undefined,
      };
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 50));

      const result = userAdminService.findAll(filters, page, pageSize);
      res.json({ ...result, page, pageSize });
    } catch (err) {
      console.error('[Admin] List users error:', err);
      res.status(500).json({ error: 'Failed to list users' });
    }
  });

  // GET /api/admin/users/:id — single user detail
  router.get('/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const user = userAdminService.findById(parseInt(req.params.id as string));
      if (!user) { res.status(404).json({ error: 'User not found' }); return; }
      res.json(user);
    } catch (err) {
      console.error('[Admin] Get user error:', err);
      res.status(500).json({ error: 'Failed to get user' });
    }
  });

  // POST /api/admin/users — create user
  router.post('/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { email, password, firstName, lastName, role, rank } = req.body;
      if (!email || !password || !firstName || !lastName || !role) {
        res.status(400).json({ error: 'email, password, firstName, lastName, and role are required' });
        return;
      }
      if (!['admin', 'dispatcher', 'pilot'].includes(role)) {
        res.status(400).json({ error: 'role must be admin, dispatcher, or pilot' });
        return;
      }
      if (userService.emailExists(email)) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      const passwordHash = await authService.hashPassword(password);
      const user = userService.create({ email, passwordHash, firstName, lastName, role, rank });
      const profile = userAdminService.findById(user.id)!;

      auditService.log({ actorId: req.user!.userId, action: 'user.create', targetType: 'user', targetId: user.id, after: profile as any });
      res.status(201).json(profile);
    } catch (err) {
      console.error('[Admin] Create user error:', err);
      res.status(500).json({ error: 'Failed to create user' });
    }
  });

  // PATCH /api/admin/users/:id — update user
  router.patch('/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      // Validate password constraints if provided
      if (req.body.password !== undefined) {
        if (typeof req.body.password !== 'string' || req.body.password.length < 8) {
          res.status(400).json({ error: 'Password must be at least 8 characters' });
          return;
        }
        if (req.body.password.length > 128) {
          res.status(400).json({ error: 'Password must be at most 128 characters' });
          return;
        }
      }
      // Validate email if provided
      if (req.body.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }

      const updated = await userAdminService.update(parseInt(req.params.id as string), req.body, req.user!.userId);
      if (!updated) { res.status(404).json({ error: 'User not found' }); return; }
      res.json(updated);
    } catch (err) {
      console.error('[Admin] Update user error:', err);
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  // POST /api/admin/users/:id/suspend
  router.post('/admin/users/:id/suspend', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const updated = await userAdminService.suspend(parseInt(req.params.id as string), req.user!.userId);
      if (!updated) { res.status(404).json({ error: 'User not found' }); return; }
      res.json(updated);
    } catch (err) {
      console.error('[Admin] Suspend user error:', err);
      res.status(500).json({ error: 'Failed to suspend user' });
    }
  });

  // POST /api/admin/users/:id/reactivate
  router.post('/admin/users/:id/reactivate', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const updated = await userAdminService.reactivate(parseInt(req.params.id as string), req.user!.userId);
      if (!updated) { res.status(404).json({ error: 'User not found' }); return; }
      res.json(updated);
    } catch (err) {
      console.error('[Admin] Reactivate user error:', err);
      res.status(500).json({ error: 'Failed to reactivate user' });
    }
  });

  // DELETE /api/admin/users/:id — soft delete
  router.delete('/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const updated = await userAdminService.softDelete(parseInt(req.params.id as string), req.user!.userId);
      if (!updated) { res.status(404).json({ error: 'User not found' }); return; }
      res.json(updated);
    } catch (err) {
      console.error('[Admin] Delete user error:', err);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // POST /api/admin/users/:id/impersonate
  router.post('/admin/users/:id/impersonate', authMiddleware, adminMiddleware, (req, res) => {
    try {
      const result = userAdminService.impersonate(parseInt(req.params.id as string), req.user!.userId);
      if (!result) { res.status(404).json({ error: 'User not found' }); return; }
      res.json(result);
    } catch (err) {
      console.error('[Admin] Impersonate error:', err);
      res.status(500).json({ error: 'Failed to impersonate user' });
    }
  });

  return router;
}
