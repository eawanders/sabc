interface SwapIconProps {
  className?: string;
}

export function SwapIcon({ className }: SwapIconProps) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Up arrow */}
      <path
        d="M8 3L11 6M8 3L5 6M8 3V10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Down arrow */}
      <path
        d="M8 13L5 10M8 13L11 10M8 13V6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
