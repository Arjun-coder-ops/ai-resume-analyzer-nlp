import * as React from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Interior Button — A tactile control with 9px nested radius (0.5625rem).
 * Strictly never a pill.
 * Primary buttons sit as deep ink with a bottom cap shadow and inverted focus ring.
 */
const buttonVariants = {
  primary:
    'bg-primary text-primary-foreground shadow-cap hover:opacity-92 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-[var(--ring-inverted)]',
  secondary:
    'bg-secondary text-secondary-foreground border border-border/80 shadow-row hover:bg-muted active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring',
  outline:
    'border border-border bg-card text-foreground shadow-row hover:bg-secondary/70 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring',
  ghost:
    'text-foreground hover:bg-secondary/80 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring',
  destructive:
    'bg-destructive text-destructive-foreground shadow-cap hover:opacity-92 active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-destructive',
  link:
    'text-accent-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring p-0 h-auto',
}

const buttonSizes = {
  sm: 'h-8 px-2.5 text-xs gap-1.5',
  md: 'h-9 px-3.5 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2.5',
  icon: 'h-9 w-9 p-0 justify-center',
}

const Button = React.forwardRef(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      disabled = false,
      loading = false,
      type = 'button',
      children,
      ...props
    },
    ref
  ) => {
    const variantClass = buttonVariants[variant] || buttonVariants.primary
    const sizeClass = buttonSizes[size] || buttonSizes.md

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-sans font-medium rounded-btn select-none',
          'transition-all duration-150 outline-none',
          'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
          '[&_svg]:size-4 [&_svg]:shrink-0',
          variantClass,
          sizeClass,
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <LoaderCircle
              className="animate-spin h-3.5 w-3.5 shrink-0"
              strokeWidth={2}
              aria-hidden="true"
            />
            <span>{children}</span>
          </span>
        ) : (
          children
        )}
      </button>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants, buttonSizes }
