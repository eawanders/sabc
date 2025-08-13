interface LeftArrowProps {
  className?: string;
}

export function LeftArrow({ className }: LeftArrowProps) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 9 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M7.33325 1.66663L1.49992 8.08329L7.33325 14.5"
        stroke="#7D8DA6"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
