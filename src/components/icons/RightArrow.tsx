interface RightArrowProps {
  className?: string;
  stroke?: string;
}

export function RightArrow({ className, stroke = "#7D8DA6" }: RightArrowProps) {
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
        d="M1.66675 14.3334L7.50008 7.91671L1.66675 1.50004"
        stroke={stroke}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
