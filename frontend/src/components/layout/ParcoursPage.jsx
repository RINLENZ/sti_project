import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useCallback, useMemo } from 'react'
import api from '../../services/api'
import {
  Map, BookOpen, ChevronLeft, CheckCircle2,
  ClipboardList, FileText, Award, ShieldAlert, Clock, Lock,
} from 'lucide-react'
import { useTheme } from '../../styles/theme.jsx'
import { Spinner } from '../Skeleton'
import { getCache, setCache } from '../../services/cache'

// ── Métrique unifiée BKT — source de vérité pour tous les statuts ────────────
//
// Remplace l'ancienne logique exercices_faits/total (ParcoursPage) et la logique
// bkt_score >= 0.80 (ProgressionMap). Les deux pages montraient des états
// contradictoires pour le même apprenant. Règle unique :
//   bkt_score >= 0.80  → done        (Maîtrisé)
//   bkt_score  > 0.0   → inprogress  (En cours)
//   bkt_score == null  → todo        (Non commencé / pas de compétences)
//   bkt_score == 0.0   → todo        (Non commencé)
//   is_locked          → locked      (Prérequis non atteints)
//
function uaStatus(ua) {
  if (ua.is_locked) return 'locked'
  const bkt = ua.bkt_score
  if (bkt == null)   return 'todo'
  if (bkt >= 0.80)   return 'done'
  if (bkt > 0.0)     return 'inprogress'
  return 'todo'
}

// ── Niveaux BKT → couleur + libellé (via thème — dark mode compatible) ───────
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

// ── Anneau BKT SVG (emprunté de ProgressionMap, couleurs via thème) ──────────
function MasteryRing({ score, size = 38, C }) {
  const { color, pct } = bktLevel(score, C)
  const r    = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={4.5}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={4.5}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: 'stroke-dasharray .7s ease' }}
      />
      <text x={size/2} y={size/2 + 1} textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize={size < 40 ? 9 : 11} fontWeight={800}>
        {pct}%
      </text>
    </svg>
  )
}

// ── Barre de progression ──────────────────────────────────────────────────────
const ProgressBar = ({ value, color, h = 5 }) => {
  const { C } = useTheme()
  return (
    <div style={{ height: h, background: C.border, borderRadius: h, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(100, Math.max(0, value))}%`,
        background: color ?? C.emerald, borderRadius: h, transition: 'width .7s ease',
      }}/>
    </div>
  )
}

// ── Bandeau Module (BKT-based) ────────────────────────────────────────────────
function ModuleBanner({ module, allFamilles }) {
  const { C } = useTheme()
  const allUnits = allFamilles.flatMap(f => f.unites || [])
  const done     = allUnits.filter(u => uaStatus(u) === 'done').length
  const total    = allUnits.length
  const pct      = total > 0 ? Math.round(done / total * 100) : 0
  const allDone  = done === total && total > 0
  const hasActiv = allUnits.some(u => uaStatus(u) === 'inprogress')

  return (
    <div style={{
      background: allDone
        ? `linear-gradient(135deg, ${C.emerald}22, ${C.emeraldPale})`
        : `linear-gradient(135deg, ${C.brownDark}, ${C.brown})`,
      borderRadius: 18, padding: '18px 20px',
      border: `1.5px solid ${allDone ? `${C.emerald}55` : hasActiv ? `${C.gold}40` : 'transparent'}`,
      boxShadow: `0 6px 24px ${C.brown}22`,
      animation: 'fadeIn .35s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 16, flexShrink: 0,
          background: allDone
            ? `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`
            : 'rgba(255,255,255,.15)',
          border: allDone ? 'none' : '2px solid rgba(255,255,255,.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, fontWeight: 900, color: 'white',
        }}>
          {allDone ? '🏆' : (module.numero ?? '📚')}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: allDone ? C.emerald : 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 2px' }}>
            Module {module.numero}
          </p>
          <p style={{ fontSize: 15, fontWeight: 900, color: allDone ? C.text : 'white', margin: '0 0 8px', lineHeight: 1.3 }}>
            {module.titre}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <ProgressBar value={pct} color={allDone ? C.emerald : 'rgba(255,255,255,.9)'} h={5}/>
            </div>
            <span style={{ fontSize: 11, fontWeight: 800, color: allDone ? C.emerald : 'rgba(255,255,255,.85)', flexShrink: 0 }}>
              {done}/{total}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {allDone && <span style={{ fontSize: 9, fontWeight: 800, color: C.emerald, background: `${C.emerald}18`, padding: '3px 9px', borderRadius: 10 }}>✓ Terminé</span>}
          {hasActiv && !allDone && <span style={{ fontSize: 9, fontWeight: 800, color: C.gold, background: `${C.gold}25`, padding: '3px 9px', borderRadius: 10 }}>▶ En cours</span>}
          <span style={{ fontSize: 22, fontWeight: 900, color: allDone ? C.emerald : 'white' }}>{pct}%</span>
        </div>
      </div>
    </div>
  )
}

// ── Label Famille ─────────────────────────────────────────────────────────────
function FamilleLabel({ famille }) {
  const { C } = useTheme()
  const units   = famille.unites || []
  const done    = units.filter(u => uaStatus(u) === 'done').length
  const total   = units.length
  const allDone = done === total && total > 0

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0 6px', paddingLeft: 40 }}>
      <div style={{ height: 1, flex: 1, background: allDone ? `${C.emerald}40` : C.border }}/>
      <span style={{
        fontSize: 10, fontWeight: 800, letterSpacing: .4, flexShrink: 0,
        maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        color: allDone ? C.emerald : C.textSec,
        background: allDone ? `${C.emerald}12` : C.brownGhost,
        padding: '3px 10px', borderRadius: 10,
      }}>
        {famille.titre} · {done}/{total}
      </span>
      <div style={{ height: 1, flex: 1, background: allDone ? `${C.emerald}40` : C.border }}/>
    </div>
  )
}

// ── Noeud UA (timeline verticale, BKT ring à la place des étoiles) ────────────
function UANode({ ua, nodeIndex, globalIndex, recommandeeId, isLast }) {
  const { C }    = useTheme()
  const navigate = useNavigate()
  const status = uaStatus(ua)
  const [hovered, setHovered] = useState(false)

  const isDone       = status === 'done'
  const isInProgress = status === 'inprogress'
  const isLocked     = status === 'locked'
  const canClick     = !isLocked
  const isReco       = recommandeeId === ua.id && !isDone && !isLocked

  const bktPct   = ua.bkt_score != null ? Math.round(ua.bkt_score * 100) : 0
  const nodeGrad = isDone
    ? `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`
    : isInProgress
      ? `linear-gradient(135deg, ${C.gold}, ${C.orange})`
      : 'none'
  const nodeBorder = isDone ? C.emerald : isInProgress ? C.gold : isLocked ? C.border : C.brownLight

  return (
    <div style={{ display: 'flex', animation: `fadeIn .3s ease ${globalIndex * 0.04}s both` }}>
      {/* Colonne gauche : noeud + ligne */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 40, flexShrink: 0 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
          background: nodeGrad || C.surface,
          border: `2.5px solid ${nodeBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 900,
          color: isDone || isInProgress ? 'white' : isLocked ? C.textMuted : C.brown,
          boxShadow: isInProgress
            ? `0 0 0 6px ${C.gold}20, 0 2px 12px ${C.gold}35`
            : isDone ? `0 2px 10px ${C.emerald}30` : 'none',
          zIndex: 1, position: 'relative', transition: 'box-shadow .2s',
        }}>
          {isDone ? '✓' : isLocked ? <Lock size={12}/> : isInProgress ? '▶' : nodeIndex + 1}
        </div>
        {!isLast && (
          <div style={{
            width: 2, flex: 1, minHeight: 16,
            background: isDone
              ? `linear-gradient(${C.emerald}80, ${C.emerald}20)`
              : `repeating-linear-gradient(to bottom, ${C.border} 0px, ${C.border} 4px, transparent 4px, transparent 8px)`,
            transition: 'background .3s',
          }}/>
        )}
      </div>

      {/* Carte UA */}
      <div style={{ flex: 1, marginLeft: 12, marginBottom: isLast ? 0 : 10 }}>
        <button
          onClick={() => canClick && navigate(`/cours/${ua.id}`)}
          disabled={isLocked}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            width: '100%', textAlign: 'left',
            background: isDone ? `${C.emerald}08` : isInProgress ? `${C.gold}08` : C.surface,
            border: `1.5px solid ${
              isDone        ? `${C.emerald}35`
              : isInProgress ? `${C.gold}45`
              : isReco      ? `${C.emerald}40`
              : hovered     ? `${C.brownLight}55`
              : C.border
            }`,
            borderRadius: 14, padding: '11px 14px',
            cursor: canClick ? 'pointer' : 'default',
            opacity: isLocked ? 0.5 : 1,
            transform: hovered && canClick ? 'translateX(2px)' : 'none',
            boxShadow: isInProgress ? `0 3px 16px ${C.gold}18` : hovered && canClick ? `0 3px 14px ${C.brown}10` : 'none',
            transition: 'all .15s',
          }}
        >
          {(isReco || isInProgress) && (
            <div style={{ marginBottom: 6, display: 'flex', gap: 5 }}>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: isLocked ? C.textMuted : C.text, margin: '0 0 4px', lineHeight: 1.35 }}>
                {ua.titre}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {ua.reference_ue    && <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600 }}>{ua.reference_ue}</span>}
                {ua.nb_exercices > 0 && <span style={{ fontSize: 10, color: C.textSec }}>📝 {ua.nb_exercices} exo{ua.nb_exercices > 1 ? 's' : ''}</span>}
                {ua.duree_estimee > 0 && <span style={{ fontSize: 10, color: C.textSec }}>⏱ {ua.duree_estimee} min</span>}
              </div>
            </div>

            {/* Anneau BKT — remplace les étoiles */}
            {ua.bkt_score != null && (
              <MasteryRing score={ua.bkt_score} size={38} C={C}/>
            )}
            {ua.bkt_score == null && canClick && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                color: isDone ? C.brown : isInProgress ? 'white' : C.gold,
                background: isDone ? C.brownPale : isInProgress ? `linear-gradient(135deg, ${C.gold}, ${C.orange})` : `${C.gold}18`,
                boxShadow: isInProgress ? `0 2px 8px ${C.gold}35` : 'none',
              }}>
                {isDone ? 'Revoir' : isInProgress ? 'Continuer →' : 'Commencer →'}
              </span>
            )}
          </div>

          {/* Barre BKT si en cours */}
          {isInProgress && ua.bkt_score != null && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: C.textSec }}>Maîtrise BKT</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.gold }}>{bktPct}%</span>
              </div>
              <ProgressBar value={bktPct} color={C.gold} h={4}/>
            </div>
          )}
        </button>
      </div>
    </div>
  )
}

// ── Section Module (timeline linéaire) ────────────────────────────────────────
function ModuleSection({ module, familles, recommandeeId, isLast, globalOffset }) {
  const { C } = useTheme()
  let nodeCounter = 0

  return (
    <div style={{ marginBottom: isLast ? 0 : 24 }}>
      <ModuleBanner module={module} allFamilles={familles}/>
      <div style={{ marginTop: 16 }}>
        {familles.map((famille) => {
          const units = famille.unites || []
          return (
            <div key={famille.id}>
              <FamilleLabel famille={famille}/>
              <div style={{ marginTop: 10, marginBottom: 4 }}>
                {units.map((ua, ui) => {
                  const gi = globalOffset + nodeCounter
                  nodeCounter++
                  return (
                    <UANode key={ua.id} ua={ua} nodeIndex={ui} globalIndex={gi}
                      recommandeeId={recommandeeId} isLast={ui === units.length - 1}/>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {!isLast && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0 0', paddingLeft: 40 }}>
          <div style={{ height: 1, flex: 1, background: C.border }}/>
          <span style={{ fontSize: 10, color: C.textMuted, fontWeight: 600, letterSpacing: .5, flexShrink: 0 }}>
            MODULE SUIVANT
          </span>
          <div style={{ height: 1, flex: 1, background: C.border }}/>
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════════
// PAGE PARCOURS
// ════════════════════════════════════════════════════════════════════════════════
export default function ParcoursPage({ onBack }) {
  const { C } = useTheme()
  const { user } = useSelector(s => s.auth)
  const navigate = useNavigate()

  // programme = résultat complet du endpoint /programme (matières → modules → familles → UAs)
  // Une seule requête remplace les N appels /modules/:id/familles de l'ancienne version.
  const [programme,   setProgramme]   = useState([])
  const [recommandee, setRecommandee] = useState(null)
  const [selectedMat, setSelectedMat] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [activeTab,   setActiveTab]   = useState('cours')
  const [epreuves,    setEpreuves]    = useState([])
  const [filtre,      setFiltre]      = useState('all')  // all | todo | progress | done

  // ── Chargement — 1 seule requête pour tout le programme ─────────────────────
  useEffect(() => {
    if (!user?.id) return
    const cacheKey = `parcours_v3_${user.niveau_id}_${user.id}`
    const hit = getCache(cacheKey)
    if (hit) {
      setProgramme(hit.programme); setRecommandee(hit.recommandee)
      setEpreuves(hit.epreuves);   setSelectedMat(hit.selectedMat)
      setLoading(false)
    }

    async function init() {
      try {
        const [progRes] = await Promise.all([
          user.niveau_id
            ? api.get(`/api/cours/programme/${user.niveau_id}?user_id=${user.id}`)
            : Promise.resolve({ data: [] }),
        ])
        const prog = progRes.data || []
        setProgramme(prog)
        const firstMat = prog[0] ?? null
        if (!selectedMat && firstMat) setSelectedMat(firstMat)

        let reco = null, ep = []
        try { const { data: r } = await api.get(`/api/cours/ua/recommandee/${user.id}`); reco = r?.recommandee || null } catch {}
        try { const { data: e } = await api.get('/api/examens/disponibles'); ep = e } catch {}
        setRecommandee(reco); setEpreuves(ep)

        setCache(cacheKey, { programme: prog, recommandee: reco, epreuves: ep, selectedMat: firstMat }, 2 * 60 * 1000)
      } catch {}
      finally { setLoading(false) }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.niveau_id])

  // ── Données de la matière sélectionnée ─────────────────────────────────────
  const currentMatData = programme.find(m => m.id === selectedMat?.id) ?? null
  const pathData = useMemo(() =>
    currentMatData?.modules.map(mod => ({
      module:   mod,
      familles: mod.familles || [],
    })) ?? []
  , [currentMatData])

  // ── Stats globales (matière courante) ───────────────────────────────────────
  const allUAsForMat = useMemo(() =>
    pathData.flatMap(p => p.familles.flatMap(f => f.unites || []))
  , [pathData])

  const stats = useMemo(() => ({
    done:     allUAsForMat.filter(u => uaStatus(u) === 'done').length,
    progress: allUAsForMat.filter(u => uaStatus(u) === 'inprogress').length,
    todo:     allUAsForMat.filter(u => uaStatus(u) === 'todo').length,
    total:    allUAsForMat.length,
  }), [allUAsForMat])

  const overallPct = stats.total > 0 ? Math.round(stats.done / stats.total * 100) : 0
  const epBadge    = epreuves.filter(e => !e.soumis).length

  // ── Filtrage des UAs ────────────────────────────────────────────────────────
  const filteredPathData = useMemo(() => {
    if (filtre === 'all') return pathData
    return pathData.map(section => ({
      ...section,
      familles: section.familles.map(f => ({
        ...f,
        unites: (f.unites || []).filter(ua => {
          const s = uaStatus(ua)
          if (filtre === 'done')     return s === 'done'
          if (filtre === 'progress') return s === 'inprogress'
          if (filtre === 'todo')     return s === 'todo'
          return true
        }),
      })).filter(f => (f.unites?.length ?? 0) > 0),
    })).filter(s => s.familles.length > 0)
  }, [pathData, filtre])

  // ── Anneau hero ─────────────────────────────────────────────────────────────
  const R    = 26
  const CIRC = 2 * Math.PI * R
  const dash = CIRC * (1 - overallPct / 100)

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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Map size={16} color="rgba(255,255,255,.8)"/>
                <h1 style={{ fontSize: 20, fontWeight: 900, color: 'white', margin: 0 }}>Mon Parcours</h1>
                {user?.niveau_label && (
                  <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.75)', background: 'rgba(255,255,255,.15)', padding: '2px 9px', borderRadius: 20 }}>
                    {user.niveau_label}{user.filiere_label ? ` · ${user.filiere_label}` : ''}
                  </span>
                )}
              </div>
              {/* Chips stats globales — Maîtrisé / En cours / À démarrer */}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {[
                  { label: `${stats.done} maîtrisée${stats.done > 1 ? 's' : ''}`,   color: C.emerald },
                  { label: `${stats.progress} en cours`,                              color: C.orange  },
                  { label: `${stats.todo} à démarrer`,                               color: C.textMuted },
                ].map(c => (
                  <span key={c.label} style={{ fontSize: 11, fontWeight: 700, padding: '3px 11px', borderRadius: 20, background: 'rgba(255,255,255,.13)', border: `1.5px solid ${c.color}88`, color: 'white' }}>
                    <span style={{ color: c.color }}>●</span> {c.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Anneau progression global */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <svg width={72} height={72} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={36} cy={36} r={R} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={5}/>
                <circle cx={36} cy={36} r={R} fill="none"
                  stroke={overallPct === 100 ? C.gold : 'white'}
                  strokeWidth={5} strokeLinecap="round"
                  strokeDasharray={CIRC} strokeDashoffset={dash}
                  style={{ transition: 'stroke-dashoffset 1s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: 'white', lineHeight: 1 }}>
                  {overallPct}<span style={{ fontSize: 9 }}>%</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ NAVIGATION STICKY ══ */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 20 }}>
        {/* Onglets matières */}
        {programme.length > 1 && (
          <div style={{ padding: '10px 18px 0' }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 10, scrollbarWidth: 'none' }}>
              {programme.map(mat => {
                const active = selectedMat?.id === mat.id
                return (
                  <button key={mat.id} onClick={() => setSelectedMat(mat)} style={{
                    padding: '6px 14px', borderRadius: 20, flexShrink: 0,
                    border: `1.5px solid ${active ? C.brown : C.border}`,
                    background: active ? C.brown : C.surface,
                    color: active ? 'white' : C.textSec,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    transition: 'all .15s', boxShadow: active ? `0 2px 10px ${C.brown}30` : 'none',
                  }}>
                    📚 {mat.nom}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Onglets Cours / Épreuves */}
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
                <span style={{ background: C.red, color: 'white', borderRadius: 10, padding: '1px 5px', fontSize: 9, fontWeight: 800 }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Chips filtres BKT — uniquement dans l'onglet Cours, avec compteurs */}
        {activeTab === 'cours' && (
          <div style={{ padding: '8px 18px 10px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {[
              { key: 'all',      label: `Tout (${stats.total})` },
              { key: 'todo',     label: `🔴 À démarrer (${stats.todo})` },
              { key: 'progress', label: `🟠 En cours (${stats.progress})` },
              { key: 'done',     label: `🟢 Maîtrisées (${stats.done})` },
            ].map(f => (
              <button key={f.key} onClick={() => setFiltre(f.key)} style={{
                padding: '5px 12px', borderRadius: 20, border: 'none', flexShrink: 0,
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
        <div style={{ padding: '20px 16px', maxWidth: 720, margin: '0 auto' }}>
          {epreuves.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textMuted }}>
              <FileText size={40} style={{ marginBottom: 12, opacity: 0.3 }}/>
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
                      { label: 'Passées',  value: soumises.length,                               color: C.emerald, Icon: CheckCircle2 },
                      { label: 'À passer', value: epreuves.filter(e => !e.soumis).length,        color: C.brown,   Icon: Clock        },
                      { label: 'Moyenne',  value: moyenne != null ? `${moyenne.toFixed(1)}/20` : '—', color: C.blue, Icon: Award      },
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
                      <div style={{ width: 42, height: 42, borderRadius: '50%', border: `2.5px solid ${ep.score_total >= 10 ? C.emerald : C.red}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 900, color: ep.score_total >= 10 ? C.emerald : C.red }}>{ep.score_total.toFixed(0)}</span>
                      </div>
                    ) : (
                      <ChevronLeft size={15} color={C.brown} style={{ transform: 'rotate(180deg)', flexShrink: 0 }}/>
                    )}
                  </div>
                  {ep.soumis && ep.score_total != null && (
                    <div style={{ marginTop: 10 }}>
                      <ProgressBar value={(ep.score_total / 20) * 100} color={ep.score_total >= 10 ? C.emerald : C.red} h={4}/>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ ONGLET COURS (timeline linéaire) ══ */}
      {activeTab === 'cours' && (
        <div style={{ padding: '20px 16px', maxWidth: 720, margin: '0 auto' }}>
          {pathData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px' }}>
              <span style={{ fontSize: 44 }}>📭</span>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.brown, margin: '14px 0 6px' }}>Aucun contenu disponible</p>
              <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>
                {user?.niveau_id
                  ? <>Attends que l'administrateur ajoute du contenu pour <strong>{user.niveau_label}</strong>.</>
                  : 'Ton niveau n\'est pas encore configuré. Contacte ton enseignant.'}
              </p>
            </div>
          ) : filteredPathData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textSec }}>
              <p style={{ fontSize: 32 }}>🔍</p>
              <p style={{ fontSize: 14, fontWeight: 700 }}>Aucune UA dans ce filtre</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Bandeau UA recommandée par l'IA */}
              {recommandee && (
                <div style={{
                  background: `linear-gradient(135deg, ${C.emeraldPale}, ${C.surface})`,
                  borderRadius: 16, padding: '14px 18px', marginBottom: 16,
                  border: `1.5px solid ${C.emerald}40`,
                  display: 'flex', alignItems: 'center', gap: 14,
                  animation: 'fadeIn .4s ease',
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>⭐</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: C.emerald, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 2px' }}>Recommandé par l'IA</p>
                    <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recommandee.titre}</p>
                    <p style={{ fontSize: 10, color: C.textSec, margin: 0 }}>Maîtrise BKT : {Math.round((recommandee.score_bkt ?? 0) * 100)}%</p>
                  </div>
                  {/* Recommandée → Alisha tutoriel (navigation cohérente avec ProgressionMap) */}
                  <button onClick={() => navigate(`/tutoriel/${recommandee.id ?? recommandee.ua_id}`)} style={{
                    padding: '8px 16px', background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`,
                    color: 'white', border: 'none', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    cursor: 'pointer', flexShrink: 0, boxShadow: `0 3px 10px ${C.emerald}35`,
                  }}>
                    Démarrer avec Alisha →
                  </button>
                </div>
              )}

              {/* Timeline */}
              {(() => {
                let offset = 0
                return filteredPathData.map((section, si) => {
                  const el = (
                    <ModuleSection
                      key={section.module.id}
                      module={section.module}
                      familles={section.familles}
                      recommandeeId={recommandee?.id ?? recommandee?.ua_id}
                      isLast={si === filteredPathData.length - 1}
                      globalOffset={offset}
                    />
                  )
                  offset += section.familles.flatMap(f => f.unites || []).length
                  return el
                })
              })()}

              {/* Trophée si tout terminé */}
              {overallPct === 100 && stats.total > 0 && (
                <div style={{
                  textAlign: 'center', padding: '30px 20px', marginTop: 16,
                  background: `linear-gradient(135deg, ${C.gold}15, ${C.brownPale})`,
                  borderRadius: 20, border: `1.5px solid ${C.gold}45`,
                  animation: 'fadeIn .5s ease',
                }}>
                  <div style={{ fontSize: 48 }}>🏆</div>
                  <p style={{ fontSize: 18, fontWeight: 900, color: C.brown, margin: '10px 0 4px' }}>Parcours terminé !</p>
                  <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>Tu as maîtrisé toutes les unités d'apprentissage.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
