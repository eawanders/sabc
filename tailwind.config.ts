import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/hooks/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
    "./src/pages/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: {
        lg: "1024px",
        xl: "1200px",
        "2xl": "1200px",
      },
    },
    extend: {
      flexBasis: {
        drawer: "var(--drawer-width)",
      },
      colors: {
        brand: "var(--color-brand)",
        "brand-foreground": "var(--color-brand-foreground)",
        accent: "var(--color-accent)",

        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-muted": "var(--color-surface-muted)",

        foreground: "var(--color-foreground)",
        heading: "var(--color-heading)",
        muted: "var(--color-muted)",
        border: "var(--color-border)",

        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        info: "var(--color-info)",

        "success-soft": "var(--color-success-soft)",
        "warning-soft": "var(--color-warning-soft)",
        "danger-soft": "var(--color-danger-soft)",
        "info-soft": "var(--color-info-soft)",

        available: "var(--color-available)",
        maybe: "var(--color-maybe)",
        unavailable: "var(--color-unavailable)",

        "event-water": "var(--color-event-water-bg)",
        "event-erg": "var(--color-event-erg-bg)",
        "provisional-outline": "var(--color-provisional-outline)",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        DEFAULT: "var(--radius-md)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        full: "var(--radius-pill)",
      },
      boxShadow: {
        sm: "var(--shadow-sm)",
        DEFAULT: "var(--shadow-md)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
      },
      fontFamily: {
        sans: ["var(--font-gilroy)", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
        gilroy: ["var(--font-gilroy)", "system-ui", "sans-serif"],
      },
      transitionDuration: {
        fast: "var(--motion-fast)",
        base: "var(--motion-base)",
        slow: "var(--motion-slow)",
      },
      transitionTimingFunction: {
        brand: "var(--motion-ease)",
      },
      lineHeight: {
        base: "1.6",
      },
      maxWidth: {
        container: "var(--container-max)",
      },
      width: {
        drawer: "var(--drawer-width)",
      },
      spacing: {
        drawer: "var(--drawer-width)",
      },
    },
  },
  plugins: [],
};

export default config;