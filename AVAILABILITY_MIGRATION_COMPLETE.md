# Availability System Migration - Complete ✅

## Overview

Successfully migrated the cox availability system to use the unified Members DB
approach. Both rowers and coxes now use the same availability system backed by
Members DB properties.

## What Changed

### 1. ✅ Unified Availability System

- **Database**: Uses Members DB `Unavailable Monday` through
  `Unavailable Sunday` text properties
- **Data Format**: JSON arrays like `[{"start":"08:00","end":"10:30"}]`
- **Semantics**: Data represents **UNavailability** (when NOT available)
- **Logic**: Available = NOT in unavailable time ranges

### 2. ✅ Updated Components

#### CoxingOverviewCard (`/src/components/CoxingOverviewCard.tsx`)

- Changed from `useCoxingOverview` to `useCoxingOverviewUnified`
- Now reads from Members DB instead of Coxing Availability DB
- Navigation updated to `/availability` instead of `/coxing`

#### OutingDrawer (`/src/app/(app shell)/schedule/OutingDrawer.tsx`)

- Removed `useCoxingAvailability` hook
- Removed `coxingAvailability` prop from RowerRow
- Updated to use `getEligibleCoxesUnified()` for cox filtering
- Passes `rowerAvailabilityMap` to cox filtering logic
- Fixed color typos (`##27272E` → `#27272E`)

#### Sidebar (`/src/app/(app shell)/sidebar/Sidebar.tsx`)

- Removed "Coxing" navigation item
- Renamed "Rower Availability" to "Availability"
- Updated route from `/rower-availability` to `/availability`

#### Availability Page (`/src/app/availability/page.tsx`)

- Renamed from `/rower-availability` to `/availability`
- Updated title: "Rower Availability" → "Availability"
- Updated description: "Set your recurring weekly unavailability times (for both
  rowing and coxing)"

### 3. ✅ New Utilities

#### `useCoxingOverviewUnified` (`/src/hooks/useCoxingOverviewUnified.ts`)

- New hook for cox overview using unified system
- Filters members with `coxExperience`
- Uses `useAllRowerAvailability` to fetch availability data
- Shows days as available when they have availability (detailed time checking in
  schedule)

#### `getEligibleCoxesUnified()` (`/src/utils/coxEligibility.ts`)

- New function for cox filtering in schedule
- Uses `availabilityMap` instead of old coxing availability
- Properly inverts logic: available = NOT in unavailable ranges
- Filters by both cox eligibility (experience level) AND time-specific
  availability

### 4. ✅ Cleanup - Removed Old Code

#### Deleted Directories:

- `/src/app/coxing/` - Old coxing page and components

#### Deleted Hooks:

- `/src/hooks/useCoxingOverview.ts` - Old cox overview hook
- `/src/app/(app shell)/hooks/useCoxingAvailability.ts` - Old coxing
  availability hook

#### Deleted API Routes:

- `/src/app/api/get-coxing-availability/` - Old GET endpoint
- `/src/app/api/update-coxing-availability/` - Old POST endpoint

#### Removed Functions:

- `getEligibleCoxes()` - Old cox filtering function
- `getTimeSlotForOuting()` - Old time slot helper

## How It Works

### For Rowers:

1. Member sets unavailable time ranges on `/availability` page
2. Data saved to Members DB `Unavailable [Day]` properties as JSON
3. Schedule page loads all member availability via `useAllRowerAvailability`
4. Rower dropdown shows members with "Unavailable" indicator if they're
   unavailable at session time
5. Uses `isRowerAvailable()` to check if member is available at specific time

### For Coxes:

1. Cox sets unavailable time ranges on `/availability` page (same as rowers)
2. Data saved to same Members DB properties
3. Home page `/home` shows weekly cox overview (all days shown as available for
   simplicity)
4. Schedule page filters coxes by:
   - **Eligibility**: Experience level vs flag status (via `isCoxEligible()`)
   - **Availability**: Time-specific check using `isRowerAvailable()`
5. Uses `getEligibleCoxesUnified()` to filter coxes for dropdown

## Testing Checklist

### ✅ Basic Functionality

- [x] Members DB has 7 new text properties (Unavailable Monday-Sunday)
- [x] `/availability` page accessible and loads correctly
- [x] Member selection dropdown works
- [x] Can add/remove time ranges for each day
- [x] Save button updates Members DB
- [x] Home page shows cox overview
- [x] Navigation updated (no Coxing link, Availability link present)

### 🔄 Cox Availability Testing (To Do)

- [ ] Set a cox as unavailable at specific times
- [ ] Verify home page CoxingOverviewCard shows correct availability
- [ ] Create a session at a time when cox is unavailable
- [ ] Verify schedule OutingDrawer cox dropdown correctly filters out
      unavailable cox
- [ ] Verify eligible but unavailable coxes don't appear in dropdown

### 🔄 Integration Testing (To Do)

- [ ] Test with multiple coxes having different availability patterns
- [ ] Test with different flag statuses (green, light-blue, dark-blue, etc.)
- [ ] Verify bank rider requirement logic still works correctly
- [ ] Test mobile responsiveness of new availability page

## Migration Benefits

1. **Single Source of Truth**: One database (Members DB) for all availability
2. **Consistent UX**: Same interface for rowers and coxes
3. **Flexible Time Ranges**: Custom time ranges instead of fixed slots
4. **Reduced Complexity**: Fewer hooks, APIs, and components to maintain
5. **Better Type Safety**: Unified types and validation logic

## Notes

- Old Coxing Availability DB is no longer used (can be archived/deleted)
- All coxing functionality now uses unified availability system
- The semantics are inverted: data represents UNavailability
- Schedule page does detailed time-specific filtering
- Home page shows general weekly overview for coxes

## Next Steps

1. Test the system end-to-end with real data
2. Monitor for any edge cases or issues
3. Consider archiving/deleting old Coxing Availability DB in Notion
4. Update any documentation that references the old coxing page
5. Announce the change to users

---

**Migration Date**: October 8, 2025 **Status**: Complete ✅
