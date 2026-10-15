interface SkeletonCardProps {
  rows?: number
  className?: string
}

export function SkeletonCard({ rows = 3, className = '' }: SkeletonCardProps) {
  return (
    <div
      className={`skeleton-card ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="加载中"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="skeleton"
          style={{ width: index === 0 ? '42%' : index === rows - 1 ? '68%' : '100%' }}
        />
      ))}
    </div>
  )
}
