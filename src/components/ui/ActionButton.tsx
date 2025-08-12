// src/components/ui/ActionButton.tsx
import React from 'react';

interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

function ChevronRightIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2.90403 1.02903C3.02607 0.90699 3.22393 0.90699 3.34597 1.02903L7.09597 4.77903C7.21801 4.90107 7.21801 5.09893 7.09597 5.22097L3.34597 8.97097C3.22393 9.09301 3.02607 9.09301 2.90403 8.97097C2.78199 8.84893 2.78199 8.65107 2.90403 8.52903L6.43306 5L2.90403 1.47097C2.78199 1.34893 2.78199 1.15107 2.90403 1.02903Z"
        fill="#4C6FFF"
      />
    </svg>
  );
}

export default function ActionButton({
  children,
  onClick,
  className = "",
  disabled = false
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${className}`}
      style={{
        display: 'flex',
        padding: '12px 8px',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        alignSelf: 'stretch',
        border: 'none',
        borderRadius: '6px',
        background: '#E1E8FF',
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        alignSelf: 'stretch'
      }}>
        <span style={{
          color: 'var(--Theme-Primary-Default, #4C6FFF)',
          fontFamily: 'Gilroy',
          fontSize: '12px',
          fontStyle: 'normal',
          fontWeight: 800,
          lineHeight: '12px'
        }}>
          {children}
        </span>
        <ChevronRightIcon />
      </div>
    </button>
  );
}
