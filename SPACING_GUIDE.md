# Spacing System Documentation

This document explains how to use the new component-level spacing system that
replaces Tailwind utility classes like `p-6`, `m-4`, etc.

## Overview

The spacing system provides:

- **Consistent spacing scale** based on design tokens
- **Component-level control** over padding and margins
- **Type-safe** spacing props
- **Flexible values** supporting scale, pixels, or CSS units

## Available Spacing Props

All components that support spacing accept these props:

### Padding

- `p` - padding (all sides)
- `px` - padding horizontal (left + right)
- `py` - padding vertical (top + bottom)
- `pt` - padding top
- `pr` - padding right
- `pb` - padding bottom
- `pl` - padding left

### Margin

- `m` - margin (all sides)
- `mx` - margin horizontal (left + right)
- `my` - margin vertical (top + bottom)
- `mt` - margin top
- `mr` - margin right
- `mb` - margin bottom
- `ml` - margin left

## Spacing Scale

The spacing scale follows a consistent pattern (all values in pixels):

```
0: 0px     |  16: 64px    |  44: 176px
1: 4px     |  20: 80px    |  48: 192px
2: 8px     |  24: 96px    |  52: 208px
3: 12px    |  28: 112px   |  56: 224px
4: 16px    |  32: 128px   |  60: 240px
5: 20px    |  36: 144px   |  64: 256px
6: 24px    |  40: 160px   |  72: 288px
8: 32px    |  80: 320px   |  96: 384px
10: 40px   |
12: 48px   |
14: 56px   |
```

## Usage Examples

### Basic Components

```tsx
// Box component with padding
<Box p={24}>Content with 24px padding</Box>

// Card with different horizontal/vertical padding
<Card px={16} py={20}>Card content</Card>

// Text with margins
<Heading2 mb={16}>Title with bottom margin</Heading2>
<Paragraph mt={8}>Paragraph with top margin</Paragraph>
```

### Component-Specific Spacing

```tsx
// Button with custom padding (overrides defaults)
<Button px={32} py={12}>Wide Button</Button>

// NavItem with custom spacing
<NavItem px={16} py={10} href="/page" label="Custom" />
```

### Different Value Types

```tsx
// Scale values (recommended)
<Box p={24} />

// Direct pixel values
<Box p={17} />

// CSS units
<Box p="1.5rem" />
<Box p="2ch" />

// Using constants
import { SPACING } from '@/config/constants';
<Box p={SPACING[6]} /> // 24px
```

### Complex Layouts

```tsx
<Card p={24} mb={32}>
  <Heading2 mb={16}>Card Title</Heading2>
  <Paragraph mb={20}>Description text</Paragraph>

  <Box className="flex gap-3">
    <Button px={20} py={8}>
      Action
    </Button>
    <Button px={16} py={8} variant="outline">
      Cancel
    </Button>
  </Box>
</Card>
```

## Components with Spacing Support

### Core Components

- `Box` - Generic container with spacing props
- `Card` - Surface component with variants
- `Button` - Interactive element with default padding
- `Text`, `Heading1`, `Heading2`, etc. - Typography components

### Layout Components

- `NavItem` - Navigation items with configurable spacing
- Any component extending `SpacingProps`

## Migration from Tailwind Classes

### Before (Tailwind utilities):

```tsx
<div className="p-6 mb-8">
  <h2 className="mb-4">Title</h2>
  <p className="mt-2">Content</p>
  <button className="px-4 py-2">Action</button>
</div>
```

### After (Spacing props):

```tsx
<Box p={24} mb={32}>
  <Heading2 mb={16}>Title</Heading2>
  <Paragraph mt={8}>Content</Paragraph>
  <Button px={16} py={8}>
    Action
  </Button>
</Box>
```

## Best Practices

### 1. Use Scale Values

Prefer scale values over arbitrary pixels for consistency:

```tsx
// Good
<Card p={24} />

// Avoid (unless specific design requirement)
<Card p={23} />
```

### 2. Component Defaults

Many components have sensible defaults. Only override when needed:

```tsx
// Button has default padding, only override if necessary
<Button>Normal Button</Button>
<Button px={32}>Wide Button</Button>
```

### 3. Responsive Spacing

Use Tailwind responsive utilities for responsive spacing when needed:

```tsx
<Box
  p={16}
  className="sm:p-6 lg:p-8" // Tailwind classes for responsive
>
  Content
</Box>
```

### 4. Semantic Grouping

Group related spacing logically:

```tsx
// Group padding together
<Card px={20} py={16}>

// Group margins together
<Text mt={8} mb={12}>
```

## Advanced Usage

### Custom Components

To add spacing support to your own components:

```tsx
import {
  SpacingProps,
  getSpacingStyles,
  removeSpacingProps,
} from "@/lib/spacing";

interface MyComponentProps extends SpacingProps {
  children: React.ReactNode;
  // your other props
}

function MyComponent({ children, ...props }: MyComponentProps) {
  const spacingStyles = getSpacingStyles(props);
  const cleanProps = removeSpacingProps(props);

  return (
    <div style={spacingStyles} {...cleanProps}>
      {children}
    </div>
  );
}
```

### Using with Styled Components or CSS-in-JS

The spacing system works with any styling solution:

```tsx
const spacingStyles = getSpacingStyles({ p: 24, mb: 16 });
// Returns: { padding: '24px', marginBottom: '16px' }
```

## Performance Considerations

- Spacing styles are computed at render time but are lightweight
- No additional CSS is generated (inline styles)
- Type-safe props prevent runtime errors
- Tree-shaking friendly (unused spacing utilities are eliminated)

## Troubleshooting

### TypeScript Errors

If you get spacing prop errors, ensure your component extends `SpacingProps`:

```tsx
interface Props extends SpacingProps {
  // your props
}
```

### Spacing Not Applied

- Check that you're using a component that supports spacing props
- Verify the component properly implements `getSpacingStyles()`
- Ensure no conflicting CSS classes override the styles

### Custom Values Not Working

Remember that custom values should be strings for CSS units:

```tsx
// Correct
<Box p="1.5rem" />
<Box p="20px" />

// Incorrect
<Box p={1.5rem} /> // This is not valid
```
