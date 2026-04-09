interface LiveBarProps {
  value: number
}

export function LiveBar({ value }: LiveBarProps) {
  const clamped = Math.max(0, Math.min(100, value))

  return (
    <div className="live-bar-wrapper">
      <div className="live-bar-fill" style={{ width: `${clamped}%` }} />
      <span className="live-bar-label">{clamped.toFixed(1)}%</span>
    </div>
  )
}
