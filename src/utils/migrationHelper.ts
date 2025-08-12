// src/utils/migrationHelper.ts
/**
 * Migration helper utilities for converting from Tailwind spacing classes
 * to the new spacing prop system
 */

// Mapping of common Tailwind spacing classes to our spacing scale
export const TAILWIND_TO_SPACING = {
  // Padding classes
  'p-0': { p: 0 },
  'p-1': { p: 1 },
  'p-2': { p: 2 },
  'p-3': { p: 3 },
  'p-4': { p: 4 },
  'p-5': { p: 5 },
  'p-6': { p: 6 },
  'p-8': { p: 8 },
  'p-10': { p: 10 },
  'p-12': { p: 12 },
  'p-16': { p: 16 },
  'p-20': { p: 20 },
  'p-24': { p: 24 },

  // Padding X (horizontal)
  'px-0': { px: 0 },
  'px-1': { px: 1 },
  'px-2': { px: 2 },
  'px-3': { px: 3 },
  'px-4': { px: 4 },
  'px-5': { px: 5 },
  'px-6': { px: 6 },
  'px-8': { px: 8 },

  // Padding Y (vertical)
  'py-0': { py: 0 },
  'py-1': { py: 1 },
  'py-2': { py: 2 },
  'py-3': { py: 3 },
  'py-4': { py: 4 },
  'py-5': { py: 5 },
  'py-6': { py: 6 },
  'py-8': { py: 8 },

  // Margins
  'm-0': { m: 0 },
  'm-1': { m: 1 },
  'm-2': { m: 2 },
  'm-3': { m: 3 },
  'm-4': { m: 4 },
  'm-5': { m: 5 },
  'm-6': { m: 6 },
  'm-8': { m: 8 },

  // Margin top
  'mt-0': { mt: 0 },
  'mt-1': { mt: 1 },
  'mt-2': { mt: 2 },
  'mt-3': { mt: 3 },
  'mt-4': { mt: 4 },
  'mt-5': { mt: 5 },
  'mt-6': { mt: 6 },
  'mt-8': { mt: 8 },

  // Margin bottom
  'mb-0': { mb: 0 },
  'mb-1': { mb: 1 },
  'mb-2': { mb: 2 },
  'mb-3': { mb: 3 },
  'mb-4': { mb: 4 },
  'mb-5': { mb: 5 },
  'mb-6': { mb: 6 },
  'mb-8': { mb: 8 },
} as const;

/**
 * Convert Tailwind spacing class to spacing props
 * @param className Tailwind spacing class (e.g., 'p-6', 'mt-4')
 * @returns Spacing props object
 */
export function tailwindToSpacing(className: keyof typeof TAILWIND_TO_SPACING) {
  return TAILWIND_TO_SPACING[className] || {};
}

/**
 * Convert multiple Tailwind classes to combined spacing props
 * @param classNames Array of Tailwind spacing classes
 * @returns Combined spacing props object
 */
export function tailwindClassesToSpacing(classNames: string[]) {
  return classNames.reduce((acc, className) => {
    const trimmed = className.trim() as keyof typeof TAILWIND_TO_SPACING;
    return { ...acc, ...tailwindToSpacing(trimmed) };
  }, {});
}

/**
 * Migration examples and common patterns
 */
export const MIGRATION_EXAMPLES = [
  {
    before: '<div className="p-6 mb-8">',
    after: '<Box p={24} mb={32}>',
    note: 'p-6 = 24px, mb-8 = 32px'
  },
  {
    before: '<button className="px-4 py-2">',
    after: '<Button px={16} py={8}>',
    note: 'px-4 = 16px, py-2 = 8px'
  },
  {
    before: '<h2 className="mb-4">',
    after: '<Heading2 mb={16}>',
    note: 'mb-4 = 16px'
  },
  {
    before: '<p className="mt-2 px-3">',
    after: '<Paragraph mt={8} px={12}>',
    note: 'mt-2 = 8px, px-3 = 12px'
  },
] as const;

// Helper to log migration suggestions during development
export function logMigrationSuggestion(tailwindClasses: string) {
  if (process.env.NODE_ENV === 'development') {
    const classes = tailwindClasses.split(/\s+/).filter(c => c.startsWith('p-') || c.startsWith('m-'));
    if (classes.length > 0) {
      const spacingProps = tailwindClassesToSpacing(classes);
      console.log(`💡 Migration suggestion for "${tailwindClasses}":`, spacingProps);
    }
  }
}
