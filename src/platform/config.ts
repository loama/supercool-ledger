export interface AppConfig {
  authSecret: string;
  authSecretSecondary?: string;
  databaseUrl: string;
  host: string;
  logLevel: string;
  metricsToken: string;
  metricsTokenSecondary?: string;
  port: number;
  sandboxEnabled: boolean;
  sentryDsn?: string;
  otlpEndpoint?: string;
}

const required = (env: Record<string, string | undefined>, name: string): string => {
  const value = env[name];
  if (!value) {
    throw new Error(`missing_environment:${name}`);
  }
  return value;
};

export const loadConfig = (env: Record<string, string | undefined>): AppConfig => {
  const port = Number(env.PORT ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('invalid_environment:PORT');
  }

  return {
    authSecret: required(env, 'AUTH_SECRET'),
    ...(env.AUTH_SECRET_SECONDARY ? { authSecretSecondary: env.AUTH_SECRET_SECONDARY } : {}),
    databaseUrl: required(env, 'DATABASE_URL'),
    host: env.HOST ?? '0.0.0.0',
    logLevel: env.LOG_LEVEL ?? 'info',
    metricsToken: required(env, 'METRICS_TOKEN'),
    ...(env.METRICS_TOKEN_SECONDARY ? { metricsTokenSecondary: env.METRICS_TOKEN_SECONDARY } : {}),
    port,
    sandboxEnabled: env.SANDBOX_ENABLED === 'true',
    ...(env.SENTRY_DSN ? { sentryDsn: env.SENTRY_DSN } : {}),
    ...(env.OTEL_EXPORTER_OTLP_ENDPOINT ? { otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT } : {}),
  };
};
