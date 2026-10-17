import { notionRequest } from './client';

// Notion API 2025-09-03 queries data sources, not databases. These are the
// data sources behind the SABC databases, so the hot paths never need a lookup.
// Keys are database ids without hyphens.
const KNOWN_DATA_SOURCES: Record<string, string> = {
  '23d80040a8fa80edafaff6c83477d5d0': '23d80040-a8fa-80e1-a538-000bc51d1f0d', // SABC Outings
  '23d80040a8fa80c08319d48a416d0d3b': '23d80040-a8fa-80cc-8b43-000ba4901edf', // Members
  '27a80040a8fa804a9f8bd536dcc548a7': '27a80040-a8fa-80ee-b4d6-000b500d815b', // SABC Events
  '27980040a8fa8050a61ce835396544f4': '27980040-a8fa-80a1-b1b5-000b57b26287', // OURC Test Database
  'a7d958881fd84cbe92c80f3d659391fd': '930f9a4b-c9d9-498a-be7b-f88e7ae85931', // Marshalling Signups
};

const dataSourceCache = new Map<string, string>();

interface DataSourceResponse {
  data_sources?: { id: string }[];
}

export async function getDataSourceId(identifier: string) {
  const sanitized = identifier.replace(/-/g, '');

  const known = KNOWN_DATA_SOURCES[sanitized];
  if (known) {
    return known;
  }

  const cached = dataSourceCache.get(sanitized);
  if (cached) {
    return cached;
  }

  // Errors (including 429s) propagate and nothing is cached, so the next
  // request retries the lookup instead of reusing a bad id.
  const response = await notionRequest<DataSourceResponse>({
    method: 'get',
    path: `databases/${sanitized}`,
  }, `databases/${sanitized}`);

  const dataSourceId = response.data_sources?.[0]?.id;

  if (!dataSourceId) {
    throw new Error(`No data sources found for Notion database ${identifier}`);
  }

  dataSourceCache.set(sanitized, dataSourceId);
  return dataSourceId;
}
