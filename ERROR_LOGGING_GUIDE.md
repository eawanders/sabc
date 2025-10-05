# Error Logging Guide

## Overview

Comprehensive error logging has been added to both `TestDrawer.tsx` and
`OutingDrawer.tsx` to help debug member creation, assignment, and availability
update processes.

## Log Prefixes

Logs use emoji prefixes to make them easy to identify and filter in the browser
console:

- **🆕 [ComponentName]** - Member creation flow
- **📝 [ComponentName]** - Assignment change flow
- **✅ [ComponentName]** - Availability/outcome update flow
- **❌ [ComponentName]** - Error conditions
- **⚠️ [ComponentName]** - Warning conditions
- **🔄 [ComponentName]** - Data refresh operations

## TestDrawer.tsx Logging

### Member Creation (`handleCreateMember`)

```
🆕 [TestDrawer] Creating new member: { slot, inputValue, testId }
🆕 [TestDrawer] Request body: { name, role }
🆕 [TestDrawer] Add member response: { status, ok }
🆕 [TestDrawer] Member created successfully: { member data }
🆕 [TestDrawer] Assigning new member to slot: { slotNumber, memberId, testId }
🆕 [TestDrawer] Assign request body: { testId, slotNumber, memberId }
🆕 [TestDrawer] Assign response: { status, ok }
🆕 [TestDrawer] Member assigned successfully
🆕 [TestDrawer] Setting outcome to Test Booked: { testId, slotNumber }
🆕 [TestDrawer] Updating local state: { slot, memberName }
🆕 [TestDrawer] Clearing loading state
🆕 [TestDrawer] Starting background refresh
🆕 [TestDrawer] Background refresh completed successfully
🆕 [TestDrawer] Member creation flow completed successfully
```

**Error Cases:**

```
🆕 [TestDrawer] Failed to parse error response: { error }
🆕 [TestDrawer] Failed to create member: { error }
🆕 [TestDrawer] Failed to parse assign error: { error }
🆕 [TestDrawer] Failed to assign newly created member: { error }
🆕 [TestDrawer] Failed to update outcome: { error }
🆕 [TestDrawer] Error refreshing data: { error }
🆕 [TestDrawer] Error in handleCreateMember: { error }
🆕 [TestDrawer] Error stack: { stack trace }
```

### Assignment Change (`handleAssignmentChange`)

```
📝 [TestDrawer] handleAssignmentChange called: { slot, memberName, testId }
📝 [TestDrawer] Updating local state optimistically
📝 [TestDrawer] Slot number: { slotNumber }
```

**Clearing Assignment:**

```
📝 [TestDrawer] Clearing slot assignment
📝 [TestDrawer] Clear assignment response: { status, ok }
📝 [TestDrawer] Slot cleared successfully
📝 [TestDrawer] Setting outcome to No Show after clear
📝 [TestDrawer] Clearing loading state after clear
📝 [TestDrawer] Starting background refresh after clear
📝 [TestDrawer] Clear assignment flow completed
```

**Assigning Member:**

```
📝 [TestDrawer] Assigning member to slot
📝 [TestDrawer] Looking up member: { memberName, totalMembers }
📝 [TestDrawer] Member found: { id, name }
📝 [TestDrawer] Assign request body: { testId, slotNumber, memberId }
📝 [TestDrawer] Assign response: { status, ok }
📝 [TestDrawer] Member assigned successfully
📝 [TestDrawer] Setting outcome to Test Booked after assignment
📝 [TestDrawer] Outcome update response: { status, ok }
📝 [TestDrawer] Clearing loading state after assignment
📝 [TestDrawer] Starting background refresh after assignment
📝 [TestDrawer] Assignment flow completed
```

**Error Cases:**

```
📝 [TestDrawer] Failed to parse clear error: { error }
📝 [TestDrawer] Clear assignment failed: { error }
📝 [TestDrawer] Failed to update outcome on clear: { error }
📝 [TestDrawer] Member not found in members list: { memberName, availableMembers }
📝 [TestDrawer] Failed to parse assign error: { error }
📝 [TestDrawer] Assignment failed: { error }
📝 [TestDrawer] Member assigned but failed to set outcome to Test Booked
📝 [TestDrawer] Error assigning member to test slot: { error }
📝 [TestDrawer] Error stack: { stack trace }
```

### Availability Update (`handleAvailabilityUpdate`)

```
✅ [TestDrawer] handleAvailabilityUpdate called: { slot, outcome, testId }
✅ [TestDrawer] Updating local state optimistically
✅ [TestDrawer] Slot number: { slotNumber }
✅ [TestDrawer] Update outcome request body: { testId, slotNumber, outcome }
✅ [TestDrawer] API response received: { status, statusText, ok }
✅ [TestDrawer] Clearing loading state after outcome update
✅ [TestDrawer] Starting background refresh after outcome update
✅ [TestDrawer] Outcome update flow completed
```

**Error Cases:**

```
✅ [TestDrawer] Failed to parse error response: { error }
✅ [TestDrawer] API Error updating outcome: { error }
✅ [TestDrawer] Error updating test outcome: { error }
✅ [TestDrawer] Error stack: { stack trace }
```

## OutingDrawer.tsx Logging

### Member Creation (`handleCreateMember`)

```
🆕 [OutingDrawer] Creating new member: { seat, inputValue, outingId }
🆕 [OutingDrawer] Request body: { name, role }
🆕 [OutingDrawer] Add member response: { status, ok }
🆕 [OutingDrawer] Member created successfully: { member data }
🆕 [OutingDrawer] Assigning new member to seat: { seat, memberId, outingId }
🆕 [OutingDrawer] Assign request body: { outingId, seat, memberId }
🆕 [OutingDrawer] Assign response: { status, ok }
🆕 [OutingDrawer] Member assigned successfully
🆕 [OutingDrawer] Setting status to Awaiting Approval: { outingId, statusField }
🆕 [OutingDrawer] Updating local state: { seat, memberName }
🆕 [OutingDrawer] Clearing loading state
🆕 [OutingDrawer] Starting background refresh
🆕 [OutingDrawer] Background refresh completed successfully
🆕 [OutingDrawer] Member creation flow completed successfully
```

**Error Cases:**

```
🆕 [OutingDrawer] Failed to parse error response: { error }
🆕 [OutingDrawer] Failed to create member: { error }
🆕 [OutingDrawer] No outing data available
🆕 [OutingDrawer] Failed to parse assign error: { error }
🆕 [OutingDrawer] Failed to assign newly created member: { error }
🆕 [OutingDrawer] Failed to update status: { error }
🆕 [OutingDrawer] Error refreshing data: { error }
🆕 [OutingDrawer] Error in handleCreateMember: { error }
🆕 [OutingDrawer] Error stack: { stack trace }
```

### Assignment Change (`handleAssignmentChange`)

```
📝 [OutingDrawer] Assignment change: { seat, from, to, memberId, outingId }
📝 [OutingDrawer] isRemovingMember: { boolean }
📝 [OutingDrawer] Updating local state optimistically
📝 [OutingDrawer] Assign seat request body: { outingId, seat, memberId }
📝 [OutingDrawer] Assign seat response: { status, ok }
✅ [OutingDrawer] Seat { seat } updated with { memberName }
✅ [OutingDrawer] Seat { seat } cleared
📝 [OutingDrawer] Clearing loading state after seat assignment
📝 [OutingDrawer] Resetting { statusField } to "Awaiting Approval" due to assignment change
📝 [OutingDrawer] Update status request body: { outingId, statusField, status }
📝 [OutingDrawer] Update status response: { status, ok }
✅ [OutingDrawer] { statusField } reset to "Awaiting Approval"
📝 [OutingDrawer] Starting data refresh after assignment
📝 [OutingDrawer] Data refresh completed
🧹 [OutingDrawer] Cleared optimistic update flag for { seat }
📝 [OutingDrawer] Assignment change flow completed
```

**Error Cases:**

```
⚠️ [OutingDrawer] Attempted to change assignment before initialization complete or no outing data
📝 [OutingDrawer] Failed to read error response: { error }
📝 [OutingDrawer] Assignment failed: { error }
📝 [OutingDrawer] Failed to read status error response: { error }
📝 [OutingDrawer] Status update failed: { error }
❌ [OutingDrawer] Error resetting { statusField }: { error }
❌ [OutingDrawer] Error stack: { stack trace }
❌ [OutingDrawer] Error updating seat { seat }: { error }
```

### Availability Update (`handleAvailabilityUpdate`)

```
✅ [OutingDrawer] Updating availability: { seat, statusField, notionStatusField, status, outingId }
✅ [OutingDrawer] Member for seat: { seat, memberName }
✅ [OutingDrawer] Updating local state optimistically
✅ [OutingDrawer] Update availability request body: { outingId, statusField, status }
✅ [OutingDrawer] Update availability response: { status, ok }
✅ [OutingDrawer] Availability updated successfully: { statusField, status, responseData }
✅ [OutingDrawer] Starting data refresh after availability update
✅ [OutingDrawer] Availability update flow completed
```

**Error Cases:**

```
⚠️ [OutingDrawer] Cannot set availability - no member selected or no outing data: { seat, hasMember, hasOuting }
⚠️ [OutingDrawer] Tried to update status but no member is assigned: { seat }
✅ [OutingDrawer] Failed to read error response: { error }
❌ [OutingDrawer] API Error Response: { error }
❌ [OutingDrawer] Error in handleAvailabilityUpdate: { error }
❌ [OutingDrawer] Error stack: { stack trace }
❌ [OutingDrawer] Error updating statusField: { statusField }
❌ [OutingDrawer] Error message: { message }
❌ [OutingDrawer] Reverting to previous status: { seat, previousStatus }
```

## How to Use These Logs for Debugging

### Browser Console Filtering

You can filter logs in the browser console using these patterns:

- **All TestDrawer logs:** Filter by `[TestDrawer]`
- **All OutingDrawer logs:** Filter by `[OutingDrawer]`
- **Member creation only:** Filter by `🆕`
- **Assignment changes only:** Filter by `📝`
- **Availability updates only:** Filter by `✅`
- **All errors:** Filter by `❌`
- **All warnings:** Filter by `⚠️`

### Typical Error Investigation Flow

1. **Check the top-level error log** - Look for `Error in handle...` messages
2. **Find the error stack trace** - Look for `Error stack:` immediately after
3. **Trace backwards through the flow** - Use the emoji prefix to find all
   related logs
4. **Check request/response bodies** - Look for `request body:` and `response:`
   logs
5. **Verify state updates** - Look for `Updating local state` logs

### Common Issues to Debug

**Member Creation Fails:**

- Check `🆕 [Component] Add member response` - should be
  `{ status: 200, ok: true }`
- Check `🆕 [Component] Failed to create member` for API error details
- Look for schema validation errors in the response

**Assignment Fails:**

- Check `📝 [Component] Assign response` - should be `{ status: 200, ok: true }`
- Check `📝 [Component] Member not found` if member lookup fails
- Verify `memberId` is present in the request body

**Availability Update Fails:**

- Check `✅ [Component] Update availability response` - should be
  `{ status: 200, ok: true }`
- Look for `API Error Response` to see backend error details
- Check if member is assigned before status update

**Optimistic Updates Not Reverting:**

- Look for state revert logs in catch blocks
- Check `Reverting to previous status` messages
- Verify previousAssignments are being restored

## Performance Monitoring

The logs also help monitor performance:

- **Loading state duration:** Time between "Clearing loading state" and
  operation start
- **Background refresh timing:** Time between "Starting background refresh" and
  "completed successfully"
- **API response times:** Check timestamps between request and response logs

## Example Debug Session

```
🆕 [TestDrawer] Creating new member: { slot: "Slot 1", inputValue: "John Doe", testId: "123" }
🆕 [TestDrawer] Request body: { name: "John Doe", role: "member" }
🆕 [TestDrawer] Add member response: { status: 400, ok: false }
🆕 [TestDrawer] Failed to parse error response: SyntaxError: Unexpected token...
🆕 [TestDrawer] Failed to create member: { error: "Validation failed: email is required" }
❌ [TestDrawer] Error in handleCreateMember: Error: Validation failed: email is required
❌ [TestDrawer] Error stack: Error: Validation failed...
    at handleCreateMember (TestDrawer.tsx:XXX)
```

This shows a validation error where the API expected an email field. The full
error chain is captured with request body, response status, parsed error
message, and stack trace.
