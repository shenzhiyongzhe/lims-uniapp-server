"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseHelper = void 0;
class ResponseHelper {
    static success(data, message = '成功') {
        return {
            code: 200,
            message,
            data,
        };
    }
    static error(message = '失败', code = 500) {
        return {
            code,
            message,
            data: null,
        };
    }
}
exports.ResponseHelper = ResponseHelper;
//# sourceMappingURL=response-helper.js.map