import { useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import api from '../../services/api'
import {
  Map, BookOpen, Clock, ChevronRight, ChevronLeft,
  CheckCircle2, PlayCircle, Lock, Trophy,
  ChevronDown, ChevronUp, BookMarked, Layers
} from 'lucide-react'

const C = {
  brown:      '#6B3A2A', brownLight: '#C4865A',
  brownPale:  '#F5EDE5', gold:       '#D4A853',
  emerald:    '#0D9373', emeraldPale:'#E6F5F0',
  bg:         '#FAF7F4', surface:    '#FFFFFF',
  text:       '#1A1207', textSec:    '#6B5744',
}

function uaStatus(ua, progression) {
  const details = progression?.details || []
  const done = details.filter(d => d.ua_id === ua.id && d.correct).length
  const pct = ua.nb_exercices > 0 ? Math.round(done / ua.nb_exercices * 100) : 0
  if (pct === 100) return 'done'
  if (pct > 0) return 'inprogress'
  return 'todo'
}

function StatusBadge({ status }) {
  const cfg = {
    done:       { label: 'Terminé',   color: C.emerald, bg: `${C.emerald}18` },
    inprogress: { label: 'En cours',  color: C.gold,    bg: `${C.gold}18`    },
    todo:       { label: 'À faire',   color: C.textSec, bg: C.brownPale      },
  }[status]
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

function StatusIcon({ status, size = 18 }) {
  if (status === 'done')       return <CheckCircle2 size={size} color={C.emerald}/>
  if (status === 'inprogress') return <PlayCircle   size={size} color={C.gold}/>
  return <Lock size={size} color="#CBD5E1"/>
}

function ProgressBar({ value, color = C.emerald, h = 5 }) {
  return (
    <div style={{ height: h, background: 'rgba(107,58,42,0.1)', borderRadius: h, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, value)}%`, background: color, borderRadius: h, transition: 'width .7s cubic-bezier(.4,0,.2,1)' }}/>
    </div>
  )
}

// ── Famille accordion card ────────────────────────────────────────
function FamilleCard({ famille, fi, progression, currentUaId, navigate }) {
  const [open, setOpen] = useState(fi === 0) // première ouverte par défaut

  const doneFam  = (famille.unites || []).filter(u => uaStatus(u, progression) === 'done').length
  const totalFam = (famille.unites || []).length
  const pctFam   = totalFam > 0 ? Math.round(doneFam / totalFam * 100) : 0
  const allDone  = doneFam === totalFam && totalFam > 0

  return (
    <div style={{
      background: C.surface,
      borderRadius: 18,
      overflow: 'hidden',
      boxShadow: open
        ? '0 8px 30px rgba(107,58,42,0.12)'
        : '0 2px 8px rgba(107,58,42,0.06)',
      border: `1px solid ${allDone ? C.emerald + '40' : C.brownPale}`,
      transition: 'box-shadow .25s ease',
    }}>

      {/* ── Header famille ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14,
          borderBottom: open ? `1px solid ${C.brownPale}` : 'none',
          transition: 'background .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = C.brownPale + '60'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        {/* Numéro / check */}
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: allDone
            ? `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`
            : `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 900, color: 'white',
          boxShadow: `0 3px 10px ${allDone ? C.emerald : C.brown}40`,
        }}>
          {allDone ? '✓' : fi + 1}
        </div>

        {/* Titre + stats */}
        <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: 0, marginBottom: 6, lineHeight: 1.3 }}>
            {famille.titre}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ProgressBar value={pctFam} color={allDone ? C.emerald : C.brownLight} h={4}/>
            <span style={{
              fontSize: 11, fontWeight: 700, color: allDone ? C.emerald : C.brownLight,
              flexShrink: 0, minWidth: 36,
            }}>
              {pctFam}%
            </span>
          </div>
          <p style={{ fontSize: 11, color: C.textSec, margin: 0, marginTop: 4 }}>
            {doneFam}/{totalFam} unité{totalFam > 1 ? 's' : ''} terminée{doneFam > 1 ? 's' : ''}
          </p>
        </div>

        {/* Chevron */}
        <div style={{ flexShrink: 0, color: C.textSec, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>
          <ChevronDown size={18}/>
        </div>
      </button>

      {/* ── Unités ── */}
      {open && (
        <div>
          {(famille.unites || []).map((ua, ui) => {
            const status  = uaStatus(ua, progression)
            const isExam  = ua.type === 'exam'
            const active  = currentUaId === ua.id
            const isLast  = ui === (famille.unites || []).length - 1

            return (
              <button key={ua.id}
                onClick={() => status !== 'todo' && navigate(`/cours/${ua.id}`)}
                style={{
                  width: '100%', background: active
                    ? `linear-gradient(90deg, ${C.brownPale}, ${C.brownPale}80)`
                    : 'none',
                  border: 'none',
                  borderLeft: active ? `3px solid ${C.brown}` : '3px solid transparent',
                  borderBottom: !isLast ? `1px solid ${C.brownPale}` : 'none',
                  cursor: status === 'todo' ? 'default' : 'pointer',
                  padding: '14px 20px 14px 18px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  textAlign: 'left',
                  opacity: status === 'todo' ? 0.55 : 1,
                  transition: 'all .15s',
                }}
                onMouseEnter={e => { if (!active && status !== 'todo') e.currentTarget.style.background = C.brownPale + '70' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = active ? `linear-gradient(90deg, ${C.brownPale}, ${C.brownPale}80)` : 'none' }}
              >
                {/* Connecteur vertical (ligne de parcours) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, position: 'relative' }}>
                  <StatusIcon status={status} size={20}/>
                  {!isLast && (
                    <div style={{
                      position: 'absolute', top: 22, width: 2, height: 'calc(100% + 14px)',
                      background: status === 'done'
                        ? `linear-gradient(${C.emerald}, ${C.brownPale})`
                        : C.brownPale,
                      left: '50%', transform: 'translateX(-50%)',
                    }}/>
                  )}
                </div>

                {/* Contenu */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    {isExam && <Trophy size={13} color={C.gold}/>}
                    <p style={{
                      fontSize: 13, fontWeight: active ? 800 : status === 'done' ? 700 : 600,
                      color: active ? C.brown : C.text,
                      margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {ua.titre}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {ua.nb_exercices > 0 && (
                      <span style={{ fontSize: 11, color: C.textSec, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <BookOpen size={10}/> {ua.nb_exercices} exos
                      </span>
                    )}
                    {ua.duree_estimee > 0 && (
                      <span style={{ fontSize: 11, color: C.textSec, display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10}/> {ua.duree_estimee}min
                      </span>
                    )}
                  </div>
                </div>

                {/* Badge statut + flèche */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                  <StatusBadge status={status}/>
                  {status !== 'todo' && <ChevronRight size={14} color={C.brownLight}/>}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── ParcoursPage ──────────────────────────────────────────────────
export default function ParcoursPage({ onBack }) {
  const { user }   = useSelector(s => s.auth)
  const navigate   = useNavigate()
  const location   = useLocation()

  const [matieres,    setMatieres]    = useState([])
  const [modules,     setModules]     = useState([])  // modules de la matière sélectionnée
  const [familles,    setFamilles]    = useState([])
  const [progression, setProgression] = useState(null)
  const [selectedMat, setSelectedMat] = useState(null)
  const [selectedMod, setSelectedMod] = useState(null)
  const [loading,     setLoading]     = useState(true)

  const currentUaId = location.pathname.startsWith('/cours/')
    ? parseInt(location.pathname.split('/cours/')[1])
    : null

  // ── Chargement initial ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    async function init() {
      try {
        const [{ data: mat }, { data: prog }] = await Promise.all([
          api.get('/api/cours/matieres'),
          api.get(`/api/cours/progression/${user.id}`),
        ])
        setMatieres(mat)
        setProgression(prog)
        if (mat[0]) {
          setSelectedMat(mat[0])
          setModules(mat[0].modules || [])
          const firstMod = mat[0].modules?.[0]
          if (firstMod) {
            setSelectedMod(firstMod)
            const { data: fam } = await api.get(`/api/cours/modules/${firstMod.id}/familles`)
            setFamilles(fam)
          }
        }
      } catch {}
      finally { setLoading(false) }
    }
    init()
  }, [user?.id])

  // ── Changement de matière ───────────────────────────────────────
  async function handleSelectMatiere(mat) {
    setSelectedMat(mat)
    setFamilles([])
    const mods = mat.modules || []
    setModules(mods)
    const firstMod = mods[0]
    setSelectedMod(firstMod || null)
    if (firstMod) {
      try {
        const { data: fam } = await api.get(`/api/cours/modules/${firstMod.id}/familles`)
        setFamilles(fam)
      } catch {}
    }
  }

  // ── Changement de module ────────────────────────────────────────
  async function handleSelectModule(mod) {
    setSelectedMod(mod)
    setFamilles([])
    try {
      const { data: fam } = await api.get(`/api/cours/modules/${mod.id}/familles`)
      setFamilles(fam)
    } catch {}
  }

  // ── Stats globales ──────────────────────────────────────────────
  const totalDone  = familles.reduce((a, f) => a + (f.unites || []).filter(u => uaStatus(u, progression) === 'done').length, 0)
  const totalUnits = familles.reduce((a, f) => a + (f.unites || []).length, 0)
  const overallPct = totalUnits > 0 ? Math.round(totalDone / totalUnits * 100) : 0

  // ── Spinner ─────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', background: C.bg }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid ${C.brownPale}`, borderTopColor: C.brown, margin: '0 auto 14px', animation: 'spin 1s linear infinite' }}/>
        <p style={{ color: C.textSec, fontSize: 13, fontWeight: 600, margin: 0 }}>Chargement du parcours…</p>
      </div>
    </div>
  )

  return (
    <div style={{ background: C.bg, minHeight: '100vh', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* ══ HERO HEADER ══════════════════════════════════════════ */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brown} 0%, ${C.brownLight} 100%)`,
        padding: '28px 28px 24px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Motif de fond */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .05, pointerEvents: 'none' }}>
          <defs>
            <pattern id="grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1.5" fill="white"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>

        <div style={{ position: 'relative' }}>
          {/* Retour */}
          {onBack && (
            <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 10, padding: '6px 14px', cursor: 'pointer', color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, transition: 'all .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.15)'}
            >
              <ChevronLeft size={14}/> Retour
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Map size={18} color="white"/>
                </div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: 'white', margin: 0, letterSpacing: -.3 }}>Mon Parcours</h1>
              </div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', margin: 0, fontWeight: 500 }}>
                {selectedMat?.nom || 'Toutes les matières'} · {totalDone}/{totalUnits} unités terminées
              </p>
            </div>

            {/* Progression globale compacte */}
            <div style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 14, padding: '12px 18px', minWidth: 140 }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .8, margin: 0, marginBottom: 6 }}>Progression</p>
              <p style={{ fontSize: 28, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1 }}>{overallPct}<span style={{ fontSize: 14 }}>%</span></p>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.25)', borderRadius: 4, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 4, background: 'white', width: `${overallPct}%`, transition: 'width .8s ease' }}/>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ SÉLECTEURS ═══════════════════════════════════════════ */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.brownPale}`, padding: '0 28px' }}>

        {/* Ligne 1 : Matières (si plusieurs) */}
        {matieres.length > 1 && (
          <div style={{ borderBottom: `1px solid ${C.brownPale}`, padding: '12px 0' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 8px' }}>
              <BookMarked size={11} style={{ marginRight: 5, verticalAlign: 'middle' }}/>Matière
            </p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {matieres.map(mat => (
                <button key={mat.id} onClick={() => handleSelectMatiere(mat)} style={{
                  padding: '7px 18px', borderRadius: 22, border: 'none', cursor: 'pointer',
                  background: selectedMat?.id === mat.id
                    ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`
                    : C.brownPale,
                  color: selectedMat?.id === mat.id ? 'white' : C.textSec,
                  fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'all .2s',
                  boxShadow: selectedMat?.id === mat.id ? `0 3px 12px ${C.brown}40` : 'none',
                }}>
                  {mat.nom}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Ligne 2 : Modules / chapitres (si plusieurs) */}
        {modules.length > 1 && (
          <div style={{ padding: '12px 0' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 8px' }}>
              <Layers size={11} style={{ marginRight: 5, verticalAlign: 'middle' }}/>Module
            </p>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {modules.map(mod => (
                <button key={mod.id} onClick={() => handleSelectModule(mod)} style={{
                  padding: '7px 18px', borderRadius: 22, border: 'none', cursor: 'pointer',
                  background: selectedMod?.id === mod.id
                    ? `linear-gradient(135deg, ${C.gold}CC, ${C.gold})`
                    : C.brownPale,
                  color: selectedMod?.id === mod.id ? C.brown : C.textSec,
                  fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
                  transition: 'all .2s',
                  boxShadow: selectedMod?.id === mod.id ? `0 3px 10px ${C.gold}50` : 'none',
                }}>
                  {mod.titre || mod.nom || `Module ${mod.id}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══ CONTENU PARCOURS ═════════════════════════════════════ */}
      <div style={{ padding: '28px', maxWidth: 860, margin: '0 auto', animation: 'fadeIn .35s ease' }}>

        {familles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textSec }}>
            <BookOpen size={40} color={C.brownPale} style={{ marginBottom: 16 }}/>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.brown, margin: '0 0 8px' }}>Aucun contenu disponible</p>
            <p style={{ fontSize: 13, margin: 0 }}>Sélectionnez une matière ou un module pour voir le parcours.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {familles.map((famille, fi) => (
              <div key={famille.id} style={{ animation: `fadeIn .35s ease ${fi * 0.05}s both` }}>
                <FamilleCard
                  famille={famille}
                  fi={fi}
                  progression={progression}
                  currentUaId={currentUaId}
                  navigate={navigate}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}