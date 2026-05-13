import { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
export declare function buildPinoParams(config: ConfigService): Params;
