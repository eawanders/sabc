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
  coachFeedback: string;
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
    nextFocus: '',
    coachFeedback: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedData, setHasLoadedData] = useState(false);

  // Debug: Log when the drawer is opened/closed
  React.useEffect(() => {
    console.log('ReportDrawer isOpen changed:', isOpen);
  }, [isOpen]);

  // Load existing report data when drawer opens
  React.useEffect(() => {
    const loadExistingReportData = async () => {
      if (!isOpen || hasLoadedData) return;

      setIsLoading(true);
      setSubmitError(null);

      try {
        console.log('🔍 Loading existing report data for outing:', outingId);

        const response = await fetch(`/api/get-outing-report/${outingId}`);

        if (!response.ok) {
          // If 404, it just means no report exists yet - this is fine
          if (response.status === 404) {
            console.log('📝 No existing report found - starting with empty form');
            setHasLoadedData(true);
            return;
          }
          throw new Error('Failed to load existing report data');
        }

        const result = await response.json();

        if (result.success && result.data) {
          console.log('✅ Loaded existing report data:', result.data);
          setFormData(result.data);
        }

        setHasLoadedData(true);
      } catch (error) {
        console.error('❌ Error loading existing report data:', error);
        // Don't set error state for loading - just proceed with empty form
        setHasLoadedData(true);
      } finally {
        setIsLoading(false);
      }
    };

    loadExistingReportData();
  }, [isOpen, outingId, hasLoadedData]);

  // Reset states when drawer closes
  React.useEffect(() => {
    if (!isOpen) {
      setHasLoadedData(false);
      setIsSubmitted(false);
      setSubmitError(null);
      // Reset form data when closing
      setFormData({
        outingSummary: '',
        boatFeel: '',
        outingSuccesses: '',
        nextFocus: '',
        coachFeedback: ''
      });
    }
  }, [isOpen]);

  // Helper function to check if there's existing data
  const hasExistingData = (): boolean => {
    return formData.outingSummary.trim() !== '' ||
           formData.boatFeel.trim() !== '' ||
           formData.outingSuccesses.trim() !== '' ||
           formData.nextFocus.trim() !== '' ||
           formData.coachFeedback.trim() !== '';
  };

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
          nextFocus: formData.nextFocus,
          coachFeedback: formData.coachFeedback
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit report');
      }

      const result = await response.json();
      console.log('✅ Outing report submitted successfully:', result);

      setIsSubmitted(true);

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
      label: 'Summarise the Outing',
      placeholder: 'Describe what was covered in this outing session...'
    },
    {
      field: 'boatFeel' as keyof ReportFormData,
      label: 'How did the boat feel?',
      placeholder: 'Comment on the boat balance, timing, power...'
    },
    {
      field: 'outingSuccesses' as keyof ReportFormData,
      label: 'What went well?',
      placeholder: 'Highlight the positive aspects of the session...'
    },
    {
      field: 'nextFocus' as keyof ReportFormData,
      label: 'What area you going to build on in the next session?',
      placeholder: 'Identify areas for improvement and next steps...'
    },
    {
      field: 'coachFeedback' as keyof ReportFormData,
      label: 'Feedback from the coach',
      placeholder: 'Enter feedback from the coach...'
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
          Outing Report
        </span>
      }
      className="z-[60]" // Higher z-index than OutingDrawer
    >
      <div
        style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
        onClick={(e) => e.stopPropagation()} // Prevent event bubbling
      >
        {/* Form Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto'
        }}>
          {isLoading ? (
            // Loading State
            <div className="bg-white rounded-lg p-6 shadow-sm text-center">
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm text-muted-foreground">Loading existing report data...</span>
              </div>
            </div>
          ) : (
            // Form State - Always visible
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {questions.map((question, index) => (
                <div key={question.field} className="bg-white rounded-lg p-4 shadow-sm">
                  <label
                    style={{
                      color: '#425466',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      display: 'block',
                      marginBottom: '12px'
                    }}
                  >
                    {question.label}
                  </label>
                  <textarea
                    value={formData[question.field]}
                    onChange={(e) => handleInputChange(question.field, e.target.value)}
                    onClick={(e) => {
                      console.log('Textarea clicked, stopping propagation');
                      e.stopPropagation();
                    }}
                    onFocus={(e) => {
                      console.log('Textarea focused');
                      e.stopPropagation();
                    }}
                    placeholder={question.placeholder}
                    disabled={isSubmitting}
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: 'none',
                      borderRadius: '5px',
                      fontSize: '14px',
                      fontFamily: 'Gilroy',
                      color: '#27272E',
                      resize: 'none',
                      minHeight: '100px',
                      backgroundColor: isSubmitting ? '#f5f5f5' : 'white',
                      boxShadow: 'rgba(174, 174, 174, 0.1) 0px 9px 44px 0px'
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

        {/* Bottom Buttons - Within drawer container */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginTop: 'auto'
        }}>
          <ActionButton
            onClick={handleSubmit}
            disabled={isSubmitting || isSubmitted}
            className="w-full"
            arrowColor="#FFFFFF"
            style={{
              background: isSubmitted
                ? 'rgb(0, 197, 62)'
                : isSubmitting
                  ? '#E1E8FF'
                  : '#4C6FFF',
              color: isSubmitted || !isSubmitting ? '#FFFFFF' : '#FFFFFF'
            }}
          >
            {isSubmitted
              ? 'Report Submitted'
              : isSubmitting
                ? 'Submitting Report...'
                : hasExistingData() ? 'Update Report' : 'Submit Feedback'}
          </ActionButton>

          <ActionButton
            onClick={handleReturnToOuting}
            disabled={isSubmitting}
            className="w-full"
            style={{
              background: '#E1E8FF',
              color: '#4C6FFF'
            }}
          >
            {isSubmitted ? 'Return to Outing' : 'Return to Outing'}
          </ActionButton>
        </div>
      </div>
    </Sheet>
  );
}