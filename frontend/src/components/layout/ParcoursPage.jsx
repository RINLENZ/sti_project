import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import api from '../../services/api'
import {
  Map, BookOpen, ChevronLeft, CheckCircle2,
  ChevronDown, BookMarked, Layers, Star,
  ClipboardList, FileText, Award, ShieldAlert, Clock,
} from 'lucide-react'
import { C, useTheme } from '../../styles/theme.jsx'
import { Spinner } from '../Skeleton'

// ── Helpers ─────────────────────────────────────────────────────

function uaStatus(ua, progression) {
  if (ua.statut === 'done') return 'done'
  if (ua.is_locked) return 'locked'
  const details = progression?.details || []
  const done = details.filter(d => d.ua_id === ua.id && d.correct).length
  const pct  = ua.nb_exercices > 0 ? Math.round(done / ua.nb_exercices * 100) : 0
  if (pct === 100) return 'done'
  if (pct > 0)     return 'inprogress'
  return 'todo'
}

function uaStars(ua, progression) {
  const details = progression?.details || []
  const done = details.filter(d => d.ua_id === ua.id && d.correct).length
  const pct  = ua.nb_exercices > 0 ? Math.round(done / ua.nb_exercices * 100) : 0
  if (pct >= 90) return 3
  if (pct >= 60) return 2
  if (pct >= 30) return 1
  return 0
}

const ProgressBar = ({ value, color, h = 5 }) => {
  const { C } = useTheme()
  return (
    <div style={{ height: h, background: C.border, borderRadius: h, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, value))}%`, background: color ?? C.emerald, borderRadius: h, transition: 'width .7s ease' }}/>
    </div>
  )
}

// ── Carte UA (chemin vertical) ──────────────────────────────────
function UAPathCard({ ua, index, progression, recommandeeId, navigate, isLast }) {
  const { C } = useTheme()
  const status = uaStatus(ua, progression)
  const stars  = uaStars(ua, progression)
  const [hovered, setHovered] = useState(false)

  const isDone       = status === 'done'
  const isInProgress = status === 'inprogress'
  const isLocked     = status === 'locked'
  const canClick     = !isLocked
  const isReco       = recommandeeId === ua.id && !isDone && !isLocked

  const doneCnt      = (progression?.details || []).filter(d => d.ua_id === ua.id && d.correct).length
  const inProgPct    = ua.nb_exercices > 0 ? Math.round(doneCnt / ua.nb_exercices * 100) : 0

  const dotBg = isDone
    ? `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`
    : isInProgress
      ? `linear-gradient(135deg, ${C.gold}, ${C.orange})`
      : 'none'
  const dotBorder = isDone ? C.emerald : isInProgress ? C.gold : isLocked ? C.border : C.brownLight

  return (
    <div style={{ display: 'flex', animation: `fadeIn .3s ease ${index * 0.05}s both` }}>

      {/* ── Dot + ligne ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 34, flexShrink: 0, paddingTop: 3 }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: dotBg || C.surface,
          border: `2px solid ${dotBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800,
          color: isDone || isInProgress ? 'white' : isLocked ? C.textMuted : C.brown,
          boxShadow: isInProgress ? `0 0 0 5px ${C.gold}22` : 'none',
          transition: 'box-shadow .2s',
        }}>
          {isDone ? '✓' : isLocked ? '🔒' : isInProgress ? '▶' : index + 1}
        </div>
        {!isLast && (
          <div style={{
            width: 2, flex: 1, minHeight: 14, marginTop: 3,
            background: isDone
              ? `linear-gradient(${C.emerald}70, ${C.emerald}30)`
              : `repeating-linear-gradient(to bottom, ${C.border} 0px, ${C.border} 4px, transparent 4px, transparent 8px)`,
          }}/>
        )}
      </div>

      {/* ── Card ── */}
      <div style={{ flex: 1, marginLeft: 10, marginBottom: isLast ? 0 : 10 }}>
        <div
          onClick={() => canClick && navigate(`/cours/${ua.id}`)}
          onMouseEnter={() => canClick && setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            background: C.surface,
            border: `1.5px solid ${
              isReco ? `${C.emerald}55`
              : isInProgress ? `${C.gold}45`
              : hovered ? `${C.brownLight}55`
              : C.border
            }`,
            borderRadius: 14, padding: '12px 14px',
            cursor: canClick ? 'pointer' : 'default',
            opacity: isLocked ? 0.55 : 1,
            transform: hovered && canClick ? 'translateX(2px)' : 'none',
            boxShadow: isInProgress ? `0 2px 12px ${C.gold}18` : hovered ? `0 3px 14px ${C.brown}10` : 'none',
            transition: 'all .15s',
          }}
        >
          {/* Badges haut */}
          {(isReco || isInProgress) && (
            <div style={{ marginBottom: 6, display: 'flex', gap: 6 }}>
              {isReco && (
                <span style={{ fontSize: 9, fontWeight: 800, color: C.emerald, background: `${C.emerald}15`, padding: '2px 8px', borderRadius: 10, letterSpacing: .3 }}>
                  ⭐ Recommandé IA
                </span>
              )}
              {isInProgress && (
                <span style={{ fontSize: 9, fontWeight: 800, color: C.gold, background: `${C.gold}15`, padding: '2px 8px', borderRadius: 10 }}>
                  📖 En cours
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: isLocked ? C.textMuted : C.text, margin: '0 0 4px', lineHeight: 1.35 }}>
                {ua.titre}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {ua.reference_ue && <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>{ua.reference_ue}</span>}
                {ua.nb_exercices > 0 && <span style={{ fontSize: 10, color: C.textSec }}>📝 {ua.nb_exercices} exo{ua.nb_exercices > 1 ? 's' : ''}</span>}
                {ua.duree_estimee > 0 && <span style={{ fontSize: 10, color: C.textSec }}>⏱ {ua.duree_estimee} min</span>}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 1 }}>
                {[1,2,3].map(s => <Star key={s} size={11} fill={s <= stars ? C.gold : 'none'} color={s <= stars ? C.gold : C.border}/>)}
              </div>
              {canClick && (
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                  color: isDone ? C.brown : isInProgress ? 'white' : C.gold,
                  background: isDone ? C.brownPale : isInProgress ? `linear-gradient(135deg, ${C.gold}, ${C.orange})` : `${C.gold}18`,
                  boxShadow: isInProgress ? `0 2px 8px ${C.gold}35` : 'none',
                }}>
                  {isDone ? 'Revoir' : isInProgress ? 'Continuer →' : 'Commencer →'}
                </span>
              )}
            </div>
          </div>

          {/* Barre en cours */}
          {isInProgress && ua.nb_exercices > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: C.textSec }}>Progression</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.gold }}>{inProgPct}%</span>
              </div>
              <ProgressBar value={inProgPct} color={C.gold} h={4}/>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Famille accordéon ───────────────────────────────────────────
function FamilleSection({ famille, index, progression, recommandeeId, navigate }) {
  const { C } = useTheme()
  const [open, setOpen] = useState(index === 0)

  const doneFam  = (famille.unites || []).filter(u => uaStatus(u, progression) === 'done').length
  const totalFam = (famille.unites || []).length
  const pctFam   = totalFam > 0 ? Math.round(doneFam / totalFam * 100) : 0
  const allDone  = doneFam === totalFam && totalFam > 0
  const hasActive = (famille.unites || []).some(u => uaStatus(u, progression) === 'inprogress')

  return (
    <div style={{
      background: C.surface, borderRadius: 18, overflow: 'hidden',
      border: `1.5px solid ${allDone ? `${C.emerald}45` : hasActive ? `${C.gold}40` : C.border}`,
      boxShadow: open ? '0 4px 20px rgba(107,58,42,0.09)' : '0 1px 5px rgba(107,58,42,0.05)',
      transition: 'box-shadow .2s',
      animation: `fadeIn .35s ease ${index * 0.07}s both`,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 13, borderBottom: open ? `1px solid ${C.border}` : 'none' }}
        onMouseEnter={e => e.currentTarget.style.background = C.brownGhost}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: allDone ? `linear-gradient(135deg, ${C.emerald}, #0A7A5E)` : `linear-gradient(135deg, ${C.brownDark}, ${C.brown})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 900, color: 'white',
          boxShadow: `0 3px 10px ${allDone ? C.emerald : C.brown}30`,
        }}>
          {allDone ? '✓' : index + 1}
        </div>

        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {famille.titre}
            </p>
            {allDone && <span style={{ fontSize: 9, fontWeight: 800, color: C.emerald, background: `${C.emerald}15`, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>✓ Terminé</span>}
            {hasActive && !allDone && <span style={{ fontSize: 9, fontWeight: 800, color: C.gold, background: `${C.gold}15`, padding: '2px 8px', borderRadius: 10, flexShrink: 0 }}>▶ En cours</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <ProgressBar value={pctFam} color={allDone ? C.emerald : hasActive ? C.gold : C.brownLight} h={4}/>
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: allDone ? C.emerald : C.textSec, flexShrink: 0 }}>
              {doneFam}/{totalFam}
            </span>
          </div>
        </div>

        <ChevronDown size={15} color={C.textSec} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}/>
      </button>

      {open && (
        <div style={{ padding: '14px 14px 14px 14px' }}>
          {(famille.unites || []).length === 0 ? (
            <p style={{ color: C.textSec, fontSize: 13, textAlign: 'center', padding: '12px 0', margin: 0 }}>Aucune UA dans cette famille.</p>
          ) : (
            (famille.unites || []).map((ua, i) => (
              <UAPathCard
                key={ua.id} ua={ua} index={i}
                progression={progression} recommandeeId={recommandeeId}
                navigate={navigate} isLast={i === famille.unites.length - 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// PAGE PARCOURS
// ════════════════════════════════════════════════════════════════
export default function ParcoursPage({ onBack }) {
  const { C } = useTheme()
  const { user }   = useSelector(s => s.auth)
  const navigate   = useNavigate()

  const [matieres,    setMatieres]    = useState([])
  const [modules,     setModules]     = useState([])
  const [familles,    setFamilles]    = useState([])
  const [progression, setProgression] = useState(null)
  const [recommandee, setRecommandee] = useState(null)
  const [selectedMat, setSelectedMat] = useState(null)
  const [selectedMod, setSelectedMod] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [loadingFam,  setLoadingFam]  = useState(false)
  const [activeTab,   setActiveTab]   = useState('cours')
  const [epreuves,    setEpreuves]    = useState([])

  const loadFamilles = useCallback(async (mod) => {
    if (!mod) return
    setLoadingFam(true)
    try {
      const { data: fam } = await api.get(`/api/cours/modules/${mod.id}/familles?user_id=${user.id}`)
      setFamilles(fam)
    } catch { setFamilles([]) }
    finally { setLoadingFam(false) }
  }, [user.id])

  useEffect(() => {
    if (!user?.id) return
    async function init() {
      try {
        const [{ data: mat }, { data: prog }] = await Promise.all([
          api.get(`/api/cours/matieres${user.niveau_id ? '?niveau_id=' + user.niveau_id : ''}`),
          api.get(`/api/cours/progression/${user.id}`),
        ])
        setMatieres(mat)
        setProgression(prog)
        if (mat.length > 0) {
          setSelectedMat(mat[0])
          const mods = mat[0].modules || []
          setModules(mods)
          if (mods.length > 0) {
            setSelectedMod(mods[0])
            await loadFamilles(mods[0])
          }
        }
        try { const { data: r } = await api.get(`/api/cours/ua/recommandee/${user.id}`); setRecommandee(r?.recommandee || null) } catch {}
        try { const { data: ep } = await api.get('/api/examens/disponibles'); setEpreuves(ep) } catch {}
      } catch {}
      finally { setLoading(false) }
    }
    init()
  }, [user?.id, loadFamilles])

  async function handleSelectMatiere(mat) {
    setSelectedMat(mat)
    setFamilles([])
    const mods = mat.modules || []
    setModules(mods)
    const first = mods[0] || null
    setSelectedMod(first)
    await loadFamilles(first)
  }

  async function handleSelectModule(mod) {
    setSelectedMod(mod)
    await loadFamilles(mod)
  }

  const totalDone  = familles.reduce((a, f) => a + (f.unites || []).filter(u => uaStatus(u, progression) === 'done').length, 0)
  const totalInProg = familles.reduce((a, f) => a + (f.unites || []).filter(u => uaStatus(u, progression) === 'inprogress').length, 0)
  const totalUnits = familles.reduce((a, f) => a + (f.unites || []).length, 0)
  const overallPct = totalUnits > 0 ? Math.round(totalDone / totalUnits * 100) : 0
  const epBadge    = epreuves.filter(e => !e.soumis).length

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', background: C.bg, gap: 12 }}>
      <Spinner size={40}/>
      <p style={{ color: C.textSec, fontSize: 13, fontWeight: 600, margin: 0 }}>Chargement du parcours…</p>
    </div>
  )

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      {/* ══ HERO ══ */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brownDark} 0%, ${C.brown} 60%, ${C.brownLight} 100%)`,
        padding: '22px 22px 20px', position: 'relative', overflow: 'hidden',
      }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .05, pointerEvents: 'none' }}>
          <defs><pattern id="parcours-dots" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="16" cy="16" r="1.2" fill="white"/>
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#parcours-dots)"/>
        </svg>

        <div style={{ position: 'relative' }}>
          {onBack && (
            <button onClick={onBack} style={{ background: 'rgba(255,255,255,.14)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 9, padding: '5px 12px', cursor: 'pointer', color: 'white', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, marginBottom: 14 }}>
              <ChevronLeft size={13}/> Retour
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Map size={16} color="rgba(255,255,255,.8)"/>
                <h1 style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0 }}>Mon Parcours</h1>
                {user?.niveau_label && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', background: 'rgba(255,255,255,.15)', padding: '2px 9px', borderRadius: 20 }}>
                    {user.niveau_label}{user.filiere_label ? ` · ${user.filiere_label}` : ''}
                  </span>
                )}
              </div>

              {/* Stats pills */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {[
                  { label: `${totalDone} terminée${totalDone > 1 ? 's' : ''}`, color: 'rgba(255,255,255,.9)' },
                  totalInProg > 0 && { label: `${totalInProg} en cours`, color: C.gold },
                  totalUnits - totalDone - totalInProg > 0 && { label: `${totalUnits - totalDone - totalInProg} à venir`, color: 'rgba(255,255,255,.5)' },
                ].filter(Boolean).map((s, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.label}</span>
                ))}
              </div>
            </div>

            {/* Bloc % */}
            <div style={{ background: 'rgba(255,255,255,.13)', border: '1px solid rgba(255,255,255,.2)', borderRadius: 14, padding: '10px 16px', minWidth: 110, textAlign: 'center' }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,.65)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 4px' }}>Progression</p>
              <p style={{ fontSize: 26, fontWeight: 900, color: 'white', margin: '0 0 6px', lineHeight: 1 }}>
                {overallPct}<span style={{ fontSize: 12 }}>%</span>
              </p>
              <div style={{ height: 4, background: 'rgba(255,255,255,.22)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: overallPct === 100 ? C.gold : 'white', width: `${overallPct}%`, transition: 'width .9s ease' }}/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ BARRE NAVIGATION STICKY ══ */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 20 }}>

        {/* Matières */}
        {matieres.length > 1 && (
          <div style={{ padding: '10px 18px 0', borderBottom: modules.length > 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
              {matieres.map(mat => {
                const active = selectedMat?.id === mat.id
                return (
                  <button key={mat.id} onClick={() => handleSelectMatiere(mat)} style={{
                    padding: '6px 14px', borderRadius: 20, flexShrink: 0,
                    border: `1.5px solid ${active ? C.brown : C.border}`,
                    background: active ? C.brown : C.surface,
                    color: active ? 'white' : C.textSec,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    transition: 'all .15s', boxShadow: active ? `0 2px 10px ${C.brown}30` : 'none',
                  }}>
                    {mat.icone || '📚'} {mat.nom}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Modules */}
        {modules.length > 1 && (
          <div style={{ padding: '8px 18px 0' }}>
            <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 8, scrollbarWidth: 'none' }}>
              {modules.map(mod => {
                const active = selectedMod?.id === mod.id
                return (
                  <button key={mod.id} onClick={() => handleSelectModule(mod)} style={{
                    padding: '5px 12px', borderRadius: 18, flexShrink: 0, border: 'none',
                    background: active ? `linear-gradient(135deg, ${C.gold}, ${C.orange})` : C.brownGhost,
                    color: active ? 'white' : C.textSec,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    transition: 'all .15s', boxShadow: active ? `0 2px 8px ${C.gold}40` : 'none',
                  }}>
                    Module {mod.numero} · {mod.titre.length > 28 ? mod.titre.substring(0, 28) + '…' : mod.titre}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Onglets */}
        <div style={{ display: 'flex', gap: 2, padding: '0 18px' }}>
          {[
            { id: 'cours',    label: 'Cours',    Icon: BookOpen      },
            { id: 'epreuves', label: 'Épreuves', Icon: ClipboardList, badge: epBadge },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 14px', fontSize: 12, fontWeight: activeTab === tab.id ? 800 : 600,
              color: activeTab === tab.id ? C.brown : C.textSec,
              borderBottom: `2px solid ${activeTab === tab.id ? C.brown : 'transparent'}`,
              display: 'flex', alignItems: 'center', gap: 5, transition: 'all .15s',
            }}>
              <tab.Icon size={13}/>
              {tab.label}
              {tab.badge > 0 && (
                <span style={{ background: '#EF4444', color: 'white', borderRadius: 10, padding: '1px 5px', fontSize: 9, fontWeight: 800 }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══ ONGLET ÉPREUVES ══ */}
      {activeTab === 'epreuves' && (
        <div style={{ padding: '20px 16px', maxWidth: 720, margin: '0 auto' }}>
          {epreuves.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
              <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }}/>
              <p style={{ fontWeight: 700, color: C.text, margin: '0 0 6px' }}>Aucune épreuve disponible</p>
              <p style={{ fontSize: 13, margin: 0 }}>Ton enseignant n'a pas encore publié d'épreuve.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Stats rapides */}
              {epreuves.some(e => e.soumis) && (() => {
                const soumises = epreuves.filter(e => e.soumis && e.score_total != null)
                const moyenne  = soumises.length > 0 ? soumises.reduce((a, e) => a + e.score_total, 0) / soumises.length : null
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 6 }}>
                    {[
                      { label: 'Passées',  value: soumises.length,       color: C.emerald, Icon: CheckCircle2 },
                      { label: 'À passer', value: epreuves.filter(e => !e.soumis).length, color: C.brown, Icon: Clock },
                      { label: 'Moyenne',  value: moyenne != null ? `${moyenne.toFixed(1)}/20` : '—', color: '#2563eb', Icon: Award },
                    ].map(s => (
                      <div key={s.label} style={{ background: C.surface, borderRadius: 12, padding: '12px 14px', border: `1px solid ${C.border}`, boxShadow: '0 1px 5px rgba(107,58,42,0.06)' }}>
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
                  style={{ background: C.surface, borderRadius: 14, padding: '14px 18px', border: `1.5px solid ${ep.soumis ? `${C.emerald}35` : C.border}`, cursor: 'pointer', transition: 'all .15s', boxShadow: '0 1px 6px rgba(107,58,42,0.06)' }}
                  onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 18px ${C.brown}15` }}
                  onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 1px 6px rgba(107,58,42,0.06)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: ep.soumis ? `${C.emerald}18` : `${C.brown}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {ep.soumis ? <CheckCircle2 size={19} color={C.emerald}/> : <FileText size={19} color={C.brown}/>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                        <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.titre}</p>
                        {ep.soumis && ep.nb_incidents > 0 && <ShieldAlert size={12} color="#EF4444" style={{ flexShrink: 0 }}/>}
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, color: C.textSec }}>{ep.classe_label || ep.type_epreuve}</span>
                        <span style={{ fontSize: 10, color: C.textSec }}>⏱ {ep.duree_minutes} min</span>
                        {ep.soumis && ep.score_total != null && (
                          <span style={{ fontSize: 11, fontWeight: 800, color: ep.score_total >= 10 ? C.emerald : '#EF4444' }}>{ep.score_total.toFixed(1)}/20</span>
                        )}
                      </div>
                    </div>
                    {ep.soumis && ep.score_total != null ? (
                      <div style={{ width: 42, height: 42, borderRadius: '50%', border: `2.5px solid ${ep.score_total >= 10 ? C.emerald : '#EF4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: ep.score_total >= 10 ? C.emerald : '#EF4444' }}>{ep.score_total.toFixed(0)}</span>
                      </div>
                    ) : (
                      <ChevronLeft size={15} color={C.brown} style={{ transform: 'rotate(180deg)', flexShrink: 0 }}/>
                    )}
                  </div>
                  {ep.soumis && ep.score_total != null && (
                    <div style={{ marginTop: 10 }}>
                      <ProgressBar value={(ep.score_total / 20) * 100} color={ep.score_total >= 10 ? C.emerald : '#EF4444'} h={4}/>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ ONGLET COURS ══ */}
      {activeTab === 'cours' && (
        <div style={{ padding: '20px 16px', maxWidth: 720, margin: '0 auto' }}>
          {loadingFam ? (
            <div style={{ textAlign: 'center', padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
              <Spinner size={36}/>
            </div>
          ) : familles.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <span style={{ fontSize: 44 }}>📭</span>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.brown, margin: '14px 0 6px' }}>Aucun contenu disponible</p>
              <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>
                Sélectionne une matière ou un module, ou attends que l'administrateur ajoute du contenu pour <strong>{user?.niveau_label}</strong>.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Recommandée IA */}
              {recommandee && (
                <div style={{
                  background: `linear-gradient(135deg, ${C.emeraldPale}, ${C.surface})`,
                  borderRadius: 16, padding: '14px 18px',
                  border: `1.5px solid ${C.emerald}40`,
                  display: 'flex', alignItems: 'center', gap: 14,
                  animation: 'fadeIn .4s ease',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
                    ⭐
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: C.emerald, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 2px' }}>Recommandé par l'IA</p>
                    <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recommandee.titre}</p>
                    <p style={{ fontSize: 10, color: C.textSec, margin: 0 }}>Maîtrise BKT : {Math.round(recommandee.score_bkt * 100)}%</p>
                  </div>
                  <button onClick={() => navigate(`/cours/${recommandee.ua_id}`)} style={{
                    padding: '8px 16px', background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`,
                    color: 'white', border: 'none', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0, boxShadow: `0 3px 10px ${C.emerald}35`,
                  }}>
                    Commencer →
                  </button>
                </div>
              )}

              {/* Bandeau progression */}
              {totalDone > 0 && (
                <div style={{ background: C.brownGhost, borderRadius: 12, padding: '10px 16px', border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 22 }}>{totalDone >= totalUnits ? '🏆' : overallPct >= 50 ? '🥈' : '🥉'}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: C.brown, margin: '0 0 4px' }}>
                      {totalDone >= totalUnits ? 'Module terminé — félicitations !' : `${totalDone} UA terminée${totalDone > 1 ? 's' : ''} sur ${totalUnits}`}
                    </p>
                    <ProgressBar value={overallPct} color={overallPct === 100 ? C.emerald : C.gold} h={5}/>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 900, color: C.gold }}>{overallPct}%</span>
                </div>
              )}

              {/* Familles */}
              {familles.map((famille, fi) => (
                <FamilleSection
                  key={famille.id} famille={famille} index={fi}
                  progression={progression} recommandeeId={recommandee?.ua_id}
                  navigate={navigate}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
