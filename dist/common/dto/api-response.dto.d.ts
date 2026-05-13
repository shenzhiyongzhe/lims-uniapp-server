export declare class ApiResponseDto<T = any> {
    code: number;
    message: string;
    data: T;
    constructor(code: number, message: string, data: T);
    static success<T>(data: T, message?: string): ApiResponseDto<T>;
    static error(message?: string, code?: number): ApiResponseDto<null>;
}
