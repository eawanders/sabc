/**
 * Text style utility functions for consistent text styling throughout the application
 * This allows for programmatic styling of text without using components
 */

type FontWeight =
  | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
  | 'thin' | 'extralight' | 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';

type FontFamily = 'inter' | 'noto-serif' | 'playfair' | 'roboto-mono';

type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';

interface TextStyleOptions {
  font?: FontFamily;
  weight?: FontWeight;
  size?: TextSize;
  color?: string;
  tracking?: 'tighter' | 'tight' | 'normal' | 'wide' | 'wider' | 'widest';
}

/**
 * Generate inline styles for text elements
 * @param options Styling options for the text
 * @returns React inline style object
 */
export const getTextStyle = (options: TextStyleOptions): React.CSSProperties => {
  const { font, weight, size, color, tracking } = options;

  // Map font families to CSS variables
  const fontMap: Record<FontFamily, string> = {
    'inter': 'var(--font-inter), system-ui, sans-serif',
    'noto-serif': 'var(--font-noto-serif), Georgia, serif',
    'playfair': 'var(--font-playfair), Georgia, serif',
    'roboto-mono': 'var(--font-roboto-mono), monospace',
  };

  // Map text sizes to rem values
  const sizeMap: Record<TextSize, string> = {
    'xs': '0.75rem',
    'sm': '0.875rem',
    'base': '1rem',
    'lg': '1.125rem',
    'xl': '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '4rem',
  };

  // Map tracking (letter-spacing) values
  const trackingMap: Record<NonNullable<TextStyleOptions['tracking']>, string> = {
    'tighter': '-0.05em',
    'tight': '-0.025em',
    'normal': '0',
    'wide': '0.025em',
    'wider': '0.05em',
    'widest': '0.1em',
  };

  return {
    fontFamily: font ? fontMap[font] : undefined,
    fontWeight: weight ? weight : undefined,
    fontSize: size ? sizeMap[size] : undefined,
    color: color,
    letterSpacing: tracking ? trackingMap[tracking] : undefined,
  };
};

/**
 * Generate tailwind class names for text styling
 * @param options Styling options for the text
 * @returns String of Tailwind classes
 */
export const getTextClasses = (options: TextStyleOptions): string => {
  const { font, weight, size, color, tracking } = options;

  const classes = [
    // Font family
    font && `font-${font}`,

    // Font weight
    weight && `font-${weight}`,

    // Font size
    size && `text-${size}`,

    // Text color
    color && `text-${color}`,

    // Letter spacing
    tracking && `tracking-${tracking}`,
  ].filter(Boolean);

  return classes.join(' ');
};
