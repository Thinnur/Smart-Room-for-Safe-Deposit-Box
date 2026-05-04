import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500)
    return () => clearTimeout(t)
  }, [onClose])

  const colors = {
    success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.4)', text: '#4ade80', icon: 'check_circle' },
    error:   { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.4)',  text: '#f87171', icon: 'error' },
  }
  const c = colors[type] || colors.success

  return (
    <div style={{
      position: 'fixed', bottom: '28px', right: '28px', zIndex: 200,
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '12px 18px', borderRadius: '12px',
      background: 'var(--bg-card)', border: `1px solid ${c.border}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      animation: 'fade-in 0.3s ease-out',
      maxWidth: '340px',
    }}>
      <span className="material-symbols-outlined" style={{ color: c.text, fontSize: '20px' }}>{c.icon}</span>
      <span style={{ fontSize: '13.5px', color: 'var(--text-secondary)', flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 4px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>close</span>
      </button>
    </div>
  )
}

// ─── Modal Form ───────────────────────────────────────────────────────────────
function NasabahModal({ onClose, onSuccess, editData }) {
  const isEdit = !!editData
  const [form, setForm] = useState({
    nama: editData?.nama || '',
    rfid_uid: editData?.rfid_uid || '',
    fingerprint_id: editData?.fingerprint_id ?? '',
  })
  const [selectedLoker, setSelectedLoker] = useState('')
  const [availableLokers, setAvailableLokers] = useState([])
  const [loading, setLoading] = useState(false)
  const [fetchingLokers, setFetchingLokers] = useState(true)

  useEffect(() => {
    const fetchLokers = async () => {
      setFetchingLokers(true)
      const { data, error } = await supabase
        .from('loker')
        .select('id, nomor_loker')
        .is('id_nasabah', null)
        .order('nomor_loker', { ascending: true })
      if (!error && data) setAvailableLokers(data)
      setFetchingLokers(false)
    }
    fetchLokers()
  }, [])

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.nama.trim()) return
    setLoading(true)
    try {
      if (isEdit) {
        const { error } = await supabase
          .from('nasabah')
          .update({
            nama: form.nama.trim(),
            rfid_uid: form.rfid_uid.trim() || null,
            fingerprint_id: form.fingerprint_id !== '' ? parseInt(form.fingerprint_id) : null,
          })
          .eq('id', editData.id)
        if (error) throw error
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('nasabah')
          .insert([{
            nama: form.nama.trim(),
            rfid_uid: form.rfid_uid.trim() || null,
            fingerprint_id: form.fingerprint_id !== '' ? parseInt(form.fingerprint_id) : null,
          }])
          .select()
          .single()
        if (insertErr) throw insertErr

        if (selectedLoker && inserted?.id) {
          const { error: lokerErr } = await supabase
            .from('loker')
            .update({ id_nasabah: inserted.id })
            .eq('id', selectedLoker)
          if (lokerErr) throw lokerErr
        }
      }
      onSuccess(isEdit ? 'Data nasabah berhasil diperbarui.' : 'Nasabah berhasil ditambahkan.')
    } catch (err) {
      console.error(err)
      onSuccess('Terjadi kesalahan: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 13px',
    background: 'var(--bg-body)', border: '1px solid var(--border-card)',
    borderRadius: '9px', color: 'var(--text-primary)',
    fontSize: '13.5px', outline: 'none',
    transition: 'border-color 0.15s ease',
    fontFamily: 'var(--font-sans)',
  }
  const labelStyle = { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '460px', padding: '28px', margin: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '18px' }}>{isEdit ? 'edit' : 'person_add'}</span>
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{isEdit ? 'Edit Nasabah' : 'Tambah Nasabah'}</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{isEdit ? 'Perbarui data nasabah' : 'Isi data nasabah baru'}</p>
            </div>
          </div>
          <button onClick={onClose} className="topbar-btn"><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Nama Lengkap *</label>
            <input name="nama" value={form.nama} onChange={handleChange} required placeholder="Masukkan nama nasabah" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>UID RFID</label>
            <input name="rfid_uid" value={form.rfid_uid} onChange={handleChange} placeholder="Contoh: A3F2B1C4" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>ID Fingerprint</label>
            <input name="fingerprint_id" type="number" value={form.fingerprint_id} onChange={handleChange} placeholder="Nomor ID fingerprint" style={inputStyle} />
          </div>

          {!isEdit && (
            <div>
              <label style={labelStyle}>Alokasi Loker (Opsional)</label>
              <select
                value={selectedLoker}
                onChange={(e) => setSelectedLoker(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                disabled={fetchingLokers}
              >
                <option value="">{fetchingLokers ? 'Memuat loker...' : '— Pilih loker tersedia —'}</option>
                {availableLokers.map(l => (
                  <option key={l.id} value={l.id}>Loker #{l.nomor_loker}</option>
                ))}
              </select>
              {!fetchingLokers && availableLokers.length === 0 && (
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '5px' }}>Tidak ada loker yang tersedia saat ini.</p>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: '1px solid var(--border-card)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: '13.5px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}>Batal</button>
            <button type="submit" disabled={loading} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: 'none', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
              color: 'white', fontSize: '13.5px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1,
              fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
            }}>
              {loading && <span className="material-symbols-outlined" style={{ fontSize: '16px', animation: 'bounce-dot 0.8s ease-in-out infinite' }}>sync</span>}
              {loading ? 'Menyimpan...' : (isEdit ? 'Simpan Perubahan' : 'Tambah Nasabah')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function LokerModal({ onClose, onSuccess }) {
  const [nomorLoker, setNomorLoker] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const trimmedNomor = nomorLoker.trim()
    if (!trimmedNomor) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('loker')
        .insert([{ nomor_loker: trimmedNomor, id_nasabah: null }])

      if (error) throw error
      onSuccess(`Loker "${trimmedNomor}" berhasil ditambahkan.`)
    } catch (err) {
      console.error(err)
      onSuccess('Terjadi kesalahan: ' + (err.message || 'Unknown error'), 'error')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 13px',
    background: 'var(--bg-body)', border: '1px solid var(--border-card)',
    borderRadius: '9px', color: 'var(--text-primary)',
    fontSize: '13.5px', outline: 'none',
    transition: 'border-color 0.15s ease',
    fontFamily: 'var(--font-sans)',
  }
  const labelStyle = { fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.06em' }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '420px', padding: '28px', margin: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span className="material-symbols-outlined" style={{ color: 'white', fontSize: '18px' }}>add_home</span>
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Tambah Loker</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Buat loker baru yang tersedia</p>
            </div>
          </div>
          <button onClick={onClose} className="topbar-btn"><span className="material-symbols-outlined" style={{ fontSize: '20px' }}>close</span></button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>Nomor Loker *</label>
            <input value={nomorLoker} onChange={(e) => setNomorLoker(e.target.value)} required placeholder="A-05" style={inputStyle} />
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: '1px solid var(--border-card)', background: 'transparent',
              color: 'var(--text-secondary)', fontSize: '13.5px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}>Batal</button>
            <button type="submit" disabled={loading} style={{
              flex: 1, padding: '10px', borderRadius: '10px',
              border: 'none', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
              color: 'white', fontSize: '13.5px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.75 : 1,
              fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              boxShadow: '0 4px 14px rgba(59,130,246,0.35)',
            }}>
              {loading && <span className="material-symbols-outlined" style={{ fontSize: '16px', animation: 'bounce-dot 0.8s ease-in-out infinite' }}>sync</span>}
              {loading ? 'Menyimpan...' : 'Tambah Loker'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function EmptyState({ onAdd }) {
  return (
    <tr>
      <td colSpan={5} style={{ textAlign: 'center', padding: '56px 20px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--text-subtle)', display: 'block', marginBottom: '12px' }}>group</span>
        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 6px' }}>Belum ada nasabah</p>
        <p style={{ fontSize: '13px', color: 'var(--text-subtle)', marginBottom: '18px' }}>Klik tombol di atas untuk menambahkan nasabah pertama.</p>
        <button onClick={onAdd} style={{
          padding: '8px 18px', borderRadius: '9px', border: 'none',
          background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: 'white',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}>+ Tambah Nasabah</button>
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function EmptyLokerState({ onAdd }) {
  return (
    <tr>
      <td colSpan={4} style={{ textAlign: 'center', padding: '56px 20px' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '48px', color: 'var(--text-subtle)', display: 'block', marginBottom: '12px' }}>inventory_2</span>
        <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 6px' }}>Belum ada loker</p>
        <p style={{ fontSize: '13px', color: 'var(--text-subtle)', marginBottom: '18px' }}>Tambahkan loker baru untuk mulai mengelola ketersediaan.</p>
        <button onClick={onAdd} style={{
          padding: '8px 18px', borderRadius: '9px', border: 'none',
          background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', color: 'white',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}>+ Tambah Loker Baru</button>
      </td>
    </tr>
  )
}

export default function CustomerManagement() {
  const [nasabahList, setNasabahList]   = useState([])
  const [lokerList, setLokerList]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [lokerLoading, setLokerLoading] = useState(true)
  const [activeTab, setActiveTab]       = useState('nasabah')
  const [showModal, setShowModal]       = useState(false)
  const [showLokerModal, setShowLokerModal] = useState(false)
  const [editTarget, setEditTarget]     = useState(null)
  const [toast, setToast]               = useState(null)
  const [searchQuery, setSearchQuery]   = useState('')

  const showToast = (message, type = 'success') => setToast({ message, type })

  const fetchNasabah = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('nasabah')
        .select('*, loker(id, nomor_loker)')
        .order('nama', { ascending: true })
      if (!error && data) setNasabahList(data)
      else if (error) console.error('fetchNasabah:', error)
    } catch (e) {
      console.error('fetchNasabah:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLokers = useCallback(async () => {
    if (!supabase) return
    setLokerLoading(true)
    try {
      const { data, error } = await supabase
        .from('loker')
        .select('id, nomor_loker, id_nasabah, nasabah(id, nama)')
        .order('nomor_loker', { ascending: true })
      if (!error && data) setLokerList(data)
      else if (error) console.error('fetchLokers:', error)
    } catch (e) {
      console.error('fetchLokers:', e)
    } finally {
      setLokerLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    Promise.resolve().then(() => {
      if (active) {
        fetchNasabah()
        fetchLokers()
      }
    })
    return () => { active = false }
  }, [fetchNasabah, fetchLokers])

  const handleDelete = async (nasabah) => {
    if (!window.confirm(`Hapus nasabah "${nasabah.nama}"?\nSemua data terkait akan dihapus.`)) return
    try {
      // Unassign locker first (set id_nasabah to null)
      if (nasabah.loker?.length > 0) {
        await supabase.from('loker').update({ id_nasabah: null }).eq('id_nasabah', nasabah.id)
      }
      const { error } = await supabase.from('nasabah').delete().eq('id', nasabah.id)
      if (error) throw error
      showToast(`Nasabah "${nasabah.nama}" berhasil dihapus.`)
      fetchNasabah()
      fetchLokers()
    } catch (err) {
      showToast('Gagal menghapus: ' + (err.message || 'Unknown error'), 'error')
    }
  }

  const handleModalSuccess = (msg, type = 'success') => {
    setShowModal(false)
    setEditTarget(null)
    showToast(msg, type)
    if (type === 'success') {
      fetchNasabah()
      fetchLokers()
    }
  }

  const handleLokerModalSuccess = (msg, type = 'success') => {
    setShowLokerModal(false)
    showToast(msg, type)
    if (type === 'success') {
      fetchLokers()
      fetchNasabah()
    }
  }

  const handleDeleteLoker = async (loker) => {
    if (!window.confirm(`Hapus loker "${loker.nomor_loker}"?\nData nasabah tidak akan dihapus.`)) return
    try {
      const { error } = await supabase.from('loker').delete().eq('id', loker.id)
      if (error) throw error
      showToast(`Loker "${loker.nomor_loker}" berhasil dihapus.`)
      fetchLokers()
      fetchNasabah()
    } catch (err) {
      showToast('Gagal menghapus loker: ' + (err.message || 'Unknown error'), 'error')
    }
  }

  const openEdit = (nasabah) => { setEditTarget(nasabah); setShowModal(true) }
  const openAdd  = () => { setEditTarget(null); setShowModal(true) }
  const openAddLoker = () => setShowLokerModal(true)

  const filtered = nasabahList.filter(n =>
    n.nama?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    n.rfid_uid?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ── Skeleton rows
  const SkeletonRow = ({ columns = 5 }) => (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: '12px 16px' }}>
          <div style={{ height: '14px', borderRadius: '6px', background: 'var(--border-card)', opacity: 0.5 }} />
        </td>
      ))}
    </tr>
  )

  return (
    <div style={{ animation: 'fade-in 0.4s ease-out' }}>
      {/* ── Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 4px' }}>Manajemen Nasabah</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Kelola data nasabah dan alokasi loker
          </p>
        </div>
        {activeTab === 'nasabah' && (
          <button onClick={openAdd} style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '10px 18px', borderRadius: '11px', border: 'none',
            background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
            color: 'white', fontSize: '13.5px', fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
            boxShadow: '0 4px 16px rgba(59,130,246,0.35)',
            transition: 'opacity 0.2s',
          }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.88'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>person_add</span>
            Tambah Nasabah
          </button>
        )}
      </div>

      {/* ── Card */}
      <div style={{ display: 'inline-flex', padding: '4px', borderRadius: '12px', background: 'var(--bg-card)', border: '1px solid var(--border-card)', marginBottom: '16px', gap: '4px' }}>
        {[
          { id: 'nasabah', label: 'Data Nasabah', icon: 'group' },
          { id: 'loker', label: 'Data Loker', icon: 'inventory_2' },
        ].map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 14px', borderRadius: '9px', border: 'none',
                background: isActive ? 'linear-gradient(135deg,#3b82f6,#1d4ed8)' : 'transparent',
                color: isActive ? 'white' : 'var(--text-muted)',
                fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                boxShadow: isActive ? '0 4px 14px rgba(59,130,246,0.25)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>{tab.icon}</span>
              {tab.label}
            </button>
          )
        })}
      </div>

      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {activeTab === 'nasabah' ? (
          <>
        {/* Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-table)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#3b82f6' }}>group</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Daftar Nasabah</span>
            {!loading && (
              <span style={{ padding: '2px 9px', borderRadius: '99px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', fontSize: '11.5px', fontWeight: 700, color: '#60a5fa' }}>
                {filtered.length}
              </span>
            )}
          </div>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <span className="material-symbols-outlined" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '16px', color: 'var(--text-muted)', pointerEvents: 'none' }}>search</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari nama / RFID..."
              style={{
                padding: '8px 12px 8px 34px',
                background: 'var(--bg-body)', border: '1px solid var(--border-card)',
                borderRadius: '9px', color: 'var(--text-primary)', fontSize: '13px',
                outline: 'none', width: '220px', fontFamily: 'var(--font-sans)',
              }}
            />
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Nama</th>
                <th>UID RFID</th>
                <th>ID Fingerprint</th>
                <th>Loker</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
              ) : filtered.length === 0 ? (
                <EmptyState onAdd={openAdd} />
              ) : (
                filtered.map(n => {
                  const lokerList = n.loker || []
                  return (
                    <tr key={n.id}>
                      {/* Nama */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px', fontWeight: 700, color: 'white',
                          }}>
                            {n.nama?.charAt(0).toUpperCase() || '?'}
                          </div>
                          <div>
                            <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '13.5px' }}>{n.nama}</p>
                            <p style={{ margin: 0, fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{n.id.slice(0, 8)}…</p>
                          </div>
                        </div>
                      </td>
                      {/* RFID */}
                      <td>
                        {n.rfid_uid
                          ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}>{n.rfid_uid}</span>
                          : <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>—</span>}
                      </td>
                      {/* Fingerprint */}
                      <td>
                        {n.fingerprint_id != null
                          ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12.5px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: '#c084fc' }}>#{n.fingerprint_id}</span>
                          : <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>—</span>}
                      </td>
                      {/* Loker */}
                      <td>
                        {lokerList.length > 0
                          ? lokerList.map(l => (
                            <span key={l.id} className="badge badge-success" style={{ marginRight: '4px' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>lock</span>
                              #{l.nomor_loker}
                            </span>
                          ))
                          : <span className="badge badge-warning">
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>lock_open</span>
                              Belum ada
                            </span>
                        }
                      </td>
                      {/* Aksi */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => openEdit(n)}
                            title="Edit"
                            style={{
                              display: 'flex', alignItems: 'center', gap: '5px',
                              padding: '6px 12px', borderRadius: '8px',
                              border: '1px solid var(--border-card)',
                              background: 'transparent', color: 'var(--text-muted)',
                              fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                              fontFamily: 'var(--font-sans)', transition: 'all 0.15s ease',
                            }}
                            onMouseOver={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#60a5fa' }}
                            onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border-card)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>edit</span>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(n)}
                            title="Hapus"
                            style={{
                              display: 'flex', alignItems: 'center', gap: '5px',
                              padding: '6px 12px', borderRadius: '8px',
                              border: '1px solid rgba(239,68,68,0.25)',
                              background: 'rgba(239,68,68,0.06)', color: '#f87171',
                              fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                              fontFamily: 'var(--font-sans)', transition: 'all 0.15s ease',
                            }}
                            onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)' }}
                            onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-table)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
              Menampilkan <strong style={{ color: 'var(--text-secondary)' }}>{filtered.length}</strong> dari <strong style={{ color: 'var(--text-secondary)' }}>{nasabahList.length}</strong> nasabah
            </p>
            <button onClick={fetchNasabah} style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              background: 'none', border: 'none', color: 'var(--text-muted)',
              fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>refresh</span>
              Refresh
            </button>
          </div>
        )}
          </>
        ) : (
          <>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-table)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#3b82f6' }}>inventory_2</span>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Daftar Loker</span>
                {!lokerLoading && (
                  <span style={{ padding: '2px 9px', borderRadius: '99px', background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', fontSize: '11.5px', fontWeight: 700, color: '#60a5fa' }}>
                    {lokerList.length}
                  </span>
                )}
              </div>
              <button onClick={openAddLoker} style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '9px 16px', borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
                color: 'white', fontSize: '13px', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                boxShadow: '0 4px 14px rgba(59,130,246,0.32)',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '17px' }}>add</span>
                Tambah Loker Baru
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nomor Loker</th>
                    <th>Status</th>
                    <th>Pemilik</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {lokerLoading ? (
                    Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} columns={4} />)
                  ) : lokerList.length === 0 ? (
                    <EmptyLokerState onAdd={openAddLoker} />
                  ) : (
                    lokerList.map(l => {
                      const isOccupied = !!l.id_nasabah
                      const ownerName = Array.isArray(l.nasabah) ? l.nasabah[0]?.nama : l.nasabah?.nama
                      return (
                        <tr key={l.id}>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              #{l.nomor_loker}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${isOccupied ? 'badge-warning' : 'badge-success'}`}>
                              <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>{isOccupied ? 'lock' : 'lock_open'}</span>
                              {isOccupied ? 'Terisi' : 'Tersedia'}
                            </span>
                          </td>
                          <td>
                            {ownerName
                              ? <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{ownerName}</span>
                              : <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>-</span>}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                              <button
                                onClick={() => handleDeleteLoker(l)}
                                title="Hapus"
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '5px',
                                  padding: '6px 12px', borderRadius: '8px',
                                  border: '1px solid rgba(239,68,68,0.25)',
                                  background: 'rgba(239,68,68,0.06)', color: '#f87171',
                                  fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
                                  fontFamily: 'var(--font-sans)', transition: 'all 0.15s ease',
                                }}
                                onMouseOver={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.14)' }}
                                onMouseOut={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>delete</span>
                                Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {!lokerLoading && lokerList.length > 0 && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-table)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  Menampilkan <strong style={{ color: 'var(--text-secondary)' }}>{lokerList.length}</strong> loker
                </p>
                <button onClick={fetchLokers} style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>refresh</span>
                  Refresh
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal */}
      {showModal && (
        <NasabahModal
          editData={editTarget}
          onClose={() => { setShowModal(false); setEditTarget(null) }}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* ── Toast */}
      {showLokerModal && (
        <LokerModal
          onClose={() => setShowLokerModal(false)}
          onSuccess={handleLokerModalSuccess}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
