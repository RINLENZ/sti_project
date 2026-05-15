import { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Spinner } from '../../components/Skeleton'
import {
  FileText, Sparkles, ChevronDown, ChevronUp, Check,
  Eye, EyeOff, Archive, Globe, Plus, RefreshCw,
  Users, Zap, ShieldAlert, BarChart2, Download,
  Calendar, Clock, X as XIcon,
} from 'lucide-react'

// ── Constantes ────────────────────────────────────────────────────────────────

const TYPES_EPREUVE = [
  { value: 'sequence', label: 'Épreuve de séquence' },
  { value: 'examen',   label: 'Examen' },
  { value: 'devoir',   label: 'Devoir surveillé' },
  { value: 'tp_note',  label: 'TP noté' },
]

const ANNEES = ['2024-2025', '2025-2026', '2026-2027']

// ── Petit utilitaire style input ──────────────────────────────────────────────

function inputStyle(C) {
  return {
    width: '100%', padding: '9px 12px',
    border: `1.5px solid ${C.brownPale}`,
    borderRadius: 8, fontSize: 13, color: C.text,
    background: C.surface, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  }
}

function labelStyle(C) {
  return { fontSize: 11, fontWeight: 700, color: C.textSec, marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: .5 }
}

// ── Aperçu de l'épreuve générée ──────────────────────────────────────────────

function EpreuvePreview({ contenu, C }) {
  const [openP1, setOpenP1] = useState(true)
  const [openP2, setOpenP2] = useState(true)

  const typeColors = {
    definition: C.brown, vrai_faux: C.emerald, completion: C.orange,
    listage: '#7C3AED', qcm: '#2563EB', code: '#0D9373',
    question_directe: C.brown, reponse_libre: C.textSec,
  }

  function renderQuestion(q, idx) {
    const color = typeColors[q.type] || C.brown
    return (
      <div key={q.id || idx} style={{ padding: '10px 14px', background: C.bg, borderRadius: 8, borderLeft: `3px solid ${color}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: C.text, flex: 1, lineHeight: 1.5 }}>
            <strong style={{ color: C.textSec }}>Q{idx + 1}.</strong> {q.enonce}
          </p>
          <span style={{ fontSize: 11, fontWeight: 800, color, flexShrink: 0, background: `${color}18`, padding: '2px 8px', borderRadius: 20 }}>
            {q.points} pt{q.points > 1 ? 's' : ''}
          </span>
        </div>
        {q.options?.length > 0 && (
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {q.options.map((opt, i) => (
              <span key={i} style={{ fontSize: 12, color: C.textSec, paddingLeft: 8 }}>{opt}</span>
            ))}
          </div>
        )}
        {q.reponse_correcte && (
          <p style={{ margin: '6px 0 0', fontSize: 11, color: C.emerald, fontWeight: 600 }}>
            Réponse : {q.reponse_correcte}
          </p>
        )}
      </div>
    )
  }

  function renderPartie(partie, open, setOpen, label, color) {
    if (!partie) return null
    const total = partie.points_total ?? 10
    const exs = partie.exercices || []
    return (
      <div style={{ background: C.surface, borderRadius: 14, border: `1.5px solid ${color}30`, overflow: 'hidden', marginBottom: 12 }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ width: '100%', padding: '14px 18px', background: `linear-gradient(90deg, ${color}18, transparent)`, border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div style={{ textAlign: 'left' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color }}>{label}</p>
            <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>
              {exs.length} exercice{exs.length > 1 ? 's' : ''} · {total} points
            </p>
          </div>
          {open ? <ChevronUp size={16} color={color}/> : <ChevronDown size={16} color={color}/>}
        </button>

        {open && (
          <div style={{ padding: '0 18px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            {partie.situation_probleme && (
              <div style={{ padding: '12px 16px', background: `${color}10`, borderRadius: 10, border: `1px solid ${color}30` }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: .5 }}>Situation-problème</p>
                <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.6 }}>{partie.situation_probleme}</p>
              </div>
            )}
            {exs.map((ex, i) => (
              <div key={ex.id || i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.text }}>
                    {ex.numero || `Exercice ${i + 1}`}
                    {ex.titre && <span style={{ fontWeight: 600, color: C.textSec }}> — {ex.titre}</span>}
                  </p>
                  <span style={{ fontSize: 11, color, fontWeight: 700 }}>{ex.points} pts</span>
                </div>
                {ex.consigne && (
                  <p style={{ margin: '0 0 8px', fontSize: 12, color: C.textSec, fontStyle: 'italic' }}>{ex.consigne}</p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(ex.questions || []).map((q, qi) => renderQuestion(q, qi))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.text }}>{contenu.titre || 'Épreuve générée'}</h3>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.emerald, background: `${C.emerald}15`, padding: '4px 12px', borderRadius: 20 }}>
          /20 pts
        </span>
      </div>
      {renderPartie(contenu.partie1, openP1, setOpenP1, 'PARTIE I — ÉVALUATION DES RESSOURCES', C.brown)}
      {renderPartie(contenu.partie2, openP2, setOpenP2, 'PARTIE II — ÉVALUATION DES COMPÉTENCES', C.emerald)}
    </div>
  )
}

// ── Helpers planning ──────────────────────────────────────────────────────────

function toDatetimeLocal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

function planifBadge(ep) {
  const se = ep.statut_effectif || ep.statut
  if (se === 'planifie') return { color: '#7C3AED', bg: '#EDE9FE', label: 'Planifiée' }
  if (se === 'publie')   return { color: '#059669', bg: '#D1FAE5', label: 'Ouverte' }
  if (se === 'cloture')  return { color: '#6B7280', bg: '#F3F4F6', label: 'Clôturée' }
  if (se === 'archive')  return { color: '#6B7280', bg: '#F3F4F6', label: 'Archivée' }
  return { color: '#D97706', bg: '#FEF3C7', label: 'Brouillon' }
}

// ── Carte d'une épreuve existante ─────────────────────────────────────────────

function EpreuveCard({ ep, onStatutChange, onView, C }) {
  const [loading,     setLoading]     = useState(false)
  const [planifOpen,  setPlanifOpen]  = useState(false)
  const [planifOuv,   setPlanifOuv]   = useState(toDatetimeLocal(ep.date_ouverture))
  const [planifClo,   setPlanifClo]   = useState(toDatetimeLocal(ep.date_cloture))
  const [savingPlan,  setSavingPlan]  = useState(false)

  const badge = planifBadge(ep)

  async function toggle(statut) {
    setLoading(true)
    try {
      await api.patch(`/api/examens/${ep.id}/statut`, { statut })
      onStatutChange(ep.id, { statut, statut_effectif: statut })
      toast.success(`Épreuve ${statut === 'publie' ? 'publiée' : statut === 'archive' ? 'archivée' : 'remise en brouillon'}`)
    } catch {
      toast.error('Impossible de changer le statut')
    } finally {
      setLoading(false)
    }
  }

  async function savePlanif() {
    setSavingPlan(true)
    try {
      const { data } = await api.put(`/api/examens/${ep.id}/planifier`, {
        date_ouverture: planifOuv ? new Date(planifOuv).toISOString() : null,
        date_cloture:   planifClo ? new Date(planifClo).toISOString() : null,
      })
      onStatutChange(ep.id, {
        statut: data.statut,
        statut_effectif: data.statut,
        date_ouverture: data.date_ouverture,
        date_cloture:   data.date_cloture,
      })
      toast.success('Planning enregistré')
      setPlanifOpen(false)
    } catch {
      toast.error('Impossible de planifier')
    } finally {
      setSavingPlan(false)
    }
  }

  async function clearPlanif() {
    setSavingPlan(true)
    try {
      const { data } = await api.put(`/api/examens/${ep.id}/planifier`, {
        date_ouverture: null, date_cloture: null,
      })
      onStatutChange(ep.id, { statut: data.statut, statut_effectif: data.statut, date_ouverture: null, date_cloture: null })
      setPlanifOuv(''); setPlanifClo('')
      toast.success('Planning supprimé')
    } catch {
      toast.error('Erreur')
    } finally {
      setSavingPlan(false)
    }
  }

  const isScheduled = ep.date_ouverture || ep.date_cloture
  const se = ep.statut_effectif || ep.statut
  const borderColor = se === 'publie' ? `${C.emerald}40` : isScheduled ? '#C4B5FD' : C.brownPale

  const dtFmt = iso => iso ? new Date(iso).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : ''

  return (
    <div style={{ background: C.surface, borderRadius: 14, border: `1.5px solid ${borderColor}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* En-tête */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>{ep.titre}</p>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: C.textSec }}>
              {TYPES_EPREUVE.find(t => t.value === ep.type_epreuve)?.label || ep.type_epreuve}
              {ep.classe_label && ` · ${ep.classe_label}`}
              {ep.duree_minutes && ` · ${ep.duree_minutes} min`}
              {ep.coefficient > 1 && ` · Coeff. ${ep.coefficient}`}
            </p>
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, color: badge.color, background: badge.bg, padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>
            {badge.label}
          </span>
        </div>

        {/* Dates planifiées */}
        {isScheduled && (
          <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#7C3AED', background: '#EDE9FE', borderRadius: 8, padding: '6px 10px', flexWrap: 'wrap' }}>
            {ep.date_ouverture && <span><Clock size={10} style={{ marginRight: 3 }}/>Ouverture : {dtFmt(ep.date_ouverture)}</span>}
            {ep.date_cloture   && <span><Clock size={10} style={{ marginRight: 3 }}/>Clôture : {dtFmt(ep.date_cloture)}</span>}
          </div>
        )}

        <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>
          {ep.annee_scolaire && `Année ${ep.annee_scolaire} · `}
          Créée le {ep.created_at ? new Date(ep.created_at).toLocaleDateString('fr-FR') : '—'}
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => onView(ep)} style={{ flex: 1, padding: '7px 12px', background: C.brownPale, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.brown, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <Eye size={13}/> Voir
          </button>
          {se !== 'publie' && se !== 'cloture' && (
            <button disabled={loading} onClick={() => toggle('publie')} style={{ flex: 1, padding: '7px 12px', background: `${C.emerald}18`, border: `1px solid ${C.emerald}40`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.emerald, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <Globe size={13}/> Publier
            </button>
          )}
          {se === 'publie' && (
            <button disabled={loading} onClick={() => toggle('brouillon')} style={{ flex: 1, padding: '7px 12px', background: '#FEF3C7', border: '1px solid #D97706', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#B45309', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
              <EyeOff size={13}/> Dépublier
            </button>
          )}
          {/* Planning */}
          <button onClick={() => setPlanifOpen(o => !o)}
            style={{ padding: '7px 10px', background: planifOpen ? '#EDE9FE' : '#F3F4F6', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Planifier l'ouverture">
            <Calendar size={13} color={planifOpen ? '#7C3AED' : C.textSec}/>
          </button>
          {ep.statut !== 'archive' && se !== 'publie' && (
            <button disabled={loading} onClick={() => toggle('archive')} style={{ padding: '7px 10px', background: '#F3F4F6', border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Archive size={13} color={C.textSec}/>
            </button>
          )}
        </div>
      </div>

      {/* Panneau planning */}
      {planifOpen && (
        <div style={{ borderTop: `1.5px solid #EDE9FE`, background: '#FAF5FF', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: .5 }}>
              <Calendar size={10} style={{ marginRight: 4 }}/>Planning automatique
            </p>
            {isScheduled && (
              <button onClick={clearPlanif} disabled={savingPlan}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: '#EF4444', display: 'flex', alignItems: 'center', gap: 3 }}>
                <XIcon size={11}/> Supprimer
              </button>
            )}
          </div>
          <p style={{ margin: 0, fontSize: 11, color: '#7C3AED', opacity: .7 }}>
            L'épreuve s'ouvrira et se fermera automatiquement aux dates choisies.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Ouverture</label>
              <input type="datetime-local" value={planifOuv} onChange={e => setPlanifOuv(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #C4B5FD', fontSize: 12, color: C.text, background: 'white', boxSizing: 'border-box' }}/>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: '#7C3AED', display: 'block', marginBottom: 4, textTransform: 'uppercase' }}>Clôture</label>
              <input type="datetime-local" value={planifClo} onChange={e => setPlanifClo(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1.5px solid #C4B5FD', fontSize: 12, color: C.text, background: 'white', boxSizing: 'border-box' }}/>
            </div>
          </div>
          <button onClick={savePlanif} disabled={savingPlan || !planifOuv}
            style={{ alignSelf: 'flex-end', padding: '7px 16px', background: '#7C3AED', border: 'none', borderRadius: 8, cursor: planifOuv ? 'pointer' : 'default', fontSize: 12, fontWeight: 700, color: 'white', opacity: planifOuv ? 1 : .5 }}>
            {savingPlan ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────

// ── Modal épreuve avec onglets Aperçu / Copies ────────────────────────────────

function EpreuveModal({ ep, onClose, C }) {
  const [tab, setTab]         = useState('apercu')
  const [copies, setCopies]   = useState(null)
  const [loadingC, setLoadingC] = useState(false)
  const [correcting, setCorrecting] = useState({})   // { reponse_id: bool }

  useEffect(() => {
    if (tab !== 'copies') return
    if (copies !== null) return
    setLoadingC(true)
    api.get(`/api/examens/${ep.id}/resultats`)
      .then(({ data }) => setCopies(data))
      .catch(() => setCopies([]))
      .finally(() => setLoadingC(false))
  }, [tab, ep.id, copies])

  async function exportCsv() {
    try {
      const { data } = await api.get(`/api/examens/${ep.id}/export`, { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url
      a.download = `${ep.titre.replace(/\s+/g, '_')}_resultats.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Échec de l\'export CSV')
    }
  }

  async function autocorriger(reponseId) {
    setCorrecting(c => ({ ...c, [reponseId]: true }))
    try {
      const { data } = await api.post(`/api/examens/reponses/${reponseId}/auto-corriger`)
      setCopies(prev => prev.map(c => c.id === reponseId
        ? { ...c, score_total: data.score_total, score_p1: data.score_p1, score_p2: data.score_p2, statut: data.statut }
        : c
      ))
      toast.success(`Copie corrigée — ${data.score_total}/20`)
    } catch {
      toast.error('Échec de la correction automatique')
    } finally {
      setCorrecting(c => ({ ...c, [reponseId]: false }))
    }
  }

  const TABS = [
    { key: 'apercu', label: 'Aperçu épreuve', icon: Eye },
    { key: 'copies', label: 'Copies',          icon: Users },
  ]

  const moy = copies?.length
    ? (copies.reduce((s, c) => s + (c.score_total ?? 0), 0) / copies.length).toFixed(1)
    : null

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,7,.6)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: '24px 16px', backdropFilter: 'blur(4px)', overflowY: 'auto' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: 20, maxWidth: 760, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div style={{ padding: '22px 24px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: C.brown }}>{ep.titre}</h2>
            <p style={{ margin: '3px 0 0', fontSize: 12, color: C.textSec }}>
              {TYPES_EPREUVE.find(t => t.value === ep.type_epreuve)?.label}
              {ep.classe_label && ` · ${ep.classe_label}`}
              {ep.duree_minutes && ` · ${ep.duree_minutes} min`}
            </p>
          </div>
          <button onClick={onClose} style={{ background: C.brownPale, border: 'none', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.brown, flexShrink: 0 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '14px 24px 0', borderBottom: `1px solid ${C.brownPale}` }}>
          {TABS.map(t => {
            const Icon   = t.icon
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '8px 16px', border: 'none', borderBottom: active ? `2px solid ${C.brown}` : '2px solid transparent', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: active ? 800 : 600, color: active ? C.brown : C.textSec, display: 'flex', alignItems: 'center', gap: 6, transition: 'all .15s', marginBottom: -1 }}>
                <Icon size={13}/>{t.label}
                {t.key === 'copies' && copies !== null && (
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.brown, background: `${C.brown}15`, padding: '1px 7px', borderRadius: 20 }}>{copies.length}</span>
                )}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px 24px', overflowY: 'auto', maxHeight: '65vh' }}>

          {/* ── Onglet Aperçu ── */}
          {tab === 'apercu' && (
            ep.contenu
              ? <EpreuvePreview contenu={ep.contenu} C={C}/>
              : <p style={{ color: C.textSec, fontSize: 13 }}>Contenu non disponible.</p>
          )}

          {/* ── Onglet Copies ── */}
          {tab === 'copies' && (
            loadingC ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner/></div>
            ) : !copies?.length ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <p style={{ fontSize: 32, marginBottom: 10 }}>📭</p>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Aucune copie soumise</p>
                <p style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>Publie l'épreuve pour que les apprenants puissent y répondre.</p>
              </div>
            ) : (
              <div>
                {/* Stats globales */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 18 }}>
                  {[
                    { label: 'Copies soumises', value: copies.length, color: C.brown, icon: Users },
                    { label: 'Moyenne',          value: moy ? `${moy}/20` : '—', color: C.emerald, icon: BarChart2 },
                    { label: 'À corriger',        value: copies.filter(c => c.statut === 'soumis').length, color: C.orange, icon: Zap },
                  ].map(({ label, value, color, icon: Icon }) => (
                    <div key={label} style={{ background: C.bg, borderRadius: 10, padding: '10px 12px', border: `1px solid ${C.brownPale}`, textAlign: 'center' }}>
                      <Icon size={16} color={color} style={{ marginBottom: 4 }}/>
                      <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color }}>{value}</p>
                      <p style={{ margin: 0, fontSize: 10, color: C.textSec, fontWeight: 700 }}>{label}</p>
                    </div>
                  ))}
                </div>

                {/* Export CSV */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                  <button onClick={exportCsv} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: C.brownPale, border: `1px solid ${C.brown}40`, borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.brown }}>
                    <Download size={13}/> Exporter CSV
                  </button>
                </div>

                {/* Liste copies */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {copies.map((copie, i) => {
                    const score = copie.score_total
                    const scoreColor = score === null ? C.textSec : score >= 14 ? C.emerald : score >= 10 ? C.orange : '#EF4444'
                    const hasPending = copie.corrections && Object.values(copie.corrections).some(c => c.auto === false || c.methode === 'manuelle')
                    return (
                      <div key={copie.id} style={{ background: C.surface, borderRadius: 12, padding: '14px 16px', border: `1.5px solid ${C.brownPale}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                          <div>
                            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
                              Apprenant #{i + 1}
                            </p>
                            <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textSec }}>
                              Soumis le {copie.submitted_at ? new Date(copie.submitted_at).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—'}
                            </p>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {/* Score */}
                            <div style={{ textAlign: 'center' }}>
                              <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: scoreColor, lineHeight: 1 }}>
                                {score !== null ? score.toFixed(1) : '—'}
                              </p>
                              <p style={{ margin: 0, fontSize: 9, color: C.textSec, fontWeight: 700 }}>/20</p>
                            </div>
                            {/* Incidents */}
                            {copie.nb_incidents > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#FEF3C7', padding: '4px 8px', borderRadius: 8, border: '1px solid #D97706' }}>
                                <ShieldAlert size={12} color="#D97706"/>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#92400E' }}>{copie.nb_incidents}</span>
                              </div>
                            )}
                            {/* Bouton re-correction */}
                            {hasPending && (
                              <button
                                onClick={() => autocorriger(copie.id)}
                                disabled={correcting[copie.id]}
                                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}
                              >
                                {correcting[copie.id] ? <Spinner/> : <Zap size={12}/>}
                                {correcting[copie.id] ? 'Correction…' : 'Auto-corriger'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Barre P1 / P2 */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                          {[
                            { label: 'Partie I', score: copie.score_p1, color: C.brown },
                            { label: 'Partie II', score: copie.score_p2, color: C.emerald },
                          ].map(({ label, score: s, color }) => (
                            <div key={label}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                <span style={{ fontSize: 10, color: C.textSec, fontWeight: 700 }}>{label}</span>
                                <span style={{ fontSize: 10, fontWeight: 800, color }}>{s !== null ? `${s}/10` : '—'}</span>
                              </div>
                              <div style={{ height: 4, background: C.brownPale, borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${s !== null ? Math.min(100, s / 10 * 100) : 0}%`, background: color, borderRadius: 4 }}/>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminExamen() {
  const { C }    = useTheme()
  const { user } = useSelector(s => s.auth)
  const { mobile, xs } = useBreakpoint()
  const pad = xs ? 12 : mobile ? 16 : 28

  // ── Données de référence
  const [matieres,    setMatieres]   = useState([])
  const [referentiel, setReferentiel] = useState([])    // [{cycle_id, niveaux:[{id,nom}], filieres:[]}]
  const [programme,   setProgramme]  = useState([])    // [{matiere, modules:[{familles:[{uas:[]}]}]}]

  // ── Formulaire de configuration
  const [form, setForm] = useState({
    matiere_id: '',
    niveau_id: '',
    classe_label: '',
    type_epreuve: 'sequence',
    duree_minutes: 60,
    coefficient: 1,
    annee_scolaire: '2025-2026',
    titre: '',
  })
  const [selectedUAs, setSelectedUAs] = useState(new Set())

  // ── Flux de génération
  const [step,      setStep]      = useState('config')   // config | generating | preview | list
  const [generated, setGenerated] = useState(null)       // { id, titre, contenu }
  const [viewEp,    setViewEp]    = useState(null)       // épreuve à prévisualiser

  // ── Liste épreuves
  const [epreuves,       setEpreuves]       = useState([])
  const [loadingList,    setLoadingList]    = useState(true)

  // ── Chargement initial
  useEffect(() => {
    api.get('/api/cours/matieres').then(({ data }) => setMatieres(data)).catch(() => {})
    api.get('/api/tuteur/referentiel').then(({ data }) => setReferentiel(data)).catch(() => {})
    loadEpreuves()
  }, [])

  // ── Charge le programme quand niveau change
  useEffect(() => {
    if (!form.niveau_id) { setProgramme([]); setSelectedUAs(new Set()); return }
    api.get(`/api/cours/programme/${form.niveau_id}`)
      .then(({ data }) => setProgramme(data))
      .catch(() => setProgramme([]))
    setSelectedUAs(new Set())
  }, [form.niveau_id])

  async function loadEpreuves() {
    setLoadingList(true)
    try {
      const { data } = await api.get('/api/examens/')
      setEpreuves(data)
    } catch {
      toast.error('Impossible de charger les épreuves')
    } finally {
      setLoadingList(false)
    }
  }

  function handleStatutChange(id, patch) {
    setEpreuves(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }

  function toggleUA(uaId) {
    setSelectedUAs(prev => {
      const next = new Set(prev)
      next.has(uaId) ? next.delete(uaId) : next.add(uaId)
      return next
    })
  }

  function toggleAllUAs(uaIds) {
    setSelectedUAs(prev => {
      const allSelected = uaIds.every(id => prev.has(id))
      const next = new Set(prev)
      if (allSelected) uaIds.forEach(id => next.delete(id))
      else uaIds.forEach(id => next.add(id))
      return next
    })
  }

  async function generer() {
    if (!form.matiere_id) { toast.error('Sélectionne une matière'); return }
    if (selectedUAs.size === 0) { toast.error('Sélectionne au moins une UA'); return }

    setStep('generating')
    try {
      const { data } = await api.post('/api/examens/generer', {
        matiere_id:    form.matiere_id,
        niveau_id:     form.niveau_id || null,
        classe_label:  form.classe_label,
        type_epreuve:  form.type_epreuve,
        ua_ids:        [...selectedUAs],
        duree_minutes: Number(form.duree_minutes),
        coefficient:   Number(form.coefficient),
        annee_scolaire: form.annee_scolaire,
        titre:         form.titre || null,
      })
      setGenerated(data)
      setStep('preview')
      toast.success('Épreuve générée avec succès !')
      loadEpreuves()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Erreur lors de la génération'
      toast.error(msg)
      setStep('config')
    }
  }

  async function publier(statut) {
    if (!generated?.id) return
    try {
      await api.patch(`/api/examens/${generated.id}/statut`, { statut })
      toast.success(statut === 'publie' ? 'Épreuve publiée !' : 'Épreuve enregistrée en brouillon')
      setGenerated(null)
      setStep('list')
      loadEpreuves()
    } catch {
      toast.error('Impossible de changer le statut')
    }
  }

  // ── Flat list of all UAs in the current programme
  const allUAs = programme.flatMap(mat =>
    mat.modules.flatMap(mod =>
      mod.familles.flatMap(fam =>
        (fam.unites || []).map(ua => ({ ...ua, fam_titre: fam.titre, mod_titre: mod.titre }))
      )
    )
  )

  const allNiveaux = referentiel.flatMap(c => c.niveaux.map(n => ({ ...n, cycle_nom: c.cycle_nom })))

  // ── JSX ─────────────────────────────────────────────────────────────

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: pad, boxSizing: 'border-box', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── En-tête ── */}
      <div style={{ background: `linear-gradient(135deg, ${C.brown} 0%, ${C.brownLight} 100%)`, borderRadius: xs ? 14 : 20, padding: xs ? '14px 14px' : '22px 28px', marginBottom: xs ? 16 : 24, position: 'relative', overflow: 'hidden', color: 'white', animation: 'fadeUp .35s ease both' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }}>
          <defs>
            <pattern id="adinkra-ex" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="30" cy="30" r="5" fill="white"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#adinkra-ex)"/>
        </svg>
        <div style={{ position: 'relative' }}>
          <p style={{ opacity: .7, fontSize: 12, fontWeight: 600, marginBottom: 3 }}>Génération d'épreuves</p>
          <h1 style={{ fontSize: xs ? 17 : mobile ? 20 : 24, fontWeight: 900, marginBottom: 4 }}>
            Épreuves IA — Format camerounais APC
          </h1>
          <p style={{ opacity: .75, fontSize: xs ? 11 : 13 }}>
            Génère automatiquement des épreuves conformes au programme MINESEC · {epreuves.length} épreuve{epreuves.length !== 1 ? 's' : ''} créée{epreuves.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── Tabs de navigation ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {[
          { key: 'config',  label: '1 · Configuration',  icon: FileText  },
          { key: 'preview', label: '2 · Aperçu',          icon: Eye       },
          { key: 'list',    label: 'Mes épreuves',        icon: Archive   },
        ].map(t => {
          const active = step === t.key || (step === 'generating' && t.key === 'config')
          const done   = t.key === 'config' && (step === 'preview' || step === 'list')
          const Icon   = t.icon
          return (
            <button
              key={t.key}
              onClick={() => { if (t.key !== 'preview' || generated) setStep(t.key) }}
              style={{
                padding: '8px 16px', borderRadius: 10, border: 'none', cursor: t.key === 'preview' && !generated ? 'not-allowed' : 'pointer',
                background: active ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})` : C.surface,
                color: active ? 'white' : C.textSec,
                fontSize: 12, fontWeight: active ? 800 : 600,
                opacity: t.key === 'preview' && !generated ? 0.45 : 1,
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: active ? `0 2px 12px ${C.brown}40` : 'none',
                transition: 'all .2s', flexShrink: 0,
                border: active ? 'none' : `1.5px solid ${C.brownPale}`,
              }}
            >
              {done ? <Check size={13}/> : <Icon size={13}/>}
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ════ STEP : Configuration ════ */}
      {(step === 'config' || step === 'generating') && (
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 20 }}>

          {/* Colonne gauche — Paramètres */}
          <div style={{ background: C.surface, borderRadius: 18, padding: 22, border: `1.5px solid ${C.brownPale}` }}>
            <h2 style={{ fontSize: 15, fontWeight: 800, color: C.brown, marginBottom: 18 }}>Paramètres</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Matière */}
              <div>
                <label style={labelStyle(C)}>Matière *</label>
                <select value={form.matiere_id} onChange={e => setForm(f => ({ ...f, matiere_id: e.target.value }))} style={inputStyle(C)}>
                  <option value="">— Sélectionner —</option>
                  {matieres.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
              </div>

              {/* Niveau */}
              <div>
                <label style={labelStyle(C)}>Niveau</label>
                <select value={form.niveau_id} onChange={e => setForm(f => ({ ...f, niveau_id: e.target.value }))} style={inputStyle(C)}>
                  <option value="">— Tous niveaux —</option>
                  {referentiel.map(c => (
                    <optgroup key={c.cycle_id} label={c.cycle_nom}>
                      {c.niveaux.map(n => <option key={n.id} value={n.id}>{n.nom}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Classe */}
              <div>
                <label style={labelStyle(C)}>Classe</label>
                <input type="text" placeholder="Ex : Tle F6, 1ère C…" value={form.classe_label} onChange={e => setForm(f => ({ ...f, classe_label: e.target.value }))} style={inputStyle(C)}/>
              </div>

              {/* Type d'épreuve */}
              <div>
                <label style={labelStyle(C)}>Type d'épreuve</label>
                <select value={form.type_epreuve} onChange={e => setForm(f => ({ ...f, type_epreuve: e.target.value }))} style={inputStyle(C)}>
                  {TYPES_EPREUVE.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>

              {/* Durée + Coefficient */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={labelStyle(C)}>Durée (min)</label>
                  <input type="number" min={15} max={240} value={form.duree_minutes} onChange={e => setForm(f => ({ ...f, duree_minutes: e.target.value }))} style={inputStyle(C)}/>
                </div>
                <div>
                  <label style={labelStyle(C)}>Coefficient</label>
                  <input type="number" min={1} max={10} value={form.coefficient} onChange={e => setForm(f => ({ ...f, coefficient: e.target.value }))} style={inputStyle(C)}/>
                </div>
              </div>

              {/* Année scolaire */}
              <div>
                <label style={labelStyle(C)}>Année scolaire</label>
                <select value={form.annee_scolaire} onChange={e => setForm(f => ({ ...f, annee_scolaire: e.target.value }))} style={inputStyle(C)}>
                  {ANNEES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {/* Titre personnalisé */}
              <div>
                <label style={labelStyle(C)}>Titre (optionnel)</label>
                <input type="text" placeholder="Généré automatiquement si vide" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} style={inputStyle(C)}/>
              </div>
            </div>
          </div>

          {/* Colonne droite — Sélection des UA */}
          <div style={{ background: C.surface, borderRadius: 18, padding: 22, border: `1.5px solid ${C.brownPale}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: C.brown, margin: 0 }}>
                Unités d'apprentissage *
              </h2>
              {selectedUAs.size > 0 && (
                <span style={{ fontSize: 11, fontWeight: 700, color: C.emerald, background: `${C.emerald}15`, padding: '3px 10px', borderRadius: 20 }}>
                  {selectedUAs.size} sélectionnée{selectedUAs.size > 1 ? 's' : ''}
                </span>
              )}
            </div>

            {!form.niveau_id && (
              <p style={{ fontSize: 13, color: C.textSec, textAlign: 'center', padding: '32px 0' }}>
                Sélectionne un niveau pour voir les UA disponibles.
              </p>
            )}

            {form.niveau_id && allUAs.length === 0 && (
              <p style={{ fontSize: 13, color: C.textSec, textAlign: 'center', padding: '32px 0' }}>
                Aucune UA disponible pour ce niveau.
              </p>
            )}

            {allUAs.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 420, overflowY: 'auto', paddingRight: 4 }}>
                {/* Sélectionner tout */}
                <button
                  onClick={() => {
                    const matUA = allUAs.filter(ua => !form.matiere_id || programme.some(mat => mat.id === form.matiere_id && mat.modules.some(mod => mod.familles.some(fam => fam.unites?.some(u => u.id === ua.id)))))
                    const uaIds = allUAs.map(u => u.id)
                    toggleAllUAs(uaIds)
                  }}
                  style={{ padding: '6px 12px', background: 'none', border: `1px dashed ${C.brownPale}`, borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: C.textSec, textAlign: 'left' }}
                >
                  {allUAs.every(u => selectedUAs.has(u.id)) ? '✓ Tout désélectionner' : '+ Tout sélectionner'}
                </button>

                {/* Groupé par famille */}
                {programme
                  .filter(mat => !form.matiere_id || mat.id === form.matiere_id || mat.modules?.length > 0)
                  .flatMap(mat => mat.modules || [])
                  .flatMap(mod => (mod.familles || []).map(fam => ({ fam, mod_titre: mod.titre })))
                  .map(({ fam, mod_titre }, fi) => {
                    const uas = fam.unites || []
                    if (!uas.length) return null
                    const famUAIds = uas.map(u => u.id)
                    const allFamSel = famUAIds.every(id => selectedUAs.has(id))
                    return (
                      <div key={fam.id || fi} style={{ background: C.bg, borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.brownPale}` }}>
                        <button
                          onClick={() => toggleAllUAs(famUAIds)}
                          style={{ width: '100%', padding: '9px 12px', background: allFamSel ? `${C.brown}15` : 'none', border: 'none', cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                        >
                          <div>
                            <p style={{ margin: 0, fontSize: 11, fontWeight: 800, color: C.brown }}>{fam.titre}</p>
                            <p style={{ margin: 0, fontSize: 10, color: C.textSec }}>{mod_titre} · {uas.length} UA</p>
                          </div>
                          {allFamSel && <Check size={13} color={C.emerald}/>}
                        </button>
                        <div style={{ padding: '4px 12px 8px' }}>
                          {uas.map(ua => (
                            <label key={ua.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', cursor: 'pointer', borderTop: `1px solid ${C.brownPale}` }}>
                              <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${selectedUAs.has(ua.id) ? C.emerald : C.brownPale}`, background: selectedUAs.has(ua.id) ? C.emerald : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
                                {selectedUAs.has(ua.id) && <Check size={11} color="white"/>}
                              </div>
                              <input type="checkbox" checked={selectedUAs.has(ua.id)} onChange={() => toggleUA(ua.id)} style={{ display: 'none' }}/>
                              <span style={{ fontSize: 12, fontWeight: 600, color: selectedUAs.has(ua.id) ? C.text : C.textSec }}>
                                {ua.titre}
                                {ua.reference_ue && <span style={{ fontSize: 10, color: C.textSec, marginLeft: 5 }}>({ua.reference_ue})</span>}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            )}
          </div>

          {/* Bouton générer — pleine largeur */}
          <div style={{ gridColumn: mobile ? '1' : '1 / -1' }}>
            <button
              onClick={generer}
              disabled={step === 'generating' || !form.matiere_id || selectedUAs.size === 0}
              style={{
                width: '100%', padding: '14px',
                background: (step !== 'generating' && form.matiere_id && selectedUAs.size > 0)
                  ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`
                  : '#E5E7EB',
                color: (step !== 'generating' && form.matiere_id && selectedUAs.size > 0) ? 'white' : C.textSec,
                border: 'none', borderRadius: 12,
                fontSize: 14, fontWeight: 800,
                cursor: (step !== 'generating' && form.matiere_id && selectedUAs.size > 0) ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: step !== 'generating' && form.matiere_id && selectedUAs.size > 0 ? `0 4px 20px ${C.brown}40` : 'none',
                transition: 'all .2s',
              }}
            >
              {step === 'generating' ? (
                <><Spinner/> Génération en cours…</>
              ) : (
                <><Sparkles size={16}/> Générer l'épreuve avec l'IA</>
              )}
            </button>
            {step === 'generating' && (
              <p style={{ textAlign: 'center', fontSize: 12, color: C.textSec, marginTop: 8 }}>
                Claude analyse le cours et rédige l'épreuve — cela prend 10 à 30 secondes…
              </p>
            )}
          </div>
        </div>
      )}

      {/* ════ STEP : Aperçu & validation ════ */}
      {step === 'preview' && generated && (
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 320px', gap: 20 }}>

          {/* Aperçu de l'épreuve */}
          <div style={{ background: C.surface, borderRadius: 18, padding: 22, border: `1.5px solid ${C.brownPale}` }}>
            <EpreuvePreview contenu={generated.contenu} C={C}/>
          </div>

          {/* Panneau d'actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: C.surface, borderRadius: 18, padding: 22, border: `1.5px solid ${C.brownPale}` }}>
              <h2 style={{ fontSize: 15, fontWeight: 800, color: C.brown, marginBottom: 14 }}>Actions</h2>

              <div style={{ padding: '12px 14px', background: `${C.emerald}10`, borderRadius: 10, border: `1px solid ${C.emerald}30`, marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: C.emerald }}>Épreuve enregistrée en brouillon</p>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textSec }}>Publie-la pour que les apprenants puissent y accéder.</p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => publier('publie')}
                  style={{ width: '100%', padding: '12px', background: `linear-gradient(135deg, ${C.emerald}, #059669)`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                >
                  <Globe size={15}/> Publier l'épreuve
                </button>
                <button
                  onClick={() => publier('brouillon')}
                  style={{ width: '100%', padding: '12px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
                >
                  Garder en brouillon
                </button>
                <button
                  onClick={() => { setStep('config'); setGenerated(null) }}
                  style={{ width: '100%', padding: '10px', background: 'none', color: C.textSec, border: `1px solid ${C.brownPale}`, borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <RefreshCw size={13}/> Regénérer
                </button>
              </div>
            </div>

            <div style={{ background: C.surface, borderRadius: 14, padding: '14px 16px', border: `1px solid ${C.brownPale}` }}>
              <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 800, color: C.brown }}>Récapitulatif</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {[
                  ['Titre',          generated.titre],
                  ['Type',           TYPES_EPREUVE.find(t => t.value === form.type_epreuve)?.label],
                  ['Classe',         form.classe_label || '—'],
                  ['Durée',          `${form.duree_minutes} min`],
                  ['Coefficient',    form.coefficient],
                  ['UA incluses',    `${selectedUAs.size}`],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                    <span style={{ color: C.textSec }}>{k}</span>
                    <span style={{ fontWeight: 700, color: C.text }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ STEP : Mes épreuves ════ */}
      {step === 'list' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: C.brown, margin: 0 }}>Mes épreuves</h2>
            <button
              onClick={() => setStep('config')}
              style={{ padding: '8px 16px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={13}/> Nouvelle épreuve
            </button>
          </div>

          {loadingList ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner/></div>
          ) : epreuves.length === 0 ? (
            <div style={{ background: C.surface, borderRadius: 18, padding: 48, textAlign: 'center', border: `1.5px solid ${C.brownPale}` }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>📄</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.text, marginBottom: 6 }}>Aucune épreuve créée</p>
              <p style={{ fontSize: 13, color: C.textSec }}>Lance la génération depuis l'onglet Configuration.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
              {epreuves.map(ep => (
                <EpreuveCard key={ep.id} ep={ep} C={C} onStatutChange={handleStatutChange} onView={setViewEp}/>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Modal aperçu épreuve existante ── */}
      {viewEp && (
        <EpreuveModal ep={viewEp} onClose={() => setViewEp(null)} C={C}/>
      )}
    </div>
  )
}
