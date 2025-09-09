import React from 'react';

interface FlagStatusBannerProps {
  statusText?: string;
  notices?: string | string[];
  setDate?: string;
}

export default function FlagStatusBanner({ statusText, notices, setDate }: FlagStatusBannerProps) {
  console.log('FlagStatusBanner called with:', { statusText, notices, setDate });

  // Temporarily always show for debugging
  // if (!statusText || statusText !== 'Grey Flag') {
  //   console.log('Banner not shown: statusText is', statusText);
  //   return null;
  // }

  console.log('Banner will be shown (debug mode)');

  console.log('Rendering banner JSX');

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

  // Determine background color based on status
  const bgColor = 'bg-gray-600';

  return (
    <div className={`fixed bottom-0 left-0 right-0 ${bgColor} text-white p-4 flex items-center justify-between z-50 border-2 border-red-500`}>
      <div className="flex items-center gap-4">
        <img
          src={flagImageSrc}
          alt={`${statusText} Flag`}
          className="w-12 h-12 object-contain"
        />
        <div>
          <div className="font-bold text-lg">{statusText}</div>
          {Array.isArray(notices)
            ? notices.map((notice, idx) => (
                <div key={idx} className="text-sm">{notice}</div>
              ))
            : (
                <div className="text-sm">{notices || ''}</div>
              )}
        </div>
      </div>
      <div className="text-sm">
        {setDate
          ? (() => {
              const d = new Date(setDate);
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
    </div>
  );
}
