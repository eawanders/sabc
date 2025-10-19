import { notionRequest } from './client';

const dataSourceCache = new Map<string, string>();

interface DataSourceResponse {
  data_sources?: { id: string }[];
}

export async function getDataSourceId(identifier: string) {
  const cached = dataSourceCache.get(identifier);
  if (cached) {
    return cached;
  }

  const sanitized = identifier.replace(/-/g, '');

  try {
    const response = await notionRequest<DataSourceResponse>({
      method: 'get',
      path: `databases/${sanitized}`,
    }, `databases/${sanitized}`);

    const dataSourceId = response.data_sources?.[0]?.id;

    if (!dataSourceId) {
      throw new Error(`No data sources found for Notion database ${identifier}`);
    }

    dataSourceCache.set(identifier, dataSourceId);
    return dataSourceId;
  } catch (error) {
    // Silently fall back to using the database ID directly
    // This is expected behavior when the database doesn't have separate data sources
    if (process.env.NODE_ENV === 'development') {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Only log if it's not the expected "object_not_found" error
      if (!errorMessage.includes('object_not_found') && !errorMessage.includes('Could not find database')) {
        console.warn(`[notion] Falling back to direct database ID for: ${identifier}`);
      }
    }
    // Use the sanitized ID (without hyphens) for the fallback
    dataSourceCache.set(identifier, sanitized);
    return sanitized;
  }
}
