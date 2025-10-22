#!/bin/bash

# Script to remove/comment out console.log and console.warn statements
# Preserves console.error for actual error handling

echo "Removing console.log and console.warn statements..."

# Files to clean (based on your logs)
FILES=(
  "src/app/(app shell)/schedule/OutingDrawer.tsx"
  "src/app/(app shell)/schedule/MemberFilter.tsx"
  "src/app/(app shell)/hooks/useUrlState.ts"
  "src/app/(app shell)/hooks/useCalendarData.ts"
  "src/app/(app shell)/mappers/mapOutingsToEvents.ts"
  "src/components/FlagStatusBanner.tsx"
  "src/hooks/useMembers.ts"
  "src/hooks/useOutingDetails.ts"
  "src/server/notion/lib/outings.ts"
)

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "Processing: $file"
    # Comment out console.log lines (but not console.error)
    sed -i.bak '/console\.log/s/^/\/\/ /' "$file"
    sed -i.bak2 '/console\.warn/s/^/\/\/ /' "$file"
    # Clean up backup files
    rm -f "$file.bak" "$file.bak2"
  else
    echo "Skipping (not found): $file"
  fi
done

echo "Done!"
