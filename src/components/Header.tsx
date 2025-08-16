// src/components/Header.tsx

import React from 'react';
import { Heading1, Paragraph } from './ui/Text';
import Box from './ui/Box';

export default function Header() {
  return (
    <Box as="header" className="w-full text-left" pt={128} pb={40} px={24}>
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
        className="max-w-2xl mx-auto sm:text-lg"
        mt={16}
      >
        One place to sign up and confirm availability for water outings, erg, gym, and tank sessions.
      </Paragraph>
    </Box>
  );
}