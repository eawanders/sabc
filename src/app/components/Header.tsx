// src/components/Header.tsx

import React from 'react';
import { Heading1, Paragraph } from './ui/Text';

export default function Header() {
  return (
    <header className="w-full bg-white py-10 px-6 text-center">
      <Heading1
        font="inter"
        weight="medium"
        tracking="wider"
        className="sm:text-3xl md:text-4xl"
      >
        Outings Timetable & Availability
      </Heading1>
      <Paragraph
        weight="light"
        color="gray"
        className="mt-4 max-w-2xl mx-auto sm:text-lg"
      >
        One place to sign up and confirm availability for water outings, erg, gym, and tank sessions.
      </Paragraph>
    </header>
  );
}