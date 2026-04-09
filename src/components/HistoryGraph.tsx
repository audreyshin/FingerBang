interface HistoryGraphProps {
  values: number[]
}

export function HistoryGraph({ values }: HistoryGraphProps) {
  if (values.length < 2) {
    return <div className="graph-empty">Waiting for sensor data...</div>
  }

  const width = 600
  const height = 140
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width
    const y = height - (Math.max(0, Math.min(100, value)) / 100) * height
    return `${x},${y}`
  })

  return (
    <svg className="history-graph" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline className="history-graph-line" points={points.join(' ')} />
    </svg>
  )
}
