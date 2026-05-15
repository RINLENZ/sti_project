/**
 * Page de contribution aux données d'entraînement ML.
 * Hub accessible à tous les utilisateurs connectés.
 * Redirige vers /collect-emotions ou /collect-audio.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../services/api'
import { Camera, Mic, ArrowRight, Shield, TrendingUp, Users, CheckCircle } from 'lucide-react'
import { C, useTheme } from '../styles/theme.jsx'
import { useBreakpoint } from '../hooks/useBreakpoint'

const ETATS_LABELS = {
  engagement_eleve:  'Engagé',
  engagement_faible: 'Distrait',
  confusion:         'Confusion',
  frustration:       'Frustration',
  ennui:             'Ennui',
  neutre:            'Neutre',
}
const COMMANDES_LABELS = {
  aide:          'Aide',
  oui:           'Oui',
  non:           'Non',
  repeter:       'Répétez',
  incompris:     'Je ne comprends pas',
  lentement:     'Plus lentement',
  bruit_silence: 'Bruit / Silence',
}

const CONSENT_KEY = 'sti_collecte_consent_v1'

export default function Contribuer() {
  useTheme()
  const navigate = useNavigate()
  const user = useSelector(s => s.auth.user)
  const { xs, mobile } = useBreakpoint()
  const [stats, setStats]       = useState(null)
  const [consent, setConsent]   = useState(() => localStorage.getItem(CONSENT_KEY) === 'oui')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    api.get('/api/annotation/global-stats')
      .then(r => setStats(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const pctEmotions = stats
    ? Math.round(stats.emotions.total / stats.emotions.target_total * 100)
    : 0
  const pctAudio = stats
    ? Math.round(stats.audio.total / stats.audio.target_total * 100)
    : 0

  const acceptConsent = () => {
    localStorage.setItem(CONSENT_KEY, 'oui')
    setConsent(true)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      fontFamily: "'DM Sans', system-ui, sans-serif",
      padding: xs ? '14px 12px 48px' : mobile ? '20px 16px 56px' : '32px 20px 64px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: xs ? 20 : 32, animation: 'fadeUp .35s ease both' }}>
          <h1 style={{ fontSize: xs ? 20 : 26, fontWeight: 900, color: C.brown, margin: '0 0 6px' }}>
            Contribuer à l'IA
          </h1>
          <p style={{ fontSize: 14, color: C.textSec, margin: 0, lineHeight: 1.6 }}>
            Aide à entraîner les modèles d'intelligence artificielle de la plateforme.
            Chaque contribution améliore la détection des émotions et la reconnaissance vocale.
          </p>
        </div>

        {/* ── Bannière consentement RGPD ── */}
        {!consent && (
          <div style={{
            background: '#FFF7ED',
            border: '1.5px solid #FED7AA',
            borderRadius: 16,
            padding: '20px 24px',
            marginBottom: 28,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <Shield size={22} color="#D97706" style={{ flexShrink: 0, marginTop: 2 }}/>
              <div>
                <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 800, color: '#92400E' }}>
                  Information sur la collecte de données
                </h3>
                <p style={{ margin: '0 0 12px', fontSize: 13, color: '#78350F', lineHeight: 1.6 }}>
                  Cette section collecte des <strong>images de ton visage</strong> et des <strong>clips audio
                  de ta voix</strong> pour entraîner les modèles IA de la plateforme.
                  Ces données sont utilisées <strong>uniquement pour l'entraînement ML</strong>,
                  ne sont pas partagées à des tiers, et peuvent être supprimées sur demande.
                  La participation est <strong>entièrement volontaire</strong>.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={acceptConsent} style={{
                    padding: '9px 20px', background: '#D97706', color: 'white',
                    border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800,
                    cursor: 'pointer',
                  }}>
                    J'accepte et je contribue
                  </button>
                  <button onClick={() => navigate(-1)} style={{
                    padding: '9px 20px', background: 'transparent', color: '#92400E',
                    border: '1.5px solid #FED7AA', borderRadius: 10, fontSize: 13, fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                    Non merci
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Progression globale ── */}
        {!loading && stats && (
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 28,
          }}>
            <StatCard
              label="Dataset expressions"
              total={stats.emotions.total}
              target={stats.emotions.target_total}
              pct={pctEmotions}
              color={C.brown}
            />
            <StatCard
              label="Dataset audio KWS"
              total={stats.audio.total}
              target={stats.audio.target_total}
              pct={pctAudio}
              color="#2563EB"
            />
          </div>
        )}

        {/* ── Cartes d'action ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, opacity: consent ? 1 : 0.45, pointerEvents: consent ? 'auto' : 'none' }}>

          {/* Émotions */}
          <ActionCard
            icon={<Camera size={28} color={C.brown}/>}
            title="Expressions faciales"
            subtitle="Capture 10-30 images de ton visage avec différentes expressions"
            color={C.brown}
            colorPale={C.brownPale}
            tags={Object.values(ETATS_LABELS)}
            progress={pctEmotions}
            statsRows={stats ? Object.entries(stats.emotions.par_etat).map(([k, v]) => ({
              label: ETATS_LABELS[k] || k,
              value: v,
              target: 2000,
            })) : null}
            onClick={() => navigate('/collect-emotions')}
          />

          {/* Audio */}
          <ActionCard
            icon={<Mic size={28} color="#2563EB"/>}
            title="Commandes vocales"
            subtitle="Enregistre les mots-clés de la plateforme dans ta langue naturelle"
            color="#2563EB"
            colorPale="#EFF6FF"
            tags={Object.values(COMMANDES_LABELS)}
            progress={pctAudio}
            statsRows={stats ? Object.entries(stats.audio.par_commande).map(([k, v]) => ({
              label: COMMANDES_LABELS[k] || k,
              value: v,
              target: 300,
            })) : null}
            onClick={() => navigate('/collect-audio')}
          />
        </div>

        {/* ── Infos en bas ── */}
        <div style={{
          marginTop: 32,
          background: C.surface,
          borderRadius: 14,
          padding: '18px 22px',
          border: `1px solid ${C.brownPale}`,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.textSec, fontSize: 13 }}>
            <TrendingUp size={16} color={C.emerald}/>
            <span>Les modèles sont actifs à partir de <strong>300 clips audio/classe</strong> et <strong>2 000 images/classe</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.textSec, fontSize: 13 }}>
            <Users size={16} color={C.brown}/>
            <span>Plus on est nombreux à contribuer, plus l'IA est précise pour tous</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.textSec, fontSize: 13 }}>
            <CheckCircle size={16} color="#2563EB"/>
            <span>Données utilisées uniquement pour l'entraînement — jamais partagées</span>
          </div>
        </div>

      </div>
    </div>
  )
}

/* ── Sous-composants ─────────────────────────────────────────── */

function StatCard({ label, total, target, pct, color }) {
  return (
    <div style={{
      background: C.surface,
      borderRadius: 14,
      padding: '16px 18px',
      border: `1px solid ${C.brownPale}`,
    }}>
      <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: C.textSec, textTransform: 'uppercase', letterSpacing: '.06em' }}>
        {label}
      </p>
      <p style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 900, color }}>
        {total.toLocaleString('fr-FR')}
        <span style={{ fontSize: 12, fontWeight: 600, color: C.textSec }}> / {target.toLocaleString('fr-FR')}</span>
      </p>
      <div style={{ height: 6, background: '#E5E7EB', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 6,
          width: `${Math.min(pct, 100)}%`,
          background: color,
          transition: 'width .5s',
        }}/>
      </div>
      <p style={{ margin: '4px 0 0', fontSize: 11, color: C.textSec, fontWeight: 600 }}>{pct}% de l'objectif</p>
    </div>
  )
}

function ActionCard({ icon, title, subtitle, color, colorPale, tags, progress, statsRows, onClick }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      background: C.surface,
      borderRadius: 18,
      border: `1.5px solid ${C.brownPale}`,
      overflow: 'hidden',
    }}>
      {/* Header cliquable */}
      <div
        onClick={onClick}
        style={{
          padding: '22px 24px',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 18,
          transition: 'background .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = colorPale}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{
          width: 52, height: 52, borderRadius: 14,
          background: colorPale,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 900, color: C.text }}>{title}</h2>
          <p style={{ margin: 0, fontSize: 13, color: C.textSec }}>{subtitle}</p>
          {/* Mini progress */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <div style={{ flex: 1, height: 5, background: '#E5E7EB', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: color, borderRadius: 5, transition: 'width .5s' }}/>
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color, flexShrink: 0 }}>{progress}%</span>
          </div>
        </div>
        <ArrowRight size={20} color={color} style={{ flexShrink: 0 }}/>
      </div>

      {/* Tags + stats dépliables */}
      <div style={{ padding: '0 24px 16px', borderTop: `1px solid ${C.brownPale}` }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 14 }}>
          {tags.map(t => (
            <span key={t} style={{
              padding: '3px 10px', borderRadius: 20,
              background: colorPale, color, fontSize: 11, fontWeight: 700,
            }}>{t}</span>
          ))}
        </div>

        {statsRows && (
          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => setOpen(o => !o)}
              style={{
                background: 'none', border: 'none', color: C.textSec,
                fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0,
                textDecoration: 'underline', textUnderlineOffset: 3,
              }}
            >
              {open ? 'Masquer le détail' : 'Voir le détail par catégorie'}
            </button>
            {open && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
                {statsRows.map(({ label, value, target }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: C.textSec, width: 140, flexShrink: 0 }}>{label}</span>
                    <div style={{ flex: 1, height: 5, background: '#E5E7EB', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(Math.round(value / target * 100), 100)}%`,
                        background: value >= target ? C.emerald : color,
                        borderRadius: 5, transition: 'width .5s',
                      }}/>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.textSec, width: 60, textAlign: 'right', flexShrink: 0 }}>
                      {value} / {target}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
