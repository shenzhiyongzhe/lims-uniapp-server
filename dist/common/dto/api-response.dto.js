"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiResponseDto = void 0;
class ApiResponseDto {
    code;
    message;
    data;
    constructor(code, message, data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }
    static success(data, message = '成功') {
        return new ApiResponseDto(200, message, data);
    }
    static error(message = '失败', code = 500) {
        return new ApiResponseDto(code, message, null);
    }
}
exports.ApiResponseDto = ApiResponseDto;
//# sourceMappingURL=api-response.dto.js.map