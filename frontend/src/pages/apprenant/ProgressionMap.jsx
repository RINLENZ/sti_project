/**
 * Mon Parcours — Carte de progression BKT.
 * Accessible via /parcours (route dédiée) et depuis le Dashboard.
 */
import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { ArrowLeft, ChevronRight, BookOpen, ClipboardList,
         CheckCircle2, FileText, Clock, Award, ShieldAlert } from 'lucide-react'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Spinner } from '../../components/Skeleton'
import { getCache, setCache } from '../../services/cache'
import api from '../../services/api'
import { useOnlineRetry } from '../../hooks/useOnlineRetry'

// ── Niveau BKT → couleur + label (via thème — dark mode compatible) ──────────
function bktLevel(score, C) {
  if (score == null || score === 0)
    return { color: C.textMuted, bg: C.bg,         label: 'Non commencé', pct: 0 }
  if (score < 0.25)
    return { color: C.red,       bg: C.redPale,     label: 'À démarrer',   pct: Math.round(score * 100) }
  if (score < 0.55)
    return { color: C.orange,    bg: C.goldPale,    label: 'En cours',     pct: Math.round(score * 100) }
  if (score < 0.80)
    return { color: C.gold,      bg: C.goldPale,    label: 'Bien engagé',  pct: Math.round(score * 100) }
  return   { color: C.emerald,   bg: C.emeraldPale, label: 'Maîtrisé',     pct: Math.round(score * 100) }
}

// ── Anneau de maîtrise BKT SVG ────────────────────────────────────────────────
function MasteryRing({ score, size = 52, C }) {
  const { color, pct } = bktLevel(score, C)
  const r    = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={5}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
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

// ── Carte UA ──────────────────────────────────────────────────────────────────
function UACard({ ua, navigate, C, xs }) {
  const { color, bg, label } = bktLevel(ua.bkt_score, C)
  const isLocked = ua.is_locked
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={() => !isLocked && navigate(`/cours/${ua.id}`)}
      disabled={isLocked}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:          12,
        background:   isLocked ? C.bg : hovered ? C.surface : C.surface,
        borderRadius: 14,
        border:       `1.5px solid ${isLocked ? C.border : hovered ? color + '66' : color + '33'}`,
        padding:     '12px 14px',
        textAlign:   'left',
        cursor:       isLocked ? 'not-allowed' : 'pointer',
        opacity:      isLocked ? 0.5 : 1,
        transform:    hovered && !isLocked ? 'translateY(-2px)' : 'none',
        boxShadow:    hovered && !isLocked
          ? `0 6px 18px ${color}28`
          : `0 2px 8px ${color}14`,
        transition:  'all .18s ease',
        width:       '100%',
      }}
    >
      <MasteryRing score={ua.bkt_score} size={xs ? 44 : 52} C={C}/>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: xs ? 13 : 14, fontWeight: 700, color: C.text,
          margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
              {ua.nb_exercices} exo{ua.nb_exercices > 1 ? 's' : ''}
            </span>
          )}
          {ua.duree_estimee > 0 && (
            <span style={{ fontSize: 11, color: C.textMuted }}>⏱ {ua.duree_estimee} min</span>
          )}
        </div>
      </div>

      {!isLocked && (
        <ChevronRight size={16} color={C.textMuted} style={{ flexShrink: 0 }}/>
      )}
    </button>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE PRINCIPALE
// ══════════════════════════════════════════════════════════════════════════════
export default function ProgressionMap() {
  const navigate = useNavigate()
  const { C }    = useTheme()
  const { xs }   = useBreakpoint()
  const { user } = useSelector(s => s.auth)

  const [programme,   setProgramme]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filtre,      setFiltre]      = useState('all')
  const [recommandee, setRecommandee] = useState(null)
  const [activeTab,   setActiveTab]   = useState('cours')  // 'cours' | 'epreuves'
  const [epreuves,    setEpreuves]    = useState([])
  const retryKey = useOnlineRetry()

  // ── Chargement avec cache ─────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const cacheKey = `progression_map_${user.niveau_id}_${user.id}`
    const hit = getCache(cacheKey)
    if (hit) {
      setProgramme(hit.programme)
      setRecommandee(hit.recommandee)
      setEpreuves(hit.epreuves || [])
      setLoading(false)
    }

    async function load() {
      try {
        const [progRes] = await Promise.all([
          user.niveau_id
            ? api.get(`/api/cours/programme/${user.niveau_id}?user_id=${user.id}`)
            : Promise.resolve({ data: [] }),
        ])
        const prog = progRes.data || []
        setProgramme(prog)

        let reco = null, ep = []
        try { const { data: r } = await api.get(`/api/cours/ua/recommandee/${user.id}`); reco = r?.recommandee || null } catch {}
        try { const { data: e } = await api.get('/api/examens/disponibles'); ep = e } catch {}
        setRecommandee(reco)
        setEpreuves(ep)

        setCache(cacheKey, { programme: prog, recommandee: reco, epreuves: ep }, 2 * 60 * 1000)
      } catch {}
      finally { setLoading(false) }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.niveau_id, retryKey])

  // ── Stats + filtrage ──────────────────────────────────────────────
  const allUAs = useMemo(() =>
    programme.flatMap(m => m.modules.flatMap(mod => mod.familles.flatMap(f => f.unites)))
  , [programme])

  const stats = useMemo(() => ({
    total:    allUAs.length,
    done:     allUAs.filter(u => (u.bkt_score ?? 0) >= 0.80).length,
    progress: allUAs.filter(u => (u.bkt_score ?? 0) >= 0.25 && (u.bkt_score ?? 0) < 0.80).length,
    todo:     allUAs.filter(u => (u.bkt_score ?? 0) < 0.25).length,
  }), [allUAs])

  const globalPct = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0
  const epBadge   = epreuves.filter(e => !e.soumis).length

  function matchFiltre(ua) {
    if (filtre === 'done')     return (ua.bkt_score ?? 0) >= 0.80
    if (filtre === 'progress') return (ua.bkt_score ?? 0) >= 0.25 && (ua.bkt_score ?? 0) < 0.80
    if (filtre === 'todo')     return (ua.bkt_score ?? 0) < 0.25
    return true
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg, flexDirection: 'column', gap: 12 }}>
      <Spinner size={40}/>
      <p style={{ color: C.textSec, fontSize: 13, fontWeight: 600, margin: 0 }}>Chargement de ton parcours…</p>
    </div>
  )

  const pad = xs ? 12 : 16

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif", padding: `${pad}px`, boxSizing: 'border-box' }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* ══ HEADER GRADIENT — style Dashboard (arrondi, ne touche pas les bords) ══ */}
      <div style={{
        background:    `linear-gradient(140deg, ${C.brownDark} 0%, ${C.brown} 55%, ${C.brownLight} 100%)`,
        borderRadius:   xs ? 16 : 20,
        padding:        xs ? '18px 16px 20px' : '24px 28px 26px',
        marginBottom:   xs ? 12 : 16,
        color:          'white',
        position:       'relative', overflow: 'hidden',
        animation:      'fadeUp .4s ease',
      }}>
        {/* Motif de points */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .05, pointerEvents: 'none' }}>
          <defs><pattern id="pm-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="14" cy="14" r="1.2" fill="white"/>
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#pm-dots)"/>
        </svg>

        <div style={{ position: 'relative' }}>
          {/* Bouton retour */}
          <button onClick={() => navigate(-1)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.22)',
            color: 'white', borderRadius: 9, padding: '5px 12px',
            cursor: 'pointer', fontSize: 12, fontWeight: 700, marginBottom: 16,
          }}>
            <ArrowLeft size={13}/> Retour
          </button>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: xs ? 20 : 24, fontWeight: 900, margin: '0 0 4px' }}>
                Mon Parcours
              </h1>
              <p style={{ fontSize: 13, opacity: .8, margin: '0 0 16px' }}>
                {stats.done} unité{stats.done !== 1 ? 's' : ''} maîtrisée{stats.done !== 1 ? 's' : ''} sur {stats.total}
                {user?.niveau_label && ` · ${user.niveau_label}`}
              </p>

              {/* Barre progression globale */}
              <div style={{ maxWidth: 420, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 11, opacity: .8, fontWeight: 600 }}>Progression globale</span>
                  <span style={{ fontSize: 12, fontWeight: 900 }}>{globalPct}%</span>
                </div>
                <div style={{ height: 9, background: 'rgba(255,255,255,.22)', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${globalPct}%`,
                    background: globalPct === 100 ? C.gold : 'rgba(255,255,255,.9)',
                    borderRadius: 10, transition: 'width .9s ease',
                  }}/>
                </div>
              </div>

              {/* Chips stats */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { label: `${stats.done} maîtrisées`,   color: C.emerald },
                  { label: `${stats.progress} en cours`, color: C.orange  },
                  { label: `${stats.todo} à démarrer`,   color: C.textMuted },
                ].map(c => (
                  <span key={c.label} style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 11px', borderRadius: 20,
                    background: 'rgba(255,255,255,.13)', border: `1.5px solid ${c.color}99`,
                    color: 'white',
                  }}>
                    <span style={{ color: c.color }}>●</span> {c.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Anneau global */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {(() => {
                const R = 28; const CIRC = 2 * Math.PI * R
                const dashOffset = CIRC * (1 - globalPct / 100)
                return (
                  <>
                    <svg width={76} height={76} style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx={38} cy={38} r={R} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={5}/>
                      <circle cx={38} cy={38} r={R} fill="none"
                        stroke={globalPct === 100 ? C.gold : 'rgba(255,255,255,.92)'}
                        strokeWidth={5} strokeLinecap="round"
                        strokeDasharray={CIRC} strokeDashoffset={dashOffset}
                        style={{ transition: 'stroke-dashoffset 1s ease' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: 'white', lineHeight: 1 }}>
                        {globalPct}<span style={{ fontSize: 9 }}>%</span>
                      </span>
                    </div>
                  </>
                )
              })()}
            </div>
          </div>

          {/* Bandeau UA recommandée */}
          {recommandee && (
            <div style={{
              marginTop: 16, background: 'rgba(255,255,255,.13)',
              border: '1.5px solid rgba(255,255,255,.3)', borderRadius: 13,
              padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: 480,
            }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🎯</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 10, opacity: .75, margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 }}>
                  Reprends là où tu t'es arrêté
                </p>
                <p style={{ fontSize: 13, fontWeight: 800, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {recommandee.titre}
                </p>
              </div>
              <button onClick={() => navigate(`/tutoriel/${recommandee.id ?? recommandee.ua_id}`)}
                style={{
                  background: 'white', border: 'none', borderRadius: 10,
                  color: C.brownDark, fontSize: 11, fontWeight: 800,
                  padding: '7px 12px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                Démarrer avec Alisha →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ NAVIGATION STICKY (onglets + filtres) ══ */}
      {/* Marge négative pour sortir du padding parent et coller aux bords de l'écran */}
      <div style={{
        background:   C.surface,
        borderBottom: `1px solid ${C.border}`,
        position:     'sticky', top: 0, zIndex: 20,
        margin:       `0 -${pad}px`,
        padding:      `0 ${pad}px`,
      }}>
        {/* Onglets Cours / Épreuves */}
        <div style={{ display: 'flex', gap: 2, padding: '0 18px' }}>
          {[
            { id: 'cours',    label: 'Cours',    Icon: BookOpen                           },
            { id: 'epreuves', label: 'Épreuves', Icon: ClipboardList, badge: epBadge > 0 ? epBadge : null },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '11px 14px', fontSize: 12,
              fontWeight: activeTab === tab.id ? 800 : 600,
              color: activeTab === tab.id ? C.brown : C.textSec,
              borderBottom: `2.5px solid ${activeTab === tab.id ? C.brown : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: 5, transition: 'all .15s',
            }}>
              <tab.Icon size={13}/>
              {tab.label}
              {tab.badge && (
                <span style={{ background: C.red, color: 'white', borderRadius: 10, padding: '1px 5px', fontSize: 9, fontWeight: 800 }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Chips filtres avec compteurs — uniquement onglet Cours */}
        {activeTab === 'cours' && (
          <div style={{ padding: '8px 18px 10px', display: 'flex', gap: 7, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[
              { key: 'all',      label: `Tout (${stats.total})` },
              { key: 'todo',     label: `🔴 À démarrer (${stats.todo})` },
              { key: 'progress', label: `🟠 En cours (${stats.progress})` },
              { key: 'done',     label: `🟢 Maîtrisées (${stats.done})` },
            ].map(f => (
              <button key={f.key} onClick={() => setFiltre(f.key)} style={{
                padding: '5px 13px', borderRadius: 20, border: 'none', flexShrink: 0,
                background: filtre === f.key ? C.brown : C.bg,
                color:      filtre === f.key ? 'white' : C.textSec,
                fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
              }}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ══ ONGLET ÉPREUVES ══ */}
      {activeTab === 'epreuves' && (
        <div style={{ maxWidth: 720, margin: '0 auto', padding: '20px 16px' }}>
          {epreuves.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
              <FileText size={40} style={{ marginBottom: 12, opacity: .3 }}/>
              <p style={{ fontWeight: 700, color: C.text, margin: '0 0 6px' }}>Aucune épreuve disponible</p>
              <p style={{ fontSize: 13, margin: 0 }}>Ton enseignant n'a pas encore publié d'épreuve.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {epreuves.some(e => e.soumis) && (() => {
                const soumises = epreuves.filter(e => e.soumis && e.score_total != null)
                const moyenne  = soumises.length > 0 ? soumises.reduce((a, e) => a + e.score_total, 0) / soumises.length : null
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 6 }}>
                    {[
                      { label: 'Passées',  value: soumises.length,      color: C.emerald, Icon: CheckCircle2 },
                      { label: 'À passer', value: epreuves.filter(e => !e.soumis).length, color: C.brown,   Icon: Clock },
                      { label: 'Moyenne',  value: moyenne != null ? `${moyenne.toFixed(1)}/20` : '—', color: C.blue, Icon: Award },
                    ].map(s => (
                      <div key={s.label} style={{ background: C.surface, borderRadius: 12, padding: '12px 14px', border: `1px solid ${C.border}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                          <s.Icon size={11} color={s.color}/>
                          <span style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: .5 }}>{s.label}</span>
                        </div>
                        <p style={{ fontSize: 20, fontWeight: 900, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                      </div>
                    ))}
                  </div>
                )
              })()}
              {epreuves.map(ep => (
                <div key={ep.id} onClick={() => navigate(`/epreuve/${ep.id}`)}
                  style={{ background: C.surface, borderRadius: 14, padding: '14px 18px', border: `1.5px solid ${ep.soumis ? `${C.emerald}35` : C.border}`, cursor: 'pointer', transition: 'all .15s' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 18px ${C.brown}15` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: ep.soumis ? `${C.emerald}18` : `${C.brown}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {ep.soumis ? <CheckCircle2 size={19} color={C.emerald}/> : <FileText size={19} color={C.brown}/>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.titre}</p>
                        {ep.soumis && ep.nb_incidents > 0 && <ShieldAlert size={12} color={C.red} style={{ flexShrink: 0 }}/>}
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: C.textSec }}>{ep.classe_label || ep.type_epreuve}</span>
                        <span style={{ fontSize: 10, color: C.textSec }}>⏱ {ep.duree_minutes} min</span>
                        {ep.soumis && ep.score_total != null && (
                          <span style={{ fontSize: 11, fontWeight: 800, color: ep.score_total >= 10 ? C.emerald : C.red }}>{ep.score_total.toFixed(1)}/20</span>
                        )}
                      </div>
                    </div>
                    {ep.soumis && ep.score_total != null ? (
                      <div style={{ width: 40, height: 40, borderRadius: '50%', border: `2.5px solid ${ep.score_total >= 10 ? C.emerald : C.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: ep.score_total >= 10 ? C.emerald : C.red }}>{ep.score_total.toFixed(0)}</span>
                      </div>
                    ) : (
                      <ChevronRight size={15} color={C.brown} style={{ flexShrink: 0 }}/>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ ONGLET COURS ══ */}
      {activeTab === 'cours' && (
        <div style={{ maxWidth: 860, margin: '0 auto', padding: xs ? '16px' : '24px 32px' }}>
          {programme.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textSec }}>
              <p style={{ fontSize: 40 }}>📭</p>
              <p style={{ fontSize: 15, fontWeight: 600 }}>
                {user?.niveau_id ? 'Aucun programme trouvé pour ton niveau.' : 'Niveau non configuré — contacte ton enseignant.'}
              </p>
            </div>
          ) : (
            programme.map(matiere => {
              const uasMatiere = matiere.modules
                .flatMap(m => m.familles.flatMap(f => f.unites))
                .filter(matchFiltre)
              if (!uasMatiere.length) return null

              return (
                <div key={matiere.id} style={{ marginBottom: 36 }}>
                  {/* En-tête matière */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <div style={{
                      background: `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
                      color: 'white', borderRadius: 10, padding: '6px 16px',
                      fontSize: 13, fontWeight: 900, letterSpacing: .3,
                    }}>
                      {matiere.nom}
                    </div>
                    <div style={{ flex: 1, height: 2, background: C.brownPale, borderRadius: 2 }}/>
                    <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, flexShrink: 0 }}>
                      {uasMatiere.length} unité{uasMatiere.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {matiere.modules.map(mod => {
                    const uasMod = mod.familles.flatMap(f => f.unites).filter(matchFiltre)
                    if (!uasMod.length) return null

                    return (
                      <div key={mod.id} style={{ marginBottom: 22 }}>
                        {/* En-tête module */}
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          margin: '0 0 10px 2px',
                        }}>
                          {mod.numero && (
                            <span style={{
                              fontSize: 10, fontWeight: 900, color: 'white',
                              background: C.brown, borderRadius: '50%',
                              width: 20, height: 20, display: 'inline-flex',
                              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                            }}>
                              {mod.numero}
                            </span>
                          )}
                          <p style={{
                            fontSize: 11, fontWeight: 800, color: C.textMuted,
                            textTransform: 'uppercase', letterSpacing: '.06em', margin: 0,
                          }}>
                            {mod.titre}
                          </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {mod.familles.map(fam => {
                            const uasFam = fam.unites.filter(matchFiltre)
                            if (!uasFam.length) return null
                            return (
                              <div key={fam.id}>
                                {fam.titre && (
                                  <p style={{
                                    fontSize: 11, color: C.brownMid, fontWeight: 700,
                                    margin: '0 0 6px 4px',
                                  }}>
                                    {fam.titre}
                                  </p>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                                  {uasFam.map(ua => (
                                    <UACard key={ua.id} ua={ua} navigate={navigate} C={C} xs={xs}/>
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

          {/* Trophée si tout maîtrisé */}
          {globalPct === 100 && stats.total > 0 && filtre === 'all' && (
            <div style={{
              textAlign: 'center', padding: '30px 20px', marginTop: 8,
              background: `linear-gradient(135deg, ${C.gold}15, ${C.brownPale})`,
              borderRadius: 20, border: `1.5px solid ${C.gold}45`,
            }}>
              <p style={{ fontSize: 48, margin: 0 }}>🏆</p>
              <p style={{ fontSize: 18, fontWeight: 900, color: C.brown, margin: '10px 0 4px' }}>Parcours terminé !</p>
              <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>Tu as maîtrisé toutes les unités d'apprentissage.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
