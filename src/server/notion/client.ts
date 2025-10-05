import { Client } from '@notionhq/client';
import type { ClientOptions, ClientRequestParameters } from '@notionhq/client/build/src/Client';
import { performance } from 'node:perf_hooks';
import { NOTION_VERSION, getEnvVar, ensureNotionEnv } from './env';

let notionClient: Client | null = null;

function createClient(options?: ClientOptions) {
  ensureNotionEnv();
  return new Client({
    auth: getEnvVar('NOTION_TOKEN'),
    notionVersion: NOTION_VERSION,
    ...options,
  });
}

export function getNotionClient(options?: ClientOptions) {
  if (!notionClient) {
    notionClient = createClient(options);
  }
  return notionClient;
}

export async function notionRequest<TResponse>(params: ClientRequestParameters, label?: string): Promise<TResponse> {
  const client = getNotionClient();
  const start = performance.now();
  try {
    const response = await client.request<TResponse>(params);
    logTiming(label ?? params.path, performance.now() - start);
    return response;
  } catch (error) {
    logTiming(label ?? params.path, performance.now() - start, true);
    throw error;
  }
}

function logTiming(label: string, durationMs: number, errored = false) {
  if (process.env.NODE_ENV === 'development') {
    const rounded = durationMs.toFixed(1);
    const status = errored ? 'error' : 'ok';
    console.debug(`[notion:${status}] ${label} ${rounded}ms`);
  }
}
