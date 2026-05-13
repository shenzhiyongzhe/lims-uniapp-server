import { Injectable } from '@nestjs/common';

interface LoginAttempt {
  count: number;
  lockedUntil: Date | null;
  lastAttempt: Date;
}

@Injectable()
export class LoginAttemptService {
  private readonly loginAttempts = new Map<string, LoginAttempt>();
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCK_DURATION = 15 * 60 * 1000;
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000;

  constructor() {
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  recordFailure(username: string): {
    isLocked: boolean;
    remainingAttempts: number;
    lockedUntil: Date | null;
  } {
    const key = `user:${username}`;
    const now = new Date();
    let attempt = this.loginAttempts.get(key);

    if (!attempt) {
      attempt = {
        count: 0,
        lockedUntil: null,
        lastAttempt: now,
      };
    }

    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      return {
        isLocked: true,
        remainingAttempts: 0,
        lockedUntil: attempt.lockedUntil,
      };
    }

    if (attempt.lockedUntil && attempt.lockedUntil <= now) {
      attempt.count = 0;
      attempt.lockedUntil = null;
    }

    attempt.count++;
    attempt.lastAttempt = now;

    if (attempt.count >= this.MAX_ATTEMPTS) {
      attempt.lockedUntil = new Date(now.getTime() + this.LOCK_DURATION);
    }

    this.loginAttempts.set(key, attempt);

    return {
      isLocked: attempt.lockedUntil !== null,
      remainingAttempts: Math.max(0, this.MAX_ATTEMPTS - attempt.count),
      lockedUntil: attempt.lockedUntil,
    };
  }

  recordSuccess(username: string): void {
    const key = `user:${username}`;
    this.loginAttempts.delete(key);
  }

  isLocked(username: string): { isLocked: boolean; lockedUntil: Date | null } {
    const key = `user:${username}`;
    const attempt = this.loginAttempts.get(key);

    if (!attempt) {
      return { isLocked: false, lockedUntil: null };
    }

    const now = new Date();
    if (attempt.lockedUntil && attempt.lockedUntil > now) {
      return { isLocked: true, lockedUntil: attempt.lockedUntil };
    }

    if (attempt.lockedUntil && attempt.lockedUntil <= now) {
      this.loginAttempts.delete(key);
      return { isLocked: false, lockedUntil: null };
    }

    return { isLocked: false, lockedUntil: null };
  }

  private cleanup(): void {
    const now = new Date();
    for (const [key, attempt] of this.loginAttempts.entries()) {
      if (
        (!attempt.lockedUntil || attempt.lockedUntil <= now) &&
        now.getTime() - attempt.lastAttempt.getTime() > this.CLEANUP_INTERVAL
      ) {
        this.loginAttempts.delete(key);
      }
    }
  }
}
