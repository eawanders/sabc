import React from "react";

export default function MembershipPage() {
  return (
    <div className="p-8 mobile-membership-page">
  <h1 className="font-bold mobile-hide-header" style={{ fontSize: '32px' }}>Membership Sign Up</h1>
      <iframe
        src="https://stantonysboatclub.notion.site/ebd/23d80040a8fa80b6a200eacaf389bedf"
        width="100%"
        height="800px"
        frameBorder="0"
        allowFullScreen
        title="Membership Form"
      />
    </div>
  );
}

export const metadata = {
  title: 'Membership',
};
