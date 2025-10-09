# Schedule Integration - Rower Availability

## 🎉 Integration Complete!

The rower availability feature has been successfully integrated with the
schedule page! Unavailable rowers are now clearly indicated in the member
dropdowns when assigning crew to outings.

## 🔧 What Was Implemented

### 1. **New Hook: `useAllRowerAvailability`**

**File:** `src/hooks/useAllRowerAvailability.ts`

A new React hook that:

- Fetches availability data for all members in parallel
- Implements caching to avoid redundant API calls (60-second TTL)
- Returns a Map of member IDs to their weekly availability patterns
- Handles errors gracefully (members without data are treated as available)

**Usage:**

```typescript
const { availabilityMap, loading, error } = useAllRowerAvailability(members);
```

### 2. **OutingDrawer Integration**

**File:** `src/app/(app shell)/schedule/OutingDrawer.tsx`

**Changes Made:**

#### Imports Added:

```typescript
import { useAllRowerAvailability } from "@/hooks/useAllRowerAvailability";
import { isRowerAvailable, extractTime } from "@/utils/rowerAvailability";
import { OptionProps } from "react-select";
```

#### Hook Usage:

```typescript
const {
  availabilityMap: rowerAvailabilityMap,
  loading: rowerAvailabilityLoading,
} = useAllRowerAvailability(members);
```

#### Custom Option Component:

Created a `CustomOption` component that styles unavailable members:

- Gray text color (`#94a3b8`)
- Italic font style
- Visual indicator that the member is unavailable

#### Member Dropdown Logic:

Enhanced the member dropdown to:

1. Check each member's availability for non-Cox seats
2. Extract the session time from the outing
3. Check if the member is available based on their weekly pattern and the outing
   date/time
4. Append "(Unavailable)" to the member's name if they're unavailable
5. Apply custom styling to unavailable members

#### Props Updated:

- Added `rowerAvailabilityMap` prop to `RowerRowProps` interface
- Passed the map to all `RowerRow` components (main rowers, subs, and bank
  rider)

## 🎨 User Experience

### What Users See:

1. **Available Members:**

   - Display normally in black text
   - Example: "John Smith"

2. **Unavailable Members:**
   - Display in gray italic text
   - Labeled with "(Unavailable)"
   - Example: "Jane Doe (Unavailable)"
   - **Still selectable** (as per requirements)

### How It Works:

1. User opens an outing in the schedule
2. System fetches all member availability data (cached for 60 seconds)
3. For each seat dropdown:
   - System checks the outing date/time
   - Compares against each member's weekly unavailability pattern
   - Marks members as unavailable if their unavailable times overlap with the
     outing time
4. Dropdown displays all members with visual indicators

## 🧪 Testing Instructions

### Test Scenario 1: Basic Availability Check

1. Go to `/rower-availability`
2. Select a member (e.g., John Smith)
3. Mark Monday 9:00-11:00 as unavailable
4. Save changes
5. Go to `/schedule`
6. Open a Monday morning outing (e.g., 10:00 AM start)
7. Check the member dropdown for any rower seat
8. **Expected:** John Smith shows as "John Smith (Unavailable)" in gray italic

### Test Scenario 2: Multiple Time Ranges

1. Set a member unavailable for:
   - Tuesday 8:00-10:00
   - Tuesday 14:00-16:00
2. Save
3. Open a Tuesday outing at 9:00 AM
4. **Expected:** Member shows as unavailable
5. Open a Tuesday outing at 12:00 PM
6. **Expected:** Member shows as available
7. Open a Tuesday outing at 15:00 PM
8. **Expected:** Member shows as unavailable

### Test Scenario 3: Cox Seat (Should Not Show Rower Availability)

1. Open a Water Outing
2. Check the Cox dropdown
3. **Expected:** Cox availability is based on cox experience/flag status
   (existing logic)
4. Rower availability does NOT affect the Cox seat

### Test Scenario 4: Member Still Selectable

1. Find an unavailable member in a dropdown
2. Click on them
3. **Expected:** Member is successfully assigned despite being unavailable
4. This allows coaches to override availability if needed

### Test Scenario 5: No Availability Data

1. Member has never set their availability
2. Check dropdowns
3. **Expected:** Member shows as available (default behavior)

## 📊 Performance Considerations

### Caching Strategy:

- Availability data is cached for 60 seconds
- Prevents excessive API calls when opening multiple outings
- Cache is shared across all components using the hook

### Parallel Fetching:

- All member availability is fetched in parallel using `Promise.all`
- Minimizes total loading time
- Failed requests don't block other members

### Graceful Degradation:

- If availability fetch fails for a member, they're treated as available
- Errors are logged to console but don't break the UI
- Loading state is shown while fetching

## 🔍 Technical Details

### Availability Check Algorithm:

```typescript
// 1. Extract time from outing datetime
const sessionTime = extractTime(outingTime); // "09:00"

// 2. Get member's availability for their account
const memberAvailability = rowerAvailabilityMap.get(member.id);

// 3. Check if available
const isAvailable = memberAvailability
  ? isRowerAvailable(memberAvailability, outingDate, sessionTime)
  : true; // No data = available
```

### Day of Week Calculation:

```typescript
// Automatically determines day from date
const dayOfWeek = getDayOfWeek("2025-10-14"); // "tuesday"
```

### Time Range Check:

```typescript
// Checks if session time falls within any unavailable range
function isTimeInRange(time: string, range: TimeRange): boolean {
  const timeMinutes = timeToMinutes(time); // "09:00" -> 540
  const startMinutes = timeToMinutes(range.start); // "08:00" -> 480
  const endMinutes = timeToMinutes(range.end); // "10:00" -> 600

  return timeMinutes >= startMinutes && timeMinutes < endMinutes;
}
```

## 🐛 Known Limitations

1. **Caching TTL:** 60-second cache means availability updates may take up to 1
   minute to reflect

   - **Workaround:** Refresh the page to force reload

2. **Bulk Fetching:** Fetches all members' availability even if not needed

   - **Future optimization:** Could lazy-load on dropdown open

3. **No Visual Loading State:** Dropdown doesn't show loading indicator while
   fetching availability
   - **Future enhancement:** Add spinner or skeleton loader

## 🚀 Future Enhancements

### Potential Improvements:

1. **Sorting:** Sort available members to the top of dropdown
2. **Filtering:** Add toggle to hide unavailable members
3. **Availability Preview:** Show member's full weekly schedule on hover
4. **Conflict Warnings:** Highlight when multiple unavailable members are
   assigned
5. **Batch Operations:** Suggest alternative available members
6. **Statistics:** Show availability coverage per outing

## ✅ Checklist

- [x] Created `useAllRowerAvailability` hook
- [x] Integrated hook into OutingDrawer
- [x] Added custom Option component with styling
- [x] Updated member dropdown logic
- [x] Passed rowerAvailabilityMap to all RowerRow instances
- [x] Tested compilation (no errors)
- [ ] Manual testing (ready for you to test!)

## 📝 Files Modified

1. **Created:** `src/hooks/useAllRowerAvailability.ts`
2. **Modified:** `src/app/(app shell)/schedule/OutingDrawer.tsx`
   - Added imports
   - Added hook usage
   - Created CustomOption component
   - Updated RowerRowProps interface
   - Enhanced dropdown options logic
   - Passed rowerAvailabilityMap to all RowerRow components

---

**Ready for testing!** 🎉

Try the test scenarios above to verify everything works as expected. The
integration maintains backward compatibility - members without availability data
are treated as always available.
