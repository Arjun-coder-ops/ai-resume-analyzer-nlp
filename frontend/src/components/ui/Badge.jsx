import * as React from 'react'
import { cn } from '../../lib/utils'

/**
 * Interior Badge — A 6px-radius chip, strictly never a pill.
 * Follows Interior's nested radii scale: 0.375rem (6px).
 * Counts and IDs inside a chip support tabular-nums.
 */
const badgeVariants = {
  default: 'bg-primary text-primary-foreground',
  secondary: 'bg-secondary text-secondary-foreground border border-border/70 shadow-row',
  outline: 'border border-border bg-card text-foreground',
  accent: 'bg-accent text-accent-foreground border border-accent-foreground/20',
  destructive: 'bg-destructive/10 text-destructive border border-destructive/20',
  success: 'bg-success/10 text-success border border-success/25',
  warning: 'bg-warning/15 text-warning border border-warning/25',
  muted: 'bg-muted text-muted-foreground border border-border/50',
}

function Badge({ className, variant = 'default', children, ...props }) {
  const variantClass = badgeVariants[variant] || badgeVariants.default

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-badge px-2 py-0.5',
        'text-[0.7188rem] font-medium leading-[1rem] whitespace-nowrap',
        'transition-colors duration-150',
        '[&_svg]:size-3 [&_svg]:shrink-0',
        variantClass,
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
