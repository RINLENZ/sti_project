import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Clock, BookOpen, ChevronRight, CheckCircle,
  Target, ArrowLeft, Play, Lock, Star
} from 'lucide-react'
import { C, useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Spinner } from '../../components/Skeleton'
import ContentRenderer from '../../components/ContentRenderer'

const ProgressBar = ({ value, color, h = 6 }) => {
  const { C } = useTheme()
  const col = color ?? C.emerald
  return (
    <div style={{ height: h, backgroundColor: C.brownPale, borderRadius: h, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, backgroundColor: col, borderRadius: h, transition: 'width .6s ease' }}/>
    </div>
  )
}

/* ── Rendu Markdown simplifié ─────────────────────────────────── */
function MarkdownRenderer({ content }) {
  const { C } = useTheme()
  if (!content) return null
  const lines = content.split('\n')
  const elements = []
  let inCode = false, codeLines = [], key = 0

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        elements.push(
          <div key={key++} style={{
            background: '#1A1207', borderRadius: 10, padding: '14px 16px',
            marginBottom: 16, overflowX: 'auto', border: `1px solid ${C.brownPale}`
          }}>
            <pre style={{ margin: 0, fontSize: 12, color: '#E5E7EB', lineHeight: 1.7, fontFamily: 'monospace' }}>
              {codeLines.join('\n')}
            </pre>
          </div>
        )
        codeLines = []; inCode = false
      } else { inCode = true }
      continue
    }
    if (inCode) { codeLines.push(line); continue }

    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={key++} style={{ fontSize: 16, fontWeight: 800, color: C.brown, margin: '20px 0 8px', paddingBottom: 8, borderBottom: `2px solid ${C.brownPale}` }}>
          {line.replace('## ', '')}
        </h2>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: '14px 0 6px' }}>
          {line.replace('### ', '')}
        </h3>
      )
    } else if (line.startsWith('- ')) {
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          <span style={{ color: C.brownLight, fontWeight: 900, flexShrink: 0, marginTop: 2 }}>•</span>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: C.text, margin: 0 }}>{line.replace('- ', '')}</p>
        </div>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={key++} style={{ height: 8 }}/>)
    } else if (line.startsWith('| ')) {
      const cells = line.split('|').filter(c => c.trim() && !c.match(/^[-\s]+$/))
      if (cells.length > 0 && !line.match(/^\|[-\s|]+\|$/)) {
        elements.push(
          <div key={key++} style={{ display: 'flex', gap: 0, marginBottom: 2 }}>
            {cells.map((cell, i) => (
              <div key={i} style={{
                flex: 1, padding: '7px 10px', fontSize: 12,
                backgroundColor: i === 0 ? C.brownPale : C.surface,
                border: `1px solid ${C.brownPale}`,
                fontWeight: i === 0 ? 700 : 400, color: C.text
              }}>
                {cell.trim()}
              </div>
            ))}
          </div>
        )
      }
    } else {
      elements.push(
        <p key={key++} style={{ fontSize: 14, lineHeight: 1.8, color: C.text, marginBottom: 8 }}>
          {line}
        </p>
      )
    }
  }
  return <div>{elements}</div>
}

/* ── Sidebar ────────────────────────────────────────────────────── */
function Sidebar({ ua, uaId, navigate }) {
  const { C } = useTheme()
  const diffLabel = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' }
  const diffColor = { 1: C.emerald, 2: C.orange, 3: C.red }
  const diffBg    = { 1: C.emeraldPale, 2: '#FEF3C7', 3: '#FEE2E2' }

  return (
    <>
      {/* Compétences visées */}
      <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '18px', marginBottom: 14, boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1px solid ${C.brownPale}` }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: C.brown, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 12, margin: '0 0 12px' }}>
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
              <Lock size={11} color={C.textSec} style={{ flexShrink: 0, marginTop: 3 }}/>
              <p style={{ fontSize: 12, lineHeight: 1.5, color: C.textSec, margin: 0 }}>{p}</p>
            </div>
          ))}
        </div>
      )}

      {/* Résumé UA */}
      <div style={{ background: `linear-gradient(135deg, ${C.brownPale}, ${C.emeraldPale})`, borderRadius: 16, padding: '18px', border: `1px solid ${C.brownLight}30` }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: C.brown, margin: '0 0 12px' }}>
          Résumé de l'unité
        </p>
        {[
          { icon: <Clock size={13}/>,   label: 'Durée',       value: `${ua.duree_estimee} min` },
          { icon: <BookOpen size={13}/>, label: 'Exercices',   value: ua.exercices?.length || 0 },
          { icon: <Target size={13}/>,   label: 'Compétences', value: ua.competences?.length || 0 },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.brownLight}20` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textSec, fontSize: 12 }}>
              {s.icon} {s.label}
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: C.brown }}>{s.value}</span>
          </div>
        ))}

        <button onClick={() => navigate(`/session/${uaId}`)} style={{
          width: '100%', marginTop: 14, padding: '12px',
          background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
          color: 'white', border: 'none', borderRadius: 10,
          fontSize: 13, fontWeight: 800, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
        }}>
          <Play size={14} fill="white"/> Commencer
        </button>
      </div>
    </>
  )
}

/* ── Main component ─────────────────────────────────────────────── */
export default function CoursDetail() {
  const { C }     = useTheme()
  const { uaId }  = useParams()
  const navigate  = useNavigate()
  const { mobile: isMobile, tablet: isTablet } = useBreakpoint()

  const user = useSelector(s => s.auth.user)

  const [ua, setUA]               = useState(null)
  const [tab, setTab]             = useState('lecon')
  const [loading, setLoading]     = useState(true)
  const [ressourceIdx, setRessourceIdx] = useState(0)

  useEffect(() => {
    const url = user?.id ? `/api/cours/ua/${uaId}?user_id=${user.id}` : `/api/cours/ua/${uaId}`
    api.get(url)
      .then(({ data }) => setUA(data))
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [uaId])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: C.bg, gap: 12 }}>
      <Spinner size={40} />
      <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>Chargement du cours…</p>
    </div>
  )

  if (!ua) return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: C.bg, gap: 12 }}>
      <p style={{ fontSize: 32 }}>😕</p>
      <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>Cours introuvable</p>
    </div>
  )

  const lecons    = ua.ressources?.filter(r => r.type === 'lecon') || []
  const lecon     = lecons[ressourceIdx]
  const diffLabel = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' }
  const diffColor = { 1: C.emerald, 2: C.orange, 3: C.red }
  const diffBg    = { 1: C.emeraldPale, 2: '#FEF3C7', 3: '#FEE2E2' }

  /* ── Hero padding selon breakpoint ── */
  const heroPad = isMobile ? '20px 16px' : '28px 32px'
  const contentPad = isMobile ? '16px' : isTablet ? '20px' : '28px 24px'
  const sidebarWidth = isTablet ? 220 : 260

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>

      {/* ── Hero ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brown} 0%, ${C.brownLight} 100%)`,
        padding: heroPad, color: 'white', position: 'relative', overflow: 'hidden'
      }}>
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
          <button onClick={() => navigate(-1)} style={{
            background: 'rgba(255,255,255,.15)', border: 'none',
            color: 'white', borderRadius: 8, padding: isMobile ? '8px 12px' : '6px 14px',
            cursor: 'pointer', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: isMobile ? 16 : 20,
            minHeight: isMobile ? 44 : 'auto'
          }}>
            <ArrowLeft size={14}/> Retour
          </button>

          <div style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            justifyContent: 'space-between',
            alignItems: isMobile ? 'flex-start' : 'flex-start',
            gap: isMobile ? 14 : 20
          }}>
            <div style={{ flex: 1 }}>
              <span style={{ background: 'rgba(255,255,255,.2)', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-block', marginBottom: 10 }}>
                {ua.reference_ue}
              </span>
              <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 900, marginBottom: 10, lineHeight: 1.25, margin: '0 0 10px' }}>
                {ua.titre}
              </h1>
              <div style={{ display: 'flex', gap: isMobile ? 10 : 16, flexWrap: 'wrap', marginTop: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: .85 }}>
                  <Clock size={12}/> {ua.duree_estimee} min
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: .85 }}>
                  <BookOpen size={12}/> {ua.exercices?.length} exercices
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, opacity: .85 }}>
                  <Target size={12}/> {ua.competences?.length} compétences
                </span>
              </div>
            </div>

            {/* CTA hero */}
            <button onClick={() => navigate(`/session/${uaId}`)} style={{
              background: 'white', border: 'none', borderRadius: 14,
              padding: isMobile ? '13px 20px' : '14px 28px',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: isMobile ? 14 : 15, fontWeight: 800, color: C.brown,
              boxShadow: '0 4px 20px rgba(0,0,0,.2)',
              width: isMobile ? '100%' : 'auto',
              justifyContent: isMobile ? 'center' : 'flex-start',
              minHeight: 44
            }}>
              <Play size={15} fill={C.brown}/> Commencer les exercices
            </button>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ maxWidth: 1000, margin: '0 auto', padding: contentPad }}>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? 16 : 20,
          alignItems: 'flex-start'
        }}>

          {/* ── Colonne principale ── */}
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>

            {/* Situation problème */}
            {ua.situation_probleme && (
              <div style={{
                background: `linear-gradient(135deg, ${C.brownPale}, ${C.emeraldPale})`,
                borderRadius: 14, padding: isMobile ? '16px' : '20px 24px',
                marginBottom: 20, border: `1px solid ${C.brownLight}30`,
                animation: 'fadeUp .4s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Star size={14} color={C.gold} fill={C.gold}/>
                  <p style={{ fontSize: 11, fontWeight: 800, color: C.brown, textTransform: 'uppercase', letterSpacing: .8, margin: 0 }}>
                    Situation problème
                  </p>
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.8, color: C.text, margin: 0, whiteSpace: 'pre-line' }}>
                  {ua.situation_probleme}
                </p>
              </div>
            )}

            {/* Tabs */}
            <div style={{
              display: 'flex', gap: 4, marginBottom: 20,
              background: C.brownPale, padding: 4, borderRadius: 12
            }}>
              {[
                { key: 'lecon',     label: '📖 Leçon' },
                { key: 'exercices', label: '✏️ Exercices' },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  flex: 1, padding: isMobile ? '11px 8px' : '10px 16px',
                  border: 'none', borderRadius: 9,
                  cursor: 'pointer', fontSize: isMobile ? 13 : 14,
                  fontWeight: tab === t.key ? 800 : 500,
                  background: tab === t.key ? C.surface : 'transparent',
                  color: tab === t.key ? C.brown : C.textSec,
                  boxShadow: tab === t.key ? '0 2px 8px rgba(107,58,42,0.12)' : 'none',
                  transition: 'all .2s',
                  minHeight: 44
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Leçon ── */}
            {tab === 'lecon' && (
              <div style={{ animation: 'fadeUp .3s ease' }}>
                {lecons.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                    {lecons.map((l, i) => (
                      <button key={l.id} onClick={() => setRessourceIdx(i)} style={{
                        padding: '7px 14px', borderRadius: 20, border: 'none',
                        background: ressourceIdx === i ? C.brown : C.brownPale,
                        color: ressourceIdx === i ? 'white' : C.brown,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        minHeight: 36
                      }}>
                        {l.titre}
                      </button>
                    ))}
                  </div>
                )}

                {lecon ? (
                  <div style={{
                    backgroundColor: C.surface, borderRadius: 14,
                    padding: isMobile ? '18px 16px' : '24px 28px',
                    boxShadow: '0 2px 12px rgba(107,58,42,0.08)',
                    border: `1px solid ${C.brownPale}`, marginBottom: 16
                  }}>
                    <h2 style={{ fontSize: isMobile ? 15 : 17, fontWeight: 800, color: C.brown, marginBottom: 16, paddingBottom: 10, borderBottom: `2px solid ${C.brownPale}` }}>
                      {lecon.titre}
                    </h2>
                    <ContentRenderer content={lecon.contenu}/>
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
                      <p style={{ fontSize: 11, fontWeight: 800, color: C.emerald, textTransform: 'uppercase', letterSpacing: .8, margin: 0 }}>
                        Points clés à retenir
                      </p>
                    </div>
                    {lecon.points_cles.map((pt, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
                        <span style={{ color: C.emerald, fontWeight: 900, flexShrink: 0 }}>✓</span>
                        <p style={{ fontSize: 13, lineHeight: 1.6, color: C.text, margin: 0 }}>{pt}</p>
                      </div>
                    ))}
                  </div>
                )}

                <button onClick={() => navigate(`/session/${uaId}?skip=1`)} style={{
                  width: '100%', padding: '15px',
                  background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                  color: 'white', border: 'none', borderRadius: 14,
                  fontSize: isMobile ? 14 : 15, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: `0 4px 20px ${C.brown}40`, minHeight: 52
                }}>
                  <Play size={15} fill="white"/> Commencer les exercices <ChevronRight size={15}/>
                </button>
              </div>
            )}

            {/* ── Exercices ── */}
            {tab === 'exercices' && (() => {
              const allEx = ua.exercices || []
              const groupNums = [...new Set(allEx.map(e => e.groupe).filter(g => g != null))].sort((a,b) => a-b)
              const hasGroups = groupNums.length > 0

              // Chaque exercice individuel avec son propre bouton "Faire"
              const ExRow = (ex, i) => (
                <div key={ex.id} style={{
                  backgroundColor: C.surface, borderRadius: 12,
                  padding: isMobile ? '13px 14px' : '13px 16px',
                  boxShadow: '0 2px 8px rgba(107,58,42,0.07)',
                  border: `1px solid ${C.brownPale}`,
                  display: 'flex', alignItems: 'center', gap: 12
                }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.titre}</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ backgroundColor: diffBg[ex.difficulte], color: diffColor[ex.difficulte], padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{diffLabel[ex.difficulte]}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: C.brownLight }}>{ex.points} pts</span>
                    </div>
                  </div>
                  <button onClick={() => navigate(`/session/${uaId}?exercice_id=${ex.id}&skip=1`)}
                    style={{ padding: '8px 14px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, boxShadow: `0 2px 8px ${C.brown}30` }}>
                    <Play size={11} fill="white"/> Faire
                  </button>
                </div>
              )

              if (!hasGroups) {
                // Auto-groupement par difficulté si plusieurs niveaux existent
                const diffLevels = [...new Set(allEx.map(e => e.difficulte).filter(d => d != null))].sort((a,b) => a-b)
                const DIFF_LABELS = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' }
                const DIFF_COLORS = { 1: C.emerald, 2: '#D97706', 3: C.red }
                const DIFF_ICONS  = { 1: '▲', 2: '▲▲', 3: '▲▲▲' }
                const totalPts    = (list) => list.reduce((s,e) => s + (e.points||0), 0)
                // Recommandation basée sur BKT (null = premier accès)
                const bkt = ua.bkt_score
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
                          return (
                            <div key={d} style={{ backgroundColor: C.surface, borderRadius: 16, border: `1.5px solid ${DIFF_COLORS[d]}30`, overflow: 'hidden', boxShadow: '0 2px 10px rgba(107,58,42,0.08)' }}>
                              <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${DIFF_COLORS[d]}, ${DIFF_COLORS[d]}aa)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${DIFF_COLORS[d]}30` }}>
                                  <span style={{ fontSize: 13, fontWeight: 900, color: 'white' }}>{DIFF_ICONS[d]}</span>
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                                    <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>{DIFF_LABELS[d]}</p>
                                    {d === recommDiff && (
                                      <span style={{ fontSize: 9, fontWeight: 800, color: 'white', background: C.emerald, borderRadius: 20, padding: '2px 7px', letterSpacing: .3 }}>
                                        ✦ Recommandé
                                      </span>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', gap: 10 }}>
                                    <span style={{ fontSize: 11, color: C.textSec, fontWeight: 600 }}>{dEx.length} question{dEx.length > 1 ? 's' : ''}</span>
                                    <span style={{ fontSize: 11, color: C.brownLight, fontWeight: 600 }}>★ {tp} pts</span>
                                  </div>
                                </div>
                                <button onClick={() => navigate(`/session/${uaId}?difficulte=${d}&skip=1`)} style={{ padding: isMobile ? '10px 14px' : '11px 20px', background: `linear-gradient(135deg, ${DIFF_COLORS[d]}, ${DIFF_COLORS[d]}cc)`, color: 'white', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, boxShadow: `0 3px 12px ${DIFF_COLORS[d]}30`, whiteSpace: 'nowrap' }}>
                                  <Play size={13} fill="white"/> Démarrer
                                </button>
                              </div>
                              <div style={{ borderTop: `1px solid ${C.brownPale}`, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {dEx.map((ex, i) => (
                                  <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ width: 18, height: 18, borderRadius: 5, background: C.brownPale, color: C.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{i+1}</span>
                                    <span style={{ fontSize: 12, color: C.text, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.titre}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      <button onClick={() => navigate(`/session/${uaId}?skip=1`)} style={{ width: '100%', padding: '13px', background: C.brownPale, color: C.brown, border: `1.5px solid ${C.brownLight}40`, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        Tout faire en une session · {allEx.length} questions
                      </button>
                    </div>
                  )
                }

                // Un seul niveau ou pas de difficulté → liste individuelle
                return (
                  <div style={{ animation: 'fadeUp .3s ease' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                      {allEx.map((ex, i) => ExRow(ex, i))}
                    </div>
                    {allEx.length > 1 && (
                      <button onClick={() => navigate(`/session/${uaId}?skip=1`)} style={{ width: '100%', padding: '13px', background: C.brownPale, color: C.brown, border: `1.5px solid ${C.brownLight}40`, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        Tout faire en une session · {allEx.length} exercices
                      </button>
                    )}
                  </div>
                )
              }

              // Mode groupes : cartes de sélection + liste dépliable
              const ungrouped = allEx.filter(e => e.groupe == null)
              const DIFF_COLORS = { 1: C.emerald, 2: '#D97706', 3: C.red }
              const avgDiff = (list) => list.length ? Math.round(list.reduce((s,e) => s + (e.difficulte||1), 0) / list.length) : 1
              const totalPts = (list) => list.reduce((s,e) => s + (e.points||0), 0)

              return (
                <div style={{ animation: 'fadeUp .3s ease' }}>
                  {/* Info */}
                  <div style={{ background: C.brownPale, borderRadius: 10, padding: '9px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Target size={13} color={C.brown}/>
                    <p style={{ fontSize: 12, color: C.brown, fontWeight: 700, margin: 0 }}>
                      Ce cours contient {groupNums.length} exercice{groupNums.length > 1 ? 's' : ''} — choisis par où commencer.
                    </p>
                  </div>

                  {/* Cartes d'exercices */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                    {groupNums.map(g => {
                      const gEx = allEx.filter(e => e.groupe === g)
                      const ad = avgDiff(gEx)
                      const tp = totalPts(gEx)
                      const gTitre = gEx[0]?.groupe_titre || null
                      return (
                        <div key={g} style={{ backgroundColor: C.surface, borderRadius: 16, border: `1.5px solid ${C.brownPale}`, overflow: 'hidden', boxShadow: '0 2px 10px rgba(107,58,42,0.08)' }}>
                          {/* En-tête */}
                          <div style={{ padding: isMobile ? '14px 16px' : '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 4px 12px ${C.brown}30` }}>
                              <span style={{ fontSize: 18, fontWeight: 900, color: 'white' }}>{g}</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: '0 0 3px', fontSize: 14, fontWeight: 800, color: C.text }}>
                                Exercice {g}{gTitre ? ` : ${gTitre}` : ''}
                              </p>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 11, color: C.textSec, fontWeight: 600 }}>{gEx.length} question{gEx.length > 1 ? 's' : ''}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: DIFF_COLORS[ad] }}>
                                  {'▲'.repeat(ad)} {ad === 1 ? 'Facile' : ad === 2 ? 'Moyen' : 'Difficile'}
                                </span>
                                <span style={{ fontSize: 11, color: C.brownLight, fontWeight: 600 }}>★ {tp} pts</span>
                              </div>
                            </div>
                            <button onClick={() => navigate(`/session/${uaId}?groupe=${g}&skip=1`)} style={{ padding: isMobile ? '10px 14px' : '11px 20px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 12, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, boxShadow: `0 3px 12px ${C.brown}30`, whiteSpace: 'nowrap' }}>
                              <Play size={13} fill="white"/> Démarrer
                            </button>
                          </div>
                          {/* Liste des questions */}
                          <div style={{ borderTop: `1px solid ${C.brownPale}`, padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {gEx.map((ex, i) => (
                              <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ width: 18, height: 18, borderRadius: 5, background: C.brownPale, color: C.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{i+1}</span>
                                <span style={{ fontSize: 12, color: C.text, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.titre}</span>
                                <span style={{ fontSize: 10, color: DIFF_COLORS[ex.difficulte], fontWeight: 700 }}>{'▲'.repeat(ex.difficulte)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })}

                    {/* Exercices sans groupe (si existants) */}
                    {ungrouped.length > 0 && (
                      <div style={{ backgroundColor: C.surface, borderRadius: 14, border: `1px dashed ${C.brownLight}`, padding: isMobile ? '12px 14px' : '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: '0 0 2px', fontSize: 13, fontWeight: 700, color: C.text }}>Exercices libres</p>
                          <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>{ungrouped.length} exercice{ungrouped.length > 1 ? 's' : ''} sans groupe assigné</p>
                        </div>
                        <button onClick={() => navigate(`/session/${uaId}?skip=1`)} style={{ padding: '9px 16px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
                          <Play size={12} fill={C.brown}/> Faire
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bouton tout faire */}
                  <button onClick={() => navigate(`/session/${uaId}?skip=1`)} style={{ width: '100%', padding: '13px', background: C.brownPale, color: C.brown, border: `1.5px solid ${C.brownLight}40`, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    Tout faire en une session · {allEx.length} exercices
                  </button>
                </div>
              )
            })()}
          </div>

          {/* ── Sidebar ── */}
          <div style={{
            width: isMobile ? '100%' : sidebarWidth,
            flexShrink: 0,
            /* Sur mobile la sidebar descend sous le contenu */
          }}>
            <Sidebar ua={ua} uaId={uaId} navigate={navigate} />
          </div>
        </div>
      </div>
    </div>
  )
}