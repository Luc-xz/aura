import type { ReactNode } from 'react'
import type { PillTone } from './pill'

export type StatCardTone = Extract<
  PillTone,
  'active' | 'paused' | 'archived' | 'stream' | 'aborted' | 'info'
>

const toneClass: Record<StatCardTone, string> = {
  active: 'text-success',
  paused: 'text-warning',
  archived: 'text-neutral',
  stream: 'text-primary',
  aborted: 'text-error',
  info: 'text-primary',
}

interface StatCardProps {
  label: string
  value: number | string
  tone?: StatCardTone
  icon?: ReactNode
  className?: string
}

export function StatCard({ label, value, tone = 'info', icon, className = '' }: StatCardProps) {
  return (
    <article className={`stat-card ${toneClass[tone]} ${className}`.trim()}>
      <div className="row-between">
        <span className="stat-card__value">{value}</span>
        {icon}
      </div>
      <span className="stat-card__label">{label}</span>
    </article>
  )
}
