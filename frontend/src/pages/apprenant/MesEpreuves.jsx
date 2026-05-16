import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import { getCache, setCache } from '../../services/cache'
import toast from 'react-hot-toast'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Spinner } from '../../components/Skeleton'
import { FileText, Clock, Award, ChevronRight, CheckCircle, BookOpen, FlaskConical, Clipboard, Microscope } from 'lucide-react'

const TYPE_META = {
  sequence: { label: 'Séquence',        color: '#7C3AED', bg: '#EDE9FE', Icon: BookOpen },
  examen:   { label: 'Examen',          color: '#DC2626', bg: '#FEE2E2', Icon: Award },
  devoir:   { label: 'Devoir surveillé',color: '#D97706', bg: '#FEF3C7', Icon: Clipboard },
  tp_note:  { label: 'TP noté',         color: '#0D9373', bg: '#D1FAE5', Icon: FlaskConical },
}

const TABS = [
  { key: 'all',    label: 'Toutes' },
  { key: 'todo',   label: 'À faire' },
  { key: 'done',   label: 'Soumises' },
]

export default function MesEpreuves() {
  const { C }    = useTheme()
  const navigate = useNavigate()
  const { xs, mobile } = useBreakpoint()
  const pad = xs ? 10 : mobile ? 16 : 28

  const [epreuves, setEpreuves] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState('all')

  useEffect(() => {
    const cached = getCache('epreuves_disponibles')
    if (cached) { setEpreuves(cached); setLoading(false) }
    api.get('/api/examens/disponibles')
      .then(({ data }) => { setEpreuves(data); setCache('epreuves_disponibles', data, 60 * 1000) })
      .catch(() => { if (!cached) toast.error('Impossible de charger les épreuves') })
      .finally(() => setLoading(false))
  }, [])

  const filtered = epreuves.filter(ep =>
    tab === 'all'  ? true :
    tab === 'todo' ? !ep.soumis :
                     ep.soumis
  )

  const counts = {
    all:  epreuves.length,
    todo: epreuves.filter(e => !e.soumis).length,
    done: epreuves.filter(e => e.soumis).length,
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: pad, boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
        borderRadius: xs ? 16 : 20,
        padding: xs ? '16px 14px' : mobile ? '20px 20px' : '22px 28px',
        marginBottom: 20, color: 'white',
        position: 'relative', overflow: 'hidden',
        animation: 'fadeUp .35s ease both',
      }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }}>
          <defs>
            <pattern id="adinkra-ep" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
              <rect x="10" y="10" width="30" height="30" fill="none" stroke="white" strokeWidth="1.5" rx="4"/>
              <line x1="10" y1="25" x2="40" y2="25" stroke="white" strokeWidth="1"/>
              <line x1="25" y1="10" x2="25" y2="40" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#adinkra-ep)"/>
        </svg>
        <div style={{ position: 'relative' }}>
          <p style={{ opacity: .7, fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Espace apprenant</p>
          <h1 style={{ fontSize: xs ? 18 : mobile ? 20 : 24, fontWeight: 900, marginBottom: 4, margin: '0 0 4px' }}>Mes épreuves</h1>
          <p style={{ opacity: .75, fontSize: 12, margin: 0 }}>
            {counts.todo > 0
              ? `${counts.todo} épreuve${counts.todo > 1 ? 's' : ''} à passer · ${counts.done} soumise${counts.done > 1 ? 's' : ''}`
              : `${epreuves.length} épreuve${epreuves.length !== 1 ? 's' : ''} disponible${epreuves.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner/></div>
      ) : (
        <>
          {/* ── Tabs ── */}
          {epreuves.length > 0 && (
            <div style={{
              display: 'flex', gap: 8, marginBottom: 16,
              animation: 'fadeUp .35s .05s ease both',
            }}>
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    padding: xs ? '7px 14px' : '8px 18px',
                    borderRadius: 20, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', transition: 'all .18s',
                    border: tab === t.key ? 'none' : `1.5px solid ${C.border}`,
                    background: tab === t.key
                      ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`
                      : C.surface,
                    color: tab === t.key ? 'white' : C.textSec,
                    boxShadow: tab === t.key ? `0 3px 12px ${C.brown}30` : 'none',
                  }}
                >
                  {t.label}
                  {counts[t.key] > 0 && (
                    <span style={{
                      marginLeft: 6, fontSize: 10, fontWeight: 900,
                      background: tab === t.key ? 'rgba(255,255,255,0.25)' : C.brownGhost,
                      color: tab === t.key ? 'white' : C.brown,
                      padding: '1px 6px', borderRadius: 10,
                    }}>{counts[t.key]}</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Empty state ── */}
          {filtered.length === 0 ? (
            <div style={{
              background: C.surface, borderRadius: 20, padding: xs ? 32 : 56,
              textAlign: 'center', border: `1.5px solid ${C.brownPale}`,
              animation: 'fadeUp .35s ease both',
            }}>
              <p style={{ fontSize: 44, marginBottom: 12 }}>
                {tab === 'done' ? '🏅' : tab === 'todo' ? '✅' : '📄'}
              </p>
              <p style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 8 }}>
                {tab === 'done'
                  ? 'Aucune épreuve soumise'
                  : tab === 'todo'
                  ? 'Toutes les épreuves sont soumises !'
                  : 'Aucune épreuve disponible'}
              </p>
              <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>
                {tab === 'done'
                  ? 'Passe tes premières épreuves pour voir tes résultats ici.'
                  : tab === 'todo'
                  ? 'Tu es à jour — excellent travail !'
                  : 'Ton enseignant n\'a pas encore publié d\'épreuve pour ton niveau.'}
              </p>
            </div>
          ) : (
            /* ── Grille de cartes ── */
            <div style={{
              display: 'grid',
              gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: xs ? 10 : 14,
            }}>
              {filtered.map((ep, i) => {
                const meta = TYPE_META[ep.type_epreuve] || { label: ep.type_epreuve, color: C.brown, bg: C.brownPale, Icon: FileText }
                const { Icon } = meta
                const scoreLabel = ep.soumis && ep.score_total != null
                  ? `${ep.score_total.toFixed(1)}/20`
                  : null

                return (
                  <div
                    key={ep.id}
                    onClick={() => navigate(`/epreuve/${ep.id}`)}
                    style={{
                      background: C.surface, borderRadius: xs ? 14 : 16,
                      padding: xs ? '14px 14px' : '18px 20px',
                      border: `1.5px solid ${ep.soumis ? `${C.emerald}35` : C.border}`,
                      cursor: 'pointer', transition: 'all .2s',
                      boxShadow: '0 2px 10px rgba(107,58,42,0.06)',
                      position: 'relative', overflow: 'hidden',
                      animation: `fadeUp .35s ${0.08 + i * 0.04}s ease both`,
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.boxShadow = `0 6px 22px ${C.brown}1A`
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.boxShadow = '0 2px 10px rgba(107,58,42,0.06)'
                      e.currentTarget.style.transform = 'none'
                    }}
                  >
                    {/* Accent strip top */}
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: ep.soumis ? `linear-gradient(90deg, ${C.emerald}, #0A7A5E)` : `linear-gradient(90deg, ${meta.color}, ${C.brown})`, borderRadius: '14px 14px 0 0' }}/>

                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 4 }}>
                      {/* Icône type */}
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: ep.soumis ? `${C.emerald}18` : meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={18} color={ep.soumis ? C.emerald : meta.color}/>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: '0 0 5px', fontSize: xs ? 13 : 14, fontWeight: 800, color: C.text, paddingRight: ep.soumis ? 64 : 0, lineHeight: 1.3 }}>{ep.titre}</p>
                        {/* Type badge */}
                        <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 800, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 8 }}>
                          {meta.label}
                        </span>
                        {ep.classe_label && (
                          <span style={{ fontSize: 11, color: C.textSec, marginLeft: 6 }}>· {ep.classe_label}</span>
                        )}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 14 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.textSec }}>
                        <Clock size={12} color={C.textSec}/>{ep.duree_minutes} min
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: C.textSec }}>
                        <Award size={12} color={C.textSec}/>Coeff. {ep.coefficient}
                      </span>
                      {scoreLabel && (
                        <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 900, color: C.emerald, background: `${C.emerald}12`, padding: '2px 10px', borderRadius: 10 }}>
                          {scoreLabel}
                        </span>
                      )}
                    </div>

                    {/* CTA row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                      {ep.soumis ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <CheckCircle size={12} color={C.emerald}/>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.emerald }}>Soumise</span>
                        </div>
                      ) : (
                        <div/>
                      )}
                      <span style={{ fontSize: 12, fontWeight: 700, color: ep.soumis ? C.textSec : C.brown, display: 'flex', alignItems: 'center', gap: 3 }}>
                        {ep.soumis ? 'Voir les résultats' : 'Passer l\'épreuve'}
                        <ChevronRight size={13}/>
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
