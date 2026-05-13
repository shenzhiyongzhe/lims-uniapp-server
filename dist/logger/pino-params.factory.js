"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPinoParams = buildPinoParams;
const crypto_1 = require("crypto");
const node_module_1 = require("node:module");
const node_path_1 = require("node:path");
function canResolvePinoPretty() {
    try {
        const rq = (0, node_module_1.createRequire)((0, node_path_1.join)(process.cwd(), 'package.json'));
        rq.resolve('pino-pretty');
        return true;
    }
    catch {
        return false;
    }
}
function resolveNodeEnv(config) {
    return (config.get('NODE_ENV') ??
        process.env.NODE_ENV ??
        'development');
}
const PINO_BUILTIN_LEVELS = new Set([
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal',
    'silent',
]);
function normalizeLogLevel(raw, nodeEnv) {
    const fallback = nodeEnv === 'production' ? 'info' : 'debug';
    if (raw == null || typeof raw !== 'string')
        return fallback;
    const s = raw.trim().toLowerCase();
    if (s === 'production')
        return 'info';
    if (s === 'development')
        return 'debug';
    if (PINO_BUILTIN_LEVELS.has(s))
        return s;
    return fallback;
}
function resolveLogLevel(config, nodeEnv) {
    const fromConfig = config.get('LOG_LEVEL');
    const fromEnv = process.env.LOG_LEVEL;
    return normalizeLogLevel(fromConfig ?? fromEnv, nodeEnv);
}
function buildPinoParams(config) {
    const nodeEnv = resolveNodeEnv(config);
    const logLevel = resolveLogLevel(config, nodeEnv);
    const isProd = nodeEnv === 'production';
    const silent = logLevel === 'silent';
    const pinoHttp = {
        level: silent ? 'silent' : logLevel,
        redact: {
            paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'req.headers["set-cookie"]',
                'res.headers["set-cookie"]',
            ],
        },
        genReqId: (req) => {
            const raw = req.headers['x-request-id'];
            if (typeof raw === 'string' && raw.trim().length > 0) {
                return raw.trim().slice(0, 128);
            }
            return (0, crypto_1.randomUUID)();
        },
        autoLogging: silent
            ? false
            : {
                ignore: (req) => {
                    const url = req.url ?? '';
                    if (req.method === 'GET' && (url === '/' || url === '')) {
                        return true;
                    }
                    if (url.startsWith('/uploads')) {
                        return true;
                    }
                    return false;
                },
            },
        customReceivedMessage: (req) => `request_in ${req.method} ${req.url ?? ''}`,
        customSuccessMessage: (req, res, responseTime) => `request_out ${req.method} ${req.url ?? ''} status=${res.statusCode} timeMs=${responseTime}`,
        customErrorMessage: (req, res, err) => `request_out_error ${req.method} ${req.url ?? ''} status=${res.statusCode} err=${err?.message ?? 'unknown'}`,
    };
    if (!silent && !isProd && canResolvePinoPretty()) {
        pinoHttp.transport = {
            target: 'pino-pretty',
            options: { singleLine: true, colorize: true },
        };
    }
    return { pinoHttp };
}
//# sourceMappingURL=pino-params.factory.js.map