"use client";

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Event } from '@/components/EventCard';

export default function EventSignUpPageClient() {
  const params = useParams();
  const slug = params.slug as string;

  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchEvent() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/get-event/${slug}`);

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Event not found');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.event) {
          setEvent(data.event);
        } else {
          throw new Error(data.error || 'Failed to fetch event');
        }
      } catch (err) {
        console.error('Error fetching event:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch event');
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchEvent();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="container mx-auto p-2 mobile-feedback-page">
        <h1 className="font-bold mobile-hide-header" style={{ fontSize: '32px' }}>
          Loading...
        </h1>
        <div className="w-full flex items-center justify-center" style={{ minHeight: '400px' }}>
          <p className="text-muted-foreground">Loading event...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-2 mobile-feedback-page">
        <h1 className="font-bold mobile-hide-header" style={{ fontSize: '32px' }}>
          Error
        </h1>
        <div className="w-full flex items-center justify-center" style={{ minHeight: '400px' }}>
          <div className="text-center">
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-semibold">Error loading event</p>
              <p className="text-sm">{error}</p>
            </div>
            <a
              href="/events"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Return to Events
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container mx-auto p-2 mobile-feedback-page">
        <h1 className="font-bold mobile-hide-header" style={{ fontSize: '32px' }}>
          Event Not Found
        </h1>
        <div className="w-full flex items-center justify-center" style={{ minHeight: '400px' }}>
          <div className="text-center">
            <p className="text-muted-foreground mb-4">The event you're looking for could not be found.</p>
            <a
              href="/events"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Return to Events
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!event.embeddedForm) {
    return (
      <div className="container mx-auto p-2 mobile-feedback-page">
        <h1 className="font-bold mobile-hide-header" style={{ fontSize: '32px' }}>
          {event.title}
        </h1>
        <div className="w-full flex items-center justify-center" style={{ minHeight: '400px' }}>
          <div className="text-center">
            <p className="text-muted-foreground mb-4">This event does not have a sign-up form available.</p>
            <a
              href="/events"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Return to Events
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Debug: Log the embedded form content
  console.log('Event data:', event);
  console.log('Embedded form content:', event.embeddedForm);

  return (
    <div className="container mx-auto p-2 mobile-feedback-page">
      <h1 className="font-bold mobile-hide-header" style={{ fontSize: '32px' }}>
        {event.title}
      </h1>
      <div className="w-full">
        {/* Render the iframe from embeddedForm */}
        <div dangerouslySetInnerHTML={{ __html: event.embeddedForm }} />
      </div>
    </div>
  );
}
