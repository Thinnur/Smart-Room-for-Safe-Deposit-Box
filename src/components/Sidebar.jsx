export default function Sidebar({ activePage = 'dashboard' }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard',     icon: 'dashboard' },
    { id: 'locker',    label: 'Locker Access', icon: 'lock' },
    { id: 'door',      label: 'Door Logs',     icon: 'sensor_door' },
    { id: 'health',    label: 'System Health', icon: 'health_and_safety' },
  ]

  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '18px' }}>lock_open</span>
        </div>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>Smart Safe</p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>IoT Monitoring</p>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {navItems.map((item) => (
          <a key={item.id} href="#" className={`nav-item ${activePage === item.id ? 'active' : ''}`}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>

      {/* System Status */}
      <div style={{ padding: '14px 12px', borderTop: '1px solid var(--divider)' }}>
        <div style={{
          padding: '12px 14px',
          background: 'var(--bg-status)',
          borderRadius: '10px',
          border: '1px solid var(--border-card)',
        }}>
          <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '7px' }}>
            System Status
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="live-dot" />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>All systems normal</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
