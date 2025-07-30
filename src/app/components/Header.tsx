// src/components/Header.tsx

import React from 'react';

export default function Header() {
  return (
    <header className="w-full bg-white py-6 px-4 text-center">
      <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold uppercase tracking-wide text-gray-900">
        St Antony's College, Oxford
      </h1>
      <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 mt-1">
        Boat Club
      </h2>
      <p className="mt-3 max-w-xl mx-auto text-sm sm:text-base text-gray-600">
        One place to sign up and confirm availability for water outings, erg, gym, and tank sessions
      </p>
      <div className="mt-6">
        <a href="#outings" className="inline-block bg-yellow-400 hover:bg-yellow-500 text-black font-medium px-6 py-2 rounded shadow transition-all">
          Confirm availability
        </a>
      </div>
    </header>
  );
}
