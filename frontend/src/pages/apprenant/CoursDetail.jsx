import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Clock, BookOpen, ChevronRight, CheckCircle,
  Target, ArrowLeft, Play, Lock, Star, CheckCircle2
} from 'lucide-react'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Sk } from '../../components/Skeleton'
import { StaticContent } from '../../components/RichContent'

// ── Constantes difficulté (une seule définition) ─────────────────
const DIFF_LABEL = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' }
const DIFF_COLOR = (C) => ({ 1: C.emerald,     2: C.orange,   3: C.red })
const DIFF_BG    = (C) => ({ 1: C.emeraldPale, 2: C.goldPale, 3: C.redPale })

// ── Skeleton de page ──────────────────────────────────────────────
function CoursDetailSkeleton() {
  const { C } = useTheme()
  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      {/* Hero skeleton */}
      <div style={{ background: `linear-gradient(135deg, ${C.brownDark}, ${C.brownLight})`, padding: '28px 32px' }}>
        <Sk w={80} h={28} r={8} style={{ marginBottom: 20, background: 'rgba(255,255,255,.15)' }} />
        <Sk w="55%" h={24} r={8} style={{ marginBottom: 10, background: 'rgba(255,255,255,.2)' }} />
        <Sk w="30%" h={14} r={6} style={{ background: 'rgba(255,255,255,.15)' }} />
      </div>
      {/* Body skeleton */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px', display: 'flex', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <Sk h={42} r={12} style={{ marginBottom: 20 }} />
          <Sk h={18} style={{ marginBottom: 10 }} />
          <Sk h={14} w="90%" style={{ marginBottom: 8 }} />
          <Sk h={14} w="75%" style={{ marginBottom: 8 }} />
          <Sk h={14} w="80%" style={{ marginBottom: 24 }} />
          <Sk h={52} r={14} />
        </div>
        <div style={{ width: 260, flexShrink: 0 }}>
          <Sk h={180} r={16} style={{ marginBottom: 12 }} />
          <Sk h={120} r={16} />
        </div>
      </div>
    </div>
  )
}

// ── Sidebar — useNavigate directement ici ────────────────────────
const QUIZ_LEVELS = [
  { level: 1, emoji: '🆕', label: 'Première fois' },
  { level: 2, emoji: '📚', label: "J'en ai entendu parler" },
  { level: 3, emoji: '⚡', label: 'Je connais déjà' },
]

function Sidebar({ ua, uaId }) {
  const { C }       = useTheme()
  const navigate    = useNavigate()
  // P9 — mini-quiz de positionnement avant démarrage
  const [startLevel, setStartLevel] = useState(null)

  return (
    <>
      {/* Compétences visées */}
      <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '18px', marginBottom: 14, boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1px solid ${C.brownPale}` }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: C.brown, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 12px' }}>
          Compétences visées
        </p>
        {ua.competences?.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0 }}>
              {i + 1}
            </div>
            <p style={{ fontSize: 12, lineHeight: 1.5, color: C.text, margin: 0 }}>{c}</p>
          </div>
        ))}
      </div>

      {/* Prérequis */}
      {ua.prerequis?.length > 0 && (
        <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '18px', marginBottom: 14, boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1px solid ${C.brownPale}` }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 12px' }}>
            Prérequis
          </p>
          {ua.prerequis.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
              <Lock size={11} color={C.textSec} style={{ flexShrink: 0, marginTop: 3 }} />
              <p style={{ fontSize: 12, lineHeight: 1.5, color: C.textSec, margin: 0 }}>{p}</p>
            </div>
          ))}
        </div>
      )}

      {/* Résumé UA + CTAs */}
      <div style={{ background: `linear-gradient(135deg, ${C.brownPale}, ${C.emeraldPale})`, borderRadius: 16, padding: '18px', border: `1px solid ${C.brownLight}30` }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: C.brown, margin: '0 0 12px' }}>
          Résumé de l'unité
        </p>
        {[
          { icon: <Clock size={13} />,    label: 'Durée',       value: `${ua.duree_estimee} min` },
          { icon: <BookOpen size={13} />, label: 'Exercices',   value: ua.exercices?.length || 0 },
          { icon: <Target size={13} />,   label: 'Compétences', value: ua.competences?.length || 0 },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.brownLight}20` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textSec, fontSize: 12 }}>
              {s.icon} {s.label}
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.brown }}>{s.value}</span>
          </div>
        ))}

        {/* P9 — Mini-quiz de positionnement */}
        {startLevel === null ? (
          <div style={{ marginTop: 16 }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.textMuted, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: .5 }}>
              🎯 Ton niveau sur ce sujet ?
            </p>
            {QUIZ_LEVELS.map(({ level, emoji, label }) => (
              <button
                key={level}
                onClick={() => { navigator.vibrate?.(15); setStartLevel(level) }}
                style={{
                  width: '100%', marginBottom: 5, padding: '8px 12px',
                  background: C.bg, border: `1.5px solid ${C.border}`,
                  borderRadius: 10, color: C.text, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                  transition: 'border-color .15s',
                }}
              >
                <span style={{ fontSize: 14 }}>{emoji}</span>{label}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div style={{ marginTop: 16, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: C.textSec, fontWeight: 600 }}>
                {QUIZ_LEVELS.find(l => l.level === startLevel)?.emoji}{' '}
                {QUIZ_LEVELS.find(l => l.level === startLevel)?.label}
              </span>
              <button onClick={() => setStartLevel(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 10, fontWeight: 600 }}>
                Changer
              </button>
            </div>
            <button
              onClick={() => { navigator.vibrate?.(30); navigate(`/tutoriel/${uaId}?level=${startLevel}`) }}
              style={{ width: '100%', padding: '12px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              🤖 Démarrer avec Alisha
            </button>
            <button
              onClick={() => { navigator.vibrate?.(20); navigate(`/session/${uaId}`) }}
              style={{ width: '100%', marginTop: 8, padding: '10px', background: 'none', color: C.brown, border: `1.5px solid ${C.brownLight}50`, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Play size={12} fill={C.brown} /> Exercices seuls
            </button>
          </>
        )}
      </div>
    </>
  )
}

// ── ExRow : ligne d'exercice individuel ──────────────────────────
// Extrait en composant pour éviter de recréer la référence à chaque render.
function ExRow({ ex, idx, uaId, completed, C, isMobile, navigate }) {
  const dc = DIFF_COLOR(C)
  const isDone = completed
  return (
    <div style={{
      backgroundColor: C.surface, borderRadius: 12,
      padding: isMobile ? '13px 14px' : '13px 16px',
      boxShadow: '0 2px 8px rgba(107,58,42,0.07)',
      border: isDone ? `1.5px solid ${C.emerald}40` : `1px solid ${C.brownPale}`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: isDone ? `${C.emerald}18` : `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: isDone ? C.emerald : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
        {isDone ? <CheckCircle2 size={16} /> : idx + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.titre}</p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ backgroundColor: DIFF_BG(C)[ex.difficulte], color: dc[ex.difficulte], padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{DIFF_LABEL[ex.difficulte]}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.brownLight }}>{ex.points} pts</span>
          {isDone && <span style={{ fontSize: 10, fontWeight: 700, color: C.emerald }}>✓ Réussi</span>}
        </div>
      </div>
      <button
        onClick={() => { navigator.vibrate?.(20); navigate(`/session/${uaId}?exercice_id=${ex.id}&skip=1`) }}
        style={{ padding: '8px 14px', background: isDone ? `${C.emerald}15` : `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: isDone ? C.emerald : 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, boxShadow: isDone ? 'none' : `0 2px 8px ${C.brown}30` }}
      >
        <Play size={11} fill={isDone ? C.emerald : 'white'} />
        {isDone ? 'Revoir' : 'Faire'}
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function CoursDetail() {
  const { C }     = useTheme()
  const { uaId }  = useParams()
  const navigate  = useNavigate()
  const { xs, mobile: isMobile, tablet: isTablet } = useBreakpoint()

  const user = useSelector(s => s.auth.user)

  const [ua,           setUA]           = useState(null)
  const [tab,          setTab]          = useState('lecon')
  const [loading,      setLoading]      = useState(true)
  const [ressourceIdx, setRessourceIdx] = useState(0)

  // user_id N'EST PLUS passé en query param — le backend lit le JWT
  useEffect(() => {
    api.get(`/api/cours/ua/${uaId}`)
      .then(({ data }) => setUA(data))
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [uaId])

  if (loading) return <CoursDetailSkeleton />

  if (!ua) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: C.bg, gap: 12 }}>
      <p style={{ fontSize: 32 }}>😕</p>
      <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>Cours introuvable</p>
    </div>
  )

  const lecons     = ua.ressources?.filter(r => r.type === 'lecon') || []
  const lecon      = lecons[ressourceIdx]
  const completed  = new Set(ua.completed_exercise_ids || [])
  const dc         = DIFF_COLOR(C)

  const heroPad     = xs ? '14px 12px' : isMobile ? '20px 16px' : '28px 32px'
  const contentPad  = xs ? '12px' : isMobile ? '16px' : isTablet ? '20px' : '28px 24px'
  const sidebarWidth = isTablet ? 220 : 260

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* ── Hero ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.brown} 0%, ${C.brownLight} 100%)`, padding: heroPad, color: 'white', position: 'relative', overflow: 'hidden' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }}>
          <defs>
            <pattern id="adinkra-cours" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="30" cy="30" r="6"  fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="30" y1="18" x2="30" y2="12" stroke="white" strokeWidth="1.5"/>
              <line x1="18" y1="30" x2="12" y2="30" stroke="white" strokeWidth="1.5"/>
              <line x1="42" y1="30" x2="48" y2="30" stroke="white" strokeWidth="1.5"/>
              <line x1="30" y1="42" x2="30" y2="48" stroke="white" strokeWidth="1.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#adinkra-cours)"/>
        </svg>

        <div style={{ position: 'relative' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'rgba(255,255,255,.15)', border: 'none', color: 'white', borderRadius: 8, padding: isMobile ? '8px 12px' : '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: isMobile ? 16 : 20, minHeight: isMobile ? 44 : 'auto' }}>
            <ArrowLeft size={14}/> Retour
          </button>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: isMobile ? 14 : 20 }}>
            <div style={{ flex: 1 }}>
              <span style={{ background: 'rgba(255,255,255,.2)', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-block', marginBottom: 10 }}>
                {ua.reference_ue}
              </span>
              <h1 style={{ fontSize: xs ? 15 : isMobile ? 18 : 22, fontWeight: 900, lineHeight: 1.25, margin: '0 0 10px' }}>
                {ua.titre}
              </h1>
              <div style={{ display: 'flex', gap: isMobile ? 10 : 16, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: .85 }}><Clock size={12}/> {ua.duree_estimee} min</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: .85 }}><BookOpen size={12}/> {ua.exercices?.length} exercices</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: .85 }}><Target size={12}/> {ua.competences?.length} compétences</span>
              </div>

              {/* BKT mastery */}
              {ua.bkt_score != null && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, opacity: .75, fontWeight: 600 }}>Maîtrise</span>
                    <span style={{ fontSize: 12, fontWeight: 900, opacity: .95 }}>{Math.round(ua.bkt_score * 100)}%</span>
                  </div>
                  <div style={{ height: 5, background: 'rgba(255,255,255,.25)', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.round(ua.bkt_score * 100)}%`, background: 'rgba(255,255,255,.9)', borderRadius: 5, transition: 'width .8s ease' }}/>
                  </div>
                </div>
              )}
            </div>

            {/* CTAs hero — Alisha en primary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: isMobile ? '100%' : 'auto' }}>
              <button
                onClick={() => { navigator.vibrate?.(30); navigate(`/tutoriel/${uaId}`) }}
                style={{ background: 'white', border: 'none', borderRadius: 14, padding: isMobile ? '13px 20px' : '14px 28px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: isMobile ? 14 : 15, fontWeight: 800, color: C.brown, boxShadow: '0 4px 20px rgba(0,0,0,.2)', width: '100%', justifyContent: 'center', minHeight: 44 }}
              >
                🤖 Démarrer avec Alisha
              </button>
              <button
                onClick={() => { navigator.vibrate?.(20); navigate(`/session/${uaId}`) }}
                style={{ background: 'rgba(255,255,255,.15)', border: '1.5px solid rgba(255,255,255,.4)', borderRadius: 12, padding: '9px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.9)', width: '100%', justifyContent: 'center', minHeight: 40 }}
              >
                <Play size={12} fill="rgba(255,255,255,.9)"/> Exercices seuls
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: contentPad }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 16 : 20, alignItems: 'flex-start' }}>

          {/* ── Colonne principale ── */}
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>

            {/* Situation problème */}
            {ua.situation_probleme && (
              <div style={{ background: `linear-gradient(135deg, ${C.brownPale}, ${C.emeraldPale})`, borderRadius: 14, padding: isMobile ? '16px' : '20px 24px', marginBottom: 20, border: `1px solid ${C.brownLight}30`, animation: 'fadeUp .4s ease' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Star size={14} color={C.gold} fill={C.gold}/>
                  <p style={{ fontSize: 11, fontWeight: 800, color: C.brown, textTransform: 'uppercase', letterSpacing: .8, margin: 0 }}>Situation problème</p>
                </div>
                {/* Délégué à StaticContent pour interpréter le Markdown éventuel */}
                <StaticContent data={{ contenu: ua.situation_probleme, points_cles: [] }} C={C} xs={xs} />
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: C.brownPale, padding: 4, borderRadius: 12 }}>
              {[
                { key: 'lecon',     label: '📖 Leçon' },
                { key: 'exercices', label: '✏️ Exercices' },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: isMobile ? '11px 8px' : '10px 16px', border: 'none', borderRadius: 9, cursor: 'pointer', fontSize: isMobile ? 13 : 14, fontWeight: tab === t.key ? 800 : 500, background: tab === t.key ? C.surface : 'transparent', color: tab === t.key ? C.brown : C.textSec, boxShadow: tab === t.key ? '0 2px 8px rgba(107,58,42,0.12)' : 'none', transition: 'all .2s', minHeight: 44 }}>
                  {t.label}
                  {t.key === 'exercices' && completed.size > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 10, background: C.emeraldPale, color: C.emerald, borderRadius: 10, padding: '1px 6px', fontWeight: 800 }}>
                      {completed.size}/{ua.exercices?.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Leçon — StaticContent au lieu de ContentRenderer ── */}
            {tab === 'lecon' && (
              <div style={{ animation: 'fadeUp .3s ease' }}>
                {lecons.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    {lecons.map((l, i) => (
                      <button key={l.id} onClick={() => setRessourceIdx(i)} style={{ padding: '7px 14px', borderRadius: 20, border: 'none', background: ressourceIdx === i ? C.brown : C.brownPale, color: ressourceIdx === i ? 'white' : C.brown, fontSize: 12, fontWeight: 700, cursor: 'pointer', minHeight: 36 }}>
                        {l.titre}
                      </button>
                    ))}
                  </div>
                )}

                {lecon ? (
                  <div style={{ backgroundColor: C.surface, borderRadius: 14, padding: isMobile ? '18px 16px' : '24px 28px', boxShadow: '0 2px 12px rgba(107,58,42,0.08)', border: `1px solid ${C.brownPale}`, marginBottom: 16 }}>
                    {/* StaticContent gère JSON structuré ET Markdown brut */}
                    <StaticContent data={lecon} C={C} xs={xs} />
                  </div>
                ) : (
                  <div style={{ backgroundColor: C.surface, borderRadius: 14, padding: 28, textAlign: 'center', border: `1px solid ${C.brownPale}` }}>
                    <p style={{ color: C.textSec, fontSize: 14 }}>Aucune leçon disponible pour cette UA.</p>
                  </div>
                )}

                {/* Points clés */}
                {lecon?.points_cles?.length > 0 && (
                  <div style={{ backgroundColor: C.emeraldPale, borderRadius: 14, padding: isMobile ? '16px' : '18px 22px', border: `1px solid ${C.emerald}30`, marginBottom: 20 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                      <CheckCircle size={15} color={C.emerald}/>
                      <p style={{ fontSize: 11, fontWeight: 800, color: C.emerald, textTransform: 'uppercase', letterSpacing: .8, margin: 0 }}>Points clés à retenir</p>
                    </div>
                    {lecon.points_cles.map((pt, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                        <span style={{ color: C.emerald, fontWeight: 900, flexShrink: 0 }}>✓</span>
                        <p style={{ fontSize: 13, lineHeight: 1.6, color: C.text, margin: 0 }}>{pt}</p>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  onClick={() => { navigator.vibrate?.(25); setTab('exercices') }}
                  style={{ width: '100%', padding: '15px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 14, fontSize: isMobile ? 14 : 15, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: `0 4px 20px ${C.brown}40`, minHeight: 52 }}
                >
                  Voir les exercices <ChevronRight size={15}/>
                </button>
              </div>
            )}

            {/* ── Exercices ── */}
            {tab === 'exercices' && (() => {
              const allEx     = ua.exercices || []
              const groupNums = [...new Set(allEx.map(e => e.groupe).filter(g => g != null))].sort((a,b) => a-b)
              const hasGroups = groupNums.length > 0

              if (!hasGroups) {
                const diffLevels = [...new Set(allEx.map(e => e.difficulte).filter(d => d != null))].sort((a,b) => a-b)
                const DIFF_ICONS = { 1: '▲', 2: '▲▲', 3: '▲▲▲' }
                const totalPts   = (list) => list.reduce((s,e) => s + (e.points||0), 0)
                const bkt        = ua.bkt_score
                const recommDiff = bkt == null ? 1 : bkt < 0.4 ? 1 : bkt < 0.7 ? 2 : 3

                if (diffLevels.length > 1) {
                  return (
                    <div style={{ animation: 'fadeUp .3s ease' }}>
                      <div style={{ background: C.brownPale, borderRadius: 10, padding: '9px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Target size={13} color={C.brown}/>
                        <p style={{ fontSize: 12, color: C.brown, fontWeight: 700, margin: 0 }}>
                          {diffLevels.length} niveaux disponibles — choisis ton niveau de départ.
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                        {diffLevels.map(d => {
                          const dEx = allEx.filter(e => e.difficulte === d)
                          const tp  = totalPts(dEx)
                          const doneDiff = dEx.filter(e => completed.has(e.id)).length
                          return (
                            <div key={d} style={{ backgroundColor: C.surface, borderRadius: 16, border: `1.5px solid ${dc[d]}30`, overflow: 'hidden', boxShadow: '0 2px 10px rgba(107,58,42,0.08)' }}>
                              <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${dc[d]}, ${dc[d]}aa)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${dc[d]}30` }}>
                                  <span style={{ fontSize: 13, fontWeight: 900, color: 'white' }}>{DIFF_ICONS[d]}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>{DIFF_LABEL[d]}</p>
                                    {d === recommDiff && (
                                      <span style={{ fontSize: 9, fontWeight: 800, color: 'white', background: C.emerald, borderRadius: 20, padding: '2px 7px', letterSpacing: .3 }}>✦ Recommandé</span>
                                    )}
                                    {doneDiff > 0 && (
                                      <span style={{ fontSize: 9, fontWeight: 800, color: C.emerald, background: `${C.emerald}15`, borderRadius: 20, padding: '2px 7px' }}>{doneDiff}/{dEx.length} réussis</span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: 10 }}>
                                    <span style={{ fontSize: 11, color: C.textSec, fontWeight: 600 }}>{dEx.length} question{dEx.length > 1 ? 's' : ''}</span>
                                    <span style={{ fontSize: 11, color: C.brownLight, fontWeight: 600 }}>★ {tp} pts</span>
                                  </div>
                                </div>
                                <button onClick={() => { navigator.vibrate?.(25); navigate(`/session/${uaId}?difficulte=${d}&skip=1`) }} style={{ padding: isMobile ? '10px 14px' : '11px 20px', background: `linear-gradient(135deg, ${dc[d]}, ${dc[d]}cc)`, color: 'white', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, boxShadow: `0 3px 12px ${dc[d]}30`, whiteSpace: 'nowrap' }}>
                                  <Play size={13} fill="white"/> Démarrer
                                </button>
                              </div>
                              <div style={{ borderTop: `1px solid ${C.brownPale}`, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {dEx.map((ex, i) => (
                                  <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    {completed.has(ex.id)
                                      ? <CheckCircle2 size={14} color={C.emerald} style={{ flexShrink: 0 }} />
                                      : <span style={{ width: 18, height: 18, borderRadius: 5, background: C.brownPale, color: C.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{i+1}</span>
                                    }
                                    <span style={{ fontSize: 12, color: C.text, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: completed.has(ex.id) ? 'line-through' : 'none', opacity: completed.has(ex.id) ? .55 : 1 }}>{ex.titre}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <button onClick={() => { navigator.vibrate?.(20); navigate(`/session/${uaId}?skip=1`) }} style={{ width: '100%', padding: '13px', background: C.brownPale, color: C.brown, border: `1.5px solid ${C.brownLight}40`, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        Tout faire en une session · {allEx.length} questions
                      </button>
                    </div>
                  )
                }

                // Un seul niveau → liste individuelle avec indicateurs de complétion
                return (
                  <div style={{ animation: 'fadeUp .3s ease' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                      {allEx.map((ex, i) => (
                        <ExRow
                          key={ex.id}
                          ex={ex} idx={i} uaId={uaId}
                          completed={completed.has(ex.id)}
                          C={C} isMobile={isMobile} navigate={navigate}
                        />
                      ))}
                    </div>
                    {allEx.length > 1 && (
                      <button onClick={() => { navigator.vibrate?.(20); navigate(`/session/${uaId}?skip=1`) }} style={{ width: '100%', padding: '13px', background: C.brownPale, color: C.brown, border: `1.5px solid ${C.brownLight}40`, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        Tout faire en une session · {allEx.length} exercices
                      </button>
                    )}
                  </div>
                )
              }

              // Mode groupes
              const ungrouped  = allEx.filter(e => e.groupe == null)
              const avgDiff    = (list) => list.length ? Math.round(list.reduce((s,e) => s + (e.difficulte||1), 0) / list.length) : 1
              const totalPts   = (list) => list.reduce((s,e) => s + (e.points||0), 0)

              return (
                <div style={{ animation: 'fadeUp .3s ease' }}>
                  <div style={{ background: C.brownPale, borderRadius: 10, padding: '9px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={13} color={C.brown}/>
                    <p style={{ fontSize: 12, color: C.brown, fontWeight: 700, margin: 0 }}>
                      Ce cours contient {groupNums.length} exercice{groupNums.length > 1 ? 's' : ''} — choisis par où commencer.
                    </p>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                    {groupNums.map(g => {
                      const gEx    = allEx.filter(e => e.groupe === g)
                      const ad     = avgDiff(gEx)
                      const tp     = totalPts(gEx)
                      const gTitre = gEx[0]?.groupe_titre || null
                      const doneG  = gEx.filter(e => completed.has(e.id)).length
                      return (
                        <div key={g} style={{ backgroundColor: C.surface, borderRadius: 16, border: `1.5px solid ${C.brownPale}`, overflow: 'hidden', boxShadow: '0 2px 10px rgba(107,58,42,0.08)' }}>
                          <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${C.brown}30` }}>
                              <span style={{ fontSize: 18, fontWeight: 900, color: 'white' }}>{g}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 800, color: C.text }}>Exercice {g}{gTitre ? ` : ${gTitre}` : ''}</p>
                                {doneG > 0 && (
                                  <span style={{ fontSize: 9, fontWeight: 800, color: C.emerald, background: `${C.emerald}15`, borderRadius: 20, padding: '2px 7px' }}>{doneG}/{gEx.length} réussis</span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, color: C.textSec, fontWeight: 600 }}>{gEx.length} question{gEx.length > 1 ? 's' : ''}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: dc[ad] }}>{'▲'.repeat(ad)} {ad === 1 ? 'Facile' : ad === 2 ? 'Moyen' : 'Difficile'}</span>
                                <span style={{ fontSize: 11, color: C.brownLight, fontWeight: 600 }}>★ {tp} pts</span>
                              </div>
                            </div>
                            <button onClick={() => { navigator.vibrate?.(25); navigate(`/session/${uaId}?groupe=${g}&skip=1`) }} style={{ padding: isMobile ? '10px 14px' : '11px 20px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, boxShadow: `0 3px 12px ${C.brown}30`, whiteSpace: 'nowrap' }}>
                              <Play size={13} fill="white"/> Démarrer
                            </button>
                          </div>
                          <div style={{ borderTop: `1px solid ${C.brownPale}`, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {gEx.map((ex, i) => (
                              <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                {completed.has(ex.id)
                                  ? <CheckCircle2 size={14} color={C.emerald} style={{ flexShrink: 0 }} />
                                  : <span style={{ width: 18, height: 18, borderRadius: 5, background: C.brownPale, color: C.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{i+1}</span>
                                }
                                <span style={{ fontSize: 12, color: C.text, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: completed.has(ex.id) ? 'line-through' : 'none', opacity: completed.has(ex.id) ? .55 : 1 }}>{ex.titre}</span>
                                <span style={{ fontSize: 10, color: dc[ex.difficulte], fontWeight: 700 }}>{'▲'.repeat(ex.difficulte)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    {ungrouped.length > 0 && (
                      <div style={{ backgroundColor: C.surface, borderRadius: 14, border: `1px dashed ${C.brownLight}`, padding: isMobile ? '12px 14px' : '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: C.text }}>Exercices libres</p>
                          <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>{ungrouped.length} exercice{ungrouped.length > 1 ? 's' : ''} sans groupe assigné</p>
                        </div>
                        <button onClick={() => { navigator.vibrate?.(20); navigate(`/session/${uaId}?skip=1`) }} style={{ padding: '9px 16px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Play size={12} fill={C.brown}/> Faire
                        </button>
                      </div>
                    )}
                  </div>

                  <button onClick={() => { navigator.vibrate?.(20); navigate(`/session/${uaId}?skip=1`) }} style={{ width: '100%', padding: '13px', background: C.brownPale, color: C.brown, border: `1.5px solid ${C.brownLight}40`, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    Tout faire en une session · {allEx.length} exercices
                  </button>
                </div>
              )
            })()}
          </div>

          {/* ── Sidebar ── */}
          <div style={{ width: isMobile ? '100%' : sidebarWidth, flexShrink: 0 }}>
            <Sidebar ua={ua} uaId={uaId} />
          </div>
        </div>
      </div>
    </div>
  )
}
