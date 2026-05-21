export default function RoomStatusCard({ latestPintu }) {
  if (!latestPintu) {
    return (
      <div className="glass-card animate-fade-in" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--bg-icon-neutral)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--text-subtle)', fontSize: '18px' }}>meeting_room</span>
        </div>
        <div>
          <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status Ruangan</p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>Memuat data...</p>
        </div>
      </div>
    )
  }

  const isOccupied = latestPintu.tipe_akses === 'MASUK' && !latestPintu.is_anomali

  return (
    <div
      className="glass-card animate-fade-in"
      style={{
        padding: '14px 18px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        borderLeft: `3px solid ${isOccupied ? '#ef4444' : '#22c55e'}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '8px',
          background: isOccupied ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ color: isOccupied ? '#ef4444' : '#22c55e', fontSize: '18px' }}>
            {isOccupied ? 'door_front' : 'meeting_room'}
          </span>
        </div>
        <div>
          <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status Ruangan</p>
          <span className={`badge ${isOccupied ? 'badge-danger' : 'badge-success'}`} style={{ marginTop: '5px', display: 'inline-flex' }}>
            {isOccupied ? '🔴 RUANGAN TERISI' : '🟢 RUANGAN KOSONG'}
          </span>
        </div>
      </div>
      {isOccupied && latestPintu.nama && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: '10px', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Pengguna</p>
          <p style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>{latestPintu.nama}</p>
        </div>
      )}
    </div>
  )
}
