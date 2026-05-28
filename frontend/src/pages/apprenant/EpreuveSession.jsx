import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Spinner } from '../../components/Skeleton'
import { Clock, ChevronLeft, Send, CheckCircle, AlertTriangle, Award, Camera, ShieldAlert, FileText, Upload, Image } from 'lucide-react'
import useProctoringCamera from '../../hooks/useProctoringCamera'
import useAlishaVoice from '../../hooks/useAlishaVoice'
import RichText, { RichTextInline } from '../../components/RichText'

const Alisha = lazy(() => import('../../components/Alisha'))

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

const TYPE_LABELS = {
  sequence: 'Épreuve de séquence', examen: 'Examen',
  devoir: 'Devoir surveillé', tp_note: 'TP noté',
}

// ── Badge de surveillance flottant ───────────────────────────────────────────

const EMOTION_LABELS = {
  engagement_eleve: 'Engagé', engagement_modere: 'Modéré', engagement_faible: 'Peu attentif',
  neutre: 'Neutre', ennui: 'Ennui', confusion: 'Confusion',
  frustration: 'Frustration', decrochage: 'Décroché',
}

function ProctoringBadge({ cameraActive, faceDetected, engagementScore, nbIncidents, tabCount, onStart, cameraError, C }) {
  const [expanded, setExpanded] = useState(false)
  const pct = Math.round(engagementScore * 100)
  const scoreColor = pct >= 70 ? C.emerald : pct >= 40 ? C.orange : C.red

  if (!cameraActive) {
    return (
      <div style={{ position: 'fixed', bottom: 90, right: 16, zIndex: 200 }}>
        <button
          onClick={onStart}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: C.surface, border: `1.5px solid ${C.brownPale}`, borderRadius: 14, cursor: 'pointer', boxShadow: '0 4px 16px rgba(107,58,42,0.15)', fontSize: 12, fontWeight: 700, color: C.brown }}
        >
          <Camera size={15} color={C.brown}/>
          Activer la surveillance
        </button>
        {cameraError && (
          <p style={{ fontSize: 10, color: C.red, textAlign: 'right', marginTop: 4 }}>{cameraError}</p>
        )}
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', bottom: 90, right: 16, zIndex: 200 }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ background: C.surface, border: `1.5px solid ${faceDetected ? `${C.emerald}60` : `${C.red}60`}`, borderRadius: 14, boxShadow: '0 4px 20px rgba(107,58,42,0.18)', cursor: 'pointer', overflow: 'hidden', transition: 'all .2s' }}
      >
        {/* Ligne compacte toujours visible */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px' }}>
          {/* Indicateur face */}
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: faceDetected ? C.emerald : C.red, boxShadow: `0 0 0 3px ${faceDetected ? C.emerald : C.red}30`, animation: 'pulse 2s infinite', flexShrink: 0 }}/>
          <Camera size={13} color={faceDetected ? C.emerald : C.red}/>
          <span style={{ fontSize: 11, fontWeight: 800, color: faceDetected ? C.emerald : C.red }}>
            {faceDetected ? 'Surveillé' : 'Hors cadre'}
          </span>
          {nbIncidents > 0 && (
            <span style={{ fontSize: 10, fontWeight: 800, color: C.red, background: C.redPale, padding: '1px 7px', borderRadius: 20 }}>
              {nbIncidents} ⚠
            </span>
          )}
        </div>

        {/* Détail si ouvert */}
        {expanded && (
          <div style={{ padding: '0 14px 12px', borderTop: `1px solid ${C.brownPale}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: C.textSec, fontWeight: 700 }}>Attention</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: scoreColor }}>{pct}%</span>
            </div>
            <div style={{ height: 5, background: C.brownPale, borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: scoreColor, borderRadius: 5, transition: 'width .5s' }}/>
            </div>
            {(nbIncidents > 0 || tabCount > 0) && (
              <div style={{ margin: '8px 0 0' }}>
                {nbIncidents > 0 && (
                  <p style={{ margin: '0 0 2px', fontSize: 10, color: C.red, fontWeight: 600 }}>
                    <ShieldAlert size={10} style={{ verticalAlign: 'middle', marginRight: 3 }}/>
                    {nbIncidents} absence{nbIncidents > 1 ? 's' : ''} caméra
                  </p>
                )}
                {tabCount > 0 && (
                  <p style={{ margin: 0, fontSize: 10, color: C.red, fontWeight: 600 }}>
                    <ShieldAlert size={10} style={{ verticalAlign: 'middle', marginRight: 3 }}/>
                    {tabCount} sortie{tabCount > 1 ? 's' : ''} détectée{tabCount > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
            <p style={{ margin: '4px 0 0', fontSize: 10, color: C.textSec }}>
              Les données de surveillance sont transmises à l'enseignant lors de la soumission.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Composant question ────────────────────────────────────────────────────────

function QuestionInput({ q, value, onChange, disabled, correction, C }) {
  const type = q.type || 'question_directe'

  const baseTextarea = {
    width: '100%', padding: '10px 12px', border: `1.5px solid ${C.brownPale}`,
    borderRadius: 8, fontSize: 13, color: C.text, background: disabled ? C.bg : C.surface,
    fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', outline: 'none',
    minHeight: 80,
  }

  const baseInput = {
    width: '100%', padding: '9px 12px', border: `1.5px solid ${C.brownPale}`,
    borderRadius: 8, fontSize: 13, color: C.text, background: disabled ? C.bg : C.surface,
    fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none',
  }

  // QCM — radio
  if (type === 'qcm' && q.options?.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.options.map((opt, i) => {
          const optVal = opt.replace(/^[A-Z]\.\s*/,'').trim()
          const optLabel = opt
          const isChosen = value === optLabel || value === optVal
          const isCorrect = correction && (q.reponse_correcte === optLabel || q.reponse_correcte === optVal || q.reponse_correcte?.startsWith(opt[0]))
          const bg = disabled
            ? (isCorrect ? `${C.emerald}18` : isChosen && !isCorrect ? C.redPale : C.bg)
            : (isChosen ? `${C.brown}12` : C.bg)
          const border = disabled
            ? (isCorrect ? `2px solid ${C.emerald}` : isChosen && !isCorrect ? `2px solid ${C.red}` : `1.5px solid ${C.brownPale}`)
            : (isChosen ? `2px solid ${C.brown}` : `1.5px solid ${C.brownPale}`)
          return (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: bg, borderRadius: 10, border, cursor: disabled ? 'default' : 'pointer', transition: 'all .15s' }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', border: `2px solid ${isChosen ? C.brown : C.brownPale}`, background: isChosen ? C.brown : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {isChosen && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'white' }}/>}
              </div>
              <input type="radio" value={optLabel} checked={isChosen} onChange={() => !disabled && onChange(optLabel)} style={{ display: 'none' }}/>
              <span style={{ fontSize: 13, color: C.text }}>{optLabel}</span>
              {disabled && isCorrect && <CheckCircle size={14} color={C.emerald} style={{ marginLeft: 'auto', flexShrink: 0 }}/>}
            </label>
          )
        })}
      </div>
    )
  }

  // Vrai/Faux — deux boutons
  if (type === 'vrai_faux') {
    return (
      <div style={{ display: 'flex', gap: 10 }}>
        {['Vrai', 'Faux'].map(opt => {
          const isChosen = value?.toLowerCase() === opt.toLowerCase()
          const isCorrect = correction && q.reponse_correcte?.toLowerCase() === opt.toLowerCase()
          const bg = disabled
            ? (isCorrect ? `${C.emerald}18` : isChosen && !isCorrect ? C.redPale : C.bg)
            : (isChosen ? `${C.brown}18` : C.bg)
          const border = disabled
            ? (isCorrect ? `2px solid ${C.emerald}` : isChosen && !isCorrect ? `2px solid ${C.red}` : `1.5px solid ${C.brownPale}`)
            : (isChosen ? `2px solid ${C.brown}` : `1.5px solid ${C.brownPale}`)
          return (
            <button key={opt} onClick={() => !disabled && onChange(opt)} style={{ flex: 1, padding: '12px', background: bg, border, borderRadius: 10, cursor: disabled ? 'default' : 'pointer', fontSize: 14, fontWeight: 800, color: isChosen ? C.brown : C.textSec, transition: 'all .15s' }}>
              {opt === 'Vrai' ? '✓ Vrai' : '✗ Faux'}
            </button>
          )
        })}
      </div>
    )
  }

  // Code / SQL — textarea monospace
  if (type === 'code') {
    return (
      <textarea
        value={value || ''}
        onChange={e => !disabled && onChange(e.target.value)}
        disabled={disabled}
        placeholder="Écris ton code ici…"
        style={{ ...baseTextarea, fontFamily: "'Fira Code', 'Courier New', monospace", minHeight: 120 }}
      />
    )
  }

  // Réponse libre / complétion / listage — textarea simple
  if (['reponse_libre','completion','listage','definition','question_directe'].includes(type)) {
    const short = type === 'completion' || type === 'definition'
    if (short) {
      return (
        <input
          type="text"
          value={value || ''}
          onChange={e => !disabled && onChange(e.target.value)}
          disabled={disabled}
          placeholder="Ta réponse…"
          style={baseInput}
        />
      )
    }
    return (
      <textarea
        value={value || ''}
        onChange={e => !disabled && onChange(e.target.value)}
        disabled={disabled}
        placeholder="Développe ta réponse…"
        style={baseTextarea}
      />
    )
  }

  // Fallback
  return (
    <input type="text" value={value || ''} onChange={e => !disabled && onChange(e.target.value)} disabled={disabled} style={baseInput}/>
  )
}

// ── Bloc question ─────────────────────────────────────────────────────────────

function QuestionBlock({ q, idx, value, onChange, disabled, correction, C }) {
  const typeColors = {
    definition: C.purple, vrai_faux: C.emerald, completion: C.orange,
    listage: C.purple, qcm: C.blue, code: C.emerald,
    question_directe: C.brown, reponse_libre: C.textSec,
  }
  const color = typeColors[q.type] || C.brown
  const corr = correction?.[q.id]

  return (
    <div style={{ padding: '16px 18px', background: C.surface, borderRadius: 14, border: `1.5px solid ${corr ? (corr.correct ? `${C.emerald}50` : `${C.red}50`) : C.brownPale}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color, background: `${color}15`, padding: '2px 8px', borderRadius: 20 }}>
              {(q.type || 'question').replace(/_/g,' ')}
            </span>
          </div>
          <div style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            <span style={{ fontWeight: 800, color: C.textSec, fontSize: 13 }}>Q{idx + 1}.</span>
            <RichText text={q.enonce} style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}/>
          </div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color, background: `${color}15`, padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>
          {q.points} pt{q.points > 1 ? 's' : ''}
        </span>
      </div>

      <QuestionInput q={q} value={value} onChange={onChange} disabled={disabled} correction={corr} C={C}/>

      {/* Feedback correction */}
      {corr && (
        <div style={{ marginTop: 10, padding: '10px 12px', background: corr.correct ? `${C.emerald}10` : corr.correct === null ? `${C.orange}10` : C.redPale, borderRadius: 8, border: `1px solid ${corr.correct ? `${C.emerald}30` : corr.correct === null ? `${C.orange}30` : `${C.red}30`}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {corr.correct === true  && <CheckCircle size={13} color={C.emerald}/>}
              {corr.correct === false && <AlertTriangle size={13} color={C.red}/>}
              {corr.correct === null  && <Clock size={13} color={C.orange}/>}
              <span style={{ fontSize: 12, fontWeight: 700, color: corr.correct === true ? C.emerald : corr.correct === false ? C.red : C.orange }}>
                {corr.correct === true
                  ? `${corr.score} / ${corr.max} pt${corr.max > 1 ? 's' : ''}`
                  : corr.correct === false
                  ? `0 / ${corr.max} pt${corr.max > 1 ? 's' : ''}`
                  : 'Correction en attente'}
              </span>
            </div>
            {/* Badge méthode */}
            {corr.methode && corr.methode !== 'manuelle' && (
              <span style={{ fontSize: 9, fontWeight: 700, color: C.textSec, background: C.brownPale, padding: '2px 7px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: .4 }}>
                {corr.methode === 'exact' ? 'Auto' : corr.methode === 'semantique' ? 'IA' : corr.methode === 'semantique_listage' ? 'IA liste' : corr.methode === 'semantique_code' ? 'IA code' : 'IA'}
              </span>
            )}
          </div>

          {/* Barre de similarité sémantique */}
          {corr.similarite !== null && corr.similarite !== undefined && corr.methode !== 'exact' && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 10, color: C.textSec }}>Similarité sémantique</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: corr.similarite >= 0.65 ? C.emerald : corr.similarite >= 0.4 ? C.orange : C.red }}>
                  {Math.round(corr.similarite * 100)}%
                </span>
              </div>
              <div style={{ height: 4, background: C.brownPale, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(corr.similarite * 100)}%`, background: corr.similarite >= 0.65 ? C.emerald : corr.similarite >= 0.4 ? C.orange : C.red, borderRadius: 4, transition: 'width .6s' }}/>
              </div>
            </div>
          )}

          {/* Réponse correcte si faux */}
          {corr.correct === false && q.reponse_correcte && (
            <p style={{ margin: '6px 0 0', fontSize: 11, color: C.textSec }}>
              Réponse attendue : <RichTextInline text={q.reponse_correcte} style={{ fontWeight: 700, color: C.text }}/>
            </p>
          )}
          {corr.explication && corr.explication !== 'Correction manuelle requise' && (
            <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textSec }}>
              <RichTextInline text={corr.explication}/>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────

export default function EpreuveSession() {
  const { epreuveId } = useParams()
  const navigate      = useNavigate()
  const { C }         = useTheme()
  const { mobile, xs } = useBreakpoint()
  const pad = xs ? 12 : mobile ? 14 : 24

  const [epreuve,    setEpreuve]    = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [phase,      setPhase]      = useState('intro')  // intro | exam | submitting | results
  const [reponses,   setReponses]   = useState(() => {
    // Restaure un brouillon sauvegardé si la session a été interrompue
    try {
      const saved = localStorage.getItem(`epreuve_draft_${epreuveId}`)
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [timeLeft,   setTimeLeft]   = useState(null)     // secondes
  const [results,    setResults]    = useState(null)     // réponse API soumettre
  const [existingResult, setExistingResult] = useState(null)

  // ── Mode copie papier
  const [paperMode,    setPaperMode]    = useState(false)  // true = soumission photo
  const [paperFile,    setPaperFile]    = useState(null)   // File object
  const [paperPreview, setPaperPreview] = useState(null)   // data URL preview
  const [paperSubmitting, setPaperSubmitting] = useState(false)
  const paperInputRef = useRef(null)

  const timerRef    = useRef(null)
  const tabCountRef  = useRef(0)
  const [tabCount,   setTabCount]   = useState(0)
  const tabLogRef    = useRef([])  // log détaillé [{type:'tab_switch', debut, fin, duree_s}]
  const tabHiddenRef = useRef(null)

  // ── Surveillance caméra
  const {
    cameraActive, faceDetected, engagementScore, nbIncidents, cameraError,
    videoRef: proctoringVideoRef, startCamera, stopCamera, getIncidentsLog,
  } = useProctoringCamera()

  // ── Voix Alisha (alertes timer + auto-soumission)
  const { speak: alishaSpeak } = useAlishaVoice()

  // ── Chargement épreuve
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`epreuve_draft_${epreuveId}`)
      if (saved && Object.keys(JSON.parse(saved)).length > 0) {
        toast('📋 Brouillon restauré — tes réponses précédentes ont été récupérées', { duration: 4000 })
      }
    } catch {}

    api.get(`/api/examens/${epreuveId}`)
      .then(({ data }) => {
        setEpreuve(data)
        setTimeLeft(data.duree_minutes * 60)
      })
      .catch(() => { toast.error('Épreuve introuvable'); navigate('/epreuves') })
      .finally(() => setLoading(false))

    // Vérifie si déjà soumis
    api.get(`/api/examens/${epreuveId}/resultats`)
      .then(({ data }) => { if (data.length > 0) setExistingResult(data[0]) })
      .catch(() => {})
  }, [epreuveId])

  // ── Alerte absence visage pendant l'épreuve
  useEffect(() => {
    if (phase !== 'exam' || !cameraActive || faceDetected) return
    const t = setTimeout(() => {
      toast('⚠ Visage non détecté — reste dans le cadre', { icon: '👀', duration: 4000 })
    }, 5000)
    return () => clearTimeout(t)
  }, [phase, cameraActive, faceDetected])

  // ── Détection sortie plateforme (changement d'onglet / alt-tab / minimiser)
  useEffect(() => {
    if (phase !== 'exam') return

    const onVisibility = () => {
      if (document.hidden) {
        tabHiddenRef.current = Date.now()
      } else {
        const hiddenAt = tabHiddenRef.current
        if (!hiddenAt) return
        tabHiddenRef.current = null
        const duree_s = Math.round((Date.now() - hiddenAt) / 1000)
        tabLogRef.current.push({
          type: 'tab_switch',
          debut: new Date(hiddenAt).toISOString(),
          fin: new Date().toISOString(),
          duree_s,
        })
        tabCountRef.current += 1
        setTabCount(tabCountRef.current)
        toast('🚨 Sortie détectée — ne quittez pas l\'épreuve !', { duration: 5000 })
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      tabHiddenRef.current = null
    }
  }, [phase])

  // ── Timer
  useEffect(() => {
    if (phase !== 'exam' || timeLeft === null) return
    if (timeLeft <= 0) {
      // Auto-soumission : Alisha prévient avant la soumission
      alishaSpeak('Le temps est écoulé. Votre copie est soumise automatiquement.')
      setTimeout(() => soumettre(true), 1000)
      return
    }
    // Alertes vocales à des seuils critiques (5min, 1min)
    if (timeLeft === 300) {
      alishaSpeak('Attention ! Il vous reste cinq minutes. Vérifiez vos réponses.')
    } else if (timeLeft === 60) {
      alishaSpeak('Plus qu\'une minute ! Finalisez votre copie.')
    }
    timerRef.current = setTimeout(() => setTimeLeft(t => t - 1), 1000)
    return () => clearTimeout(timerRef.current)
  }, [phase, timeLeft])

  // ── Auto-sauvegarde brouillon toutes les 30 secondes pendant l'épreuve
  useEffect(() => {
    if (phase !== 'exam') return
    const key = `epreuve_draft_${epreuveId}`
    const interval = setInterval(() => {
      try { localStorage.setItem(key, JSON.stringify(reponses)) } catch {}
    }, 30000)
    return () => clearInterval(interval)
  }, [phase, epreuveId, reponses])

  function startExam() {
    if (existingResult) { setResults(existingResult); setPhase('results'); return }
    setPhase('exam')
  }

  const soumettre = useCallback(async (autoSubmit = false) => {
    if (phase === 'submitting') return
    setPhase('submitting')
    clearTimeout(timerRef.current)
    stopCamera()
    try {
      const cameraLog  = (getIncidentsLog() || []).map(i => ({ ...i, type: i.type || 'camera_absence' }))
      const mergedLog  = [...cameraLog, ...tabLogRef.current]
      const totalIncid = nbIncidents + tabCountRef.current

      const { data } = await api.post(`/api/examens/${epreuveId}/soumettre`, {
        reponses,
        nb_incidents: totalIncid,
        incidents_log: mergedLog,
      })
      setResults(data)
      setPhase('results')
      try { localStorage.removeItem(`epreuve_draft_${epreuveId}`) } catch {}
      if (autoSubmit) toast('⏱ Temps écoulé — copie soumise automatiquement', { icon: '⏱' })
      else toast.success('Copie soumise avec succès !')
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Erreur lors de la soumission'
      if (msg.includes('déjà soumise')) {
        toast('Copie déjà soumise', { icon: 'ℹ️' })
        api.get(`/api/examens/${epreuveId}/resultats`)
          .then(({ data }) => { if (data.length > 0) { setResults(data[0]); setPhase('results') } })
      } else {
        toast.error(msg)
        setPhase('exam')
      }
    }
  }, [epreuveId, reponses, phase, nbIncidents, getIncidentsLog, stopCamera])

  function handlePaperFile(file) {
    if (!file) return
    setPaperFile(file)
    const reader = new FileReader()
    reader.onload = e => setPaperPreview(e.target.result)
    reader.readAsDataURL(file)
  }

  async function soumettreParier() {
    if (!paperFile) { toast.error('Sélectionne une photo de ta copie'); return }
    setPaperSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('image', paperFile)
      const { data } = await api.post(`/api/examens/${epreuveId}/soumettre-papier`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResults({
        ...data,
        score_total: data.score_total,
        corrections: data.vision_corrections?.corrections || {},
        nb_incidents: 0,
      })
      setPhase('results')
      toast.success('Copie papier soumise et analysée par IA !')
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Erreur lors de la soumission'
      if (msg.includes('déjà soumise')) {
        toast('Copie déjà soumise', { icon: 'ℹ️' })
        api.get(`/api/examens/${epreuveId}/resultats`)
          .then(({ data }) => { if (data.length > 0) { setResults(data[0]); setPhase('results') } })
      } else {
        toast.error(msg)
      }
    } finally {
      setPaperSubmitting(false)
    }
  }

  // ── Collecte toutes les questions à plat
  function allQuestions() {
    if (!epreuve?.contenu) return []
    const qs = []
    for (const partie of ['partie1', 'partie2']) {
      for (const ex of epreuve.contenu[partie]?.exercices || []) {
        for (const q of ex.questions || []) qs.push({ ...q, _partie: partie, _ex: ex.id })
      }
    }
    return qs
  }

  const questions = allQuestions()
  const answered  = questions.filter(q => reponses[q.id]?.trim?.() || reponses[q.id]).length
  const pctDone   = questions.length > 0 ? Math.round(answered / questions.length * 100) : 0
  const timerDanger = timeLeft !== null && timeLeft < 300

  if (loading) return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner/>
    </div>
  )

  if (!epreuve) return null

  const { contenu } = epreuve

  // ════ INTRO ══════════════════════════════════════════════════════════════════
  if (phase === 'intro') return (
    <div style={{ background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: pad, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 560, width: '100%' }}>

        <button onClick={() => navigate('/epreuves')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, fontSize: 13, fontWeight: 600, marginBottom: 24 }}>
          <ChevronLeft size={15}/> Mes épreuves
        </button>

        {/* Alisha encourageante avant l'épreuve */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 18 }}>
          <Suspense fallback={null}>
            <Alisha state="excited" size={72} />
          </Suspense>
          <div style={{ background: C.surface, border: `1.5px solid ${C.brownPale}`, borderRadius: '14px 14px 14px 0', padding: '10px 16px', fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.5, maxWidth: 260 }}>
            Tu es prêt·e ? Concentre-toi, je serai là à la fin. Bonne chance ! 💪
          </div>
        </div>

        <div style={{ background: C.surface, borderRadius: xs ? 18 : 24, padding: xs ? '22px 16px' : '36px 32px', boxShadow: `0 8px 40px ${C.brown}18`, border: `1.5px solid ${C.brownPale}`, animation: 'fadeUp .35s ease both' }}>

          {/* Badge type */}
          <span style={{ fontSize: 11, fontWeight: 800, color: C.brown, background: `${C.brown}15`, padding: '4px 12px', borderRadius: 20 }}>
            {TYPE_LABELS[epreuve.type_epreuve] || epreuve.type_epreuve}
          </span>

          <h1 style={{ fontSize: xs ? 18 : 22, fontWeight: 900, color: C.text, margin: '14px 0 6px', lineHeight: 1.3 }}>
            {epreuve.titre}
          </h1>

          {(epreuve.classe_label || epreuve.annee_scolaire) && (
            <p style={{ fontSize: 13, color: C.textSec, marginBottom: 20 }}>
              {epreuve.classe_label}{epreuve.classe_label && epreuve.annee_scolaire && ' · '}{epreuve.annee_scolaire}
            </p>
          )}

          {/* Infos */}
          <div style={{ display: 'grid', gridTemplateColumns: xs ? '1fr 1fr' : 'repeat(3,1fr)', gap: 10, marginBottom: 28 }}>
            {[
              { icon: Clock, label: 'Durée', value: `${epreuve.duree_minutes} min` },
              { icon: Award, label: 'Coefficient', value: epreuve.coefficient },
              { icon: null,  label: 'Questions', value: questions.length },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} style={{ background: C.bg, borderRadius: 12, padding: '12px 14px', textAlign: 'center', border: `1px solid ${C.brownPale}` }}>
                {Icon && <Icon size={18} color={C.brown} style={{ marginBottom: 6 }}/>}
                {!Icon && <p style={{ fontSize: 18, fontWeight: 900, color: C.brown, margin: '0 0 2px' }}>{value}</p>}
                {Icon && <p style={{ fontSize: 18, fontWeight: 900, color: C.text, margin: 0 }}>{value}</p>}
                <p style={{ fontSize: 10, color: C.textSec, fontWeight: 700, margin: Icon ? 0 : '2px 0 0', textTransform: 'uppercase', letterSpacing: .4 }}>{label}</p>
              </div>
            ))}
          </div>

          {/* Structure */}
          <div style={{ background: C.bg, borderRadius: 12, padding: '14px 16px', marginBottom: 24, border: `1px solid ${C.brownPale}` }}>
            <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: C.brown }}>Structure de l'épreuve</p>
            {[
              { key: 'partie1', label: 'Partie I — Évaluation des Ressources', color: C.brown },
              { key: 'partie2', label: 'Partie II — Évaluation des Compétences', color: C.emerald },
            ].map(({ key, label, color }) => {
              const p = contenu?.[key]
              if (!p) return null
              const qCount = (p.exercices || []).reduce((s, ex) => s + (ex.questions || []).length, 0)
              return (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${C.brownPale}` }}>
                  <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 12, color, fontWeight: 800 }}>{p.points_total ?? 10} pts · {qCount} question{qCount > 1 ? 's' : ''}</span>
                </div>
              )
            })}
          </div>

          {existingResult ? (
            <button onClick={startExam} style={{ width: '100%', padding: '14px', background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`, color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <CheckCircle size={17}/> Voir mes résultats
            </button>
          ) : (
            <>
              {/* Toggle numérique / papier */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: C.bg, borderRadius: 10, padding: 4, border: `1px solid ${C.brownPale}` }}>
                <button
                  onClick={() => setPaperMode(false)}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: !paperMode ? C.brown : 'transparent', color: !paperMode ? 'white' : C.textSec, transition: 'all .15s' }}
                >
                  📝 Répondre en ligne
                </button>
                <button
                  onClick={() => setPaperMode(true)}
                  style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: paperMode ? C.brown : 'transparent', color: paperMode ? 'white' : C.textSec, transition: 'all .15s' }}
                >
                  📄 Copie papier
                </button>
              </div>

              {!paperMode ? (
                <>
                  <button onClick={startExam} style={{ width: '100%', padding: '14px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 20px ${C.brown}40`, marginBottom: 10 }}>
                    Commencer l'épreuve →
                  </button>
                  <p style={{ textAlign: 'center', fontSize: 11, color: C.textSec, margin: 0 }}>
                    Le chronomètre démarrera dès que tu cliques sur "Commencer"
                  </p>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: `${C.brown}08`, borderRadius: 10, padding: '12px 14px', border: `1px solid ${C.brownPale}` }}>
                    <p style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 800, color: C.brown }}>Comment ça marche ?</p>
                    <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.textSec, lineHeight: 1.8 }}>
                      <li>Rédige ta copie sur papier</li>
                      <li>Prends une photo nette de chaque page</li>
                      <li>Upload la photo ci-dessous</li>
                      <li>L'IA lira et corrigera ta copie automatiquement</li>
                    </ol>
                  </div>

                  {/* Zone upload */}
                  <input
                    ref={paperInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={e => handlePaperFile(e.target.files[0])}
                  />

                  {paperPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img src={paperPreview} alt="Aperçu copie" style={{ width: '100%', borderRadius: 10, maxHeight: 240, objectFit: 'cover', border: `2px solid ${C.brownPale}` }}/>
                      <button
                        onClick={() => { setPaperFile(null); setPaperPreview(null) }}
                        style={{ position: 'absolute', top: 8, right: 8, background: C.red, border: 'none', borderRadius: '50%', width: 24, height: 24, color: 'white', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 }}
                      >✕</button>
                      <p style={{ margin: '6px 0 0', fontSize: 11, color: C.textSec, textAlign: 'center' }}>
                        {paperFile?.name} · {paperFile ? `${(paperFile.size / 1024).toFixed(0)} Ko` : ''}
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => paperInputRef.current?.click()}
                      style={{ padding: '20px', border: `2px dashed ${C.brownPale}`, borderRadius: 12, background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
                    >
                      <Upload size={24} color={C.brown}/>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.brown }}>Choisir / Photographier la copie</span>
                      <span style={{ fontSize: 11, color: C.textSec }}>JPG, PNG, HEIC — max 10 Mo</span>
                    </button>
                  )}

                  {/* Barre de progression indéterminée pendant l'analyse IA */}
                  {paperSubmitting && (
                    <div style={{ height: 4, background: C.brownPale, borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '40%', background: `linear-gradient(90deg, ${C.brown}, ${C.brownLight})`, borderRadius: 4, animation: 'indeterminateProgress 1.5s ease-in-out infinite' }}/>
                    </div>
                  )}

                  <button
                    onClick={soumettreParier}
                    disabled={!paperFile || paperSubmitting}
                    style={{ padding: '14px', background: paperFile ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})` : C.brownPale, color: paperFile ? 'white' : C.textSec, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: paperFile ? 'pointer' : 'default', boxShadow: paperFile ? `0 4px 20px ${C.brown}40` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  >
                    {paperSubmitting ? <><div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }}/> Analyse IA en cours…</> : <><Send size={15}/> Soumettre la copie papier</>}
                  </button>

                  <p style={{ textAlign: 'center', fontSize: 11, color: C.textSec, margin: 0 }}>
                    Claude Vision lira ta copie et l'enseignant validera la correction
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )

  // ════ RÉSULTATS ══════════════════════════════════════════════════════════════
  if (phase === 'results' && results) {
    const score = results.score_total ?? 0
    const pct = Math.round(score / 20 * 100)
    const mention = score >= 16 ? { label: 'Très bien', color: C.emerald } : score >= 14 ? { label: 'Bien', color: C.blue } : score >= 10 ? { label: 'Passable', color: C.orange } : { label: 'Insuffisant', color: C.red }
    const corrections = results.corrections || {}

    return (
      <div style={{ background: C.bg, minHeight: '100vh', padding: pad, fontFamily: "'DM Sans', system-ui, sans-serif" }}>

        <button onClick={() => navigate('/epreuves')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: C.textSec, fontSize: 13, fontWeight: 600, marginBottom: 20 }}>
          <ChevronLeft size={15}/> Mes épreuves
        </button>

        {/* Alisha réaction résultats */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 18 }}>
          <Suspense fallback={null}>
            <Alisha state={score >= 14 ? 'celebration' : score >= 10 ? 'correct' : 'confused'} size={72} />
          </Suspense>
          <div style={{ background: C.surface, border: `1.5px solid ${mention.color}40`, borderRadius: '14px 14px 14px 0', padding: '10px 16px', fontSize: 13, fontWeight: 700, color: C.text, lineHeight: 1.5, maxWidth: 260 }}>
            {score >= 16 ? "Incroyable ! Tu es au top de ta classe ! 🌟"
              : score >= 14 ? "Très bon résultat — continue comme ça !"
              : score >= 10 ? "C'est passé ! Continue à travailler les points faibles."
              : "Ne te décourage pas — analyse les corrections ensemble."}
          </div>
        </div>

        {/* Score card */}
        <div style={{ background: C.surface, borderRadius: xs ? 18 : 24, padding: xs ? '22px 16px' : '32px', textAlign: 'center', border: `2px solid ${mention.color}40`, marginBottom: 24, boxShadow: `0 4px 24px ${mention.color}18`, animation: 'fadeUp .35s ease both' }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5, marginBottom: 8 }}>{epreuve.titre}</p>
          <div style={{ width: 110, height: 110, borderRadius: '50%', background: `conic-gradient(${mention.color} ${pct * 3.6}deg, ${C.brownPale} 0)`, margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <div style={{ width: 82, height: 82, borderRadius: '50%', background: C.surface, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 24, fontWeight: 900, color: mention.color, lineHeight: 1 }}>{score.toFixed(1)}</span>
              <span style={{ fontSize: 11, color: C.textSec, fontWeight: 700 }}>/20</span>
            </div>
          </div>
          <span style={{ fontSize: 14, fontWeight: 800, color: mention.color, background: `${mention.color}15`, padding: '5px 16px', borderRadius: 20 }}>
            {mention.label}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 20 }}>
            <div style={{ background: C.bg, borderRadius: 10, padding: '10px', border: `1px solid ${C.brownPale}` }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.brown }}>{(results.score_p1 ?? 0).toFixed(1)}</p>
              <p style={{ margin: 0, fontSize: 10, color: C.textSec, fontWeight: 700 }}>Partie I /10</p>
            </div>
            <div style={{ background: C.bg, borderRadius: 10, padding: '10px', border: `1px solid ${C.brownPale}` }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.emerald }}>{(results.score_p2 ?? 0).toFixed(1)}</p>
              <p style={{ margin: 0, fontSize: 10, color: C.textSec, fontWeight: 700 }}>Partie II /10</p>
            </div>
          </div>
          {Object.values(corrections).some(c => c.auto === false) && (
            <p style={{ fontSize: 11, color: C.orange, fontWeight: 600, marginTop: 14, padding: '8px 14px', background: `${C.orange}10`, borderRadius: 8 }}>
              ⚠ Certaines questions à réponse libre attendent la correction manuelle de l'enseignant.
            </p>
          )}
          {results.nb_incidents > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, padding: '8px 14px', background: C.goldPale, borderRadius: 8, border: `1px solid ${C.gold}` }}>
              <ShieldAlert size={14} color={C.brownMid}/>
              <p style={{ margin: 0, fontSize: 11, color: C.brownDark, fontWeight: 600 }}>
                {results.nb_incidents} incident{results.nb_incidents > 1 ? 's' : ''} de surveillance détecté{results.nb_incidents > 1 ? 's' : ''} — signalé{results.nb_incidents > 1 ? 's' : ''} à l'enseignant.
              </p>
            </div>
          )}
        </div>

        {/* Détail par question */}
        {questions.length > 0 && Object.keys(corrections).length > 0 && (
          <div style={{ background: C.surface, borderRadius: 18, padding: xs ? '16px 14px' : '22px', border: `1.5px solid ${C.brownPale}`, animation: 'fadeUp .35s .1s ease both' }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.brown, marginBottom: 16 }}>Corrections détaillées</h2>
            {['partie1','partie2'].map(partieKey => {
              const partie = contenu?.[partieKey]
              if (!partie) return null
              return (
                <div key={partieKey} style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 800, color: partieKey === 'partie1' ? C.brown : C.emerald, marginBottom: 10 }}>
                    {partieKey === 'partie1' ? 'Partie I — Ressources' : 'Partie II — Compétences'}
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(partie.exercices || []).flatMap((ex, ei) =>
                      (ex.questions || []).map((q, qi) => (
                        <QuestionBlock
                          key={q.id || `${ei}-${qi}`}
                          q={q}
                          idx={qi}
                          value={reponses[q.id] || results.reponses?.[q.id] || ''}
                          onChange={() => {}}
                          disabled={true}
                          correction={corrections}
                          C={C}
                        />
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // ════ ÉPREUVE EN COURS ════════════════════════════════════════════════════════
  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", paddingBottom: 100 }}>

      {/* Vidéo cachée pour MediaPipe */}
      <video ref={proctoringVideoRef} autoPlay playsInline muted style={{ display: 'none', position: 'absolute' }}/>

      {/* Badge de surveillance */}
      <ProctoringBadge
        cameraActive={cameraActive}
        faceDetected={faceDetected}
        engagementScore={engagementScore}
        nbIncidents={nbIncidents}
        tabCount={tabCount}
        onStart={startCamera}
        cameraError={cameraError}
        C={C}
      />

      {/* ── Header fixe ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: C.surface, borderBottom: `1.5px solid ${C.brownPale}`, padding: `10px ${pad}px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: '0 2px 12px rgba(107,58,42,0.08)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{epreuve.titre}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <div style={{ flex: 1, height: 4, background: C.brownPale, borderRadius: 4, overflow: 'hidden', maxWidth: 120 }}>
              <div style={{ height: '100%', width: `${pctDone}%`, background: `linear-gradient(90deg, ${C.brown}, ${C.brownLight})`, borderRadius: 4, transition: 'width .4s' }}/>
            </div>
            <span style={{ fontSize: 11, color: C.textSec, fontWeight: 600 }}>{answered}/{questions.length}</span>
          </div>
        </div>

        {/* Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: timerDanger ? C.redPale : C.bg, borderRadius: 20, border: `1.5px solid ${timerDanger ? `${C.red}60` : C.brownPale}`, flexShrink: 0, transition: 'all .3s' }}>
          <Clock size={14} color={timerDanger ? C.red : C.brown}/>
          <span style={{ fontSize: 14, fontWeight: 900, color: timerDanger ? C.red : C.brown, fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(timeLeft ?? 0)}
          </span>
        </div>

        {/* Soumettre */}
        <button
          onClick={() => soumettre(false)}
          disabled={phase === 'submitting'}
          style={{ padding: '8px 16px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, boxShadow: `0 2px 12px ${C.brown}40` }}
        >
          {phase === 'submitting' ? <Spinner/> : <><Send size={13}/> {mobile ? 'Rendre' : 'Rendre la copie'}</>}
        </button>
      </div>

      {/* ── Corps ── */}
      <div style={{ maxWidth: 800, margin: '0 auto', padding: `24px ${pad}px 0` }}>

        {['partie1','partie2'].map(partieKey => {
          const partie = contenu?.[partieKey]
          if (!partie) return null
          const color = partieKey === 'partie1' ? C.brown : C.emerald
          return (
            <div key={partieKey} style={{ marginBottom: 32 }}>
              {/* En-tête partie */}
              <div style={{ background: `linear-gradient(90deg, ${color}20, transparent)`, borderRadius: 12, padding: '14px 18px', marginBottom: 16, borderLeft: `4px solid ${color}` }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 900, color }}>
                  {partieKey === 'partie1' ? 'PARTIE I — ÉVALUATION DES RESSOURCES' : 'PARTIE II — ÉVALUATION DES COMPÉTENCES'}
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: C.textSec }}>
                  {partie.points_total ?? 10} points — {(partie.exercices || []).reduce((s,ex) => s + (ex.questions||[]).length, 0)} question{(partie.exercices||[]).reduce((s,ex)=>s+(ex.questions||[]).length,0) > 1 ? 's' : ''}
                </p>
              </div>

              {/* Situation-problème P2 */}
              {partie.situation_probleme && (
                <div style={{ padding: '16px 18px', background: `${color}08`, border: `1.5px solid ${color}30`, borderRadius: 12, marginBottom: 18 }}>
                  <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: .5 }}>Situation-problème</p>
                  <p style={{ margin: 0, fontSize: 14, color: C.text, lineHeight: 1.7 }}>{partie.situation_probleme}</p>
                </div>
              )}

              {/* Exercices */}
              {(partie.exercices || []).map((ex, ei) => (
                <div key={ex.id || ei} style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div>
                      <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>
                        {ex.numero || `Exercice ${ei + 1}`}
                        {ex.titre && <span style={{ fontWeight: 600, color: C.textSec }}> — {ex.titre}</span>}
                      </p>
                      {ex.consigne && <p style={{ margin: '3px 0 0', fontSize: 12, color: C.textSec, fontStyle: 'italic' }}>{ex.consigne}</p>}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color, flexShrink: 0, marginLeft: 12 }}>{ex.points} pts</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(ex.questions || []).map((q, qi) => (
                      <QuestionBlock
                        key={q.id || qi}
                        q={q}
                        idx={qi}
                        value={reponses[q.id] || ''}
                        onChange={val => setReponses(r => ({ ...r, [q.id]: val }))}
                        disabled={false}
                        correction={null}
                        C={C}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })}

        {/* Bouton soumettre bas de page */}
        <div style={{ background: C.surface, borderRadius: 16, padding: '20px 22px', border: `1.5px solid ${C.brownPale}`, textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: C.textSec, marginBottom: 14 }}>
            {answered < questions.length ? `${questions.length - answered} question${questions.length - answered > 1 ? 's' : ''} sans réponse.` : 'Toutes les questions ont une réponse.'} Prêt à rendre ?
          </p>
          <button
            onClick={() => soumettre(false)}
            disabled={phase === 'submitting'}
            style={{ padding: '13px 32px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: `0 4px 20px ${C.brown}40`, display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            {phase === 'submitting' ? <Spinner/> : <><Send size={15}/> Rendre la copie</>}
          </button>
        </div>
      </div>
    </div>
  )
}
