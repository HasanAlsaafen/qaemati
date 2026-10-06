import { Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { IsIn, IsOptional, IsString, validateSync } from 'class-validator';

const PLACEHOLDER_MARKER = 'change-me';
const MIN_SECRET_LENGTH = 16;
export const DEV_FALLBACK_SECRET = 'dev-only-insecure-secret-do-not-deploy';

class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'test', 'production'])
  NODE_ENV?: string;

  @IsOptional()
  @IsString()
  PORT?: string;

  @IsString()
  DATABASE_URL!: string;

  @IsOptional()
  @IsString()
  SESSION_SECRET?: string;

  @IsOptional()
  @IsString()
  CSRF_SECRET?: string;

  @IsOptional()
  @IsIn(['ar', 'en'])
  DEFAULT_LOCALE?: string;

  @IsOptional()
  @IsString()
  DEMO_MODE?: string;

  @IsOptional()
  @IsString()
  PUBLIC_BASE_URL?: string;

  @IsOptional()
  @IsString()
  TRUST_PROXY?: string;
}

export function isWeakSecret(value: string | undefined): boolean {
  if (!value) return true;
  return value.toLowerCase().includes(PLACEHOLDER_MARKER) || value.length < MIN_SECRET_LENGTH;
}

const logger = new Logger('Config');

/**
 * Runs at ConfigModule startup. In production any problem throws, which
 * stops the process before it serves a request. Elsewhere weak or missing
 * secrets only warn, because tests and local setups use short throwaway
 * values on purpose.
 */
export function validateEnv(raw: Record<string, unknown>): Record<string, unknown> {
  const config = plainToInstance(EnvironmentVariables, raw, { enableImplicitConversion: false });
  const schemaErrors = validateSync(config, { skipMissingProperties: false });
  const problems = schemaErrors.map(
    (error) => `${error.property}: ${Object.values(error.constraints ?? {}).join(', ')}`,
  );

  const isProduction = config.NODE_ENV === 'production';
  const secrets: Array<[string, string | undefined]> = [
    ['SESSION_SECRET', config.SESSION_SECRET],
    ['CSRF_SECRET', config.CSRF_SECRET],
  ];
  const weak = secrets.filter(([, value]) => isWeakSecret(value)).map(([name]) => name);

  if (isProduction) {
    for (const name of weak) {
      problems.push(
        `${name} must be set to a unique value of at least ${MIN_SECRET_LENGTH} characters and must not contain "${PLACEHOLDER_MARKER}"`,
      );
    }
    if (problems.length > 0) {
      throw new Error(`Invalid environment configuration:\n  ${problems.join('\n  ')}`);
    }
    if (config.DEMO_MODE === 'true') {
      logger.warn('DEMO_MODE is on in production: demo credentials are shown on the home page');
    }
  } else {
    if (problems.length > 0) {
      throw new Error(`Invalid environment configuration:\n  ${problems.join('\n  ')}`);
    }
    if (weak.length > 0 && config.NODE_ENV !== 'test') {
      logger.warn(
        `${weak.join(' and ')} missing or placeholder. Using an insecure development value. Production will refuse to start like this.`,
      );
    }
  }

  return raw;
}

export function getSessionSecret(): string {
  return process.env.SESSION_SECRET || DEV_FALLBACK_SECRET;
}

export function getCsrfSecret(): string {
  return process.env.CSRF_SECRET || DEV_FALLBACK_SECRET;
}
