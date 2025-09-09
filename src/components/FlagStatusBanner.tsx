import React from 'react';

interface FlagStatusBannerProps {
  statusText?: string;
  notices?: string | string[];
  setDate?: string;
}

export default function FlagStatusBanner({ statusText, notices, setDate }: FlagStatusBannerProps) {
  console.log('FlagStatusBanner called with:', { statusText, notices, setDate });

  // Only show banner for Red or Black (case insensitive)
  const lowerStatus = statusText?.toLowerCase();
  if (!statusText || (lowerStatus !== 'red' && lowerStatus !== 'red flag' && lowerStatus !== 'black' && lowerStatus !== 'black flag')) {
    console.log('Banner not shown: statusText is', statusText);
    return null;
  }

  console.log('Banner will be shown for Red or Black Flag');

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
  // Fallback to grey if not found
  const flagImageSrc = flagImageMap[statusText?.replace(' Flag', '') || ''] || flagImageMap['Grey'];

  // Extract color for text (case insensitive)
  const colorRaw = statusText?.replace(/ flag/i, '') || '';
  const color = colorRaw.toUpperCase();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: '240px',
        right: 0,
        display: 'flex',
        padding: '5px 5px',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
        background: '#E1E8FF',
        zIndex: 50,
      }}
    >
      <img
        src={flagImageSrc}
        alt={`${statusText} Flag`}
        style={{
          width: '30px',
          height: '30px',
          flexShrink: 0,
          aspectRatio: '1/1',
          objectFit: 'contain',
        }}
      />
      <div style={{ fontSize: '16px', color: '#101828' }}>
        <strong>{color} FLAG</strong>. No crews are allowed out.
      </div>
    </div>
  );
}
