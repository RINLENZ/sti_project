import { useEffect, useState } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Edit3, ChevronDown, ChevronRight,
  Shield, X, Save, AlertTriangle, RefreshCw,
} from 'lucide-react'

// ── Palette ────────────────────────────────────────────────────
const C = {
  brown: '#6B3A2A', brownLight: '#C4865A', emerald: '#0D9373',
  bg: '#FAF7F4', surface: '#FFFFFF', text: '#1A1207',
  textSec: '#6B5744', brownPale: '#F5EDE5', emeraldPale: '#E6F5F0',
  red: '#DC2626', orange: '#F59E0B', gold: '#D4A853', blue: '#2563EB',
  bluePale: '#DBEAFE',
}

// Section colors per type
const SEC = {
  cycle:   { color: C.brown,   bg: '#3D1A0F', light: C.brownPale,   label: 'Cycle' },
  ordre:   { color: C.gold,    bg: '#3D2E0A', light: '#FEF9E7',     label: 'Ordre' },
  filiere: { color: C.emerald, bg: '#0A2E22', light: C.emeraldPale, label: 'Filière' },
  niveau:  { color: C.blue,    bg: '#0A1A3D', light: C.bluePale,    label: 'Niveau/Classe' },
}

// ── Breakpoints ─────────────────────────────────────────────────
function useBreakpoint() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200)
  useEffect(() => {
    const h = () => setW(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return { mobile: w < 768, xs: w < 480 }
}

// ── Base input style ────────────────────────────────────────────
const inputBase = {
  width: '100%', padding: '9px 12px', border: `1.5px solid ${C.brownPale}`,
  borderRadius: 8, fontSize: 13, color: C.text, background: C.surface,
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border .15s',
}

const FieldLabel = ({ children, required }) => (
  <label style={{ fontSize: 11, fontWeight: 700, color: C.textSec, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>
    {children}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
  </label>
)

const FInput = ({ label, value, onChange, placeholder, required, hint }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <FieldLabel required={required}>{label}</FieldLabel>}
    <input value={value} onChange={onChange} placeholder={placeholder} required={required}
      style={inputBase}
      onFocus={e => e.target.style.borderColor = C.brown}
      onBlur={e => e.target.style.borderColor = C.brownPale}
    />
    {hint && <p style={{ fontSize: 10, color: C.textSec, marginTop: 3 }}>{hint}</p>}
  </div>
)

const FSelect = ({ label, value, onChange, options, required }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <FieldLabel required={required}>{label}</FieldLabel>}
    <select value={value} onChange={onChange} required={required} style={inputBase}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

// ── Modal ───────────────────────────────────────────────────────
function Modal({ title, onClose, children, accentColor = C.brown }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(26,18,7,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '24px 16px', backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        backgroundColor: C.surface, borderRadius: 20, padding: '24px 28px',
        maxWidth: 480, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,.3)',
        animation: 'slideDown .2s ease',
        borderTop: `4px solid ${accentColor}`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: accentColor, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: C.brownPale, border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: C.brown, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── ConfirmDelete ───────────────────────────────────────────────
function ConfirmDelete({ item, onConfirm, onCancel }) {
  return (
    <Modal title="Confirmer la suppression" onClose={onCancel} accentColor={C.red}>
      <div style={{ textAlign: 'center', paddingBottom: 8 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <AlertTriangle size={22} color={C.red} />
        </div>
        <p style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 6 }}>
          Désactiver <strong>"{item}"</strong> ?
        </p>
        <p style={{ fontSize: 12, color: C.textSec, marginBottom: 22 }}>
          Les profils existants ne seront pas affectés, mais cet élément n'apparaîtra plus dans l'onboarding.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Annuler
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px', background: C.red, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Désactiver
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── TableRow ────────────────────────────────────────────────────
function TableRow({ item, parent, type, onEdit, onDelete, mobile }) {
  const s = SEC[type]
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: mobile ? '10px 12px' : '10px 16px',
      backgroundColor: C.surface, borderRadius: 10,
      border: `1px solid ${C.brownPale}`,
      boxShadow: '0 1px 4px rgba(107,58,42,0.04)',
      transition: 'box-shadow .15s',
    }}>
      {/* Code badge */}
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: `${s.color}18`, border: `1.5px solid ${s.color}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 900, color: s.color, letterSpacing: .5,
      }}>
        {item.code}
      </div>

      {/* Nom + parent */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.nom}
        </p>
        {parent && (
          <p style={{ fontSize: 10, color: C.textSec, margin: '2px 0 0' }}>
            ↳ {parent}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        <button onClick={() => onEdit(item)} style={{
          padding: '5px 8px', background: C.bluePale, color: C.blue,
          border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 11, fontWeight: 700,
        }}>
          <Edit3 size={11} />{!mobile && ' Modifier'}
        </button>
        <button onClick={() => onDelete(item)} style={{
          padding: '5px 7px', background: '#FEE2E2', color: C.red,
          border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex',
        }}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── AccordionSection ────────────────────────────────────────────
function AccordionSection({ type, title, count, defaultOpen, children, onAdd }) {
  const [open, setOpen] = useState(defaultOpen)
  const s = SEC[type]

  return (
    <div style={{
      backgroundColor: C.surface, borderRadius: 16, overflow: 'hidden',
      border: `1px solid ${C.brownPale}`, marginBottom: 14,
      boxShadow: open ? '0 4px 20px rgba(107,58,42,0.1)' : '0 2px 8px rgba(107,58,42,0.05)',
      transition: 'box-shadow .2s',
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', cursor: 'pointer',
          background: open ? `${s.color}08` : 'transparent',
          borderBottom: open ? `1px solid ${C.brownPale}` : 'none',
          transition: 'background .2s',
        }}
      >
        {/* Icône type */}
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}18`, border: `1.5px solid ${s.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>
            {{ cycle: '🔄', ordre: '📐', filiere: '🗂️', niveau: '🎓' }[type]}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 14, fontWeight: 800, color: s.color, margin: 0 }}>{title}</p>
          <p style={{ fontSize: 10, color: C.textSec, margin: '2px 0 0' }}>{SEC[type].label}</p>
        </div>

        <span style={{ background: s.light, color: s.color, fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>
          {count} élément{count > 1 ? 's' : ''}
        </span>

        <ChevronDown size={16} color={s.color} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .25s ease', flexShrink: 0 }} />
      </div>

      {/* Contenu */}
      {open && (
        <div style={{ padding: '14px 18px', animation: 'fadeIn .2s ease' }}>
          {/* Bouton ajouter */}
          <button onClick={() => onAdd()} style={{
            marginBottom: 12, padding: '8px 14px',
            border: `1.5px dashed ${s.color}60`, borderRadius: 10, background: `${s.color}06`,
            color: s.color, cursor: 'pointer', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6, width: '100%',
            justifyContent: 'center',
          }}>
            <Plus size={13} /> Ajouter un(e) {SEC[type].label.toLowerCase()}
          </button>
          {children}
        </div>
      )}
    </div>
  )
}

// ── Formulaires par type ────────────────────────────────────────
function FormCycle({ initial = {}, onSubmit, onClose }) {
  const [form, setForm] = useState({ nom: initial.nom || '', code: initial.code || '' })
  const [loading, setLoading] = useState(false)
  async function handle(e) {
    e.preventDefault(); setLoading(true)
    try { await onSubmit(form) } finally { setLoading(false) }
  }
  return (
    <form onSubmit={handle}>
      <FInput label="Nom du cycle" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="ex: Lycée Général" required hint="Ex: Primaire, Collège, Lycée, Supérieur" />
      <FInput label="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="ex: LYC" required hint="Code court unique (3-5 lettres)" />
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
        <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Save size={13} /> {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

function FormOrdre({ initial = {}, cycles, onSubmit, onClose }) {
  const [form, setForm] = useState({ nom: initial.nom || '', code: initial.code || '', cycle_id: initial.cycle_id || cycles[0]?.id || '' })
  const [loading, setLoading] = useState(false)
  async function handle(e) {
    e.preventDefault(); setLoading(true)
    try { await onSubmit(form) } finally { setLoading(false) }
  }
  return (
    <form onSubmit={handle}>
      <FSelect label="Cycle parent" value={form.cycle_id} onChange={e => setForm(f => ({ ...f, cycle_id: e.target.value }))} required
        options={cycles.map(c => ({ value: c.id, label: c.nom }))} />
      <FInput label="Nom de l'ordre" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="ex: Enseignement Technique" required />
      <FInput label="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="ex: TEC" required />
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
        <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', background: `linear-gradient(135deg, ${C.gold}, #B8860B)`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Save size={13} /> {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

function FormFiliere({ initial = {}, ordres, onSubmit, onClose }) {
  const [form, setForm] = useState({ nom: initial.nom || '', code: initial.code || '', description: initial.description || '', ordre_id: initial.ordre_id || ordres[0]?.id || '' })
  const [loading, setLoading] = useState(false)
  async function handle(e) {
    e.preventDefault(); setLoading(true)
    try { await onSubmit(form) } finally { setLoading(false) }
  }
  return (
    <form onSubmit={handle}>
      <FSelect label="Ordre parent" value={form.ordre_id} onChange={e => setForm(f => ({ ...f, ordre_id: e.target.value }))} required
        options={ordres.map(o => ({ value: o.id, label: `${o.nom} (${o.code})` }))} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: 12 }}>
        <FInput label="Nom de la filière" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="ex: F7 Génie Informatique" required />
        <FInput label="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="F7" required />
      </div>
      <FInput label="Description (optionnel)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="ex: Brevet de Technicien Supérieur…" />
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
        <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Save size={13} /> {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

function FormNiveau({ initial = {}, cycles, onSubmit, onClose }) {
  const [form, setForm] = useState({ nom: initial.nom || '', code: initial.code || '', cycle_id: initial.cycle_id || cycles[0]?.id || '' })
  const [loading, setLoading] = useState(false)
  async function handle(e) {
    e.preventDefault(); setLoading(true)
    try { await onSubmit(form) } finally { setLoading(false) }
  }
  return (
    <form onSubmit={handle}>
      <FSelect label="Cycle parent" value={form.cycle_id} onChange={e => setForm(f => ({ ...f, cycle_id: e.target.value }))} required
        options={cycles.map(c => ({ value: c.id, label: c.nom }))} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
        <FInput label="Nom de la classe" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="ex: Terminale F6" required />
        <FInput label="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="ex: TLE-F6" required hint="Unique" />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
        <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', background: `linear-gradient(135deg, ${C.blue}, #1D4ED8)`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Save size={13} /> {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════
// ── PAGE PRINCIPALE ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
export default function AdminReferentiel() {
  const [referentiel, setReferentiel] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // { type, mode: 'create'|'edit', data? }
  const [deleting, setDeleting] = useState(null) // { type, item }
  const { mobile, xs } = useBreakpoint()

  useEffect(() => { loadReferentiel() }, [])

  async function loadReferentiel() {
    setLoading(true)
    try { const { data } = await api.get('/api/admin/referentiel'); setReferentiel(data) }
    catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  // ── Data dérivée ────────────────────────────────────────────
  const cycles   = referentiel
  const ordres   = referentiel.flatMap(c => (c.ordres || []).map(o => ({ ...o, cycle_nom: c.nom, cycle_id: c.id })))
  const filieres = ordres.flatMap(o => (o.filieres || []).map(f => ({ ...f, ordre_nom: o.nom, ordre_id: o.id })))
  const niveaux  = referentiel.flatMap(c => (c.niveaux || []).map(n => ({ ...n, cycle_nom: c.nom, cycle_id: c.id })))

  // ── Handlers CRUD ───────────────────────────────────────────
  const CRUD = {
    cycle: {
      create: async p => { await api.post('/api/admin/referentiel/cycles', p);         toast.success('Cycle créé !') },
      update: async (id, p) => { await api.put(`/api/admin/referentiel/cycles/${id}`, p); toast.success('Cycle mis à jour !') },
      delete: async id => { await api.delete(`/api/admin/referentiel/cycles/${id}`); toast.success('Cycle désactivé') },
    },
    ordre: {
      create: async p => { await api.post('/api/admin/referentiel/ordres', p);         toast.success('Ordre créé !') },
      update: async (id, p) => { await api.put(`/api/admin/referentiel/ordres/${id}`, p); toast.success('Ordre mis à jour !') },
      delete: async id => { await api.delete(`/api/admin/referentiel/ordres/${id}`); toast.success('Ordre désactivé') },
    },
    filiere: {
      create: async p => { await api.post('/api/admin/referentiel/filieres', p);         toast.success('Filière créée !') },
      update: async (id, p) => { await api.put(`/api/admin/referentiel/filieres/${id}`, p); toast.success('Filière mise à jour !') },
      delete: async id => { await api.delete(`/api/admin/referentiel/filieres/${id}`); toast.success('Filière désactivée') },
    },
    niveau: {
      create: async p => { await api.post('/api/admin/referentiel/niveaux', p);         toast.success('Niveau créé !') },
      update: async (id, p) => { await api.put(`/api/admin/referentiel/niveaux/${id}`, p); toast.success('Niveau mis à jour !') },
      delete: async id => { await api.delete(`/api/admin/referentiel/niveaux/${id}`); toast.success('Niveau désactivé') },
    },
  }

  async function handleSubmit(payload) {
    const { type, mode, data } = modal
    try {
      if (mode === 'create') await CRUD[type].create(payload)
      else                   await CRUD[type].update(data.id, payload)
      setModal(null); loadReferentiel()
    } catch { toast.error('Erreur lors de la sauvegarde') }
  }

  async function handleDelete() {
    const { type, item } = deleting
    try { await CRUD[type].delete(item.id); setDeleting(null); loadReferentiel() }
    catch { toast.error('Erreur') }
  }

  const pad = xs ? 12 : mobile ? 16 : 28

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bg }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${C.brownPale}`, borderTopColor: C.brown, margin: '0 auto 14px', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>Chargement…</p>
      </div>
    </div>
  )

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: `${pad}px`, boxSizing: 'border-box', overflowX: 'hidden' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Hero ── */}
      <div style={{
        background: `linear-gradient(135deg, #2D1208 0%, ${C.brown} 100%)`,
        borderRadius: xs ? 16 : 20, padding: xs ? '18px 16px' : mobile ? '20px 18px' : '26px 30px',
        marginBottom: xs ? 16 : 22, position: 'relative', overflow: 'hidden', color: 'white',
      }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .05, pointerEvents: 'none' }}>
          <defs>
            <pattern id="adk-ref" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5" />
              <circle cx="30" cy="30" r="6" fill="none" stroke="white" strokeWidth="1.5" />
              <line x1="30" y1="18" x2="30" y2="12" stroke="white" strokeWidth="1.5" />
              <line x1="18" y1="30" x2="12" y2="30" stroke="white" strokeWidth="1.5" />
              <line x1="42" y1="30" x2="48" y2="30" stroke="white" strokeWidth="1.5" />
              <line x1="30" y1="42" x2="30" y2="48" stroke="white" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#adk-ref)" />
        </svg>

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Shield size={16} color={C.gold} />
              <p style={{ opacity: .75, fontSize: 11, fontWeight: 700, margin: 0 }}>Super Admin — Accès exclusif</p>
            </div>
            <h1 style={{ fontSize: xs ? 18 : mobile ? 20 : 24, fontWeight: 900, marginBottom: 8, lineHeight: 1.15 }}>
              Référentiel éducatif camerounais
            </h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: `${cycles.length} cycles`, color: C.brown },
                { label: `${ordres.length} ordres`, color: C.gold },
                { label: `${filieres.length} filières`, color: C.emerald },
                { label: `${niveaux.length} niveaux`, color: '#60A5FA' },
              ].map(s => (
                <span key={s.label} style={{ background: 'rgba(255,255,255,.15)', padding: '3px 10px', borderRadius: 20, fontSize: xs ? 10 : 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
          <button onClick={loadReferentiel} style={{
            background: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)',
            color: 'white', padding: '8px 14px', borderRadius: 10, cursor: 'pointer',
            fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
            flexShrink: 0,
          }}>
            <RefreshCw size={13} /> Actualiser
          </button>
        </div>

        {/* Info banner */}
        <div style={{ marginTop: 16, position: 'relative', background: 'rgba(255,255,255,.08)', borderRadius: 10, padding: '10px 14px', border: '1px solid rgba(255,255,255,.15)', fontSize: 11, opacity: .85, lineHeight: 1.5 }}>
          💡 Toute modification est <strong>immédiatement visible</strong> dans l'onboarding des apprenants et enseignants.
        </div>
      </div>

      {/* ── Layout ── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexDirection: mobile ? 'column' : 'row' }}>

        {/* ── Colonne principale : accordéons ── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* ─── CYCLES ─── */}
          <AccordionSection type="cycle" title="Cycles d'enseignement" count={cycles.length} defaultOpen={true}
            onAdd={() => setModal({ type: 'cycle', mode: 'create' })}>
            {cycles.length === 0 ? (
              <p style={{ textAlign: 'center', color: C.textSec, fontSize: 12, padding: '20px 0' }}>Aucun cycle — ajoutez-en un</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                {cycles.map(c => (
                  <TableRow key={c.id} item={c} type="cycle" mobile={mobile}
                    onEdit={item => setModal({ type: 'cycle', mode: 'edit', data: item })}
                    onDelete={item => setDeleting({ type: 'cycle', item })} />
                ))}
              </div>
            )}
          </AccordionSection>

          {/* ─── ORDRES ─── */}
          <AccordionSection type="ordre" title="Ordres d'enseignement" count={ordres.length} defaultOpen={true}
            onAdd={() => setModal({ type: 'ordre', mode: 'create' })}>
            {ordres.length === 0 ? (
              <p style={{ textAlign: 'center', color: C.textSec, fontSize: 12, padding: '20px 0' }}>Aucun ordre — créez d'abord un cycle</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cycles.map(cycle => {
                  const cycleOrdres = ordres.filter(o => o.cycle_id === cycle.id)
                  if (cycleOrdres.length === 0) return null
                  return (
                    <div key={cycle.id}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6, marginTop: 4 }}>
                        ↳ {cycle.nom}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, marginLeft: 12 }}>
                        {cycleOrdres.map(o => (
                          <TableRow key={o.id} item={o} type="ordre" parent={cycle.nom} mobile={mobile}
                            onEdit={item => setModal({ type: 'ordre', mode: 'edit', data: item })}
                            onDelete={item => setDeleting({ type: 'ordre', item })} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </AccordionSection>

          {/* ─── FILIÈRES ─── */}
          <AccordionSection type="filiere" title="Filières" count={filieres.length} defaultOpen={false}
            onAdd={() => setModal({ type: 'filiere', mode: 'create' })}>
            {filieres.length === 0 ? (
              <p style={{ textAlign: 'center', color: C.textSec, fontSize: 12, padding: '20px 0' }}>Aucune filière — créez d'abord un ordre</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ordres.map(ordre => {
                  const ordreFilieres = filieres.filter(f => f.ordre_id === ordre.id)
                  if (ordreFilieres.length === 0) return null
                  return (
                    <div key={ordre.id}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6, marginTop: 4 }}>
                        ↳ {ordre.nom} ({ordre.cycle_nom})
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, marginLeft: 12 }}>
                        {ordreFilieres.map(f => (
                          <TableRow key={f.id} item={f} type="filiere" parent={ordre.nom} mobile={mobile}
                            onEdit={item => setModal({ type: 'filiere', mode: 'edit', data: item })}
                            onDelete={item => setDeleting({ type: 'filiere', item })} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </AccordionSection>

          {/* ─── NIVEAUX ─── */}
          <AccordionSection type="niveau" title="Niveaux / Classes" count={niveaux.length} defaultOpen={false}
            onAdd={() => setModal({ type: 'niveau', mode: 'create' })}>
            {niveaux.length === 0 ? (
              <p style={{ textAlign: 'center', color: C.textSec, fontSize: 12, padding: '20px 0' }}>Aucun niveau — créez d'abord un cycle</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cycles.map(cycle => {
                  const cycleNiveaux = niveaux.filter(n => n.cycle_id === cycle.id)
                  if (cycleNiveaux.length === 0) return null
                  return (
                    <div key={cycle.id}>
                      <p style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 6, marginTop: 4 }}>
                        ↳ {cycle.nom}
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8, marginLeft: 12 }}>
                        {cycleNiveaux.map(n => (
                          <TableRow key={n.id} item={n} type="niveau" parent={cycle.nom} mobile={mobile}
                            onEdit={item => setModal({ type: 'niveau', mode: 'edit', data: item })}
                            onDelete={item => setDeleting({ type: 'niveau', item })} />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </AccordionSection>
        </div>

        {/* ── Sidebar stats desktop ── */}
        {!mobile && (
          <div style={{ width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Stats */}
            <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '18px 20px', border: `1px solid ${C.brownPale}`, boxShadow: '0 2px 10px rgba(107,58,42,0.07)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: C.brown, marginBottom: 14 }}>📊 Statistiques</h3>
              {[
                { label: 'Cycles',    value: cycles.length,   color: C.brown },
                { label: 'Ordres',    value: ordres.length,   color: C.gold },
                { label: 'Filières',  value: filieres.length, color: C.emerald },
                { label: 'Niveaux',   value: niveaux.length,  color: C.blue },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.brownPale}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: 15, fontWeight: 900, color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>

            {/* Hiérarchie */}
            <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '18px 20px', border: `1px solid ${C.brownPale}`, boxShadow: '0 2px 10px rgba(107,58,42,0.07)' }}>
              <h3 style={{ fontSize: 13, fontWeight: 800, color: C.brown, marginBottom: 14 }}>🗂️ Hiérarchie</h3>
              {[
                { icon: '🔄', label: 'Cycle',    sub: 'ex: Lycée, Collège',  indent: 0, color: C.brown },
                { icon: '📐', label: 'Ordre',    sub: 'ex: Général, Technique', indent: 1, color: C.gold },
                { icon: '🗂️', label: 'Filière',  sub: 'ex: F7, C, D, A',    indent: 2, color: C.emerald },
                { icon: '🎓', label: 'Niveau',   sub: 'ex: 6ème, Tle F6',   indent: 1, color: C.blue },
              ].map((h, i) => (
                <div key={h.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10, paddingLeft: h.indent * 12 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{h.icon}</span>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: h.color, margin: 0 }}>{h.label}</p>
                    <p style={{ fontSize: 10, color: C.textSec, margin: '2px 0 0' }}>{h.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Note */}
            <div style={{ background: `linear-gradient(135deg, ${C.brownPale}, ${C.emeraldPale})`, borderRadius: 14, padding: '14px 16px', fontSize: 11, color: C.textSec, lineHeight: 1.6 }}>
              💡 Les éléments désactivés restent dans les profils existants mais disparaissent de l'onboarding.
            </div>
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {modal && (() => {
        const { type, mode, data } = modal
        const isEdit = mode === 'edit'
        const s = SEC[type]
        const title = isEdit ? `Modifier — ${data?.nom}` : `Nouveau ${s.label.toLowerCase()}`

        return (
          <Modal title={title} onClose={() => setModal(null)} accentColor={s.color}>
            {type === 'cycle'   && <FormCycle   initial={isEdit ? data : {}} onSubmit={handleSubmit} onClose={() => setModal(null)} />}
            {type === 'ordre'   && <FormOrdre   initial={isEdit ? data : {}} cycles={cycles} onSubmit={handleSubmit} onClose={() => setModal(null)} />}
            {type === 'filiere' && <FormFiliere initial={isEdit ? data : {}} ordres={ordres} onSubmit={handleSubmit} onClose={() => setModal(null)} />}
            {type === 'niveau'  && <FormNiveau  initial={isEdit ? data : {}} cycles={cycles} onSubmit={handleSubmit} onClose={() => setModal(null)} />}
          </Modal>
        )
      })()}

      {deleting && (
        <ConfirmDelete
          item={deleting.item.nom}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}