import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabaseClient'

import Sidebar              from './components/Sidebar'
import Header               from './components/Header'
import RoomStatusCard       from './components/RoomStatusCard'
import AlertPanel           from './components/AlertPanel'
import StatsBar             from './components/StatsBar'
import DoorLogTable         from './components/DoorLogTable'
import LockerLogTable       from './components/LockerLogTable'
import CustomerManagement   from './components/CustomerManagement'
import AccessHistory        from './components/AccessHistory'

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [doorLogs,   setDoorLogs]   = useState([])
  const [lockerLogs, setLockerLogs] = useState([])
  const [loading,    setLoading]    = useState(true)

  // ─── Fetch: view_log_pintu ────────────────────────────────────
  const fetchDoorLogs = useCallback(async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('view_log_pintu')
        .select('id, waktu_akses, tipe_akses, is_anomali, url_foto, nama, rfid_uid')
        .order('waktu_akses', { ascending: false })
        .limit(50)
      if (!error && data) setDoorLogs(data)
    } catch (e) { console.error('fetchDoorLogs:', e) }
  }, [])

  // ─── Fetch: view_log_loker ────────────────────────────────────
  const fetchLockerLogs = useCallback(async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase
        .from('view_log_loker')
        .select('id, waktu_akses, status_akses, nama_pengakses, nomor_loker')
        .order('waktu_akses', { ascending: false })
        .limit(50)
      if (!error && data) setLockerLogs(data)
    } catch (e) { console.error('fetchLockerLogs:', e) }
  }, [])

  // ─── Initial Load ─────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchDoorLogs(), fetchLockerLogs()])
      setLoading(false)
    }
    init()
  }, [fetchDoorLogs, fetchLockerLogs])

  // ─── Realtime Subscriptions ───────────────────────────────────
  useEffect(() => {
    if (!supabase) return
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'log_pintu' },  () => fetchDoorLogs())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'log_loker' }, () => fetchLockerLogs())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchDoorLogs, fetchLockerLogs])

  const latestPintu = doorLogs[0]   ?? null
  const latestLoker = lockerLogs[0] ?? null

  // ─── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.25s ease' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '56px', height: '56px', margin: '0 auto 16px',
            borderRadius: '14px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 28px rgba(59,130,246,0.35)',
            animation: 'pulse-icon 1.5s ease-in-out infinite',
          }}>
            <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '28px' }}>lock_open</span>
          </div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>Memuat Dashboard...</p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '5px', marginTop: '12px' }}>
            {[0, 150, 300].map((d) => (
              <span key={d} style={{
                width: '7px', height: '7px', borderRadius: '50%', background: '#3b82f6',
                display: 'inline-block',
                animation: `bounce-dot 1s ease-in-out ${d}ms infinite`,
              }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ─── Main Layout ──────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', width: '100%', minHeight: '100vh', background: 'var(--bg-body)', transition: 'background 0.25s ease' }}>
      {/* Fixed Sidebar */}
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="sidebar-spacer" />

      {/* Main Column */}
      <div className="main-wrapper">
        {/* Sticky Top Bar */}
        <div className="top-bar">
          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--topbar-title)' }}>SmartSafe IoT</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button className="topbar-btn" title="Notifikasi">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>notifications</span>
            </button>
            <button className="topbar-btn" title="Pengaturan">
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>settings</span>
            </button>
            <div style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, color: 'white',
              marginLeft: '4px', cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(59,130,246,0.3)',
            }}>
              A
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main style={{ flex: 1, padding: '28px 28px 40px' }}>
          {activePage === 'customers' ? (
            <CustomerManagement />
          ) : activePage === 'history' ? (
            <AccessHistory />
          ) : (
            <>
              <Header />
              <RoomStatusCard latestPintu={latestPintu} />
              <AlertPanel     latestPintu={latestPintu} latestLoker={latestLoker} />
              <StatsBar       doorLogs={doorLogs}        lockerLogs={lockerLogs} />
              <div className="log-grid">
                <DoorLogTable   logs={doorLogs} />
                <LockerLogTable logs={lockerLogs} />
              </div>
            </>
          )}
          <footer style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid var(--border-footer)', textAlign: 'center' }}>
            <p style={{ fontSize: '12.5px', color: 'var(--footer-text)' }}>
              Smart Safe Deposit Box © {new Date().getFullYear()} —{' '}
              Real-time <span style={{ color: '#3b82f6', fontWeight: 600 }}>IoT Monitoring System</span>
            </p>
          </footer>
        </main>
      </div>
    </div>
  )
}
