import React from 'react';

// Fetch data from the API on each page load
async function getFlagStatus() {
  const res = await fetch('https://ourcs.co.uk/api/flags/status/isis/', {
    // Next.js server components: fetch on server
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error('Failed to fetch flag status');
  }
  return res.json();
}

export default async function FlagStatusPage() {
  let data;
  try {
    data = await getFlagStatus();
  } catch (error) {
    return <div>Error loading flag status.</div>;
  }

  const { status_text, notices, set_date } = data || {};

  // Map status_text to image src
  const flagImageMap: Record<string, string> = {
    'Green': '/green.png',
    'Light Blue': '/light-blue.png',
    'Dark Blue': '/dark-blue.png',
    'Amber': '/amber.png',
    'Red': '/red.png',
    'Black': '/black.png',
    'Grey': '/grey.png',
  };
  // fallback to grey if not found
  const flagImageSrc = flagImageMap[status_text?.replace(' Flag', '') || ''] || flagImageMap['Grey'];

  return (
    <main
      style={{
        display: 'flex',
        padding: '180px 100px',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '64px',
      }}
    >
      <img
        src={flagImageSrc}
        alt={status_text ? `${status_text} Flag` : 'Flag'}
        style={{
          width: 150,
          height: 150,
          flexShrink: 0,
          aspectRatio: '1/1',
          objectFit: 'contain',
        }}
      />
      <div
        style={{
          display: 'flex',
          padding: '36px 54px',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px',
          borderRadius: '10px',
          background: '#FFF',
          boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)',
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: 40, textAlign: 'center', color: '#101828' }}>
          {status_text ? `${status_text} Flag` : 'Flag Status'}
        </div>
        {Array.isArray(notices)
          ? notices.map((notice, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  justifyContent: 'center',
                  width: '100%',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 32,
                    background: 'var(--Purple-600, #6938EF)',
                  }}
                >
                  <svg width="12" height="15" viewBox="0 0 12 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.83325 14.5C5.55725 14.5 5.33325 14.276 5.33325 14V11.8927C5.33325 11.6167 5.55725 11.3927 5.83325 11.3927C6.10925 11.3927 6.33325 11.6167 6.33325 11.8927V14C6.33325 14.276 6.10925 14.5 5.83325 14.5" fill="#FFFFFF"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.83324 1.16669C4.61591 1.16669 3.62524 2.16269 3.62524 3.38735V6.51269C3.62524 7.73602 4.61591 8.73269 5.83324 8.73269C7.05058 8.73269 8.04058 7.73602 8.04058 6.51269V3.38735C8.04058 2.16269 7.05058 1.16669 5.83324 1.16669M5.83324 9.73269C4.06458 9.73269 2.62524 8.28802 2.62524 6.51269V3.38735C2.62524 1.61135 4.06458 0.166687 5.83324 0.166687C7.60191 0.166687 9.04058 1.61135 9.04058 3.38735V6.51269C9.04058 8.28802 7.60191 9.73269 5.83324 9.73269" fill="#FFFFFF"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.83333 12.3926C2.61667 12.3926 0 9.7646 0 6.53394C0 6.25794 0.224 6.03394 0.5 6.03394C0.776 6.03394 1 6.25794 1 6.53394C1 9.2126 3.168 11.3926 5.83333 11.3926C8.49867 11.3926 10.6667 9.2126 10.6667 6.53394C10.6667 6.25794 10.8907 6.03394 11.1667 6.03394C11.4427 6.03394 11.6667 6.25794 11.6667 6.53394C11.6667 9.7646 9.05 12.3926 5.83333 12.3926" fill="#FFFFFF"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.53907 4.33728H7.2124C6.9364 4.33728 6.7124 4.11328 6.7124 3.83728C6.7124 3.56128 6.9364 3.33728 7.2124 3.33728H8.53907C8.81507 3.33728 9.03907 3.56128 9.03907 3.83728C9.03907 4.11328 8.81507 4.33728 8.53907 4.33728" fill="#FFFFFF"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.54045 6.56256H6.54712C6.27112 6.56256 6.04712 6.33856 6.04712 6.06256C6.04712 5.78656 6.27112 5.56256 6.54712 5.56256H8.54045C8.81645 5.56256 9.04045 5.78656 9.04045 6.06256C9.04045 6.33856 8.81645 6.56256 8.54045 6.56256" fill="#FFFFFF"/>
                  </svg>
                </span>
                <span style={{ fontWeight: 300, fontSize: 16, color: '#101828' }}>{notice}</span>
              </div>
            ))
          : (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  justifyContent: 'center',
                  width: '100%',
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    borderRadius: 32,
                    background: 'var(--Purple-600, #6938EF)',
                  }}
                >
                  <svg width="12" height="15" viewBox="0 0 12 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.83325 14.5C5.55725 14.5 5.33325 14.276 5.33325 14V11.8927C5.33325 11.6167 5.55725 11.3927 5.83325 11.3927C6.10925 11.3927 6.33325 11.6167 6.33325 11.8927V14C6.33325 14.276 6.10925 14.5 5.83325 14.5" fill="#FFFFFF"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.83324 1.16669C4.61591 1.16669 3.62524 2.16269 3.62524 3.38735V6.51269C3.62524 7.73602 4.61591 8.73269 5.83324 8.73269C7.05058 8.73269 8.04058 7.73602 8.04058 6.51269V3.38735C8.04058 2.16269 7.05058 1.16669 5.83324 1.16669M5.83324 9.73269C4.06458 9.73269 2.62524 8.28802 2.62524 6.51269V3.38735C2.62524 1.61135 4.06458 0.166687 5.83324 0.166687C7.60191 0.166687 9.04058 1.61135 9.04058 3.38735V6.51269C9.04058 8.28802 7.60191 9.73269 5.83324 9.73269" fill="#FFFFFF"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M5.83333 12.3926C2.61667 12.3926 0 9.7646 0 6.53394C0 6.25794 0.224 6.03394 0.5 6.03394C0.776 6.03394 1 6.25794 1 6.53394C1 9.2126 3.168 11.3926 5.83333 11.3926C8.49867 11.3926 10.6667 9.2126 10.6667 6.53394C10.6667 6.25794 10.8907 6.03394 11.1667 6.03394C11.4427 6.03394 11.6667 6.25794 11.6667 6.53394C11.6667 9.7646 9.05 12.3926 5.83333 12.3926" fill="#FFFFFF"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.53907 4.33728H7.2124C6.9364 4.33728 6.7124 4.11328 6.7124 3.83728C6.7124 3.56128 6.9364 3.33728 7.2124 3.33728H8.53907C8.81507 3.33728 9.03907 3.56128 9.03907 3.83728C9.03907 4.11328 8.81507 4.33728 8.53907 4.33728" fill="#FFFFFF"/>
                    <path fillRule="evenodd" clipRule="evenodd" d="M8.54045 6.56256H6.54712C6.27112 6.56256 6.04712 6.33856 6.04712 6.06256C6.04712 5.78656 6.27112 5.56256 6.54712 5.56256H8.54045C8.81645 5.56256 9.04045 5.78656 9.04045 6.06256C9.04045 6.33856 8.81645 6.56256 8.54045 6.56256" fill="#FFFFFF"/>
                  </svg>
                </span>
                <span style={{ fontWeight: 300, fontSize: 16, color: '#101828' }}>{notices || ''}</span>
              </div>
            )}
      </div>
      <div style={{ fontSize: 12, textAlign: 'center', color: '#101828' }}>
        {set_date
          ? (() => {
              const d = new Date(set_date);
              if (isNaN(d.getTime())) return '';
              const pad = (n: number) => n.toString().padStart(2, '0');
              const day = pad(d.getDate());
              const month = pad(d.getMonth() + 1);
              const year = d.getFullYear().toString().slice(-2);
              const hours = pad(d.getHours());
              const mins = pad(d.getMinutes());
              return `Latest Update: ${day}/${month}/${year} ${hours}:${mins}`;
            })()
          : ''}
      </div>
    </main>
  );
}
