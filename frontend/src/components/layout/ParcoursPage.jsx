import { useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import api from '../../services/api'
import {
  Map, BookOpen, Clock, ChevronRight, ChevronLeft,
  CheckCircle2, PlayCircle, Lock, Trophy,
  ChevronDown, BookMarked, Layers, Star
} from 'lucide-react'
import { C } from '../../styles/theme'
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

const ProgressBar = ({ value, color = C.emerald, h = 5 }) => (
  <div style={{ height: h, background: 'rgba(107,58,42,0.1)', borderRadius: h, overflow: 'hidden' }}>
    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, value))}%`, background: color, borderRadius: h, transition: 'width .7s ease' }} />
  </div>
)

// ── Nœud UA style Duolingo ──────────────────────────────────────
function UANode({ ua, index, progression, recommandeeId, navigate, isLast }) {
  const status  = uaStatus(ua, progression)
  const stars   = uaStars(ua, progression)
  const isDone       = status === 'done'
  const isInProgress = status === 'inprogress'
  const isTodo       = status === 'todo'
  const isLocked     = status === 'locked'
  const isReco       = recommandeeId === ua.id
  const canClick     = !isLocked && status !== 'locked'

  // Décalage zigzag
  const offsets = [0, 48, 80, 48, 0, -48, -80, -48]
  const offset  = offsets[index % offsets.length]

  const size = (isDone || isTodo || isLocked) ? 64 : 72

  const nodeStyle = {
    width: size, height: size, borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: isDone ? 26 : isInProgress ? 28 : 22,
    cursor: canClick ? 'pointer' : 'default',
    transition: 'transform .15s, box-shadow .15s',
    border: isDone
      ? `3px solid ${C.brownLight}`
      : isInProgress
        ? `3px solid ${C.gold}`
        : `2px dashed ${isLocked ? '#CBD5E1' : '#D1D5DB'}`,
    background: isDone
      ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`
      : isInProgress
        ? `linear-gradient(135deg, ${C.gold}, ${C.orange})`
        : '#F3F4F6',
    boxShadow: isInProgress
      ? `0 0 0 8px ${C.gold}20, 0 4px 20px ${C.gold}40`
      : isDone
        ? `0 4px 14px ${C.brown}35`
        : 'none',
    animation: isInProgress ? 'pulse 2.5s infinite' : 'none',
  }

  const emoji = isDone
    ? '✅'
    : isInProgress
      ? '📖'
      : isLocked
        ? '🔒'
        : '📘'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      marginLeft: offset, animation: `fadeIn .3s ease ${index * 0.07}s both`,
    }}>
      {/* Badge recommandé */}
      {isReco && !isDone && !isLocked && (
        <div style={{
          background: C.emerald, color: 'white',
          fontSize: 9, fontWeight: 700, padding: '3px 10px',
          borderRadius: 20, marginBottom: 6, letterSpacing: .5,
        }}>
          ⭐ RECOMMANDÉ PAR L'IA
        </div>
      )}

      {/* Nœud */}
      <div style={{ position: 'relative' }}>
        <div
          style={nodeStyle}
          onClick={() => canClick && navigate(`/cours/${ua.id}`)}
          onMouseOver={e => { if (canClick) { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = isInProgress ? `0 0 0 10px ${C.gold}25, 0 6px 24px ${C.gold}50` : `0 6px 20px ${C.brown}40` } }}
          onMouseOut={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = nodeStyle.boxShadow }}
        >
          <span>{emoji}</span>
        </div>

        {/* Badge EN COURS */}
        {isInProgress && (
          <div style={{
            position: 'absolute', top: -8, right: -8,
            background: C.red, color: 'white',
            fontSize: 8, fontWeight: 700, padding: '2px 7px',
            borderRadius: 10, whiteSpace: 'nowrap',
          }}>
            EN COURS
          </div>
        )}
      </div>

      {/* Étoiles */}
      <div style={{ display: 'flex', gap: 2, margin: '8px 0 4px' }}>
        {[1, 2, 3].map(s => (
          <Star
            key={s}
            size={13}
            fill={s <= stars ? C.gold : 'none'}
            color={s <= stars ? C.gold : '#D1D5DB'}
          />
        ))}
      </div>

      {/* Titre */}
      <div style={{ textAlign: 'center', maxWidth: 140 }}>
        <p style={{
          fontSize: 11, fontWeight: 700,
          color: isLocked ? '#9CA3AF' : isDone ? C.brown : C.text,
          margin: '0 0 3px', lineHeight: 1.3,
        }}>
          {ua.titre.length > 40 ? ua.titre.substring(0, 40) + '…' : ua.titre}
        </p>
        <span style={{ fontSize: 10, color: isLocked ? '#9CA3AF' : C.textSec }}>
          {ua.reference_ue}
          {ua.nb_exercices > 0 && ` · ${ua.nb_exercices} exos`}
          {ua.duree_estimee > 0 && ` · ${ua.duree_estimee}min`}
        </span>
      </div>

      {/* Bouton action */}
      {canClick && (
        <button
          onClick={() => navigate(`/cours/${ua.id}`)}
          style={{
            marginTop: 8, padding: '6px 20px',
            background: isDone
              ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`
              : `linear-gradient(135deg, ${C.gold}, ${C.orange})`,
            color: 'white', border: 'none', borderRadius: 20,
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 3px 10px ${isDone ? C.brown : C.gold}35`,
            transition: 'transform .15s',
          }}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {isDone ? 'Revoir' : isInProgress ? 'Continuer →' : 'Commencer →'}
        </button>
      )}

      {isLocked && (
        <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 6, textAlign: 'center', maxWidth: 120, lineHeight: 1.4 }}>
          Terminez l'UA précédente pour débloquer
        </p>
      )}

      {/* Connecteur vers le nœud suivant */}
      {!isLast && (
        <div style={{
          width: 3, height: 40, marginTop: 10,
          background: isDone
            ? `linear-gradient(${C.brown}, ${C.brownLight})`
            : `repeating-linear-gradient(to bottom, #D1D5DB 0px, #D1D5DB 6px, transparent 6px, transparent 12px)`,
          borderRadius: 2,
        }} />
      )}
    </div>
  )
}

// ── Section famille (accordéon) ─────────────────────────────────
function FamilleSection({ famille, index, progression, recommandeeId, navigate }) {
  const [open, setOpen] = useState(index === 0)

  const doneFam  = (famille.unites || []).filter(u => uaStatus(u, progression) === 'done').length
  const totalFam = (famille.unites || []).length
  const pctFam   = totalFam > 0 ? Math.round(doneFam / totalFam * 100) : 0
  const allDone  = doneFam === totalFam && totalFam > 0

  return (
    <div style={{
      background: C.surface, borderRadius: 20, overflow: 'hidden',
      border: `1px solid ${allDone ? C.emerald + '50' : C.brownPale}`,
      boxShadow: open ? '0 8px 32px rgba(107,58,42,0.12)' : '0 2px 10px rgba(107,58,42,0.06)',
      transition: 'box-shadow .25s',
      animation: `fadeIn .35s ease ${index * 0.08}s both`,
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 14,
          borderBottom: open ? `1px solid ${C.brownPale}` : 'none',
        }}
        onMouseEnter={e => e.currentTarget.style.background = `${C.brownPale}60`}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        {/* Numéro / check */}
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: allDone
            ? `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`
            : `linear-gradient(135deg, ${C.brownDark}, ${C.brown})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 900, color: 'white',
          boxShadow: `0 4px 14px ${allDone ? C.emerald : C.brown}40`,
        }}>
          {allDone ? '✓' : index + 1}
        </div>

        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: '0 0 6px' }}>
            {famille.titre}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <ProgressBar value={pctFam} color={allDone ? C.emerald : C.brownLight} h={5} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: allDone ? C.emerald : C.brownLight, flexShrink: 0 }}>
              {doneFam}/{totalFam} UA
            </span>
          </div>
        </div>

        <ChevronDown
          size={18} color={C.textSec}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}
        />
      </button>

      {/* Parcours Duolingo */}
      {open && (
        <div style={{ padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {(famille.unites || []).length === 0 ? (
            <p style={{ color: C.textSec, fontSize: 13 }}>Aucune UA dans cette famille.</p>
          ) : (
            (famille.unites || []).map((ua, i) => (
              <UANode
                key={ua.id}
                ua={ua}
                index={i}
                progression={progression}
                recommandeeId={recommandeeId}
                navigate={navigate}
                isLast={i === famille.unites.length - 1}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ── PAGE PARCOURS ───────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════
export default function ParcoursPage({ onBack }) {
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

  // ── Charge les familles d'un module ──────────────────────────
  const loadFamilles = useCallback(async (mod) => {
    if (!mod) return
    setLoadingFam(true)
    try {
      const { data: fam } = await api.get(
        `/api/cours/modules/${mod.id}/familles?user_id=${user.id}`
      )
      setFamilles(fam)
    } catch { setFamilles([]) }
    finally { setLoadingFam(false) }
  }, [user.id])

  // ── Init ──────────────────────────────────────────────────────
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

        try {
          const { data: reco } = await api.get(`/api/cours/ua/recommandee/${user.id}`)
          setRecommandee(reco?.recommandee || null)
        } catch {}
      } catch {}
      finally { setLoading(false) }
    }
    init()
  }, [user?.id, loadFamilles])

  // ── Changement matière ────────────────────────────────────────
  async function handleSelectMatiere(mat) {
    setSelectedMat(mat)
    setFamilles([])
    const mods = mat.modules || []
    setModules(mods)
    const first = mods[0] || null
    setSelectedMod(first)
    await loadFamilles(first)
  }

  // ── Changement module ─────────────────────────────────────────
  async function handleSelectModule(mod) {
    setSelectedMod(mod)
    await loadFamilles(mod)
  }

  // ── Stats ─────────────────────────────────────────────────────
  const totalDone  = familles.reduce((a, f) => a + (f.unites || []).filter(u => uaStatus(u, progression) === 'done').length, 0)
  const totalUnits = familles.reduce((a, f) => a + (f.unites || []).length, 0)
  const overallPct = totalUnits > 0 ? Math.round(totalDone / totalUnits * 100) : 0

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', background: C.bg, gap: 12 }}>
      <Spinner size={40} />
      <p style={{ color: C.textSec, fontSize: 13, fontWeight: 600, margin: 0 }}>Chargement du parcours…</p>
    </div>
  )

  return (
    <div style={{ background: C.bg, minHeight: '100vh' }}>
      <style>{`
        @keyframes fadeIn  { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse   { 0%,100%{box-shadow:0 0 0 0 ${C.gold}55} 50%{box-shadow:0 0 0 12px ${C.gold}00} }
      `}</style>

      {/* ── HERO ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brownDark} 0%, ${C.brown} 60%, ${C.brownLight} 100%)`,
        padding: '28px 28px 24px', position: 'relative', overflow: 'hidden',
      }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .05, pointerEvents: 'none' }}>
          <defs>
            <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1.5" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dots)" />
        </svg>

        <div style={{ position: 'relative' }}>
          {onBack && (
            <button onClick={onBack} style={{
              background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)',
              borderRadius: 10, padding: '6px 14px', cursor: 'pointer', color: 'white',
              fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: 16,
            }}>
              <ChevronLeft size={14} /> Retour
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Map size={18} color="white" />
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: 'white', margin: 0 }}>Mon Parcours</h1>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', margin: 0, fontWeight: 500 }}>
                {selectedMat?.nom || 'Cours'} · {totalDone}/{totalUnits} unités terminées
              </p>
            </div>

            {/* Progression globale */}
            <div style={{ background: 'rgba(255,255,255,.12)', border: '1px solid rgba(255,255,255,.22)', borderRadius: 14, padding: '12px 18px', minWidth: 130 }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 6px' }}>Progression</p>
              <p style={{ fontSize: 28, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1 }}>
                {overallPct}<span style={{ fontSize: 14 }}>%</span>
              </p>
              <div style={{ height: 5, background: 'rgba(255,255,255,.25)', borderRadius: 5, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 5, background: 'white', width: `${overallPct}%`, transition: 'width .8s ease' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── SÉLECTEURS matière + module ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.brownPale}`, padding: '0 28px' }}>

        {/* Matières */}
        {matieres.length >= 1 && (
          <div style={{ borderBottom: modules.length > 1 ? `1px solid ${C.brownPale}` : 'none', padding: '12px 0' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <BookMarked size={11} /> Matière
            </p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {matieres.map(mat => {
                const active = selectedMat?.id === mat.id
                return (
                  <button key={mat.id} onClick={() => handleSelectMatiere(mat)} style={{
                    padding: '8px 18px', borderRadius: 24, border: `2px solid ${active ? C.brown : C.brownPale}`,
                    background: active ? C.brown : C.surface,
                    color: active ? 'white' : C.textSec,
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'all .2s', boxShadow: active ? `0 3px 12px ${C.brown}35` : 'none',
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
          <div style={{ padding: '12px 0' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Layers size={11} /> Module
            </p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {modules.map(mod => {
                const active = selectedMod?.id === mod.id
                return (
                  <button key={mod.id} onClick={() => handleSelectModule(mod)} style={{
                    padding: '7px 16px', borderRadius: 22, border: 'none', cursor: 'pointer',
                    background: active ? `linear-gradient(135deg, ${C.gold}, ${C.orange})` : C.brownPale,
                    color: active ? 'white' : C.textSec,
                    fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'all .2s', boxShadow: active ? `0 3px 10px ${C.gold}45` : 'none',
                  }}>
                    Module {mod.numero} · {mod.titre.length > 30 ? mod.titre.substring(0, 30) + '…' : mod.titre}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── CONTENU ── */}
      <div style={{ padding: '28px', maxWidth: 760, margin: '0 auto' }}>

        {loadingFam ? (
          <div style={{ textAlign: 'center', padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
            <Spinner size={36} />
          </div>
        ) : familles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <span style={{ fontSize: 48 }}>📭</span>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.brown, margin: '16px 0 8px' }}>
              Aucun contenu disponible
            </p>
            <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>
              Sélectionnez une matière ou un module, ou attendez que l'administrateur ajoute du contenu pour <strong>{user?.niveau_label}</strong>.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Badge progrès en haut */}
            {totalDone > 0 && (
              <div style={{
                background: `linear-gradient(135deg, ${C.gold}18, ${C.brownPale})`,
                borderRadius: 14, padding: '12px 18px',
                border: `1px solid ${C.gold}35`,
                display: 'flex', alignItems: 'center', gap: 12,
                animation: 'fadeIn .3s ease',
              }}>
                <span style={{ fontSize: 28 }}>
                  {totalDone >= totalUnits ? '🏆' : totalDone >= totalUnits / 2 ? '🥈' : '🥉'}
                </span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: C.brown, margin: '0 0 2px' }}>
                    {totalDone >= totalUnits
                      ? 'Module terminé ! Félicitations 🎉'
                      : `${totalDone} UA terminée${totalDone > 1 ? 's' : ''} sur ${totalUnits}`}
                  </p>
                  <ProgressBar value={overallPct} color={overallPct === 100 ? C.emerald : C.gold} h={5} />
                </div>
                <span style={{ fontSize: 18, fontWeight: 900, color: C.gold, marginLeft: 'auto' }}>
                  {overallPct}%
                </span>
              </div>
            )}

            {/* UA recommandée */}
            {recommandee && (
              <div style={{
                background: `linear-gradient(135deg, ${C.emeraldPale}, white)`,
                borderRadius: 14, padding: '14px 18px',
                border: `1.5px solid ${C.emerald}40`,
                display: 'flex', alignItems: 'center', gap: 12,
                animation: 'fadeIn .4s ease',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>
                  ⭐
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: C.emerald, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 2px' }}>Recommandé par l'IA</p>
                  <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {recommandee.titre}
                  </p>
                  <p style={{ fontSize: 10, color: C.textSec, margin: 0 }}>Maîtrise BKT : {Math.round(recommandee.score_bkt * 100)}%</p>
                </div>
                <button onClick={() => navigate(`/cours/${recommandee.ua_id}`)} style={{
                  padding: '8px 16px', background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`,
                  color: 'white', border: 'none', borderRadius: 20,
                  fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                  boxShadow: `0 3px 12px ${C.emerald}40`,
                }}>
                  Commencer →
                </button>
              </div>
            )}

            {/* Familles */}
            {familles.map((famille, fi) => (
              <FamilleSection
                key={famille.id}
                famille={famille}
                index={fi}
                progression={progression}
                recommandeeId={recommandee?.ua_id}
                navigate={navigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}