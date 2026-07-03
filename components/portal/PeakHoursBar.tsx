type Props = {
  hourlyBreakdown: number[]  // 24 elements, index = hour (0–23)
}

export function PeakHoursBar({ hourlyBreakdown }: Props) {
  const max      = Math.max(...hourlyBreakdown, 1)
  const peakHour = hourlyBreakdown.indexOf(Math.max(...hourlyBreakdown))
  const hasCalls = hourlyBreakdown.some(v => v > 0)

  function fmt(h: number) {
    if (h === 0 || h === 24) return '12a'
    if (h === 12) return '12p'
    return h < 12 ? `${h}a` : `${h - 12}p`
  }

  return (
    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-subtle)] p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">Peak Call Hours</h3>
        <span className="text-[10px] text-[var(--text-muted)] font-mono">last 30 days</span>
      </div>

      {!hasCalls ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">
          No call data yet — check back after your first week active.
        </p>
      ) : (
        <>
          {/* Bar chart */}
          <div className="flex items-end gap-px" style={{ height: 40 }}>
            {hourlyBreakdown.map((count, h) => {
              const pct    = max > 0 ? (count / max) * 100 : 0
              const isPeak = h === peakHour && count > 0
              return (
                <div
                  key={h}
                  className="flex-1 rounded-sm transition-all"
                  style={{
                    height:     `${Math.max(pct, count > 0 ? 8 : 3)}%`,
                    background: isPeak
                      ? '#D4AF37'
                      : count > 0
                        ? 'rgba(212,175,55,0.28)'
                        : 'rgba(255,255,255,0.05)',
                  }}
                  title={`${fmt(h)}: ${count} call${count !== 1 ? 's' : ''}`}
                />
              )
            })}
          </div>

          {/* X-axis labels */}
          <div className="flex justify-between mt-1.5">
            {[0, 6, 12, 18, 23].map(h => (
              <span key={h} className="text-[9px] font-mono text-[var(--text-muted)]">{fmt(h)}</span>
            ))}
          </div>

          {/* Peak annotation */}
          <p className="text-[11px] text-[var(--text-muted)] mt-2">
            Peak:{' '}
            <span className="font-semibold" style={{ color: '#D4AF37' }}>
              {fmt(peakHour)}
            </span>
            {' '}· {hourlyBreakdown[peakHour]} call{hourlyBreakdown[peakHour] !== 1 ? 's' : ''}
          </p>
        </>
      )}
    </div>
  )
}
