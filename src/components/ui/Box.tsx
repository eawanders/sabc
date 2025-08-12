// src/components/ui/Box.tsx
import React, { forwardRef } from 'react';
import { SpacingProps, getSpacingStyles, removeSpacingProps } from '@/lib/spacing';
import { cn } from '@/lib/classnames';

export interface BoxProps extends SpacingProps, React.HTMLAttributes<HTMLElement> {
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export const Box = forwardRef<HTMLElement, BoxProps>(({
  as = 'div',
  className,
  style,
  children,
  ...props
}, ref) => {
  const Component = as;
  const spacingStyles = getSpacingStyles(props);
  const cleanProps = removeSpacingProps(props);

  return React.createElement(
    Component,
    {
      ref,
      className: cn(className),
      style: {
        ...spacingStyles,
        ...style,
      },
      ...cleanProps,
    },
    children
  );
});

Box.displayName = 'Box';

export default Box;
