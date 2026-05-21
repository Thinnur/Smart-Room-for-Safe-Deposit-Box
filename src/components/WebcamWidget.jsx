import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function WebcamWidget() {
  const [collapsed, setCollapsed] = useState(false)

  const sendCommand = useCallback(async (type) => {
    if (!supabase) return
    const { error } = await supabase.from('commands').insert({ type, status: 'pending' })
    if (error) console.error('sendCommand:', error)
  }, [])

  return (
    <div className={`webcam-widget${collapsed ? ' webcam-widget--collapsed' : ''}`}>
      {/* Header */}
      <div className="webcam-widget__header" onClick={() => setCollapsed((c) => !c)}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>settings_remote</span>
        <span className="webcam-widget__title">Panel Kontrol</span>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', marginLeft: 'auto' }}>
          {collapsed ? 'expand_less' : 'expand_more'}
        </span>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="webcam-widget__body">
          {/* Camera info + link */}
          <div style={{
            padding: '8px 10px',
            background: 'rgba(59,130,246,0.08)',
            borderRadius: '8px',
            marginBottom: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
              Kamera dijalankan di HP Android
            </p>
            <a
              href="/#/camera"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12px',
                fontWeight: 600,
                color: '#3b82f6',
                textDecoration: 'none',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>open_in_new</span>
              Buka Halaman Kamera
            </a>
          </div>

          {/* Status label */}
          <div className="webcam-widget__status">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>settings_remote</span>
            Panel Kontrol
          </div>

          {/* Control buttons */}
          <div className="webcam-widget__controls">
            <button
              className="webcam-widget__btn webcam-widget__btn--danger"
              onClick={() => sendCommand('LOCK_ALL')}
              title="Kunci semua loker dan pintu"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>lock</span>
              Lock All
            </button>
            <button
              className="webcam-widget__btn webcam-widget__btn--warning"
              onClick={() => sendCommand('RESET_ALARM')}
              title="Reset alarm"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>notification_important</span>
              Reset Alarm
            </button>
            <button
              className="webcam-widget__btn webcam-widget__btn--success"
              onClick={() => sendCommand('UNLOCK_DOOR')}
              title="Buka pintu"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>lock_open</span>
              Unlock Door
            </button>
            <button
              className="webcam-widget__btn webcam-widget__btn--info"
              onClick={() => sendCommand('REFRESH_CACHE')}
              title="Refresh cache ESP"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>refresh</span>
              Refresh Cache
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
