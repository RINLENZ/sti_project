import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Clock, BookOpen, ChevronRight, CheckCircle,
  Target, ArrowLeft, Play, Lock, Star
} from 'lucide-react'

const C = {
  brown:       '#6B3A2A', brownLight:  '#C4865A',
  emerald:     '#0D9373', bg:          '#FAF7F4',
  surface:     '#FFFFFF', text:        '#1A1207',
  textSec:     '#6B5744', brownPale:   '#F5EDE5',
  emeraldPale: '#E6F5F0', red:         '#DC2626',
  orange:      '#F59E0B', gold:        '#D4A853',
}

const ProgressBar = ({ value, color = C.emerald, h = 6 }) => (
  <div style={{ height: h, backgroundColor: '#E5E7EB', borderRadius: h, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${Math.min(100, value)}%`, backgroundColor: color, borderRadius: h, transition: 'width .6s ease' }}/>
  </div>
)

// ── Rendu Markdown simplifié ──────────────────────────────────────
function MarkdownRenderer({ content }) {
  if (!content) return null
  const lines = content.split('\n')
  const elements = []
  let inCode = false
  let codeLines = []
  let key = 0

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        elements.push(
          <div key={key++} style={{
            background: '#1A1207', borderRadius: 10, padding: '16px 20px',
            marginBottom: 16, overflowX: 'auto',
            border: `1px solid ${C.brownPale}`
          }}>
            <pre style={{ margin: 0, fontSize: 13, color: '#E5E7EB', lineHeight: 1.7, fontFamily: 'monospace' }}>
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
        <h2 key={key++} style={{ fontSize: 18, fontWeight: 800, color: C.brown, margin: '24px 0 10px', paddingBottom: 8, borderBottom: `2px solid ${C.brownPale}` }}>
          {line.replace('## ', '')}
        </h2>
      )
    } else if (line.startsWith('### ')) {
      elements.push(
        <h3 key={key++} style={{ fontSize: 15, fontWeight: 700, color: C.text, margin: '18px 0 8px' }}>
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
      // Tableau Markdown
      const cells = line.split('|').filter(c => c.trim() && !c.match(/^[-\s]+$/))
      if (cells.length > 0 && !line.match(/^\|[-\s|]+\|$/)) {
        elements.push(
          <div key={key++} style={{ display: 'flex', gap: 0, marginBottom: 2 }}>
            {cells.map((cell, i) => (
              <div key={i} style={{
                flex: 1, padding: '8px 12px', fontSize: 13,
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

export default function CoursDetail() {
  const { uaId }  = useParams()
  const navigate  = useNavigate()
  const [ua, setUA]         = useState(null)
  const [tab, setTab]       = useState('lecon')
  const [loading, setLoading] = useState(true)
  const [ressourceIdx, setRessourceIdx] = useState(0)

  useEffect(() => {
    api.get(`/api/cours/ua/${uaId}`)
      .then(({ data }) => setUA(data))
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [uaId])

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: C.bg }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${C.brownPale}`, borderTopColor: C.brown, margin: '0 auto 12px', animation: 'spin 1s linear infinite' }}/>
        <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>Chargement du cours…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!ua) return null

  const lecons    = ua.ressources?.filter(r => r.type === 'lecon') || []
  const lecon     = lecons[ressourceIdx]
  const diffLabel = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' }
  const diffColor = { 1: C.emerald, 2: C.orange, 3: C.red }
  const diffBg    = { 1: C.emeraldPale, 2: '#FEF3C7', 3: '#FEE2E2' }

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* ── Hero header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brown} 0%, ${C.brownLight} 100%)`,
        padding: '28px 32px', color: 'white',
        position: 'relative', overflow: 'hidden'
      }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }}>
          <defs>
            <pattern id="adinkra-cours" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="30" cy="30" r="6" fill="none" stroke="white" strokeWidth="1.5"/>
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
            color: 'white', borderRadius: 8, padding: '6px 14px',
            cursor: 'pointer', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20
          }}>
            <ArrowLeft size={14}/> Retour au tableau de bord
          </button>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 20 }}>
            <div style={{ flex: 1 }}>
              <span style={{ background: 'rgba(255,255,255,.2)', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-block', marginBottom: 10 }}>
                {ua.reference_ue}
              </span>
              <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10, lineHeight: 1.2 }}>
                {ua.titre}
              </h1>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: .85 }}>
                  <Clock size={13}/> {ua.duree_estimee} min
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: .85 }}>
                  <BookOpen size={13}/> {ua.exercices?.length} exercices
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, opacity: .85 }}>
                  <Target size={13}/> {ua.competences?.length} compétences
                </span>
              </div>
            </div>

            {/* Bouton CTA */}
            <button onClick={() => navigate(`/session/${uaId}`)} style={{
              background: 'white', border: 'none', borderRadius: 14,
              padding: '14px 28px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 10,
              fontSize: 15, fontWeight: 800, color: C.brown,
              boxShadow: '0 4px 20px rgba(0,0,0,.2)',
              transition: 'all .2s ease'
            }}>
              <Play size={16} fill={C.brown}/> Commencer les exercices
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 24px' }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>

          {/* ── Colonne principale ── */}
          <div style={{ flex: 1, minWidth: 300 }}>

            {/* Situation problème */}
            {ua.situation_probleme && (
              <div style={{
                background: `linear-gradient(135deg, ${C.brownPale}, ${C.emeraldPale})`,
                borderRadius: 16, padding: '20px 24px',
                marginBottom: 24, border: `1px solid ${C.brownLight}30`,
                animation: 'fadeIn .4s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Star size={16} color={C.gold} fill={C.gold}/>
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
              display: 'flex', gap: 4, marginBottom: 24,
              background: '#E5E7EB', padding: 4, borderRadius: 12
            }}>
              {[
                { key: 'lecon',     label: '📖 Leçon' },
                { key: 'exercices', label: '✏️ Exercices' },
              ].map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  flex: 1, padding: '10px 16px', border: 'none', borderRadius: 9,
                  cursor: 'pointer', fontSize: 14, fontWeight: tab === t.key ? 800 : 500,
                  background: tab === t.key ? C.surface : 'transparent',
                  color: tab === t.key ? C.brown : C.textSec,
                  boxShadow: tab === t.key ? '0 2px 8px rgba(107,58,42,0.12)' : 'none',
                  transition: 'all .2s'
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── Contenu leçon ── */}
            {tab === 'lecon' && (
              <div style={{ animation: 'fadeIn .3s ease' }}>
                {/* Sélecteur de ressource si plusieurs leçons */}
                {lecons.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                    {lecons.map((l, i) => (
                      <button key={l.id} onClick={() => setRessourceIdx(i)} style={{
                        padding: '6px 14px', borderRadius: 20, border: 'none',
                        background: ressourceIdx === i ? C.brown : C.brownPale,
                        color: ressourceIdx === i ? 'white' : C.brown,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer'
                      }}>
                        {l.titre}
                      </button>
                    ))}
                  </div>
                )}

                {lecon ? (
                  <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '28px 32px', boxShadow: '0 2px 12px rgba(107,58,42,0.08)', border: `1px solid ${C.brownPale}`, marginBottom: 16 }}>
                    <h2 style={{ fontSize: 17, fontWeight: 800, color: C.brown, marginBottom: 20, paddingBottom: 12, borderBottom: `2px solid ${C.brownPale}` }}>
                      {lecon.titre}
                    </h2>
                    <MarkdownRenderer content={lecon.contenu}/>
                  </div>
                ) : (
                  <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: 32, textAlign: 'center', border: `1px solid ${C.brownPale}` }}>
                    <p style={{ color: C.textSec, fontSize: 14 }}>Aucune leçon disponible pour cette UA.</p>
                  </div>
                )}

                {/* Points clés */}
                {lecon?.points_cles?.length > 0 && (
                  <div style={{ backgroundColor: C.emeraldPale, borderRadius: 16, padding: '20px 24px', border: `1px solid ${C.emerald}30`, marginBottom: 24 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      <CheckCircle size={16} color={C.emerald}/>
                      <p style={{ fontSize: 12, fontWeight: 800, color: C.emerald, textTransform: 'uppercase', letterSpacing: .8, margin: 0 }}>
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

                {/* CTA commencer */}
                <button onClick={() => navigate(`/session/${uaId}`)} style={{
                  width: '100%', padding: '16px',
                  background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                  color: 'white', border: 'none', borderRadius: 14,
                  fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: `0 4px 20px ${C.brown}40`
                }}>
                  <Play size={16} fill="white"/> Commencer les exercices <ChevronRight size={16}/>
                </button>
              </div>
            )}

            {/* ── Liste exercices ── */}
            {tab === 'exercices' && (
              <div style={{ animation: 'fadeIn .3s ease' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                  {ua.exercices?.map((ex, i) => (
                    <div key={ex.id} style={{
                      backgroundColor: C.surface, borderRadius: 14, padding: '16px 20px',
                      boxShadow: '0 2px 8px rgba(107,58,42,0.07)',
                      border: `1px solid ${C.brownPale}`,
                      display: 'flex', alignItems: 'center', gap: 14
                    }}>
                      {/* Numéro */}
                      <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                        color: 'white', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: 14, fontWeight: 900, flexShrink: 0
                      }}>
                        {i + 1}
                      </div>

                      {/* Infos */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {ex.titre}
                        </p>
                        <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>
                          {ex.competence_evaluee}
                        </p>
                      </div>

                      {/* Badges */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ backgroundColor: diffBg[ex.difficulte], color: diffColor[ex.difficulte], padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                          {diffLabel[ex.difficulte]}
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.brownLight }}>
                          {ex.points} pts
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button onClick={() => navigate(`/session/${uaId}`)} style={{
                  width: '100%', padding: '16px',
                  background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                  color: 'white', border: 'none', borderRadius: 14,
                  fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  boxShadow: `0 4px 20px ${C.brown}40`
                }}>
                  <Play size={16} fill="white"/> Démarrer la session <ChevronRight size={16}/>
                </button>
              </div>
            )}
          </div>

          {/* ── Sidebar droite ── */}
          <div style={{ width: 260, flexShrink: 0 }}>

            {/* Compétences visées */}
            <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '20px', marginBottom: 16, boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1px solid ${C.brownPale}` }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: C.brown, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14 }}>
                Compétences visées
              </p>
              {ua.competences?.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <p style={{ fontSize: 12, lineHeight: 1.5, color: C.text, margin: 0 }}>{c}</p>
                </div>
              ))}
            </div>

            {/* Prérequis */}
            {ua.prerequis?.length > 0 && (
              <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '20px', marginBottom: 16, boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1px solid ${C.brownPale}` }}>
                <p style={{ fontSize: 12, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 14 }}>
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
            <div style={{ background: `linear-gradient(135deg, ${C.brownPale}, ${C.emeraldPale})`, borderRadius: 16, padding: '20px', border: `1px solid ${C.brownLight}30` }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: C.brown, marginBottom: 14 }}>
                Résumé de l'unité
              </p>
              {[
                { icon: <Clock size={14}/>,    label: 'Durée',      value: `${ua.duree_estimee} min` },
                { icon: <BookOpen size={14}/>,  label: 'Exercices',  value: ua.exercices?.length || 0 },
                { icon: <Target size={14}/>,    label: 'Compétences',value: ua.competences?.length || 0 },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.brownLight}20` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.textSec, fontSize: 12 }}>
                    {s.icon} {s.label}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.brown }}>{s.value}</span>
                </div>
              ))}

              <button onClick={() => navigate(`/session/${uaId}`)} style={{
                width: '100%', marginTop: 16, padding: '12px',
                background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                color: 'white', border: 'none', borderRadius: 10,
                fontSize: 13, fontWeight: 800, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
              }}>
                <Play size={14} fill="white"/> Commencer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}