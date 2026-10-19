import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * Interior Input — A recessed well control with 10px radius (0.625rem).
 * Surface is the subtle secondary well with an inset well shadow.
 * Spent focus accent blue rings only on focus.
 */
const Input = React.forwardRef(
  ({ className, type = 'text', disabled, error, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        disabled={disabled}
        aria-invalid={Boolean(error) || undefined}
        className={cn(
          'flex h-10 w-full rounded-input border border-border bg-secondary px-3.5 py-2 text-sm text-foreground shadow-well',
          'placeholder:text-muted-foreground font-sans',
          'transition-all duration-150 outline-none',
          'focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:shadow-focus-lift',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted',
          error && 'border-destructive focus-visible:ring-destructive/40',
          className
        )}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
