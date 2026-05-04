export default function LockerLogTable({ logs }) {
  const fmt = (d) =>
    d
      ? new Date(d).toLocaleString('id-ID', {
          day: '2-digit', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
        })
      : '—'

  return (
    <div className="glass-card animate-fade-in" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-table)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="material-symbols-outlined" style={{ color: '#a855f7', fontSize: '18px' }}>enhanced_encryption</span>
          <h2 style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-primary)' }}>Log Akses Loker</h2>
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
              <th>Nama Pengakses</th>
              <th style={{ textAlign: 'center' }}>No. Loker</th>
              <th style={{ textAlign: 'right' }}>Status Akses</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={4}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 24px', opacity: 0.45 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '44px', color: 'var(--text-muted)', marginBottom: '10px' }}>move_to_inbox</span>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Belum ada data log loker</p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const ok = log.status_akses === 'BERHASIL'
                return (
                  <tr key={log.id} className={ok ? 'row-success' : 'row-danger'}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {fmt(log.waktu_akses)}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.nama_pengakses || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-purple">#{log.nomor_loker ?? '—'}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {ok
                        ? <span className="badge badge-success">✓ BERHASIL</span>
                        : <span className="badge badge-danger">✕ GAGAL</span>}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
