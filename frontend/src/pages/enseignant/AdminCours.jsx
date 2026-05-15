import { useEffect, useState, useCallback, useRef } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Edit3, BookOpen, X, Save,
  Search, ChevronDown, ChevronRight,
  Clock, Zap, Layers, FolderOpen, Grid,
  FileText, AlertTriangle, Sparkles, Loader, Upload
} from 'lucide-react'
import { C, useTheme } from '../../styles/theme.jsx'
import ContentRenderer from '../../components/ContentRenderer'
import RichText, { RichTextInline } from '../../components/RichText'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { SkList, Spinner } from '../../components/Skeleton'

// ── UI de base ──────────────────────────────────────────────────
const getInputBase = (C, mobile = false) => ({
  width: '100%', padding: '9px 12px', border: `1.5px solid ${C.brownPale}`,
  borderRadius: 8, fontSize: mobile ? 16 : 13, color: C.text, background: C.surface,
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
})
const FieldLabel = ({ children, required }) => {
  const { C } = useTheme()
  return (
  <label style={{ fontSize: 11, fontWeight: 700, color: C.textSec, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>
    {children}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
  </label>
  )
}
const FInput = ({ label, value, onChange, placeholder, type = 'text', required, hint }) => {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const inputBase = getInputBase(C, mobile)
  return (
  <div style={{ marginBottom: 12 }}>
    {label && <FieldLabel required={required}>{label}</FieldLabel>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder} required={required}
      style={inputBase}
      onFocus={e => e.target.style.borderColor = C.brown}
      onBlur={e => e.target.style.borderColor = C.brownPale}
    />
    {hint && <p style={{ fontSize: 10, color: C.textSec, marginTop: 3 }}>{hint}</p>}
  </div>
  )
}
const FTextarea = ({ label, value, onChange, placeholder, rows = 3, required }) => {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const inputBase = getInputBase(C, mobile)
  return (
  <div style={{ marginBottom: 12 }}>
    {label && <FieldLabel required={required}>{label}</FieldLabel>}
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{ ...inputBase, resize: 'vertical' }}
      onFocus={e => e.target.style.borderColor = C.brown}
      onBlur={e => e.target.style.borderColor = C.brownPale}
    />
  </div>
  )
}
// ── RichTextarea — textarea enrichi avec toolbar LaTeX/image/aperçu ──
const LATEX_BTNS = [
  ['x²',  '$',          '$',          'x^{2}'],
  ['√',   '$\\sqrt{',   '}$',         'x'],
  ['a/b', '$\\frac{',   '}{b}$',      'a'],
  ['Σ',   '$\\sum_{',   '}$',         'i=1'],
  ['∫',   '$\\int_{a}^{b}$', '',       ''],
  ['≤',   '$\\leq$',    '',           ''],
  ['≥',   '$\\geq$',    '',           ''],
  ['≠',   '$\\neq$',    '',           ''],
  ['π',   '$\\pi$',     '',           ''],
  ['∞',   '$\\infty$',  '',           ''],
  ['$$',  '$$\n',       '\n$$',       'expression'],
]

const RichTextarea = ({ label, value, onChange, placeholder, rows = 3, required }) => {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const inputBase = getInputBase(C, mobile)
  const taRef = useRef(null)
  const [preview,   setPreview]   = useState(false)
  const [focused,   setFocused]   = useState(false)
  const [uploading, setUploading] = useState(false)

  function insert(before, after = '', ph = '') {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end   = ta.selectionEnd
    const sel   = value.slice(start, end) || ph
    const newVal = value.slice(0, start) + before + sel + after + value.slice(end)
    onChange({ target: { value: newVal } })
    if (after === '' && ph === '') return
    setTimeout(() => {
      ta.focus()
      ta.setSelectionRange(start + before.length, start + before.length + sel.length)
    }, 0)
  }

  async function pickImage() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files[0]
      if (!file) return
      setUploading(true)
      try {
        const fd = new FormData()
        fd.append('file', file)
        const { data } = await api.post('/api/admin/upload-media', fd)
        const alt = file.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
        insert(`![${alt}](${data.url})`)
      } catch {
        toast.error('Échec du téléchargement image')
      } finally {
        setUploading(false)
      }
    }
    input.click()
  }

  const borderColor = focused ? C.brown : C.brownPale
  const tb = {
    background: 'none', border: `1px solid ${C.brownPale}`, borderRadius: 5,
    padding: mobile ? '2px 4px' : '2px 6px', cursor: 'pointer',
    fontSize: mobile ? 10 : 11, fontWeight: 700,
    color: C.textSec, fontFamily: 'monospace', lineHeight: 1.6,
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {label && <FieldLabel required={required}>{label}</FieldLabel>}

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3,
        padding: '4px 8px', background: C.brownGhost,
        border: `1.5px solid ${borderColor}`, borderBottom: 'none',
        borderRadius: '8px 8px 0 0', transition: 'border-color .15s',
      }}>
        {/* LaTeX */}
        {LATEX_BTNS.filter((_, i) => !mobile || i < 8).map(([lbl, before, after, ph]) => (
          <button key={lbl} type="button"
            onMouseDown={e => { e.preventDefault(); insert(before, after, ph) }}
            style={tb} title={`Insérer ${lbl}`}>
            {lbl}
          </button>
        ))}

        {/* Séparateur */}
        <span style={{ width: 1, height: 16, background: C.brownPale, margin: '0 3px' }}/>

        {/* Format texte */}
        <button type="button" onMouseDown={e => { e.preventDefault(); insert('**', '**', 'texte') }}
          style={{ ...tb, fontWeight: 900, fontFamily: 'inherit' }} title="Gras">B</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); insert('*', '*', 'texte') }}
          style={{ ...tb, fontStyle: 'italic', fontFamily: 'inherit' }} title="Italique">I</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); insert('`', '`', 'code') }}
          style={tb} title="Code inline">`c`</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); insert('```\n', '\n```', 'code') }}
          style={tb} title="Bloc de code">&lt;/&gt;</button>

        {/* Séparateur */}
        <span style={{ width: 1, height: 16, background: C.brownPale, margin: '0 3px' }}/>

        {/* Image */}
        <button type="button" onMouseDown={e => { e.preventDefault(); pickImage() }}
          style={{ ...tb, display: 'flex', alignItems: 'center', gap: 3 }}
          title="Insérer une image" disabled={uploading}>
          {uploading ? <Loader size={10}/> : <Upload size={10}/>}
          {uploading ? '…' : 'Image'}
        </button>

        {/* Aperçu — poussé à droite */}
        <button type="button" onMouseDown={e => { e.preventDefault(); setPreview(p => !p) }}
          style={{ ...tb, marginLeft: 'auto',
            background: preview ? C.brownPale : 'none', color: preview ? C.brown : C.textSec,
            border: `1px solid ${preview ? C.brown : C.brownPale}` }}
          title={preview ? 'Retour en édition' : 'Prévisualiser le rendu'}>
          {preview ? '✏ Éditer' : '👁 Aperçu'}
        </button>
      </div>

      {/* ── Zone édition / aperçu ── */}
      {preview ? (
        <div
          onClick={() => setPreview(false)}
          style={{ ...inputBase, minHeight: rows * 26, padding: '10px 12px', cursor: 'text',
            border: `1.5px solid ${borderColor}`, borderTop: 'none',
            borderRadius: '0 0 8px 8px', transition: 'border-color .15s' }}>
          <RichText text={value || ''} style={{ fontSize: 13 }}/>
          {!value && <span style={{ color: C.textMuted, fontSize: 13 }}>Aucun contenu</span>}
        </div>
      ) : (
        <textarea ref={taRef} value={value} onChange={onChange}
          placeholder={placeholder} rows={rows}
          style={{ ...inputBase, resize: 'vertical', borderTop: 'none',
            borderRadius: '0 0 8px 8px', borderColor, transition: 'border-color .15s' }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      )}
    </div>
  )
}

const FSelect = ({ label, value, onChange, options, required }) => {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const inputBase = getInputBase(C, mobile)
  return (
  <div style={{ marginBottom: 12 }}>
    {label && <FieldLabel required={required}>{label}</FieldLabel>}
    <select value={value} onChange={onChange} style={inputBase}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
  )
}

// ── Modal ───────────────────────────────────────────────────────
function Modal({ title, onClose, children, size = 560 }) {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(26,18,7,.6)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 1000, padding: mobile ? '8px' : '24px 16px', overflowY: 'auto', backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        backgroundColor: C.surface, borderRadius: mobile ? 14 : 20,
        padding: mobile ? '14px 12px' : '24px 28px',
        maxWidth: size, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,.3)',
        animation: 'slideDown .2s ease', margin: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: C.brown, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: C.brownPale, border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: C.brown, display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ConfirmDelete({ item, onConfirm, onCancel }) {
  const { C } = useTheme()
  return (
    <Modal title="Confirmer la suppression" onClose={onCancel} size={420}>
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <AlertTriangle size={22} color={C.red} />
        </div>
        <p style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 6 }}>Supprimer <strong>"{item}"</strong> ?</p>
        <p style={{ fontSize: 12, color: C.textSec, marginBottom: 22 }}>Cette action est irréversible.</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px', background: C.red, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Supprimer</button>
        </div>
      </div>
    </Modal>
  )
}

const SaveBtn = ({ loading }) => {
  const { C } = useTheme()
  return (
  <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    <Save size={14} /> {loading ? 'Enregistrement…' : 'Enregistrer'}
  </button>
  )
}
const CancelBtn = ({ onClose }) => {
  const { C } = useTheme()
  return (
  <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
  )
}

// ── TagList ─────────────────────────────────────────────────────
function TagList({ label, items, onChange, placeholder }) {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const inputBase = getInputBase(C, mobile)
  const [draft, setDraft] = useState('')
  function add() {
    const t = draft.trim()
    if (t && !items.includes(t)) { onChange([...items, t]); setDraft('') }
  }
  return (
    <div style={{ marginBottom: 12 }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {items.map((item, i) => (
          <span key={i} style={{ background: C.brownPale, color: C.brown, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            {item}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.brownLight, padding: 0, display: 'flex' }}><X size={11} /></button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder} style={{ ...inputBase, flex: 1 }}
          onFocus={e => e.target.style.borderColor = C.brown}
          onBlur={e => e.target.style.borderColor = C.brownPale}
        />
        <button type="button" onClick={add} style={{ padding: '0 14px', background: C.brown, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Ajouter</button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ── TAB STRUCTURE : Matières → Modules → Familles ───────────────
// ════════════════════════════════════════════════════════════════

function FormMatiere({ initial = {}, onSubmit, onClose }) {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const [form, setForm] = useState({ nom: initial.nom || '', code: initial.code || '', description: initial.description || '' })
  const [loading, setLoading] = useState(false)
  async function handle(e) { e.preventDefault(); setLoading(true); try { await onSubmit({ nom: form.nom, code: form.code, description: form.description }) } finally { setLoading(false) } }
  return (
    <form onSubmit={handle}>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 120px', gap: 12 }}>
        <FInput label="Nom" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="ex: Mathématiques" required />
        <FInput label="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="MATH" required />
      </div>
      <FInput label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description optionnelle" />
      <div style={{ display: 'flex', gap: 10 }}><CancelBtn onClose={onClose} /><SaveBtn loading={loading} /></div>
    </form>
  )
}

function FormModule({ initial = {}, matieres = [], niveaux = [], filieres = [], onSubmit, onClose }) {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const [form, setForm] = useState({
    titre: initial.titre || '', numero: initial.numero || 1, description: initial.description || '',
    matiere_id: initial.matiere_id || matieres[0]?.id || '',
    niveau_id:  initial.niveau_id  || '',
    filiere_id: initial.filiere_id || '',
    ordre: initial.ordre || 1,
  })
  const [loading, setLoading] = useState(false)
  async function handle(e) { e.preventDefault(); setLoading(true); try { await onSubmit(form) } finally { setLoading(false) } }
  return (
    <form onSubmit={handle}>
      <FSelect label="Matière" value={form.matiere_id} onChange={e => setForm(f => ({ ...f, matiere_id: e.target.value }))} required
        options={matieres.map(m => ({ value: m.id, label: m.nom }))} />
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 12 }}>
        <FSelect label="Niveau / Classe" value={form.niveau_id} onChange={e => setForm(f => ({ ...f, niveau_id: e.target.value }))}
          options={[{ value: '', label: '— Tous niveaux —' }, ...niveaux.map(n => ({ value: n.id, label: n.nom }))]} />
        <FSelect label="Spécialité / Série" value={form.filiere_id} onChange={e => setForm(f => ({ ...f, filiere_id: e.target.value }))}
          options={[{ value: '', label: '— Toutes séries —' }, ...filieres.map(f => ({ value: f.id, label: `${f.nom} (${f.code})` }))]} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 12 }}>
        <FInput label="N°" value={form.numero} type="number" onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} required />
        <FInput label="Titre" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="ex: Algorithmique et programmation" required />
      </div>
      <FTextarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Présentation du module…" rows={2} />
      <div style={{ display: 'flex', gap: 10 }}><CancelBtn onClose={onClose} /><SaveBtn loading={loading} /></div>
    </form>
  )
}

function FormFamille({ initial = {}, modules = [], onSubmit, onClose }) {
  const { C } = useTheme()
  const [form, setForm] = useState({
    titre: initial.titre || '', description: initial.description || '',
    module_id: initial.module_id || modules[0]?.id || '', ordre: initial.ordre || 1,
  })
  const [loading, setLoading] = useState(false)
  async function handle(e) { e.preventDefault(); setLoading(true); try { await onSubmit(form) } finally { setLoading(false) } }
  return (
    <form onSubmit={handle}>
      <FSelect label="Module parent" value={form.module_id} onChange={e => setForm(f => ({ ...f, module_id: e.target.value }))} required
        options={modules.map(m => ({ value: m.id, label: `M${m.numero} — ${m.titre.substring(0, 40)}` }))} />
      <FInput label="Titre de la famille" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="ex: Programmation en C" required />
      <FTextarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Situations de vie liées à…" rows={2} />
      <div style={{ display: 'flex', gap: 10 }}><CancelBtn onClose={onClose} /><SaveBtn loading={loading} /></div>
    </form>
  )
}

function TabStructure({ structure, niveaux, filieres, filterNiveau, filterMat, onReload }) {
  const { C } = useTheme()
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [expanded, setExpanded] = useState({})
  const { mobile } = useBreakpoint()

  const allMatieres = structure
  const allModules  = structure.flatMap(m => (m.modules || []).map(mod => ({ ...mod, matiere_nom: m.nom, matiere_id: m.id })))
  const allFamilles = allModules.flatMap(mod => (mod.familles || []).map(fam => ({ ...fam, module_nom: mod.titre, module_id: mod.id })))

  function toggle(key) { setExpanded(e => ({ ...e, [key]: !e[key] })) }

  async function handleSubmitMatiere(payload) {
    try {
      if (modal?.editMatiere?.id) { await api.put(`/api/cours/matieres/${modal.editMatiere.id}`, payload); toast.success('Matière mise à jour !') }
      else { await api.post('/api/cours/matieres', payload); toast.success('Matière créée !') }
      setModal(null); onReload()
    } catch { toast.error('Erreur') }
  }

  async function handleSubmitModule(payload) {
    try {
      if (modal?.editModule?.id) { await api.put(`/api/admin/modules/${modal.editModule.id}`, payload); toast.success('Module mis à jour !') }
      else { await api.post('/api/admin/modules', payload); toast.success('Module créé !') }
      setModal(null); onReload()
    } catch { toast.error('Erreur') }
  }

  async function handleSubmitFamille(payload) {
    try {
      if (modal?.editFamille?.id) { await api.put(`/api/admin/familles/${modal.editFamille.id}`, payload); toast.success('Famille mise à jour !') }
      else { await api.post('/api/admin/familles', payload); toast.success('Famille créée !') }
      setModal(null); onReload()
    } catch { toast.error('Erreur') }
  }

  async function handleDelete() {
    const { type, id, nom } = deleting
    try {
      if (type === 'matiere')  await api.delete(`/api/cours/matieres/${id}`)
      if (type === 'module')   await api.delete(`/api/admin/modules/${id}`)
      if (type === 'famille')  await api.delete(`/api/admin/familles/${id}`)
      toast.success(`${nom} supprimé(e)`)
      setDeleting(null); onReload()
    } catch { toast.error('Erreur lors de la suppression') }
  }

  const ActionBtns = ({ onEdit, onDelete }) => (
    <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
      <button onClick={onEdit} style={{ padding: '5px 9px', background: C.bluePale, color: C.blue, border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700 }}>
        <Edit3 size={11} /> {!mobile && 'Modifier'}
      </button>
      <button onClick={onDelete} style={{ padding: '5px 8px', background: '#FEE2E2', color: C.red, border: 'none', borderRadius: 7, cursor: 'pointer' }}>
        <Trash2 size={12} />
      </button>
    </div>
  )

  return (
    <div>
      {/* Toolbar — boutons créer uniquement (filtres globaux gérés par le parent) */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        <button onClick={() => setModal({ type: 'matiere' })} style={{ padding: '8px 14px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Plus size={13} /> Matière
        </button>
        <button onClick={() => setModal({ type: 'module' })} style={{ padding: '8px 14px', background: `linear-gradient(135deg, ${C.gold}, ${C.orange})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Plus size={13} /> Module
        </button>
        <button onClick={() => setModal({ type: 'famille' })} style={{ padding: '8px 14px', background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`, color: 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
          <Plus size={13} /> Famille
        </button>
      </div>

      {/* Arbre hiérarchique */}
      {structure
        .filter(mat => filterMat === 'all' || String(mat.id) === filterMat)
        .map(mat => {
          const modulesFiltres = (mat.modules || []).filter(mod =>
            filterNiveau === 'all' || String(mod.niveau_id) === filterNiveau || !mod.niveau_id
          )
    
    // Si aucun module après filtre, ne rien rendre (skip)
    if (filterNiveau !== 'all' && modulesFiltres.length === 0) return null
    
    // S'il y a des modules, on rend la matière
    return (
      <div key={mat.id} style={{ marginBottom: 12, background: C.surface, borderRadius: 16, border: `1px solid ${C.brownPale}`, overflow: 'hidden', boxShadow: '0 2px 10px rgba(107,58,42,0.07)' }}>
        {/* Matière */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: `linear-gradient(135deg, ${C.brownPale}, white)`, cursor: 'pointer' }}
          onClick={() => toggle(`mat-${mat.id}`)}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${C.brownDark || '#8B5A3A'}, ${C.brown})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 16, color: 'white' }}>📚</span>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: C.brown, margin: 0 }}>{mat.nom}</p>
            <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>{mat.code} · {(mat.modules || []).length} module(s)</p>
          </div>
          <ActionBtns
            onEdit={() => setModal({ type: 'matiere', editMatiere: mat })}
            onDelete={() => setDeleting({ type: 'matiere', id: mat.id, nom: mat.nom })}
          />
          <ChevronDown size={16} color={C.brown} style={{ transform: expanded[`mat-${mat.id}`] ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
        </div>

        {/* Modules */}
        {expanded[`mat-${mat.id}`] && (
          <div style={{ padding: '8px 18px 14px 52px' }}>
            {/* Afficher les modules filtrés */}
            {modulesFiltres.length === 0 ? (
              <p style={{ fontSize: 12, color: C.textSec, fontStyle: 'italic', padding: '8px 0' }}>
                Aucun module — créez-en un avec le bouton "+ Module" ci-dessus.
              </p>
            ) : (
              modulesFiltres.map(mod => (
                <div key={mod.id} style={{ marginBottom: 8, background: `${C.brownPale}60`, borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.brownPale}` }}>
                  {/* Module header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                    onClick={() => toggle(`mod-${mod.id}`)}>
                    <div style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${C.gold || '#D4A853'}, ${C.orange})`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 900, color: 'white' }}>M{mod.numero}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mod.titre}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2, flexWrap: 'wrap' }}>
                        {mod.niveau_id ? (
                          <span style={{ background: C.brownPale, color: C.brown, fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20, border: `1px solid ${C.brownLight}40` }}>
                            🎓 {niveaux.find(n => n.id === mod.niveau_id)?.nom || 'Niveau'}
                          </span>
                        ) : (
                          <span style={{ background: '#E5E7EB', color: C.textSec, fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 20, fontStyle: 'italic' }}>
                            tous niveaux
                          </span>
                        )}
                        {mod.filiere_id && (
                          <span style={{ background: `${C.emerald}15`, color: C.emerald, fontSize: 10, fontWeight: 700, padding: '1px 8px', borderRadius: 20, border: `1px solid ${C.emerald}30` }}>
                            {mod.filiere_nom || filieres.find(f => f.id === mod.filiere_id)?.nom || 'Série'}
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: C.textSec }}>{(mod.familles || []).length} famille(s)</span>
                      </div>
                    </div>
                    <ActionBtns
                      onEdit={() => setModal({ type: 'module', editModule: { ...mod, matiere_id: mat.id } })}
                      onDelete={() => setDeleting({ type: 'module', id: mod.id, nom: mod.titre })}
                    />
                    <ChevronDown size={14} color={C.textSec} style={{ transform: expanded[`mod-${mod.id}`] ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
                  </div>

                  {/* Familles */}
                  {expanded[`mod-${mod.id}`] && (
                    <div style={{ padding: '4px 14px 12px 52px' }}>
                      {(mod.familles || []).length === 0 ? (
                        <p style={{ fontSize: 11, color: C.textSec, fontStyle: 'italic', padding: '6px 0' }}>
                          Aucune famille — créez-en une avec "+ Famille de situations".
                        </p>
                      ) : (
                        (mod.familles || []).map(fam => (
                          <div key={fam.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: C.surface, borderRadius: 10, marginBottom: 6, border: `1px solid ${C.brownPale}` }}>
                            <div style={{ width: 24, height: 24, borderRadius: 6, background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 12 }}>🗂️</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fam.titre}</p>
                              <p style={{ fontSize: 10, color: C.textSec, margin: 0 }}>{(fam.unites || []).length} UA</p>
                            </div>
                            <ActionBtns
                              onEdit={() => setModal({ type: 'famille', editFamille: { ...fam, module_id: mod.id } })}
                              onDelete={() => setDeleting({ type: 'famille', id: fam.id, nom: fam.titre })}
                            />
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    )
  })}

      {structure.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: C.textSec, background: C.surface, borderRadius: 16, border: `1px dashed ${C.brownLight}` }}>
          <Grid size={36} color={C.brownLight} style={{ margin: '0 auto 12px' }} />
          <p style={{ fontWeight: 700, fontSize: 14 }}>Aucune structure</p>
          <p style={{ fontSize: 12 }}>Commencez par créer une Matière, puis un Module, puis une Famille.</p>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'matiere' && (
        <Modal title={modal.editMatiere ? 'Modifier la matière' : 'Nouvelle matière'} onClose={() => setModal(null)}>
          <FormMatiere initial={modal.editMatiere || {}} onSubmit={handleSubmitMatiere} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'module' && (
        <Modal title={modal.editModule ? 'Modifier le module' : 'Nouveau module'} onClose={() => setModal(null)} size={600}>
          <FormModule initial={modal.editModule || {}} matieres={allMatieres} niveaux={niveaux} filieres={filieres} onSubmit={handleSubmitModule} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal?.type === 'famille' && (
        <Modal title={modal.editFamille ? 'Modifier la famille' : 'Nouvelle famille de situations'} onClose={() => setModal(null)}>
          <FormFamille initial={modal.editFamille || {}} modules={allModules} onSubmit={handleSubmitFamille} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleting && <ConfirmDelete item={deleting.nom} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ── TAB UA ──────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

function FormUA({ initial = {}, familles = [], onSubmit, onClose }) {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const [form, setForm] = useState({
    titre: initial.titre || '', reference_ue: initial.reference_ue || '',
    situation_probleme: initial.situation_probleme || '',
    duree_estimee: initial.duree_estimee || 60,
    famille_id: initial.famille_id || familles[0]?.id || '',
    competences: initial.competences || [], prerequis: initial.prerequis || [],
  })
  const [loading, setLoading] = useState(false)
  async function handle(e) {
    e.preventDefault(); setLoading(true)
    try {
      await onSubmit({ titre: form.titre, reference_ue: form.reference_ue, situation_probleme: form.situation_probleme, duree_estimee: parseInt(form.duree_estimee), famille_id: form.famille_id, competences: form.competences, prerequis: form.prerequis })
    } finally { setLoading(false) }
  }
  return (
    <form onSubmit={handle}>
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 130px', gap: 12 }}>
        <FInput label="Titre de l'UA" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="ex: Les structures de contrôle" required />
        <FInput label="Référence" value={form.reference_ue} onChange={e => setForm(f => ({ ...f, reference_ue: e.target.value }))} placeholder="UA1.1" required />
      </div>
      {familles.length > 0 && (
        <FSelect label="Famille de situations" value={form.famille_id} onChange={e => setForm(f => ({ ...f, famille_id: e.target.value }))} required
          options={familles.map(f => ({ value: f.id, label: f.titre.substring(0, 50) }))} />
      )}
      <FTextarea label="Situation problème" value={form.situation_probleme} onChange={e => setForm(f => ({ ...f, situation_probleme: e.target.value }))} placeholder="Contexte concret d'apprentissage…" rows={3} />
      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Durée estimée (minutes)</FieldLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="range" min={15} max={240} step={15} value={form.duree_estimee} onChange={e => setForm(f => ({ ...f, duree_estimee: e.target.value }))} style={{ flex: 1, accentColor: C.brown }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: C.brown, minWidth: 50 }}>{form.duree_estimee} min</span>
        </div>
      </div>
      <TagList label="Compétences visées" items={form.competences} onChange={v => setForm(f => ({ ...f, competences: v }))} placeholder="Ajouter une compétence…" />
      <TagList label="Prérequis" items={form.prerequis} onChange={v => setForm(f => ({ ...f, prerequis: v }))} placeholder="Ajouter un prérequis…" />
      <div style={{ display: 'flex', gap: 10 }}><CancelBtn onClose={onClose} /><SaveBtn loading={loading} /></div>
    </form>
  )
}

function TabUA({ structure, filterNiveau = 'all', filterMat = 'all', onReload }) {
  const { C } = useTheme()
  const inputBase = getInputBase(C)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [pdfModal, setPdfModal] = useState(false)
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfFamille, setPdfFamille] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)
  const { mobile } = useBreakpoint()

  const allUAs = structure
  .filter(m => filterMat === 'all' || String(m.id) === filterMat)
  .flatMap(m =>
    (m.modules || [])
      .filter(mod => filterNiveau === 'all' || String(mod.niveau_id) === filterNiveau || !mod.niveau_id)
      .flatMap(mod =>
        (mod.familles || []).flatMap(fam =>
          (fam.unites || []).map(u => ({ ...u, matiere_nom: m.nom, matiere_id: m.id, famille_id: fam.id, famille_titre: fam.titre }))
        )
      )
  )
  const familles = structure.flatMap(m => (m.modules || []).flatMap(mod => mod.familles || []))

  const filtered = allUAs.filter(ua => {
    const matchQ = !search || ua.titre.toLowerCase().includes(search.toLowerCase()) || ua.reference_ue?.toLowerCase().includes(search.toLowerCase())
    return matchQ
  })

  async function handleSubmit(payload) {
    try {
      if (modal?.id) { await api.put(`/api/cours/ua/${modal.id}`, payload); toast.success('UA mise à jour !') }
      else { await api.post('/api/cours/ua', payload); toast.success('UA créée !') }
      setModal(null); onReload()
    } catch { toast.error('Erreur') }
  }

  async function handleDelete() {
    try { await api.delete(`/api/cours/ua/${deleting.id}`); toast.success('UA supprimée'); setDeleting(null); onReload() }
    catch { toast.error('Erreur') }
  }

  async function handlePdfImport() {
    if (!pdfFile) return toast.error('Sélectionnez un fichier PDF')
    if (!pdfFamille) return toast.error('Sélectionnez une famille')
    setPdfLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', pdfFile)
      const { data } = await api.post(
        `/api/admin/import/pdf?famille_id=${pdfFamille}`,
        fd,
        { timeout: 120000 }  // Claude Sonnet peut prendre jusqu'à 60-90s
      )
      toast.success(`UA importée : ${data.titre || 'succès'} (${data.nb_exercices_crees || 0} exercice(s))`)
      setPdfModal(false); setPdfFile(null); setPdfFamille(''); onReload()
    } catch (err) {
      const msg = err?.response?.data?.detail || "Erreur d'import PDF"
      toast.error(msg)
    } finally { setPdfLoading(false) }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
          <Search size={13} color={C.textSec} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une UA…" style={{ ...inputBase, paddingLeft: 30 }}
            onFocus={e => e.target.style.borderColor = C.brown} onBlur={e => e.target.style.borderColor = C.brownPale} />
        </div>
        <button onClick={() => { setPdfModal(true); setPdfFamille(familles[0]?.id || '') }} style={{ padding: '9px 14px', background: `linear-gradient(135deg, #7C3AED, #5B21B6)`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <Upload size={13} /> Import PDF
        </button>
        <button onClick={() => setModal('create')} style={{ padding: '9px 16px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <Plus size={13} /> Nouvelle UA
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: C.textSec, background: C.surface, borderRadius: 16, border: `1px dashed ${C.brownLight}` }}>
            <BookOpen size={30} color={C.brownLight} style={{ margin: '0 auto 10px' }} />
            <p style={{ fontWeight: 600, fontSize: 14 }}>Aucune UA trouvée</p>
          </div>
        )}
        {filtered.map(ua => (
          <div key={ua.id} style={{ backgroundColor: C.surface, borderRadius: 13, padding: mobile ? '12px' : '12px 18px', border: `1px solid ${C.brownPale}`, boxShadow: '0 1px 6px rgba(107,58,42,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ background: C.brownPale, color: C.brown, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{ua.reference_ue || 'UA'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ua.titre}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, color: C.textSec, display: 'flex', alignItems: 'center', gap: 2 }}><Clock size={10} /> {ua.duree_estimee}min</span>
                <span style={{ fontSize: 10, color: C.textSec, display: 'flex', alignItems: 'center', gap: 2 }}><BookOpen size={10} /> {ua.nb_exercices || 0} exos</span>
                <span style={{ fontSize: 10, color: C.textSec }}>· {ua.matiere_nom} · {ua.famille_titre}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => setModal(ua)} style={{ padding: '6px 10px', background: C.bluePale, color: C.blue, border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700 }}>
                <Edit3 size={11} />{!mobile && ' Modifier'}
              </button>
              <button onClick={() => setDeleting(ua)} style={{ padding: '6px 8px', background: '#FEE2E2', color: C.red, border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={modal?.id ? "Modifier l'UA" : "Nouvelle UA"} onClose={() => setModal(null)} size={660}>
          <FormUA initial={modal?.id ? modal : {}} familles={familles} onSubmit={handleSubmit} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleting && <ConfirmDelete item={deleting.titre} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}

      {/* Modal Import PDF */}
      {pdfModal && (
        <Modal title="📄 Import PDF — Fiche de préparation" onClose={() => { setPdfModal(false); setPdfFile(null) }} accentColor="#7C3AED">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: '#F5F3FF', borderRadius: 10, padding: '12px 14px', border: '1px solid #DDD6FE' }}>
              <p style={{ fontSize: 12, color: '#5B21B6', fontWeight: 700, margin: '0 0 4px' }}>Comment ça marche ?</p>
              <p style={{ fontSize: 11, color: '#7C3AED', margin: 0, lineHeight: 1.5 }}>
                Uploadez une fiche de préparation PDF. Claude Sonnet analysera le document et créera automatiquement une UA complète (titre, leçon, compétences, exercices).
              </p>
            </div>

            <div>
              <FieldLabel required>Famille de destination</FieldLabel>
              <select value={pdfFamille} onChange={e => setPdfFamille(e.target.value)} style={inputBase}
                onFocus={e => e.target.style.borderColor = '#7C3AED'} onBlur={e => e.target.style.borderColor = C.brownPale}>
                <option value="">— Sélectionner une famille —</option>
                {familles.map(f => <option key={f.id} value={f.id}>{f.titre}</option>)}
              </select>
            </div>

            <div>
              <FieldLabel required>Fichier PDF</FieldLabel>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                border: `2px dashed ${pdfFile ? '#7C3AED' : C.brownPale}`,
                borderRadius: 10, padding: '24px 16px', cursor: 'pointer',
                background: pdfFile ? '#F5F3FF' : C.brownGhost, transition: 'all .2s',
              }}>
                <Upload size={24} color={pdfFile ? '#7C3AED' : C.textSec} style={{ marginBottom: 8 }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: pdfFile ? '#7C3AED' : C.textSec, margin: '0 0 4px' }}>
                  {pdfFile ? pdfFile.name : 'Cliquer pour sélectionner un PDF'}
                </p>
                <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>
                  {pdfFile ? `${(pdfFile.size / 1024).toFixed(0)} Ko` : 'PDF uniquement · max 10 Mo'}
                </p>
                <input type="file" accept=".pdf" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) setPdfFile(e.target.files[0]) }} />
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <CancelBtn onClose={() => { setPdfModal(false); setPdfFile(null) }} />
              <button
                onClick={handlePdfImport}
                disabled={pdfLoading || !pdfFile || !pdfFamille}
                style={{
                  flex: 2, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800,
                  background: pdfLoading || !pdfFile || !pdfFamille
                    ? '#E5E7EB' : 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                  color: pdfLoading || !pdfFile || !pdfFamille ? C.textSec : 'white',
                  cursor: pdfLoading || !pdfFile || !pdfFamille ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {pdfLoading
                  ? <><Spinner size={14} color="white" /> Analyse en cours…</>
                  : <><Upload size={14} /> Importer et créer l'UA</>}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
// ── TAB EXERCICES ────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════

function FormExercice({ initial = {}, uas = [], onSubmit, onClose }) {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const inputBase = getInputBase(C)

  const initDisplayType = () => {
    if (initial.type === 'qcm' && initial.options?.[0]?.startsWith?.('__img__:')) return 'identification'
    if (initial.type === 'reponse_libre' && initial.enonce?.startsWith?.('__APC__')) return 'situation_apc'
    if (initial.type === 'qcm' && initial.options?.length === 2 && initial.options?.includes?.('Vrai')) return 'vrai_faux'
    return initial.type || 'qcm'
  }
  const initAPC = () => {
    if (initial.enonce?.startsWith('__APC__')) { try { return JSON.parse(initial.enonce.slice(7)) } catch {} }
    return { contexte: '', consigne: '', ressources: '', criteres: '' }
  }
  const initChoices = () => {
    if (initial.options?.[0]?.startsWith?.('__img__:')) {
      const c = initial.options.slice(1); return c.length >= 4 ? c : [...c, ...Array(4 - c.length).fill('')]
    }
    return initial.options?.length ? [...initial.options, ...Array(Math.max(0, 4 - initial.options.length)).fill('')].slice(0, 4) : ['', '', '', '']
  }

  const [form, setForm] = useState({
    titre: initial.titre || '', type: initDisplayType(),
    enonce: initial.enonce?.startsWith('__APC__') ? '' : (initial.enonce || ''),
    options: initChoices(),
    propositions: (!initial.options?.[0]?.startsWith?.('__img__:') && initial.options?.length) ? initial.options.join(', ') : '',
    reponse_correcte: initial.reponse_correcte || '',
    reponses_trou: (() => {
      try { const p = JSON.parse(initial.reponse_correcte || ''); if (Array.isArray(p)) return p } catch {}
      return [initial.reponse_correcte || '']
    })(),
    explication: initial.explication || '', indice_1: initial.indice_1 || '',
    indice_2: initial.indice_2 || '', competence_evaluee: initial.competence_evaluee || '',
    difficulte: initial.difficulte || 1, points: initial.points || 10,
    ua_id: initial.ua_id || uas[0]?.id || '',
    groupe: initial.groupe ?? null,
    groupe_titre: initial.groupe_titre || '',
    image_url: initial.options?.[0]?.startsWith?.('__img__:') ? initial.options[0].slice(8) : '',
    apc: initAPC(),
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const setAPC = (k, v) => setForm(f => ({ ...f, apc: { ...f.apc, [k]: v } }))

  function getApiPayload() {
    const apiType = ['vrai_faux', 'identification'].includes(form.type) ? 'qcm'
      : form.type === 'situation_apc' ? 'reponse_libre' : form.type
    const apiEnonce = form.type === 'situation_apc'
      ? '__APC__' + JSON.stringify(form.apc) : form.enonce
    let options = null
    if (form.type === 'identification')  options = [`__img__:${form.image_url}`, ...form.options.filter(o => o.trim())]
    else if (form.type === 'qcm')        options = form.options.filter(o => o.trim())
    else if (form.type === 'vrai_faux')  options = ['Vrai', 'Faux']
    else if (form.type === 'texte_trou') {
      const p = form.propositions.split(',').map(s => s.trim()).filter(Boolean)
      options = p.length ? p : null
    }
    const nbBlanks = (form.enonce.match(/___/g) || []).length
    const rcTrou = form.type === 'texte_trou'
      ? (nbBlanks > 1
        ? JSON.stringify(form.reponses_trou.slice(0, nbBlanks).map(r => r || ''))
        : (form.reponses_trou[0] || ''))
      : form.reponse_correcte
    return { titre: form.titre, type: apiType, enonce: apiEnonce, options,
      reponse_correcte: rcTrou, explication: form.explication,
      indice_1: form.indice_1, indice_2: form.indice_2,
      competence_evaluee: form.competence_evaluee,
      difficulte: parseInt(form.difficulte), points: parseInt(form.points),
      groupe: form.groupe,
      groupe_titre: form.groupe > 0 ? (form.groupe_titre || null) : null,
      ua_id: form.ua_id }
  }

  async function handle(e) {
    e.preventDefault(); setLoading(true)
    try { await onSubmit(getApiPayload()) } finally { setLoading(false) }
  }

  const SEC = (label, color = C.brown, bg = C.brownPale) => (
    <p style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 5 }}>
      {label}
    </p>
  )

  return (
    <form onSubmit={handle}>
      {/* ── Section : Paramètres ── */}
      <div style={{ background: C.brownPale, borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
        {SEC('Paramètres')}
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 220px', gap: 10 }}>
          <FInput label="Titre court" value={form.titre} onChange={e => set('titre', e.target.value)} placeholder="ex : Identifier les périphériques" required />
          <FSelect label="Type d'exercice" value={form.type}
            onChange={e => set('type', e.target.value)}
            options={[
              { value: 'qcm',           label: '🔤 QCM — choix multiple' },
              { value: 'vrai_faux',     label: '✅ Vrai / Faux' },
              { value: 'texte_trou',    label: '🔲 Texte à trous' },
              { value: 'reponse_libre', label: '✏️ Réponse libre' },
              { value: 'identification',label: '🖼️ Identification schéma' },
              { value: 'situation_apc', label: '🎯 Situation-problème APC' },
            ]} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr 1fr' : (uas.length ? '2fr 1fr 1fr 1fr 2fr' : '1fr 1fr 1fr 2fr'), gap: 10 }}>
          {uas.length > 0 && <FSelect label="UA parente" value={form.ua_id} onChange={e => set('ua_id', e.target.value)} required options={uas.map(u => ({ value: u.id, label: u.titre.substring(0, 40) }))} />}
          <FSelect label="Difficulté" value={form.difficulte} onChange={e => set('difficulte', e.target.value)}
            options={[{ value: 1, label: '▲ Facile' }, { value: 2, label: '▲▲ Moyen' }, { value: 3, label: '▲▲▲ Difficile' }]} />
          <FInput label="Points" value={form.points} type="number" onChange={e => set('points', e.target.value)} />
          <FSelect label="Exercice №" value={form.groupe ?? ''} onChange={e => set('groupe', e.target.value === '' ? null : parseInt(e.target.value))}
            options={[{ value: '', label: '— Aucun —' }, { value: 1, label: 'Exercice 1' }, { value: 2, label: 'Exercice 2' }, { value: 3, label: 'Exercice 3' }, { value: 4, label: 'Exercice 4' }, { value: 5, label: 'Exercice 5' }]} />
          {form.groupe != null && (
            <FInput label="Titre de l'exercice" value={form.groupe_titre} onChange={e => set('groupe_titre', e.target.value)}
              placeholder={`ex : Définitions, Classification, Calculs…`} />
          )}
          <FInput label="Compétence APC ciblée" value={form.competence_evaluee} onChange={e => set('competence_evaluee', e.target.value)} placeholder="ex : Résoudre des problèmes" />
        </div>
      </div>

      {/* ── QCM ── */}
      {form.type === 'qcm' && (
        <>
          <RichTextarea label="Énoncé / Question" value={form.enonce} onChange={e => set('enonce', e.target.value)}
            placeholder="Quelle est la fonction principale d'un système d'exploitation ?" rows={3} required />
          <div style={{ marginBottom: 12 }}>
            <FieldLabel required>Options A B C D</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {form.options.map((opt, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: 5, background: C.brown, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, pointerEvents: 'none' }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <input value={opt} onChange={e => { const o = [...form.options]; o[i] = e.target.value; set('options', o) }}
                    placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    style={{ ...inputBase, paddingLeft: 38 }}
                    onFocus={e => e.target.style.borderColor = C.brown} onBlur={e => e.target.style.borderColor = C.brownPale} />
                </div>
              ))}
            </div>
          </div>
          <FInput label="Réponse correcte" value={form.reponse_correcte} onChange={e => set('reponse_correcte', e.target.value)} placeholder="Texte exact de la bonne option" required />
        </>
      )}

      {/* ── Vrai / Faux ── */}
      {form.type === 'vrai_faux' && (
        <>
          <RichTextarea label="Affirmation à évaluer" value={form.enonce} onChange={e => set('enonce', e.target.value)}
            placeholder="Un ordinateur peut fonctionner sans système d'exploitation." rows={2} required />
          <div style={{ marginBottom: 12 }}>
            <FieldLabel required>Réponse correcte</FieldLabel>
            <div style={{ display: 'flex', gap: 10 }}>
              {['Vrai', 'Faux'].map(v => (
                <button key={v} type="button" onClick={() => set('reponse_correcte', v)}
                  style={{ flex: 1, padding: '13px', borderRadius: 10, cursor: 'pointer', fontWeight: 800, fontSize: 15,
                    background: form.reponse_correcte === v ? (v === 'Vrai' ? C.emeraldPale : '#FEE2E2') : C.surface,
                    border: `2px solid ${form.reponse_correcte === v ? (v === 'Vrai' ? C.emerald : C.red) : C.brownPale}`,
                    color: form.reponse_correcte === v ? (v === 'Vrai' ? C.emerald : C.red) : C.text }}>
                  {v === 'Vrai' ? '✅ Vrai' : '❌ Faux'}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Texte à trous ── */}
      {form.type === 'texte_trou' && (() => {
        const nbBlanks = (form.enonce.match(/___/g) || []).length
        const parts = form.enonce.split('___')
        return (
          <>
            <RichTextarea label="Texte avec trous — utilise ___ pour chaque trou" value={form.enonce} onChange={e => set('enonce', e.target.value)}
              placeholder="Un ___ est un ensemble de ___ permettant de traiter l'information." rows={3} required />
            {nbBlanks === 0 && form.enonce.trim() && (
              <p style={{ fontSize: 11, color: C.orange, margin: '-8px 0 12px', fontWeight: 600 }}>⚠️ Ajoute ___ dans le texte pour créer des trous.</p>
            )}
            {nbBlanks > 0 && (
              <div style={{ background: C.brownPale, borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: 13, lineHeight: 2.2, fontWeight: 600, color: C.text }}>
                {parts.map((part, i) => (
                  <span key={i}>{part}{i < nbBlanks && (
                    <span style={{ display: 'inline-block', minWidth: 60, padding: '1px 8px', margin: '0 2px', borderRadius: 6,
                      background: form.reponses_trou[i] ? C.emeraldPale : '#FEE2E2',
                      border: `1.5px solid ${form.reponses_trou[i] ? C.emerald : C.red}60`,
                      color: form.reponses_trou[i] ? C.emerald : C.red,
                      fontWeight: 800, textAlign: 'center', fontSize: 12 }}>
                      {form.reponses_trou[i] || `trou ${i+1}`}
                    </span>
                  )}</span>
                ))}
              </div>
            )}
            <div style={{ marginBottom: 12 }}>
              <FieldLabel>Banque de mots (séparées par des virgules)</FieldLabel>
              <input value={form.propositions} onChange={e => set('propositions', e.target.value)}
                placeholder="processeur, mémoire RAM, disque dur, carte mère"
                style={inputBase} onFocus={e => e.target.style.borderColor = C.brown} onBlur={e => e.target.style.borderColor = C.brownPale} />
              <p style={{ fontSize: 10, color: C.textSec, margin: '4px 0 0' }}>Laisse vide → saisie libre.</p>
            </div>
            {nbBlanks > 0 && (
              <div style={{ background: '#F0FDF4', border: `1px solid ${C.emerald}25`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 800, color: C.emerald, textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 10px' }}>
                  Réponses correctes — {nbBlanks} trou{nbBlanks > 1 ? 's' : ''}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Array.from({ length: nbBlanks }, (_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 22, height: 22, borderRadius: 6, background: C.emerald, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>{i+1}</span>
                      <input value={form.reponses_trou[i] || ''}
                        onChange={e => { const arr = [...form.reponses_trou]; arr[i] = e.target.value; set('reponses_trou', arr) }}
                        placeholder={`Mot correct pour le trou ${i+1}`}
                        required
                        style={{ ...inputBase, flex: 1 }}
                        onFocus={e => e.target.style.borderColor = C.emerald} onBlur={e => e.target.style.borderColor = C.brownPale} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )
      })()}

      {/* ── Réponse libre ── */}
      {form.type === 'reponse_libre' && (
        <>
          <RichTextarea label="Question" value={form.enonce} onChange={e => set('enonce', e.target.value)}
            placeholder="Explique le rôle d'un système d'exploitation." rows={3} required />
          <RichTextarea label="Éléments de corrigé (non montrés avant validation)" value={form.reponse_correcte} onChange={e => set('reponse_correcte', e.target.value)}
            placeholder="Le SE gère le matériel, les processus, la mémoire et les fichiers." rows={3} required />
        </>
      )}

      {/* ── Identification de schéma ── */}
      {form.type === 'identification' && (
        <>
          <RichTextarea label="Consigne / Question" value={form.enonce} onChange={e => set('enonce', e.target.value)}
            placeholder="Identifie le composant indiqué sur le schéma." rows={2} required />
          <div style={{ marginBottom: 14 }}>
            <FieldLabel required>Schéma ou image à identifier</FieldLabel>
            <BlockMediaPicker value={form.image_url} accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={url => set('image_url', url)}
              previewEl={<img src={form.image_url} alt="Schéma" style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 10, display: 'block', objectFit: 'contain', border: `1px solid ${C.brownPale}` }} />} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <FieldLabel required>Propositions de réponse</FieldLabel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {form.options.map((opt, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderRadius: 5, background: '#0369A1', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, pointerEvents: 'none' }}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <input value={opt} onChange={e => { const o = [...form.options]; o[i] = e.target.value; set('options', o) }}
                    placeholder={`Étiquette ${String.fromCharCode(65 + i)}`}
                    style={{ ...inputBase, paddingLeft: 38 }}
                    onFocus={e => e.target.style.borderColor = '#0369A1'} onBlur={e => e.target.style.borderColor = C.brownPale} />
                </div>
              ))}
            </div>
          </div>
          <FInput label="Réponse correcte" value={form.reponse_correcte} onChange={e => set('reponse_correcte', e.target.value)} placeholder="Nom exact de l'élément à identifier" required />
        </>
      )}

      {/* ── Situation-problème APC ── */}
      {form.type === 'situation_apc' && (
        <>
          <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 12px' }}>📋 Situation-problème (APC)</p>
            <FTextarea label="Contexte / Mise en situation" value={form.apc.contexte} onChange={e => setAPC('contexte', e.target.value)}
              placeholder="Tu es technicien dans une école. Le directeur te demande d'installer un logiciel sur 30 postes…" rows={4} required />
            <FTextarea label="🎯 Consigne — ce que l'apprenant doit produire" value={form.apc.consigne} onChange={e => setAPC('consigne', e.target.value)}
              placeholder="1. Identifie le type de logiciel à installer.&#10;2. Décris les étapes d'installation.&#10;3. Justifie ton choix." rows={4} required />
            <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
              <FTextarea label="📚 Ressources disponibles" value={form.apc.ressources} onChange={e => setAPC('ressources', e.target.value)}
                placeholder="Manuel TIC, Internet, documentation…" rows={2} />
              <FTextarea label="✅ Critères d'évaluation (barème)" value={form.apc.criteres} onChange={e => setAPC('criteres', e.target.value)}
                placeholder="Identification correcte (4 pts)&#10;Étapes complètes (8 pts)&#10;Justification (8 pts)" rows={2} />
            </div>
          </div>
          <RichTextarea label="Éléments de corrigé (non montrés avant validation)" value={form.reponse_correcte} onChange={e => set('reponse_correcte', e.target.value)}
            placeholder="Corrigé : logiciel d'application — étapes : 1. Vérifier la compatibilité…" rows={4} required />
        </>
      )}

      {/* ── Feedback & indices ── */}
      <div style={{ background: '#F0FDF4', border: `1px solid ${C.emerald}25`, borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: C.emerald, textTransform: 'uppercase', letterSpacing: .5, margin: '0 0 10px' }}>Feedback & indices</p>
        <RichTextarea label="Explication (affichée après la réponse)" value={form.explication} onChange={e => set('explication', e.target.value)}
          placeholder="Parce que le processeur est le composant central chargé d'exécuter les instructions…" rows={2} />
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 1fr', gap: 10 }}>
          <FInput label="Indice 1" value={form.indice_1} onChange={e => set('indice_1', e.target.value)} placeholder="Premier indice…" />
          <FInput label="Indice 2" value={form.indice_2} onChange={e => set('indice_2', e.target.value)} placeholder="Deuxième indice…" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}><CancelBtn onClose={onClose} /><SaveBtn loading={loading} /></div>
    </form>
  )
}

function TabExercices({ structure, filterNiveau = 'all', filterMat = 'all', onReload }) {
  const { C } = useTheme()
  const inputBase = getInputBase(C)
  const [exercices, setExercices] = useState([])
  const [loadingEx, setLoadingEx] = useState(true)
  const [search, setSearch] = useState('')
  const [filterUA, setFilterUA] = useState('all')
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [genModal, setGenModal] = useState(null)
  const [genLoading, setGenLoading] = useState(false)
  const [genForm, setGenForm] = useState({ nb: 3, type: 'qcm', difficulte: 1 })
  const [collapsed, setCollapsed] = useState({})
  const { mobile } = useBreakpoint()

  const allUAs = structure
  .filter(m => filterMat === 'all' || String(m.id) === filterMat)
  .flatMap(m =>
    (m.modules || [])
      .filter(mod => filterNiveau === 'all' || String(mod.niveau_id) === filterNiveau || !mod.niveau_id)
      .flatMap(mod =>
        (mod.familles || []).flatMap(fam =>
          (fam.unites || []).map(u => ({ ...u, matiere_nom: m.nom, matiere_id: m.id, famille_id: fam.id, famille_titre: fam.titre }))
        )
      )
  )

  const loadExercices = useCallback(async () => {
    setLoadingEx(true)
    try { const { data } = await api.get('/api/cours/exercices'); setExercices(data) }
    catch {}
    finally { setLoadingEx(false) }
  }, [])

  useEffect(() => { loadExercices() }, [loadExercices])

  const filtered = exercices.filter(ex => {
    const matchUA = filterUA === 'all' || String(ex.ua_id) === filterUA
    const matchQ  = !search || ex.titre?.toLowerCase().includes(search.toLowerCase()) || ex.enonce?.toLowerCase().includes(search.toLowerCase())
    return matchUA && matchQ
  })

  async function handleSubmit(payload) {
    try {
      if (modal?.id) { await api.put(`/api/cours/exercices/${modal.id}`, payload); toast.success('Exercice mis à jour !') }
      else { await api.post('/api/cours/exercices', payload); toast.success('Exercice créé !') }
      setModal(null); loadExercices()
    } catch { toast.error('Erreur') }
  }

  async function handleDelete() {
    try { await api.delete(`/api/cours/exercices/${deleting.id}`); toast.success('Exercice supprimé'); setDeleting(null); loadExercices() }
    catch { toast.error('Erreur') }
  }

  async function handleGenerate() {
    if (!genModal?.ua_id) return toast.error('Sélectionnez une UA')
    setGenLoading(true)
    try {
      const { data } = await api.post(`/api/admin/generer-exercices/${genModal.ua_id}`, genForm)
      toast.success(data.message)
      setGenModal(null)
      loadExercices()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Erreur de génération IA'
      toast.error(msg)
    }
    finally { setGenLoading(false) }
  }

  const TypeBadge = ({ type, options, enonce }) => {
    const isIdentif = type === 'qcm' && options?.[0]?.startsWith?.('__img__:')
    const isAPC     = type === 'reponse_libre' && enonce?.startsWith?.('__APC__')
    const isVF      = type === 'qcm' && !isIdentif && options?.length === 2 && (options.includes('Vrai') || options.includes('Faux'))
    const eff = isIdentif ? 'identification' : isAPC ? 'situation_apc' : isVF ? 'vrai_faux' : type
    const cfg = {
      qcm:           { bg: C.bluePale,  color: C.blue,    label: 'QCM'          },
      vrai_faux:     { bg: '#D1FAE5',   color: '#065F46', label: 'Vrai/Faux'    },
      texte_trou:    { bg: '#F3E8FF',   color: '#7C3AED', label: 'Trou'         },
      reponse_libre: { bg: '#FEF3C7',   color: C.orange,  label: 'Libre'        },
      identification:{ bg: '#E0F2FE',   color: '#0369A1', label: 'Schéma'       },
      situation_apc: { bg: '#FDF4FF',   color: '#7E22CE', label: 'APC'          },
    }[eff] || { bg: C.brownPale, color: C.textSec, label: type }
    return <span style={{ background: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{cfg.label}</span>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140, position: 'relative' }}>
          <Search size={13} color={C.textSec} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…" style={{ ...inputBase, paddingLeft: 30 }}
            onFocus={e => e.target.style.borderColor = C.brown} onBlur={e => e.target.style.borderColor = C.brownPale} />
        </div>
        <select value={filterUA} onChange={e => setFilterUA(e.target.value)} style={{ ...inputBase, width: 'auto', minWidth: 160 }}>
          <option value="all">Toutes les UA</option>
          {allUAs.map(u => <option key={u.id} value={u.id}>{u.titre?.substring(0, 35)}</option>)}
        </select>
        {/* Bouton Générer IA */}
        <button onClick={() => setGenModal({ ua_id: allUAs[0]?.id || '' })} style={{ padding: '9px 14px', background: `linear-gradient(135deg, #7C3AED, #5B21B6)`, color: 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <Sparkles size={13} /> Générer avec l'IA
        </button>
        <button onClick={() => setModal('create')} style={{ padding: '9px 14px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <Plus size={13} /> Nouvel exercice
        </button>
      </div>

      {/* Modal génération IA */}
      {genModal && (
        <Modal title="Générer des exercices avec l'IA" onClose={() => setGenModal(null)} size={500}>
          <div style={{ marginBottom: 16, background: '#F3E8FF', borderRadius: 10, padding: '12px 14px', border: '1px solid #DDD6FE' }}>
            <p style={{ fontSize: 12, color: '#5B21B6', fontWeight: 600, margin: 0 }}>
              ✨ Claude Haiku va générer des exercices basés sur les compétences et la situation problème de l'UA sélectionnée.
            </p>
          </div>
          <FSelect label="UA cible" value={genModal.ua_id} onChange={e => setGenModal(g => ({ ...g, ua_id: e.target.value }))} required
            options={allUAs.map(u => ({ value: u.id, label: u.titre.substring(0, 55) }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel>Nombre</FieldLabel>
              <input type="number" min={1} max={10} value={genForm.nb} onChange={e => setGenForm(g => ({ ...g, nb: parseInt(e.target.value) }))} style={inputBase}
                onFocus={e => e.target.style.borderColor = C.brown} onBlur={e => e.target.style.borderColor = C.brownPale} />
            </div>
            <FSelect label="Type" value={genForm.type} onChange={e => setGenForm(g => ({ ...g, type: e.target.value }))}
              options={[{ value: 'qcm', label: 'QCM' }, { value: 'texte_trou', label: 'Texte à trou' }, { value: 'reponse_libre', label: 'Réponse libre' }]} />
            <FSelect label="Difficulté" value={genForm.difficulte} onChange={e => setGenForm(g => ({ ...g, difficulte: parseInt(e.target.value) }))}
              options={[{ value: 1, label: '▲ Facile' }, { value: 2, label: '▲▲ Moyen' }, { value: 3, label: '▲▲▲ Difficile' }]} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button onClick={() => setGenModal(null)} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
            <button onClick={handleGenerate} disabled={genLoading} style={{ flex: 2, padding: '10px', background: 'linear-gradient(135deg, #7C3AED, #5B21B6)', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {genLoading ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Génération en cours…</> : <><Sparkles size={14} /> Générer {genForm.nb} exercice(s)</>}
            </button>
          </div>
        </Modal>
      )}

      {loadingEx ? (
        <div style={{ textAlign: 'center', padding: 40, display: 'flex', justifyContent: 'center' }}>
          <Spinner size={36} />
        </div>
      ) : (() => {
        if (filtered.length === 0) return (
          <div style={{ textAlign: 'center', padding: 40, color: C.textSec, background: C.surface, borderRadius: 16, border: `1px dashed ${C.brownLight}` }}>
            <Zap size={30} color={C.brownLight} style={{ margin: '0 auto 10px' }} />
            <p style={{ fontWeight: 600, fontSize: 14 }}>Aucun exercice</p>
            <p style={{ fontSize: 12 }}>Créez-en un manuellement ou utilisez la génération IA.</p>
          </div>
        )

        // Group by UA
        const grouped = {}
        filtered.forEach(ex => {
          const k = String(ex.ua_id || 'sans_ua')
          if (!grouped[k]) grouped[k] = []
          grouped[k].push(ex)
        })
        const groupKeys = Object.keys(grouped)
        const allAreCollapsed = groupKeys.length > 0 && groupKeys.every(k => collapsed[k])

        const typeDistrib = (exList) => {
          const counts = {}
          exList.forEach(ex => {
            const isIdentif = ex.type === 'qcm' && ex.options?.[0]?.startsWith?.('__img__:')
            const isAPC     = ex.type === 'reponse_libre' && ex.enonce?.startsWith?.('__APC__')
            const isVF      = ex.type === 'qcm' && !isIdentif && ex.options?.length === 2
            const t = isIdentif ? 'Schéma' : isAPC ? 'APC' : isVF ? 'V/F' : ex.type === 'qcm' ? 'QCM' : ex.type === 'texte_trou' ? 'Trou' : 'Libre'
            counts[t] = (counts[t] || 0) + 1
          })
          return Object.entries(counts)
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {groupKeys.length > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: C.textSec, fontWeight: 600 }}>{filtered.length} exercice{filtered.length > 1 ? 's' : ''} · {groupKeys.length} UA</span>
                <button onClick={() => {
                  const ns = {}; groupKeys.forEach(k => { ns[k] = !allAreCollapsed }); setCollapsed(ns)
                }} style={{ padding: '4px 10px', background: C.brownPale, border: 'none', borderRadius: 7, fontSize: 11, fontWeight: 700, color: C.brown, cursor: 'pointer' }}>
                  {allAreCollapsed ? '▼ Tout développer' : '▲ Tout réduire'}
                </button>
              </div>
            )}
            {groupKeys.map(key => {
              const uaInfo = allUAs.find(u => String(u.id) === key)
              const exList = grouped[key]
              const isCollapsed = !!collapsed[key]
              return (
                <div key={key}>
                  <button onClick={() => setCollapsed(p => ({ ...p, [key]: !p[key] }))}
                    style={{ width: '100%', background: `linear-gradient(135deg, ${C.brownPale}, ${C.surface})`, border: `1.5px solid ${C.brownLight}60`, borderRadius: isCollapsed ? 12 : '12px 12px 0 0', padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                    <ChevronDown size={13} color={C.brown} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform .2s', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: C.brown, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {uaInfo ? uaInfo.titre : 'Sans UA associée'}
                      </p>
                      {uaInfo?.matiere_nom && <p style={{ margin: '1px 0 0', fontSize: 10, color: C.textSec }}>{uaInfo.matiere_nom}</p>}
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {typeDistrib(exList).map(([t, n]) => (
                        <span key={t} style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 8, background: C.surface, color: C.textSec, border: `1px solid ${C.brownPale}` }}>{t}:{n}</span>
                      ))}
                    </div>
                    <span style={{ background: C.brown, color: 'white', borderRadius: 20, padding: '2px 9px', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>
                      {exList.length}
                    </span>
                  </button>
                  {!isCollapsed && (() => {
                    // Sub-group by groupe within the UA
                    const hasGroups = exList.some(e => e.groupe != null)
                    const subGroups = hasGroups
                      ? Object.entries(
                          exList.reduce((acc, e) => {
                            const k = e.groupe != null ? String(e.groupe) : 'null'
                            if (!acc[k]) acc[k] = []
                            acc[k].push(e)
                            return acc
                          }, {})
                        ).sort(([a], [b]) => (a === 'null' ? 1 : b === 'null' ? -1 : parseInt(a) - parseInt(b)))
                      : [['all', exList]]

                    const ExRow = (ex, i, total) => (
                      <div key={ex.id} style={{ backgroundColor: i % 2 === 0 ? C.surface : C.bg, padding: mobile ? '10px 12px' : '10px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: i < total - 1 ? `1px solid ${C.brownPale}` : 'none' }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0 }}>{i + 1}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.titre || ex.enonce?.substring(0, 50) + '…'}</p>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                            <TypeBadge type={ex.type} options={ex.options} enonce={ex.enonce} />
                            <span style={{ fontSize: 10, color: C.textSec }}>Diff. {ex.difficulte} · {ex.points} pts</span>
                            {ex.competence_evaluee && <span style={{ fontSize: 10, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>· {ex.competence_evaluee}</span>}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                          <button onClick={() => setModal(ex)} style={{ padding: '5px 9px', background: C.bluePale, color: C.blue, border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700 }}>
                            <Edit3 size={11} />{!mobile && ' Modifier'}
                          </button>
                          <button onClick={() => setDeleting(ex)} style={{ padding: '5px 8px', background: '#FEE2E2', color: C.red, border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    )

                    return (
                      <div style={{ border: `1.5px solid ${C.brownLight}60`, borderTop: 'none', borderRadius: '0 0 12px 12px', overflow: 'hidden' }}>
                        {subGroups.map(([gKey, gList]) => (
                          <div key={gKey}>
                            {hasGroups && (
                              <div style={{ background: gKey === 'null' ? C.brownPale : `${C.emerald}12`, borderTop: `1px solid ${C.brownPale}`, padding: '5px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, fontWeight: 800, color: gKey === 'null' ? C.textSec : C.emerald, textTransform: 'uppercase', letterSpacing: .5 }}>
                                  {gKey === 'null' ? 'Sans exercice' : `Exercice ${gKey}`}
                                  {gKey !== 'null' && gList[0]?.groupe_titre ? ` : ${gList[0].groupe_titre}` : ''}
                                </span>
                                <span style={{ fontSize: 9, background: gKey === 'null' ? C.brownPale : `${C.emerald}22`, color: gKey === 'null' ? C.textSec : C.emerald, borderRadius: 10, padding: '1px 6px', fontWeight: 700 }}>{gList.length} question{gList.length > 1 ? 's' : ''}</span>
                              </div>
                            )}
                            {gList.map((ex, i) => ExRow(ex, i, gList.length))}
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>
        )
      })()}

      {modal && (
        <Modal title={modal?.id ? "Modifier l'exercice" : 'Nouvel exercice'} onClose={() => setModal(null)} size={680}>
          <FormExercice initial={modal?.id ? modal : {}} uas={allUAs} onSubmit={handleSubmit} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleting && <ConfirmDelete item={deleting.titre || 'cet exercice'} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
    </div>
  )
}


// ── Block Editor ─────────────────────────────────────────────────
function parseBlocks(contenu) {
  if (!contenu) return [newBlock('texte')]
  try {
    const p = JSON.parse(contenu)
    if (Array.isArray(p) && p.length > 0) return p
  } catch {}
  return [{ id: crypto.randomUUID(), type: 'texte', valeur: contenu }]
}

function newBlock(type) {
  const id = crypto.randomUUID()
  if (type === 'texte')  return { id, type, valeur: '' }
  if (type === 'titre')  return { id, type, valeur: '', niveau: 'h2' }
  if (type === 'code')   return { id, type, valeur: '', langage: 'python' }
  if (type === 'alerte') return { id, type, valeur: '', style: 'info' }
  if (type === 'liste')  return { id, type, items: [''] }
  if (type === 'video')  return { id, type, url: '', titre: '' }
  if (type === 'image')  return { id, type, url: '', alt: '', legende: '' }
  if (type === 'audio')   return { id, type, url: '', titre: '' }
  if (type === 'tableau') return { id, type, entetes: ['Colonne 1', 'Colonne 2'], lignes: [['', ''], ['', '']] }
  return { id, type }
}

const BLOCK_META = {
  texte:  { label: 'Texte',  badge: '¶',   color: '#4B5563', bg: '#F9FAFB' },
  titre:  { label: 'Titre',  badge: 'Hx',  color: '#92400E', bg: '#FEF3C7' },
  code:   { label: 'Code',   badge: '</>',  color: '#065F46', bg: '#D1FAE5' },
  alerte: { label: 'Alerte', badge: '!',   color: '#1E40AF', bg: '#DBEAFE' },
  liste:  { label: 'Liste',  badge: '≡',   color: '#6B21A8', bg: '#F3E8FF' },
  video:  { label: 'Vidéo',  badge: '▶',   color: '#BE185D', bg: '#FCE7F3' },
  image:   { label: 'Image',   badge: '⬚',  color: '#0369A1', bg: '#E0F2FE' },
  audio:   { label: 'Audio',   badge: '♫',  color: '#7C3AED', bg: '#EDE9FE' },
  tableau: { label: 'Tableau', badge: '⊞',  color: '#0F766E', bg: '#CCFBF1' },
}

const ALERTE_STYLES = {
  info:    { bg: '#EFF6FF', border: '#3B82F6', color: '#1E40AF', emoji: 'ℹ' },
  success: { bg: '#F0FDF4', border: '#22C55E', color: '#166534', emoji: '✓' },
  warning: { bg: '#FFFBEB', border: '#F59E0B', color: '#92400E', emoji: '⚠' },
  danger:  { bg: '#FEF2F2', border: '#EF4444', color: '#991B1B', emoji: '✕' },
}

function countWords(contenu) {
  if (!contenu) return 0
  try {
    const p = JSON.parse(contenu)
    if (Array.isArray(p)) return p.reduce((s, b) => {
      if (b.valeur) return s + b.valeur.split(/\s+/).filter(Boolean).length
      if (b.items)  return s + b.items.join(' ').split(/\s+/).filter(Boolean).length
      return s
    }, 0)
  } catch {}
  return contenu.split(/\s+/).filter(Boolean).length
}

function BlockMediaPicker({ value, accept, onChange: onUrlChange, previewEl }) {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const inputBase = getInputBase(C, mobile)
  const [uploading, setUploading] = useState(false)
  const ref = useRef(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const { data } = await api.post('/api/admin/upload-media', fd)
      onUrlChange(data.url)
      toast.success('Fichier envoyé !')
    } catch (err) {
      toast.error('Upload échoué : ' + (err?.response?.data?.detail || 'Vérifiez SUPABASE_URL et SUPABASE_SERVICE_KEY'))
    } finally {
      setUploading(false)
      if (ref.current) ref.current.value = ''
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input type="text" value={value} onChange={e => onUrlChange(e.target.value)}
          placeholder="Coller une URL ou cliquer sur Envoyer…"
          style={{ ...inputBase, flex: 1 }}
          onFocus={e => e.target.style.borderColor = C.brown}
          onBlur={e => e.target.style.borderColor = C.brownPale} />
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          style={{ padding: '8px 14px', background: uploading ? C.brownPale : `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: uploading ? C.brown : 'white', border: 'none', borderRadius: 8, cursor: uploading ? 'default' : 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {uploading ? <><Loader size={13} /> Envoi…</> : <><Upload size={13} /> Envoyer</>}
        </button>
        <input ref={ref} type="file" accept={accept} onChange={handleFile} style={{ display: 'none' }} />
      </div>
      {value && <div style={{ marginTop: 10 }}>{previewEl}</div>}
    </div>
  )
}

function BlockEditorItem({ block, index, total, onChange, onDelete, onMove }) {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const inputBase = getInputBase(C, mobile)
  const meta = BLOCK_META[block.type] || BLOCK_META.texte
  const set = (key, val) => onChange({ ...block, [key]: val })

  return (
    <div style={{ background: C.surface, borderRadius: 12, border: `1.5px solid ${meta.color}25`, marginBottom: 10, overflow: 'hidden', boxShadow: '0 2px 6px rgba(0,0,0,.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: meta.bg, borderBottom: `1px solid ${meta.color}15` }}>
        <span style={{ width: 22, height: 22, borderRadius: 5, background: meta.color, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, flexShrink: 0 }}>{meta.badge}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: meta.color, flex: 1 }}>{meta.label}</span>
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
          style={{ padding: '2px 7px', background: 'none', border: `1px solid ${meta.color}30`, borderRadius: 4, cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? .3 : 1, color: meta.color, fontSize: 12 }}>↑</button>
        <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
          style={{ padding: '2px 7px', background: 'none', border: `1px solid ${meta.color}30`, borderRadius: 4, cursor: index === total - 1 ? 'default' : 'pointer', opacity: index === total - 1 ? .3 : 1, color: meta.color, fontSize: 12 }}>↓</button>
        <button type="button" onClick={onDelete}
          style={{ padding: '3px 7px', background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>✕</button>
      </div>

      <div style={{ padding: '12px 14px' }}>
        {block.type === 'texte' && (
          <RichTextarea value={block.valeur}
            onChange={e => set('valeur', e.target.value)}
            placeholder="Écrivez votre paragraphe… LaTeX: $x^2$  Gras: **texte**  Image: toolbar ↑" rows={4} />
        )}

        {block.type === 'titre' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <select value={block.niveau} onChange={e => set('niveau', e.target.value)}
              style={{ ...inputBase, width: 72, flex: 'none', fontWeight: 800 }}>
              <option value="h1">H1</option>
              <option value="h2">H2</option>
              <option value="h3">H3</option>
            </select>
            <input value={block.valeur} onChange={e => set('valeur', e.target.value)}
              placeholder="Titre de section…"
              style={{ ...inputBase, fontSize: block.niveau === 'h1' ? 17 : block.niveau === 'h2' ? 15 : 13, fontWeight: 800, color: C.brownDark }}
              onFocus={e => e.target.style.borderColor = C.brown}
              onBlur={e => e.target.style.borderColor = C.brownPale} />
          </div>
        )}

        {block.type === 'code' && (
          <>
            <select value={block.langage} onChange={e => set('langage', e.target.value)}
              style={{ ...inputBase, width: 'auto', marginBottom: 8 }}>
              {['python','javascript','java','c','cpp','html','css','sql','bash','autre'].map(l =>
                <option key={l} value={l}>{l}</option>)}
            </select>
            <textarea value={block.valeur} onChange={e => set('valeur', e.target.value)}
              placeholder={`print("Hello")`} rows={6}
              style={{ ...inputBase, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, background: '#0F172A', color: '#E2E8F0', border: '1.5px solid #1E293B' }} />
          </>
        )}

        {block.type === 'alerte' && (
          <>
            <select value={block.style} onChange={e => set('style', e.target.value)}
              style={{ ...inputBase, width: 'auto', marginBottom: 8 }}>
              <option value="info">ℹ Info</option>
              <option value="success">✓ Succès</option>
              <option value="warning">⚠ Attention</option>
              <option value="danger">✕ Danger</option>
            </select>
            <textarea value={block.valeur} onChange={e => set('valeur', e.target.value)}
              placeholder="Message important à retenir…" rows={3}
              style={{ ...inputBase, resize: 'vertical', background: ALERTE_STYLES[block.style]?.bg || '#EFF6FF', border: `1.5px solid ${ALERTE_STYLES[block.style]?.border || '#3B82F6'}` }}
              onFocus={e => e.target.style.borderColor = ALERTE_STYLES[block.style]?.border}
              onBlur={e => e.target.style.borderColor = ALERTE_STYLES[block.style]?.border} />
          </>
        )}

        {block.type === 'liste' && (
          <div>
            {(block.items || []).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                <span style={{ color: C.brown, fontWeight: 900, flexShrink: 0 }}>•</span>
                <input value={item} onChange={e => {
                  const items = [...block.items]; items[i] = e.target.value; onChange({ ...block, items })
                }}
                  placeholder={`Élément ${i + 1}…`} style={{ ...inputBase, flex: 1 }}
                  onFocus={e => e.target.style.borderColor = C.brown}
                  onBlur={e => e.target.style.borderColor = C.brownPale} />
                {block.items.length > 1 && (
                  <button type="button" onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
                    style={{ padding: '4px 6px', background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: 5, cursor: 'pointer' }}>
                    <X size={11} />
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={() => onChange({ ...block, items: [...(block.items || []), ''] })}
              style={{ padding: '5px 12px', background: '#F3E8FF', color: '#6B21A8', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700, marginTop: 2 }}>
              + Élément
            </button>
          </div>
        )}

        {block.type === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input value={block.url} onChange={e => set('url', e.target.value)}
              placeholder="URL (YouTube, Vimeo, lien direct…)" style={{ ...inputBase }}
              onFocus={e => e.target.style.borderColor = C.brown}
              onBlur={e => e.target.style.borderColor = C.brownPale} />
            <input value={block.titre} onChange={e => set('titre', e.target.value)}
              placeholder="Légende (optionnel)" style={{ ...inputBase }}
              onFocus={e => e.target.style.borderColor = C.brown}
              onBlur={e => e.target.style.borderColor = C.brownPale} />
          </div>
        )}

        {block.type === 'image' && (
          <div>
            <BlockMediaPicker
              value={block.url || ''}
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={url => onChange({ ...block, url })}
              previewEl={<img src={block.url} alt={block.alt || ''} style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 8, display: 'block', objectFit: 'contain' }} />}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <input value={block.alt || ''} onChange={e => set('alt', e.target.value)}
                placeholder="Texte alternatif (accessibilité)"
                style={{ ...inputBase, flex: 1 }}
                onFocus={e => e.target.style.borderColor = C.brown}
                onBlur={e => e.target.style.borderColor = C.brownPale} />
              <input value={block.legende || ''} onChange={e => set('legende', e.target.value)}
                placeholder="Légende sous l'image"
                style={{ ...inputBase, flex: 1 }}
                onFocus={e => e.target.style.borderColor = C.brown}
                onBlur={e => e.target.style.borderColor = C.brownPale} />
            </div>
          </div>
        )}

        {block.type === 'audio' && (
          <div>
            <BlockMediaPicker
              value={block.url || ''}
              accept="audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/aac,audio/x-m4a"
              onChange={url => onChange({ ...block, url })}
              previewEl={<audio controls src={block.url} style={{ width: '100%' }} />}
            />
            <input value={block.titre || ''} onChange={e => set('titre', e.target.value)}
              placeholder="Titre de l'audio (optionnel)"
              style={{ ...inputBase, marginTop: 8 }}
              onFocus={e => e.target.style.borderColor = C.brown}
              onBlur={e => e.target.style.borderColor = C.brownPale} />
          </div>
        )}

        {block.type === 'tableau' && (() => {
          const entetes = block.entetes || []
          const lignes  = block.lignes  || []
          const setEntete = (ci, v) => { const e = [...entetes]; e[ci] = v; onChange({ ...block, entetes: e }) }
          const setCell   = (ri, ci, v) => { const l = lignes.map((r, rj) => rj === ri ? r.map((c, cj) => cj === ci ? v : c) : r); onChange({ ...block, lignes: l }) }
          const addCol    = () => onChange({ ...block, entetes: [...entetes, `Col ${entetes.length + 1}`], lignes: lignes.map(r => [...r, '']) })
          const addRow    = () => onChange({ ...block, lignes: [...lignes, entetes.map(() => '')] })
          const delCol    = ci => { if (entetes.length <= 1) return; onChange({ ...block, entetes: entetes.filter((_, j) => j !== ci), lignes: lignes.map(r => r.filter((_, j) => j !== ci)) }) }
          const delRow    = ri => onChange({ ...block, lignes: lignes.filter((_, j) => j !== ri) })

          return (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 280 }}>
                <thead>
                  <tr>
                    {entetes.map((h, ci) => (
                      <th key={ci} style={{ padding: '3px 4px', background: '#CCFBF1', border: `1px solid #5EEAD4` }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          <input value={h} onChange={e => setEntete(ci, e.target.value)}
                            style={{ ...inputBase, fontSize: 11, fontWeight: 800, padding: '4px 6px', background: 'transparent', border: 'none', outline: 'none', width: '100%', color: '#0F766E' }} />
                          {entetes.length > 1 && (
                            <button type="button" onClick={() => delCol(ci)}
                              style={{ padding: '0 4px', background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 9, flexShrink: 0 }}>✕</button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th style={{ width: 28, background: '#CCFBF1', border: `1px solid #5EEAD4` }}>
                      <button type="button" onClick={addCol}
                        style={{ width: '100%', padding: '4px 0', background: '#0F766E', color: 'white', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 900 }}>+</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lignes.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ padding: '2px 4px', border: `1px solid ${C.brownPale}` }}>
                          <input value={cell} onChange={e => setCell(ri, ci, e.target.value)}
                            style={{ ...inputBase, fontSize: 12, padding: '5px 7px', border: 'none', outline: 'none', background: 'transparent', width: '100%' }} />
                        </td>
                      ))}
                      <td style={{ width: 28, border: `1px solid ${C.brownPale}`, textAlign: 'center' }}>
                        <button type="button" onClick={() => delRow(ri)}
                          style={{ padding: '3px 6px', background: '#FEE2E2', color: '#B91C1C', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 9 }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button type="button" onClick={addRow}
                style={{ marginTop: 6, padding: '5px 14px', background: '#CCFBF1', color: '#0F766E', border: `1px solid #5EEAD4`, borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                + Ligne
              </button>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

function BlockEditor({ blocks, onChange }) {
  const { C } = useTheme()
  const add    = type => onChange([...blocks, newBlock(type)])
  const update = (i, b) => { const n = [...blocks]; n[i] = b; onChange(n) }
  const remove = i => onChange(blocks.length === 1 ? [newBlock('texte')] : blocks.filter((_, j) => j !== i))
  const move   = (i, dir) => {
    const n = [...blocks], t = i + dir
    if (t < 0 || t >= n.length) return
    ;[n[i], n[t]] = [n[t], n[i]]; onChange(n)
  }

  return (
    <div>
      {blocks.map((b, i) => (
        <BlockEditorItem key={b.id} block={b} index={i} total={blocks.length}
          onChange={upd => update(i, upd)}
          onDelete={() => remove(i)}
          onMove={dir => move(i, dir)} />
      ))}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '9px 12px', background: C.bg, borderRadius: 10, border: `1.5px dashed ${C.brownPale}` }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.textSec, alignSelf: 'center', marginRight: 2 }}>+ Ajouter :</span>
        {Object.entries(BLOCK_META).map(([type, m]) => (
          <button key={type} type="button" onClick={() => add(type)}
            style={{ padding: '4px 10px', background: m.bg, color: m.color, border: `1px solid ${m.color}35`, borderRadius: 20, cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontWeight: 900, fontSize: 10 }}>{m.badge}</span> {m.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function BlockRenderer({ contenu }) {
  const { C } = useTheme()
  if (!contenu) return <p style={{ color: C.textSec, fontStyle: 'italic', fontSize: 13 }}>Aucun contenu.</p>

  let blocks = null
  try {
    const p = JSON.parse(contenu)
    if (Array.isArray(p) && p.length > 0) blocks = p
  } catch {}

  if (!blocks) return <MarkdownPreview content={contenu} />

  return (
    <div style={{ fontSize: 13, lineHeight: 1.7, color: C.text }}>
      {blocks.map((block, i) => {
        if (block.type === 'texte') return (
          <div key={i} style={{ margin: '0 0 12px' }}>
            <RichText text={block.valeur} style={{ fontSize: 13, lineHeight: 1.7 }} />
          </div>
        )
        if (block.type === 'titre') {
          const s = {
            h1: { fontSize: 20, fontWeight: 900, color: C.brownDark, margin: '4px 0 14px', borderBottom: `2px solid ${C.brownPale}`, paddingBottom: 6 },
            h2: { fontSize: 16, fontWeight: 800, color: C.brown, margin: '18px 0 10px', borderBottom: `2px solid ${C.brownPale}`, paddingBottom: 4 },
            h3: { fontSize: 14, fontWeight: 800, color: C.brown, margin: '14px 0 8px', borderLeft: `3px solid ${C.brownLight}`, paddingLeft: 8 },
          }[block.niveau] || {}
          return <div key={i} style={s}>{block.valeur}</div>
        }
        if (block.type === 'code') return (
          <div key={i} style={{ margin: '14px 0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ background: '#1E293B', padding: '5px 14px' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{block.langage}</span>
            </div>
            <pre style={{ background: '#0F172A', color: '#E2E8F0', padding: '14px 16px', margin: 0, overflow: 'auto', fontSize: 12, lineHeight: 1.6, fontFamily: 'monospace' }}>
              <code>{block.valeur}</code>
            </pre>
          </div>
        )
        if (block.type === 'alerte') {
          const s = ALERTE_STYLES[block.style] || ALERTE_STYLES.info
          return (
            <div key={i} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '12px 16px', margin: '12px 0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{s.emoji}</span>
              <span style={{ color: s.color, fontWeight: 600 }}><RichTextInline text={block.valeur} /></span>
            </div>
          )
        }
        if (block.type === 'liste') return (
          <ul key={i} style={{ margin: '8px 0 14px', paddingLeft: 0, listStyle: 'none' }}>
            {(block.items || []).map((item, j) => (
              <li key={j} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <span style={{ color: C.brownLight, fontWeight: 900, flexShrink: 0 }}>•</span>
                <span><RichTextInline text={item} /></span>
              </li>
            ))}
          </ul>
        )
        if (block.type === 'video') {
          const ytM = block.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
          if (ytM) return (
            <div key={i} style={{ margin: '14px 0', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
              <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
                <iframe src={`https://www.youtube.com/embed/${ytM[1]}`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  allowFullScreen frameBorder="0" title={block.titre || 'Vidéo'} />
              </div>
              {block.titre && <p style={{ padding: '6px 12px', background: '#1F2937', color: '#9CA3AF', fontSize: 11, margin: 0 }}>{block.titre}</p>}
            </div>
          )
          return (
            <div key={i} style={{ margin: '12px 0' }}>
              <a href={block.url} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'underline' }}>🎬 {block.titre || block.url}</a>
            </div>
          )
        }
        if (block.type === 'image' && block.url) return (
          <figure key={i} style={{ margin: '14px 0', textAlign: 'center' }}>
            <img src={block.url} alt={block.alt || ''}
              style={{ maxWidth: '100%', borderRadius: 10, boxShadow: '0 4px 14px rgba(0,0,0,.1)', display: 'block', margin: '0 auto' }} />
            {block.legende && <figcaption style={{ fontSize: 11, color: C.textSec, marginTop: 6, fontStyle: 'italic' }}>{block.legende}</figcaption>}
          </figure>
        )
        if (block.type === 'audio' && block.url) return (
          <div key={i} style={{ margin: '14px 0', background: '#F5F3FF', borderRadius: 12, padding: '14px 16px', border: '1.5px solid #DDD6FE' }}>
            {block.titre && <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#6D28D9' }}>🎵 {block.titre}</p>}
            <audio controls src={block.url} style={{ width: '100%' }} />
          </div>
        )
        return null
      })}
    </div>
  )
}

function FormRessource({ initial = {}, uas = [], onSubmit, onClose }) {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const inputBase = getInputBase(C, mobile)
  const [form, setForm] = useState({
    titre:       initial.titre       || '',
    type:        initial.type        || 'lecon',
    contenu:     initial.contenu     || '',
    points_cles: initial.points_cles || [],
    ordre:       initial.ordre       || 1,
    ua_id:       initial.ua_id       || uas[0]?.id || '',
  })
  const [blocks,   setBlocks]   = useState(() => parseBlocks(initial.contenu || ''))
  const [loading,  setLoading]  = useState(false)
  const [pkDraft,  setPkDraft]  = useState('')
  const [preview,  setPreview]  = useState(false)

  const TYPE_OPTS = [
    { value: 'lecon',  label: '📖 Leçon'  },
    { value: 'tp',     label: '🔬 TP'     },
    { value: 'resume', label: '📋 Résumé' },
    { value: 'video',  label: '🎬 Vidéo'  },
  ]

  function addPk() {
    const t = pkDraft.trim()
    if (t) { setForm(f => ({ ...f, points_cles: [...f.points_cles, t] })); setPkDraft('') }
  }

  async function handle(e) {
    e.preventDefault(); setLoading(true)
    try {
      await onSubmit({
        ua_id:       form.ua_id,
        titre:       form.titre,
        type:        form.type,
        contenu:     JSON.stringify(blocks),
        points_cles: form.points_cles,
        ordre:       parseInt(form.ordre),
      })
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handle}>
      {/* UA + type */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 160px', gap: 12 }}>
        <FSelect label="UA parente" value={form.ua_id}
          onChange={e => setForm(f => ({ ...f, ua_id: e.target.value }))} required
          options={uas.map(u => ({ value: u.id, label: u.titre.substring(0, 50) }))} />
        <FSelect label="Type" value={form.type}
          onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          options={TYPE_OPTS} />
      </div>

      <FInput label="Titre de la ressource" value={form.titre}
        onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
        placeholder="ex: Cours — Les structures de contrôle" required />

      {/* Éditeur par blocs */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <FieldLabel required>Contenu</FieldLabel>
          <button type="button" onClick={() => setPreview(p => !p)} style={{
            padding: '3px 10px', background: preview ? C.brownPale : C.bluePale,
            color: preview ? C.brown : C.blue, border: 'none', borderRadius: 6,
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>
            {preview ? '✏️ Éditer' : '👁 Aperçu'}
          </button>
        </div>

        {preview ? (
          <div style={{ border: `1.5px solid ${C.brownPale}`, borderRadius: 12, padding: 20, minHeight: 200, background: '#FAFAFA' }}>
            <ContentRenderer content={JSON.stringify(blocks)} />
          </div>
        ) : (
          <BlockEditor blocks={blocks} onChange={setBlocks} />
        )}
      </div>

      {/* Points clés */}
      <div style={{ marginBottom: 12 }}>
        <FieldLabel>Points clés à retenir</FieldLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
          {form.points_cles.map((pk, i) => (
            <span key={i} style={{ background: '#FEF3C7', color: '#92400E', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
              → {pk}
              <button type="button" onClick={() => setForm(f => ({ ...f, points_cles: f.points_cles.filter((_, j) => j !== i) }))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B45309', padding: 0, display: 'flex' }}>
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={pkDraft} onChange={e => setPkDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPk() } }}
            placeholder="Ajouter un point clé puis Entrée…"
            style={{ ...inputBase, flex: 1 }}
            onFocus={e => e.target.style.borderColor = C.brown}
            onBlur={e => e.target.style.borderColor = C.brownPale}
          />
          <button type="button" onClick={addPk} style={{ padding: '0 14px', background: C.gold, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>+ Ajouter</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <CancelBtn onClose={onClose} />
        <SaveBtn loading={loading} />
      </div>
    </form>
  )
}

// Aperçu Markdown simplifié (identique à LeconReader)
function MarkdownPreview({ content }) {
  const { C } = useTheme()
  if (!content) return <p style={{ color: C.textSec, fontStyle: 'italic', fontSize: 13 }}>Aucun contenu à afficher.</p>
  const lines = content.split('\n')
  return (
    <div style={{ fontSize: 13, lineHeight: 1.7, color: C.text }}>
      {lines.map((line, i) => {
        if (line.startsWith('# '))  return <h1 key={i} style={{ fontSize: 18, fontWeight: 900, color: C.brownDark, margin: '0 0 12px' }}>{line.slice(2)}</h1>
        if (line.startsWith('## ')) return <h2 key={i} style={{ fontSize: 15, fontWeight: 800, color: C.brown, margin: '16px 0 8px', borderBottom: `2px solid ${C.brownPale}`, paddingBottom: 4 }}>{line.slice(3)}</h2>
        if (line.startsWith('### ')) return <h3 key={i} style={{ fontSize: 13, fontWeight: 800, color: C.brown, margin: '12px 0 6px', borderLeft: `3px solid ${C.brownLight}`, paddingLeft: 8 }}>{line.slice(4)}</h3>
        if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 4 }}><span style={{ color: C.brownLight, fontWeight: 900 }}>•</span><span>{line.slice(2)}</span></div>
        if (line.startsWith('> ')) return <blockquote key={i} style={{ borderLeft: `4px solid ${C.gold}`, paddingLeft: 12, margin: '8px 0', background: '#FEF9E7', borderRadius: '0 6px 6px 0', padding: '8px 12px', fontStyle: 'italic' }}>{line.slice(2)}</blockquote>
        if (line.startsWith('```')) return null
        if (line.trim() === '') return <div key={i} style={{ height: 6 }} />
        return <p key={i} style={{ margin: '0 0 4px' }}>{line}</p>
      })}
    </div>
  )
}

function TabContenu({ structure, filterNiveau = 'all', filterMat = 'all', onReload }) {
  const { C } = useTheme()
  const { mobile } = useBreakpoint()
  const inputBase = getInputBase(C, mobile)
  const [ressources,   setRessources]   = useState([])
  const [loadingRes,   setLoadingRes]   = useState(true)
  const [modal,        setModal]        = useState(null)
  const [deleting,     setDeleting]     = useState(null)
  const [filterUA,     setFilterUA]     = useState('all')
  const [search,       setSearch]       = useState('')

  const allUAs = structure
  .filter(m => filterMat === 'all' || String(m.id) === filterMat)
  .flatMap(m =>
    (m.modules || [])
      .filter(mod => filterNiveau === 'all' || String(mod.niveau_id) === filterNiveau || !mod.niveau_id)
      .flatMap(mod =>
        (mod.familles || []).flatMap(fam =>
          (fam.unites || []).map(u => ({ ...u, matiere_nom: m.nom, matiere_id: m.id, famille_id: fam.id, famille_titre: fam.titre }))
        )
      )
  )

  const loadRessources = useCallback(async () => {
    setLoadingRes(true)
    try {
      // Charge les ressources de toutes les UA
      const all = []
      for (const ua of allUAs) {
        try {
          const { data } = await api.get(`/api/cours/ua/${ua.id}`)
          for (const r of (data.ressources || [])) {
            all.push({ ...r, ua_titre: ua.titre, ua_id: ua.id, matiere_nom: ua.matiere_nom })
          }
        } catch {}
      }
      setRessources(all)
    } finally { setLoadingRes(false) }
  }, [allUAs.length])

  useEffect(() => { loadRessources() }, [loadRessources])

  const filtered = ressources.filter(r => {
    const matchUA = filterUA === 'all' || String(r.ua_id) === filterUA
    const matchQ  = !search || r.titre.toLowerCase().includes(search.toLowerCase())
    return matchUA && matchQ
  })

  async function handleSubmit(payload) {
    try {
      if (modal?.id) {
        await api.put(`/api/admin/ressource/${modal.id}`, payload)
        toast.success('Ressource mise à jour !')
      } else {
        await api.post('/api/admin/ressource', payload)
        toast.success('Ressource créée !')
      }
      setModal(null); loadRessources()
    } catch { toast.error('Erreur lors de la sauvegarde') }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/admin/ressource/${deleting.id}`)
      toast.success('Ressource supprimée')
      setDeleting(null); loadRessources()
    } catch { toast.error('Erreur') }
  }

  const TYPE_STYLE = {
    lecon:   { icon: '📖', color: C.brown,  bg: C.brownPale  },
    tp:      { icon: '🔬', color: C.emerald, bg: C.emeraldPale },
    resume:  { icon: '📋', color: C.blue,    bg: C.bluePale   },
    video:   { icon: '🎬', color: '#7C3AED', bg: '#F3E8FF'    },
  }

  return (
    <div>
      {/* Info banner */}
      <div style={{ background: `linear-gradient(135deg, ${C.emeraldPale}, ${C.brownPale})`, borderRadius: 14, padding: '14px 18px', marginBottom: 20, border: `1px solid ${C.emerald}30`, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>📚</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 800, color: C.brown, margin: '0 0 4px' }}>Contenu pédagogique</p>
          <p style={{ fontSize: 12, color: C.textSec, margin: 0, lineHeight: 1.6 }}>
            Les ressources sont affichées à l'apprenant <strong>avant les exercices</strong>. Composez par blocs :{' '}
            {[['Hx','Titre','#92400E','#FEF3C7'],['</>','Code','#065F46','#D1FAE5'],['!','Alerte','#1E40AF','#DBEAFE'],['≡','Liste','#6B21A8','#F3E8FF']].map(([b,l,c,bg]) => (
              <span key={l} style={{ background: bg, color: c, padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700, marginRight: 4 }}>{b} {l}</span>
            ))}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 140, position: 'relative' }}>
          <Search size={13} color={C.textSec} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une ressource…"
            style={{ ...inputBase, paddingLeft: 30 }}
            onFocus={e => e.target.style.borderColor = C.brown}
            onBlur={e => e.target.style.borderColor = C.brownPale}
          />
        </div>
        <select value={filterUA} onChange={e => setFilterUA(e.target.value)} style={{ ...inputBase, width: 'auto', minWidth: 180 }}>
          <option value="all">Toutes les UA</option>
          {allUAs.map(u => <option key={u.id} value={u.id}>{u.titre?.substring(0, 40)}</option>)}
        </select>
        <button onClick={() => setModal('create')} style={{ padding: '9px 16px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <Plus size={13} /> Nouvelle ressource
        </button>
      </div>

      {/* Liste */}
      {loadingRes ? (
        <div style={{ textAlign: 'center', padding: 40, display: 'flex', justifyContent: 'center' }}>
          <Spinner size={36} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', background: C.surface, borderRadius: 16, border: `1px dashed ${C.brownLight}` }}>
          <span style={{ fontSize: 40 }}>📭</span>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.brown, margin: '12px 0 6px' }}>Aucune ressource pédagogique</p>
          <p style={{ fontSize: 12, color: C.textSec }}>Créez du contenu pour chaque UA — leçons, TP, résumés.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(r => {
            const ts = TYPE_STYLE[r.type] || TYPE_STYLE.lecon
            const wordCount = countWords(r.contenu)
            const readMin = Math.max(1, Math.round(wordCount / 200))
            return (
              <div key={r.id} style={{ background: C.surface, borderRadius: 14, padding: mobile ? '14px' : '14px 20px', border: `1px solid ${C.brownPale}`, boxShadow: '0 2px 8px rgba(107,58,42,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: ts.bg, border: `1.5px solid ${ts.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {ts.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titre}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ background: ts.bg, color: ts.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>{r.type}</span>
                    <span style={{ fontSize: 10, color: C.textSec }}>· {r.ua_titre?.substring(0, 35)}</span>
                    <span style={{ fontSize: 10, color: C.textSec }}>· ~{readMin} min de lecture</span>
                    {r.points_cles?.length > 0 && (
                      <span style={{ fontSize: 10, color: C.gold, fontWeight: 700 }}>⭐ {r.points_cles.length} points clés</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setModal(r)} style={{ padding: '6px 10px', background: C.bluePale, color: C.blue, border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700 }}>
                    <Edit3 size={11} />{!mobile && ' Modifier'}
                  </button>
                  <button onClick={() => setDeleting(r)} style={{ padding: '6px 8px', background: '#FEE2E2', color: C.red, border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <Modal title={modal?.id ? 'Modifier la ressource' : 'Nouvelle ressource pédagogique'} onClose={() => setModal(null)} size={760}>
          <FormRessource initial={modal?.id ? modal : {}} uas={allUAs} onSubmit={handleSubmit} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleting && <ConfirmDelete item={deleting.titre} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
    </div>
  )
}


// ── PAGE PRINCIPALE
export default function AdminCours() {
  const { C } = useTheme()
  const inputBase = getInputBase(C)
  const [structure, setStructure] = useState([])
  const [niveaux,   setNiveaux]   = useState([])
  const [filieres,  setFilieres]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [activeTab, setActiveTab] = useState('structure')
  const [filterNiveau, setFilterNiveau] = useState('all')
  const [filterMat,    setFilterMat]    = useState('all')
  const { mobile, xs } = useBreakpoint()

  const loadAll = useCallback(async () => {
    try {
      const [{ data: s }, { data: ref }] = await Promise.all([
        api.get('/api/admin/structure'),
        api.get('/api/admin/referentiel'),
      ])
      setStructure(s)
      setNiveaux(ref.flatMap(c => c.niveaux || []))
      setFilieres(ref.flatMap(c => (c.ordres || []).flatMap(o => o.filieres || [])))
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const totalUAs = structure.flatMap(m => (m.modules || []).flatMap(mod => (mod.familles || []).flatMap(f => f.unites || []))).length
  const totalEx  = structure.flatMap(m => (m.modules || []).flatMap(mod => (mod.familles || []).flatMap(f => (f.unites || []).reduce((a, u) => a + (u.nb_exercices || 0), 0)))).reduce((a, b) => a + b, 0)
  const totalFam = structure.flatMap(m => (m.modules || []).flatMap(mod => mod.familles || [])).length
  const totalMod = structure.flatMap(m => m.modules || []).length

  const TABS = [
  { id: 'structure', label: 'Structure',  icon: Grid,      badge: `${structure.length} mat.` },
  { id: 'ua',        label: 'UA',         icon: Layers,    badge: totalUAs },
  { id: 'exercices', label: 'Exercices',  icon: Zap,       badge: totalEx },
  { id: 'contenu',   label: 'Contenu',    icon: FileText,  badge: '📖' },
]

  const pad = xs ? 12 : mobile ? 16 : 28

  if (loading) return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: `${pad}px`, boxSizing: 'border-box' }}>
      <div style={{ background: `linear-gradient(135deg, ${C.brownDark}, ${C.brown})`, borderRadius: xs ? 16 : 20, height: 100, marginBottom: 20 }} />
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[0,1,2,3].map(i => <div key={i} style={{ flex: 1, height: 44, background: C.surface, borderRadius: 10, border: `1px solid ${C.brownPale}` }} />)}
      </div>
      <SkList count={4} gap={10} />
    </div>
  )

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: `${pad}px`, boxSizing: 'border-box', overflowX: 'hidden' }}>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${C.brownDark} 0%, ${C.brown} 60%, ${C.brownLight} 100%)`, borderRadius: xs ? 16 : 20, padding: xs ? '18px 16px' : '24px 28px', marginBottom: 20, position: 'relative', overflow: 'hidden', color: 'white', animation: 'fadeUp .35s ease both' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .05, pointerEvents: 'none' }}>
          <defs><pattern id="adk" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5" />
            <circle cx="30" cy="30" r="6" fill="none" stroke="white" strokeWidth="1.5" />
            <line x1="30" y1="18" x2="30" y2="12" stroke="white" strokeWidth="1.5" />
            <line x1="18" y1="30" x2="12" y2="30" stroke="white" strokeWidth="1.5" />
            <line x1="42" y1="30" x2="48" y2="30" stroke="white" strokeWidth="1.5" />
            <line x1="30" y1="42" x2="30" y2="48" stroke="white" strokeWidth="1.5" />
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#adk)" />
        </svg>
        <div style={{ position: 'relative' }}>
          <p style={{ opacity: .7, fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Administration</p>
          <h1 style={{ fontSize: xs ? 18 : 22, fontWeight: 900, marginBottom: 10 }}>Gestion des cours</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              `${structure.length} matière(s)`,
              `${totalMod} module(s)`,
              `${totalFam} famille(s)`,
              `${totalUAs} UA`,
              `${totalEx} exercices`,
            ].map(s => (
              <span key={s} style={{ background: 'rgba(255,255,255,.2)', padding: '3px 10px', borderRadius: 20, fontSize: xs ? 10 : 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{s}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 22, background: C.surface, borderRadius: 14, padding: 4, border: `1px solid ${C.brownPale}`, boxShadow: '0 2px 8px rgba(107,58,42,0.06)', overflowX: 'auto' }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: mobile ? 'none' : 1, padding: xs ? '8px 12px' : '10px 16px', background: active ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})` : 'transparent', color: active ? 'white' : C.textSec, border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: xs ? 11 : 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all .2s', whiteSpace: 'nowrap', boxShadow: active ? `0 4px 14px ${C.brown}30` : 'none' }}>
              <Icon size={14} />
              {tab.label}
              <span style={{ background: active ? 'rgba(255,255,255,.25)' : C.brownPale, color: active ? 'white' : C.brown, padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 800 }}>{tab.badge}</span>
            </button>
          )
        })}
      </div>

      {/* Filtres globaux */}
      <div style={{ display: 'flex', gap: 8, marginBottom: filterNiveau !== 'all' ? 8 : 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterNiveau} onChange={e => setFilterNiveau(e.target.value)}
          style={{ ...inputBase, width: 'auto', minWidth: 170 }}>
          <option value="all">🎓 Tous les niveaux</option>
          {niveaux.map(n => <option key={n.id} value={n.id}>{n.nom}</option>)}
        </select>
        <select value={filterMat} onChange={e => setFilterMat(e.target.value)}
          style={{ ...inputBase, width: 'auto', minWidth: 170 }}>
          <option value="all">📚 Toutes les matières</option>
          {structure.map(m => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        {(filterNiveau !== 'all' || filterMat !== 'all') && (
          <button onClick={() => { setFilterNiveau('all'); setFilterMat('all') }}
            style={{ padding: '8px 14px', background: '#FEE2E2', color: C.red, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <X size={12}/> Réinitialiser
          </button>
        )}
      </div>
      {/* Bandeau informatif filtre actif */}
      {filterNiveau !== 'all' && (() => {
        const nomNiveau = niveaux.find(n => String(n.id) === filterNiveau)?.nom || '…'
        const nbGeneriques = structure.flatMap(m => m.modules || []).filter(mod => !mod.niveau_id).length
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '8px 14px', background: C.brownPale, borderRadius: 10, border: `1px solid ${C.brownLight}40`, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.brown }}>🎯 Filtre actif :</span>
            <span style={{ background: C.brown, color: 'white', fontSize: 11, fontWeight: 800, padding: '2px 10px', borderRadius: 20 }}>{nomNiveau}</span>
            {nbGeneriques > 0 && (
              <span style={{ fontSize: 11, color: C.textSec, fontStyle: 'italic' }}>
                + {nbGeneriques} module{nbGeneriques > 1 ? 's' : ''} sans niveau (tous niveaux)
              </span>
            )}
          </div>
        )
      })()}

      {/* Contenu */}
      <div style={{ animation: 'fadeIn .25s ease' }}>
        {activeTab === 'structure'  && <TabStructure  structure={structure} niveaux={niveaux} filieres={filieres} filterNiveau={filterNiveau} filterMat={filterMat} onReload={loadAll} />}
        {activeTab === 'ua'         && <TabUA         structure={structure} filterNiveau={filterNiveau} filterMat={filterMat} onReload={loadAll} />}
        {activeTab === 'exercices'  && <TabExercices  structure={structure} filterNiveau={filterNiveau} filterMat={filterMat} onReload={loadAll} />}
        {activeTab === 'contenu'    && <TabContenu    structure={structure} filterNiveau={filterNiveau} filterMat={filterMat} onReload={loadAll} />}
      </div>
    </div>
  )
}