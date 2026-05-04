export default function StatsBar({ doorLogs, lockerLogs }) {
  const totalDoor      = doorLogs.length
  const totalAnomalies = doorLogs.filter((l) => l.is_anomali).length
  const totalLocker    = lockerLogs.length
  const totalFailed    = lockerLogs.filter((l) => l.status_akses === 'GAGAL').length

  const stats = [
    {
      label: 'Total Akses Pintu', sublabel: 'Pintu', value: totalDoor,
      icon: 'meeting_room', iconColor: '#3b82f6', iconBg: 'rgba(59,130,246,0.1)',
      sublabelColor: 'var(--text-muted)', accent: null,
    },
    {
      label: 'Anomali Pintu', sublabel: 'Alert', value: totalAnomalies,
      icon: 'warning', iconColor: '#ef4444', iconBg: 'rgba(239,68,68,0.1)',
      sublabelColor: '#ef4444', accent: '#ef4444',
    },
    {
      label: 'Total Akses Loker', sublabel: 'Loker', value: totalLocker,
      icon: 'lock', iconColor: '#a855f7', iconBg: 'rgba(168,85,247,0.1)',
      sublabelColor: 'var(--text-muted)', accent: null,
    },
    {
      label: 'Gagal Akses Loker', sublabel: 'Fail', value: totalFailed,
      icon: 'block', iconColor: '#f59e0b', iconBg: 'rgba(245,158,11,0.1)',
      sublabelColor: '#f59e0b', accent: '#f59e0b',
    },
  ]

  return (
    <div className="stats-grid" style={{ marginBottom: '20px' }}>
      {stats.map((s, i) => (
        <div
          key={s.label}
          className="glass-card animate-fade-in"
          style={{
            padding: '18px 20px',
            animationDelay: `${i * 60}ms`,
            borderLeft: s.accent ? `3px solid ${s.accent}` : undefined,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: s.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: s.iconColor, fontSize: '18px' }}>{s.icon}</span>
            </div>
            <span style={{ fontSize: '10.5px', fontWeight: 700, color: s.sublabelColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {s.sublabel}
            </span>
          </div>
          <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {s.value}
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '5px', fontWeight: 500 }}>{s.label}</p>
        </div>
      ))}
    </div>
  )
}
