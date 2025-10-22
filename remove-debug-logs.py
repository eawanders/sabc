#!/usr/bin/env python3
"""
Remove emoji-based debug console logs from JavaScript/TypeScript files.
Keeps console.error for actual error handling.
"""

import re
import sys

def remove_emoji_logs(content):
    """Remove console.log and console.warn statements with emojis"""
    lines = content.split('\n')
    result = []
    skip_until_semicolon = False
    bracket_depth = 0

    for i, line in enumerate(lines):
        # Check if we're skipping a multi-line console statement
        if skip_until_semicolon:
            # Count brackets to handle nested objects
            bracket_depth += line.count('{') - line.count('}')
            bracket_depth += line.count('[') - line.count(']')
            bracket_depth += line.count('(') - line.count(')')

            # Check if we've reached the end of the statement
            if ');' in line or (bracket_depth <= 0 and ';' in line):
                skip_until_semicolon = False
                bracket_depth = 0
            continue

        # Check if line contains emoji-based console.log or console.warn
        # Using emoji pattern matching
        emoji_pattern = r'console\.(log|warn).*[🔍🆕📝✅🔄ℹ️⚠️🎯🔧🔹📊🗑️✏️🔒🔁❌📍📥🪑💡📖📅📋🚀🔑🏁🎨]'

        if re.search(emoji_pattern, line):
            # Check if it's a single-line statement
            if ');' not in line and not line.rstrip().endswith(');'):
                skip_until_semicolon = True
                bracket_depth = line.count('{') - line.count('}')
                bracket_depth += line.count('[') - line.count(']')
                bracket_depth += line.count('(') - line.count(')')
            continue

        result.append(line)

    return '\n'.join(result)

def process_file(filepath):
    """Process a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        new_content = remove_emoji_logs(content)

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)

        print(f"✓ Processed {filepath}")
    except Exception as e:
        print(f"✗ Error processing {filepath}: {e}", file=sys.stderr)

if __name__ == '__main__':
    files = [
        'src/app/(app shell)/schedule/OutingDrawer.tsx',
        'src/app/(app shell)/schedule/MemberFilter.tsx',
        'src/lib/testMappers.ts',
        'src/lib/notion/outings.ts',
        'src/hooks/useMembers.ts',
        'src/hooks/useUrlState.ts',
        'src/hooks/useOutingDetails.ts',
        'src/hooks/useUpcomingSessions.ts',
        'src/hooks/useRecentWaterOutings.ts',
        'src/hooks/useNextEvent.ts',
        'src/hooks/useFlagStatus.ts',
        'src/hooks/useCoxingOverviewUnified.ts',
        'src/components/FlagStatusBanner.tsx',
        'src/app/tests/[[...params]]/page.client.tsx',
        'src/app/api/assign-seat/route.ts',
        'src/app/api/update-availability/route.ts',
        'src/app/api/get-test/route.ts',
        'src/app/api/get-outing-report/[id]/route.ts',
        'src/app/api/update-rower-availability/route.ts',
        'src/app/api/submit-outing-report/route.ts',
        'src/app/api/flag-status/route.ts',
    ]

    for filepath in files:
        process_file(filepath)

    print("\nDone! Please review the changes.")
