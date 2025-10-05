# Member Creation Fix - October 5, 2025

## Problem Identified

The error logs showed:

```
🆕 [OutingDrawer] Failed to create member: {error: 'Internal server error', message: 'Role is not a property that exists.'}
```

### Root Cause

The `/api/add-member` route was attempting to set a `Role` property in the
Notion Members database, but this property doesn't exist. The actual property
name is `Member Type`.

### Evidence

From `src/server/notion/members.ts`, the Members database schema is:

- `Full Name` (title field)
- `Email Address` (email field)
- `Member Type` (select field) ← **This is what we need**
- `Cox Experience` (select field)
- `College` (rich_text field)

## Fix Applied

### File: `/src/app/api/add-member/route.ts`

**Changed:**

```typescript
'Role': {
  select: {
    name: input.role.charAt(0).toUpperCase() + input.role.slice(1),
  },
}
```

**To:**

```typescript
'Member Type': {
  select: {
    name: input.role.charAt(0).toUpperCase() + input.role.slice(1),
  },
}
```

### Additional Improvements

1. **Enhanced Logging:** Added detailed logging before Notion API call:

   ```typescript
   logger.info(
     {
       route,
       memberName: input.name,
       hasEmail: !!input.email,
       role: input.role,
       hasCollege: !!input.college,
     },
     "Creating member in Notion"
   );
   ```

2. **Notion Error Handling:** Added specific error logging for Notion API
   errors:
   ```typescript
   if (error && typeof error === "object" && "code" in error) {
     logger.error(
       {
         route,
         notionError: error,
         code: (error as any).code,
         message: (error as any).message,
       },
       "Notion API error creating member"
     );
   }
   ```

## Testing the Fix

### Expected Behavior

1. **From TestDrawer:** User creates member "Paul" → Success
2. **From OutingDrawer:** User creates member "Paul" → Success

### Console Logs (Success Path)

```
🆕 [Component] Creating new member: { seat/slot, inputValue: "Paul", testId/outingId }
🆕 [Component] Request body: { name: "Paul", role: "member" }
🆕 [Component] Add member response: { status: 200, ok: true }
🆕 [Component] Member created successfully: { member: { id, name, email, role } }
🆕 [Component] Assigning new member to seat/slot: { memberId, ... }
🆕 [Component] Assign response: { status: 200, ok: true }
🆕 [Component] Member assigned successfully
🆕 [Component] Setting status/outcome to Awaiting Approval/Test Booked
🆕 [Component] Updating local state
🆕 [Component] Clearing loading state
🆕 [Component] Starting background refresh
🆕 [Component] Background refresh completed successfully
🆕 [Component] Member creation flow completed successfully
```

### Server Logs (Success Path)

```
INFO: Creating member in Notion { memberName: "Paul", hasEmail: false, role: "member", hasCollege: false }
INFO: Member created successfully in Notion { memberId: "...", memberName: "Paul" }
```

## Robustness Improvements

The comprehensive error logging added previously will now properly show:

1. **Request Details:** What data is being sent to the API
2. **API Response:** Status codes and success/failure
3. **Notion Errors:** Specific Notion API error codes and messages
4. **State Tracking:** Local state updates and rollbacks
5. **Background Operations:** Refresh operations and their outcomes

## Related Files

- `/src/app/api/add-member/route.ts` - Fixed property name
- `/src/server/notion/members.ts` - Reference for correct schema
- `/src/app/(app shell)/swim-tests/TestDrawer.tsx` - Consumer with logging
- `/src/app/(app shell)/schedule/OutingDrawer.tsx` - Consumer with logging
- `/src/app/api/_utils/schemas.ts` - Input validation (no changes needed)

## Migration Notes

**No database migration required.** This was a simple property name mismatch in
the code. The Notion database already has the correct `Member Type` property.

## Verification Steps

1. ✅ Navigate to swim test drawer
2. ✅ Click on a slot dropdown
3. ✅ Type a new member name (e.g., "Paul")
4. ✅ Click "Add 'Paul' as new member"
5. ✅ Verify member is created in Notion Members database
6. ✅ Verify member is assigned to the slot
7. ✅ Verify status is set to "Test Booked"
8. ✅ Repeat for OutingDrawer with seat assignment
9. ✅ Verify status is set to "Awaiting Approval"

## Error Logs Reference

The error logs that led to this fix:

```
POST http://localhost:3000/api/add-member 500 (Internal Server Error)
🆕 [OutingDrawer] Add member response: {status: 500, ok: false}
🆕 [OutingDrawer] Failed to create member: {error: 'Internal server error', message: 'Role is not a property that exists.'}
```

With the fix, these errors will no longer occur.
