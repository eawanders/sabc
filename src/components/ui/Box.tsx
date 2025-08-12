// src/components/ui/Box.tsx
import React, { forwardRef } from 'react';
import { SpacingProps, getSpacingStyles, removeSpacingProps } from '@/lib/spacing';
import { cn } from '@/lib/classnames';

export interface BoxProps extends SpacingProps {
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  [key: string]: any; // Allow other HTML attributes
}

export const Box = forwardRef<HTMLElement, BoxProps>(({
  as = 'div',
  className,
  style,
  children,
  ...props
}, ref) => {
  const Component = as as any;
  const spacingStyles = getSpacingStyles(props);
  const cleanProps = removeSpacingProps(props);

  return (
    <Component
      ref={ref}
      className={cn(className)}
      style={{
        ...spacingStyles,
        ...style,
      }}
      {...cleanProps}
    >
      {children}
    </Component>
  );
});

Box.displayName = 'Box';

export default Box;
