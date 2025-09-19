import React from "react";

export function EventsIcon(props: React.SVGProps<SVGSVGElement> & { stroke?: string }) {
  const strokeColor = props.stroke || "#425466";
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M3.09253 9.40439H20.9165" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.442 13.3098H16.4512" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.0047 13.3098H12.014" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.55793 13.3098H7.5672" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.442 17.1963H16.4512" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12.0047 17.1963H12.014" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.55793 17.1963H7.5672" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.0438 2.00012V5.2909" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M7.9654 2.00012V5.2909" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M16.2383 3.57932H7.77096C4.83427 3.57932 3 5.21525 3 8.22234V17.272C3 20.3264 4.83427 22.0001 7.77096 22.0001H16.229C19.175 22.0001 21 20.3547 21 17.3476V8.22234C21.0092 5.21525 19.1842 3.57932 16.2383 3.57932Z" stroke={strokeColor} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
