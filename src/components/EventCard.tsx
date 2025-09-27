// src/components/EventCard.tsx
import React from 'react';
import { cn } from '@/lib/classnames';

export interface Event {
  id: string;
  title: string; // from "Event" property (title)
  description: string; // from "Description" property (text)
  date: string; // from "Date" property (date) - formatted display date
  time?: string; // from "Date" property (date with time) - formatted display time
  dateTime?: string; // ISO string for the actual date/time value
  imageUrl?: string; // from "Files & media" property (file)
}

export interface EventCardProps {
  event: Event;
  className?: string;
}

export function EventCard({ event, className }: EventCardProps) {
  return (
    <div
      className={cn("flex flex-col items-start", className)}
      style={{
        width: '280px',
        padding: '16px',
        gap: '16px',
        borderRadius: '20px',
        background: '#FFF',
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.20)',
        boxSizing: 'border-box',
        maxHeight: '100%',
        overflow: 'hidden',
      }}
    >
      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt={event.title}
          style={{
            height: '250px',
            alignSelf: 'stretch',
            borderRadius: '10px',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      )}

      <div className="flex flex-col" style={{ gap: '16px', alignSelf: 'stretch', minHeight: 0 }}>
        <h3
          style={{
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#425466',
            margin: 0,
            lineHeight: '1.4',
          }}
        >
          {event.title}
        </h3>

        <p
          style={{
            fontSize: '14px',
            fontWeight: '300',
            color: '#425466',
            margin: 0,
            lineHeight: '1.5',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {event.description}
        </p>

        <div style={{ fontSize: '14px', fontWeight: '300', color: '#425466' }}>
          <div>{event.date}</div>
          {event.time && (
            <div>{event.time}</div>
          )}
        </div>
      </div>
    </div>
  );
}