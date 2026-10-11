import type { ReactNode } from 'react'

export type PillTone = 'active' | 'paused' | 'archived' | 'stream' | 'aborted' | 'info'
export type PillSize = 'md' | 'sm'

const toneClass: Record<PillTone, string> = {
  active: 'pill--active',
  paused: 'pill--paused',
  archived: 'pill--archived',
  stream: 'pill--stream',
  aborted: 'pill--aborted',
  info: 'pill--info',
}

interface PillProps {
  tone?: PillTone
  size?: PillSize
  className?: string
  children: ReactNode
}

export function Pill({ tone = 'info', size = 'md', className = '', children }: PillProps) {
  const sizeClass = size === 'sm' ? 'pill--sm' : ''

  return (
    <span className={`pill ${toneClass[tone]} ${sizeClass} ${className}`.trim()}>
      {children}
    </span>
  )
}
