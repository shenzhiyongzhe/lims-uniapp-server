export declare class LoginAttemptService {
    private readonly loginAttempts;
    private readonly MAX_ATTEMPTS;
    private readonly LOCK_DURATION;
    private readonly CLEANUP_INTERVAL;
    constructor();
    recordFailure(username: string): {
        isLocked: boolean;
        remainingAttempts: number;
        lockedUntil: Date | null;
    };
    recordSuccess(username: string): void;
    isLocked(username: string): {
        isLocked: boolean;
        lockedUntil: Date | null;
    };
    private cleanup;
}
