import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

export function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`empty ${className}`.trim()}>
      {icon}
      <div className="empty__title">{title}</div>
      {description ? <div className="empty__desc">{description}</div> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  )
}
