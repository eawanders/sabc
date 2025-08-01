// src/components/Header.tsx

import React from 'react';

export default function Header() {
  return (
    <header className="w-full bg-white py-6 px-4 text-center">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold uppercase tracking-wide text-gray-900">
        <p>St Antony&apos;s College, Oxford</p>
      </h1>
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mt-1">
        Boat Club
      </h2>
      <p className="mt-3 max-w-xl mx-auto text-sm sm:text-base text-gray-600">
        One place to sign up and confirm availability for water outings, erg, gym, and tank sessions
      </p>
    </header>
  );
}
