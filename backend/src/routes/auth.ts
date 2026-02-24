import { Router } from 'express';
import { AuthService } from '../services/auth.js';
import { UserService } from '../services/user.js';
import { UserAdminService } from '../services/user-admin.js';
import { authMiddleware } from '../middleware/auth.js';
import type { LoginRequest, RegisterRequest, RefreshRequest } from '@acars/shared';
import { logger } from '../lib/logger.js';

export function authRouter(): Router {
  const router = Router();
  const authService = new AuthService();
  const userService = new UserService();
  const userAdminService = new UserAdminService();

  // POST /api/auth/register — public
  router.post('/auth/register', async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body as RegisterRequest;

      if (!email || !password || !firstName || !lastName) {
        res.status(400).json({ error: 'email, password, firstName, and lastName are required' });
        return;
      }

      // Basic email format validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }

      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }

      if (password.length > 128) {
        res.status(400).json({ error: 'Password must be at most 128 characters' });
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
        role: 'pilot',
      });

      const accessToken = authService.generateAccessToken({
        userId: user.id,
        email: user.email,
        callsign: user.callsign,
        role: user.role,
      });
      const refreshToken = authService.generateRefreshToken(user.id);

      res.status(201).json({
        accessToken,
        refreshToken,
        user: userService.toProfile(user),
      });
    } catch (err) {
      logger.error('Auth', 'Register error', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // POST /api/auth/login — public
  router.post('/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body as LoginRequest;

      if (!email || !password) {
        res.status(400).json({ error: 'email and password are required' });
        return;
      }

      const user = userService.findByEmail(email);
      if (!user || !user.is_active) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const valid = await authService.verifyPassword(password, user.password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Record login time
      userAdminService.recordLogin(user.id);

      const accessToken = authService.generateAccessToken({
        userId: user.id,
        email: user.email,
        callsign: user.callsign,
        role: user.role,
      });
      const refreshToken = authService.generateRefreshToken(user.id);

      res.json({
        accessToken,
        refreshToken,
        user: userService.toProfile(user),
      });
    } catch (err) {
      logger.error('Auth', 'Login error', err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // POST /api/auth/refresh — public
  router.post('/auth/refresh', (req, res) => {
    try {
      const { refreshToken } = req.body as RefreshRequest;

      if (!refreshToken) {
        res.status(400).json({ error: 'refreshToken is required' });
        return;
      }

      // Atomically validate and revoke in one transaction to prevent token doubling
      const result = authService.validateAndRevokeRefreshToken(refreshToken);
      if (!result) {
        res.status(401).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      const user = userService.findById(result.userId);
      if (!user || !user.is_active) {
        res.status(401).json({ error: 'User not found or inactive' });
        return;
      }

      const accessToken = authService.generateAccessToken({
        userId: user.id,
        email: user.email,
        callsign: user.callsign,
        role: user.role,
      });
      const newRefreshToken = authService.generateRefreshToken(user.id);

      res.json({ accessToken, refreshToken: newRefreshToken });
    } catch (err) {
      logger.error('Auth', 'Refresh error', err);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  });

  // POST /api/auth/logout — authenticated
  router.post('/auth/logout', authMiddleware, (req, res) => {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };

      if (refreshToken) {
        authService.revokeRefreshToken(refreshToken);
      } else {
        // Revoke all tokens for this user
        authService.revokeAllUserTokens(req.user!.userId);
      }

      res.json({ message: 'Logged out' });
    } catch (err) {
      logger.error('Auth', 'Logout error', err);
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  // GET /api/auth/me — authenticated
  router.get('/auth/me', authMiddleware, (req, res) => {
    try {
      const user = userService.findById(req.user!.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json(userService.toProfile(user));
    } catch (err) {
      logger.error('Auth', 'Me error', err);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  });

  return router;
}
