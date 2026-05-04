export default function AlertPanel({ latestPintu, latestLoker }) {
  const hasDoorAnomaly = latestPintu?.is_anomali === true
  const hasLockerFail  = latestLoker?.status_akses === 'GAGAL'

  if (!hasDoorAnomaly && !hasLockerFail) return null

  return (
    <div
      className="animate-slide-down animate-glow-pulse"
      style={{
        marginBottom: '20px',
        borderRadius: '14px',
        overflow: 'hidden',
        border: '1px solid rgba(239,68,68,0.3)',
        background: 'linear-gradient(135deg, rgba(254,226,226,0.9), rgba(254,202,202,0.7))',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Dark mode override via CSS */}
      <style>{`
        [data-theme="dark"] .alert-inner {
          background: linear-gradient(135deg, rgba(127,29,29,0.65), rgba(69,10,10,0.72)) !important;
        }
        [data-theme="dark"] .alert-text-title { color: #fca5a5 !important; }
        [data-theme="dark"] .alert-text-sub   { color: rgba(252,165,165,0.75) !important; }
        [data-theme="dark"] .alert-text-name  { color: #fecaca !important; }
        [data-theme="dark"] .alert-text-time  { color: #f87171 !important; }
        [data-theme="dark"] .alert-msg-box    {
          background: rgba(239,68,68,0.1)  !important;
          border-color: rgba(239,68,68,0.25) !important;
        }
      `}</style>

      <div className="alert-inner" style={{ padding: '18px 20px', background: 'transparent' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: '20px' }}>warning</span>
          </div>
          <div>
            <h2 className="alert-text-title" style={{ fontSize: '15px', fontWeight: 700, color: '#991b1b' }}>⚠ PERINGATAN KEAMANAN</h2>
            <p style={{ fontSize: '11.5px', color: '#b91c1c', opacity: 0.8, marginTop: '1px' }}>Terdeteksi aktivitas mencurigakan</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {hasDoorAnomaly && (
            <div className="alert-msg-box" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: '18px', marginTop: '1px', flexShrink: 0 }}>sensor_door</span>
                <div style={{ flex: 1 }}>
                  <p className="alert-text-title" style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b' }}>Anomali Akses Pintu</p>
                  <p className="alert-text-sub" style={{ fontSize: '13px', color: '#b91c1c', marginTop: '4px' }}>
                    Terdeteksi akses tidak sah oleh{' '}
                    <strong className="alert-text-name" style={{ color: '#7f1d1d' }}>{latestPintu.nama || 'Tidak Diketahui'}</strong>
                    {' '}pada{' '}
                    <span className="alert-text-time" style={{ color: '#dc2626' }}>{new Date(latestPintu.waktu_akses).toLocaleString('id-ID')}</span>
                  </p>
                  {latestPintu.url_foto && (
                    <div style={{ marginTop: '12px' }}>
                      <p style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600, marginBottom: '7px' }}>📸 Bukti Foto:</p>
                      <img
                        src={latestPintu.url_foto}
                        alt="Bukti anomali"
                        style={{ maxWidth: '260px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)', display: 'block' }}
                        onError={(e) => { e.target.style.display = 'none' }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {hasLockerFail && (
            <div className="alert-msg-box" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="material-symbols-outlined" style={{ color: '#dc2626', fontSize: '18px', flexShrink: 0 }}>enhanced_encryption</span>
                <div>
                  <p className="alert-text-title" style={{ fontSize: '13px', fontWeight: 700, color: '#991b1b' }}>
                    Gagal Akses Loker #{latestLoker.nomor_loker}
                  </p>
                  <p className="alert-text-sub" style={{ fontSize: '13px', color: '#b91c1c', marginTop: '4px' }}>
                    Percobaan gagal oleh{' '}
                    <strong className="alert-text-name" style={{ color: '#7f1d1d' }}>{latestLoker.nama_pengakses || 'Tidak Diketahui'}</strong>
                    {' '}pada{' '}
                    <span className="alert-text-time" style={{ color: '#dc2626' }}>{new Date(latestLoker.waktu_akses).toLocaleString('id-ID')}</span>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
