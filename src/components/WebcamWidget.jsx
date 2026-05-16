import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const BUCKET = 'foto-akses'

export default function WebcamWidget() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const isCapturing = useRef(false)

  const [collapsed, setCollapsed] = useState(false)
  const [status, setStatus] = useState('Menginisialisasi kamera...')
  const [lastPhoto, setLastPhoto] = useState(null)
  const [cameraReady, setCameraReady] = useState(false)

  const handleCaptureCommand = useCallback(async (record) => {
    if (isCapturing.current) return
    if (!videoRef.current || !canvasRef.current) return
    if (!supabase) return

    isCapturing.current = true
    try {
      setStatus('Memotret...')

      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = 640
      canvas.height = 480
      canvas.getContext('2d').drawImage(video, 0, 0, 640, 480)

      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.9)
      })

      setStatus('Mengunggah...')

      const logPintuId = record.payload?.log_pintu_id
      const path = `captures/${Date.now()}_${logPintuId ?? 'unknown'}.jpg`

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: 'image/jpeg', upsert: true })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)

      if (logPintuId) {
        await supabase.from('log_pintu').update({ url_foto: publicUrl }).eq('id', logPintuId)
      }

      await supabase.from('commands').update({ status: 'done' }).eq('id', record.id)

      setLastPhoto(publicUrl)
      setStatus('Selesai ✓')
    } catch (err) {
      console.error('handleCaptureCommand:', err)
      setStatus('Error ✗')
      try {
        await supabase?.from('commands').update({ status: 'error' }).eq('id', record.id)
      } catch (_) { /* ignore */ }
    } finally {
      isCapturing.current = false
    }
  }, [])

  // Camera init + pending command recovery
  useEffect(() => {
    let active = true

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        })
        if (!active) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setCameraReady(true)
        setStatus('Siap')

        // Recover any pending CAPTURE_PHOTO commands that arrived while offline
        if (supabase) {
          const { data: pending } = await supabase
            .from('commands')
            .select('*')
            .eq('type', 'CAPTURE_PHOTO')
            .eq('status', 'pending')
            .order('created_at', { ascending: true })

          for (const cmd of (pending ?? [])) {
            if (!active) break
            await handleCaptureCommand(cmd)
          }
        }
      } catch (err) {
        if (!active) return
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setStatus('Akses kamera ditolak. Berikan izin kamera di browser.')
        } else if (err.name === 'NotFoundError') {
          setStatus('Kamera tidak ditemukan.')
        } else if (err.name === 'NotReadableError') {
          setStatus('Kamera sedang digunakan aplikasi lain.')
        } else {
          setStatus('Kamera tidak tersedia. Pastikan HTTPS aktif.')
        }
        console.error('getUserMedia:', err)
      }
    }

    startCamera()

    return () => {
      active = false
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [handleCaptureCommand])

  // Realtime subscription for CAPTURE_PHOTO commands
  useEffect(() => {
    if (!supabase) return

    const channel = supabase
      .channel('webcam-commands')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'commands', filter: 'type=eq.CAPTURE_PHOTO' },
        (payload) => handleCaptureCommand(payload.new)
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [handleCaptureCommand])

  const sendCommand = useCallback(async (type) => {
    if (!supabase) return
    const { error } = await supabase.from('commands').insert({ type, status: 'pending' })
    if (error) console.error('sendCommand:', error)
  }, [])

  return (
    <div className={`webcam-widget${collapsed ? ' webcam-widget--collapsed' : ''}`}>
      {/* Header */}
      <div className="webcam-widget__header" onClick={() => setCollapsed((c) => !c)}>
        <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
          {cameraReady ? 'videocam' : 'videocam_off'}
        </span>
        <span className="webcam-widget__title">Kamera Akses</span>
        <span className="material-symbols-outlined" style={{ fontSize: '16px', marginLeft: 'auto' }}>
          {collapsed ? 'expand_less' : 'expand_more'}
        </span>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="webcam-widget__body">
          {/* Live feed */}
          <div className="webcam-widget__feed-wrap">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="webcam-widget__video"
            />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            {!cameraReady && (
              <div className="webcam-widget__overlay-msg">
                <span className="material-symbols-outlined" style={{ fontSize: '28px', opacity: 0.5 }}>videocam_off</span>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="webcam-widget__status">
            <span className="material-symbols-outlined" style={{ fontSize: '13px' }}>fiber_manual_record</span>
            {status}
          </div>

          {/* Last captured photo */}
          {lastPhoto && (
            <div className="webcam-widget__last-photo-wrap">
              <span className="webcam-widget__last-photo-label">Foto Terakhir</span>
              <img src={lastPhoto} alt="Foto terakhir" className="webcam-widget__last-photo" />
            </div>
          )}

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
          </div>
        </div>
      )}
    </div>
  )
}
