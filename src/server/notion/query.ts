import { notionRequest } from './client';
import { getDataSourceId } from './datasource';

interface QueryBody {
  page_size?: number;
  start_cursor?: string;
  sorts?: unknown[];
  filter?: unknown;
}

interface QueryResponse<T> {
  results: T[];
  has_more?: boolean;
  next_cursor?: string | null;
}

export async function queryDataSource<T = Record<string, unknown>>(
  databaseId: string,
  body: QueryBody = {},
  label?: string,
): Promise<T[]> {
  const dataSourceId = await getDataSourceId(databaseId);
  const allResults: T[] = [];
  let cursor: string | undefined = body.start_cursor;

  do {
    const response = await notionRequest<QueryResponse<T>>({
      method: 'post',
      path: `data_sources/${dataSourceId}/query`,
      body: {
        page_size: 100,
        ...body,
        ...(cursor ? { start_cursor: cursor } : {}),
      },
    }, label ?? `data_sources/${dataSourceId}/query`);

    allResults.push(...(response.results ?? []));
    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return allResults;
}
