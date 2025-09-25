// src/app/(app shell)/schedule/ReportDrawer.tsx

"use client";

import React, { useState } from 'react';
import Sheet from '@/components/ui/Sheet';
import ActionButton from '@/components/ui/ActionButton';

interface ReportDrawerProps {
  outingId: string;
  isOpen: boolean;
  onClose: () => void;
  onReturnToOuting: () => void;
}

interface ReportFormData {
  outingSummary: string;
  boatFeel: string;
  outingSuccesses: string;
  nextFocus: string;
}

export default function ReportDrawer({
  outingId,
  isOpen,
  onClose,
  onReturnToOuting
}: ReportDrawerProps) {
  const [formData, setFormData] = useState<ReportFormData>({
    outingSummary: '',
    boatFeel: '',
    outingSuccesses: '',
    nextFocus: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInputChange = (field: keyof ReportFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      console.log('🎯 Submitting outing report for outing:', outingId);

      const response = await fetch('/api/submit-outing-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          outingId: outingId,
          outingSummary: formData.outingSummary,
          boatFeel: formData.boatFeel,
          outingSuccesses: formData.outingSuccesses,
          nextFocus: formData.nextFocus
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit report');
      }

      const result = await response.json();
      console.log('✅ Outing report submitted successfully:', result);

      setIsSubmitted(true);
      // Auto-return to outing after 2 seconds
      setTimeout(() => {
        onReturnToOuting();
      }, 2000);

    } catch (error) {
      console.error('❌ Error submitting outing report:', error);
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnToOuting = () => {
    onReturnToOuting();
  };

  const questions = [
    {
      field: 'outingSummary' as keyof ReportFormData,
      label: 'Summarise the Outing (Pieces? Technical Focus?)',
      placeholder: 'Describe what was covered in this outing session...'
    },
    {
      field: 'boatFeel' as keyof ReportFormData,
      label: 'How did the boat feel?',
      placeholder: 'Comment on the boat balance, timing, power...'
    },
    {
      field: 'outingSuccesses' as keyof ReportFormData,
      label: 'What went well? (What did the crew respond to best? How was your steering/overtaking?)',
      placeholder: 'Highlight the positive aspects of the session...'
    },
    {
      field: 'nextFocus' as keyof ReportFormData,
      label: 'What area you going to build on in the next session?',
      placeholder: 'Identify areas for improvement and next steps...'
    }
  ];

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span style={{
          fontSize: '32px',
          fontWeight: 700,
          display: 'block',
          color: '#27272E',
          fontFamily: 'Gilroy'
        }}>
          Submit Outing Report
        </span>
      }
      className="z-[60]" // Higher z-index than OutingDrawer
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Form Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          paddingBottom: '100px' // Space for fixed bottom buttons
        }}>
          {isSubmitted ? (
            // Success State
            <div className="bg-white rounded-lg p-6 shadow-sm text-center">
              <div style={{
                color: '#00C53E',
                fontSize: '24px',
                fontWeight: 600,
                fontFamily: 'Gilroy',
                marginBottom: '16px'
              }}>
                ✅ Report Submitted Successfully!
              </div>
              <p style={{
                color: '#425466',
                fontSize: '16px',
                fontFamily: 'Gilroy'
              }}>
                Returning to outing details...
              </p>
            </div>
          ) : (
            // Form State
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {questions.map((question, index) => (
                <div key={question.field} className="bg-white rounded-lg p-4 shadow-sm">
                  <label
                    style={{
                      color: '#27272E',
                      fontFamily: 'Gilroy',
                      fontSize: '16px',
                      fontWeight: 600,
                      display: 'block',
                      marginBottom: '12px'
                    }}
                  >
                    {question.label}
                  </label>
                  <textarea
                    value={formData[question.field]}
                    onChange={(e) => handleInputChange(question.field, e.target.value)}
                    placeholder={question.placeholder}
                    disabled={isSubmitting}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '1px solid #E1E8FF',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontFamily: 'Gilroy',
                      color: '#27272E',
                      resize: 'vertical',
                      minHeight: '100px',
                      backgroundColor: isSubmitting ? '#f5f5f5' : 'white'
                    }}
                  />
                </div>
              ))}

              {/* Error Display */}
              {submitError && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p style={{
                    color: '#EF4444',
                    fontSize: '14px',
                    fontFamily: 'Gilroy',
                    fontWeight: 500
                  }}>
                    ❌ {submitError}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed Bottom Buttons */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#FFFFFF',
          borderTop: '1px solid #E1E8FF',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          zIndex: 10
        }}>
          {!isSubmitted && (
            <ActionButton
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full"
              style={{
                background: isSubmitting ? '#E1E8FF' : '#4C6FFF',
                color: '#FFFFFF'
              }}
            >
              {isSubmitting ? 'Submitting Report...' : 'Submit Feedback'}
            </ActionButton>
          )}

          <ActionButton
            onClick={handleReturnToOuting}
            disabled={isSubmitting}
            className="w-full"
            style={{
              background: '#E1E8FF',
              color: '#4C6FFF'
            }}
          >
            Return to Outing
          </ActionButton>
        </div>
      </div>
    </Sheet>
  );
}