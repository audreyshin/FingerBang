interface LiveBarProps {
  value: number
}

export function LiveBar({ value }: LiveBarProps) {
  const clamped = Math.max(-100, Math.min(100, value))
  const magnitude = Math.abs(clamped)
  const directionClass = clamped < 0 ? 'negative' : clamped > 0 ? 'positive' : 'neutral'

  return (
    <div className={`live-bar-wrapper live-bar-bidirectional ${directionClass}`}>
      <div className="live-bar-centerline" />
      {clamped < 0 ? <div className="live-bar-fill left" style={{ width: `${magnitude / 2}%` }} /> : null}
      {clamped > 0 ? <div className="live-bar-fill right" style={{ width: `${magnitude / 2}%` }} /> : null}
      <span className="live-bar-label">{clamped > 0 ? `+${clamped.toFixed(0)}` : clamped.toFixed(0)}</span>
    </div>
  )
}
