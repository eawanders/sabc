import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

const Navbar = () => {
  return (
    <nav style={{
      display: 'flex',
      height: '50px',
      padding: '0 24px',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '12px',
      background: '#FFF',
      boxShadow: '0 4px 25px 0 rgba(0, 0, 0, 0.05)',
      width: '100%',
    }}>
      <Link href="/" style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          cursor: 'pointer',
        }}>
          <Image
            src="/sabc-logo.png"
            alt="St Antony's College Oxford Boat Club Logo"
            width={35}
            height={35}
          />
          <span style={{
            fontSize: '18px',
            fontWeight: '500',
            color: '#000',
          }}>
            St Antony&apos;s College, Oxford Boat Club
          </span>
        </div>
      </Link>
    </nav>
  );
};

export default Navbar;
