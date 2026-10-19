// components/Spinner.jsx - Interior Design System Loading Indicator
import { LoaderCircle } from 'lucide-react'

export default function Spinner({ size = 'md', className = '' }) {
  const sizeMap = {
    sm: 16,
    md: 22,
    lg: 32,
  }
  const pixelSize = typeof size === 'number' ? size : (sizeMap[size] || 22)

  return (
    <LoaderCircle
      size={pixelSize}
      strokeWidth={2}
      className={`animate-spin text-foreground shrink-0 ${className}`}
      aria-hidden="true"
    />
  )
}
