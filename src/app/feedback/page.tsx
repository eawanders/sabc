// src/app/feedback/page.tsx
"use client";

export default function FeedbackPage() {
  return (
    <div className="container mx-auto p-2">
      <h1 className="text-2xl font-bold mb-6">Feedback</h1>
      <div className="w-full">
              <iframe
                  src="https://stantonysboatclub.notion.site/ebd/24e80040a8fa8035bec2c5387a981512"
                  width="100%"
                  height="600"
                  style={{ border: 0 }}
                  allow="fullscreen"
                  title="SABC Feedback Form"
              />
      </div>
    </div>
  );
}
