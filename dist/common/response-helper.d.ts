export declare class ResponseHelper {
    static success<T>(data: T, message?: string): {
        code: number;
        message: string;
        data: T;
    };
    static error(message?: string, code?: number): {
        code: number;
        message: string;
        data: null;
    };
}
