import React from "react";

export default function PersonIcon(props: React.SVGProps<SVGSVGElement> & { stroke?: string }) {
  const strokeColor = props.stroke || "#425466";
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="8" r="4" stroke={strokeColor} strokeWidth="1.5" />
      <path d="M4 20c0-3.3137 3.134-6 7-6s7 2.6863 7 6" stroke={strokeColor} strokeWidth="1.5" />
    </svg>
  );
}
