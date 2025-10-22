#!/bin/bash

# Script to remove emoji-based debug console logs
# This script removes console.log and console.warn statements that contain emojis
# Keeps console.error statements for error handling

echo "Removing emoji-based debug console logs..."

# Function to process a file
process_file() {
    local file="$1"
    echo "Processing: $file"

    # Create a temporary file
    tmp_file=$(mktemp)

    # Read the file line by line
    skip_lines=0
    while IFS= read -r line || [ -n "$line" ]; do
        if [ $skip_lines -gt 0 ]; then
            # Check if we're still in a multi-line console statement
            if [[ "$line" =~ ^\s*\}\);?\s*$ ]] || [[ "$line" =~ ^\s*\)\;?\s*$ ]] || [[ "$line" =~ \)\;?\s*$ ]]; then
                skip_lines=0
                continue
            fi
            # If line contains more closing than opening brackets, we're done
            open_count=$(echo "$line" | grep -o "{" | wc -l)
            close_count=$(echo "$line" | grep -o "}" | wc -l)
            if [ $close_count -gt $open_count ]; then
                skip_lines=0
                continue
            fi
            continue
        fi

        # Check if line contains emoji-based console.log or console.warn
        if echo "$line" | grep -q "console\.\(log\|warn\).*[🔍🆕📝✅🔄ℹ️⚠️🎯🔧🔹📊🗑️✏️🔒🔁❌📍📥🪑💡📖📅📋🚀🔑🏁🎨]"; then
            # Check if it's a multi-line statement
            if ! echo "$line" | grep -q ");"; then
                skip_lines=1
            fi
            continue
        fi

        echo "$line" >> "$tmp_file"
    done < "$file"

    # Replace original file with processed version
    mv "$tmp_file" "$file"
}

# Process files
process_file "src/app/(app shell)/schedule/OutingDrawer.tsx"
process_file "src/app/(app shell)/schedule/MemberFilter.tsx"
process_file "src/lib/testMappers.ts"
process_file "src/lib/notion/outings.ts"
process_file "src/hooks/useMembers.ts"
process_file "src/hooks/useUrlState.ts"
process_file "src/hooks/useOutingDetails.ts"
process_file "src/hooks/useUpcomingSessions.ts"
process_file "src/hooks/useRecentWaterOutings.ts"
process_file "src/hooks/useNextEvent.ts"
process_file "src/hooks/useFlagStatus.ts"
process_file "src/hooks/useCoxingOverviewUnified.ts"
process_file "src/components/FlagStatusBanner.tsx"
process_file "src/app/tests/[[...params]]/page.client.tsx"

echo "Done! Please review the changes."
