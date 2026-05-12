/**
 * Collecte de clips audio labellisés pour entraîner le modèle KWS
 * (Keyword Spotting) en français camerounais.
 *
 * Flux : sélection commande → countdown 3-2-1 → enregistrement 2s →
 *        écoute → soumettre ou recommencer
 *
 * Accès : tout utilisateur connecté (contribution volontaire)
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import api from '../services/api'
import toast from 'react-hot-toast'
import { Mic, MicOff, Play, RotateCcw, Send, CheckCircle } from 'lucide-react'
import { C, useTheme } from '../styles/theme.jsx'

/* ── Commandes à collecter ──────────────────────────────────── */
const COMMANDES = [
  {
    id: 'aide',
    label: 'Aide',
    phrase: '"Aide"',
    consigne: 'Dis simplement le mot "Aide" d\'une voix naturelle, comme si tu demandais de l\'aide.',
    emoji: '🆘',
    color: C.red,
  },
  {
    id: 'oui',
    label: 'Oui',
    phrase: '"Oui"',
    consigne: 'Dis "Oui" clairement. Tu peux aussi dire "Oui oui" ou "Ouais".',
    emoji: '✅',
    color: C.emerald,
  },
  {
    id: 'non',
    label: 'Non',
    phrase: '"Non"',
    consigne: 'Dis "Non" clairement. Tu peux aussi dire "Non non".',
    emoji: '❌',
    color: '#EF4444',
  },
  {
    id: 'repeter',
    label: 'Répétez',
    phrase: '"Répétez" ou "Répète"',
    consigne: 'Dis "Répétez" comme pour demander qu\'on recommence une explication.',
    emoji: '🔁',
    color: C.brown,
  },
  {
    id: 'incompris',
    label: 'Je ne comprends pas',
    phrase: '"Je ne comprends pas"',
    consigne: 'Dis "Je ne comprends pas" naturellement. Tu peux abréger : "J\'comprends pas".',
    emoji: '🤔',
    color: '#F59E0B',
  },
  {
    id: 'lentement',
    label: 'Plus lentement',
    phrase: '"Plus lentement"',
    consigne: 'Dis "Plus lentement" comme pour demander à quelqu\'un de ralentir.',
    emoji: '🐢',
    color: '#6366F1',
  },
  {
    id: 'bruit_silence',
    label: 'Bruit / Silence',
    phrase: 'Ne dis rien (ou parle d\'autre chose)',
    consigne: 'Reste silencieux, ou parle de quelque chose d\'autre (pas une commande). Ces exemples négatifs sont essentiels pour le modèle.',
    emoji: '🔇',
    color: C.textSec,
  },
]

const TARGET = 100

/* ── Encodage WAV 16kHz mono ────────────────────────────────── */
function encodeWAV(samples, sampleRate) {
  const buf  = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buf)
  const ws   = (off, str) => { for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i)) }
  ws(0, 'RIFF');  view.setUint32(4,  36 + samples.length * 2, true)
  ws(8, 'WAVE');  ws(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true);  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true)
  view.setUint16(34, 16, true); ws(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }
  return buf
}

async function blobToWav16k(blob) {
  const ab  = await blob.arrayBuffer()
  const ctx = new AudioContext()
  const buf = await ctx.decodeAudioData(ab)
  await ctx.close()
  const SR      = 16000
  const offCtx  = new OfflineAudioContext(1, Math.ceil(buf.duration * SR), SR)
  const src     = offCtx.createBufferSource()
  src.buffer    = buf
  src.connect(offCtx.destination)
  src.start(0)
  const resampled = await offCtx.startRendering()
  return encodeWAV(resampled.getChannelData(0), SR)
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary  = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

/* ── Barre de niveau VU ─────────────────────────────────────── */
function VUMeter({ analyser, active }) {
  const { C } = useTheme()
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)

  useEffect(() => {
    if (!active || !analyser || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx2d  = canvas.getContext('2d')
    const buf    = new Uint8Array(analyser.fftSize)

    function draw() {
      analyser.getByteTimeDomainData(buf)
      const rms = Math.sqrt(buf.reduce((s, v) => s + (v - 128) ** 2, 0) / buf.length)
      const pct = Math.min(1, rms / 30)

      ctx2d.clearRect(0, 0, canvas.width, canvas.height)
      // Fond
      ctx2d.fillStyle = '#E5E7EB'
      ctx2d.fillRect(0, 0, canvas.width, canvas.height)
      // Barre
      const grad = ctx2d.createLinearGradient(0, 0, canvas.width * pct, 0)
      grad.addColorStop(0, C.emerald)
      grad.addColorStop(0.7, '#F59E0B')
      grad.addColorStop(1, C.red)
      ctx2d.fillStyle = grad
      ctx2d.fillRect(0, 0, canvas.width * pct, canvas.height)

      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, analyser])

  return (
    <canvas
      ref={canvasRef}
      width={280} height={10}
      style={{ width: '100%', height: 10, borderRadius: 5, display: 'block' }}
    />
  )
}

/* ══════════════════════════════════════════════════════════════ */
export default function AudioCollection() {
  const { C } = useTheme()
  const { user } = useSelector(s => s.auth)

  const [stats,        setStats]        = useState(null)
  const [selectedCmd,  setSelectedCmd]  = useState(COMMANDES[0])
  const [phase,        setPhase]        = useState('idle')   // idle|countdown|recording|review
  const [countdown,    setCountdown]    = useState(3)
  const [audioB64,     setAudioB64]     = useState(null)
  const [audioUrl,     setAudioUrl]     = useState(null)
  const [submitting,   setSubmitting]   = useState(false)
  const [vuActive,     setVuActive]     = useState(false)

  const mediaRecRef  = useRef(null)
  const chunksRef    = useRef([])
  const analyserRef  = useRef(null)
  const streamRef    = useRef(null)

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/api/annotation/audio/stats')
      setStats(data)
    } catch {}
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  /* ── Lancement enregistrement ──────────────────────────────── */
  async function lancerEnregistrement() {
    setPhase('countdown')
    setAudioB64(null)
    setAudioUrl(null)

    // Countdown 3-2-1
    for (let i = 3; i > 0; i--) {
      setCountdown(i)
      await new Promise(r => setTimeout(r, 900))
    }
    setCountdown(0)

    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // VU meter
      const ctx      = new AudioContext()
      const source   = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      setVuActive(true)

      const mr  = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      mr.onstop = async () => {
        setVuActive(false)
        stream.getTracks().forEach(t => t.stop())
        ctx.close()
        try {
          if (!chunksRef.current.length) throw new Error('aucun chunk audio capturé')
          const blob   = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
          const wavBuf = await blobToWav16k(blob)
          const b64    = arrayBufferToBase64(wavBuf)
          setAudioB64(b64)
          const playUrl = URL.createObjectURL(new Blob([wavBuf], { type: 'audio/wav' }))
          setAudioUrl(playUrl)
          setPhase('review')
        } catch (err) {
          toast.error('Erreur de traitement audio : ' + (err?.message || String(err)))
          setPhase('idle')
        }
      }

      mediaRecRef.current = mr
      mr.start(100)
      setPhase('recording')

      // Stop automatique après 3s
      setTimeout(() => { if (mr.state === 'recording') mr.stop() }, 3000)

    } catch {
      toast.error('Micro non disponible')
      setPhase('idle')
    }
  }

  function recommencer() {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
    setAudioB64(null); setAudioUrl(null); setPhase('idle')
  }

  async function soumettre() {
    if (!audioB64 || submitting) return
    setSubmitting(true)
    try {
      const { data } = await api.post('/api/annotation/audio', {
        audio_base64: audioB64,
        commande:     selectedCmd.id,
      })
      toast.success(`✓ ${data.total}/${TARGET} pour "${selectedCmd.label}"`)
      if (audioUrl) URL.revokeObjectURL(audioUrl)
      setAudioB64(null); setAudioUrl(null); setPhase('idle')
      fetchStats()
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Erreur envoi')
    } finally {
      setSubmitting(false)
    }
  }

  const cmd    = selectedCmd
  const count  = stats?.par_commande?.[cmd.id] ?? 0
  const pct    = Math.min(100, Math.round(count / TARGET * 100))
  const total  = stats?.total ?? 0
  const pret   = stats?.pret_entrainement ?? false

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, #1A0F08, #3D1F13)`, padding: '20px 24px', color: 'white' }}>
        <p style={{ fontSize: 11, opacity: .6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>
          Collecte audio · KWS
        </p>
        <h1 style={{ fontSize: 20, fontWeight: 900, margin: '0 0 6px' }}>Entraînement commandes vocales</h1>
        <p style={{ fontSize: 12, opacity: .7, margin: 0 }}>
          Enregistre chaque commande pour entraîner le modèle de reconnaissance vocale en français camerounais.
        </p>
        {/* Barre globale */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, opacity: .7 }}>Progression globale</span>
            <span style={{ fontSize: 11, fontWeight: 800 }}>{total} / {TARGET * COMMANDES.length}</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,.15)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 3, width: `${Math.round(total / (TARGET * COMMANDES.length) * 100)}%`, background: 'linear-gradient(90deg, #F0B429, #00C9A7)', transition: 'width .5s' }}/>
          </div>
          {pret && (
            <div style={{ marginTop: 8, padding: '6px 12px', background: 'rgba(0,201,167,.2)', borderRadius: 8, fontSize: 12, fontWeight: 700, color: '#00C9A7' }}>
              ✅ Dataset complet — prêt pour l'entraînement !
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Grille commandes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {COMMANDES.map(c => {
            const n   = stats?.par_commande?.[c.id] ?? 0
            const p   = Math.min(100, Math.round(n / TARGET * 100))
            const sel = c.id === cmd.id
            return (
              <button key={c.id} onClick={() => { setSelectedCmd(c); setPhase('idle'); setAudioB64(null) }}
                style={{
                  background: sel ? `${c.color}18` : C.surface,
                  border: `2px solid ${sel ? c.color : C.brownPale}`,
                  borderRadius: 14, padding: '12px', cursor: 'pointer', textAlign: 'left',
                  transition: 'all .15s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>{c.emoji}</span>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: sel ? c.color : C.text, margin: 0 }}>{c.label}</p>
                    <p style={{ fontSize: 10, color: C.textSec, margin: 0 }}>{n}/{TARGET}</p>
                  </div>
                </div>
                <div style={{ height: 4, background: '#E5E7EB', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p}%`, background: c.color, borderRadius: 2, transition: 'width .4s' }}/>
                </div>
              </button>
            )
          })}
        </div>

        {/* Zone d'enregistrement */}
        <div style={{ background: C.surface, borderRadius: 20, padding: '24px', border: `1px solid ${C.brownPale}`, boxShadow: '0 2px 16px rgba(107,58,42,0.08)' }}>

          {/* Consigne */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, padding: '12px 16px', background: `${cmd.color}10`, borderRadius: 12, border: `1px solid ${cmd.color}30` }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>{cmd.emoji}</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: cmd.color, margin: '0 0 4px' }}>{cmd.label}</p>
              <p style={{ fontSize: 13, color: C.text, margin: '0 0 4px', fontWeight: 700 }}>Dire : {cmd.phrase}</p>
              <p style={{ fontSize: 12, color: C.textSec, margin: 0, lineHeight: 1.6 }}>{cmd.consigne}</p>
            </div>
          </div>

          {/* Interface enregistrement */}
          <div style={{ textAlign: 'center' }}>

            {/* Countdown */}
            {phase === 'countdown' && (
              <div style={{ margin: '20px 0' }}>
                <div style={{ fontSize: countdown > 0 ? 72 : 40, fontWeight: 900, color: cmd.color, lineHeight: 1, animation: 'pulse 0.5s ease', transition: 'font-size .2s' }}>
                  {countdown > 0 ? countdown : '🎙'}
                </div>
                <p style={{ fontSize: 13, color: C.textSec, marginTop: 8 }}>
                  {countdown > 0 ? 'Prépare-toi…' : 'Enregistrement !'}
                </p>
              </div>
            )}

            {/* Enregistrement en cours */}
            {phase === 'recording' && (
              <div style={{ margin: '16px 0' }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: `${C.red}18`, border: `3px solid ${C.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', animation: 'pulse 1s infinite' }}>
                  <Mic size={28} color={C.red}/>
                </div>
                <p style={{ fontSize: 13, fontWeight: 800, color: C.red, margin: '0 0 10px' }}>⏺ Enregistrement (2s)…</p>
                <VUMeter analyser={analyserRef.current} active={vuActive}/>
                <p style={{ fontSize: 11, color: C.textSec, marginTop: 8 }}>Parle maintenant</p>
              </div>
            )}

            {/* Révision */}
            {phase === 'review' && audioUrl && (
              <div style={{ margin: '16px 0' }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 12px' }}>Écoute avant d'envoyer :</p>
                <audio src={audioUrl} controls style={{ width: '100%', marginBottom: 12 }}/>
              </div>
            )}

            {/* Idle */}
            {phase === 'idle' && (
              <div style={{ margin: '8px 0 16px' }}>
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.brownPale, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                  <MicOff size={24} color={C.textSec}/>
                </div>
                <p style={{ fontSize: 12, color: C.textSec }}>Prêt à enregistrer</p>
              </div>
            )}

            {/* Boutons d'action */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
              {(phase === 'idle' || phase === 'review') && (
                <button
                  onClick={phase === 'review' ? recommencer : lancerEnregistrement}
                  style={{ padding: '11px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, background: phase === 'review' ? C.brownPale : `linear-gradient(135deg, ${cmd.color}, ${cmd.color}cc)`, color: phase === 'review' ? C.brown : 'white', display: 'flex', alignItems: 'center', gap: 7, minHeight: 44 }}>
                  {phase === 'review' ? <><RotateCcw size={14}/> Recommencer</> : <><Mic size={14}/> Enregistrer</>}
                </button>
              )}
              {phase === 'review' && (
                <button
                  onClick={soumettre}
                  disabled={submitting}
                  style={{ padding: '11px 22px', borderRadius: 12, border: 'none', cursor: submitting ? 'wait' : 'pointer', fontSize: 13, fontWeight: 800, background: submitting ? '#E5E7EB' : `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`, color: submitting ? C.textSec : 'white', display: 'flex', alignItems: 'center', gap: 7, minHeight: 44, boxShadow: submitting ? 'none' : `0 4px 14px ${C.emerald}40` }}>
                  {submitting ? 'Envoi…' : <><Send size={14}/> Soumettre</>}
                </button>
              )}
            </div>
          </div>

          {/* Progression commande courante */}
          <div style={{ marginTop: 20, padding: '12px 14px', background: C.brownPale, borderRadius: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.brown }}>{cmd.label}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: cmd.color }}>{count}/{TARGET} ({pct}%)</span>
            </div>
            <div style={{ height: 6, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: cmd.color, borderRadius: 3, transition: 'width .5s' }}/>
            </div>
            {count >= TARGET && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                <CheckCircle size={14} color={C.emerald}/>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.emerald }}>Quota atteint !</span>
              </div>
            )}
          </div>
        </div>

        {/* Instructions générales */}
        <div style={{ background: C.surface, borderRadius: 14, padding: '16px', border: `1px solid ${C.brownPale}` }}>
          <p style={{ fontSize: 12, fontWeight: 800, color: C.brown, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: .5 }}>💡 Conseils pour de bons enregistrements</p>
          {[
            'Parle à voix normale, dans ta langue habituelle (accent camerounais bienvenu !)',
            'Varie légèrement le ton et la vitesse d\'un enregistrement à l\'autre',
            'Enregistre dans plusieurs environnements : chambre calme, classe, extérieur',
            'Pour "Bruit/Silence" : laisse juste le micro ouvert sans parler, ou parle d\'autre chose',
          ].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <span style={{ color: C.brownLight, fontWeight: 900, flexShrink: 0 }}>→</span>
              <p style={{ fontSize: 12, color: C.textSec, margin: 0, lineHeight: 1.6 }}>{t}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
