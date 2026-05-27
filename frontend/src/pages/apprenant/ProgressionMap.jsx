/**
 * Carte de progression BKT de l'apprenant.
 * Affiche toutes les UAs du programme colorées par niveau de maîtrise.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Spinner } from '../../components/Skeleton'
import api from '../../services/api'

// ── Niveau BKT → couleur + label ─────────────────────────────────

function bktLevel(score) {
  if (score == null)  return { color: '#9CA3AF', bg: '#F3F4F6', label: 'Non commencé', pct: 0 }
  if (score < 0.25)   return { color: '#EF4444', bg: '#FEE2E2', label: 'À démarrer',   pct: Math.round(score * 100) }
  if (score < 0.55)   return { color: '#F97316', bg: '#FFF7ED', label: 'En cours',     pct: Math.round(score * 100) }
  if (score < 0.80)   return { color: '#EAB308', bg: '#FEFCE8', label: 'Bien engagé',  pct: Math.round(score * 100) }
  return               { color: '#22C55E', bg: '#ECFDF5', label: 'Maîtrisé',     pct: Math.round(score * 100) }
}

// ── Anneau de progression SVG ─────────────────────────────────────

function MasteryRing({ score, size = 52 }) {
  const { color, pct } = bktLevel(score)
  const r   = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r}
        fill="none" stroke="#E5E7EB" strokeWidth={5}/>
      <circle cx={size/2} cy={size/2} r={r}
        fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray .7s ease' }}
      />
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size < 48 ? 10 : 12} fontWeight={800}>
        {pct}%
      </text>
    </svg>
  )
}

// ── Carte UA ──────────────────────────────────────────────────────

function UACard({ ua, navigate, C, xs }) {
  const { color, bg, label } = bktLevel(ua.bkt_score)
  const isLocked = ua.is_locked

  return (
    <button
      onClick={() => !isLocked && navigate(`/cours/${ua.id}`)}
      disabled={isLocked}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:             12,
        background:      isLocked ? C.bg : C.surface,
        borderRadius:    14,
        border:         `1.5px solid ${isLocked ? C.border : color}33`,
        padding:        '12px 14px',
        textAlign:      'left',
        cursor:          isLocked ? 'not-allowed' : 'pointer',
        opacity:         isLocked ? 0.5 : 1,
        transition:     'transform .15s ease, box-shadow .15s ease',
        boxShadow:      `0 2px 8px ${color}18`,
        width:          '100%',
      }}
      onMouseEnter={e => { if (!isLocked) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 18px ${color}28` } }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 2px 8px ${color}18` }}
    >
      <MasteryRing score={ua.bkt_score} size={xs ? 44 : 52} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize:     xs ? 13 : 14,
          fontWeight:   700,
          color:        C.text,
          margin:       '0 0 3px',
          overflow:     'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:   'nowrap',
        }}>
          {ua.reference_ue && (
            <span style={{ fontSize: 10, fontWeight: 800, color, marginRight: 6,
              background: bg, padding: '1px 6px', borderRadius: 20 }}>
              {ua.reference_ue}
            </span>
          )}
          {ua.titre}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color, background: bg, padding: '2px 8px', borderRadius: 20 }}>
            {isLocked ? '🔒 Verrouillé' : label}
          </span>
          {ua.nb_exercices > 0 && (
            <span style={{ fontSize: 11, color: C.textMuted }}>
              {ua.nb_exercices} exercice{ua.nb_exercices > 1 ? 's' : ''}
            </span>
          )}
          {ua.duree_estimee && (
            <span style={{ fontSize: 11, color: C.textMuted }}>⏱ {ua.duree_estimee} min</span>
          )}
        </div>
      </div>

      {!isLocked && (
        <span style={{ fontSize: 18, color: C.textMuted, flexShrink: 0 }}>›</span>
      )}
    </button>
  )
}

// ── Page principale ───────────────────────────────────────────────

export default function ProgressionMap() {
  const navigate  = useNavigate()
  const { C }     = useTheme()
  const { xs }    = useBreakpoint()
  const { user }  = useSelector(s => s.auth)

  const [programme,  setProgramme]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [filtre,     setFiltre]     = useState('all')  // all | todo | progress | done
  const [recommandee, setRecommandee] = useState(null)

  useEffect(() => {
    if (!user?.niveau_id) { setLoading(false); return }
    api.get(`/api/cours/programme/${user.niveau_id}?user_id=${user.id}`)
      .then(r => setProgramme(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.niveau_id, user?.id])

  useEffect(() => {
    if (!user?.id) return
    api.get(`/api/cours/ua/recommandee/${user.id}`)
      .then(r => setRecommandee(r.data?.recommandee || null))
      .catch(() => {})
  }, [user?.id])

  // Aplatit toutes les UAs pour les stats globales
  const allUAs = programme.flatMap(m =>
    m.modules.flatMap(mod =>
      mod.familles.flatMap(f => f.unites)
    )
  )

  const stats = {
    total:     allUAs.length,
    done:      allUAs.filter(u => (u.bkt_score ?? 0) >= 0.80).length,
    progress:  allUAs.filter(u => (u.bkt_score ?? 0) >= 0.25 && (u.bkt_score ?? 0) < 0.80).length,
    todo:      allUAs.filter(u => (u.bkt_score ?? 0) < 0.25).length,
  }
  const globalPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0

  function matchFiltre(ua) {
    if (filtre === 'all')      return true
    if (filtre === 'done')     return (ua.bkt_score ?? 0) >= 0.80
    if (filtre === 'progress') return (ua.bkt_score ?? 0) >= 0.25 && (ua.bkt_score ?? 0) < 0.80
    if (filtre === 'todo')     return (ua.bkt_score ?? 0) < 0.25
    return true
  }

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <Spinner size={40} />
    </div>
  )

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Header ── */}
      <div style={{
        background:  `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
        padding:     xs ? '20px 16px' : '28px 32px',
        color:       'white',
      }}>
        <button onClick={() => navigate('/dashboard')} style={{
          background: 'rgba(255,255,255,.15)', border: 'none', color: 'white',
          borderRadius: 8, padding: '6px 14px', cursor: 'pointer',
          fontSize: 13, fontWeight: 700, marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          ← Retour
        </button>

        <h1 style={{ fontSize: xs ? 20 : 24, fontWeight: 900, margin: '0 0 6px' }}>
          Ma carte de progression
        </h1>
        <p style={{ fontSize: 13, opacity: .8, margin: '0 0 20px' }}>
          {stats.done} unité{stats.done !== 1 ? 's' : ''} maîtrisée{stats.done !== 1 ? 's' : ''} sur {stats.total}
        </p>

        {/* Barre de progression globale */}
        <div style={{ maxWidth: 480 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, opacity: .8, fontWeight: 600 }}>Progression globale</span>
            <span style={{ fontSize: 13, fontWeight: 900 }}>{globalPct}%</span>
          </div>
          <div style={{ height: 10, background: 'rgba(255,255,255,.25)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${globalPct}%`,
              background: 'rgba(255,255,255,.9)',
              borderRadius: 10, transition: 'width .8s ease',
            }}/>
          </div>
        </div>

        {/* Bandeau UA recommandée */}
        {recommandee && (
          <div style={{
            marginTop: 16, background: 'rgba(255,255,255,.15)',
            border: '1.5px solid rgba(255,255,255,.35)',
            borderRadius: 12, padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 12,
            maxWidth: 480,
          }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🎯</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, opacity: .75, margin: '0 0 2px', fontWeight: 600 }}>Reprends là où tu t'es arrêté</p>
              <p style={{ fontSize: 13, fontWeight: 800, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {recommandee.titre}
              </p>
            </div>
            <button
              onClick={() => navigate(`/tutoriel/${recommandee.id}`)}
              style={{
                background: 'white', border: 'none', borderRadius: 10,
                color: '#6B3A2A', fontSize: 11, fontWeight: 800,
                padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
              }}
            >
              Démarrer avec Alisha →
            </button>
          </div>
        )}

        {/* Chips stats */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          {[
            { label: `${stats.done} maîtrisées`,  color: '#22C55E' },
            { label: `${stats.progress} en cours`, color: '#F97316' },
            { label: `${stats.todo} à démarrer`,  color: '#9CA3AF' },
          ].map(c => (
            <span key={c.label} style={{
              fontSize: 12, fontWeight: 700, padding: '4px 12px',
              borderRadius: 20, background: 'rgba(255,255,255,.15)',
              border: `1.5px solid ${c.color}88`, color: 'white',
            }}>
              <span style={{ color: c.color }}>●</span> {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Filtres ── */}
      <div style={{ padding: xs ? '12px 16px' : '14px 32px', background: C.surface, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 8, maxWidth: 800, margin: '0 auto', flexWrap: 'wrap' }}>
          {[
            { key: 'all',      label: 'Tout voir' },
            { key: 'todo',     label: '🔴 À démarrer' },
            { key: 'progress', label: '🟠 En cours' },
            { key: 'done',     label: '🟢 Maîtrisées' },
          ].map(f => (
            <button key={f.key} onClick={() => setFiltre(f.key)} style={{
              padding: '7px 14px', borderRadius: 20, border: 'none',
              background: filtre === f.key ? C.brown : C.bg,
              color:      filtre === f.key ? 'white' : C.textSec,
              fontSize:   12, fontWeight: 700, cursor: 'pointer',
              transition: 'all .15s',
            }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contenu ── */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: xs ? '16px' : '24px 32px' }}>
        {programme.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textSec }}>
            <p style={{ fontSize: 40 }}>📭</p>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Aucun programme trouvé pour ton niveau.</p>
          </div>
        ) : (
          programme.map(matiere => {
            const uasMatiere = matiere.modules.flatMap(m => m.familles.flatMap(f => f.unites)).filter(matchFiltre)
            if (!uasMatiere.length) return null

            return (
              <div key={matiere.id} style={{ marginBottom: 36 }}>
                {/* Matière */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{
                    background: `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
                    color: 'white', borderRadius: 10, padding: '6px 14px',
                    fontSize: 13, fontWeight: 900,
                  }}>
                    {matiere.nom}
                  </div>
                  <div style={{ flex: 1, height: 2, background: C.brownPale, borderRadius: 2 }}/>
                </div>

                {matiere.modules.map(mod => {
                  const uasMod = mod.familles.flatMap(f => f.unites).filter(matchFiltre)
                  if (!uasMod.length) return null

                  return (
                    <div key={mod.id} style={{ marginBottom: 20 }}>
                      {/* Module */}
                      <p style={{
                        fontSize: 12, fontWeight: 800, color: C.textMuted,
                        textTransform: 'uppercase', letterSpacing: '.05em',
                        margin: '0 0 10px', paddingLeft: 4,
                      }}>
                        {mod.titre}
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {mod.familles.map(fam => {
                          const uasFam = fam.unites.filter(matchFiltre)
                          if (!uasFam.length) return null

                          return (
                            <div key={fam.id}>
                              {fam.titre && (
                                <p style={{
                                  fontSize: 11, color: C.brownMid, fontWeight: 700,
                                  margin: '0 0 6px', paddingLeft: 4,
                                }}>
                                  {fam.titre}
                                </p>
                              )}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {uasFam.map(ua => (
                                  <UACard key={ua.id} ua={ua} navigate={navigate} C={C} xs={xs} />
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
