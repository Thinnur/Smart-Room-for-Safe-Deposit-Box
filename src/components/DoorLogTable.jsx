import { useState } from 'react'

export default function DoorLogTable({ logs }) {
  const [zoomedPhoto, setZoomedPhoto] = useState(null)

  const fmt = (d) =>
    d
      ? new Date(d).toLocaleString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        })
      : '—'

  return (
    <>
      {zoomedPhoto && (
        <div className="modal-overlay" onClick={() => setZoomedPhoto(null)}>
          <img src={zoomedPhoto} alt="Foto akses" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <div className="glass-card animate-fade-in" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-table)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="material-symbols-outlined" style={{ color: '#3b82f6', fontSize: '18px' }}>sensor_door</span>
            <h2 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Log Akses Pintu</h2>
          </div>
          <span style={{
            padding: '3px 10px',
            background: 'var(--badge-neutral-bg)',
            borderRadius: '99px',
            fontSize: '11.5px',
            fontWeight: 600,
            color: 'var(--badge-neutral-text)',
          }}>
            {logs.length} catatan
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '460px' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Nama</th>
                <th>Tipe Akses</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Foto</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', opacity: 0.45 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '44px', color: 'var(--text-muted)', marginBottom: '10px' }}>inventory_2</span>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Belum ada data log pintu</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {fmt(log.waktu_akses)}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.nama || '—'}</td>
                    <td>
                      <span className={`badge ${log.tipe_akses === 'MASUK' ? 'badge-info' : 'badge-warning'}`}>
                        {log.tipe_akses === 'MASUK' ? '→ MASUK' : '← KELUAR'}
                      </span>
                    </td>
                    <td>
                      {log.is_anomali
                        ? <span className="badge badge-danger">⚠ Anomali</span>
                        : <span className="badge badge-success">✓ Aman</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {log.url_foto ? (
                        <img
                          src={log.url_foto}
                          alt="foto"
                          className="photo-thumb"
                          style={{ margin: '0 auto' }}
                          onClick={() => setZoomedPhoto(log.url_foto)}
                          onError={(e) => { e.target.style.display = 'none' }}
                        />
                      ) : (
                        <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
