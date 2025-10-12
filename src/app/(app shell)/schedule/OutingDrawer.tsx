// Custom DropdownIndicator for react-select with thinner arrow
import { components, DropdownIndicatorProps, GroupBase, OptionProps } from 'react-select';

type MemberOptionType = {
  value: string;
  label: string;
  member: Member | null;
  isUnavailable?: boolean;
};

// Custom Option component to style unavailable members
const CustomOption = (props: OptionProps<MemberOptionType, false, GroupBase<MemberOptionType>>) => {
  const isUnavailable = props.data.isUnavailable;

  return (
    <components.Option {...props}>
      <div style={{
        color: isUnavailable ? '#94a3b8' : 'inherit',
        fontStyle: isUnavailable ? 'italic' : 'normal'
      }}>
        {props.children}
      </div>
    </components.Option>
  );
};

// Remove explicit any from DropdownIndicatorProps usage
const DropdownIndicator = (
  props: DropdownIndicatorProps<MemberOptionType, false, GroupBase<MemberOptionType>>
) => (
  <components.DropdownIndicator {...props}>
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 8L10 12L14 8" stroke="#7D8DA6" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </components.DropdownIndicator>
);
import { formatTimeRange } from '@/lib/date';
// src/app/(app shell)/schedule/OutingDrawer.tsx

import React, { useState, useEffect } from 'react';
import { useOutingDetails } from '@/hooks/useOutingDetails';
import { useMembers } from '@/hooks/useMembers';
import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';
import { Member } from '@/types/members';
import Sheet from '@/components/ui/Sheet';
import { getEligibleCoxesUnified } from '@/utils/coxEligibility';
import { useAllRowerAvailability } from '@/hooks/useAllRowerAvailability';
import { isRowerAvailable, extractTime } from '@/utils/rowerAvailability';
import ReportDrawer from './ReportDrawer';
import ActionButton from '@/components/ui/ActionButton';
import { useScheduleUrlState } from '@/hooks/useUrlState';
import { buildGoogleCalendarLink, extractPlainTextFromRichText, buildICalendarFile, downloadICalendarFile } from '@/utils/calendarLinks';
import { GoogleCalendarIcon } from '@/components/icons/GoogleCalendarIcon';

// Type definitions for Notion properties
interface NotionDate {
  date: {
    start: string;
    end?: string;
  };
}

interface NotionSelect {
  select: {
    name: string;
  };
}

interface NotionStatus {
  status: {
    name: string;
  };
}
// Add missing NotionRelation type
interface NotionRelation {
  relation: Array<{ id: string }>;
}
interface OutingDrawerProps {
  outingId: string;
  isOpen: boolean;
  onClose: () => void;
}

// Use the same seat labels from the working OutingCard
const seatLabels = [
  "Cox",
  "Stroke",
  "7 Seat",
  "6 Seat",
  "5 Seat",
  "4 Seat",
  "3 Seat",
  "2 Seat",
  "Bow",
  "Coach/Bank Rider",
  "Sub1",
  "Sub2",
  "Sub3",
  "Sub4",
];

// Helper function to get just the number/short name for seat display
const getSeatDisplayName = (seat: string): string => {
  // Extract number from seat names like "2 Seat", "3 Seat", etc.
  if (seat.includes(' Seat')) {
    return seat.replace(' Seat', '');
  }
  // Keep special positions as-is but shorten if needed
  switch (seat) {
    case 'Stroke':
      return 'S';
    case 'Sub1':
      return 'Sub';
    case 'Sub2':
      return 'Sub';
    case 'Sub3':
      return 'Sub';
    case 'Sub4':
      return 'Sub';
    case 'Bow':
      return 'B';
    case 'Coach/Bank Rider':
      return 'BR';
    default:
      return seat; // Cox stays as-is
  }
};

// RowerRow component for individual seat assignments
interface RowerRowProps {
  seat: string;
  selectedMember: string;
  isSubmitting: boolean;
  members: Member[];
  membersLoading: boolean;
  assignments: Record<string, string>;
  onAssignmentChange: (seat: string, memberName: string) => void;
  onAvailabilityUpdate: (seat: string, status: string) => void;
  isLoadingStatus: boolean;
  outingType?: string;
  refreshMembers: () => Promise<void>;
  flagStatus?: string;
  outingDate?: string;
  outingTime?: string;
  outingEndTime?: string;
  rowerAvailabilityMap?: Map<string, Record<string, { start: string; end: string }[]>>;
  onCreateMember: (seat: string, inputValue: string) => Promise<{ value: string; label: string; member: Member } | null>;
}

const RowerRow: React.FC<RowerRowProps> = ({
  seat,
  selectedMember,
  isSubmitting,
  members,
  membersLoading,
  assignments,
  onAssignmentChange,
  onAvailabilityUpdate,
  isLoadingStatus,
  outingType,
  refreshMembers,
  flagStatus,
  outingDate,
  outingTime,
  outingEndTime,
  rowerAvailabilityMap,
  onCreateMember
}) => {
  const isMemberSelected = Boolean(selectedMember);

  // Show seat number only for Water Outings (including Bank Rider/Coach and all rower seats)
  const showSeatNumber = outingType === 'Water Outing';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      alignSelf: 'stretch'
    }}>
      {/* 1. Seat Number/Label (only for Water Outing or Sub seats) */}
      {showSeatNumber && (
        <div style={{
          display: 'flex',
          width: '40px',
          padding: '8px',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '10px',
          borderRadius: '5px',
          background: '#F3F1FE',
          boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)'
        }}>
          <span style={{
            color: '#6F00FF',
            fontFamily: 'Gilroy',
            fontSize: '13px',
            fontStyle: 'normal',
            fontWeight: 300,
            lineHeight: 'normal'
          }}>
            {getSeatDisplayName(seat)}
          </span>
        </div>
      )}

      {/* 2. Rower Dropdown */}
      <div style={{
        display: 'flex',
        padding: '4px 10px',
        alignItems: 'center',
        gap: '10px',
        flex: '1 0 0',
        alignSelf: 'stretch',
        borderRadius: '5px',
        background: '#FFF',
        boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)',
        position: 'relative'
      }}>
        {/* Custom styled select wrapper */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flex: '1 0 0',
          position: 'relative'
        }}>
          {/* Searchable member select using react-select */}
          <div style={{ flex: '1 0 0' }}>
            <CreatableSelect
              components={{ DropdownIndicator, Option: CustomOption }}
              classNamePrefix="rs"
              options={(() => {
                // Base options with "Select Member"
                const baseOptions = [{ value: '', label: 'Select Member', member: null }];

                // Filter members based on seat type and eligibility
                let availableMembers = members;

                if (seat === 'Cox' && flagStatus && outingDate && outingTime && rowerAvailabilityMap) {
                  // For Cox seat, use unified availability system
                  const flagStatusNormalized = flagStatus.toLowerCase().replace(' ', '-') as 'green' | 'light-blue' | 'dark-blue' | 'red' | 'grey' | 'black';
                  availableMembers = getEligibleCoxesUnified(
                    members,
                    flagStatusNormalized,
                    outingDate,
                    outingTime,
                    outingEndTime,
                    rowerAvailabilityMap
                  );
                }

                // Filter out already assigned members (except current selection)
                const assignedNames = Object.entries(assignments)
                  .filter(([key]) => key !== seat)
                  .map(([, name]) => name);

                const filteredMembers = availableMembers.filter((member) =>
                  !assignedNames.includes(member.name) || member.name === selectedMember
                );

                // For rower seats (not Cox), check rower availability
                const memberOptionsWithAvailability = filteredMembers.map((member) => {
                  let isAvailable = true;

                  // Check rower availability for non-Cox seats
                  if (seat !== 'Cox' && outingDate && outingTime && rowerAvailabilityMap) {
                    const memberAvailability = rowerAvailabilityMap.get(member.id);
                    if (memberAvailability) {
                      const sessionStartTime = extractTime(outingTime);
                      const sessionEndTime = outingEndTime ? extractTime(outingEndTime) : undefined;
                      isAvailable = isRowerAvailable(memberAvailability, outingDate, sessionStartTime, sessionEndTime);
                    }
                  }

                  // Format label with availability indicator
                  const label = isAvailable
                    ? member.name
                    : `${member.name} (Unavailable)`;

                  return {
                    value: member.id,
                    label,
                    member,
                    isUnavailable: !isAvailable
                  };
                });

                // For Cox seat, if no eligible coxes are available, show a disabled option
                if (seat === 'Cox' && memberOptionsWithAvailability.length === 0) {
                  return [
                    ...baseOptions,
                    { value: 'no-coxes', label: 'No eligible or available coxes', member: null, isDisabled: true }
                  ];
                }

                return [
                  ...baseOptions,
                  ...memberOptionsWithAvailability
                ];
              })()}
              value={(() => {
                if (!selectedMember) return { value: '', label: 'Select Member', member: null };

                // First try to find the selected member in the full members list
                const selectedMemberObj = members.find(m => m.name === selectedMember);
                if (selectedMemberObj) {
                  return { value: selectedMemberObj.id, label: selectedMemberObj.name, member: selectedMemberObj };
                }

                return { value: '', label: 'Select Member', member: null };
              })()}
              onChange={(option) => {
                // Fix: Handle MultiValue type from react-select
                console.log(`🔍 [RowerRow] Member selection onChange triggered for seat: ${seat}`, {
                  option,
                  isSub: seat.startsWith('Sub'),
                  hasOption: !!option,
                  isArray: Array.isArray(option),
                  hasMember: option && !Array.isArray(option) && 'member' in option,
                  memberName: option && !Array.isArray(option) && 'member' in option ? option.member?.name : 'N/A'
                });

                if (option && !Array.isArray(option) && 'member' in option && option.member) {
                  console.log(`✅ [RowerRow] Calling onAssignmentChange for ${seat} with member: ${option.member.name}`);
                  onAssignmentChange(seat, option.member.name);
                } else {
                  console.log(`❌ [RowerRow] Calling onAssignmentChange for ${seat} with empty string (clearing member)`);
                  onAssignmentChange(seat, "");
                }
              }}
              onCreateOption={async (inputValue) => {
                return await onCreateMember(seat, inputValue);
              }}
              isDisabled={isSubmitting || membersLoading}
              isLoading={membersLoading}
              placeholder={membersLoading ? 'Loading members...' : 'Select member'}
              formatCreateLabel={(inputValue) => `Add "${inputValue}" as a guest attendee.`}
              styles={{
                control: (base, state) => ({
                  ...base,
                  backgroundColor: 'transparent',
                  color: isMemberSelected ? '#4C6FFF' : '#7D8DA6',
                  fontFamily: 'Gilroy',
                  fontSize: '13px',
                  fontWeight: isMemberSelected ? 700 : 300,
                  border: 'none',
                  boxShadow: 'none',
                  outline: 'none',
                  minHeight: '24px',
                  height: '24px',
                  padding: 0,
                  alignItems: 'center',
                  display: 'flex',
                  lineHeight: '24px',
                }),
                input: (base) => ({
                  ...base,
                  margin: 0,
                  padding: 0,
                  height: '24px',
                  fontSize: '13px',
                  lineHeight: '24px',
                  boxShadow: 'none',
                  outline: 'none',
                }),
                indicatorsContainer: (base) => ({
                  ...base,
                  height: '24px',
                  minHeight: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }),
                singleValue: (base) => ({
                  ...base,
                  color: isMemberSelected ? '#4C6FFF' : '#7D8DA6',
                  fontWeight: isMemberSelected ? 700 : 300,
                }),
                placeholder: (base) => ({
                  ...base,
                  color: '#7D8DA6',
                  fontWeight: 300,
                }),
                indicatorSeparator: (base) => ({
                  ...base,
                  display: 'none',
                }),
                  menu: (base) => ({
                    ...base,
                    zIndex: 9999,
                    position: 'absolute',
                    border: 'none',
                    boxShadow: '0 4px 16px 0 rgba(174,174,174,0.10)',
                      left: 0,
                      right: 0,
                      width: '100%',
                      minWidth: '100%',
                      marginTop: '12px', // slight offset below input
                  }),
                  menuList: (base) => ({
                    ...base,
                    border: 'none',
                    boxShadow: 'none',
                    padding: 0,
                  }),
                  menuPortal: (base) => ({
                    ...base,
                    zIndex: 9999,
                  }),
                  option: (base, state) => {
                    const { isSelected, isFocused, data, selectProps } = state;
                    // Get the index of the current option in the options array
                    const optionList = selectProps && selectProps.options ? selectProps.options : [];
                    const index = optionList.findIndex((opt) => {
                      // Only compare if opt has value property
                      return (typeof opt === 'object' && 'value' in opt && 'value' in data)
                        ? opt.value === (data as { value: string }).value
                        : false;
                    });
                    const isFirst = index === 0;
                    const isLast = index === optionList.length - 1;
                    let borderRadius = '0px';
                    if ((isSelected || isFocused) && isFirst && isLast) {
                      borderRadius = '5px'; // Only one item
                    } else if ((isSelected || isFocused) && isFirst) {
                      borderRadius = '5px 5px 0 0';
                    } else if ((isSelected || isFocused) && isLast) {
                      borderRadius = '0 0 5px 5px';
                    }
                    return {
                      ...base,
                      backgroundColor: isSelected
                        ? '#238AFF'
                        : isFocused
                          ? '#E6F0FF'
                          : 'transparent',
                      color: isSelected
                        ? '#fff'
                        : (data as { isDisabled?: boolean })?.isDisabled
                          ? '#9CA3AF'
                          : '#4C5A6E',
                      fontFamily: 'Gilroy',
                      fontSize: '13px',
                      fontWeight: 300,
                      padding: '8px 10px',
                      borderRadius,
                      transition: 'background 0.2s',
                      cursor: (data as { isDisabled?: boolean })?.isDisabled ? 'not-allowed' : 'pointer',
                      opacity: (data as { isDisabled?: boolean })?.isDisabled ? 0.6 : 1,
                    };
                  },
              }}
              menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
              filterOption={(option, inputValue) =>
                option.label.toLowerCase().includes(inputValue.toLowerCase())
              }
            />
          </div>
        </div>
      </div>

      {/* 3. Availability Buttons (Yes/No) - Always visible */}
      <div style={{
        display: 'flex',
        gap: '4px'
      }}>
        {/* Yes Button */}
        <div
          style={{
            display: 'flex',
            width: '32px',
            height: '32px',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            borderRadius: '5px',
            background: assignments[`${seat}_status`] === "Available" ? '#00C53E' : '#FFF',
            opacity: assignments[`${seat}_status`] === "Available" ? 1 : 1,
            boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)',
            cursor: isMemberSelected && !isLoadingStatus ? 'pointer' : 'not-allowed'
          }}
          onClick={() => {
            if (isMemberSelected && !isLoadingStatus) {
              onAvailabilityUpdate(seat, "Available");
            }
          }}
        >
          <svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2.90259 7.40216L4.95814 9.45772L10.097 4.31883"
              stroke={
                assignments[`${seat}_status`] === "Available"
                  ? "#FFFFFF"  // White when selected
                  : !isMemberSelected
                    ? "rgba(0, 197, 62, 0.5)"  // No member selected: 50% opacity
                    : "#00C53E"                // Member selected: 100% opacity
              }
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {/* No Button */}
        <div
          style={{
            display: 'flex',
            width: '32px',
            height: '32px',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            borderRadius: '5px',
            background: assignments[`${seat}_status`] === "Not Available" ? '#EF4444' : '#FFF',
            boxShadow: '0 9px 44px 0 rgba(174, 174, 174, 0.10)',
            cursor: isMemberSelected && !isLoadingStatus ? 'pointer' : 'not-allowed'
          }}
          onClick={() => {
            if (isMemberSelected && !isLoadingStatus) {
              onAvailabilityUpdate(seat, "Not Available");
            }
          }}
        >
          <svg width="13" height="14" viewBox="0 0 13 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4.1392 9.58241L6.83334 6.88828M9.52747 4.19414L6.83334 6.88828M6.83334 6.88828L4.1392 4.19414M6.83334 6.88828L9.52747 9.58241"
              stroke={
                assignments[`${seat}_status`] === "Not Available"
                  ? "#FFFFFF"  // White when selected
                  : !isMemberSelected
                    ? "rgba(254, 100, 112, 0.5)"  // No member selected: 50% opacity
                    : "#EF4444"                   // Member selected: 100% opacity
              }
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

// Helper function to get pill background color based on type and value
const getPillStyle = (type: 'shell' | 'status' | 'flag', value: string | null) => {
  if (type === 'status') {
    switch (value) {
      case 'Confirmed':
        return { background: '#00C53E' }; // Green
      case 'Provisional':
        return { background: '#F59E0B' }; // Yellow/Orange
      case 'Cancelled':
        return { background: '#EF4444' }; // Red
      default:
        return { background: '#6B7280' }; // Gray
    }
  }
  if (type === 'flag') {
    // Map flag colors to background colors
    const flagColorMap: Record<string, string> = {
      'Green': '#00C53E',
      'Light Blue': '#3B82F6',
      'Dark Blue': '#1E40AF',
      'Amber': '#F59E0B',
      'Red': '#EF4444',
      'Black': '#000000',
      'Grey': '#6B7280'
    };
    const colorKey = value?.replace(' Flag', '') || '';
    return { background: flagColorMap[colorKey] || flagColorMap['Grey'] };
  }
  // Shell pills use the primary blue color
  return { background: '#4C6FFF' }; // Primary blue
};

// Pill component
const Pill = ({ children, type, value, shouldStretch = false }: { children: React.ReactNode; type: 'shell' | 'status' | 'flag'; value: string | null; shouldStretch?: boolean }) => (
  <div style={{
    display: 'flex',
    padding: '4px 12px',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    alignSelf: 'stretch',
    borderRadius: '6px',
    ...(shouldStretch && { flex: 1 }),
    ...getPillStyle(type, value)
  }}>
    <span style={{
      color: 'white',
      fontFamily: 'Gilroy',
      fontSize: '12px',
      fontStyle: 'normal',
      fontWeight: 600,
      lineHeight: 'normal'
    }}>
      {children}
    </span>
  </div>
);

export default function OutingDrawer({ outingId, isOpen, onClose }: OutingDrawerProps) {
  const { urlState, openReportDrawer, closeDrawer, openSessionDrawer } = useScheduleUrlState();
  const { outing, loading, error, refresh } = useOutingDetails(outingId);
  const { members, loading: membersLoading, refresh: refreshMembers } = useMembers();
  const { availabilityMap: rowerAvailabilityMap, loading: rowerAvailabilityLoading } = useAllRowerAvailability(members);

  // State management from the proven OutingCard pattern
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const submittingSeats = new Set<string>(); // Not actively used for submitting state
  const [pendingOptimisticUpdates, setPendingOptimisticUpdates] = useState<Set<string>>(new Set());

  // Report drawer state is now controlled by the URL
  const isReportDrawerOpen = urlState.drawer?.type === 'report' && urlState.drawer?.id === outingId;

  // Flag status state
  const [flagStatus, setFlagStatus] = useState<{ status_text?: string } | null>(null);

  // Mobile detection and metadata collapse state
  const [isMobile, setIsMobile] = useState(false);
  const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Extract outing date and time for cox eligibility
  const outingDate = React.useMemo(() => {
    if (!outing?.properties?.StartDateTime) return undefined;
    const startDateObj = outing.properties.StartDateTime as NotionDate;
    return startDateObj?.date?.start ? new Date(startDateObj.date.start).toISOString().split('T')[0] : undefined;
  }, [outing]);

  const outingTime = React.useMemo(() => {
    if (!outing?.properties?.StartDateTime) return undefined;
    const startDateObj = outing.properties.StartDateTime as NotionDate;
    return startDateObj?.date?.start || undefined;
  }, [outing]);

  const outingEndTime = React.useMemo(() => {
    if (!outing?.properties?.EndDateTime) return undefined;
    const endDateObj = outing.properties.EndDateTime as NotionDate;
    // EndDateTime can have either date.start or date.end
    return endDateObj?.date?.start || endDateObj?.date?.end || undefined;
  }, [outing]);

  const outingStartDateTime = React.useMemo(() => {
    const startDateObj = outing?.properties?.StartDateTime as NotionDate | undefined;
    const startValue = startDateObj?.date?.start;
    return startValue ? new Date(startValue) : undefined;
  }, [outing]);

  const outingEndDateTime = React.useMemo(() => {
    const endDateObj = outing?.properties?.EndDateTime as NotionDate | undefined;
    const endValue = endDateObj?.date?.start || endDateObj?.date?.end;
    return endValue ? new Date(endValue) : undefined;
  }, [outing]);

  type NotionRichTextProperty = { plain_text?: string; rich_text?: unknown };

  const outingNotes = React.useMemo(() => {
    const details = outing?.properties?.SessionDetails as NotionRichTextProperty | undefined;
    if (!details) return undefined;

    const plain = details.plain_text?.trim();
    if (plain) {
      return plain;
    }

    if (details.rich_text) {
      return extractPlainTextFromRichText(details.rich_text) || undefined;
    }

    return undefined;
  }, [outing]);

  useEffect(() => {
    if (!loading && outing) {
      setHasLoadedOnce(true);
    }
  }, [loading, outing]);

  // Use a ref to track current outing ID to prevent unnecessary re-initialization
  const currentOutingIdRef = React.useRef<string | null>(null);
  const lastRefreshRef = React.useRef(0);

  const throttledRefresh = React.useCallback(async (force = false) => {
    if (!refresh) return;
    const now = Date.now();
    if (!force && now - lastRefreshRef.current < 5000) {
      return;
    }
    lastRefreshRef.current = now;
    await refresh();
  }, [refresh]);

  // Helper functions from the proven OutingCard pattern
  const getOutingProperty = React.useCallback((propertyName: string): unknown => {
    // Map seat names to actual database property names
    const seatToPropertyMapping: Record<string, string> = {
      'Coach/Bank Rider': 'CoachBankRider',
      // Note: Sub1-Sub4 are already correctly mapped in the API response,
      // so we don't need to remap them here
    };

    const actualPropertyName = seatToPropertyMapping[propertyName] || propertyName;
    const property = outing?.properties?.[actualPropertyName as keyof typeof outing.properties];

    // Add debug logging specifically for Sub seats
    if (propertyName.startsWith('Sub')) {
      console.log(`🔍 [getOutingProperty] Getting property for SUB seat:`, {
        propertyName,
        actualPropertyName,
        isMapped: propertyName !== actualPropertyName,
        hasProperty: !!property,
        propertyValue: property,
        availableProperties: outing?.properties ? Object.keys(outing.properties) : []
      });
    }

    return property;
  }, [outing]);

  // Helper function to map seat names to status field names
  const getStatusField = (seat: string): string => {
    const statusFieldMapping: Record<string, string> = {
      'Cox': 'CoxStatus',
      'Stroke': 'StrokeStatus',
      'Bow': 'BowStatus',
      '7 Seat': '7 SeatStatus',
      '6 Seat': '6 SeatStatus',
      '5 Seat': '5 SeatStatus',
      '4 Seat': '4 SeatStatus',
      '3 Seat': '3 SeatStatus',
      '2 Seat': '2 SeatStatus',
      'Coach/Bank Rider': 'BankRiderStatus',
      // Note: API maps 'Sub 1 Status' → 'Sub1Status', so we use the mapped names
      'Sub1': 'Sub1Status',
      'Sub2': 'Sub2Status',
      'Sub3': 'Sub3Status',
      'Sub4': 'Sub4Status'
    };

    return statusFieldMapping[seat] || `${seat}Status`;
  };

  // Helper function to get the actual backend property name for the status
  const getNotionStatusField = (statusField: string): string => {
    const notionFieldMapping: Record<string, string> = {
      'CoxStatus': 'CoxStatus',
      'StrokeStatus': 'StrokeStatus',
      'BowStatus': 'BowStatus',
      '7 SeatStatus': '7 Seat Status',
      '6 SeatStatus': '6 Seat Status',
      '5 SeatStatus': '5 Seat Status',
      '4 SeatStatus': '4 Seat Status',
      '3 SeatStatus': '3 Seat Status',
      '2 SeatStatus': '2 Seat Status',
      'BankRiderStatus': 'Bank Rider Status',
      // Map back to Notion field names with spaces
      'Sub1Status': 'Sub 1 Status',
      'Sub2Status': 'Sub 2 Status',
      'Sub3Status': 'Sub 3 Status',
      'Sub4Status': 'Sub 4 Status'
    };

    return notionFieldMapping[statusField] || statusField;
  };

  // Helper function to extract status from Notion property
  const extractStatusFromProperty = (
    property: { status?: { name?: string } } | null | undefined
  ): string | null => {
    if (!property) return null;

    if (property && 'status' in property) {
      return property.status?.name || null;
    }

    return null;
  };

  // Helper function to check if outing should be auto-confirmed
  const shouldAutoConfirmOuting = React.useCallback((
    currentAssignments: Record<string, string>,
    outingType: string,
    flagStatus: string | null,
    coxExperience: string | undefined
  ): boolean => {
    // Only apply to Water Outings
    if (outingType !== 'Water Outing') {
      return false;
    }

    // Define the 8 main rowing seats (excluding subs and bank rider)
    const mainSeats = [
      'Cox', 'Stroke', '7 Seat', '6 Seat', '5 Seat',
      '4 Seat', '3 Seat', '2 Seat', 'Bow'
    ];

    // Check if all 8 main seats + cox have members assigned and are "Available"
    for (const seat of mainSeats) {
      if (!currentAssignments[seat] || currentAssignments[`${seat}_status`] !== 'Available') {
        return false;
      }
    }

    // Check if bank rider is required based on conditions
    let bankRiderRequired = false;

    if (flagStatus) {
      const normalizedFlag = flagStatus.toLowerCase().replace(' ', '-');

      // Green flag AND Cox is Novice or Novice (less than 1 term)
      if (normalizedFlag === 'green' &&
          (coxExperience === 'Novice' || coxExperience === 'Novice (less than 1 term)')) {
        bankRiderRequired = true;
      }
      // Light blue flag AND Cox is Novice
      else if (normalizedFlag === 'light-blue' && coxExperience === 'Novice') {
        bankRiderRequired = true;
      }
      // Amber flag
      else if (normalizedFlag === 'amber') {
        bankRiderRequired = true;
      }
    }

    // If bank rider is required, check if they are assigned and available
    if (bankRiderRequired) {
      if (!currentAssignments['Coach/Bank Rider'] ||
          currentAssignments['Coach/Bank Rider_status'] !== 'Available') {
        return false;
      }
    }

    return true;
  }, []);

  const outingTitle = React.useMemo(() => {
    const divValue = outing?.properties?.Div?.select?.name || '';
    const typeValue = outing?.properties?.Type?.select?.name || '';

    if (divValue && typeValue) {
      return `${divValue} ${typeValue}`;
    }

    if (divValue) {
      return `${divValue} Outing`;
    }

    if (typeValue) {
      return `${typeValue} Outing`;
    }

    const nameTitle = outing?.properties?.Name?.title;
    if (Array.isArray(nameTitle) && nameTitle.length > 0) {
      const firstTitle = nameTitle[0];
      if (firstTitle && typeof firstTitle === 'object' && 'plain_text' in firstTitle) {
        const value = (firstTitle as { plain_text?: string }).plain_text;
        if (value && value.trim().length > 0) {
          return value.trim();
        }
      }
    }

    return 'Unnamed Outing';
  }, [outing]);

  const calendarTitle = React.useMemo(() => `SABC: ${outingTitle}`, [outingTitle]);

  const googleCalendarUrl = React.useMemo(() => {
    if (!outingStartDateTime) return undefined;

    const fallbackDurationMs = 60 * 60 * 1000;
    const tentativeEnd = outingEndDateTime && outingEndDateTime > outingStartDateTime
      ? outingEndDateTime
      : new Date(outingStartDateTime.getTime() + fallbackDurationMs);

    try {
      return buildGoogleCalendarLink({
        title: calendarTitle,
        description: outingNotes,
        start: outingStartDateTime,
        end: tentativeEnd,
      });
    } catch (err) {
      console.error('[OutingDrawer] Failed to create Google Calendar link', err);
      return undefined;
    }
  }, [calendarTitle, outingEndDateTime, outingNotes, outingStartDateTime]);

  const handleAddToGoogleCalendar = React.useCallback(() => {
    if (!outingStartDateTime || typeof window === 'undefined') return;

    const fallbackDurationMs = 60 * 60 * 1000;
    const tentativeEnd = outingEndDateTime && outingEndDateTime > outingStartDateTime
      ? outingEndDateTime
      : new Date(outingStartDateTime.getTime() + fallbackDurationMs);

    // Detect if user is on mobile
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      // On mobile, download .ics file which will prompt to open in calendar app
      try {
        const icsContent = buildICalendarFile({
          title: calendarTitle,
          description: outingNotes,
          start: outingStartDateTime,
          end: tentativeEnd,
          location: 'St Anne\'s College Boat Club',
        });
        const filename = `${outingTitle.replace(/[^a-zA-Z0-9]/g, '-')}.ics`;
        downloadICalendarFile(icsContent, filename);
      } catch (err) {
        console.error('[OutingDrawer] Failed to create iCalendar file', err);
      }
    } else {
      // On desktop, use Google Calendar link
      if (googleCalendarUrl) {
        window.open(googleCalendarUrl, '_blank', 'noopener,noreferrer');
      }
    }
  }, [calendarTitle, outingEndDateTime, outingNotes, outingStartDateTime, outingTitle, googleCalendarUrl]);

  const isCalendarButtonDisabled = !outingStartDateTime;

  // Initialize assignments from outing data - using the proven pattern
  React.useEffect(() => {
    if (!outing || !members.length) return;

    // Only initialize when the outing ID changes, not on every outing data update
    if (currentOutingIdRef.current === outing.id) return;

    // Reset state for new outing
    if (currentOutingIdRef.current !== outing.id) {
      setIsInitialized(false);
      setAssignments({});
      setPendingOptimisticUpdates(new Set());
      currentOutingIdRef.current = outing.id;
    }

    setIsLoadingStatus(true);
    console.log(`🔧 Initializing assignments for NEW outing ${outing.id}`);

    const initialAssignments: Record<string, string> = {};

    // First pass: Get all member assignments
    seatLabels.forEach((seat) => {
      const seatProp = getOutingProperty(seat);
      console.log(`🔍 Checking seat ${seat} property:`, seatProp);

      // The API returns {relation: [{id: "..."}], has_more: false} structure
      if (seatProp && typeof seatProp === 'object' && 'relation' in seatProp) {
        const relationArray = (seatProp as { relation: { id: string }[] }).relation;
        if (Array.isArray(relationArray) && relationArray.length > 0) {
          const relatedId = relationArray[0].id;
          const matchedMember = members.find((m) => m.id === relatedId);
          if (matchedMember) {
            initialAssignments[seat] = matchedMember.name;
            console.log(`🎯 Pre-filled ${seat} with ${matchedMember.name} (ID: ${relatedId})`);
          } else {
            console.log(`⚠️ No member found for ID ${relatedId} in seat ${seat}`);
          }
        }
      }
    });

    // Second pass: Get all status values by looking for the actual Notion property names
    seatLabels.forEach((seat) => {
      const statusField = getStatusField(seat);
      const notionStatusField = getNotionStatusField(statusField);

      // Try all possible ways the status could be stored
      const statusVariations = [
        // Try the mapped Notion property name (e.g. "CoxStatus")
        outing?.properties?.[notionStatusField as keyof typeof outing.properties],

        // Try the frontend status field (e.g. "CoxStatus")
        outing?.properties?.[statusField as keyof typeof outing.properties],

        // Try with spaces removed (e.g. "CoxStatus" or "Cox Status" without spaces)
        outing?.properties?.[statusField.replace(/\s+/g, '') as keyof typeof outing.properties],
        outing?.properties?.[notionStatusField.replace(/\s+/g, '') as keyof typeof outing.properties],

        // Try with different spacing patterns
        outing?.properties?.[`${seat} Status` as keyof typeof outing.properties],
        outing?.properties?.[`${seat}Status` as keyof typeof outing.properties]
      ];

      // Find the first status property that exists and has a value
      let statusValue = null;
      let sourceName = "";

      for (let i = 0; i < statusVariations.length; i++) {
        const property = statusVariations[i];
        // Only pass to extractStatusFromProperty if it has a 'status' property
        const extractedStatus =
          property && typeof property === "object" && "status" in property
            ? extractStatusFromProperty(property as { status?: { name?: string } })
            : null;

        if (extractedStatus) {
          statusValue = extractedStatus;
          sourceName = ["mapped", "frontend", "no-space-frontend", "no-space-notion", "seat-space", "seat-no-space"][i];
          break;
        }
      }

      // Set the status if we found one
      if (statusValue) {
        initialAssignments[`${seat}_status`] = statusValue;
        console.log(`🔹 Pre-filled ${seat} status with "${statusValue}" (source: ${sourceName})`);
      } else {
        console.log(`ℹ️ No status found for ${seat} under any variation`);

        // If we have a member assigned but no status, default to "Awaiting Approval"
        if (initialAssignments[seat]) {
          initialAssignments[`${seat}_status`] = "Awaiting Approval";
          console.log(`ℹ️ Default status set to "Awaiting Approval" for ${seat}`);
        }
      }
    });

    // Debug all Notion properties
    console.log("📊 All Notion properties:", Object.keys(outing?.properties || {}));

    // Set assignments without merging to avoid stale state
    setAssignments(initialAssignments);

    setIsInitialized(true);
    setIsLoadingStatus(false);
    console.log(`✅ Assignments initialized for outing ${outing.id}:`, initialAssignments);
  }, [outing?.id, members.length, getOutingProperty]);

  // Fetch flag status for water outings
  useEffect(() => {
    const fetchFlagStatus = async () => {
      if (outing?.properties?.Type?.select?.name === 'Water Outing') {
        try {
          const response = await fetch('/api/flag-status');
          if (response.ok) {
            const data = await response.json();
            setFlagStatus(data);
          }
        } catch (error) {
          console.error('Error fetching flag status:', error);
        }
      }
    };

    if (outing) {
      fetchFlagStatus();
    }
  }, [outing]);

  // Handle updates to outing data while preserving optimistic updates
  React.useEffect(() => {
    // Only process updates for the current outing and after initialization
    if (!outing || !isInitialized || currentOutingIdRef.current !== outing.id) return;

    // If we have pending optimistic updates, don't overwrite them
    if (pendingOptimisticUpdates.size > 0) {
      console.log(`🔄 Skipping data update due to ${pendingOptimisticUpdates.size} pending optimistic updates`);
      return;
    }

    console.log(`🔄 Updating assignments from fresh outing data (no pending optimistic updates)`);

    // Update assignments from fresh outing data
    const freshAssignments: Record<string, string> = {};

    // Get fresh assignments from backend
    seatLabels.forEach((seat) => {
      const seatProp = getOutingProperty(seat);
      const isSub = seat.startsWith('Sub');

      if (isSub) {
        console.log(`🔍 [SUBS] Fresh data for SUB seat ${seat}:`, {
          seat,
          seatProp,
          hasRelation: seatProp && typeof seatProp === 'object' && 'relation' in seatProp,
          propType: typeof seatProp
        });
      } else {
        console.log(`🔍 Fresh data for seat ${seat}:`, seatProp);
      }

      // The API returns {relation: [{id: "..."}], has_more: false} structure
      if (seatProp && typeof seatProp === 'object' && 'relation' in seatProp) {
        const relationArray = (seatProp as { relation: { id: string }[] }).relation;
        if (Array.isArray(relationArray) && relationArray.length > 0) {
          const relatedId = relationArray[0].id;
          const matchedMember = members.find((m) => m.id === relatedId);
          if (matchedMember) {
            freshAssignments[seat] = matchedMember.name;
            if (isSub) {
              console.log(`✅ [SUBS] Fresh assignment for SUB ${seat}: ${matchedMember.name} (ID: ${relatedId})`);
            } else {
              console.log(`🔄 Fresh assignment for ${seat}: ${matchedMember.name} (ID: ${relatedId})`);
            }
          } else if (isSub) {
            console.warn(`⚠️ [SUBS] No member found for SUB ${seat} with ID: ${relatedId}`);
          }
        } else if (isSub) {
          console.log(`ℹ️ [SUBS] Empty relation array for SUB ${seat}`);
        }
      } else if (isSub) {
        console.log(`ℹ️ [SUBS] No relation property for SUB ${seat}`);
      }

      // Get fresh status data
      const statusField = getStatusField(seat);
      const notionStatusField = getNotionStatusField(statusField);

      const statusVariations = [
        outing?.properties?.[notionStatusField as keyof typeof outing.properties],
        outing?.properties?.[statusField as keyof typeof outing.properties],
        outing?.properties?.[statusField.replace(/\s+/g, '') as keyof typeof outing.properties],
        outing?.properties?.[notionStatusField.replace(/\s+/g, '') as keyof typeof outing.properties],
        outing?.properties?.[`${seat} Status` as keyof typeof outing.properties],
        outing?.properties?.[`${seat}Status` as keyof typeof outing.properties]
      ];

      for (const property of statusVariations) {
        const extractedStatus =
          property && typeof property === "object" && "status" in property
            ? extractStatusFromProperty(property as { status?: { name?: string } })
            : null;

        if (extractedStatus) {
          freshAssignments[`${seat}_status`] = extractedStatus;
          break;
        }
      }
    });

    // Update assignments with fresh data
    setAssignments(freshAssignments);
    console.log(`✅ Updated assignments from fresh data:`, freshAssignments);
  }, [outing, isInitialized, currentOutingIdRef.current, pendingOptimisticUpdates.size, getOutingProperty, members, seatLabels]);

  // Member creation handler
  const handleCreateMember = async (seat: string, inputValue: string): Promise<{ value: string; label: string; member: Member } | null> => {
    try {
      console.log('🆕 [OutingDrawer] Creating new member:', { seat, inputValue, outingId: outing?.id });
      setIsLoadingStatus(true);

      const requestBody = {
        name: inputValue.trim(),
        role: 'non-member'
      };
      console.log('🆕 [OutingDrawer] Request body:', requestBody);

      const response = await fetch('/api/add-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log('🆕 [OutingDrawer] Add member response:', { status: response.status, ok: response.ok });

      if (!response.ok) {
        const errorData = await response.json().catch((e) => {
          console.error('🆕 [OutingDrawer] Failed to parse error response:', e);
          return { error: 'Unknown error' };
        });
        console.error('🆕 [OutingDrawer] Failed to create member:', errorData);
        throw new Error(errorData.error || 'Failed to create member');
      }

      const data = await response.json();
      console.log('🆕 [OutingDrawer] Member created successfully:', data);

      if (!outing) {
        console.error('🆕 [OutingDrawer] No outing data available');
        throw new Error('No outing data available');
      }

      // Immediately assign the new member to the seat using their ID
      console.log('🆕 [OutingDrawer] Assigning new member to seat:', { seat, memberId: data.member.id, outingId: outing.id });

      const assignBody = {
        outingId: outing.id,
        seat,
        memberId: data.member.id
      };
      console.log('🆕 [OutingDrawer] Assign request body:', assignBody);

      const assignResponse = await fetch('/api/assign-seat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignBody),
      });

      console.log('🆕 [OutingDrawer] Assign response:', { status: assignResponse.status, ok: assignResponse.ok });

      if (!assignResponse.ok) {
        const assignError = await assignResponse.json().catch((e) => {
          console.error('🆕 [OutingDrawer] Failed to parse assign error:', e);
          return { error: 'Unknown error' };
        });
        console.error('🆕 [OutingDrawer] Failed to assign newly created member:', assignError);
        throw new Error(assignError.error || 'Failed to assign newly created member');
      }

      console.log('🆕 [OutingDrawer] Member assigned successfully');

      // Update local state immediately (optimistic update)
      console.log('🆕 [OutingDrawer] Updating local state optimistically:', { seat, memberName: data.member.name });
      setAssignments(prev => ({
        ...prev,
        [seat]: data.member.name,
        [`${seat}_status`]: 'Awaiting Approval'
      }));

      // Set status to "Awaiting Approval" (best effort, don't block UI)
      const statusField = getStatusField(seat);
      console.log('🆕 [OutingDrawer] Setting status to Awaiting Approval:', { outingId: outing.id, statusField });
      fetch('/api/update-availability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outingId: outing.id, statusField, status: 'Awaiting Approval' }),
      }).catch((e) => {
        console.error('🆕 [OutingDrawer] Failed to update status:', e);
      });

      // Clear loading state immediately
      console.log('🆕 [OutingDrawer] Clearing loading state');
      setIsLoadingStatus(false);

      // Refresh members list and outing data in background
      console.log('🆕 [OutingDrawer] Starting background refresh');
      Promise.all([
        refreshMembers(),
        throttledRefresh(true)
      ]).then(() => {
        console.log('🆕 [OutingDrawer] Background refresh completed successfully');
      }).catch(err => {
        console.error('🆕 [OutingDrawer] Error refreshing data:', err);
      });

      // Return the new option for CreatableSelect
      console.log('🆕 [OutingDrawer] Member creation flow completed successfully');
      return { value: data.member.id, label: data.member.name, member: data.member };
    } catch (error) {
      console.error('🆕 [OutingDrawer] Error in handleCreateMember:', error);
      console.error('🆕 [OutingDrawer] Error stack:', error instanceof Error ? error.stack : 'No stack');
      setIsLoadingStatus(false);
      alert(error instanceof Error ? error.message : 'Failed to create new member. Please try again.');
      return null;
    }
  };

  // Assignment change handler using the proven pattern
  const handleAssignmentChange = async (seat: string, memberName: string) => {
    if (!isInitialized || !outing) {
      console.warn('⚠️ [OutingDrawer] Attempted to change assignment before initialization complete or no outing data');
      return;
    }

    const prevMemberName = assignments[seat] || "";
    const member = members.find((m) => m.name === memberName) || null;

    const isSub = seat.startsWith('Sub');
    console.log(`🔍 [OutingDrawer] Assignment change for ${isSub ? 'SUB SEAT' : 'regular seat'}:`, {
      seat,
      from: prevMemberName,
      to: memberName,
      memberId: member?.id,
      outingId: outing.id,
      isSub,
      memberObject: member ? { id: member.id, name: member.name } : null
    });

    // Update local state optimistically but handle rollback on error
    const previousAssignments = { ...assignments };

    // Track if we're removing a member
    const isRemovingMember = prevMemberName !== "" && memberName === "";
    console.log(`📝 [OutingDrawer] isRemovingMember: ${isRemovingMember}, isSub: ${isSub}`);

    // Mark this seat as having a pending optimistic update
    setPendingOptimisticUpdates(prev => new Set([...prev, seat]));

    setIsLoadingStatus(true); // Start loading state for Notion update

    console.log(`📝 [OutingDrawer] Updating local state optimistically for ${seat}`);
    setAssignments((prev) => {
      const updated = { ...prev };
      if (memberName === "") {
        delete updated[seat];
        console.log(`🗑️ [OutingDrawer] Removed ${seat} from local state`);
      } else {
        updated[seat] = memberName;
        console.log(`✏️ [OutingDrawer] Set ${seat} = "${memberName}" in local state`);
      }
      return updated;
    });

    try {
      const assignBody = {
        outingId: outing.id,
        seat,
        memberId: member ? member.id : null,
      };
      console.log(`� [OutingDrawer] Sending assign-seat request for ${isSub ? 'SUB' : 'regular'} seat:`, assignBody);

      const res = await fetch("/api/assign-seat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assignBody),
      });

      console.log(`🔍 [OutingDrawer] Request sent - details:`, {
        url: '/api/assign-seat',
        method: 'POST',
        bodyString: JSON.stringify(assignBody),
        isSub,
        seat,
        memberName,
        memberId: member?.id,
        outingId: outing.id
      });

      console.log(`� [OutingDrawer] Assign seat response for ${seat}:`, { status: res.status, ok: res.ok });

      if (!res.ok) {
        const errorText = await res.text().catch((e) => {
          console.error(`📝 [OutingDrawer] Failed to read error response for ${seat}:`, e);
          return 'Unknown error';
        });
        console.error(`❌ [OutingDrawer] Assignment failed for ${seat}:`, errorText);
        console.error(`❌ [OutingDrawer] Failed request details:`, {
          assignBody,
          responseStatus: res.status,
          responseStatusText: res.statusText,
          errorText,
          isSub,
          seat,
          memberName,
          outingId: outing.id
        });
        // Rollback on error
        setAssignments(previousAssignments);
        setIsLoadingStatus(false); // End loading state on error
        throw new Error("Failed to update Notion");
      }

      const responseData = await res.json();
      console.log(`✅ [OutingDrawer] Seat ${seat} ${isSub ? '(SUB)' : ''} ${member ? `updated with ${memberName}` : 'cleared'}. Response:`, responseData);
      console.log(`✅ [OutingDrawer] Full response details:`, {
        responseData: JSON.stringify(responseData, null, 2),
        isSub,
        seat,
        memberName,
        memberId: member?.id
      });

      // Clear loading state immediately after successful seat assignment
      console.log(`📝 [OutingDrawer] Clearing loading state after seat assignment for ${seat}`);
      setIsLoadingStatus(false);

      // Handle status update for both adding/changing a member OR removing a member
      const statusField = getStatusField(seat);

      if ((memberName !== "" && prevMemberName !== memberName) || isRemovingMember) {
        // Always update to "Awaiting Approval" when there's a change
        console.log(`� [OutingDrawer] Resetting ${statusField} to "Awaiting Approval" due to assignment change`);

        // Optimistically update the UI first
        setAssignments((prev) => {
          const updated = { ...prev };

          if (isRemovingMember) {
            // If removing member, visually remove the status from UI
            delete updated[`${seat}_status`];
          } else {
            // If adding/changing member, show the new status
            updated[`${seat}_status`] = "Awaiting Approval";
          }

          return updated;
        });

        try {
          const statusBody = {
            outingId: outing.id,
            statusField,
            status: "Awaiting Approval",
          };
          console.log('📝 [OutingDrawer] Update status request body:', statusBody);

          const res = await fetch("/api/update-availability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(statusBody),
          });

          console.log('📝 [OutingDrawer] Update status response:', { status: res.status, ok: res.ok });

          if (!res.ok) {
            const errorText = await res.text().catch((e) => {
              console.error('📝 [OutingDrawer] Failed to read status error response:', e);
              return 'Unknown error';
            });
            console.error('📝 [OutingDrawer] Status update failed:', errorText);
            throw new Error(`Failed to reset availability: ${errorText}`);
          }

          console.log(`✅ [OutingDrawer] ${statusField} reset to "Awaiting Approval"`);
        } catch (err) {
          console.error(`❌ [OutingDrawer] Error resetting ${statusField}:`, err);
          console.error('❌ [OutingDrawer] Error stack:', err instanceof Error ? err.stack : 'No stack');
          // Revert on error
          setAssignments((prev) => {
            const updated = { ...prev };

            // Restore previous status
            if (previousAssignments[`${seat}_status`]) {
              updated[`${seat}_status`] = previousAssignments[`${seat}_status`];
            } else {
              delete updated[`${seat}_status`];
            }

            return updated;
          });
        }
      }

      // Refresh the data immediately to get updated backend state
      console.log('📝 [OutingDrawer] Starting data refresh after assignment');
      await throttledRefresh(true);
      console.log('📝 [OutingDrawer] Data refresh completed');

      // Clear the optimistic update flag after a longer delay to ensure backend consistency
      setTimeout(() => {
        setPendingOptimisticUpdates(prev => {
          const updated = new Set(prev);
          updated.delete(seat);
          console.log(`🧹 [OutingDrawer] Cleared optimistic update flag for ${seat}`);
          return updated;
        });
      }, 1500); // Longer delay to ensure backend consistency

      console.log('📝 [OutingDrawer] Assignment change flow completed');
    } catch (err) {
      console.error(`❌ [OutingDrawer] Error updating seat ${seat}:`, err);
      console.error('❌ [OutingDrawer] Error stack:', err instanceof Error ? err.stack : 'No stack');
      // Clear the optimistic update flag on error
      setPendingOptimisticUpdates(prev => {
        const updated = new Set(prev);
        updated.delete(seat);
        return updated;
      });
      // Ensure loading state is cleared on error
      setIsLoadingStatus(false);
      // State already rolled back above
      return;
    }
  };

  // Availability update handler using the proven pattern
  const handleAvailabilityUpdate = async (seat: string, status: string) => {
    // Prevent availability update when no member is selected
    if (!assignments[seat] || !outing) {
      console.warn('⚠️ [OutingDrawer] Cannot set availability - no member selected or no outing data:', { seat, hasMember: !!assignments[seat], hasOuting: !!outing });
      return;
    }

    setIsLoadingStatus(true);
    const statusField = getStatusField(seat);
    const notionStatusField = getNotionStatusField(statusField);

    console.log('✅ [OutingDrawer] Updating availability:', { seat, statusField, notionStatusField, status, outingId: outing.id });

    // Store previous status in case we need to roll back
    const previousStatus = assignments[`${seat}_status`];

    // Log the member assigned to this seat for debugging
    const memberForSeat = assignments[seat];
    console.log('✅ [OutingDrawer] Member for seat:', { seat, memberName: memberForSeat });

    try {
      // Only update status if a member is assigned
      if (memberForSeat) {
        // Optimistically update the UI immediately
        console.log('✅ [OutingDrawer] Updating local state optimistically');
        setAssignments((prev) => ({
          ...prev,
          [`${seat}_status`]: status,
        }));
      } else {
        console.warn('⚠️ [OutingDrawer] Tried to update status but no member is assigned:', { seat });
        return;
      }

      const requestBody = {
        outingId: outing.id,
        statusField,
        status,
      };
      console.log('✅ [OutingDrawer] Update availability request body:', requestBody);

      const res = await fetch("/api/update-availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      console.log('✅ [OutingDrawer] Update availability response:', { status: res.status, ok: res.ok });

      if (!res.ok) {
        const errorText = await res.text().catch((e) => {
          console.error('✅ [OutingDrawer] Failed to read error response:', e);
          return 'Unknown error';
        });
        console.error('❌ [OutingDrawer] API Error Response:', errorText);
        throw new Error(`Failed to update availability: ${errorText}`);
      }

      const responseData = await res.json();
      console.log('✅ [OutingDrawer] Availability updated successfully:', { statusField, status, responseData });

      // Clear loading state immediately after successful availability update
      setIsLoadingStatus(false);

      // Check outing status changes after availability update
      const updatedAssignments = {
        ...assignments,
        [`${seat}_status`]: status,
      };

      // Get cox experience for bank rider requirement check
      const coxMember = members.find(m => m.name === updatedAssignments['Cox']);
      const coxExperience = coxMember?.coxExperience;

      const shouldConfirm = shouldAutoConfirmOuting(
        updatedAssignments,
        outing?.properties?.Type?.select?.name || '',
        flagStatus?.status_text || null,
        coxExperience
      );

      // Handle auto-confirmation when all requirements are met
      if (status === 'Available' && shouldConfirm) {
        console.log('🎯 All required participants are available - auto-confirming outing');

        try {
          const payload = {
            outingId: outing.id,
            // Notion property for outing-level status is called 'Status'
            statusField: 'Status',
            status: 'Confirmed',
          };

          console.log('🔁 Auto-confirm request payload:', payload);

          const confirmRes = await fetch("/api/update-availability", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          // Read response text for richer debugging information when not OK
          const respText = await confirmRes.text();

          if (confirmRes.ok) {
            console.log('✅ Outing automatically confirmed', { status: confirmRes.status, body: respText });
            // Update local state immediately for instant UI feedback
            console.debug('[OutingDrawer] setting OutingStatus local to Confirmed for', outing.id);
            const updatedForConfirm = { ...assignments, OutingStatus: 'Confirmed' };
            setAssignments(updatedForConfirm);
            try {
              window.dispatchEvent(new CustomEvent('outing-state-updated', { detail: { outingId: outing.id, assignments: updatedForConfirm } }));
            } catch (err) {
              console.error('[OutingDrawer] failed to dispatch outing-state-updated (Confirmed):', err);
            }
          } else {
            console.error('❌ Failed to auto-confirm outing', { status: confirmRes.status, body: respText });
            // Throw so the outer catch logs full error
            throw new Error(`Auto-confirm failed: ${confirmRes.status} - ${respText}`);
          }
        } catch (confirmErr) {
          console.error('❌ Error auto-confirming outing:', confirmErr);
        }
      }
      // Handle de-confirmation when requirements are no longer met
      else if (status !== 'Available' && !shouldConfirm) {
        // Check if outing was previously confirmed and should now be provisional
        const currentOutingStatus = outing?.properties?.OutingStatus?.status?.name;
        if (currentOutingStatus === 'Confirmed') {
          console.log('⚠️ Requirements no longer met - changing status back to Provisional');

          try {
            const deconfirmRes = await fetch("/api/update-availability", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                outingId: outing.id,
                // Use the Notion property name directly
                statusField: 'Status',
                status: 'Provisional',
              }),
            });

            const deconfirmText = await deconfirmRes.text();
            if (deconfirmRes.ok) {
              console.log('✅ Outing status changed back to Provisional', { status: deconfirmRes.status, body: deconfirmText });
              // Update local state immediately for instant UI feedback
              console.debug('[OutingDrawer] setting OutingStatus local to Provisional for', outing.id);
              const updatedForProvisional = { ...assignments, OutingStatus: 'Provisional' };
              setAssignments(updatedForProvisional);
              try {
                window.dispatchEvent(new CustomEvent('outing-state-updated', { detail: { outingId: outing.id, assignments: updatedForProvisional } }));
              } catch (err) {
                console.error('[OutingDrawer] failed to dispatch outing-state-updated (Provisional):', err);
              }
            } else {
              console.error('❌ Failed to de-confirm outing', { status: deconfirmRes.status, body: deconfirmText });
              throw new Error(`De-confirm failed: ${deconfirmRes.status} - ${deconfirmText}`);
            }
          } catch (deconfirmErr) {
            console.error('❌ Error de-confirming outing:', deconfirmErr);
          }
        }
      }

      // Notify parent of state change to refresh data
      console.log('✅ [OutingDrawer] Starting data refresh after availability update');
      throttledRefresh(true);
      console.log('✅ [OutingDrawer] Availability update flow completed');
    } catch (err) {
      console.error('❌ [OutingDrawer] Error in handleAvailabilityUpdate:', err);
      console.error('❌ [OutingDrawer] Error stack:', err instanceof Error ? err.stack : 'No stack');
      console.error('❌ [OutingDrawer] Error updating statusField:', statusField);
      // Show more detailed error information
      if (err instanceof Error) {
        console.error('❌ [OutingDrawer] Error message:', err.message);
      }

      // Revert the optimistic update on failure - restore previous status if it existed
      console.log('❌ [OutingDrawer] Reverting to previous status:', { seat, previousStatus });
      setAssignments((prev) => {
        const updated = { ...prev };
        if (previousStatus) {
          updated[`${seat}_status`] = previousStatus;
        } else {
          delete updated[`${seat}_status`];
        }
        return updated;
      });
      setIsLoadingStatus(false);
    }
  };


  useEffect(() => {
    if (!loading && outing) {
      setHasLoadedOnce(true);
    }
  }, [loading, outing]);

  return (
    <React.Fragment>
    <Sheet
      isOpen={isOpen}
      onClose={isReportDrawerOpen ? () => {} : onClose} // Disable closing when report drawer is open
      title={<span style={{fontSize: '32px', fontWeight: 700, display: 'block', color: '#27272E', fontFamily: 'Gilroy'}}>{(() => {
        const type = outing?.properties?.Type?.select?.name || '';
        if (type === 'Water Outing') return 'Outing Details';
        if (type === 'Erg Session') return 'Erg Details';
        if (type === 'Tank Session') return 'Tank Details';
        if (type === 'Gym Session') return 'Gym Details';
        return 'Outing Details';
      })()}</span>}
    >
      <div>
      {loading && !isLoadingStatus && !hasLoadedOnce && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-sm text-muted-foreground">Loading session details...</span>
        </div>
      )}

      {outing && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
          {/* 4. Outing Details Section - Sticky */}
          <div style={{
            position: 'sticky',
            top: 0,
            zIndex: 1,
            backgroundColor: '#FFFFFF',
            paddingBottom: '40px'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Outing Details Card */}
              <div className="bg-white rounded-lg p-4 shadow-sm">
                {/* Parent flexbox to arrange details and pills side by side */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  alignSelf: 'stretch'
                }}>
                  {/* Left side - Outing Details */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: '6px',
                    flex: 1
                  }}>
                    {/* Title row with chevron */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%'
                    }}>
                      {/* 1. Div + Type (e.g., O1 Water Outing) */}
                      <h3 style={{
                        color: '#27272E',
                        fontFamily: 'Gilroy',
                        fontSize: '18px',
                        fontStyle: 'normal',
                        fontWeight: 600,
                        lineHeight: 'normal',
                        margin: 0
                      }}>
                        {outingTitle}
                      </h3>

                      {/* Chevron toggle button - only on mobile for Water Outings */}
                      {isMobile && outing?.properties?.Type?.select?.name === 'Water Outing' && (
                        <button
                          onClick={() => setIsMetadataCollapsed(!isMetadataCollapsed)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginLeft: '8px'
                          }}
                          aria-label={isMetadataCollapsed ? 'Show details' : 'Hide details'}
                        >
                          <svg
                            width="18"
                            height="18"
                            viewBox="0 0 18 18"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            style={{
                              transform: isMetadataCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                              transition: 'transform 0.2s ease'
                            }}
                          >
                            <path
                              d="M4.5 6.75L9 11.25L13.5 6.75"
                              stroke="#4C6FFF"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}
                    </div>

                  {/* Collapsible metadata section */}
                  {(!isMobile || !isMetadataCollapsed || outing?.properties?.Type?.select?.name !== 'Water Outing') && (
                    <>
                  {/* 2. Date/Time (e.g., Date: Wednesday 10:00-12:00) */}
                  <div style={{
                    color: '#425466',
                    fontFamily: 'Gilroy',
                    fontSize: '14px',
                    fontStyle: 'normal',
                    fontWeight: 500,
                    lineHeight: 'normal'
                  }}>
                    <span style={{ fontWeight: 600 }}>Date:</span> {(() => {
                      const startDateObj = outing.properties.StartDateTime as NotionDate;
                      const endDateObj = outing.properties.EndDateTime as NotionDate;
                      console.log('[OutingDrawer] Outing properties:', outing.properties);
                      console.log('[OutingDrawer] StartDateTime object:', startDateObj);
                      console.log('[OutingDrawer] EndDateTime object:', endDateObj);
                      const startDate = startDateObj?.date?.start;
                      // Use EndDateTime.date.start as the end time
                      const endDate = endDateObj?.date?.start;
                      console.log('[OutingDrawer] StartDateTime:', startDate);
                      console.log('[OutingDrawer] EndDateTime:', endDate);
                      if (startDate) {
                        const start = new Date(startDate);
                        const dayName = start.toLocaleDateString('en-GB', { weekday: 'long' });
                        if (endDate) {
                          const end = new Date(endDate);
                          console.log('[OutingDrawer] Rendering time range:', start, end);
                          return `${dayName} ${formatTimeRange(start, end)}`;
                        }
                        console.log('[OutingDrawer] Only start time available:', start);
                        return `${dayName} ${start.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
                      }
                      console.log('[OutingDrawer] No start date available');
                      return 'Date not set';
                    })()}
                  </div>

                  {/* 3. Notes (from SessionDetails property) */}
                  {outing.properties.SessionDetails && (
                    <div style={{
                      color: '#425466',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontStyle: 'normal',
                      fontWeight: 500,
                      lineHeight: 'normal'
                    }}>
                      <span style={{ fontWeight: 600 }}>Notes:</span> {(() => {
                        const details = outing.properties.SessionDetails;
                        if (details && 'rich_text' in details && details.rich_text?.length > 0) {
                          const firstText = details.rich_text[0];
                          if (firstText && typeof firstText === 'object' && 'plain_text' in firstText) {
                            return (firstText as { plain_text: string }).plain_text;
                          }
                        }
                        return '';
                      })()}
                    </div>
                  )}

                  {/* 4. Requirements (for Water Outings only) */}
                  {outing?.properties?.Type?.select?.name === 'Water Outing' && (
                    <div style={{
                      color: '#425466',
                      fontFamily: 'Gilroy',
                      fontSize: '14px',
                      fontStyle: 'normal',
                      fontWeight: 500,
                      lineHeight: 'normal'
                    }}>
                      <span style={{ fontWeight: 600 }}>Requirements:</span> {(() => {
                        const flagColor = flagStatus?.status_text?.replace(' Flag', '') || '';
                        const formUrl = 'https://docs.google.com/forms/d/e/1FAIpQLSe6Lkd2v323rhEmIKbHIBjJ8ew1aR2YaJY416xoleVR3y1pZg/viewform';

                        const requirementsMap: Record<string, React.ReactNode> = {
                          'Green': 'Novice coxes must have a bankrider.',
                          'Light Blue': (
                            <>
                              Only Experienced and Senior coxes may go out. Novice coxes with more than one term&apos;s experience may go out with senior crews in daylight hours only, and be accompanied by a bankrider with throw-line and lockkeeper number (01865 777 277), with crew and bankrider registered {'>'}2 hours before outing.{' '}
                              <a href={formUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#2563EB', textDecoration: 'underline' }}>
                                Register here
                              </a>
                            </>
                          ),
                          'Dark Blue': 'No Novice or unregistered coxes.',
                          'Amber': 'Senior coxes may go out only with senior crews. All crews must be accompanied by a bankrider with throw-line and lockkeeper number (01865 777 277).',
                          'Red': 'No crews are allowed out.',
                          'Black': 'No crews are allowed out.',
                          'Grey': 'Flag not currently being maintained. Anyone is allowed to cox.'
                        };

                        const result = requirementsMap[flagColor];
                        return result || 'Requirements not available.';
                      })()}
                    </div>
                  )}

                  {/* Pills - inside collapsible section for Water Outings */}
                  {outing?.properties?.Type?.select?.name === 'Water Outing' && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start',
                      gap: '12px',
                      alignSelf: 'stretch',
                      marginTop: '12px'
                    }}>
                      {/* Shell - Pill Component */}
                      <Pill type="shell" value={(outing.properties.Shell as NotionSelect)?.select?.name || null} shouldStretch={true}>
                        {(outing.properties.Shell as NotionSelect)?.select?.name || 'N/A'}
                      </Pill>

                      {/* Flag Status - Pill Component */}
                      {flagStatus?.status_text && (
                        <Pill type="flag" value={flagStatus.status_text || null} shouldStretch={true}>
                          {flagStatus.status_text?.includes('Flag') ? flagStatus.status_text : `${flagStatus.status_text} Flag`}
                        </Pill>
                      )}

                      {/* Outing Status - Pill Component */}
                      <Pill type="status" value={assignments.OutingStatus || (outing.properties.OutingStatus as NotionStatus)?.status?.name || null} shouldStretch={true}>
                        {assignments.OutingStatus || (outing.properties.OutingStatus as NotionStatus)?.status?.name || 'Provisional'}
                      </Pill>
                    </div>
                  )}
                  </>
                  )}

                </div>

                {/* Right side - Pills - MOVED ABOVE TITLE */}
                {/* Pills are now positioned above the outing title */}
              </div>
            </div>

            {/* Status/Shell Pills - Only for non-Water Outings (Water Outings have pills in collapsible section) */}
            {outing?.properties?.Type?.select?.name !== 'Water Outing' && (() => {
              return (
                <div style={{
                  display: 'flex',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: '12px',
                  alignSelf: 'stretch'
                }}>
                  {/* Outing Status - Pill Component */}
                  <Pill type="status" value={assignments.OutingStatus || (outing.properties.OutingStatus as NotionStatus)?.status?.name || null} shouldStretch={true}>
                    {assignments.OutingStatus || (outing.properties.OutingStatus as NotionStatus)?.status?.name || 'Provisional'}
                  </Pill>
                </div>
              );
            })()}
            </div>
          </div>

          {/* Show loading indicator below outing details if updating rower/availability */}
          {isLoadingStatus && (
            <div className="flex items-center justify-center py-4" style={{ marginBottom: '16px' }}>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span className="ml-2 text-sm text-muted-foreground">Updating outing...</span>
            </div>
          )}

          {/* 5. Crew Assignments Section - Scrollable */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            paddingBottom: isMobile ? '80px' : '0' // Add padding for fixed button on mobile
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Bank Rider Section - Above Attendees (only for Water Outing) */}
            {outing?.properties?.Type?.select?.name === 'Water Outing' && (
              <>
                <h4 style={{
                  color: '#27272E',
                  fontFamily: 'Gilroy',
                  fontSize: '18px',
                  fontStyle: 'normal',
                  fontWeight: 800,
                  lineHeight: 'normal',
                  margin: '0 0 16px 0'
                }}>Bank Rider</h4>

                <div className="bg-white rounded-lg p-4 shadow-sm" style={{ marginBottom: '24px' }}>
                  <RowerRow
                    key="Coach/Bank Rider"
                    seat="Coach/Bank Rider"
                    selectedMember={assignments["Coach/Bank Rider"]}
                    isSubmitting={submittingSeats.has("Coach/Bank Rider")}
                    members={members}
                    membersLoading={membersLoading}
                    assignments={assignments}
                    onAssignmentChange={handleAssignmentChange}
                    onAvailabilityUpdate={handleAvailabilityUpdate}
                    isLoadingStatus={isLoadingStatus}
                    outingType={outing?.properties?.Type?.select?.name}
                    refreshMembers={refreshMembers}
                    flagStatus={flagStatus?.status_text}
                    outingDate={outingDate}
                    outingTime={outingTime}
                    outingEndTime={outingEndTime}
                    rowerAvailabilityMap={rowerAvailabilityMap}
                    onCreateMember={handleCreateMember}
                  />
                </div>
              </>
            )}

            {/* Coach Section - Above Attendees (only for non-Water Outings: Erg, Tank, Gym) */}
            {outing?.properties?.Type?.select?.name !== 'Water Outing' && (
              <>
                <h4 style={{
                  color: '#27272E',
                  fontFamily: 'Gilroy',
                  fontSize: '18px',
                  fontStyle: 'normal',
                  fontWeight: 800,
                  lineHeight: 'normal',
                  margin: '0 0 16px 0'
                }}>Coach</h4>

                <div className="bg-white rounded-lg p-4 shadow-sm" style={{ marginBottom: '24px' }}>
                  <RowerRow
                    key="Coach/Bank Rider"
                    seat="Coach/Bank Rider"
                    selectedMember={assignments["Coach/Bank Rider"]}
                    isSubmitting={submittingSeats.has("Coach/Bank Rider")}
                    members={members}
                    membersLoading={membersLoading}
                    assignments={assignments}
                    onAssignmentChange={handleAssignmentChange}
                    onAvailabilityUpdate={handleAvailabilityUpdate}
                    isLoadingStatus={isLoadingStatus}
                    outingType={outing?.properties?.Type?.select?.name}
                    refreshMembers={refreshMembers}
                    flagStatus={flagStatus?.status_text}
                    outingDate={outingDate}
                    outingTime={outingTime}
                    outingEndTime={outingEndTime}
                    rowerAvailabilityMap={rowerAvailabilityMap}
                    onCreateMember={handleCreateMember}
                  />
                </div>
              </>
            )}

            {/* Rowers Section */}
            {/* Conditionally render 'Rowers' or 'Attendees' based on outing Type */}
            <h4 style={{
              color: '#27272E',
              fontFamily: 'Gilroy',
              fontSize: '18px',
              fontStyle: 'normal',
              fontWeight: 800,
              lineHeight: 'normal',
              margin: '0 0 16px 0'
            }}>
              {(outing?.properties?.Type?.select?.name === 'Water') ? 'Rowers' : 'Attendees'}
            </h4>

            {/* Interactive Seat Assignments with Member Selection - Dropdowns Container */}
            <div className="bg-white rounded-lg p-4 shadow-sm" style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {seatLabels
                  .filter(seat => !seat.startsWith('Sub'))
                  .filter(seat => seat !== 'Coach/Bank Rider') // Exclude Bank Rider from main list
                  .filter(seat =>
                    outing?.properties?.Type?.select?.name === 'Water Outing' || seat !== 'Cox'
                  )
                  .map((seat) => (
                    <RowerRow
                      key={seat}
                      seat={seat}
                      selectedMember={assignments[seat]}
                      isSubmitting={submittingSeats.has(seat)}
                      members={members}
                      membersLoading={membersLoading}
                      assignments={assignments}
                      onAssignmentChange={handleAssignmentChange}
                      onAvailabilityUpdate={handleAvailabilityUpdate}
                      isLoadingStatus={isLoadingStatus}
                      outingType={outing?.properties?.Type?.select?.name}
                      refreshMembers={refreshMembers}
                      flagStatus={flagStatus?.status_text}
                      outingDate={outingDate}
                      outingTime={outingTime}
                      outingEndTime={outingEndTime}
                      rowerAvailabilityMap={rowerAvailabilityMap}
                      onCreateMember={handleCreateMember}
                    />
                  ))}
              </div>
            </div>

            {/* Subs Section */}
            <h4 style={{
              color: '#27272E',
              fontFamily: 'Gilroy',
              fontSize: '18px',
              fontStyle: 'normal',
              fontWeight: 800,
              lineHeight: 'normal',
              margin: '0 0 16px 0'
            }}>Subs</h4>

            {/* Subs Assignments Container */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {seatLabels.filter(seat => seat.startsWith('Sub')).map((seat) => (
                  <RowerRow
                    key={seat}
                    seat={seat}
                    selectedMember={assignments[seat]}
                    isSubmitting={submittingSeats.has(seat)}
                    members={members}
                    membersLoading={membersLoading}
                    assignments={assignments}
                    onAssignmentChange={handleAssignmentChange}
                    onAvailabilityUpdate={handleAvailabilityUpdate}
                    isLoadingStatus={isLoadingStatus}
                    outingType={outing?.properties?.Type?.select?.name}
                    refreshMembers={refreshMembers}
                    flagStatus={flagStatus?.status_text}
                    outingDate={outingDate}
                    outingTime={outingTime}
                    outingEndTime={outingEndTime}
                    rowerAvailabilityMap={rowerAvailabilityMap}
                    onCreateMember={handleCreateMember}
                  />
                ))}
              </div>
            </div>
            </div>
          </div>

          {/* Action Buttons - Fixed at bottom on mobile */}
          <div style={{
            marginTop: isMobile ? '0' : '32px',
            position: isMobile ? 'fixed' : 'relative',
            bottom: isMobile ? '0' : 'auto',
            left: isMobile ? '0' : 'auto',
            right: isMobile ? '0' : 'auto',
            padding: isMobile ? '16px' : '0',
            backgroundColor: isMobile ? '#FFFFFF' : 'transparent',
            borderTop: isMobile ? '1px solid #E5E7EB' : 'none',
            zIndex: isMobile ? 2 : 'auto'
          }}>
            <div
              style={{
                display: 'flex',
                width: '100%',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <button
                onClick={handleAddToGoogleCalendar}
                disabled={isCalendarButtonDisabled}
                style={{
                  display: 'flex',
                  width: outing?.properties?.Type?.select?.name === 'Water Outing' ? '36px' : '100%',
                  height: '36px',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '8px',
                  borderRadius: '6px',
                  background: 'var(--Theme-Primary-Soft, #E1E8FF)',
                  border: 'none',
                  cursor: isCalendarButtonDisabled ? 'not-allowed' : 'pointer',
                  padding: outing?.properties?.Type?.select?.name === 'Water Outing' ? '0' : '12px 8px',
                  opacity: isCalendarButtonDisabled ? 0.5 : 1,
                  flexShrink: 0,
                  color: 'var(--Theme-Primary-Default, #4C6FFF)',
                  fontFamily: 'Gilroy',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                <GoogleCalendarIcon />
                {outing?.properties?.Type?.select?.name !== 'Water Outing' && (
                  <span>Add to calendar</span>
                )}
              </button>

              {outing?.properties?.Type?.select?.name === 'Water Outing' && (
                <ActionButton
                  onClick={() => openReportDrawer(outingId)}
                  style={{
                    display: 'flex',
                    padding: '12px 8px',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '10px',
                    alignSelf: 'stretch',
                    borderRadius: '6px',
                    background: 'var(--Theme-Primary-Soft, #E1E8FF)',
                    color: 'var(--Theme-Primary-Default, #4C6FFF)',
                    fontWeight: 600,
                    flex: '1 1 auto',
                  }}
                >
                  Outing Report
                </ActionButton>
              )}
            </div>
          </div>

          {/* Report Drawer is now managed outside the Sheet component */}
        </div>
      )}
      </div>
    </Sheet>

    {/* Report Drawer - Overlaid on top (only for Water Outing) */}
    {outing && outing?.properties?.Type?.select?.name === 'Water Outing' && (
      <ReportDrawer
        outingId={outingId}
        isOpen={isReportDrawerOpen}
        onClose={closeDrawer}
        onReturnToOuting={() => openSessionDrawer(outingId)}
      />
    )}
    </React.Fragment>
  );
}
