import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Clock, BookOpen, ChevronRight, CheckCircle,
  Target, ArrowLeft, Play, Lock, Star
} from 'lucide-react'
import { C, useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Spinner } from '../../components/Skeleton'

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

  const [ua, setUA]               = useState(null)
  const [tab, setTab]             = useState('lecon')
  const [loading, setLoading]     = useState(true)
  const [ressourceIdx, setRessourceIdx] = useState(0)

  useEffect(() => {
    api.get(`/api/cours/ua/${uaId}`)
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
          <button onClick={() => navigate('/dashboard')} style={{
            background: 'rgba(255,255,255,.15)', border: 'none',
            color: 'white', borderRadius: 8, padding: isMobile ? '8px 12px' : '6px 14px',
            cursor: 'pointer', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: isMobile ? 16 : 20,
            /* Tap target min 44px on mobile */
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
              background: '#E5E7EB', padding: 4, borderRadius: 12
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
                    <MarkdownRenderer content={lecon.contenu}/>
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

                <button onClick={() => navigate(`/session/${uaId}`)} style={{
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
            {tab === 'exercices' && (
              <div style={{ animation: 'fadeUp .3s ease' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 18 }}>
                  {ua.exercices?.map((ex, i) => (
                    <div key={ex.id} style={{
                      backgroundColor: C.surface, borderRadius: 12,
                      padding: isMobile ? '13px 14px' : '15px 18px',
                      boxShadow: '0 2px 8px rgba(107,58,42,0.07)',
                      border: `1px solid ${C.brownPale}`,
                      display: 'flex', alignItems: isMobile ? 'flex-start' : 'center',
                      gap: 12, flexWrap: isMobile ? 'wrap' : 'nowrap'
                    }}>
                      {/* Numéro */}
                      <div style={{
                        width: 34, height: 34, borderRadius: 9,
                        background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                        color: 'white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 13, fontWeight: 900, flexShrink: 0
                      }}>
                        {i + 1}
                      </div>

                      {/* Infos */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: isMobile ? 'normal' : 'nowrap' }}>
                          {ex.titre}
                        </p>
                        <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>
                          {ex.competence_evaluee}
                        </p>
                      </div>

                      {/* Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: isMobile ? 'auto' : 0 }}>
                        <span style={{ backgroundColor: diffBg[ex.difficulte], color: diffColor[ex.difficulte], padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {diffLabel[ex.difficulte]}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.brownLight, whiteSpace: 'nowrap' }}>
                          {ex.points} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => navigate(`/session/${uaId}`)} style={{
                  width: '100%', padding: '15px',
                  background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                  color: 'white', border: 'none', borderRadius: 14,
                  fontSize: isMobile ? 14 : 15, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: `0 4px 20px ${C.brown}40`, minHeight: 52
                }}>
                  <Play size={15} fill="white"/> Démarrer la session <ChevronRight size={15}/>
                </button>
              </div>
            )}
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