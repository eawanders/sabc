"use client";

export default function FAQsPageClient() {
  return (
    <div className="container mx-auto p-2 mobile-faqs-page">
      <h1 className="font-bold mobile-hide-header" style={{ fontSize: '32px' }}>FAQs</h1>
      <div className="w-full">
        <iframe
          src="https://stantonysboatclub.notion.site/ebd/28080040a8fa80d5a2e4fee3d8cb2ef6"
          width="100%"
          height="800px"
          style={{ border: 0 }}
          allow="fullscreen"
          title="SABC FAQs"
        />
      </div>
    </div>
  );
}
