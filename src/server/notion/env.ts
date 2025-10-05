export const NOTION_VERSION = '2025-09-03';

export function getEnvVar(name: string, options?: { optional?: boolean; fallback?: string }) {
  const value = process.env[name] ?? options?.fallback;
  if (!value && !options?.optional) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value ?? '';
}

export function ensureNotionEnv() {
  if (!process.env.NOTION_TOKEN) {
    throw new Error('Missing required Notion configuration: NOTION_TOKEN');
  }
}
