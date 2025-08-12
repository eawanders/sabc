// src/components/ui/Button.tsx
import React, { forwardRef } from 'react';
import { SpacingProps, getSpacingStyles, removeSpacingProps } from '@/lib/spacing';
import { cn } from '@/lib/classnames';

export interface ButtonProps extends SpacingProps {
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  [key: string]: any;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({
  className,
  style,
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  type = 'button',
  onClick,
  ...props
}, ref) => {
  const spacingStyles = getSpacingStyles(props);
  const cleanProps = removeSpacingProps(props);

  const variantClasses = {
    primary: 'bg-brand text-brand-foreground hover:bg-brand/90 border-brand',
    secondary: 'bg-accent text-heading hover:bg-accent/80 border-accent',
    outline: 'bg-transparent text-heading hover:bg-accent/40 border-border',
    ghost: 'bg-transparent text-heading hover:bg-accent/40 border-transparent',
  };

  const sizeClasses = {
    sm: 'text-sm font-medium',
    md: 'text-base font-medium',
    lg: 'text-lg font-medium',
  };

  // Default padding for buttons if not specified
  const defaultPadding = {
    sm: { px: 3, py: 2 },
    md: { px: 4, py: 2 },
    lg: { px: 6, py: 3 },
  };

  // Only apply default padding if no padding props are provided
  const hasCustomPadding = Object.keys(props).some(key =>
    ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl'].includes(key)
  );

  const finalSpacingStyles = hasCustomPadding
    ? spacingStyles
    : { ...getSpacingStyles(defaultPadding[size as keyof typeof defaultPadding]), ...spacingStyles };

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center rounded-token border transition-colors duration-fast ease-brand',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant as keyof typeof variantClasses],
        sizeClasses[size as keyof typeof sizeClasses],
        className
      )}
      style={{
        ...finalSpacingStyles,
        ...style,
      }}
      {...cleanProps}
    >
      {children}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;