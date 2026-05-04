import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'

// ─── Utility: Export to CSV ───────────────────────────────────────────────────
function exportToCSV(data, filename) {
  if (!data || data.length === 0) return
  const headers = Object.keys(data[0])
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h] == null ? '' : String(row[h])
        return `"${val.replace(/"/g, '""')}"`
      }).join(',')
    ),
  ]
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Photo Lightbox ───────────────────────────────────────────────────────────
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const handler = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <img src={src} alt="Access photo" onClick={e => e.stopPropagation()} />
    </div>
  )
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
function SkeletonRow({ cols }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <div style={{ height: '14px', borderRadius: '6px', background: 'var(--border-card)', opacity: 0.5 }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ colSpan, icon = 'search_off', msg = 'Tidak ada data ditemukan.' }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ textAlign: 'center', padding: '52px 20px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '44px', color: 'var(--text-subtle)', display: 'block', marginBottom: '10px' }}>{icon}</span>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', margin: 0 }}>{msg}</p>
      </td>
    </tr>
  )
}

// ─── Format datetime ──────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(iso))
}

// ─── Door Log Table ───────────────────────────────────────────────────────────
function DoorTable({ logs, loading, onPhoto }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Nama</th>
            <th>Tipe Akses</th>
            <th>Status</th>
            <th>Foto</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={5} />)
          ) : logs.length === 0 ? (
            <EmptyState colSpan={5} icon="sensor_door" msg="Tidak ada log pintu yang sesuai filter." />
          ) : (
            logs.map(row => {
              const isAnomali = row.is_anomali
              return (
                <tr key={row.id} className={isAnomali ? 'row-danger' : 'row-success'}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', whiteSpace: 'nowrap' }}>{fmtDate(row.waktu_akses)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.nama || '—'}</td>
                  <td>
                    <span className={`badge ${row.tipe_akses === 'RFID' ? 'badge-info' : row.tipe_akses === 'Fingerprint' ? 'badge-purple' : 'badge-warning'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>
                        {row.tipe_akses === 'RFID' ? 'contactless' : row.tipe_akses === 'Fingerprint' ? 'fingerprint' : 'login'}
                      </span>
                      {row.tipe_akses || '—'}
                    </span>
                  </td>
                  <td>
                    {isAnomali
                      ? <span className="badge badge-danger"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>warning</span>Anomali</span>
                      : <span className="badge badge-success"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>Aman</span>
                    }
                  </td>
                  <td>
                    {row.url_foto
                      ? <img src={row.url_foto} alt="foto" className="photo-thumb" onClick={() => onPhoto(row.url_foto)} />
                      : <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>—</span>
                    }
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Locker Log Table ─────────────────────────────────────────────────────────
function LockerTable({ logs, loading }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>Nama Pengakses</th>
            <th>Nomor Loker</th>
            <th>Status Akses</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} cols={4} />)
          ) : logs.length === 0 ? (
            <EmptyState colSpan={4} icon="lock" msg="Tidak ada log brankas yang sesuai filter." />
          ) : (
            logs.map(row => {
              const isFail = row.status_akses && row.status_akses.toLowerCase().includes('gag')
              return (
                <tr key={row.id} className={isFail ? 'row-danger' : 'row-success'}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', whiteSpace: 'nowrap' }}>{fmtDate(row.waktu_akses)}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.nama_pengakses || '—'}</td>
                  <td>
                    <span className="badge badge-info">
                      <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>lock</span>
                      #{row.nomor_loker ?? '—'}
                    </span>
                  </td>
                  <td>
                    {isFail
                      ? <span className="badge badge-danger"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>block</span>{row.status_akses}</span>
                      : <span className="badge badge-success"><span className="material-symbols-outlined" style={{ fontSize: '13px' }}>check_circle</span>{row.status_akses}</span>
                    }
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AccessHistory() {
  const [activeTab, setActiveTab]     = useState('door')
  const [doorLogs, setDoorLogs]       = useState([])
  const [lockerLogs, setLockerLogs]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [dateFrom, setDateFrom]       = useState('')
  const [dateTo, setDateTo]           = useState('')
  const [lightbox, setLightbox]       = useState(null)

  // ── Fetch Door Logs
  const fetchDoor = useCallback(async () => {
    if (!supabase) return
    try {
      let q = supabase
        .from('view_log_pintu')
        .select('id, waktu_akses, tipe_akses, is_anomali, url_foto, nama, rfid_uid')
        .order('waktu_akses', { ascending: false })
        .limit(500)
      if (dateFrom) q = q.gte('waktu_akses', dateFrom)
      if (dateTo)   q = q.lte('waktu_akses', dateTo + 'T23:59:59')
      const { data, error } = await q
      if (!error && data) setDoorLogs(data)
    } catch (e) { console.error('fetchDoor:', e) }
  }, [dateFrom, dateTo])

  // ── Fetch Locker Logs
  const fetchLocker = useCallback(async () => {
    if (!supabase) return
    try {
      let q = supabase
        .from('view_log_loker')
        .select('id, waktu_akses, status_akses, nama_pengakses, nomor_loker')
        .order('waktu_akses', { ascending: false })
        .limit(500)
      if (dateFrom) q = q.gte('waktu_akses', dateFrom)
      if (dateTo)   q = q.lte('waktu_akses', dateTo + 'T23:59:59')
      const { data, error } = await q
      if (!error && data) setLockerLogs(data)
    } catch (e) { console.error('fetchLocker:', e) }
  }, [dateFrom, dateTo])

  // ── Initial + filter-driven fetch
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchDoor(), fetchLocker()])
      setLoading(false)
    }
    load()
  }, [fetchDoor, fetchLocker])

  // ── Client-side search filter
  const filteredDoor = useMemo(() =>
    doorLogs.filter(r => !search || (r.nama ?? '').toLowerCase().includes(search.toLowerCase())),
    [doorLogs, search]
  )
  const filteredLocker = useMemo(() =>
    lockerLogs.filter(r => !search || (r.nama_pengakses ?? '').toLowerCase().includes(search.toLowerCase())),
    [lockerLogs, search]
  )

  const handleExport = () => {
    if (activeTab === 'door') {
      exportToCSV(filteredDoor.map(({ id, waktu_akses, tipe_akses, is_anomali, nama, rfid_uid }) =>
        ({ id, waktu_akses, nama, tipe_akses, status: is_anomali ? 'Anomali' : 'Aman', rfid_uid })
      ), `log_pintu_${Date.now()}.csv`)
    } else {
      exportToCSV(filteredLocker.map(({ id, waktu_akses, nama_pengakses, nomor_loker, status_akses }) =>
        ({ id, waktu_akses, nama_pengakses, nomor_loker, status_akses })
      ), `log_brankas_${Date.now()}.csv`)
    }
  }

  const handleReset = () => { setSearch(''); setDateFrom(''); setDateTo('') }

  const activeCount = activeTab === 'door' ? filteredDoor.length : filteredLocker.length

  // ── Shared input style
  const inputStyle = {
    padding: '8px 12px',
    background: 'var(--bg-body)',
    border: '1px solid var(--border-card)',
    borderRadius: '9px',
    color: 'var(--text-primary)',
    fontSize: '13px',
    outline: 'none',
    fontFamily: 'var(--font-sans)',
  }

  return (
    <div style={{ animation: 'fade-in 0.4s ease-out' }}>
      {/* ── Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>
            Riwayat Akses &amp; Laporan
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Lihat dan ekspor log akses pintu &amp; brankas
          </p>
        </div>
        {/* Export Button */}
        <button
          id="btn-export-csv"
          onClick={handleExport}
          disabled={loading || activeCount === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '10px 18px', borderRadius: '11px', border: 'none',
            background: activeCount === 0 ? 'var(--border-card)' : 'linear-gradient(135deg, #10b981, #059669)',
            color: activeCount === 0 ? 'var(--text-subtle)' : 'white',
            fontSize: '13.5px', fontWeight: 700, cursor: activeCount === 0 ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-sans)',
            boxShadow: activeCount === 0 ? 'none' : '0 4px 16px rgba(16,185,129,0.35)',
            transition: 'opacity 0.2s',
          }}
          onMouseOver={e => { if (activeCount > 0) e.currentTarget.style.opacity = '0.88' }}
          onMouseOut={e => { e.currentTarget.style.opacity = '1' }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
          Export CSV
        </button>
      </div>

      {/* ── Tab Navigation */}
      <div style={{
        display: 'flex', gap: '4px', padding: '4px',
        background: 'var(--bg-card)', border: '1px solid var(--border-card)',
        borderRadius: '12px', marginBottom: '20px', width: 'fit-content',
      }}>
        {[
          { id: 'door',   label: 'Log Pintu',   icon: 'sensor_door', count: filteredDoor.length },
          { id: 'locker', label: 'Log Brankas',  icon: 'lock',        count: filteredLocker.length },
        ].map(tab => (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '8px 18px', borderRadius: '9px', border: 'none',
              background: activeTab === tab.id ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              fontSize: '13.5px', fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', transition: 'all 0.2s ease',
              boxShadow: activeTab === tab.id ? '0 2px 10px rgba(59,130,246,0.35)' : 'none',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>{tab.icon}</span>
            {tab.label}
            {!loading && (
              <span style={{
                padding: '1px 7px', borderRadius: '99px', fontSize: '11px', fontWeight: 700,
                background: activeTab === tab.id ? 'rgba(255,255,255,0.2)' : 'var(--border-card)',
                color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Main Card */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>

        {/* Control Bar */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border-table)',
          display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px' }}>
            <span className="material-symbols-outlined" style={{
              position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)',
              fontSize: '16px', color: 'var(--text-muted)', pointerEvents: 'none',
            }}>search</span>
            <input
              id="input-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={activeTab === 'door' ? 'Cari nama...' : 'Cari nama pengakses...'}
              style={{ ...inputStyle, paddingLeft: '34px', width: '100%' }}
            />
          </div>

          {/* Date From */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Dari</span>
            <input
              id="input-date-from"
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>

          {/* Date To */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>Sampai</span>
            <input
              id="input-date-to"
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ ...inputStyle, colorScheme: 'dark' }}
            />
          </div>

          {/* Reset */}
          {(search || dateFrom || dateTo) && (
            <button
              id="btn-reset-filters"
              onClick={handleReset}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '8px 14px', borderRadius: '9px',
                border: '1px solid var(--border-card)', background: 'transparent',
                color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.15s ease',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#f87171' }}
              onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-card)'; e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>filter_alt_off</span>
              Reset
            </button>
          )}

          {/* Count pill */}
          {!loading && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-secondary)' }}>{activeCount}</strong> baris ditampilkan
            </span>
          )}
        </div>

        {/* Table */}
        {activeTab === 'door'
          ? <DoorTable   logs={filteredDoor}   loading={loading} onPhoto={setLightbox} />
          : <LockerTable logs={filteredLocker} loading={loading} />
        }

        {/* Table Footer */}
        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border-table)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px',
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
            Data diambil dari Supabase — maks. 500 baris per tab.
          </p>
          <button
            id="btn-refresh"
            onClick={() => { setLoading(true); Promise.all([fetchDoor(), fetchLocker()]).then(() => setLoading(false)) }}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '15px' }}>refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Photo Lightbox */}
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}
