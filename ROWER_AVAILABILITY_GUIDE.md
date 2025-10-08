# Rower Availability Implementation Guide

## 🎯 Overview

This document describes the Rower Availability feature that allows members to
set their recurring weekly unavailability times.

## 📊 Database Schema

### Members Database - New Properties Added

You need to add these 7 **Text** properties to your existing Members database in
Notion:

- `Unavailable Monday`
- `Unavailable Tuesday`
- `Unavailable Wednesday`
- `Unavailable Thursday`
- `Unavailable Friday`
- `Unavailable Saturday`
- `Unavailable Sunday`

### Data Format

Each property stores a JSON array of time ranges:

```json
[
  { "start": "08:00", "end": "10:30" },
  { "start": "14:00", "end": "16:00" }
]
```

**Examples:**

- Empty/Available: `[]` or empty string
- Single range: `[{"start":"09:00","end":"17:00"}]`
- Multiple ranges:
  `[{"start":"08:00","end":"10:30"},{"start":"14:00","end":"16:00"},{"start":"19:00","end":"21:00"}]`

## 🏗️ Architecture

### File Structure

```
src/
├── app/
│   ├── api/
│   │   ├── get-rower-availability/
│   │   │   └── route.ts              # GET endpoint to fetch member availability
│   │   └── update-rower-availability/
│   │       └── route.ts              # POST endpoint to update availability
│   ├── rower-availability/
│   │   └── page.tsx                  # Main availability page
│   └── (app shell)/
│       └── sidebar/
│           ├── RowerIcon.tsx         # Icon for navigation
│           └── Sidebar.tsx           # Updated with new nav item
├── hooks/
│   ├── useRowerAvailability.ts       # Hook to fetch availability
│   └── useUpdateRowerAvailability.ts # Hook to update availability
├── types/
│   └── rowerAvailability.ts          # TypeScript types and utilities
└── utils/
    └── rowerAvailability.ts          # Helper functions for checking availability
```

## 🔧 API Endpoints

### GET `/api/get-rower-availability`

**Query Parameters:**

- `memberId` (required): The Notion page ID of the member

**Response:**

```json
{
  "success": true,
  "availability": {
    "memberId": "abc123",
    "memberName": "John Doe",
    "monday": [{ "start": "08:00", "end": "10:30" }],
    "tuesday": [],
    "wednesday": [{ "start": "14:00", "end": "16:00" }]
    // ... other days
  }
}
```

### POST `/api/update-rower-availability`

**Body:**

```json
{
  "memberId": "abc123",
  "monday": [{ "start": "08:00", "end": "10:30" }],
  "tuesday": [],
  "wednesday": [{ "start": "14:00", "end": "16:00" }]
  // ... all 7 days required
}
```

**Validation:**

- Maximum 3 time ranges per day
- No overlapping time ranges
- Valid time format (HH:MM)
- End time must be after start time

**Response:**

```json
{
  "success": true,
  "message": "Successfully updated rower availability"
}
```

## 💻 Usage

### Setting Availability (User Flow)

1. Navigate to "Rower Availability" in the sidebar
2. Select your name from the dropdown
3. Your existing availability loads automatically
4. For each day, you can:
   - Add up to 3 time ranges (when you're unavailable)
   - Edit time ranges using time pickers
   - Remove time ranges with the × button
5. Click "Save Changes"
6. System validates (no overlaps, max 3 per day)
7. Data saves to Notion

### Checking Availability Programmatically

```typescript
import {
  isRowerAvailable,
  getDayOfWeek,
  extractTime,
} from "@/utils/rowerAvailability";
import { RowerWeeklyAvailability } from "@/types/rowerAvailability";

// Example: Check if a member is available for a session
const sessionDate = "2025-10-14"; // Tuesday
const sessionTime = "09:00";

const memberAvailability: RowerWeeklyAvailability = {
  memberId: "abc123",
  monday: [],
  tuesday: [{ start: "08:00", end: "10:30" }],
  wednesday: [],
  // ... other days
};

const available = isRowerAvailable(
  memberAvailability,
  sessionDate,
  sessionTime
);
// Returns: false (because 09:00 falls in the unavailable range 08:00-10:30 on Tuesday)
```

### Filter Available Rowers

```typescript
import { getAvailableRowers } from "@/utils/rowerAvailability";

const { available, unavailable } = getAvailableRowers(
  allMembers,
  rowerAvailabilityMap,
  sessionDate,
  sessionTime
);

// available: Array of members who ARE available
// unavailable: Array of members who marked themselves unavailable
```

## 🧪 Testing Checklist

### Manual Testing

- [ ] **Add Properties to Notion Members DB**

  - Add all 7 "Unavailable [Day]" text properties

- [ ] **Page Access**

  - Navigate to `/rower-availability`
  - Verify page loads without errors

- [ ] **Member Selection**

  - Select a member from dropdown
  - Verify availability loads (empty if none set)

- [ ] **Add Time Ranges**

  - Click "Add Time Range" for Monday
  - Verify default times populate (09:00 - 17:00)
  - Change times using time pickers
  - Add multiple ranges (up to 3)

- [ ] **Validation**

  - Try adding 4th range (should be blocked)
  - Try overlapping times (e.g., 08:00-10:00 and 09:00-11:00)
  - Try saving - should show error message
  - Fix overlap and try again

- [ ] **Remove Time Ranges**

  - Click × button to remove a range
  - Verify it disappears

- [ ] **Save**

  - Click "Save Changes"
  - Verify success message appears
  - Refresh page
  - Select same member again
  - Verify data persists

- [ ] **Notion Verification**

  - Open Members database in Notion
  - Find the member's row
  - Check "Unavailable [Day]" properties
  - Verify JSON is correctly formatted

- [ ] **Mobile Responsive**
  - Test on mobile viewport
  - Verify time pickers work
  - Verify layout is readable

### API Testing

Test APIs directly using the test script:

```bash
# Test GET
curl "http://localhost:3000/api/get-rower-availability?memberId=YOUR_MEMBER_ID"

# Test POST
curl -X POST http://localhost:3000/api/update-rower-availability \
  -H "Content-Type: application/json" \
  -d '{
    "memberId": "YOUR_MEMBER_ID",
    "monday": [{"start":"08:00","end":"10:30"}],
    "tuesday": [],
    "wednesday": [],
    "thursday": [],
    "friday": [],
    "saturday": [],
    "sunday": []
  }'
```

## 🔮 Future Integration: Schedule Page

The groundwork is laid for schedule integration. When you're ready to integrate
with the schedule page:

### Step 1: Fetch All Rower Availability

```typescript
// In schedule page or OutingDrawer component
const [rowerAvailability, setRowerAvailability] = useState<
  Map<string, Record<DayOfWeek, TimeRange[]>>
>(new Map());

// Fetch availability for all members
useEffect(() => {
  async function loadAvailability() {
    const availabilityMap = new Map();

    for (const member of members) {
      try {
        const response = await fetch(
          `/api/get-rower-availability?memberId=${member.id}`
        );
        const data = await response.json();
        if (data.success && data.availability) {
          availabilityMap.set(member.id, {
            monday: data.availability.monday,
            tuesday: data.availability.tuesday,
            // ... etc
          });
        }
      } catch (err) {
        console.error(`Failed to load availability for ${member.name}`);
      }
    }

    setRowerAvailability(availabilityMap);
  }

  loadAvailability();
}, [members]);
```

### Step 2: Filter/Indicate Unavailable Rowers

```typescript
import { isRowerAvailable, extractTime } from "@/utils/rowerAvailability";

// When showing rower dropdown
const outingDate = "2025-10-14";
const outingTime = extractTime(outing.startTime); // "09:00"

const rowersWithAvailability = members.map((member) => {
  const memberAvail = rowerAvailability.get(member.id);
  const available = memberAvail
    ? isRowerAvailable(memberAvail, outingDate, outingTime)
    : true; // No data means available

  return {
    ...member,
    available,
  };
});

// Show unavailable rowers with visual indicator
{
  rowersWithAvailability.map((rower) => (
    <option
      key={rower.id}
      value={rower.id}
      style={{ color: rower.available ? "black" : "#94a3b8" }}
    >
      {rower.name} {!rower.available && "(Unavailable)"}
    </option>
  ));
}
```

## 🐛 Troubleshooting

### "Member not found" error

- Verify the member ID is valid
- Check that you're passing the correct Notion page ID

### Validation errors on save

- Check browser console for detailed error message
- Verify no overlapping time ranges
- Ensure max 3 ranges per day
- Check time format is HH:MM (24-hour)

### Data not persisting

- Check Notion property names match exactly: "Unavailable Monday", etc.
- Verify properties are type "Text" in Notion
- Check browser network tab for API errors

### Page not loading

- Verify react-select is installed: `npm install react-select`
- Check for TypeScript errors: `npm run type-check`
- Verify all imports are correct

## 📝 Notes

- **Recurring Pattern:** This system uses weekly recurring patterns, not
  date-specific availability
- **Unavailability Model:** Users mark when they are NOT available (inverse of
  coxing system)
- **No Historical Data:** Past data is not preserved when users update their
  availability
- **Member-Centric:** Each member can only edit their own availability
- **Time Zone:** All times are in 24-hour local time format (HH:MM)

## ✅ Implementation Complete

All core features are implemented:

- ✅ TypeScript types and validation
- ✅ GET/POST APIs with error handling
- ✅ React hooks with caching
- ✅ Full UI with time pickers
- ✅ Navigation link in sidebar
- ✅ Utility functions for availability checking
- ✅ Validation (overlap detection, max 3 ranges)

Ready for testing! 🚀
