import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface FilterPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  children: ReactNode
}

export function FilterPill({ active = false, className = '', children, ...props }: FilterPillProps) {
  return (
    <button
      type="button"
      className={`filter ${active ? 'filter--active' : ''} ${className}`.trim()}
      aria-pressed={active}
      {...props}
    >
      {children}
    </button>
  )
}
