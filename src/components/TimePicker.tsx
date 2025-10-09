"use client";

import React, { useState, useRef, useEffect } from 'react';

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
}

export function TimePicker({ value, onChange, style }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedHour, setSelectedHour] = useState('09');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse the value prop into hour and minute
  useEffect(() => {
    if (value) {
      const [hour, minute] = value.split(':');
      setSelectedHour(hour);
      setSelectedMinute(minute);
    }
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  // 15-minute intervals: 00, 15, 30, 45
  const minutes = ['00', '15', '30', '45'];

  const handleHourClick = (hour: string) => {
    setSelectedHour(hour);
    onChange(`${hour}:${selectedMinute}`);
  };

  const handleMinuteClick = (minute: string) => {
    setSelectedMinute(minute);
    onChange(`${selectedHour}:${minute}`);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      {/* Input Display */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '4px 8px',
          borderRadius: '10px',
          border: 'none',
          background: 'rgba(246,247,249,0.60)',
          fontSize: '14px',
          fontFamily: 'Gilroy',
          fontWeight: 300,
          color: '#425466',
          width: '100%',
          minHeight: '36px',
          boxShadow: 'none',
          cursor: 'pointer',
          textAlign: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
          ...style
        }}
      >
        {selectedHour}:{selectedMinute}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'white',
            borderRadius: '10px',
            boxShadow: '0 4px 16px 0 rgba(174,174,174,0.30)',
            overflow: 'hidden',
            display: 'flex',
            width: '140px'
          }}
        >
          {/* Hours Column */}
          <div
            style={{
              flex: 1,
              maxHeight: '200px',
              overflowY: 'auto',
              borderRight: '1px solid #e5e7eb'
            }}
          >
            {hours.map((hour) => (
              <div
                key={hour}
                onClick={() => handleHourClick(hour)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontFamily: 'Gilroy',
                  fontSize: '14px',
                  fontWeight: 300,
                  backgroundColor: hour === selectedHour ? '#238AFF' : 'transparent',
                  color: hour === selectedHour ? '#fff' : '#4C5A6E',
                  transition: 'background 0.2s',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  if (hour !== selectedHour) {
                    e.currentTarget.style.backgroundColor = '#E6F0FF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (hour !== selectedHour) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {hour}
              </div>
            ))}
          </div>

          {/* Minutes Column */}
          <div
            style={{
              flex: 1,
              maxHeight: '200px',
              overflowY: 'auto'
            }}
          >
            {minutes.map((minute) => (
              <div
                key={minute}
                onClick={() => handleMinuteClick(minute)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  fontFamily: 'Gilroy',
                  fontSize: '14px',
                  fontWeight: 300,
                  backgroundColor: minute === selectedMinute ? '#238AFF' : 'transparent',
                  color: minute === selectedMinute ? '#fff' : '#4C5A6E',
                  transition: 'background 0.2s',
                  textAlign: 'center'
                }}
                onMouseEnter={(e) => {
                  if (minute !== selectedMinute) {
                    e.currentTarget.style.backgroundColor = '#E6F0FF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (minute !== selectedMinute) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                {minute}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
