import { Client, LogLevel } from '@notionhq/client';
import type { ClientOptions, RequestParameters } from '@notionhq/client/build/src/Client';
import { performance } from 'node:perf_hooks';
import { NOTION_VERSION, getEnvVar, ensureNotionEnv } from './env';

const DEFAULT_NOTION_TIMEOUT_MS = Math.max(
  Number.parseInt(process.env.NOTION_REQUEST_TIMEOUT_MS ?? '12000', 10) || 12000,
  1000,
);

let notionClient: Client | null = null;

function createClient(options?: ClientOptions) {
  ensureNotionEnv();
  return new Client({
    auth: getEnvVar('NOTION_TOKEN'),
    notionVersion: NOTION_VERSION,
    timeoutMs: DEFAULT_NOTION_TIMEOUT_MS,
    // Suppress client warnings - we handle errors gracefully in our code
    logLevel: LogLevel.ERROR,
    ...options,
  });
}

export function getNotionClient(options?: ClientOptions) {
  if (!notionClient) {
    notionClient = createClient(options);
  }
  return notionClient;
}

export async function notionRequest<TResponse extends object>(params: RequestParameters, label?: string): Promise<TResponse> {
  const client = getNotionClient();
  const start = performance.now();
  const requestLabel = label ?? params.path;
  try {
    const response = await client.request<TResponse>(params);
    logTiming(requestLabel, performance.now() - start);
    return response;
  } catch (error) {
    logTiming(requestLabel, performance.now() - start, true);

    if (isNotionTimeout(error)) {
      const timeoutError = new Error(
        `Notion request "${requestLabel}" exceeded ${DEFAULT_NOTION_TIMEOUT_MS}ms and was aborted`,
      );
      timeoutError.name = 'NotionTimeoutError';
      (timeoutError as Error & { code?: string }).code = 'GATEWAY_TIMEOUT';
      (timeoutError as Error & { cause?: unknown }).cause = error;
      throw timeoutError;
    }

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

function isNotionTimeout(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = (error as Error & { code?: string }).code;
  return error.name === 'RequestTimeoutError' || error.name === 'AbortError' || code === 'ETIMEDOUT';
}
