import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';
import { getDb } from '../db/index.js';
import { config } from '../config.js';
import type { AuthPayload } from '@acars/shared';
import { logger } from '../lib/logger.js';

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  generateAccessToken(payload: AuthPayload): string {
    return jwt.sign(payload, config.jwtSecret, {
      expiresIn: parseExpiry(config.jwtAccessExpiry) / 1000, // seconds
    });
  }

  verifyAccessToken(token: string): AuthPayload {
    return jwt.verify(token, config.jwtSecret) as AuthPayload;
  }

  generateRefreshToken(userId: number): string {
    const token = randomBytes(40).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');

    // Parse expiry string (e.g. '7d') to compute date
    const expiresAt = new Date(Date.now() + parseExpiry(config.jwtRefreshExpiry)).toISOString();

    getDb().prepare(`
      INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
    `).run(userId, hash, expiresAt);

    return token;
  }

  /**
   * Atomically validate and revoke a refresh token in a single transaction.
   * Returns the userId if valid, null otherwise.
   * This prevents the race condition where two concurrent refresh requests
   * could both validate the same token before either revokes it.
   */
  validateAndRevokeRefreshToken(token: string): { userId: number } | null {
    const hash = createHash('sha256').update(token).digest('hex');
    const db = getDb();

    const txn = db.transaction(() => {
      const row = db.prepare(`
        SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ?
      `).get(hash) as { user_id: number; expires_at: string } | undefined;

      if (!row) return null;
      if (new Date(row.expires_at) < new Date()) {
        // Expired — clean it up
        db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hash);
        return null;
      }

      // Revoke immediately within the same transaction
      db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hash);
      return { userId: row.user_id };
    });

    return txn();
  }

  /** @deprecated Use validateAndRevokeRefreshToken for atomic operation */
  validateRefreshToken(token: string): { userId: number } | null {
    const hash = createHash('sha256').update(token).digest('hex');

    const row = getDb().prepare(`
      SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ?
    `).get(hash) as { user_id: number; expires_at: string } | undefined;

    if (!row) return null;
    if (new Date(row.expires_at) < new Date()) {
      getDb().prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hash);
      return null;
    }

    return { userId: row.user_id };
  }

  revokeRefreshToken(token: string): void {
    const hash = createHash('sha256').update(token).digest('hex');
    getDb().prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(hash);
  }

  revokeAllUserTokens(userId: number): void {
    getDb().prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
  }

  cleanupExpiredTokens(): void {
    getDb().prepare("DELETE FROM refresh_tokens WHERE expires_at < datetime('now')").run();
  }
}

function parseExpiry(expiry: string): number {
  const match = expiry.match(/^(\d+)([smhd])$/);
  if (!match) {
    logger.warn('Auth', `Unrecognized expiry format "${expiry}" — defaulting to 7 days`);
    return 7 * 24 * 60 * 60 * 1000;
  }

  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default:  return 7 * 24 * 60 * 60 * 1000;
  }
}
