import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { requestOTPAccess, cancelOTPAccess } from '../lib/generateOTP'

const OTP_VALID_MINUTES = 5

export default function OTPDialog({ nasabah, onClose }) {
  // loading | active | success | expired | cancelled | error
  const [status, setStatus] = useState('loading')
  const [otpCode, setOtpCode] = useState('')
  const [cmdId, setCmdId] = useState(null)
  const [expiresAt, setExpiresAt] = useState(null)
  const [remaining, setRemaining] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const closedRef = useRef(false)
  const settledRef = useRef(false) // guards against double expire/cancel calls

  const safeClose = () => {
    if (closedRef.current) return
    closedRef.current = true
    onClose()
  }

  const handleExpire = async () => {
    if (settledRef.current) return
    settledRef.current = true
    setStatus('expired')
    try { await cancelOTPAccess(supabase, cmdId) } catch {}
    setTimeout(safeClose, 1500)
  }

  const handleCancel = async () => {
    if (settledRef.current) return
    settledRef.current = true
    setStatus('cancelled')
    try { await cancelOTPAccess(supabase, cmdId) } catch {}
    setTimeout(safeClose, 800)
  }

  // Step 1: minta OTP saat dialog dibuka
  // requestedRef mencegah pengiriman OTP dobel akibat React StrictMode
  // yang menjalankan effect mount dua kali di dev mode (mount -> cleanup -> mount).
  // Tidak pakai flag "active" di sini: request hanya terkirim sekali (invocation
  // pertama), jadi tidak ada promise basi dari invocation kedua yang perlu diabaikan.
  // setState setelah dialog benar-benar unmount aman (no-op) di React 18.
  const requestedRef = useRef(false)
  useEffect(() => {
    if (requestedRef.current) return
    requestedRef.current = true

    const start = async () => {
      if (!supabase) {
        setErrorMsg('Koneksi Supabase belum diatur.')
        setStatus('error')
        return
      }
      try {
        const { cmdId: id, otpCode: code, expiresAt: exp } =
          await requestOTPAccess(supabase, nasabah.id, OTP_VALID_MINUTES)
        setCmdId(id)
        setOtpCode(code)
        setExpiresAt(exp)
        setStatus('active')
      } catch (err) {
        setErrorMsg(err.message || 'Gagal membuat OTP.')
        setStatus('error')
      }
    }
    start()
  }, [nasabah.id])

  // Step 2: realtime subscription + polling fallback selama OTP aktif
  useEffect(() => {
    if (status !== 'active' || cmdId == null) return
    let active = true
    let channel = null
    let pollTimer = null

    const handleDone = () => {
      if (!active || settledRef.current) return
      settledRef.current = true
      setStatus('success')
      setTimeout(() => { if (active) safeClose() }, 3000)
    }

    channel = supabase
      .channel(`otp-${cmdId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'commands',
        filter: `id=eq.${cmdId}`,
      }, ({ new: updated }) => {
        if (updated.status === 'done') handleDone()
      })
      .subscribe()

    pollTimer = setInterval(async () => {
      if (!active || settledRef.current) return
      const { data: row } = await supabase
        .from('commands')
        .select('status')
        .eq('id', cmdId)
        .single()
      if (!row || !active) return
      if (row.status === 'done') {
        clearInterval(pollTimer)
        handleDone()
      }
    }, 3000)

    return () => {
      active = false
      if (channel) supabase.removeChannel(channel)
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [status, cmdId])

  // Step 3: countdown 5:00 -> 0:00
  useEffect(() => {
    if (status !== 'active' || !expiresAt) return
    const expireTs = new Date(expiresAt).getTime()

    const tick = () => {
      const diff = Math.max(0, Math.round((expireTs - Date.now()) / 1000))
      setRemaining(diff)
      if (diff <= 0) handleExpire()
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [status, expiresAt])

  const digits = otpCode.split('')
  const mm = Math.floor(remaining / 60)
  const ss = String(remaining % 60).padStart(2, '0')

  const statusMeta = {
    loading:   { color: '#60a5fa', icon: 'hourglass_top',  title: 'Membuat OTP...' },
    active:    { color: '#60a5fa', icon: 'pin',            title: 'OTP Aktif' },
    success:   { color: '#4ade80', icon: 'check_circle',   title: 'Akses Diberikan!' },
    expired:   { color: '#f59e0b', icon: 'timer_off',      title: 'OTP Kadaluwarsa' },
    cancelled: { color: '#94a3b8', icon: 'cancel',          title: 'OTP Dibatalkan' },
    error:     { color: '#f87171', icon: 'error',          title: 'Terjadi Kesalahan' },
  }
  const meta = statusMeta[status]
  const dismissable = status !== 'active' && status !== 'loading'

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget && dismissable) safeClose() }}
    >
      <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '28px', margin: '16px', textAlign: 'center' }}>
        {/* Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '14px',
            background: `${meta.color}1f`, border: `1px solid ${meta.color}44`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span className="material-symbols-outlined" style={{
              color: meta.color, fontSize: '24px',
              animation: status === 'loading' ? 'pulse-icon 1.5s ease-in-out infinite' : 'none',
            }}>
              {meta.icon}
            </span>
          </div>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{meta.title}</h2>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>{nasabah.nama}</p>
          </div>
        </div>

        {status === 'active' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '16px' }}>
              {digits.map((d, i) => (
                <div key={i} style={{
                  width: '54px', height: '64px', borderRadius: '12px',
                  background: 'var(--bg-body)', border: '1px solid rgba(59,130,246,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '28px', fontWeight: 800, color: '#60a5fa',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {d}
                </div>
              ))}
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '18px' }}>
              Tekan tombol <strong>{digits.join(' → ')}</strong> di perangkat
            </p>

            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: '26px', fontWeight: 700,
              color: remaining <= 30 ? '#f87171' : 'var(--text-primary)',
              marginBottom: '20px',
            }}>
              {mm}:{ss}
            </div>

            <button
              onClick={handleCancel}
              style={{
                width: '100%', padding: '10px', borderRadius: '10px',
                border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.06)',
                color: '#f87171', fontSize: '13.5px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Batalkan OTP
            </button>
          </>
        )}

        {status === 'success' && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Nasabah berhasil masuk menggunakan OTP. Dialog akan tertutup otomatis.
          </p>
        )}

        {status === 'expired' && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            Waktu OTP telah habis dan akses dibatalkan.
          </p>
        )}

        {status === 'cancelled' && (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
            OTP dibatalkan oleh teller.
          </p>
        )}

        {status === 'error' && (
          <>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '18px' }}>{errorMsg}</p>
            <button
              onClick={safeClose}
              style={{
                width: '100%', padding: '10px', borderRadius: '10px',
                border: '1px solid var(--border-card)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: '13.5px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Tutup
            </button>
          </>
        )}
      </div>
    </div>
  )
}
