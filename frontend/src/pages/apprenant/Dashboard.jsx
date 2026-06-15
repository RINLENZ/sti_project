import { useSelector } from 'react-redux'
import { useEffect, useState, useCallback, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { getCache, setCache } from '../../services/cache'
import toast from 'react-hot-toast'
import {
  BookOpen, Clock, ChevronRight, ChevronDown, Lock, PlayCircle,
  CheckCircle2, Copy, CheckCircle, Volume2, VolumeX, X, Sparkles,
  TrendingUp,
} from 'lucide-react'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { SkDashboard } from '../../components/Skeleton'
import { useOnlineRetry } from '../../hooks/useOnlineRetry'
import { useSound } from '../../hooks/useSound'
import { AdinkraSymbol } from '../../components/adinkra/AdinkraSymbols.jsx'
import { ADINKRA_BADGES, BADGES_BY_ID } from '../../constants/adinkraBadges'
import { notifyAdinkraBadge } from '../../components/adinkra/badgeToast.jsx'
const Alisha = lazy(() => import('../../components/Alisha'))

/* ─── Helpers ──────────────────────────────────────────────────── */
const UAStatus = (pct, C) => {
  if (pct === 100) return { icon: CheckCircle2, color: C.bogolanVert,   label: 'Terminé'      }
  if (pct > 0)     return { icon: PlayCircle,   color: C.bogolanOcre,   label: 'En cours'     }
  return                  { icon: Lock,          color: C.bogolanTextSec, label: 'Non commencé' }
}

const fmtDureeS = s => { if (!s) return '—'; const m = Math.floor(s / 60), sec = s % 60; return `${m}:${String(sec).padStart(2, '0')}` }
const fmtDate   = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : '—'

/* ─── Badges locaux (uniquement pour les toasts de milestone, inchangé) ── */
const buildBadges = stats => [
  { id: 'premier_pas',       emoji: '🚀', label: 'Premier pas',       unlocked: stats?.nb_tentatives >= 1   },
  { id: 'studieux',          emoji: '📚', label: 'Studieux',           unlocked: stats?.nb_tentatives >= 10  },
  { id: 'assidu',            emoji: '🔥', label: 'Assidu',             unlocked: stats?.nb_tentatives >= 50  },
  { id: 'expert',            emoji: '🏆', label: 'Expert',             unlocked: stats?.nb_tentatives >= 100 },
  { id: 'premiere_maitrise', emoji: '⭐', label: '1re maîtrise',       unlocked: stats?.nb_maitrisees >= 1   },
  { id: 'multi_maitre',      emoji: '💎', label: 'Multi-maître',       unlocked: stats?.nb_maitrisees >= 5   },
  { id: 'marathonien',       emoji: '⏱️', label: 'Marathonien',        unlocked: stats?.duree_totale_minutes >= 60  },
  { id: 'infatigable',       emoji: '🌙', label: 'Infatigable',        unlocked: stats?.duree_totale_minutes >= 300 },
  { id: 'precis',            emoji: '🎯', label: 'Précis',             unlocked: stats?.taux_reussite >= 80 && stats?.nb_tentatives >= 5  },
  { id: 'perfectionniste',   emoji: '✨', label: 'Parfait',            unlocked: stats?.taux_reussite >= 95 && stats?.nb_tentatives >= 10 },
  { id: 'regulier',          emoji: '📅', label: 'Régulier',           unlocked: stats?.nb_sessions >= 5  },
  { id: 'perseverant',       emoji: '💪', label: 'Persévérant',        unlocked: stats?.nb_sessions >= 20 },
]

/* ─── Sous-composants ──────────────────────────────────────────── */

/* Barre de progression Bogolan */
const ProgressBar = ({ value, color, h = 5, bg }) => {
  const { C } = useTheme()
  return (
    <div style={{ height: h, backgroundColor: bg ?? C.bogolanBorder, borderRadius: h, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(100, Math.max(0, value))}%`,
        backgroundColor: color ?? C.bogolanVert, borderRadius: h,
        transition: 'width .7s cubic-bezier(.4,0,.2,1)',
      }} />
    </div>
  )
}

/* ── Carte UA compacte (style Bogolan) ── */
const UACard = ({ ua, pct, isReco, onClick }) => {
  const { C } = useTheme()
  const st = UAStatus(pct, C)
  const StatusIcon = st.icon
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
        backgroundColor: isReco ? `${C.bogolanVert}10` : C.bogolanSurface,
        border: isReco ? `1.5px solid ${C.bogolanVert}55` : `1px solid ${C.bogolanBorder}`,
        transition: 'transform .2s ease, box-shadow .2s ease',
        boxShadow: hov ? `0 6px 18px ${C.bogolanTerre}1F` : 'none',
        transform: hov ? 'translateY(-2px)' : 'none',
      }}
    >
      <div style={{ flexShrink: 0 }}><StatusIcon size={16} color={st.color} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
          {isReco && <Sparkles size={10} color={C.bogolanVert} />}
          <span style={{ fontSize: 8, fontWeight: 700, color: C.bogolanOcre, textTransform: 'uppercase', letterSpacing: .5 }}>
            {ua.reference_ue}
          </span>
        </div>
        <p style={{
          fontSize: 12, fontWeight: 700, color: C.bogolanText, margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
        }}>{ua.titre}</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: C.bogolanTextSec }}>
            <Clock size={9} />{ua.duree_estimee}min
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, color: C.bogolanTextSec }}>
            <BookOpen size={9} />{ua.nb_exercices} exos
          </span>
        </div>
        {pct > 0 && pct < 100 && (
          <div style={{ marginTop: 5 }}><ProgressBar value={pct} color={C.bogolanTerre} h={3} /></div>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onClick() }}
        style={{
          flexShrink: 0, padding: '5px 10px',
          background: pct === 100
            ? `${C.bogolanVert}18`
            : isReco
            ? C.bogolanVert
            : C.bogolanTerre,
          color: pct === 100 ? C.bogolanVert : 'white',
          border: 'none', borderRadius: 8, fontSize: 10, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
          whiteSpace: 'nowrap',
        }}
      >
        {pct === 100 ? 'Revoir' : pct > 0 ? 'Continuer' : 'Commencer'}
        <ChevronRight size={10} />
      </button>
    </div>
  )
}

/* ── Famille collapsible ── */
const FamilleSection = ({ famille, progression, recommandee, navigate, defaultOpen }) => {
  const { C } = useTheme()
  const [open, setOpen] = useState(defaultOpen)
  const doneFam = (famille.unites || []).filter(ua => {
    const ex = (progression?.details || []).filter(d => d.correct && String(d.ua_id) === String(ua.id)).length
    return ua.nb_exercices > 0 && ex >= ua.nb_exercices
  }).length
  const totalFam = (famille.unites || []).length

  return (
    <div style={{ marginBottom: 6 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 8px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8,
        }}
      >
        <ChevronDown size={13} color={C.bogolanOcre} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s ease', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: C.bogolanTextSec, textAlign: 'left', flex: 1 }}>{famille.titre}</span>
        <span style={{ fontSize: 10, color: C.bogolanTextSec, flexShrink: 0, opacity: .7 }}>{doneFam}/{totalFam} UA</span>
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '2px 4px 4px 20px', animation: 'fadeIn .25s ease' }}>
          {(famille.unites || []).map(ua => {
            const exReussis = (progression?.details || []).filter(d => d.correct && String(d.ua_id) === String(ua.id)).length
            const pct = ua.nb_exercices > 0 ? Math.round(exReussis / ua.nb_exercices * 100) : 0
            return (
              <UACard
                key={ua.id}
                ua={ua}
                pct={pct}
                isReco={recommandee?.ua_id === ua.id}
                onClick={() => navigate(`/cours/${ua.id}`)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Module accordion (style Bogolan) ── */
const ModuleAccordion = ({ module, familles, progression, recommandee, navigate }) => {
  const { C } = useTheme()
  const totalUA = familles.reduce((a, f) => a + (f.unites || []).length, 0)
  const doneUA = familles.reduce((a, f) => a + (f.unites || []).filter(ua => {
    const ex = (progression?.details || []).filter(d => d.correct && String(d.ua_id) === String(ua.id)).length
    return ua.nb_exercices > 0 && ex >= ua.nb_exercices
  }).length, 0)
  const hasStarted = familles.some(f => (f.unites || []).some(ua => {
    const ex = (progression?.details || []).filter(d => String(d.ua_id) === String(ua.id)).length
    return ex > 0
  }))
  const pctModule = totalUA > 0 ? Math.round(doneUA / totalUA * 100) : 0
  const [open, setOpen] = useState(hasStarted || (familles.length > 0 && doneUA < totalUA))
  const progressColor = pctModule === 100 ? C.bogolanVert : pctModule > 0 ? C.bogolanTerre : C.bogolanBorder

  return (
    <div style={{
      backgroundColor: C.bogolanSurface, borderRadius: 16,
      border: `1px solid ${C.bogolanBorder}`, boxShadow: `0 2px 12px ${C.bogolanTerre}0D`,
      overflow: 'hidden', marginBottom: 10,
    }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', background: open ? `${C.bogolanBg}` : 'transparent',
          border: 'none', cursor: 'pointer', transition: 'background .15s',
        }}
      >
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: `linear-gradient(135deg, ${C.bogolanTerre}, ${C.bogolanOcre})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BookOpen size={17} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: C.bogolanText, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {module?.titre || `Module ${module?.numero || ''}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, maxWidth: 120 }}><ProgressBar value={pctModule} color={progressColor} h={4} /></div>
            <span style={{ fontSize: 10, color: C.bogolanTextSec, flexShrink: 0, fontWeight: 600 }}>{doneUA}/{totalUA} UA</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {pctModule === 100 && (
            <span style={{ background: `${C.bogolanVert}18`, color: C.bogolanVert, fontSize: 9, fontWeight: 800, padding: '3px 7px', borderRadius: 20 }}>Terminé</span>
          )}
          <ChevronDown size={15} color={C.bogolanOcre} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s ease' }} />
        </div>
      </button>
      {open && (
        <div style={{ padding: '8px 12px 12px', borderTop: `1px solid ${C.bogolanBorder}`, animation: 'fadeIn .25s ease' }}>
          {familles.length === 0 ? (
            <p style={{ fontSize: 12, color: C.bogolanTextSec, fontStyle: 'italic', padding: '8px 4px' }}>
              Aucune famille de situations — contenu en cours de préparation.
            </p>
          ) : (
            familles.map((famille, idx) => (
              <FamilleSection
                key={famille.id}
                famille={famille}
                progression={progression}
                recommandee={recommandee}
                navigate={navigate}
                defaultOpen={idx === 0 && hasStarted}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

/* ── Modal détail d'un symbole Adinkra ── */
const AdinkraModal = ({ badge, unlocked, onClose }) => {
  const { C } = useTheme()
  const color = unlocked ? C.bogolanTerre : C.bogolanLocked
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(44,24,16,0.55)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        animation: 'fadeIn .2s ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.bogolanSurface, borderRadius: 20, padding: '24px 22px',
          maxWidth: 360, width: '100%', position: 'relative',
          boxShadow: '0 20px 60px rgba(44,24,16,0.3)', animation: 'scaleIn .25s ease',
          border: `1px solid ${C.bogolanBorder}`,
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fermer"
          style={{ position: 'absolute', top: 12, right: 12, background: C.bogolanBg, border: 'none', borderRadius: 8, padding: 6, cursor: 'pointer', display: 'flex' }}
        >
          <X size={16} color={C.bogolanTextSec} />
        </button>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
          <div style={{ background: unlocked ? `${C.bogolanTerre}12` : C.bogolanBg, borderRadius: 18, padding: 18 }}>
            <AdinkraSymbol id={badge.id} size={84} color={color} animate />
          </div>
        </div>
        <h3 style={{ textAlign: 'center', fontSize: 18, fontWeight: 900, color: unlocked ? C.bogolanTerre : C.bogolanTextSec, margin: '0 0 4px' }}>
          {badge.nom}
        </h3>
        <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: C.bogolanTextSec, margin: '0 0 14px' }}>
          {unlocked ? '✓ Débloqué' : `🔒 ${badge.condition}`}
        </p>
        <p style={{ fontSize: 13, color: C.bogolanText, lineHeight: 1.6, margin: 0, fontStyle: 'italic', textAlign: 'center' }}>
          {badge.signification}
        </p>
        {unlocked && (
          <div style={{ marginTop: 14, textAlign: 'center', background: `${C.bogolanOcre}15`, borderRadius: 10, padding: '6px 0', fontSize: 12, fontWeight: 800, color: C.bogolanOcre }}>
            +{badge.xp_reward} XP
          </div>
        )}
      </div>
    </div>
  )
}

/* ── ZONE 3 : Ma collection Adinkra ── */
const AdinkraCollection = ({ unlockedSet, defaultOpen = true }) => {
  const { C } = useTheme()
  const { playSound } = useSound()
  const [open, setOpen]   = useState(defaultOpen)
  const [modal, setModal] = useState(null)
  const nbUnlocked = ADINKRA_BADGES.filter(b => unlockedSet.has(b.id)).length

  return (
    <div style={{ backgroundColor: C.bogolanSurface, borderRadius: 16, border: `1px solid ${C.bogolanBorder}`, boxShadow: `0 2px 10px ${C.bogolanTerre}0D`, marginBottom: 14, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <AdinkraSymbol id="adinkrahene" size={20} color={C.bogolanTerre} />
        <h3 style={{ fontSize: 13, fontWeight: 800, color: C.bogolanText, margin: 0, flex: 1, textAlign: 'left' }}>Ma collection Adinkra</h3>
        <span style={{ fontSize: 11, fontWeight: 800, color: nbUnlocked > 0 ? C.bogolanTerre : C.bogolanTextSec }}>{nbUnlocked}/{ADINKRA_BADGES.length}</span>
        <ChevronDown size={15} color={C.bogolanOcre} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s ease' }} />
      </button>
      {open && (
        <div style={{ padding: '4px 14px 16px', animation: 'fadeIn .25s ease' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
            {ADINKRA_BADGES.map(badge => {
              const unlocked = unlockedSet.has(badge.id)
              return (
                <button
                  key={badge.id}
                  onClick={() => { playSound('resume'); setModal({ badge, unlocked }) }}
                  onMouseEnter={() => playSound('resume')}
                  title={badge.nom}
                  aria-label={`${badge.nom} — ${unlocked ? 'débloqué' : 'verrouillé'}`}
                  style={{
                    aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: unlocked ? `${C.bogolanTerre}10` : C.bogolanBg,
                    border: `1.5px solid ${unlocked ? `${C.bogolanTerre}40` : C.bogolanBorder}`,
                    borderRadius: 12, cursor: 'pointer', padding: 6,
                    transition: 'transform .18s ease, box-shadow .18s ease',
                  }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 12px ${C.bogolanTerre}25` }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
                >
                  <AdinkraSymbol id={badge.id} size="100%" color={unlocked ? C.bogolanTerre : C.bogolanLocked} />
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: 10, color: C.bogolanTextSec, textAlign: 'center', margin: '12px 0 0', fontStyle: 'italic' }}>
            Touche un symbole pour découvrir sa signification.
          </p>
        </div>
      )}
      {modal && <AdinkraModal badge={modal.badge} unlocked={modal.unlocked} onClose={() => setModal(null)} />}
    </div>
  )
}

/* ── ZONE 3 : Sessions récentes (accordéon) ── */
const SidebarSessions = ({ sessions, defaultOpen = true }) => {
  const { C } = useTheme()
  const [open, setOpen] = useState(defaultOpen)
  const [expanded, setExpanded] = useState(false)
  const PREVIEW = 3
  const affectifEmoji = { positif: '😊', neutre: '😐', negatif: '😟', frustre: '😤', confus: '🤔' }
  const visible = sessions ? (expanded ? sessions : sessions.slice(0, PREVIEW)) : []

  return (
    <div style={{ backgroundColor: C.bogolanSurface, borderRadius: 16, border: `1px solid ${C.bogolanBorder}`, boxShadow: `0 2px 10px ${C.bogolanTerre}0D`, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer' }}
      >
        <TrendingUp size={15} color={C.bogolanIndigo} />
        <h3 style={{ fontSize: 13, fontWeight: 800, color: C.bogolanText, margin: 0, flex: 1, textAlign: 'left' }}>Sessions récentes</h3>
        {sessions && sessions.length > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: C.bogolanTextSec }}>{sessions.length}</span>}
        <ChevronDown size={15} color={C.bogolanOcre} style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s ease' }} />
      </button>
      {open && (
        <div style={{ padding: '2px 14px 14px', animation: 'fadeIn .25s ease' }}>
          {sessions === null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[0,1,2].map(i => <div key={i} style={{ height: 42, borderRadius: 10, background: C.bogolanBg, animation: 'pulse 1.5s infinite' }}/>)}
            </div>
          ) : sessions.length === 0 ? (
            <p style={{ fontSize: 11, color: C.bogolanTextSec, textAlign: 'center', padding: '8px 0', margin: 0 }}>Aucune session complétée pour l'instant</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {visible.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 10, background: C.bogolanBg, border: `1px solid ${C.bogolanBorder}` }}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `${C.bogolanIndigo}15`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <BookOpen size={12} color={C.bogolanIndigo} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.bogolanText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.cours_titre}</p>
                      <p style={{ margin: 0, fontSize: 9, color: C.bogolanTextSec }}>{fmtDate(s.ended_at)} · ⏱ {fmtDureeS(s.duree_secondes)}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, flexShrink: 0 }}>
                      {s.score_final !== null && (
                        <span style={{ fontSize: 11, fontWeight: 900, color: s.score_final >= 70 ? C.bogolanVert : s.score_final >= 50 ? C.bogolanOcre : '#C0392B' }}>{s.score_final}%</span>
                      )}
                      <span style={{ fontSize: 12 }}>{affectifEmoji[s.etat_affectif] || ''}</span>
                    </div>
                  </div>
                ))}
              </div>
              {sessions.length > PREVIEW && (
                <button
                  onClick={() => setExpanded(e => !e)}
                  style={{ width: '100%', marginTop: 8, padding: '5px 0', background: C.bogolanBg, border: `1px solid ${C.bogolanBorder}`, borderRadius: 8, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: C.bogolanOcre, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                >
                  <ChevronDown size={11} style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }} />
                  {expanded ? 'Réduire' : `Voir les ${sessions.length - PREVIEW} autres`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Anneau de niveau (hero) — niveau au centre, progression XP autour ── */
const LevelRing = ({ niveau = 1, pct = 0, size = 58 }) => {
  const r = (size - 7) / 2
  const circ = 2 * Math.PI * r
  const off = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={5} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="white" strokeWidth={5}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 17, fontWeight: 900, color: 'white', lineHeight: 1 }}>{niveau}</span>
        <span style={{ fontSize: 7, color: 'rgba(255,255,255,0.65)', fontWeight: 800, letterSpacing: .5 }}>NIV.</span>
      </div>
    </div>
  )
}

/* ─── Dashboard principal ──────────────────────────────────────── */
export default function Dashboard() {
  const { C } = useTheme()
  const { user }  = useSelector(s => s.auth)
  const navigate  = useNavigate()
  const { xs, mobile } = useBreakpoint()
  const { playSound, isMuted, toggleMute } = useSound()

  const [matieres,        setMatieres]        = useState([])
  const [modulesFamilles, setModulesFamilles] = useState([])
  const [matActive,       setMatActive]       = useState(null)
  const [progression,     setProgression]     = useState(null)
  const [recommandee,     setRecommandee]     = useState(null)
  const [stats,           setStats]           = useState(null)
  const [gamif,           setGamif]           = useState(null)   // niveau, xp, streak, badges
  const [sessions,        setSessions]        = useState(null)
  const [adinkraUnlocked, setAdinkraUnlocked] = useState(new Set())
  const [loading,         setLoading]         = useState(true)
  const [copied,          setCopied]          = useState(false)
  const retryKey = useOnlineRetry()

  const loadModulesPourMatiere = useCallback(async (mat) => {
    const grouped = await Promise.all(
      (mat.modules || []).map(async (mod) => {
        try {
          const { data: fam } = await api.get(`/api/cours/modules/${mod.id}/familles?user_id=${user.id}`)
          return { module: mod, familles: fam }
        } catch {
          return { module: mod, familles: [] }
        }
      })
    )
    setModulesFamilles(grouped)
    return grouped
  }, [user.id])

  useEffect(() => {
    async function load() {
      const cacheKey = `dashboard_${user.id}`
      const cached = getCache(cacheKey)
      if (cached) {
        setMatieres(cached.matieres)
        setProgression(cached.progression)
        setRecommandee(cached.recommandee)
        setStats(cached.stats)
        setSessions(cached.sessions)
        setMatActive(cached.matieres[0] || null)
        setModulesFamilles(cached.modulesFamilles)
        setGamif(cached.gamif || null)
        if (cached.adinkraUnlocked) setAdinkraUnlocked(new Set(cached.adinkraUnlocked))
        setLoading(false)
        return
      }
      try {
        // ── Toutes les requêtes en parallèle (allSettled : robustes aux échecs) ──
        const niveauQuery = user.niveau_id ? '?niveau_id=' + user.niveau_id : ''
        const [
          matieresRes,
          progressionRes,
          recommandeeRes,
          statsRes,
          sessionsRes,
          gamifStatsRes,
        ] = await Promise.allSettled([
          api.get(`/api/cours/matieres${niveauQuery}`),
          api.get(`/api/cours/progression/${user.id}`),
          api.get(`/api/cours/ua/recommandee/${user.id}`),
          api.get(`/api/bkt/apprenant/${user.id}/stats`),
          api.get(`/api/bkt/apprenant/${user.id}/sessions?limit=8`),
          api.get(`/api/gamification/stats/${user.id}`),
        ])

        const dataOf = (res, fallback = null) => res.status === 'fulfilled' ? res.value.data : fallback

        const matieresData = dataOf(matieresRes, [])
        setMatieres(matieresData)
        if (matieresRes.status === 'rejected') throw matieresRes.reason

        let modulesFamillesData = []
        let modulesPromise = Promise.resolve([])
        if (matieresData.length > 0) {
          setMatActive(matieresData[0])
          modulesPromise = loadModulesPourMatiere(matieresData[0])
        }

        const prog = dataOf(progressionRes)
        setProgression(prog)

        const recoRaw = dataOf(recommandeeRes)
        const recoData = recoRaw?.recommandee || null
        setRecommandee(recoData)

        const statsData = dataOf(statsRes)
        if (statsData) {
          setStats(statsData)
          // Détection unlock badge local (toast milestone — inchangé)
          const storageKey = `sti_badges_${user.id}`
          const prevUnlocked = new Set(JSON.parse(localStorage.getItem(storageKey) || '[]'))
          const nowUnlocked  = buildBadges(statsData).filter(b => b.unlocked).map(b => b.id)
          nowUnlocked.forEach(id => {
            if (!prevUnlocked.has(id)) {
              const badge = buildBadges(statsData).find(b => b.id === id)
              if (badge) toast(`${badge.emoji} Badge débloqué : ${badge.label} !`, { duration: 4000, icon: '🎉' })
            }
          })
          localStorage.setItem(storageKey, JSON.stringify(nowUnlocked))
          // Milestone streak
          const s = statsData.streak_jours
          const milestoneKey = `sti_streak_milestone_${user.id}_${s}`
          if ([3, 7, 14, 30].includes(s) && !localStorage.getItem(milestoneKey)) {
            const msgs = { 3: '3 jours de suite ! Belle régularité 🔥', 7: '1 semaine consécutive ! Tu es en feu 🔥🔥', 14: '2 semaines ! Tu es inarrêtable 🔥🔥🔥', 30: 'Un mois entier ! Légendaire 🏆' }
            toast(msgs[s], { duration: 5000, icon: '🔥' })
            localStorage.setItem(milestoneKey, '1')
          }
        }

        const sessionsData = dataOf(sessionsRes)
        setSessions(sessionsData)

        // ── Gamification (niveau/XP/streak + badges Adinkra) ──
        const gamifData = dataOf(gamifStatsRes)
        setGamif(gamifData)
        const unlockedIds = gamifData?.badges || []
        const unlockedSet = new Set(unlockedIds)
        setAdinkraUnlocked(unlockedSet)
        // Détection nouveau symbole Adinkra → toast + cloche douce
        const adkKey = `alisha_adinkra_${user.id}`
        const prevAdk = new Set(JSON.parse(localStorage.getItem(adkKey) || '[]'))
        const isFirstLoad = !localStorage.getItem(adkKey)
        unlockedIds.forEach(id => {
          if (!isFirstLoad && !prevAdk.has(id)) {
            const meta = BADGES_BY_ID[id]
            if (meta) { notifyAdinkraBadge(id); playSound('unlockBadge') }
          }
        })
        localStorage.setItem(adkKey, JSON.stringify(unlockedIds))

        modulesFamillesData = await modulesPromise

        setCache(cacheKey, {
          matieres:        matieresData,
          modulesFamilles: modulesFamillesData,
          progression:     prog,
          recommandee:     recoData,
          stats:           statsData,
          gamif:           gamifData,
          sessions:        sessionsData,
          adinkraUnlocked: unlockedIds,
        })
      } catch {
        toast.error('Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user.id, loadModulesPourMatiere, retryKey])  // eslint-disable-line react-hooks/exhaustive-deps

  async function selectMatiere(mat) {
    setMatActive(mat)
    setModulesFamilles([])
    await loadModulesPourMatiere(mat)
  }

  function copyCode() {
    navigator.clipboard.writeText(user?.code_invitation || '')
    setCopied(true); toast.success('Code copié !')
    setTimeout(() => setCopied(false), 2000)
  }

  function resumeLast() {
    if (!recommandee) return
    playSound('resume')
    navigate(`/tutoriel/${recommandee.ua_id}`)
  }

  if (loading) return <SkDashboard xs={xs} mobile={mobile} />

  const pad = xs ? 12 : mobile ? 16 : 24

  // Données gamification (niveau / XP / streak / badges) — affichées UNE seule fois.
  const niveau   = gamif?.niveau ?? 1
  const xpDans   = gamif?.xp_dans_niveau ?? 0
  const xpProch  = gamif?.xp_pour_prochain ?? 100
  const xpPct    = xpProch > 0 ? Math.round((xpDans / xpProch) * 100) : 100
  const streak   = gamif?.streak_jours ?? 0
  const nbBadges = (gamif?.badges || []).length
  const continueAction = recommandee ? resumeLast : () => navigate('/parcours')

  // Ligne de stats compacte (sous le prénom)
  const statsLine = [
    user?.niveau_label || 'Apprenant',
    `${xpDans}/${xpProch} XP`,
    streak > 0 ? `🔥 ${streak} j` : null,
    `⬡ ${nbBadges}/${ADINKRA_BADGES.length}`,
  ].filter(Boolean).join('  ·  ')

  /* ════════════════════════════════════════════════════════════════
     ZONE 1 (MOBILE) — HERO épuré : identité + stats sur une seule ligne
     (la carte de reprise descend dans « Mes cours »)
     ════════════════════════════════════════════════════════════════ */
  const Zone1Mobile = (
    <div style={{
      background: `linear-gradient(140deg, #5E2F0E 0%, ${C.bogolanTerre} 55%, ${C.bogolanOcre} 100%)`,
      borderRadius: xs ? 16 : 20, color: 'white',
      padding: xs ? '12px 14px' : '16px 22px', marginBottom: xs ? 12 : 16,
      position: 'relative', overflow: 'hidden', animation: 'fadeUp .4s ease',
    }}>
      {/* Motif Adinkra en filigrane */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .06, pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          <pattern id="adk-zone1" x="0" y="0" width="56" height="56" patternUnits="userSpaceOnUse">
            <circle cx="28" cy="28" r="11" fill="none" stroke="white" strokeWidth="1.5" />
            <circle cx="28" cy="28" r="5"  fill="none" stroke="white" strokeWidth="1.5" />
            <line x1="28" y1="17" x2="28" y2="11" stroke="white" strokeWidth="1.5" />
            <line x1="17" y1="28" x2="11" y2="28" stroke="white" strokeWidth="1.5" />
            <line x1="39" y1="28" x2="45" y2="28" stroke="white" strokeWidth="1.5" />
            <line x1="28" y1="39" x2="28" y2="45" stroke="white" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#adk-zone1)" />
      </svg>

      {/* Une seule ligne : niveau · identité+stats · actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
        <LevelRing niveau={niveau} pct={xpPct} size={xs ? 42 : 50} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: xs ? 16 : 20, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1, letterSpacing: -.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Bonjour {user?.prenom || ''}
          </h1>
          <p style={{ fontSize: xs ? 10.5 : 12, color: 'rgba(255,255,255,0.78)', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {statsLine}
          </p>
        </div>

        {/* Actions : live · son · code */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => navigate('/live/rejoindre')}
            aria-label="Rejoindre une session live"
            title="Rejoindre un live"
            style={{ width: 36, height: 36, borderRadius: 11, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            🔴
          </button>
          <button
            onClick={toggleMute}
            aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
            title={isMuted ? 'Activer le son' : 'Couper le son'}
            style={{ width: 36, height: 36, borderRadius: 11, border: '1px solid rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.16)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            {isMuted ? <VolumeX size={17} color="rgba(255,255,255,0.6)" /> : <Volume2 size={17} color="white" />}
          </button>
          {user?.code_invitation && !xs && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.2)', borderRadius: 11, padding: '7px 11px', flexShrink: 0 }}>
              {!mobile && <span style={{ fontSize: 9, fontWeight: 700, opacity: .6, textTransform: 'uppercase', letterSpacing: .6 }}>Code</span>}
              <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: 2 }}>{user.code_invitation}</span>
              <button onClick={copyCode} aria-label="Copier le code tuteur" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', padding: 0 }}>
                {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Code tuteur sur très petit écran : ligne dédiée discrète */}
      {user?.code_invitation && xs && (
        <div style={{ position: 'relative', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.18)', borderRadius: 10, padding: '6px 10px' }}>
          <span style={{ fontSize: 9, opacity: .6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .6 }}>Code tuteur</span>
          <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1.5 }}>{user.code_invitation}</span>
          <button onClick={copyCode} aria-label="Copier le code tuteur" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'white', display: 'flex', padding: 0 }}>
            {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
          </button>
        </div>
      )}
    </div>
  )

  /* ════════════════════════════════════════════════════════════════
     ZONE 1 (DESKTOP) — HERO complet : identité + stats + carte reprise
     (comportement d'origine, conservé tel quel sur grand écran)
     ════════════════════════════════════════════════════════════════ */
  const Zone1Desktop = (
    <div style={{
      background: `linear-gradient(140deg, #5E2F0E 0%, ${C.bogolanTerre} 55%, ${C.bogolanOcre} 100%)`,
      borderRadius: 22, color: 'white', padding: '22px 26px', marginBottom: 18,
      position: 'relative', overflow: 'hidden', animation: 'fadeUp .4s ease',
    }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .06, pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          <pattern id="adk-zone1d" x="0" y="0" width="56" height="56" patternUnits="userSpaceOnUse">
            <circle cx="28" cy="28" r="11" fill="none" stroke="white" strokeWidth="1.5" />
            <circle cx="28" cy="28" r="5"  fill="none" stroke="white" strokeWidth="1.5" />
            <line x1="28" y1="17" x2="28" y2="11" stroke="white" strokeWidth="1.5" />
            <line x1="17" y1="28" x2="11" y2="28" stroke="white" strokeWidth="1.5" />
            <line x1="39" y1="28" x2="45" y2="28" stroke="white" strokeWidth="1.5" />
            <line x1="28" y1="39" x2="28" y2="45" stroke="white" strokeWidth="1.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#adk-zone1d)" />
      </svg>

      {/* Ligne 1 : identité + niveau + code + son */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', flexWrap: 'wrap' }}>
        <LevelRing niveau={niveau} pct={xpPct} size={58} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'white', margin: 0, lineHeight: 1.1, letterSpacing: -.4 }}>
            Bonjour {user?.prenom || ''}
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', margin: '4px 0 0' }}>
            {user?.niveau_label || 'Prêt à apprendre ?'} · {xpDans}/{xpProch} XP
          </p>
        </div>

        {user?.code_invitation && (
          <div style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(8px)', borderRadius: 12, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.18)', flexShrink: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 700, opacity: .6, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: .8 }}>Code tuteur</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 900, letterSpacing: 2.5 }}>{user.code_invitation}</span>
              <button onClick={copyCode} aria-label="Copier le code tuteur" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, padding: '4px 5px', cursor: 'pointer', color: 'white', display: 'flex' }}>
                {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        )}

        <button
          onClick={toggleMute}
          aria-label={isMuted ? 'Activer le son' : 'Couper le son'}
          title={isMuted ? 'Activer le son' : 'Couper le son'}
          style={{ flexShrink: 0, width: 38, height: 38, borderRadius: 11, background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.22)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          {isMuted ? <VolumeX size={18} color="rgba(255,255,255,0.6)" /> : <Volume2 size={18} color="white" />}
        </button>
      </div>

      {/* Ligne 2 : chips stats */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 12, position: 'relative' }}>
        {streak > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 22, padding: '5px 12px' }}>
            <span style={{ fontSize: 13 }}>🔥</span>
            <span style={{ fontSize: 12, fontWeight: 800 }}>{streak} jour{streak > 1 ? 's' : ''}</span>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.18)', borderRadius: 22, padding: '5px 12px' }}>
          <AdinkraSymbol id="adinkrahene" size={14} color="white" />
          <span style={{ fontSize: 12, fontWeight: 800 }}>{nbBadges}/{ADINKRA_BADGES.length} symboles</span>
        </div>
      </div>

      {/* Ligne 3 : carte "Reprendre" (Alisha + ZPD + CTA) */}
      <div style={{ marginTop: 16, position: 'relative', background: C.bogolanSurface, borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 30px rgba(0,0,0,0.18)' }}>
        <div style={{ flexShrink: 0, marginBottom: -6 }}>
          <Suspense fallback={<div style={{ width: 50, height: 60 }} />}>
            <Alisha state={recommandee ? 'question' : 'idle'} size={50} />
          </Suspense>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${C.bogolanVert}1A`, color: C.bogolanVert, fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>
            <Sparkles size={9} /> {recommandee ? 'Recommandé · ZPD' : 'Continue ton parcours'}
          </span>
          <p style={{ fontSize: 14, fontWeight: 800, color: C.bogolanText, margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {recommandee ? recommandee.titre : 'Explore tes cours'}
          </p>
          {recommandee?.score_bkt != null && (
            <p style={{ fontSize: 11, color: C.bogolanTextSec, margin: '3px 0 0' }}>
              Maîtrise actuelle : {Math.round(recommandee.score_bkt * 100)}%
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={continueAction}
            aria-label="Continuer l'apprentissage"
            style={{ padding: '11px 20px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${C.bogolanVert}, #3C6749)`, color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', boxShadow: `0 4px 14px ${C.bogolanVert}45`, animation: 'breath 3s ease-in-out infinite' }}
          >
            <PlayCircle size={17} /> Continuer
          </button>
          <button
            onClick={() => navigate('/live/rejoindre')}
            aria-label="Rejoindre une session live"
            title="Rejoindre un live"
            style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, border: `1.5px solid ${C.bogolanIndigo}33`, background: `${C.bogolanIndigo}0D`, color: C.bogolanIndigo, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            🔴
          </button>
        </div>
      </div>
    </div>
  )

  const Zone1 = mobile ? Zone1Mobile : Zone1Desktop

  /* Carte de reprise (Alisha + ZPD) — utilisée en tête de « Mes cours » sur mobile uniquement */
  const RecoCard = (
    <div style={{
      background: `linear-gradient(135deg, ${C.bogolanVert}14, ${C.bogolanSurface})`,
      borderRadius: 16, border: `1.5px solid ${C.bogolanVert}40`,
      padding: xs ? '12px' : '14px 16px', marginBottom: 14,
      display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
      animation: 'fadeUp .45s ease',
    }}>
      <div style={{ flexShrink: 0, marginBottom: -6 }}>
        <Suspense fallback={<div style={{ width: 50, height: 60 }} />}>
          <Alisha state={recommandee ? 'question' : 'idle'} size={50} />
        </Suspense>
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: `${C.bogolanVert}1A`, color: C.bogolanVert, fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20, marginBottom: 5, textTransform: 'uppercase', letterSpacing: .5 }}>
          <Sparkles size={9} /> {recommandee ? 'Recommandé · ZPD' : 'Continue ton parcours'}
        </span>
        <p style={{ fontSize: 14, fontWeight: 800, color: C.bogolanText, margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {recommandee ? recommandee.titre : 'Explore tes cours'}
        </p>
        {recommandee?.score_bkt != null && (
          <p style={{ fontSize: 11, color: C.bogolanTextSec, margin: '3px 0 0' }}>
            Maîtrise actuelle : {Math.round(recommandee.score_bkt * 100)}%
          </p>
        )}
      </div>
      <button
        onClick={continueAction}
        aria-label="Continuer l'apprentissage"
        style={{
          padding: '11px 20px', borderRadius: 12, border: 'none',
          flex: mobile ? 1 : 'none',
          background: `linear-gradient(135deg, ${C.bogolanVert}, #3C6749)`,
          color: 'white', fontWeight: 800, fontSize: 14, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, whiteSpace: 'nowrap',
          boxShadow: `0 4px 14px ${C.bogolanVert}45`,
          animation: 'breath 3s ease-in-out infinite',
        }}
      >
        <PlayCircle size={17} /> Continuer
      </button>
    </div>
  )

  /* ════════════════════════════════════════════════════════════════
     ZONE 2 — CŒUR : Mes cours
     ════════════════════════════════════════════════════════════════ */
  const CoursList = (
    <div style={{ animation: 'fadeUp .55s ease' }}>
      {modulesFamilles.map(({ module, familles }) => (
        <ModuleAccordion
          key={module.id}
          module={module}
          familles={familles}
          progression={progression}
          recommandee={recommandee}
          navigate={navigate}
        />
      ))}
      {modulesFamilles.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: C.bogolanTextSec }}>
          <BookOpen size={32} color={C.bogolanBorder} style={{ margin: '0 auto 10px' }} />
          <p style={{ fontSize: 13, fontWeight: 600 }}>Aucun cours disponible pour ce niveau</p>
        </div>
      )}
    </div>
  )

  const Zone2 = (
    <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
      {/* Carte de reprise (avec Alisha) en tête — mobile uniquement
          (sur desktop elle reste dans le hero) */}
      {mobile && RecoCard}

      {/* Titre + sélecteur matière */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <BookOpen size={15} color={C.bogolanTerre} />
        <h2 style={{ fontSize: 14, fontWeight: 800, color: C.bogolanText, margin: 0 }}>Mes cours</h2>
        <span style={{ fontSize: 10, color: C.bogolanTextSec, fontWeight: 600 }}>
          {modulesFamilles.length} module{modulesFamilles.length > 1 ? 's' : ''}
        </span>
        <button
          onClick={() => navigate('/parcours')}
          style={{
            marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: C.bogolanTerre,
            background: `${C.bogolanTerre}12`, border: 'none', borderRadius: 10,
            padding: '5px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          📊 Carte de progression
        </button>
      </div>

      {matieres.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 }}>
          {matieres.map(mat => {
            const active = matActive?.id === mat.id
            return (
              <button key={mat.id} onClick={() => selectMatiere(mat)} style={{
                padding: '6px 14px', borderRadius: 20,
                border: `2px solid ${active ? C.bogolanTerre : C.bogolanBorder}`,
                background: active ? C.bogolanTerre : C.bogolanSurface,
                color: active ? 'white' : C.bogolanTextSec,
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                whiteSpace: 'nowrap', transition: 'all .2s',
              }}>
                {mat.icone || '📚'} {mat.nom}
              </button>
            )
          })}
        </div>
      )}

      {CoursList}
    </div>
  )

  /* ════════════════════════════════════════════════════════════════
     ZONE 3 — SIDEBAR : Collection Adinkra + Sessions récentes
     ════════════════════════════════════════════════════════════════ */
  const Zone3 = (
    <div style={{ width: mobile ? '100%' : 280, flexShrink: 0, minWidth: 0, animation: 'fadeUp .5s ease' }}>
      <AdinkraCollection unlockedSet={adinkraUnlocked} />
      <SidebarSessions sessions={sessions} />
    </div>
  )

  /* ── RENDER ── */
  return (
    <div style={{ background: C.bogolanBg, minHeight: '100vh', padding: `${pad}px`, boxSizing: 'border-box', maxWidth: '100vw', overflowX: 'hidden' }}>
      <style>{`
        button:focus-visible { outline: 2px solid ${C.bogolanVert}; outline-offset: 2px; }
      `}</style>

      {Zone1}

      <div style={{ display: 'flex', gap: mobile ? 0 : 20, flexDirection: mobile ? 'column' : 'row', alignItems: 'flex-start' }}>
        {Zone2}
        <div style={{ width: mobile ? '100%' : 'auto', marginTop: mobile ? 16 : 0 }}>
          {Zone3}
        </div>
      </div>
    </div>
  )
}
