"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoginAttemptService = void 0;
const common_1 = require("@nestjs/common");
let LoginAttemptService = class LoginAttemptService {
    loginAttempts = new Map();
    MAX_ATTEMPTS = 5;
    LOCK_DURATION = 15 * 60 * 1000;
    CLEANUP_INTERVAL = 60 * 60 * 1000;
    constructor() {
        setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
    }
    recordFailure(username) {
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
    recordSuccess(username) {
        const key = `user:${username}`;
        this.loginAttempts.delete(key);
    }
    isLocked(username) {
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
    cleanup() {
        const now = new Date();
        for (const [key, attempt] of this.loginAttempts.entries()) {
            if ((!attempt.lockedUntil || attempt.lockedUntil <= now) &&
                now.getTime() - attempt.lastAttempt.getTime() > this.CLEANUP_INTERVAL) {
                this.loginAttempts.delete(key);
            }
        }
    }
};
exports.LoginAttemptService = LoginAttemptService;
exports.LoginAttemptService = LoginAttemptService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], LoginAttemptService);
//# sourceMappingURL=login-attempt.service.js.map