// src/lib/spacing.ts
import { SPACING } from '@/config/constants';

export type SpacingValue = keyof typeof SPACING | number | string;

export interface SpacingProps {
  // Padding
  p?: SpacingValue;
  px?: SpacingValue;
  py?: SpacingValue;
  pt?: SpacingValue;
  pr?: SpacingValue;
  pb?: SpacingValue;
  pl?: SpacingValue;

  // Margin
  m?: SpacingValue;
  mx?: SpacingValue;
  my?: SpacingValue;
  mt?: SpacingValue;
  mr?: SpacingValue;
  mb?: SpacingValue;
  ml?: SpacingValue;
}

/**
 * Converts a spacing value to a CSS value
 */
function getSpacingValue(value: SpacingValue): string {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return `${value}px`;
  }

  // Use the spacing scale
  const spacingPx = SPACING[value as keyof typeof SPACING];
  return spacingPx !== undefined ? `${spacingPx}px` : '0px';
}

/**
 * Generates spacing styles from spacing props
 */
export function getSpacingStyles(props: SpacingProps): React.CSSProperties {
  const styles: React.CSSProperties = {};

  // Padding
  if (props.p !== undefined) {
    styles.padding = getSpacingValue(props.p);
  } else {
    if (props.px !== undefined) {
      styles.paddingLeft = getSpacingValue(props.px);
      styles.paddingRight = getSpacingValue(props.px);
    }
    if (props.py !== undefined) {
      styles.paddingTop = getSpacingValue(props.py);
      styles.paddingBottom = getSpacingValue(props.py);
    }
    if (props.pt !== undefined) styles.paddingTop = getSpacingValue(props.pt);
    if (props.pr !== undefined) styles.paddingRight = getSpacingValue(props.pr);
    if (props.pb !== undefined) styles.paddingBottom = getSpacingValue(props.pb);
    if (props.pl !== undefined) styles.paddingLeft = getSpacingValue(props.pl);
  }

  // Margin
  if (props.m !== undefined) {
    styles.margin = getSpacingValue(props.m);
  } else {
    if (props.mx !== undefined) {
      styles.marginLeft = getSpacingValue(props.mx);
      styles.marginRight = getSpacingValue(props.mx);
    }
    if (props.my !== undefined) {
      styles.marginTop = getSpacingValue(props.my);
      styles.marginBottom = getSpacingValue(props.my);
    }
    if (props.mt !== undefined) styles.marginTop = getSpacingValue(props.mt);
    if (props.mr !== undefined) styles.marginRight = getSpacingValue(props.mr);
    if (props.mb !== undefined) styles.marginBottom = getSpacingValue(props.mb);
    if (props.ml !== undefined) styles.marginLeft = getSpacingValue(props.ml);
  }

  return styles;
}

/**
 * Removes spacing props from an object, useful for cleaning props before passing to DOM elements
 */
export function removeSpacingProps<T extends SpacingProps>(
  props: T
): Omit<T, keyof SpacingProps> {
  const {
    p, px, py, pt, pr, pb, pl,
    m, mx, my, mt, mr, mb, ml,
    ...rest
  } = props;
  return rest;
}

/**
 * Hook for using spacing in components
 */
export function useSpacing(props: SpacingProps) {
  return {
    spacingStyles: getSpacingStyles(props),
    cleanProps: removeSpacingProps(props),
  };
}
