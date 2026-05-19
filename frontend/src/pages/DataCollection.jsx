/**
 * Page de collecte de frames labellisées pour l'entraînement
 * du modèle d'émotion adapté aux visages africains.
 *
 * Flux : sélection état → caméra live → capture (face-crop) → envoi API
 * MediaPipe BlazeFace détecte et croppe le visage à la capture.
 * Fallback centre si aucun visage détecté.
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../services/api'
import toast from 'react-hot-toast'
import { Camera, ArrowLeft, CheckCircle, RefreshCw, User } from 'lucide-react'
import { useTheme } from '../styles/theme.jsx'
import { useBreakpoint } from '../hooks/useBreakpoint'

/* ── Config états affectifs ──────────────────────────────────── */
const ETATS = [
  {
    id: 'engagement_eleve',
    label: 'Engagé / Concentré',
    emoji: '😊',
    consigne: 'Regarde l\'écran avec attention et intérêt, comme si tu lisais quelque chose de passionnant.',
    color: '#10B981',
    bg: '#ECFDF5',
  },
  {
    id: 'neutre',
    label: 'Neutre / Normal',
    emoji: '😐',
    consigne: 'Expression neutre, regarde simplement la caméra sans émotion particulière.',
    color: '#6B7280',
    bg: '#F3F4F6',
  },
  {
    id: 'confusion',
    label: 'Confusion / Incompréhension',
    emoji: '🤔',
    consigne: 'Fronce les sourcils comme si tu ne comprenais pas quelque chose. Regarde légèrement en l\'air.',
    color: '#2563EB',
    bg: '#EFF6FF',
  },
  {
    id: 'frustration',
    label: 'Frustration',
    emoji: '😤',
    consigne: 'Expression de frustration : lèvres serrées, sourcils froncés, comme face à un problème difficile.',
    color: '#EF4444',
    bg: '#FEE2E2',
  },
  {
    id: 'ennui',
    label: 'Ennui / Désengagement',
    emoji: '😴',
    consigne: 'Expression d\'ennui : tête légèrement inclinée, yeux mi-clos, regard vague.',
    color: '#F97316',
    bg: '#FFF7ED',
  },
  {
    id: 'engagement_faible',
    label: 'Distrait / Peu attentif',
    emoji: '😑',
    consigne: 'Tourne légèrement la tête de côté, regard ailleurs, comme distrait par quelque chose.',
    color: '#6B7280',
    bg: '#F9FAFB',
  },
]

const TARGET      = 2000   // doit correspondre au backend (annotation.py TARGET)
const TARGET_SIZE = 112    // résolution standard FER (vs 96 avant)
const WASM_CDN    = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const MODEL_URL   = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

export default function DataCollection() {
  const { C } = useTheme()
  const navigate = useNavigate()
  const { user } = useSelector(s => s.auth)
  const { xs, mobile } = useBreakpoint()

  const videoRef        = useRef(null)
  const canvasRef       = useRef(null)
  const streamRef       = useRef(null)
  const faceDetectorRef = useRef(null)
  const autoRef         = useRef(null)

  // ID unique généré à l'ouverture de la page — identifie cette session de contribution
  // même si plusieurs personnes utilisent le même compte
  const contribId = useMemo(() => crypto.randomUUID(), [])

  const [stats,          setStats]          = useState(null)
  const [cameraActive,   setCameraActive]   = useState(false)
  const [selectedEtat,   setSelectedEtat]   = useState(null)
  const [capturing,      setCapturing]      = useState(false)
  const [autoCount,      setAutoCount]      = useState(0)
  const [autoRunning,    setAutoRunning]    = useState(false)
  const [detectorState,  setDetectorState]  = useState('idle') // idle | loading | ready | error
  const [lastFaceFound,  setLastFaceFound]  = useState(null)   // null | true | false

  /* Stats */
  const loadStats = useCallback(async () => {
    try {
      const { data } = await api.get('/api/annotation/stats')
      setStats(data)
    } catch {}
  }, [])
  useEffect(() => { loadStats() }, [loadStats])

  /* Charger MediaPipe dès que la caméra est active (une seule fois) */
  useEffect(() => {
    if (!cameraActive || faceDetectorRef.current || detectorState !== 'idle') return
    let cancelled = false
    setDetectorState('loading')

    ;(async () => {
      try {
        const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(WASM_CDN)
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
          runningMode: 'IMAGE',
          minDetectionConfidence: 0.5,
        })
        if (!cancelled) {
          faceDetectorRef.current = detector
          setDetectorState('ready')
        }
      } catch (e) {
        console.warn('MediaPipe non disponible, fallback centre:', e)
        if (!cancelled) setDetectorState('error')
      }
    })()

    return () => { cancelled = true }
  }, [cameraActive, detectorState])

  /* Démarrer caméra */
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: 'user' }
      })
      streamRef.current = stream
      setCameraActive(true)
      setDetectorState('idle')  // déclenche le chargement MediaPipe
    } catch (err) {
      toast.error('Caméra non disponible : ' + (err?.message || ''))
    }
  }

  /* Attacher le stream après que le <video> soit visible */
  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [cameraActive])

  /* Arrêter caméra + libérer MediaPipe */
  function stopCamera() {
    if (autoRef.current) clearInterval(autoRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (faceDetectorRef.current) {
      try { faceDetectorRef.current.close() } catch {}
      faceDetectorRef.current = null
    }
    setCameraActive(false)
    setAutoRunning(false)
    setDetectorState('idle')
    setLastFaceFound(null)
  }

  /* Capture une frame avec crop visage → 112×112 */
  async function captureFrame() {
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return false

    canvas.width  = TARGET_SIZE
    canvas.height = TARGET_SIZE
    const ctx = canvas.getContext('2d')
    const vw  = video.videoWidth
    const vh  = video.videoHeight

    let sx, sy, sw, sh
    let faceFound = false

    /* ── Détection MediaPipe ── */
    if (faceDetectorRef.current) {
      try {
        const result = faceDetectorRef.current.detect(video)
        if (result.detections.length > 0) {
          const det = result.detections.reduce((a, b) =>
            (a.categories[0]?.score || 0) > (b.categories[0]?.score || 0) ? a : b
          )
          const box = det.boundingBox
          // Centre du visage + 25 % de marge
          const cx   = box.originX + box.width  / 2
          const cy   = box.originY + box.height / 2
          const size = Math.max(box.width, box.height) * 1.5  // +50% pour front/menton
          sx = Math.max(0, cx - size / 2)
          sy = Math.max(0, cy - size / 2)
          sw = sh = Math.min(size, Math.min(vw - sx, vh - sy))
          faceFound = true
        }
      } catch {}
    }

    /* ── Fallback : crop centré 75 % ── */
    if (!faceFound) {
      const size = Math.min(vw, vh) * 0.75
      sx = (vw - size) / 2
      sy = (vh - size) / 2
      sw = sh = size
    }

    setLastFaceFound(faceFound)

    /* Dessin avec miroir selfie */
    ctx.save()
    ctx.translate(TARGET_SIZE, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, TARGET_SIZE, TARGET_SIZE)
    ctx.restore()

    const b64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
    try {
      const { data } = await api.post('/api/annotation/frame', {
        image_base64: b64,
        etat:         selectedEtat,
        session_id:   contribId,
      })
      return data
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erreur envoi')
      return false
    }
  }

  /* Capture manuelle */
  async function handleCapture() {
    if (capturing) return
    setCapturing(true)
    const result = await captureFrame()
    if (result) { setAutoCount(c => c + 1); loadStats() }
    setCapturing(false)
  }

  /* Auto-capture × 10 */
  async function handleAutoCapture() {
    if (autoRunning) {
      clearInterval(autoRef.current)
      setAutoRunning(false)
      return
    }
    setAutoRunning(true)
    setAutoCount(0)
    let count = 0
    autoRef.current = setInterval(async () => {
      if (count >= 10) {
        clearInterval(autoRef.current)
        setAutoRunning(false)
        toast.success('10 frames capturées !')
        loadStats()
        return
      }
      const result = await captureFrame()
      if (result) { count++; setAutoCount(count) }
    }, 800)
  }

  useEffect(() => () => stopCamera(), [])

  /* ── Couleur / label du détecteur ── */
  const detectorColor = detectorState === 'ready'
    ? (lastFaceFound === true ? '#10B981' : lastFaceFound === false ? '#F97316' : '#3B82F6')
    : detectorState === 'loading' ? '#F59E0B'
    : detectorState === 'error'   ? '#9CA3AF'
    : '#9CA3AF'

  const detectorLabel = detectorState === 'loading' ? 'Chargement détecteur…'
    : detectorState === 'error' ? 'Détecteur indisponible (crop centre)'
    : lastFaceFound === true    ? 'Visage détecté ✓'
    : lastFaceFound === false   ? 'Aucun visage — crop centré'
    : detectorState === 'ready' ? 'Centrez votre visage'
    : ''

  const etatInfo = ETATS.find(e => e.id === selectedEtat)

  return (
    <div style={{ minHeight: '100vh', background: '#FAF7F4', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #3D1F13, #6B3A2A)',
        padding: '16px 24px', color: 'white',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 9,
          padding: '7px 12px', color: 'white', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <ArrowLeft size={14}/> Retour
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 900 }}>
            Collecte de données — Émotions
          </h1>
          <p style={{ margin: 0, fontSize: 11, opacity: .7 }}>
            Aide à entraîner un modèle IA adapté aux visages africains
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: xs ? '14px 10px' : '24px 16px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>

        {/* ── Colonne gauche : sélection état ── */}
        <div style={{ flex: '1 1 360px', minWidth: 0 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: '#6B3A2A', margin: '0 0 12px' }}>
            1. Choisis un état à exprimer
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            {ETATS.map(etat => {
              const count  = stats?.par_etat?.[etat.id] || 0
              const target = stats?.target_par_etat || TARGET
              const pct    = Math.min(100, Math.round(count / target * 100))
              const done   = count >= target
              return (
                <button
                  key={etat.id}
                  onClick={() => setSelectedEtat(etat.id)}
                  style={{
                    padding: '12px', borderRadius: 14, cursor: done ? 'default' : 'pointer',
                    border: `2px solid ${selectedEtat === etat.id ? etat.color : 'transparent'}`,
                    background: selectedEtat === etat.id ? etat.bg : '#fff',
                    textAlign: 'left', transition: 'all .15s',
                    boxShadow: selectedEtat === etat.id ? `0 0 0 3px ${etat.color}20` : '0 1px 4px rgba(0,0,0,.07)',
                  }}
                >
                  <div style={{ fontSize: 22, marginBottom: 4 }}>{etat.emoji}</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: etat.color, lineHeight: 1.3 }}>{etat.label}</div>
                  <div style={{ marginTop: 6, height: 4, background: '#E5E7EB', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: done ? '#10B981' : etat.color, borderRadius: 4, transition: 'width .5s' }}/>
                  </div>
                  <div style={{ fontSize: 10, color: '#6B7280', marginTop: 3, display: 'flex', justifyContent: 'space-between' }}>
                    <span>{count}/{target} frames</span>
                    {done && <span style={{ color: '#10B981', fontWeight: 800 }}>✓ Complet</span>}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Consigne */}
          {etatInfo && (
            <div style={{
              background: etatInfo.bg, borderRadius: 14, padding: '14px 16px',
              border: `1.5px solid ${etatInfo.color}30`, marginBottom: 16,
            }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: etatInfo.color, margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: .5 }}>
                {etatInfo.emoji} Consigne
              </p>
              <p style={{ fontSize: 13, color: '#1A1207', margin: 0, lineHeight: 1.6 }}>
                {etatInfo.consigne}
              </p>
            </div>
          )}
        </div>

        {/* ── Colonne droite : caméra + capture ── */}
        <div style={{ flex: '1 1 320px', minWidth: 0 }}>
          <h2 style={{ fontSize: 14, fontWeight: 800, color: '#6B3A2A', margin: '0 0 12px' }}>
            2. Capture tes expressions
          </h2>

          {/* Feed caméra */}
          <div style={{
            aspectRatio: '4/3', background: '#1A1207', borderRadius: 16,
            overflow: 'hidden', position: 'relative', marginBottom: 8,
          }}>
            <video ref={videoRef} autoPlay playsInline muted
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: cameraActive ? 'block' : 'none' }}
            />
            <canvas ref={canvasRef} style={{ display: 'none' }}/>

            {/* Guide oval : cadre visage */}
            {cameraActive && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none',
              }}>
                <div style={{
                  width: '58%', height: '82%',
                  border: `2.5px solid ${detectorColor}`,
                  borderRadius: '50%',
                  boxShadow: `0 0 0 1px ${detectorColor}33`,
                  transition: 'border-color .3s',
                }}/>
              </div>
            )}

            {/* Placeholder caméra inactive */}
            {!cameraActive && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Camera size={32} color="rgba(255,255,255,.3)"/>
                <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, margin: 0 }}>Caméra désactivée</p>
              </div>
            )}

            {/* Compteur auto */}
            {autoRunning && (
              <div style={{
                position: 'absolute', top: 10, right: 10,
                background: 'rgba(0,0,0,.7)', borderRadius: 20, padding: '4px 12px',
                color: 'white', fontSize: 13, fontWeight: 800,
              }}>
                {autoCount}/10
              </div>
            )}

            {/* Badge état */}
            {selectedEtat && cameraActive && (
              <div style={{
                position: 'absolute', bottom: 8, left: 8,
                background: `${etatInfo?.color}CC`, borderRadius: 20, padding: '3px 10px',
                fontSize: 11, fontWeight: 800, color: 'white',
              }}>
                {etatInfo?.emoji} {etatInfo?.label}
              </div>
            )}
          </div>

          {/* Indicateur détecteur visage */}
          {cameraActive && detectorLabel && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
              padding: '6px 10px', borderRadius: 8,
              background: `${detectorColor}15`, border: `1px solid ${detectorColor}30`,
            }}>
              <User size={12} color={detectorColor}/>
              <span style={{ fontSize: 11, color: detectorColor, fontWeight: 700 }}>
                {detectorLabel}
              </span>
              {detectorState === 'loading' && (
                <div style={{ marginLeft: 'auto', width: 10, height: 10, border: '2px solid #F59E0B', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}/>
              )}
            </div>
          )}

          {/* Boutons caméra */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {!cameraActive ? (
              <button onClick={startCamera} style={{
                flex: 1, padding: '11px',
                background: 'linear-gradient(135deg, #6B3A2A, #8B5A42)',
                color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}>
                <Camera size={15}/> Activer la caméra
              </button>
            ) : (
              <button onClick={stopCamera} style={{
                flex: 1, padding: '11px', background: '#F3F4F6',
                color: '#6B7280', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
              }}>
                Arrêter la caméra
              </button>
            )}
          </div>

          {/* Boutons de capture */}
          {cameraActive && selectedEtat && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                onClick={handleCapture}
                disabled={capturing}
                style={{
                  padding: '13px', background: capturing ? '#E5E7EB' : etatInfo?.color,
                  color: capturing ? '#6B7280' : 'white', border: 'none', borderRadius: 12,
                  fontSize: 14, fontWeight: 800, cursor: capturing ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: capturing ? 'none' : `0 4px 16px ${etatInfo?.color}40`,
                }}
              >
                <Camera size={16}/>
                {capturing ? 'Envoi…' : 'Capturer 1 frame'}
              </button>

              <button
                onClick={handleAutoCapture}
                style={{
                  padding: '11px',
                  background: autoRunning ? '#FEE2E2' : '#F0FDF4',
                  color: autoRunning ? '#EF4444' : '#10B981',
                  border: `1.5px solid ${autoRunning ? '#EF444440' : '#10B98140'}`,
                  borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <RefreshCw size={14} style={{ animation: autoRunning ? 'spin 1s linear infinite' : 'none' }}/>
                {autoRunning ? `Arrêter (${autoCount}/10)` : 'Auto-capture × 10 frames'}
              </button>

              <p style={{ fontSize: 11, color: '#6B7280', margin: '4px 0 0', textAlign: 'center' }}>
                Varie légèrement l'expression entre chaque capture pour la diversité.
              </p>
            </div>
          )}

          {/* Guide sélection état */}
          {!selectedEtat && cameraActive && (
            <div style={{ background: '#FFFBEB', borderRadius: 12, padding: '12px 14px', border: '1px solid #FDE68A' }}>
              <p style={{ fontSize: 12, color: '#92400E', margin: 0, fontWeight: 600 }}>
                ← Sélectionne un état affectif à gauche pour commencer la capture.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Progression globale */}
      {stats && (
        <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 16px 32px' }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: '16px 20px', border: '1px solid #E8D5C4', boxShadow: '0 2px 8px rgba(107,58,42,.07)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 13, fontWeight: 800, color: '#6B3A2A' }}>Progression globale du dataset</h3>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6B7280' }}>
                {stats.total} / {(stats.target_par_etat || TARGET) * ETATS.length} frames totales
              </span>
            </div>
            <div style={{ height: 8, background: '#E5E7EB', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 8,
                width: `${Math.round(stats.total / ((stats.target_par_etat || TARGET) * ETATS.length) * 100)}%`,
                background: 'linear-gradient(90deg, #6B3A2A, #10B981)',
                transition: 'width .5s',
              }}/>
            </div>
            {stats.pret_entrainement && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8, color: '#10B981' }}>
                <CheckCircle size={16}/>
                <span style={{ fontSize: 13, fontWeight: 800 }}>
                  Dataset prêt pour l'entraînement ! Lance : python scripts/train_emotion_model.py
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
