import type { Request, Response, NextFunction } from 'express';
import type { AuthPayload } from '@acars/shared';
import { AuthService } from '../services/auth.js';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

const authService = new AuthService();

/** Requires valid Bearer token — rejects with 401 if missing or invalid. */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  try {
    const token = header.slice(7);
    req.user = authService.verifyAccessToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Sets req.user if a valid token is present, but does not reject unauthenticated requests. */
export function optionalAuthMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      req.user = authService.verifyAccessToken(header.slice(7));
    } catch {
      // Invalid token — continue without user context
    }
  }
  next();
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

/** Allows dispatcher OR admin — use for PIREP + schedule admin routes. */
export function dispatcherMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'dispatcher')) {
    res.status(403).json({ error: 'Dispatcher or admin access required' });
    return;
  }
  next();
}
