// src/components/ui/Card.tsx
import React, { forwardRef } from 'react';
import { SpacingProps, getSpacingStyles, removeSpacingProps } from '@/lib/spacing';
import { cn } from '@/lib/classnames';

export interface CardProps extends SpacingProps, React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(({
  className,
  style,
  children,
  variant = 'default',
  ...props
}, ref) => {
  const spacingStyles = getSpacingStyles(props);
  const cleanProps = removeSpacingProps(props);

  const variantClasses = {
    default: 'bg-surface border border-border',
    outlined: 'bg-transparent border border-border',
    elevated: 'bg-surface shadow-md border-0',
  };

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-token',
        variantClasses[variant as keyof typeof variantClasses],
        className
      )}
      style={{
        ...spacingStyles,
        ...style,
      }}
      {...cleanProps}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

export default Card;