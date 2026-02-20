import { Router } from 'express';

// Legacy admin router — routes moved to admin-users.ts, admin-schedules.ts, etc.
// Kept as empty router for backwards compatibility with index.ts registration.
export function adminRouter(): Router {
  return Router();
}
