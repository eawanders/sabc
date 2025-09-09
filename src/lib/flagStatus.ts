// Fetch data from the API on each page load
export async function getFlagStatus() {
  const url = typeof window === 'undefined'
    ? 'https://ourcs.co.uk/api/flags/status/isis/'
    : '/api/flag-status';

  const res = await fetch(url, {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch flag status');
  }
  return res.json();
}
