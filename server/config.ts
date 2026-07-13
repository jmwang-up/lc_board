export interface ServerConfig {
  host: string;
  port: number;
}

export function readServerConfig(env: Record<string, string | undefined>): ServerConfig {
  const port = Number(env.PORT ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  return { host: env.HOST?.trim() || '0.0.0.0', port };
}
