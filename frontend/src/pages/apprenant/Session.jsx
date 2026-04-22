import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Camera, Lightbulb, CheckCircle, XCircle,
  ChevronRight, Home, ArrowLeft, Zap
} from 'lucide-react'

const C = {
  brown:       '#6B3A2A', brownLight:  '#C4865A',
  emerald:     '#0D9373', bg:          '#FAF7F4',
  surface:     '#FFFFFF', text:        '#1A1207',
  textSec:     '#6B5744', brownPale:   '#F5EDE5',
  emeraldPale: '#E6F5F0', red:         '#DC2626',
  orange:      '#F59E0B', gold:        '#D4A853',
}

// ── Engagement — 5 niveaux conformes au mémoire ───────────────────
const engColor = s =>
  s >= 0.80 ? C.emerald :
  s >= 0.60 ? '#2563eb' :
  s >= 0.40 ? C.orange  :
  s >= 0.20 ? C.red     : '#7F1D1D'

const engLabel = s =>
  s >= 0.80 ? 'Engagement élevé'  :
  s >= 0.60 ? 'Engagement modéré' :
  s >= 0.40 ? 'Engagement faible' :
  s >= 0.20 ? 'Ennui'             : 'Décrochage'

// ── États affectifs académiques (FACS / Ekman & Friesen) ──────────
// Labels conformes au mémoire — Section III-4
const ETATS = {
  engagement_eleve:  { label: '😊 Engagé',      color: C.emerald    },
  engagement_modere: { label: '🙂 Modéré',       color: '#2563eb'    },
  engagement_faible: { label: '😐 Peu engagé',   color: C.orange     },
  confusion:         { label: '🤔 Confusion',    color: C.orange     },
  frustration:       { label: '😤 Frustration',  color: C.red        },
  ennui:             { label: '😴 Ennui',         color: C.textSec    },
  neutre:            { label: '😐 Neutre',        color: C.brownLight },
  decrochage:        { label: '⚠️ Décrochage',   color: '#7F1D1D'    },
}

/**
 * Détecte l'état affectif depuis les 468 landmarks MediaPipe.
 * Basé sur les Action Units (AU) du système FACS.
 *
 * @param {Array} lm - Tableau de 468 landmarks {x, y, z}
 * @param {number} ear - Eye Aspect Ratio déjà calculé
 * @param {number} yaw - Rotation horizontale tête (degrés)
 * @param {number} pitch - Inclinaison tête (degrés)
 * @returns {string} - 'joie' | 'surprise' | 'frustration' | 'ennui' | 'neutre'
 */
function detecterEmotion(lm, ear, yaw, pitch) {
  // ── Sourire (AU6 + AU12) ────────────────────────────────────────
  // Commissures lèvres (61=gauche, 291=droite) vs centre lèvre sup (0)
  // Si les coins de la bouche sont levés → joie
  const coinGauche   = lm[61]
  const coinDroit    = lm[291]
  const centreLevreH = lm[0]
  const sourire = (centreLevreH.y - coinGauche.y + centreLevreH.y - coinDroit.y) / 2
  const joie = sourire > 0.015  // seuil empirique normalisé

  // ── MAR — Mouth Aspect Ratio ────────────────────────────────────
  // Ouverture verticale bouche : lm[13] (haut) vs lm[14] (bas)
  // Largeur bouche : lm[61] vs lm[291]
  const hBouche = Math.abs(lm[13].y - lm[14].y)
  const lBouche = Math.abs(lm[61].x - lm[291].x)
  const mar = lBouche > 0 ? hBouche / lBouche : 0

  // ── Sourcils levés (AU1 + AU2) ──────────────────────────────────
  // lm[70] = sourcil gauche | lm[300] = sourcil droit | lm[9] = pont nez
  const hSourceilG = lm[9].y - lm[70].y
  const hSourceilD = lm[9].y - lm[300].y
  const sourcilsLeves = (hSourceilG + hSourceilD) / 2 > 0.06

  // ── Sourcils froncés (AU4) ──────────────────────────────────────
  // lm[21] et lm[22] = glabelle (entre sourcils)
  const distGlabelle = Math.abs(lm[21].x - lm[22].x)
  const sourcilsFronced = distGlabelle < 0.025

  // ── Décision finale — états affectifs académiques FACS ──────────
  // Ennui/fatigue : EAR bas + tête inclinée
  if (ear < 0.22 && Math.abs(pitch) > 12) return 'ennui'

  // Confusion : bouche ouverte + sourcils levés (surprise en contexte scolaire)
  if (mar > 0.45 && sourcilsLeves) return 'confusion'

  // Engagement élevé : sourire détecté
  if (joie) return 'engagement_eleve'

  // Frustration : sourcils froncés + regard pas trop détourné
  if (sourcilsFronced && Math.abs(yaw) < 20) return 'frustration'

  // Engagement faible : regard détourné
  if (Math.abs(yaw) > 25) return 'engagement_faible'

  return 'neutre'
}

// ── Composants UI ─────────────────────────────────────────────────
const Dot = ({ score }) => (
  <span style={{
    display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
    backgroundColor: engColor(score),
    boxShadow: `0 0 0 3px ${engColor(score)}30`,
    animation: 'pulse 2s infinite'
  }}/>
)

const EngagementGauge = ({ score, emotion }) => {
  const r = 32, circ = 2 * Math.PI * r
  const color = engColor(score)
  const em = ETATS[emotion] || ETATS.neutre
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: 90, height: 90 }}>
        <svg width={90} height={90} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={45} cy={45} r={r} fill="none" stroke="#E5E7EB" strokeWidth={7}/>
          <circle cx={45} cy={45} r={r} fill="none" stroke={color} strokeWidth={7}
            strokeDasharray={circ} strokeDashoffset={circ - score * circ}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset .6s ease, stroke .3s ease' }}/>
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{ fontSize: 18, fontWeight: 900, color, lineHeight: 1 }}>
            {Math.round(score * 100)}
          </span>
          <span style={{ fontSize: 9, color: C.textSec, fontWeight: 600 }}>%</span>
        </div>
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, textAlign: 'center' }}>
        {engLabel(score)}
      </span>
      {/* Émotion détectée */}
      <div style={{
        backgroundColor: `${em.color}15`, borderRadius: 20,
        padding: '3px 10px', border: `1px solid ${em.color}30`,
        fontSize: 11, fontWeight: 700, color: em.color,
        marginTop: 2
      }}>
        {em.label}
      </div>
    </div>
  )
}

const ExerciceOption = ({ lettre, texte, selected, correct, incorrect, onClick }) => {
  let bg = C.surface, border = `1px solid ${C.brownPale}`, color = C.text
  let lBg = '#E5E7EB', lColor = C.textSec
  if (selected && !correct && !incorrect) { bg=C.brownPale; border=`2px solid ${C.brown}`; color=C.brown; lBg=C.brown; lColor='white' }
  if (correct)   { bg=C.emeraldPale; border=`2px solid ${C.emerald}`; color=C.emerald; lBg=C.emerald; lColor='white' }
  if (incorrect) { bg='#FEE2E2';    border=`2px solid ${C.red}`;    color=C.red;    lBg=C.red;    lColor='white' }
  return (
    <button onClick={onClick} style={{
      width:'100%', padding:'14px 16px', backgroundColor:bg, border, borderRadius:12,
      cursor: correct||incorrect ? 'default' : 'pointer', textAlign:'left',
      display:'flex', alignItems:'center', gap:14, transition:'all .15s ease', color
    }}>
      <span style={{ width:28,height:28,borderRadius:8,flexShrink:0,backgroundColor:lBg,color:lColor,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900 }}>{lettre}</span>
      <span style={{ fontSize:14,fontWeight:600,lineHeight:1.4 }}>{texte}</span>
      {correct   && <CheckCircle size={16} color={C.emerald} style={{marginLeft:'auto',flexShrink:0}}/>}
      {incorrect && <XCircle     size={16} color={C.red}     style={{marginLeft:'auto',flexShrink:0}}/>}
    </button>
  )
}

const Confetti = () => {
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i, color: [C.brown,C.brownLight,C.emerald,C.gold,'#FCD34D','#EC4899'][i%6],
    left: `${Math.random()*100}%`, delay: `${Math.random()*2}s`,
    duration: `${2.5+Math.random()*2}s`, size: Math.random()*10+5,
  }))
  return (
    <div style={{ position:'fixed',inset:0,pointerEvents:'none',zIndex:999 }}>
      {pieces.map(p => (
        <div key={p.id} style={{
          position:'absolute',top:0,left:p.left,width:p.size,height:p.size,
          backgroundColor:p.color,borderRadius:p.size/4,
          animation:`confettiFall ${p.duration} ${p.delay} ease-in both`,
        }}/>
      ))}
    </div>
  )
}

// ── Page Session ──────────────────────────────────────────────────
export default function Session() {
  const { uaId }     = useParams()
  const navigate     = useNavigate()
  const { user }     = useSelector(s => s.auth)
  const sessionIdRef = useRef(null)

  // Données cours
  const [ua, setUA]               = useState(null)
  const [exercices, setExercices] = useState([])

  // Navigation exercices
  const [current, setCurrent]     = useState(0)
  const [reponse, setReponse]     = useState(null)
  const [resultat, setResultat]   = useState(null)
  const [indices, setIndices]     = useState(0)
  const [termine, setTermine]     = useState(false)
  const [scores, setScores]       = useState([])
  const [startTime]               = useState(Date.now())
  const [questionTime, setQuestionTime] = useState(Date.now())
  const [confetti, setConfetti]   = useState(false)
  const [adaptation, setAdaptation] = useState(null)

  // ── Engagement fusionné (score retourné par /api/interaction) ──
  // C'est le vrai score S = α·visuel + β·comportemental
  const [engagementScore, setEngagementScore] = useState(0.85)

  // Score visuel local (MediaPipe) — utilisé uniquement pour l'envoi au backend
  const visualScoreRef = useRef(0.85)

  // Émotion détectée depuis les landmarks
  const [emotion, setEmotion] = useState('neutre')

  // MediaPipe
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const faceMeshRef = useRef(null)
  const lastSendRef = useRef(0)
  const [cameraActive, setCameraActive] = useState(false)


const [audioActive,    setAudioActive]    = useState(false)
const [niveauBruit,    setNiveauBruit]    = useState(0)      // dB RMS 0-100
const [bruitPerturb,   setBruitPerturb]   = useState(false)  // bruit > seuil
const audioContextRef  = useRef(null)
const analyserRef      = useRef(null)
const audioIntervalRef = useRef(null)

  // Tuteur IA
  const [explicationIA, setExplicationIA] = useState(null)
  const [loadingIA,     setLoadingIA]     = useState(false)

  // ── Init session ─────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const { data: uaData } = await api.get(`/api/cours/ua/${uaId}`)
        setUA(uaData); setExercices(uaData.exercices || [])
        const { data: sess } = await api.post('/api/cours/session/creer', { user_id: user.id, ua_id: uaId })
        sessionIdRef.current = sess.session_id
      } catch { toast.error('Erreur de chargement') }
    }
    init()
  }, [uaId, user.id])

  // ── Tracker inactivité ────────────────────────────────────────
  useEffect(() => {
    if (!sessionIdRef.current) return
    let timer = null
    function reset() {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const sid = sessionIdRef.current
        if (sid) api.post('/api/interaction', { session_id: sid, user_id: user.id, type: 'idle', data: { duration_seconds: 120 } }).catch(() => {})
      }, 120000)
    }
    const events = ['mousedown','mousemove','keydown','scroll','click']
    events.forEach(e => window.addEventListener(e, reset)); reset()
    return () => { clearTimeout(timer); events.forEach(e => window.removeEventListener(e, reset)) }
  }, [user.id])



  useEffect(() => {
  return () => {
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current)
    if (audioContextRef.current) audioContextRef.current.close()
  }
}, [])


  // ── sendEvent — reçoit le score fusionné et met à jour la jauge ──
  const sendEvent = useCallback(async (type, data = {}) => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      const { data: res } = await api.post('/api/interaction', {
        session_id: sid, user_id: user.id, type, data
      })
      // ← Met à jour la jauge avec le VRAI score fusionné retourné par le backend
      if (res.engagement_score !== undefined) {
        setEngagementScore(res.engagement_score)
      }
      if (res.adaptation) setAdaptation(res.adaptation)
    } catch {}
  }, [user.id])

  // ── MediaPipe ─────────────────────────────────────────────────
  async function startCamera() {
    let attempts = 0
    while ((!window.FaceMesh || !window.Camera) && attempts < 10) {
      await new Promise(r => setTimeout(r, 500)); attempts++
    }
    if (!window.FaceMesh || !window.Camera) { toast.error('MediaPipe non disponible'); return }
    try {
      const fm = new window.FaceMesh({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}` })
      fm.setOptions({ maxNumFaces:1, refineLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5 })
      fm.onResults(onFaceResults); faceMeshRef.current = fm
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width:320, height:240 } })
      videoRef.current.srcObject = stream
      const cam = new window.Camera(videoRef.current, {
        onFrame: async () => { if (faceMeshRef.current && videoRef.current) await faceMeshRef.current.send({ image: videoRef.current }) },
        width:320, height:240
      })
      await cam.start(); setCameraActive(true); toast.success('Analyse visuelle activée')
    } catch { toast.error('Caméra non disponible') }
  }

  async function startAudio() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const ctx    = new (window.AudioContext || window.webkitAudioContext)()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)
    audioContextRef.current = ctx
    analyserRef.current     = analyser

    // Analyse toutes les 3 secondes
    audioIntervalRef.current = setInterval(() => {
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(data)

      // Calcul RMS — niveau sonore moyen
      const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length)
      const db  = Math.round(rms)  // 0-128, normalisé en %

      // Seuil bruit perturbateur : > 60 sur 128 = ~47%
      const perturb = db > 60

      setNiveauBruit(db)
      setBruitPerturb(perturb)

      // Envoi au backend
      sendEvent('audio_analysis', {
        rms_level:    db,
        db_normalise: Math.round(db / 1.28), // 0-100
        bruit_perturb: perturb,
        contexte:     perturb ? 'bruit_eleve' : 'calme',
      })
    }, 3000)

    setAudioActive(true)
    toast.success('Analyse audio activée')
  } catch {
    toast.error('Micro non disponible')
  }
}

  function computeEAR(lm, idx) {
    const p = idx.map(i => lm[i])
    return (Math.hypot(p[1].x-p[5].x,p[1].y-p[5].y)+Math.hypot(p[2].x-p[4].x,p[2].y-p[4].y))/(2*Math.hypot(p[0].x-p[3].x,p[0].y-p[3].y))
  }

  function onFaceResults(results) {
    const canvas = canvasRef.current, video = videoRef.current
    if (!canvas || !video) return
    const ctx = canvas.getContext('2d')
    canvas.width = video.videoWidth||320; canvas.height = video.videoHeight||240
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    if (!results.multiFaceLandmarks?.length) {
      visualScoreRef.current = 0.0
      const now = Date.now()
      if (now - lastSendRef.current > 5000) {
        sendEvent('facial_analysis', { visual_score: 0.0, face_detected: false, emotion: 'absent' })
        lastSendRef.current = now
      }
      return
    }
    
    const lm = results.multiFaceLandmarks[0]
    const LEFT_EYE  = [362,385,387,263,373,380]
    const RIGHT_EYE = [33,160,158,133,153,144]
    const ear   = (computeEAR(lm,LEFT_EYE)+computeEAR(lm,RIGHT_EYE))/2
    const yaw   = (lm[1].x-0.5)*180
    const pitch = (lm[1].y-lm[152].y)*200

    // ── Score visuel (engagement attention) ──
    let score = 1.0
    if (ear<0.15) score-=0.5; else if(ear<0.20) score-=0.4; else if(ear<0.25) score-=0.2
    if(Math.abs(yaw)>45) score-=0.4; else if(Math.abs(yaw)>30) score-=0.3; else if(Math.abs(yaw)>15) score-=0.1
    if(Math.abs(pitch)>30) score-=0.2; else if(Math.abs(pitch)>15) score-=0.1
    score = Math.max(0,Math.min(1,score))
    visualScoreRef.current = score

    // ── Détection émotion depuis landmarks ──
    const emotionDetectee = detecterEmotion(lm, ear, yaw, pitch)
    setEmotion(emotionDetectee)

    // ── Envoi au backend toutes les 5s ──
    const now = Date.now()
    if (now - lastSendRef.current > 5000) {
      // sendEvent met à jour engagementScore avec le score fusionné retourné
      sendEvent('facial_analysis', {
        visual_score:  Math.round(score*100)/100,
        ear:           Math.round(ear*100)/100,
        yaw:           Math.round(yaw),
        pitch:         Math.round(pitch),
        face_detected: true,
        emotion:       emotionDetectee,  // ← envoi de l'émotion au backend
      })
      lastSendRef.current = now
    }
  }

  // ── Soumettre réponse ─────────────────────────────────────────
  async function soumettre() {
    if (!reponse) { toast.error('Choisis une réponse'); return }
    const ex = exercices[current]
    const tempsReponse = Math.round((Date.now() - questionTime) / 1000)  // ← temps depuis la question
    try {
      const { data } = await api.post('/api/cours/exercice/verifier', {
        exercice_id: ex.id, user_id: user.id, reponse
      })
      setResultat(data); setScores(prev => [...prev, data.points_gagnes])
      await sendEvent('response', {
        exercice_id:   ex.id,
        correct:       data.correct,
        time_seconds:  tempsReponse,
        emotion:       emotion,  // ← contexte émotionnel au moment de la réponse
      })
      if (data.correct) toast.success(`+${data.points_gagnes} points !`)
    } catch { toast.error('Erreur de vérification') }
  }

  // ── Exercice suivant ──────────────────────────────────────────
  function suivant() {
  if (current + 1 >= exercices.length) {
    const r = scores.filter(s => s > 0).length + (resultat?.correct ? 1 : 0)
    if (Math.round(r / exercices.length * 100) >= 80) setConfetti(true)
    // ← Clôture la session et persiste le score engagement
    if (sessionIdRef.current) {
      api.post(`/api/cours/session/clore/${sessionIdRef.current}`)
        .catch(() => {})
    }
    setTermine(true)
  } else {
    setCurrent(c => c + 1)
    setReponse(null); setResultat(null)
    setIndices(0); setAdaptation(null)
    setExplicationIA(null)
    setQuestionTime(Date.now())
  }
}

  // ── Tuteur IA ─────────────────────────────────────────────────
  async function demanderExplication() {
    if (!resultat || resultat.correct) return
    setLoadingIA(true); setExplicationIA(null)
    try {
      const ex = exercices[current]
      const { data } = await api.post('/api/tuteur/expliquer', {
        exercice_id:    ex.id,
        reponse_donnee: reponse || '',
        niveau:         user?.niveau_label  || 'Première',
        filiere:        user?.filiere_label || 'F6 BIPE',
      })
      setExplicationIA(data.explication_ia)
    } catch { toast.error('Tuteur IA indisponible') }
    finally { setLoadingIA(false) }
  }

  // ── Chargement ────────────────────────────────────────────────
  if (!ua || exercices.length === 0) return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:C.bg }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:44,height:44,borderRadius:'50%',border:`3px solid ${C.brownPale}`,borderTopColor:C.brown,margin:'0 auto 12px',animation:'spin 1s linear infinite' }}/>
        <p style={{ color:C.textSec,fontSize:14,fontWeight:600 }}>Chargement de la session…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Écran de fin ──────────────────────────────────────────────
  if (termine) {
    const total=scores.length, reussis=scores.filter(s=>s>0).length
    const pct=total>0?Math.round(reussis/total*100):0
    const elapsed=Math.max(1,Math.round((Date.now()-startTime)/60000))
    return (
      <div style={{ minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center',padding:24 }}>
        {confetti && <Confetti/>}
        <style>{`@keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}@keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <div style={{ backgroundColor:C.surface,borderRadius:28,padding:44,boxShadow:'0 8px 48px rgba(107,58,42,0.16)',border:`1px solid ${C.brownPale}`,maxWidth:480,width:'100%',textAlign:'center',animation:'fadeIn .5s ease' }}>
          <div style={{ fontSize:68,marginBottom:14 }}>{pct>=80?'🏆':pct>=50?'👍':'💪'}</div>
          <h2 style={{ fontSize:28,fontWeight:900,color:C.brown,marginBottom:8 }}>Session terminée !</h2>
          <p style={{ color:C.textSec,fontSize:14,marginBottom:28 }}>{ua.titre}</p>
          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12,marginBottom:16 }}>
            {[
              {label:'Score',  value:`${pct}%`,         color:pct>=80?C.emerald:C.brownLight},
              {label:'Réussis',value:`${reussis}/${total}`,color:C.brown},
              {label:'Durée',  value:`${elapsed}min`,   color:C.textSec},
            ].map(s=>(
              <div key={s.label} style={{ backgroundColor:C.brownPale,borderRadius:16,padding:'18px 8px' }}>
                <div style={{ fontSize:26,fontWeight:900,color:s.color }}>{s.value}</div>
                <div style={{ fontSize:12,color:C.textSec,fontWeight:600,marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Score engagement final */}
          <div style={{ backgroundColor:C.brownPale,borderRadius:14,padding:'14px',marginBottom:24 }}>
            <p style={{ fontSize:12,color:C.textSec,fontWeight:600,marginBottom:4 }}>Score d'engagement final</p>
            <p style={{ fontSize:22,fontWeight:900,color:engColor(engagementScore) }}>
              {Math.round(engagementScore*100)}% — {engLabel(engagementScore)}
            </p>
            <p style={{ fontSize:11,color:C.textSec,marginTop:4 }}>
              Fusion : α·visuel + β·comportemental
            </p>
          </div>
          <button onClick={()=>navigate('/dashboard')} style={{ width:'100%',padding:'15px',background:`linear-gradient(135deg,${C.brown},${C.brownLight})`,color:'white',border:'none',borderRadius:14,fontSize:15,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,boxShadow:`0 4px 20px ${C.brown}40` }}>
            <Home size={18}/> Retour au tableau de bord
          </button>
        </div>
      </div>
    )
  }

  const ex = exercices[current]
  const diffStyle = {1:{bg:C.emeraldPale,color:C.emerald,label:'Facile'},2:{bg:'#FEF3C7',color:'#92400E',label:'Moyen'},3:{bg:'#FEE2E2',color:C.red,label:'Difficile'}}
  const ds = diffStyle[ex.difficulte]||diffStyle[1]

  return (
    <div style={{ minHeight:'100vh',background:C.bg }}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes confettiFall{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* ── Header ── */}
      <div style={{ backgroundColor:C.surface,borderBottom:`2px solid ${C.brownPale}`,padding:'0 24px',height:60,display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:100,boxShadow:'0 2px 12px rgba(107,58,42,0.08)' }}>
        <div style={{ display:'flex',alignItems:'center',gap:14 }}>
          <button onClick={()=>navigate('/dashboard')} style={{ background:C.brownPale,border:'none',borderRadius:8,padding:'6px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:6,color:C.brown,fontSize:13,fontWeight:700 }}>
            <ArrowLeft size={14}/> Quitter
          </button>
          <div>
            <p style={{ fontSize:11,color:C.textSec,fontWeight:600 }}>{ua.reference_ue} — {ua.titre}</p>
            <p style={{ fontSize:13,fontWeight:800,color:C.text }}>Question {current+1} / {exercices.length}</p>
          </div>
        </div>

        {/* Barre progression */}
        <div style={{ flex:1,maxWidth:260,height:7,backgroundColor:'#E5E7EB',borderRadius:7,overflow:'hidden',margin:'0 20px' }}>
          <div style={{ height:'100%',borderRadius:7,backgroundColor:C.brown,width:`${((current+(resultat?1:0))/exercices.length)*100}%`,transition:'width .4s ease' }}/>
        </div>

        {/* Score engagement fusionné + émotion */}
        <div style={{ display:'flex',alignItems:'center',gap:8,padding:'6px 14px',borderRadius:20,background:C.brownPale }}>
          <Dot score={engagementScore}/>
          <span style={{ fontSize:13,fontWeight:800,color:engColor(engagementScore) }}>
            {Math.round(engagementScore*100)}%
          </span>
          <span style={{ fontSize:12 }}>
            {(ETATS[emotion]||ETATS.neutre).label.split(' ')[0]}
          </span>
        </div>
      </div>

      <div style={{ maxWidth:1060,margin:'0 auto',padding:'24px 20px',display:'flex',gap:20 }}>

        {/* ── Zone exercice ── */}
        <div style={{ flex:1 }}>
          {adaptation && (
            <div style={{ padding:14,borderRadius:12,marginBottom:16,background:adaptation.priority==='haute'?'#FEF2F2':'#FFFBEB',border:`1px solid ${adaptation.priority==='haute'?'#FCA5A5':'#FDE68A'}`,animation:'slideDown .3s ease' }}>
              <p style={{ fontSize:13,fontWeight:700,color:adaptation.priority==='haute'?C.red:'#92400E' }}>{adaptation.priority==='haute'?'⚠️':'💡'} {adaptation.message}</p>
              <button onClick={()=>setAdaptation(null)} style={{ fontSize:11,color:C.textSec,background:'none',border:'none',cursor:'pointer',marginTop:4 }}>Ignorer</button>
            </div>
          )}

          <div style={{ backgroundColor:C.surface,borderRadius:20,padding:34,boxShadow:'0 2px 18px rgba(107,58,42,0.09)',border:`1px solid ${C.brownPale}` }}>
            <div style={{ display:'flex',alignItems:'center',gap:12,marginBottom:22 }}>
              <span style={{ backgroundColor:ds.bg,color:ds.color,padding:'4px 14px',borderRadius:20,fontSize:12,fontWeight:700 }}>{ds.label}</span>
              <span style={{ fontSize:13,color:C.textSec,fontWeight:600 }}>Question {current+1} sur {exercices.length}</span>
              <span style={{ marginLeft:'auto',fontSize:12,color:C.brownLight,fontWeight:700 }}>{ex.points} pts</span>
            </div>

            <div style={{ backgroundColor:C.brownPale,borderRadius:14,padding:'20px 24px',marginBottom:24,borderLeft:`5px solid ${C.brown}` }}>
              <p style={{ margin:0,fontSize:15,fontWeight:700,color:C.text,lineHeight:1.8,whiteSpace:'pre-wrap' }}>{ex.enonce}</p>
            </div>

            {ex.type==='qcm'&&ex.options&&(
              <div style={{ display:'flex',flexDirection:'column',gap:10,marginBottom:20 }}>
                {ex.options.map((opt,i)=>(
                  <ExerciceOption key={i} lettre={String.fromCharCode(65+i)} texte={opt}
                    selected={reponse===opt}
                    correct={!!resultat&&opt===resultat.reponse_correcte}
                    incorrect={!!resultat&&reponse===opt&&!resultat.correct}
                    onClick={()=>!resultat&&setReponse(opt)}/>
                ))}
              </div>
            )}

            {ex.type==='texte_trou'&&(
              <input type="text" placeholder="Complète le texte..." value={reponse||''} onChange={e=>setReponse(e.target.value)} disabled={!!resultat}
                style={{ width:'100%',padding:'12px 16px',border:`1px solid ${C.brownPale}`,borderRadius:10,fontSize:14,marginBottom:20,outline:'none' }}/>
            )}
            {ex.type==='reponse_libre'&&(
              <textarea rows={3} placeholder="Écris ta réponse..." value={reponse||''} onChange={e=>setReponse(e.target.value)} disabled={!!resultat}
                style={{ width:'100%',padding:'12px 16px',border:`1px solid ${C.brownPale}`,borderRadius:10,fontSize:14,marginBottom:20,outline:'none',resize:'vertical' }}/>
            )}

            {resultat&&(
              <div style={{ backgroundColor:resultat.correct?C.emeraldPale:'#FEE2E2',borderRadius:12,padding:'14px 18px',marginBottom:18,border:`1px solid ${resultat.correct?C.emerald:C.red}30`,display:'flex',gap:12,alignItems:'flex-start',animation:'slideDown .3s ease' }}>
                {resultat.correct?<CheckCircle size={20} color={C.emerald} style={{flexShrink:0}}/>:<XCircle size={20} color={C.red} style={{flexShrink:0}}/>}
                <div style={{ flex:1 }}>
                  <p style={{ margin:'0 0 5px',fontSize:14,fontWeight:800,color:resultat.correct?C.emerald:C.red }}>{resultat.correct?'Excellent ! Bonne réponse !':'Pas tout à fait…'}</p>
                  <p style={{ margin:0,fontSize:13,color:C.text,lineHeight:1.6 }}>{resultat.explication}</p>
                  {!resultat.correct&&<p style={{ fontSize:13,marginTop:8,color:C.emerald }}><strong>Réponse correcte :</strong> {resultat.reponse_correcte}</p>}

                  {/* ── Tuteur IA ── */}
                  {!resultat.correct&&(
                    <div style={{ marginTop:14 }}>
                      {!explicationIA&&(
                        <button onClick={demanderExplication} disabled={loadingIA} style={{
                          display:'flex',alignItems:'center',gap:8,padding:'9px 16px',
                          background:loadingIA?'#E5E7EB':`linear-gradient(135deg,${C.brown},${C.brownLight})`,
                          color:loadingIA?C.textSec:'white',border:'none',borderRadius:10,
                          fontSize:13,fontWeight:700,cursor:loadingIA?'wait':'pointer',transition:'all .2s ease'
                        }}>
                          {loadingIA?(
                            <><div style={{ width:14,height:14,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'white',animation:'spin 1s linear infinite' }}/>Le tuteur réfléchit…</>
                          ):<>💡 Expliquer autrement</>}
                        </button>
                      )}
                      {explicationIA&&(
                        <div style={{ marginTop:12,background:`linear-gradient(135deg,${C.brownPale},#FFFBEB)`,borderRadius:12,padding:'14px 16px',border:`1px solid ${C.gold}40`,animation:'slideDown .3s ease' }}>
                          <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:10 }}>
                            <div style={{ width:28,height:28,borderRadius:8,flexShrink:0,background:`linear-gradient(135deg,${C.brown},${C.gold})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14 }}>🧠</div>
                            <span style={{ fontSize:12,fontWeight:800,color:C.brown }}>Tuteur EduSmart AI</span>
                          </div>
                          <p style={{ fontSize:13,color:C.text,lineHeight:1.7,margin:0 }}>{explicationIA}</p>
                          <button onClick={()=>setExplicationIA(null)} style={{ marginTop:10,background:'none',border:'none',cursor:'pointer',fontSize:11,color:C.textSec,textDecoration:'underline' }}>Fermer</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!resultat&&(
              <div style={{ marginBottom:18 }}>
                {indices===0?(
                  <button onClick={()=>{setIndices(1);sendEvent('help_requested',{level:1})}} style={{ backgroundColor:'transparent',border:`1px dashed ${C.brownLight}`,borderRadius:8,padding:'8px 16px',cursor:'pointer',color:C.brownLight,fontSize:13,fontWeight:700,display:'flex',alignItems:'center',gap:6 }}>
                    <Lightbulb size={14}/> Besoin d'un indice ?
                  </button>
                ):(
                  <div style={{ backgroundColor:'#FFFBEB',borderRadius:12,padding:16,border:'1px solid #FDE68A40',animation:'slideDown .3s ease' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:8 }}>
                      <Lightbulb size={16} color={C.orange}/>
                      <span style={{ fontSize:13,fontWeight:800,color:C.orange }}>Indice {indices}</span>
                    </div>
                    <p style={{ margin:0,fontSize:13,color:C.text,lineHeight:1.6 }}>{indices===1?ex.indice_1:ex.indice_2}</p>
                    {indices===1&&ex.indice_2&&(
                      <button onClick={()=>{setIndices(2);sendEvent('help_requested',{level:2})}} style={{ marginTop:10,backgroundColor:'transparent',border:`1px dashed ${C.orange}`,borderRadius:6,padding:'5px 12px',cursor:'pointer',color:C.orange,fontSize:12,fontWeight:700 }}>
                        Voir l'indice 2
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {!resultat?(
              <button onClick={soumettre} disabled={!reponse} style={{ width:'100%',padding:'14px',background:reponse?`linear-gradient(135deg,${C.brown},${C.brownLight})`:'#E5E7EB',color:reponse?'white':C.textSec,border:'none',borderRadius:12,fontSize:14,fontWeight:800,cursor:reponse?'pointer':'not-allowed',boxShadow:reponse?`0 4px 18px ${C.brown}35`:'none',transition:'all .2s ease' }}>
                Valider ma réponse
              </button>
            ):(
              <button onClick={suivant} style={{ width:'100%',padding:'14px',background:`linear-gradient(135deg,${C.emerald},#0A7A5E)`,color:'white',border:'none',borderRadius:12,fontSize:14,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8,boxShadow:`0 4px 18px ${C.emerald}35` }}>
                {current+1>=exercices.length?'Terminer la session 🏁':'Question suivante'}<ChevronRight size={16}/>
              </button>
            )}
          </div>
        </div>

        {/* ── Panneau latéral ── */}
        <div style={{ width:200,flexShrink:0,display:'flex',flexDirection:'column',gap:16 }}>
          <div style={{ backgroundColor:C.surface,borderRadius:18,padding:18,boxShadow:'0 2px 12px rgba(107,58,42,0.08)',border:`1px solid ${C.brownPale}` }}>
            <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:14 }}>
              <Zap size={14} color={C.brown}/>
              <span style={{ fontSize:12,fontWeight:800,color:C.brown }}>Analyse IA</span>
            </div>

            {/* Flux caméra */}
            <div style={{ aspectRatio:'4/3',backgroundColor:'#1A1207',borderRadius:12,marginBottom:14,position:'relative',overflow:'hidden',border:`1px solid ${C.brownPale}` }}>
              <video ref={videoRef} autoPlay playsInline muted style={{ display:'none' }}/>
              <canvas ref={canvasRef} style={{ width:'100%',height:'100%',objectFit:'cover',display:cameraActive?'block':'none' }}/>
              {!cameraActive&&(
                <div style={{ position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:6 }}>
                  <Camera size={26} color="rgba(255,255,255,0.3)"/>
                  <p style={{ fontSize:10,color:'rgba(255,255,255,0.4)',fontWeight:600,textAlign:'center',margin:0 }}>Caméra désactivée</p>
                </div>
              )}
              {cameraActive&&(
                <div style={{ position:'absolute',bottom:8,left:8,backgroundColor:C.emerald,borderRadius:20,padding:'2px 8px',fontSize:9,fontWeight:800,color:'white',display:'flex',alignItems:'center',gap:4 }}>
                  <span style={{ width:5,height:5,borderRadius:'50%',backgroundColor:'white',animation:'pulse 1.5s infinite' }}/>LIVE
                </div>
              )}
            </div>

            {!cameraActive&&(
              <button onClick={startCamera} style={{ width:'100%',padding:'9px',background:`linear-gradient(135deg,${C.brown},${C.brownLight})`,color:'white',border:'none',borderRadius:8,fontSize:12,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginBottom:14 }}>
                <Camera size={13}/> Activer la caméra
              </button>
            )}

            {/* ── Bouton micro + barre bruit ── */}
{!audioActive ? (
  <button onClick={startAudio} style={{
    width:'100%', padding:'9px',
    background:`linear-gradient(135deg,${C.emerald},#0A7A5E)`,
    color:'white', border:'none', borderRadius:8,
    fontSize:12, fontWeight:700, cursor:'pointer',
    display:'flex', alignItems:'center', justifyContent:'center',
    gap:6, marginBottom:14
  }}>
    🎤 Activer le micro
  </button>
) : (
  <div style={{
    backgroundColor: bruitPerturb ? '#FEE2E2' : C.emeraldPale,
    borderRadius:10, padding:'8px 10px', marginBottom:14,
    border:`1px solid ${bruitPerturb ? C.red : C.emerald}30`
  }}>
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
      <span style={{ fontSize:11, fontWeight:700, color: bruitPerturb ? C.red : C.emerald }}>
        🎤 {bruitPerturb ? 'Bruit détecté !' : 'Ambiance calme'}
      </span>
      <span style={{ fontSize:10, color:C.textSec }}>
        {Math.round(niveauBruit/1.28)}%
      </span>
    </div>
    <div style={{ height:4, backgroundColor:'#E5E7EB', borderRadius:4, overflow:'hidden' }}>
      <div style={{
        height:'100%', borderRadius:4,
        width:`${Math.min(100, Math.round(niveauBruit/1.28))}%`,
        backgroundColor: bruitPerturb ? C.red : C.emerald,
        transition:'width .5s ease'
      }}/>
    </div>
    {bruitPerturb && (
      <p style={{ fontSize:10, color:C.red, margin:'4px 0 0' }}>
        Environnement bruyant — concentration difficile
      </p>
    )}
  </div>
)}

            {/* Jauge engagement fusionné + émotion */}
            <EngagementGauge score={engagementScore} emotion={emotion}/>
          </div>

          {/* Mini stats */}
          <div style={{ backgroundColor:C.surface,borderRadius:16,padding:16,boxShadow:'0 2px 10px rgba(107,58,42,0.07)',border:`1px solid ${C.brownPale}` }}>
            <p style={{ fontSize:11,fontWeight:800,color:C.brown,marginBottom:12 }}>Session en cours</p>
            {[
              {label:'Réussis',value:`${scores.filter(s=>s>0).length}/${scores.length||0}`},
              {label:'Points', value:`${scores.reduce((a,b)=>a+b,0)} pts`},
              {label:'Temps',  value:`${Math.max(1,Math.round((Date.now()-startTime)/60000))} min`},
            ].map(s=>(
              <div key={s.label} style={{ display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:`1px solid ${C.brownPale}` }}>
                <span style={{ fontSize:11,color:C.textSec,fontWeight:600 }}>{s.label}</span>
                <span style={{ fontSize:12,fontWeight:800,color:C.brown }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}