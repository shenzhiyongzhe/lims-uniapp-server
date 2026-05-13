import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { Params } from 'nestjs-pino';
import type { Options } from 'pino-http';

/** 生产镜像 prune 掉 devDependencies 后无 pino-pretty；勿在未安装时注册 transport */
function canResolvePinoPretty(): boolean {
  try {
    const rq = createRequire(join(process.cwd(), 'package.json'));
    rq.resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

function resolveNodeEnv(config: ConfigService): string {
  return (
    config.get<string>('NODE_ENV') ??
    process.env.NODE_ENV ??
    'development'
  );
}

/** Pino 内置 level；误把 NODE_ENV 写进 LOG_LEVEL 时会报 “must be included in custom levels” */
const PINO_BUILTIN_LEVELS = new Set([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
]);

function normalizeLogLevel(
  raw: string | undefined,
  nodeEnv: string,
): string {
  const fallback = nodeEnv === 'production' ? 'info' : 'debug';
  if (raw == null || typeof raw !== 'string') return fallback;
  const s = raw.trim().toLowerCase();
  if (s === 'production') return 'info';
  if (s === 'development') return 'debug';
  if (PINO_BUILTIN_LEVELS.has(s)) return s;
  return fallback;
}

function resolveLogLevel(config: ConfigService, nodeEnv: string): string {
  const fromConfig = config.get<string>('LOG_LEVEL');
  const fromEnv = process.env.LOG_LEVEL;
  return normalizeLogLevel(fromConfig ?? fromEnv, nodeEnv);
}

export function buildPinoParams(config: ConfigService): Params {
  const nodeEnv = resolveNodeEnv(config);
  const logLevel = resolveLogLevel(config, nodeEnv);
  const isProd = nodeEnv === 'production';
  const silent = logLevel === 'silent';

  const pinoHttp: Options = {
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
      return randomUUID();
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
    customReceivedMessage: (req) =>
      `request_in ${req.method} ${req.url ?? ''}`,
    customSuccessMessage: (req, res, responseTime) =>
      `request_out ${req.method} ${req.url ?? ''} status=${res.statusCode} timeMs=${responseTime}`,
    customErrorMessage: (req, res, err) =>
      `request_out_error ${req.method} ${req.url ?? ''} status=${res.statusCode} err=${err?.message ?? 'unknown'}`,
  };

  if (!silent && !isProd && canResolvePinoPretty()) {
    pinoHttp.transport = {
      target: 'pino-pretty',
      options: { singleLine: true, colorize: true },
    };
  }

  return { pinoHttp };
}
