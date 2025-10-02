# Mobile Implementation Guide

## Overview

This document describes the mobile-responsive design system implemented for the
SABC web app. The implementation uses a **768px breakpoint** (Tailwind's `md:`
prefix) to switch between mobile and desktop layouts.

## Architecture

### Breakpoint Strategy

- **Mobile**: `< 768px` (default)
- **Tablet/Desktop**: `≥ 768px` (Tailwind `md:` prefix)

### Layout Behavior

#### Desktop (≥768px)

- Fixed sidebar (240px width) visible on left
- Main content area with 32px padding
- Traditional desktop navigation

#### Mobile (<768px)

- Fixed header at top (64px height)
- Hamburger menu button
- Slide-out navigation drawer from left
- Main content with 16px padding
- Content area starts below header

## File Structure

```
src/
├── components/
│   ├── ResponsiveLayout.tsx          # Main responsive wrapper
│   └── mobile/
│       ├── index.ts                  # Barrel export
│       ├── MobileHeader.tsx          # Top header with logo + hamburger
│       ├── MobileDrawer.tsx          # Slide-out navigation menu
│       └── MobileNavItem.tsx         # Individual nav items
│
├── hooks/
│   ├── useMobileMenu.ts              # Drawer state management
│   └── useMediaQuery.ts              # Breakpoint detection hooks
│
└── app/
    ├── layout.tsx                    # Updated for responsive rendering
    └── globals.css                   # Mobile CSS variables added
```

## Components

### ResponsiveLayout

Main layout wrapper that conditionally renders mobile or desktop UI.

**Features:**

- Manages drawer state via `useMobileMenu` hook
- Conditionally renders sidebar (desktop) vs header/drawer (mobile)
- Handles padding adjustments for mobile header
- Ensures proper z-index layering

**Usage:**

```tsx
<ResponsiveLayout>{children}</ResponsiveLayout>
```

### MobileHeader

Fixed header for mobile screens with logo, title, and hamburger menu.

**Props:**

- `onMenuClick: () => void` - Callback when hamburger is clicked

**Features:**

- Fixed positioning at top of viewport
- 64px height (--mobile-header-height)
- Hidden on desktop (`md:hidden`)
- SABC logo and title
- Hamburger menu icon

### MobileDrawer

Slide-out navigation drawer for mobile navigation.

**Props:**

- `isOpen: boolean` - Controls drawer visibility
- `onClose: () => void` - Callback to close drawer

**Features:**

- Slides in from left with smooth animation
- 280px width (--mobile-drawer-width)
- Semi-transparent backdrop overlay
- Includes all navigation items from desktop sidebar
- Closes on:
  - Backdrop click
  - Navigation item click
  - Escape key press
- Body scroll lock when open

### MobileNavItem

Individual navigation item for mobile drawer.

**Props:**

- `href: string` - Navigation destination
- `icon: React.ReactNode` - Icon component
- `label: string` - Navigation label
- `onClick?: () => void` - Click handler (used to close drawer)

**Features:**

- Active state styling (blue background)
- Hover state
- Icon + label layout

## Hooks

### useMobileMenu()

Manages mobile drawer state.

**Returns:**

- `isOpen: boolean` - Current drawer state
- `open: () => void` - Open drawer
- `close: () => void` - Close drawer
- `toggle: () => void` - Toggle drawer

**Features:**

- Body scroll lock when drawer is open
- Cleanup on unmount

### useMediaQuery(query: string)

Detects if a media query matches.

**Convenience hooks:**

- `useIsDesktop()` - Returns `true` for ≥768px
- `useIsMobile()` - Returns `true` for <768px

**Example:**

```tsx
const isMobile = useIsMobile();
const isDesktop = useIsDesktop();
```

## CSS Variables

Added to `globals.css`:

```css
:root {
  /* Mobile Layout */
  --mobile-header-height: 64px;
  --mobile-drawer-width: 280px;
  --mobile-padding: 16px;

  /* Responsive Spacing */
  --spacing-mobile-sm: 8px;
  --spacing-mobile-md: 16px;
  --spacing-mobile-lg: 24px;
  --spacing-desktop-sm: 16px;
  --spacing-desktop-md: 32px;
  --spacing-desktop-lg: 48px;
}
```

## Responsive Patterns

### Conditional Rendering

```tsx
{
  /* Mobile only */
}
<div className="md:hidden">
  <MobileHeader />
</div>;

{
  /* Desktop only */
}
<div className="hidden md:flex">
  <Sidebar />
</div>;
```

### Responsive Padding

```tsx
<Box className="p-4 md:p-8">{/* 16px mobile, 32px desktop */}</Box>
```

### Responsive Layout

```tsx
<Box
  className="
  flex-col md:flex-row
  gap-4 md:gap-8
  pt-16 md:pt-0
"
>
  {content}
</Box>
```

## Testing the Implementation

### Test on Desktop (≥768px)

✅ Sidebar visible on left ✅ No mobile header visible ✅ Main content with 32px
padding ✅ Navigation works as before

### Test on Mobile (<768px)

✅ Mobile header visible at top ✅ Sidebar hidden ✅ Hamburger menu opens drawer
✅ Drawer slides in from left ✅ Backdrop overlay appears ✅ Navigation items
work ✅ Drawer closes on:

- Item click
- Backdrop click
- Escape key ✅ Body scroll locks when drawer open ✅ Main content starts below
  header ✅ Main content has 16px padding

### Browser Testing

Test in Chrome DevTools:

1. Open DevTools (F12)
2. Toggle device toolbar (Cmd+Shift+M / Ctrl+Shift+M)
3. Select mobile device or set custom width
4. Test at various widths:
   - 375px (iPhone SE)
   - 390px (iPhone 12 Pro)
   - 414px (iPhone 14 Pro Max)
   - 768px (iPad Mini - should show desktop)
   - 1024px (iPad - should show desktop)

## Next Steps: Page-by-Page Optimization

Now that the foundation is complete, optimize each page for mobile:

### Priority Pages

1. **Home** (`/home`) - Dashboard with cards
2. **Schedule** (`/schedule`) - Calendar view
3. **Events** (`/events`) - Events listing
4. **Coxing** (`/coxing`) - Coxing overview
5. **Tests** (`/tests`) - Swim tests

### Optimization Checklist per Page

- [ ] Update grid layouts (e.g., `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`)
- [ ] Adjust card sizing for mobile
- [ ] Optimize typography scaling
- [ ] Test horizontal scrolling (eliminate if present)
- [ ] Adjust spacing/gaps for mobile
- [ ] Test touch interactions (buttons, links)
- [ ] Verify modals/drawers work on mobile
- [ ] Test forms on mobile

## Best Practices

### DO ✅

- Use Tailwind responsive prefixes (`md:`, `lg:`)
- Test on real devices when possible
- Use semantic HTML (`<nav>`, `<header>`, `<main>`)
- Ensure touch targets are ≥44px
- Lock body scroll when modals/drawers open
- Use CSS transforms for animations (better performance)

### DON'T ❌

- Don't add new layout-shifting elements without testing
- Don't use fixed pixel widths without responsive alternatives
- Don't forget to test landscape orientation
- Don't use hover-only interactions (mobile has no hover)
- Don't block scrolling permanently

## Troubleshooting

### Mobile header overlaps content

- Ensure main content has `pt-[var(--mobile-header-height)]` on mobile
- Check z-index values

### Drawer doesn't slide smoothly

- Check if `transform` and `transition` classes are applied
- Verify drawer width CSS variable is set

### Navigation items not clickable

- Ensure drawer is above backdrop in z-index
- Check if pointer-events are blocked

### TypeScript errors

- Run `npm run build` to check for build errors
- Restart TypeScript server in VS Code

## Performance Considerations

- **No new dependencies added** - Uses only Tailwind CSS and React hooks
- **CSS transforms** - Hardware-accelerated animations
- **Conditional rendering** - Only renders needed components
- **Media queries** - Native CSS, very performant
- **No layout shift** - Mobile header height is fixed

## Browser Support

Works on all modern browsers:

- Chrome/Edge 90+
- Safari 14+
- Firefox 88+
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 90+)

---

**Implementation Date:** 2 October 2025 **Status:** ✅ Foundation Complete -
Ready for page-by-page optimization
