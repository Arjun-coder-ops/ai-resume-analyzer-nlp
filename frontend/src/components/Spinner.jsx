// components/Spinner.jsx

export default function Spinner({ size = 'md', color = 'volt' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' }
  const colors = { volt: 'border-volt-400', white: 'border-white', muted: 'border-ink-400' }
  return (
    <div className={`${sizes[size]} rounded-full border-2 ${colors[color]} border-t-transparent animate-spin`} />
  )
}
