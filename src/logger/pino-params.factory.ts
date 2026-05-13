import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import type { Params } from 'nestjs-pino';
import type { Options } from 'pino-http';

function resolveNodeEnv(config: ConfigService): string {
  return (
    config.get<string>('NODE_ENV') ??
    process.env.NODE_ENV ??
    'development'
  );
}

function resolveLogLevel(config: ConfigService, nodeEnv: string): string {
  return (
    config.get<string>('LOG_LEVEL') ??
    process.env.LOG_LEVEL ??
    (nodeEnv === 'production' ? 'info' : 'debug')
  );
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

  if (!silent && !isProd) {
    pinoHttp.transport = {
      target: 'pino-pretty',
      options: { singleLine: true, colorize: true },
    };
  }

  return { pinoHttp };
}
