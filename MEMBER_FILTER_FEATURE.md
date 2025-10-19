# Member Filter Feature Implementation

## Overview

This feature adds a member filter dropdown to the /schedule page that allows
users to filter the calendar view to show only sessions where they (or a
selected member) are assigned to a seat.

## Implementation Details

### 1. URL State Management

- **File**: `src/lib/urlParams.ts`
- Added `memberId?: string` to `ScheduleUrlState` interface
- Updated `parseScheduleUrl()` to parse `?member=<id>` query parameter
- Updated `buildScheduleUrl()` to include member query parameter in URL

### 2. URL Hook Updates

- **File**: `src/hooks/useUrlState.ts`
- Modified `useScheduleUrlState()` to parse search params from window location
- Added `setMember()` convenience method for updating member filter
- Updated URL comparison to include search params

### 3. Member Filter Component

- **File**: `src/app/(app shell)/schedule/MemberFilter.tsx`
- Created new dropdown component matching existing filter styling
- Uses `react-select` with custom styling identical to session filter
- Fetches members list using `useMembers()` hook
- Searchable dropdown with "My Sessions" placeholder
- Clearable to remove member filter

### 4. Calendar Header Updates

- **File**: `src/app/(app shell)/schedule/CalendarHeader.tsx`
- Added `memberId` and `onMemberChange` props
- Positioned MemberFilter to the left of session filter
- Wrapped both filters in `.calendar-filters` container for responsive layout

- **File**: `src/app/(app shell)/schedule/CalendarHeaderResponsive.tsx`
- Added member filter props to interface
- Passes props through to CalendarHeader

### 5. Event Filtering Logic

- **File**: `src/app/(app shell)/mappers/mapOutingsToEvents.ts`
- Added `filterOutingsByMember()` function
- Checks all seat properties (Cox, Stroke, Bow, 2-7 Seat, CoachBankRider,
  Sub1-4)
- Filters outings where member ID appears in any relation

- **File**: `src/app/(app shell)/hooks/useCalendarData.ts`
- Added `memberId` parameter to hook
- Applies member filter to outings before mapping to events
- Maintains existing date range and type filters

### 6. Page Integration

- **File**: `src/app/(app shell)/schedule/[[...params]]/page.client.tsx`
- Integrated `setMember` from URL state hook
- Passed `memberId` to `useCalendarData` hook
- Added `handleMemberChange` handler
- Wired up member filter props to CalendarHeaderResponsive

### 7. Responsive Styling

- **File**: `src/app/globals.css`
- Desktop: Member filter appears to the left of session filter
- Mobile: Member filter appears below session filter
- Both filters expand to 100% width on mobile
- Consistent styling with existing dropdowns

## User Experience

### Desktop View

```
[← →] Week Display    [My Sessions ▼]  [All Sessions ▼]
```

### Mobile View

```
[← →] Week Display

[All Sessions ▼]
[My Sessions ▼]
```

## URL Structure

- No member filter: `/schedule/2025-10-20/all`
- With member filter: `/schedule/2025-10-20/all?member=<member-id>`
- Member filter persists across navigation, filter changes, and drawer opens

## Features

✅ Searchable member dropdown ✅ Clearable (click X to show all sessions) ✅
Filters events to only show sessions where selected member is assigned ✅ Works
with existing session type filters ✅ Responsive design (desktop and mobile) ✅
URL state persistence ✅ Empty state shows "My Sessions" placeholder

## Seat Properties Checked

The filter checks if the member appears in any of these outing properties:

- Cox
- Stroke
- Bow
- 2 Seat through 7 Seat
- CoachBankRider
- Sub1 through Sub4

## Files Modified

1. `src/lib/urlParams.ts` - URL state types and parsing
2. `src/hooks/useUrlState.ts` - URL state hook
3. `src/app/(app shell)/schedule/MemberFilter.tsx` - New component
4. `src/app/(app shell)/schedule/CalendarHeader.tsx` - Header with filters
5. `src/app/(app shell)/schedule/CalendarHeaderResponsive.tsx` - Responsive
   wrapper
6. `src/app/(app shell)/mappers/mapOutingsToEvents.ts` - Filtering logic
7. `src/app/(app shell)/hooks/useCalendarData.ts` - Data hook
8. `src/app/(app shell)/schedule/[[...params]]/page.client.tsx` - Page
   integration
9. `src/app/globals.css` - Mobile responsive styles

## Testing Recommendations

1. Select a member from the dropdown - calendar should show only their sessions
2. Clear the selection - calendar should show all sessions
3. Combine with session type filter (e.g., "Water" + member) - both filters
   should apply
4. Navigate weeks - member filter should persist
5. Test on mobile - filters should stack vertically
6. Test URL direct navigation with `?member=<id>` parameter
