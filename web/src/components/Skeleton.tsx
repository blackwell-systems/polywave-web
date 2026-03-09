import React from 'react'

export function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded bg-muted ${className}`} style={style} />
}

export function SidebarSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2 pt-3">
      {[80, 65, 90, 55, 75].map((w, i) => (
        <Skeleton key={i} className="h-7" style={{ width: `${w}%` }} />
      ))}
    </div>
  )
}
