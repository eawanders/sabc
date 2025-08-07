import { Inter, Playfair_Display, Roboto_Mono, Noto_Serif } from 'next/font/google';

// Inter font configuration
export const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'], // ← full range
  variable: '--font-inter',
  fallback: ['system-ui', 'sans-serif'],
});

// Playfair Display font configuration
export const playfair = Playfair_Display({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-playfair',
});

// Roboto Mono font configuration
export const robotoMono = Roboto_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto-mono',
});

// Noto Serif font configuration
export const notoSerif = Noto_Serif({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-serif',
});

// Export font variables for use in Tailwind config
export const fontVariables = [
  inter.variable,
  playfair.variable,
  robotoMono.variable,
  notoSerif.variable,
];
