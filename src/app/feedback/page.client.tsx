"use client";

export default function FeedbackPageClient() {
  return (
    <div className="container mx-auto p-2 mobile-feedback-page">
      <h1 className="font-bold mobile-hide-header" style={{ fontSize: '32px' }}>Feedback Form</h1>
      <div className="w-full">
        <iframe
          src="https://stantonysboatclub.notion.site/ebd/24e80040a8fa8035bec2c5387a981512"
          width="100%"
          height="800px"
          style={{ border: 0 }}
          allow="fullscreen"
          title="SABC Feedback Form"
        />
      </div>
    </div>
  );
}
