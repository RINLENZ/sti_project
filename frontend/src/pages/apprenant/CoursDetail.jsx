import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import useAlishaVoice from '../../hooks/useAlishaVoice'
import { parseBlocks } from '../../components/RichContent'
import { blocksToSpeech } from '../../utils/latexToSpeech'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Clock, BookOpen, ChevronRight, CheckCircle, Target, ArrowLeft,
  Play, Lock, CheckCircle2, Volume2, Sparkles, Compass, Dumbbell, Trophy,
} from 'lucide-react'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Sk } from '../../components/Skeleton'
import { StaticContent } from '../../components/RichContent'
import { useOnlineRetry } from '../../hooks/useOnlineRetry'
import { useSound } from '../../hooks/useSound'
import { AdinkraSymbol } from '../../components/adinkra/AdinkraSymbols.jsx'

/* ── Difficulté (palette Bogolan) ──────────────────────────────── */
const DIFF_LABEL = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' }
const diffColor  = (C) => ({ 1: C.bogolanVert, 2: C.bogolanOcre, 3: '#B5462B' })

/* ── Étapes du parcours ────────────────────────────────────────── */
const STEPS = [
  { key: 'decouvrir', label: 'Découvrir',  short: 'Découvrir', icon: Compass  },
  { key: 'apprendre', label: 'Apprendre',  short: 'Apprendre', icon: BookOpen },
  { key: 'entrainer', label: "S'entraîner", short: 'Entraîner', icon: Dumbbell },
  { key: 'valider',   label: 'Valider',    short: 'Valider',   icon: Trophy   },
]

/* ── Anneau de maîtrise BKT ────────────────────────────────────── */
function BKTRing({ score = 0, size = 52, stroke = 5, light = false }) {
  const { C } = useTheme()
  const pct  = Math.round((score || 0) * 100)
  const r    = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const off  = circ - (pct / 100) * circ
  const track = light ? 'rgba(255,255,255,0.25)' : C.bogolanBorder
  const fill  = light ? 'white' : pct >= 80 ? C.bogolanVert : pct >= 40 ? C.bogolanOcre : C.bogolanTerre
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={fill} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size > 70 ? 18 : 13, fontWeight: 900, color: light ? 'white' : fill, lineHeight: 1 }}>{pct}</span>
        <span style={{ fontSize: 7, fontWeight: 700, color: light ? 'rgba(255,255,255,.7)' : C.bogolanTextSec }}>%</span>
      </div>
    </div>
  )
}

/* ── Construction des « missions » d'exercices (Concept 3) ─────── */
function buildMissions(allEx, completed, bkt, C) {
  const dc = diffColor(C)
  const groupNums = [...new Set(allEx.map(e => e.groupe).filter(g => g != null))].sort((a, b) => a - b)

  const withDone = (m) => ({ ...m, done: m.ex.filter(e => completed.has(e.id)).length, total: m.ex.length })

  if (groupNums.length) {
    const list = groupNums.map(g => {
      const ex = allEx.filter(e => e.groupe === g)
      return withDone({ key: `g${g}`, label: `Exercice ${g}${ex[0]?.groupe_titre ? ` : ${ex[0].groupe_titre}` : ''}`, color: C.bogolanTerre, ex, query: `?groupe=${g}&skip=1` })
    })
    const ung = allEx.filter(e => e.groupe == null)
    if (ung.length) list.push(withDone({ key: 'libre', label: 'Exercices libres', color: C.bogolanOcre, ex: ung, query: '?skip=1' }))
    return list
  }

  const diffs = [...new Set(allEx.map(e => e.difficulte).filter(d => d != null))].sort((a, b) => a - b)
  if (diffs.length > 1) {
    const recommDiff = bkt == null ? 1 : bkt < 0.4 ? 1 : bkt < 0.7 ? 2 : 3
    return diffs.map(d => withDone({
      key: `d${d}`, label: DIFF_LABEL[d], color: dc[d],
      ex: allEx.filter(e => e.difficulte === d), query: `?difficulte=${d}&skip=1`, recoForce: d === recommDiff,
    }))
  }

  // À plat : chaque exercice = un nœud
  return allEx.map(e => withDone({
    key: `e${e.id}`, label: e.titre, color: dc[e.difficulte] || C.bogolanTerre,
    ex: [e], query: `?exercice_id=${e.id}&skip=1`, single: true,
  }))
}

/* ── Squelette ─────────────────────────────────────────────────── */
function CoursDetailSkeleton() {
  const { C } = useTheme()
  return (
    <div style={{ background: C.bogolanBg, minHeight: '100vh' }}>
      <div style={{ background: `linear-gradient(140deg, #5E2F0E, ${C.bogolanOcre})`, padding: '28px 32px' }}>
        <Sk w={80} h={28} r={8} style={{ marginBottom: 20, background: 'rgba(255,255,255,.15)' }} />
        <Sk w="55%" h={24} r={8} style={{ marginBottom: 10, background: 'rgba(255,255,255,.2)' }} />
        <Sk w="30%" h={14} r={6} style={{ background: 'rgba(255,255,255,.15)' }} />
      </div>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 24 }}>
        <Sk h={52} r={14} style={{ marginBottom: 20 }} />
        <Sk h={18} style={{ marginBottom: 10 }} />
        <Sk h={14} w="90%" style={{ marginBottom: 8 }} />
        <Sk h={14} w="78%" style={{ marginBottom: 24 }} />
        <Sk h={52} r={14} />
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
   ══════════════════════════════════════════════════════════════════ */
export default function CoursDetail() {
  const { C }     = useTheme()
  const { uaId }  = useParams()
  const navigate  = useNavigate()
  const location  = useLocation()
  const { xs, mobile: isMobile } = useBreakpoint()
  const user = useSelector(s => s.auth.user)
  void user

  const { stop, readAloud, isReading, supported } = useAlishaVoice()
  const { playSound } = useSound()

  const [ua,           setUA]           = useState(null)
  const [loading,      setLoading]      = useState(true)
  const [step,         setStep]         = useState('decouvrir')
  const [ressourceIdx, setRessourceIdx] = useState(0)
  const [readPct,      setReadPct]      = useState(0)
  const lessonRef    = useRef(null)
  const celebrated   = useRef(false)
  const retryKey = useOnlineRetry()

  const handleBack = () => {
    const from = location.state?.from
    if (from === 'session' || from === 'tutoriel') return navigate('/dashboard')
    if (window.history.length > 2) return navigate(-1)
    navigate('/dashboard')
  }

  useEffect(() => {
    setLoading(true)
    api.get(`/api/cours/ua/${uaId}`)
      .then(({ data }) => setUA(data))
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [uaId, retryKey])

  // Stoppe la voix Alisha en changeant d'étape / en quittant
  useEffect(() => { if (step !== 'apprendre' && isReading) stop() }, [step, isReading, stop])
  useEffect(() => () => { if (isReading) stop() }, [isReading, stop])

  // Progression de lecture (étape Apprendre)
  useEffect(() => {
    if (step !== 'apprendre') return
    const onScroll = () => {
      const el = lessonRef.current
      if (!el) return
      const rect  = el.getBoundingClientRect()
      const total = rect.height - window.innerHeight
      const done  = Math.min(Math.max(-rect.top, 0), Math.max(total, 1))
      setReadPct(total > 40 ? Math.round((done / total) * 100) : 100)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [step, ressourceIdx, ua])

  if (loading) return <CoursDetailSkeleton />
  if (!ua) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: C.bogolanBg, gap: 12 }}>
      <p style={{ fontSize: 32 }}>😕</p>
      <p style={{ color: C.bogolanTextSec, fontSize: 14, fontWeight: 600 }}>Cours introuvable</p>
    </div>
  )

  const allEx     = ua.exercices || []
  const completed = new Set(ua.completed_exercise_ids || [])
  const lecons    = ua.ressources?.filter(r => r.type === 'lecon') || []
  const lecon     = lecons[ressourceIdx]
  const bkt       = ua.bkt_score
  const masteryPct = bkt != null ? Math.round(bkt * 100) : 0
  const doneCount  = allEx.filter(e => completed.has(e.id)).length
  const mastered   = (bkt ?? 0) >= 0.8 || (allEx.length > 0 && doneCount >= allEx.length)
  const missions   = buildMissions(allEx, completed, bkt, C)
  const recoKey    = (missions.find(m => m.recoForce && m.done < m.total)
                      || missions.find(m => m.done < m.total)
                      || missions[0])?.key

  // Célébration de fin
  if (step === 'valider' && mastered && !celebrated.current) {
    celebrated.current = true
    setTimeout(() => playSound('success'), 250)
  }

  const stepIdx = STEPS.findIndex(s => s.key === step)
  const goStep  = (k) => { navigator.vibrate?.(15); setStep(k); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const pad     = xs ? 12 : isMobile ? 16 : 24
  const heroPad = xs ? '14px 16px 16px' : isMobile ? '18px 20px 18px' : '20px 26px 20px'

  /* CTA principal de l'étape courante (barre collante mobile) */
  const primaryCTA = {
    decouvrir: { label: 'Apprendre la leçon', icon: BookOpen, onClick: () => goStep('apprendre') },
    apprendre: { label: "S'entraîner",        icon: Dumbbell, onClick: () => goStep('entrainer') },
    entrainer: { label: 'Démarrer avec Alisha', icon: Sparkles, onClick: () => { navigator.vibrate?.(30); navigate(`/tutoriel/${uaId}`) } },
    valider:   { label: 'Retour au parcours', icon: ChevronRight, onClick: () => navigate('/parcours') },
  }[step]

  /* ── Carte de section réutilisable ── */
  const Card = ({ children, style }) => (
    <div style={{ background: C.bogolanSurface, borderRadius: 16, border: `1px solid ${C.bogolanBorder}`, boxShadow: `0 2px 12px ${C.bogolanTerre}10`, padding: isMobile ? '16px' : '20px 22px', ...style }}>
      {children}
    </div>
  )

  return (
    <div style={{ background: C.bogolanBg, minHeight: '100vh', padding: pad, paddingBottom: isMobile ? 84 : pad, boxSizing: 'border-box', position: 'relative' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Filigrane Adinkra en fond (reflet, faible opacité) */}
      <div aria-hidden="true" style={{ position: 'fixed', right: isMobile ? -60 : -40, bottom: isMobile ? 40 : -30, opacity: 0.05, pointerEvents: 'none', zIndex: 0, transform: 'rotate(-8deg)' }}>
        <AdinkraSymbol id="adinkrahene" size={isMobile ? 280 : 460} color={C.bogolanTerre} />
      </div>

      <div style={{ maxWidth: 820, margin: '0 auto', position: 'relative', zIndex: 1 }}>

      {/* ══ HERO (carte arrondie, façon dashboard) ══ */}
      <div style={{ background: `linear-gradient(140deg, #5E2F0E 0%, ${C.bogolanTerre} 55%, ${C.bogolanOcre} 100%)`, padding: heroPad, color: 'white', position: 'relative', overflow: 'hidden', borderRadius: xs ? 16 : 20, marginBottom: 12 }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }} aria-hidden="true">
          <defs>
            <pattern id="adk-cd" x="0" y="0" width="56" height="56" patternUnits="userSpaceOnUse">
              <circle cx="28" cy="28" r="11" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="28" cy="28" r="5"  fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="28" y1="17" x2="28" y2="11" stroke="white" strokeWidth="1.5"/>
              <line x1="17" y1="28" x2="11" y2="28" stroke="white" strokeWidth="1.5"/>
              <line x1="39" y1="28" x2="45" y2="28" stroke="white" strokeWidth="1.5"/>
              <line x1="28" y1="39" x2="28" y2="45" stroke="white" strokeWidth="1.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#adk-cd)"/>
        </svg>

        <div style={{ position: 'relative' }}>
          <button onClick={handleBack} style={{ background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.22)', color: 'white', borderRadius: 9, padding: isMobile ? '8px 12px' : '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <ArrowLeft size={14}/> Retour
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ background: 'rgba(255,255,255,.2)', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-block', marginBottom: 8 }}>
                {ua.reference_ue}
              </span>
              <h1 style={{ fontSize: xs ? 16 : isMobile ? 19 : 23, fontWeight: 900, lineHeight: 1.2, margin: '0 0 8px' }}>
                {ua.titre}
              </h1>
              <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: .85 }}><Clock size={12}/> {ua.duree_estimee} min</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: .85 }}><BookOpen size={12}/> {allEx.length} exercices</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: .85 }}><Target size={12}/> {ua.competences?.length || 0} compétences</span>
              </div>
            </div>
            {bkt != null && <BKTRing score={bkt} size={xs ? 54 : 64} stroke={6} light />}
          </div>

          {/* CTA Démarrer avec Alisha — disponible dès le début */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => { navigator.vibrate?.(30); navigate(`/tutoriel/${uaId}`) }}
              style={{ flex: isMobile ? 1 : 'none', minWidth: isMobile ? 0 : 220, padding: '12px 22px', background: 'white', color: C.bogolanTerre, border: 'none', borderRadius: 13, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 18px rgba(0,0,0,.2)' }}
            >
              <Sparkles size={16} /> Démarrer avec Alisha
            </button>
            <button
              onClick={() => { navigator.vibrate?.(20); navigate(`/session/${uaId}?skip=1`) }}
              style={{ flex: isMobile ? 1 : 'none', padding: '12px 18px', background: 'rgba(255,255,255,.14)', color: 'white', border: '1.5px solid rgba(255,255,255,.4)', borderRadius: 13, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
            >
              <Play size={13} fill="white" /> Exercices seuls
            </button>
          </div>
        </div>
      </div>

      {/* ══ STEPPER collant (carte arrondie) ══ */}
      <div style={{ position: 'sticky', top: xs ? 8 : 12, zIndex: 20, background: C.bogolanSurface, border: `1px solid ${C.bogolanBorder}`, borderRadius: 14, boxShadow: `0 4px 16px ${C.bogolanTerre}14`, marginBottom: 14 }}>
        <div style={{ padding: xs ? '7px 8px' : '9px 12px', display: 'flex', alignItems: 'center', gap: xs ? 4 : 8 }}>
          {STEPS.map((s, i) => {
            const active = s.key === step
            const passed = i < stepIdx
            const Icon = s.icon
            const col  = active ? C.bogolanTerre : passed ? C.bogolanVert : C.bogolanTextSec
            return (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                <button
                  onClick={() => goStep(s.key)}
                  aria-current={active ? 'step' : undefined}
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: xs ? '7px 4px' : '8px 6px', borderRadius: 10, cursor: 'pointer', border: active ? `1.5px solid ${C.bogolanTerre}55` : '1.5px solid transparent', background: active ? `${C.bogolanTerre}12` : 'transparent', transition: 'all .2s' }}
                >
                  <div style={{ width: 22, height: 22, borderRadius: 7, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? C.bogolanTerre : passed ? `${C.bogolanVert}1A` : C.bogolanBg, color: active ? 'white' : col }}>
                    {passed ? <CheckCircle2 size={13} /> : <Icon size={13} />}
                  </div>
                  {!xs && <span style={{ fontSize: 12, fontWeight: active ? 800 : 600, color: col, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.short}</span>}
                </button>
                {i < STEPS.length - 1 && <div style={{ width: xs ? 6 : 14, height: 2, background: passed ? C.bogolanVert : C.bogolanBorder, flexShrink: 0, borderRadius: 2 }} />}
              </div>
            )
          })}
        </div>
      </div>

      {/* ══ CONTENU DE L'ÉTAPE ══ */}
      <div>

        {/* ── 1. DÉCOUVRIR ── */}
        {step === 'decouvrir' && (
          <div style={{ animation: 'fadeUp .35s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {ua.situation_probleme ? (
              <Card style={{ background: `linear-gradient(135deg, ${C.bogolanVert}12, ${C.bogolanSurface})`, border: `1.5px solid ${C.bogolanVert}33` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Compass size={15} color={C.bogolanVert} />
                  <p style={{ fontSize: 11, fontWeight: 800, color: C.bogolanVert, textTransform: 'uppercase', letterSpacing: .8, margin: 0 }}>Situation problème</p>
                </div>
                <StaticContent data={{ contenu: ua.situation_probleme, points_cles: [] }} C={C} xs={xs} />
              </Card>
            ) : (
              <Card>
                <p style={{ fontSize: 14, color: C.bogolanText, margin: 0, lineHeight: 1.6 }}>
                  Bienvenue dans <strong>{ua.titre}</strong>. Découvre la leçon puis entraîne-toi à ton rythme.
                </p>
              </Card>
            )}

            {ua.competences?.length > 0 && (
              <Card>
                <p style={{ fontSize: 11, fontWeight: 800, color: C.bogolanTerre, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 12px' }}>Ce que tu vas savoir faire</p>
                {ua.competences.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 6, background: `linear-gradient(135deg, ${C.bogolanTerre}, ${C.bogolanOcre})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0 }}>{i + 1}</div>
                    <p style={{ fontSize: 13, lineHeight: 1.5, color: C.bogolanText, margin: 0 }}>{c}</p>
                  </div>
                ))}
              </Card>
            )}

            {ua.prerequis?.length > 0 && (
              <Card>
                <p style={{ fontSize: 11, fontWeight: 800, color: C.bogolanTextSec, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 10px' }}>Prérequis</p>
                {ua.prerequis.map((p, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                    <Lock size={11} color={C.bogolanTextSec} style={{ flexShrink: 0, marginTop: 3 }} />
                    <p style={{ fontSize: 12, lineHeight: 1.5, color: C.bogolanTextSec, margin: 0 }}>{p}</p>
                  </div>
                ))}
              </Card>
            )}

            <StepCTA onClick={() => goStep('apprendre')} C={C} icon={BookOpen}>Apprendre la leçon</StepCTA>
          </div>
        )}

        {/* ── 2. APPRENDRE ── */}
        {step === 'apprendre' && (
          <div ref={lessonRef} style={{ animation: 'fadeUp .35s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Progression de lecture */}
            <div style={{ position: 'sticky', top: xs ? 46 : 54, zIndex: 10, height: 4, background: C.bogolanBorder, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${readPct}%`, background: `linear-gradient(90deg, ${C.bogolanTerre}, ${C.bogolanVert})`, transition: 'width .15s linear' }} />
            </div>

            {lecons.length > 1 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {lecons.map((l, i) => (
                  <button key={l.id} onClick={() => setRessourceIdx(i)} style={{ padding: '7px 14px', borderRadius: 20, border: `1px solid ${ressourceIdx === i ? C.bogolanTerre : C.bogolanBorder}`, background: ressourceIdx === i ? C.bogolanTerre : C.bogolanSurface, color: ressourceIdx === i ? 'white' : C.bogolanTerre, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    {l.titre}
                  </button>
                ))}
              </div>
            )}

            {lecon ? (
              <Card>
                {supported && (
                  <button
                    onClick={() => { if (isReading) { stop() } else { const t = blocksToSpeech(parseBlocks(lecon?.contenu)); if (t) readAloud(t) } }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 20, border: `1.5px solid ${isReading ? C.bogolanOcre : C.bogolanIndigo}66`, background: isReading ? `${C.bogolanOcre}12` : `${C.bogolanIndigo}0D`, color: isReading ? C.bogolanOcre : C.bogolanIndigo, fontSize: 12, fontWeight: 700, cursor: 'pointer', marginBottom: 14 }}
                  >
                    <Volume2 size={13} /> {isReading ? 'Arrêter la lecture' : 'Alisha lit le cours'}
                  </button>
                )}
                <StaticContent data={lecon} C={C} xs={xs} />
              </Card>
            ) : (
              <Card><p style={{ color: C.bogolanTextSec, fontSize: 14, margin: 0, textAlign: 'center' }}>Aucune leçon disponible pour cette UA.</p></Card>
            )}

            {lecon?.points_cles?.length > 0 && (
              <Card style={{ background: `${C.bogolanVert}10`, border: `1px solid ${C.bogolanVert}33` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <CheckCircle size={15} color={C.bogolanVert} />
                  <p style={{ fontSize: 11, fontWeight: 800, color: C.bogolanVert, textTransform: 'uppercase', letterSpacing: .8, margin: 0 }}>Points clés à retenir</p>
                </div>
                {lecon.points_cles.map((pt, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                    <span style={{ color: C.bogolanVert, fontWeight: 900, flexShrink: 0 }}>✓</span>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: C.bogolanText, margin: 0 }}>{pt}</p>
                  </div>
                ))}
              </Card>
            )}

            <StepCTA onClick={() => goStep('entrainer')} C={C} icon={Dumbbell}>S'entraîner</StepCTA>
          </div>
        )}

        {/* ── 3. S'ENTRAÎNER (chemin de mission) ── */}
        {step === 'entrainer' && (
          <div style={{ animation: 'fadeUp .35s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${C.bogolanTerre}10`, border: `1px solid ${C.bogolanTerre}26`, borderRadius: 12, padding: '10px 14px' }}>
              <Target size={15} color={C.bogolanTerre} />
              <p style={{ fontSize: 12.5, color: C.bogolanText, fontWeight: 600, margin: 0 }}>
                {missions.length > 1 ? 'Suis le chemin — le palier conseillé est mis en avant.' : 'Lance les exercices quand tu te sens prêt.'}
              </p>
            </div>

            {allEx.length === 0 ? (
              <Card><p style={{ color: C.bogolanTextSec, fontSize: 14, margin: 0, textAlign: 'center' }}>Aucun exercice pour cette UA.</p></Card>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {missions.map((m, i) => {
                  const isDone = m.total > 0 && m.done >= m.total
                  const isReco = m.key === recoKey && !isDone
                  const last   = i === missions.length - 1
                  return (
                    <div key={m.key} style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
                      {/* Colonne nœud + connecteur */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <div style={{ width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: isDone ? C.bogolanVert : isReco ? m.color : C.bogolanSurface, border: `2px solid ${isDone ? C.bogolanVert : m.color}`, color: isDone || isReco ? 'white' : m.color, fontWeight: 900, fontSize: 13, boxShadow: isReco ? `0 0 0 4px ${m.color}22` : 'none' }}>
                          {isDone ? <CheckCircle2 size={18} /> : i + 1}
                        </div>
                        {!last && <div style={{ flex: 1, width: 2, background: C.bogolanBorder, minHeight: 14, marginTop: 2 }} />}
                      </div>

                      {/* Carte mission */}
                      <div style={{ flex: 1, minWidth: 0, marginBottom: 12, background: C.bogolanSurface, borderRadius: 14, border: `1.5px solid ${isReco ? `${m.color}66` : C.bogolanBorder}`, boxShadow: isReco ? `0 6px 18px ${m.color}22` : `0 2px 10px ${C.bogolanTerre}0D`, overflow: 'hidden' }}>
                        <div style={{ padding: isMobile ? '13px 14px' : '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.bogolanText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{m.label}</p>
                              {isReco && <span style={{ fontSize: 9, fontWeight: 800, color: 'white', background: m.color, borderRadius: 20, padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: 3 }}><Sparkles size={8} /> Conseillé</span>}
                              {m.done > 0 && !isDone && <span style={{ fontSize: 9, fontWeight: 800, color: C.bogolanVert, background: `${C.bogolanVert}15`, borderRadius: 20, padding: '2px 7px' }}>{m.done}/{m.total}</span>}
                              {isDone && <span style={{ fontSize: 9, fontWeight: 800, color: C.bogolanVert, background: `${C.bogolanVert}15`, borderRadius: 20, padding: '2px 7px' }}>✓ Réussi</span>}
                            </div>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 11, color: C.bogolanTextSec, fontWeight: 600 }}>{m.total} question{m.total > 1 ? 's' : ''}</span>
                              <span style={{ fontSize: 11, color: C.bogolanOcre, fontWeight: 700 }}>★ {m.ex.reduce((s, e) => s + (e.points || 0), 0)} pts</span>
                            </div>
                            {m.total > 1 && (
                              <div style={{ marginTop: 8, height: 4, background: C.bogolanBorder, borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.round(m.done / m.total * 100)}%`, background: C.bogolanVert, transition: 'width .6s ease' }} />
                              </div>
                            )}
                          </div>
                          <button onClick={() => { navigator.vibrate?.(25); navigate(`/session/${uaId}${m.query}`) }} style={{ padding: isMobile ? '10px 13px' : '11px 18px', background: isDone ? `${C.bogolanVert}15` : `linear-gradient(135deg, ${m.color}, ${m.color}cc)`, color: isDone ? C.bogolanVert : 'white', border: 'none', borderRadius: 11, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, whiteSpace: 'nowrap', boxShadow: isDone ? 'none' : `0 3px 12px ${m.color}33` }}>
                            <Play size={13} fill={isDone ? C.bogolanVert : 'white'} /> {isDone ? 'Revoir' : m.done > 0 ? 'Continuer' : 'Démarrer'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Démarrage global */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
              <button onClick={() => { navigator.vibrate?.(30); navigate(`/tutoriel/${uaId}`) }} style={{ flex: 1, padding: '13px', background: `linear-gradient(135deg, ${C.bogolanTerre}, ${C.bogolanOcre})`, color: 'white', border: 'none', borderRadius: 13, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 16px ${C.bogolanTerre}40` }}>
                <Sparkles size={15} /> Démarrer avec Alisha
              </button>
              {allEx.length > 1 && (
                <button onClick={() => { navigator.vibrate?.(20); navigate(`/session/${uaId}?skip=1`) }} style={{ flex: 1, padding: '13px', background: 'none', color: C.bogolanTerre, border: `1.5px solid ${C.bogolanTerre}40`, borderRadius: 13, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  Tout faire d'un coup · {allEx.length}
                </button>
              )}
            </div>

            <StepCTA onClick={() => goStep('valider')} C={C} icon={Trophy} variant="ghost">Voir mon bilan</StepCTA>
          </div>
        )}

        {/* ── 4. VALIDER (bilan + célébration) ── */}
        {step === 'valider' && (
          <div style={{ animation: 'fadeUp .35s ease', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card style={{ textAlign: 'center', background: mastered ? `linear-gradient(135deg, ${C.bogolanVert}14, ${C.bogolanSurface})` : C.bogolanSurface, border: `1.5px solid ${mastered ? C.bogolanVert + '40' : C.bogolanBorder}` }}>
              {mastered ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                    <AdinkraSymbol id="nyame_nti" size={72} color={C.bogolanVert} animate />
                  </div>
                  <h2 style={{ fontSize: 18, fontWeight: 900, color: C.bogolanVert, margin: '0 0 4px' }}>Unité maîtrisée ! 🎉</h2>
                  <p style={{ fontSize: 13, color: C.bogolanTextSec, margin: 0 }}>Bravo, tu as atteint la maîtrise de cette unité.</p>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                    <BKTRing score={bkt || 0} size={88} stroke={8} />
                  </div>
                  <h2 style={{ fontSize: 17, fontWeight: 900, color: C.bogolanText, margin: '0 0 4px' }}>Tu progresses bien</h2>
                  <p style={{ fontSize: 13, color: C.bogolanTextSec, margin: 0 }}>
                    Maîtrise actuelle : {masteryPct}% — continue pour atteindre 80%.
                  </p>
                </>
              )}
            </Card>

            <Card>
              <p style={{ fontSize: 11, fontWeight: 800, color: C.bogolanTerre, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 12px' }}>Ta progression</p>
              {[
                { label: 'Exercices réussis', value: `${doneCount}/${allEx.length}` },
                { label: 'Maîtrise (BKT)',    value: `${masteryPct}%` },
                { label: 'Compétences visées', value: ua.competences?.length || 0 },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${C.bogolanBorder}` }}>
                  <span style={{ fontSize: 13, color: C.bogolanTextSec }}>{s.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.bogolanTerre }}>{s.value}</span>
                </div>
              ))}
            </Card>

            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
              {!mastered && (
                <button onClick={() => goStep('entrainer')} style={{ flex: 1, padding: '13px', background: `linear-gradient(135deg, ${C.bogolanVert}, #3C6749)`, color: 'white', border: 'none', borderRadius: 13, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 16px ${C.bogolanVert}40` }}>
                  <Dumbbell size={15} /> Continuer à m'entraîner
                </button>
              )}
              <button onClick={() => navigate('/parcours')} style={{ flex: 1, padding: '13px', background: mastered ? `linear-gradient(135deg, ${C.bogolanTerre}, ${C.bogolanOcre})` : 'none', color: mastered ? 'white' : C.bogolanTerre, border: mastered ? 'none' : `1.5px solid ${C.bogolanTerre}40`, borderRadius: 13, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: mastered ? `0 4px 16px ${C.bogolanTerre}40` : 'none' }}>
                Retour au parcours <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      </div>{/* fin conteneur maxWidth */}

      {/* ══ CTA collant (mobile, au-dessus du MobileNav) ══ */}
      {isMobile && primaryCTA && (
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 68, zIndex: 30, padding: '8px 12px', background: `${C.bogolanBg}F2`, backdropFilter: 'blur(8px)', borderTop: `1px solid ${C.bogolanBorder}` }}>
          <button onClick={primaryCTA.onClick} style={{ width: '100%', padding: '13px', background: `linear-gradient(135deg, ${C.bogolanTerre}, ${C.bogolanOcre})`, color: 'white', border: 'none', borderRadius: 13, fontSize: 14, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: `0 4px 16px ${C.bogolanTerre}45`, animation: 'breath 3s ease-in-out infinite' }}>
            <primaryCTA.icon size={16} /> {primaryCTA.label}
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Bouton CTA d'étape (in-flow, desktop + mobile) ── */
function StepCTA({ onClick, C, icon: Icon, children, variant = 'solid' }) {
  const solid = variant === 'solid'
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', padding: '14px', borderRadius: 14, cursor: 'pointer',
        border: solid ? 'none' : `1.5px solid ${C.bogolanTerre}40`,
        background: solid ? `linear-gradient(135deg, ${C.bogolanTerre}, ${C.bogolanOcre})` : 'none',
        color: solid ? 'white' : C.bogolanTerre, fontSize: 15, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        boxShadow: solid ? `0 4px 18px ${C.bogolanTerre}40` : 'none',
      }}
    >
      {Icon && <Icon size={16} />} {children} <ChevronRight size={16} />
    </button>
  )
}
