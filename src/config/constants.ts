/* ------------------------------
   Design / Layout Constants
   ------------------------------ */

export const LAYOUT = {
  CONTAINER_MAX: 1200,                 // px
  SIDEBAR_WIDTH: 240,                  // px
  SIDEBAR_WIDTH_COLLAPSED: 72,         // px
  DRAWER_WIDTH: 380,                   // px
} as const;

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  pill: 9999,
} as const;

export const SHADOW = {
  sm: "0 3px 18px 0 rgba(174,174,174,0.16)",
  md: "0 9px 44px 0 rgba(174,174,174,0.20)",
  lg: "0 16px 64px 0 rgba(174,174,174,0.24)",
} as const;

export const SPACING = {
  // Base spacing scale (in px)
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
  36: 144,
  40: 160,
  44: 176,
  48: 192,
  52: 208,
  56: 224,
  60: 240,
  64: 256,
  72: 288,
  80: 320,
  96: 384,
} as const;

export const MOTION = {
  FAST: 120,
  BASE: 200,
  SLOW: 280,
  EASE: "ease-in-out",
} as const;

/* Calendar defaults */
export const CALENDAR = {
  DAYS_VISIBLE: 7,                     // Mon–Sun
  SHOW_TIME_AXIS: false,
  EVENT_RADIUS: "var(--radius-md)",
  PROVISIONAL_OUTLINE: "var(--color-provisional-outline)",
  EVENT_TYPE_BG: {
    water: "var(--color-event-water-bg)",
    erg: "var(--color-event-erg-bg)",
  },
} as const;

/* Semantic aliases for availability */
export const AVAILABILITY = {
  AVAILABLE: "var(--color-available)",
  MAYBE: "var(--color-maybe)",
  UNAVAILABLE: "var(--color-unavailable)",
} as const;

/* Typography (for convenience) */
export const TYPOGRAPHY = {
  BASE_SIZE_PX: 14,
  BASE_LINE_HEIGHT: 1.6,
  H1: { size: "36px", lineHeight: "44px", weight: 800 },
  H2: { size: "28px", lineHeight: "36px", weight: 800 },
  H3: { size: "22px", lineHeight: "30px", weight: 800 },
} as const;