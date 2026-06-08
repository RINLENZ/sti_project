/**
 * Page /achievements — Succès & badges Adinkra.
 * Affiche les 10 badges (obtenus en couleur, locked en grisé)
 * avec progression XP, niveau, streak.
 */
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import api from '../../services/api'
import { ADINKRA_BADGES } from '../../constants/adinkraBadges'
import { Spinner } from '../../components/Skeleton'
import { Trophy, ArrowLeft, Zap, Flame, Target } from 'lucide-react'

function labelNiveau(n) {
  if (n >= 10) return 'Légende'
  if (n >= 7)  return 'Expert'
  if (n >= 5)  return 'Confirmé'
  if (n >= 3)  return 'Intermédiaire'
  return 'Débutant'
}

function XPRing({ pct, niveau, C, size = 88 }) {
  const r    = size / 2 - 8
  const circ = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={7}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={`url(#xp-grad-${size})`} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .9s cubic-bezier(.22,1,.36,1)' }}
        />
        <defs>
          <linearGradient id={`xp-grad-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={C.gold}/>
            <stop offset="100%" stopColor={C.accent}/>
          </linearGradient>
        </defs>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: size > 70 ? 20 : 14, fontWeight: 900, color: C.gold, lineHeight: 1 }}>{niveau}</span>
        <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 600 }}>niv.</span>
      </div>
    </div>
  )
}

function BadgeCard({ badge, unlocked, C, mobile }) {
  const [hovered, setHovered] = useState(false)
  const [showInfo, setShowInfo] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => setShowInfo(v => !v)}
      style={{
        borderRadius:  16,
        border:        `2px solid ${unlocked ? badge.couleur + '55' : C.border}`,
        background:    unlocked
          ? `linear-gradient(135deg, ${badge.couleur}12, ${badge.couleur}05)`
          : C.surface,
        padding:       mobile ? '14px 12px' : '18px 16px',
        cursor:        'pointer',
        transition:    'all .2s ease',
        transform:     hovered ? 'translateY(-2px)' : 'none',
        boxShadow:     unlocked && hovered ? `0 6px 24px ${badge.couleur}30` : 'none',
        display:       'flex',
        flexDirection: 'column',
        gap:           10,
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      {/* Symbole */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          fontSize:   36,
          filter:     unlocked ? 'none' : 'grayscale(1) opacity(0.35)',
          flexShrink: 0,
          lineHeight: 1,
        }}>
          {badge.symbole}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin:     0,
            fontSize:   13,
            fontWeight: 900,
            color:      unlocked ? badge.couleur : C.textMuted,
            lineHeight: 1.2,
          }}>{badge.nom}</p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: C.textSec, lineHeight: 1.4 }}>
            {badge.description}
          </p>
        </div>
        {unlocked && (
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            background: `linear-gradient(135deg, ${badge.couleur}, ${badge.couleur}99)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 10, color: 'white', fontWeight: 900 }}>✓</span>
          </div>
        )}
      </div>

      {/* Condition */}
      <div style={{
        background:   unlocked ? `${badge.couleur}18` : C.brownPale,
        borderRadius: 8,
        padding:      '5px 10px',
        fontSize:     11,
        fontWeight:   700,
        color:        unlocked ? badge.couleur : C.textMuted,
        display:      'flex',
        alignItems:   'center',
        gap:          5,
      }}>
        <Target size={10}/> {badge.condition}
      </div>

      {/* Info signification (toggle) */}
      {showInfo && (
        <div style={{
          fontSize:     11,
          color:        C.textSec,
          lineHeight:   1.6,
          padding:      '8px 10px',
          background:   C.brownPale,
          borderRadius: 8,
          animation:    'fadeIn .15s ease',
          fontStyle:    'italic',
        }}>
          {badge.signification}
        </div>
      )}

      {/* Badge XP reward */}
      {unlocked && (
        <div style={{
          position:   'absolute',
          top:        10,
          right:      10,
          background: `linear-gradient(135deg, ${C.gold}, ${C.accent})`,
          color:      'white',
          fontSize:   9,
          fontWeight: 900,
          padding:    '2px 6px',
          borderRadius: 10,
        }}>
          +{badge.xp_reward} XP
        </div>
      )}
    </div>
  )
}

export default function Achievements() {
  const { C }       = useTheme()
  const { user }    = useSelector(s => s.auth)
  const navigate    = useNavigate()
  const { mobile }  = useBreakpoint()
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) return
    api.get(`/api/gamification/stats/${user.id}`)
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id])

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <Spinner size={40}/>
    </div>
  )

  const badgesUnlocked = stats?.badges || []
  const { niveau = 1, xp_dans_niveau = 0, xp_pour_prochain = 100,
          streak_jours = 0, total_sessions = 0, total_exercices = 0,
          total_corrects = 0, duree_totale_min = 0, nb_maitrisees = 0, xp = 0 } = stats || {}
  const pct = xp_pour_prochain > 0 ? Math.round((xp_dans_niveau / xp_pour_prochain) * 100) : 100
  const taux = total_exercices > 0 ? Math.round(total_corrects / total_exercices * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: C.bg, fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brownDark}, ${C.brown})`,
        padding:    mobile ? '20px 16px' : '28px 32px',
        color:      'white',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'rgba(255,255,255,.15)', border: 'none', borderRadius: 10, padding: '8px 12px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700 }}>
            <ArrowLeft size={14}/> Retour
          </button>
          <h1 style={{ margin: 0, fontSize: mobile ? 18 : 22, fontWeight: 900, flex: 1 }}>
            Mes Succès
          </h1>
          <Trophy size={24} color={C.gold}/>
        </div>

        {/* Stats hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <XPRing pct={pct} niveau={niveau} C={C} size={mobile ? 72 : 88}/>
          <div style={{ flex: 1, minWidth: 200 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, opacity: .75, fontWeight: 600 }}>
              {labelNiveau(niveau)} · {xp} XP total
            </p>
            <div style={{ height: 10, background: 'rgba(255,255,255,.2)', borderRadius: 5, overflow: 'hidden', marginBottom: 6 }}>
              <div style={{
                height: '100%', width: `${pct}%`,
                background: `linear-gradient(90deg, ${C.gold}, ${C.accent})`,
                borderRadius: 5, transition: 'width .9s ease',
              }}/>
            </div>
            <p style={{ margin: 0, fontSize: 11, opacity: .7 }}>
              {xp_dans_niveau} / {xp_pour_prochain} XP pour le niveau {niveau + 1}
            </p>
          </div>
        </div>

        {/* Mini stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 20 }}>
          {[
            { icon: '🔥', label: 'Streak',    value: `${streak_jours}j`          },
            { icon: '📚', label: 'Sessions',  value: total_sessions                },
            { icon: '🎯', label: 'Réussite',  value: `${taux}%`                  },
            { icon: '⏱️', label: 'Minutes',   value: duree_totale_min             },
          ].map(s => (
            <div key={s.label} style={{
              background: 'rgba(255,255,255,.1)', borderRadius: 12,
              padding: mobile ? '8px 6px' : '10px 8px', textAlign: 'center',
            }}>
              <div style={{ fontSize: mobile ? 16 : 20 }}>{s.icon}</div>
              <div style={{ fontSize: mobile ? 14 : 18, fontWeight: 900, color: 'white', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 9, opacity: .7, fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Contenu */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: mobile ? '20px 14px' : '28px 24px' }}>

        {/* Progression badges */}
        <div style={{
          background: C.surface, borderRadius: 16, padding: '16px 20px',
          marginBottom: 24, border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        }}>
          <Zap size={18} color={C.gold}/>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 800, color: C.text }}>
              {badgesUnlocked.length} / {ADINKRA_BADGES.length} badges Adinkra
            </p>
            <div style={{ height: 7, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round(badgesUnlocked.length / ADINKRA_BADGES.length * 100)}%`,
                background: `linear-gradient(90deg, ${C.gold}, ${C.accent})`,
                borderRadius: 4, transition: 'width .8s ease',
              }}/>
            </div>
          </div>
          <span style={{ fontSize: 22, fontWeight: 900, color: C.gold }}>
            {Math.round(badgesUnlocked.length / ADINKRA_BADGES.length * 100)}%
          </span>
        </div>

        {/* Grille badges */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {ADINKRA_BADGES.map(badge => (
            <BadgeCard
              key={badge.id}
              badge={badge}
              unlocked={badgesUnlocked.includes(badge.id)}
              C={C}
              mobile={mobile}
            />
          ))}
        </div>

        {/* Légende */}
        <p style={{ textAlign: 'center', color: C.textMuted, fontSize: 11, marginTop: 24, fontStyle: 'italic' }}>
          Clique sur un badge pour en savoir plus. Les badges débloqués s'allument ! ✨
        </p>
      </div>
    </div>
  )
}
