import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Font family definitions
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-noto-serif)", "var(--font-playfair)", "Georgia", "serif"],
        mono: ["var(--font-roboto-mono)", "monospace"],
        // Individual font families
        inter: ["var(--font-inter)", "system-ui", "sans-serif"],
        playfair: ["var(--font-playfair)", "Georgia", "serif"],
        "noto-serif": ["var(--font-noto-serif)", "Georgia", "serif"],
        "roboto-mono": ["var(--font-roboto-mono)", "monospace"],
      },
      fontWeight: {
        thin: '100',
        extralight: '200',
        light: '300',
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
        extrabold: '800',
        black: '900',
      },
    },
  },
  plugins: [],
};

export default config;
