import React from "react";

export function SendIcon(props: React.SVGProps<SVGSVGElement> & { stroke?: string }) {
  const strokeColor = props.stroke || "#425466";
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M15.8325 8.17476L10.109 13.9593L3.59944 9.88779C2.66675 9.30427 2.86077 7.88756 3.91572 7.57905L19.3712 3.05289C20.3373 2.76975 21.2326 3.67295 20.9456 4.64212L16.3731 20.0869C16.0598 21.1433 14.6512 21.3321 14.0732 20.3954L10.106 13.9603" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
