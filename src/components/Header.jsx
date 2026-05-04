import { useState, useEffect } from 'react'
import { useTheme } from '../context/ThemeContext'

export default function Header() {
  const [time, setTime] = useState(new Date())
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const hh = time.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  const dd = time.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const isDark = theme === 'dark'

  return (
    <div className="animate-fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
      {/* Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '14px', flexShrink: 0,
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 20px rgba(59,130,246,0.35)',
        }}>
          <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '24px' }}>lock_open</span>
        </div>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            Smart Safe Deposit Box
          </h1>
          <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 500, marginTop: '2px' }}>
            Admin Panel — Monitoring Dashboard
          </p>
        </div>
      </div>

      {/* Right: Clock + Theme Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {/* Live Clock Card */}
        <div className="glass-card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginBottom: '2px' }}>
              <span className="live-dot" />
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', lineHeight: 1 }}>
              {hh}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{dd}</div>
          </div>
        </div>

        {/* Theme Toggle */}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          <span className="material-symbols-outlined icon-enter" key={theme} style={{ fontSize: '18px' }}>
            {isDark ? 'wb_sunny' : 'dark_mode'}
          </span>
        </button>
      </div>
    </div>
  )
}
