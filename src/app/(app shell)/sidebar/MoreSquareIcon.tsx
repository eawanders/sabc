import React from "react";

export function MoreSquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <rect x={2} y={2} width={16} height={16} rx={6} stroke="#425466" strokeWidth={1.5} fill="none" />
      <circle cx={6.5} cy={10} r={1} stroke="#425466" strokeWidth={1.5} fill="none" />
      <circle cx={10} cy={10} r={1} stroke="#425466" strokeWidth={1.5} fill="none" />
      <circle cx={13.5} cy={10} r={1} stroke="#425466" strokeWidth={1.5} fill="none" />
    </svg>
  );
}
