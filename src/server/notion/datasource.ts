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
    console.warn(`[notion] Falling back to using provided identifier as data source id: ${identifier}`, error);
    dataSourceCache.set(identifier, identifier);
    return identifier;
  }
}
