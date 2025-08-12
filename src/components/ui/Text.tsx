import React, { ReactNode } from 'react';
import { SpacingProps, getSpacingStyles, removeSpacingProps } from '@/lib/spacing';

type FontFamily = 'inter' | 'noto-serif' | 'playfair' | 'roboto-mono';
type FontWeight = 'thin' | 'extralight' | 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';
type TextColor = 'default' | 'primary' | 'secondary' | 'light' | 'dark' | 'white' | 'black' | 'gray';
type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';

interface TextProps extends SpacingProps {
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'p' | 'span' | 'div' | 'li';
  font?: FontFamily;
  weight?: FontWeight;
  size?: TextSize;
  color?: TextColor;
  tracking?: 'tighter' | 'tight' | 'normal' | 'wide' | 'wider' | 'widest';
  className?: string;
  style?: React.CSSProperties;
}

const getFontFamily = (font: FontFamily) => {
  switch (font) {
    case 'inter': return 'font-inter';
    case 'noto-serif': return 'font-noto-serif';
    case 'playfair': return 'font-playfair';
    case 'roboto-mono': return 'font-roboto-mono';
    default: return 'font-inter';
  }
};

const getFontWeight = (weight: FontWeight): number => {
  switch (weight) {
    case 'thin': return 100;
    case 'extralight': return 200;
    case 'light': return 300;
    case 'normal': return 400;
    case 'medium': return 500;
    case 'semibold': return 600;
    case 'bold': return 700;
    case 'extrabold': return 800;
    case 'black': return 900;
    default: return 400;
  }
};

const getTextColor = (color: TextColor) => {
  switch (color) {
    case 'default': return 'text-gray-900';
    case 'primary': return 'text-blue-600';
    case 'secondary': return 'text-purple-600';
    case 'light': return 'text-gray-400';
    case 'dark': return 'text-gray-800';
    case 'white': return 'text-white';
    case 'black': return 'text-black';
    case 'gray': return 'text-gray-600';
    default: return 'text-gray-900';
  }
};

const getTextSize = (size: TextSize) => {
  switch (size) {
    case 'xs': return 'text-xs';
    case 'sm': return 'text-sm';
    case 'base': return 'text-base';
    case 'lg': return 'text-lg';
    case 'xl': return 'text-xl';
    case '2xl': return 'text-2xl';
    case '3xl': return 'text-3xl';
    case '4xl': return 'text-4xl';
    case '5xl': return 'text-5xl';
    case '6xl': return 'text-6xl';
    default: return 'text-base';
  }
};

const getTracking = (tracking: TextProps['tracking']) => {
  switch (tracking) {
    case 'tighter': return 'tracking-tighter';
    case 'tight': return 'tracking-tight';
    case 'normal': return 'tracking-normal';
    case 'wide': return 'tracking-wide';
    case 'wider': return 'tracking-wider';
    case 'widest': return 'tracking-widest';
    default: return '';
  }
};

export const Text = ({
  children,
  as = 'p',
  font = 'inter',
  weight = 'normal',
  size = 'base',
  color = 'default',
  tracking,
  className = '',
  style,
  ...spacingProps
}: TextProps) => {
  const Element = as;

  // Get the numeric weight value
  const fontWeightValue = getFontWeight(weight);
  const spacingStyles = getSpacingStyles(spacingProps);

  const classes = [
    getFontFamily(font),
    getTextSize(size),
    getTextColor(color),
    tracking ? getTracking(tracking) : '',
    className
  ].join(' ');

  return (
    <Element
      className={classes}
      style={{
        ...spacingStyles,
        ...style,
        fontWeight: fontWeightValue,
        fontVariationSettings: `'wght' ${fontWeightValue}`
      }}
    >
      {children}
    </Element>
  );
};

// Preset variants for common text styles
export const Heading1 = (props: Omit<TextProps, 'as' | 'size'> & { size?: TextSize }) => (
  <Text as="h1" size={props.size || "4xl"} weight="semibold" {...props} />
);

export const Heading2 = (props: Omit<TextProps, 'as' | 'size'> & { size?: TextSize }) => (
  <Text as="h2" size={props.size || "3xl"} weight="semibold" {...props} />
);

export const Heading3 = (props: Omit<TextProps, 'as' | 'size'> & { size?: TextSize }) => (
  <Text as="h3" size={props.size || "2xl"} weight="semibold" {...props} />
);

export const Paragraph = (props: Omit<TextProps, 'as' | 'size'> & { size?: TextSize }) => (
  <Text as="p" size={props.size || "base"} {...props} />
);

export const Caption = (props: Omit<TextProps, 'as' | 'size'> & { size?: TextSize }) => (
  <Text as="span" size={props.size || "sm"} color="light" {...props} />
);
