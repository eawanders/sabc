import { NextResponse } from 'next/server';

export async function GET() {
  console.log('API route /api/flag-status called');
  try {
    const res = await fetch('https://ourcs.co.uk/api/flags/status/isis/', {
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error('Failed to fetch flag status');
    }
    const data = await res.json();
    console.log('External API response:', data);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching flag status:', error);
    return NextResponse.json({ error: 'Failed to fetch flag status' }, { status: 500 });
  }
}
