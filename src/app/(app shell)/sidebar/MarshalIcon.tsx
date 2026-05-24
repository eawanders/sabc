import React from "react";

export default function MarshalIcon(
  props: React.SVGProps<SVGSVGElement> & { stroke?: string }
) {
  const strokeColor = props.stroke || "#425466";
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M9 11V4a1 1 0 0 1 1.5-.866l9 5.25a1 1 0 0 1 0 1.732l-9 5.25A1 1 0 0 1 9 14.598V13H6a3 3 0 1 1 0-6h3z"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 19c2 1 4 1 6 0"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
