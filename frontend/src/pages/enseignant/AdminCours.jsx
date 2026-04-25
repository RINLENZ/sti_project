import { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Edit3, BookOpen, X, Save,
  FileText, Search, ChevronDown, CheckCircle,
  Filter, Clock, Layers, Target, Zap, Eye, EyeOff,
  AlertTriangle,
} from 'lucide-react'

// ── Palette identique au projet ────────────────────────────────
const C = {
  brown: '#6B3A2A', brownLight: '#C4865A', emerald: '#0D9373',
  bg: '#FAF7F4', surface: '#FFFFFF', text: '#1A1207',
  textSec: '#6B5744', brownPale: '#F5EDE5', emeraldPale: '#E6F5F0',
  red: '#DC2626', orange: '#F59E0B', gold: '#D4A853', blue: '#2563EB',
  bluePale: '#DBEAFE',
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

// ═══════════════════════════════════════════════════════════════
// ── Composants UI partagés ─────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const FieldLabel = ({ children, required }) => (
  <label style={{ fontSize: 11, fontWeight: 700, color: C.textSec, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>
    {children}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
  </label>
)

const inputBase = {
  width: '100%', padding: '9px 12px', border: `1.5px solid ${C.brownPale}`,
  borderRadius: 8, fontSize: 13, color: C.text, background: C.surface,
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', transition: 'border .15s',
}

const FInput = ({ label, value, onChange, placeholder, type = 'text', required, disabled, hint }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <FieldLabel required={required}>{label}</FieldLabel>}
    <input type={type} value={value} onChange={onChange} placeholder={placeholder}
      required={required} disabled={disabled}
      style={{ ...inputBase, background: disabled ? C.brownPale : C.surface, cursor: disabled ? 'not-allowed' : 'text' }}
      onFocus={e => e.target.style.borderColor = C.brown}
      onBlur={e => e.target.style.borderColor = C.brownPale}
    />
    {hint && <p style={{ fontSize: 10, color: C.textSec, marginTop: 3 }}>{hint}</p>}
  </div>
)

const FTextarea = ({ label, value, onChange, placeholder, rows = 3, required }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <FieldLabel required={required}>{label}</FieldLabel>}
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{ ...inputBase, resize: 'vertical' }}
      onFocus={e => e.target.style.borderColor = C.brown}
      onBlur={e => e.target.style.borderColor = C.brownPale}
    />
  </div>
)

const FSelect = ({ label, value, onChange, options, required }) => (
  <div style={{ marginBottom: 14 }}>
    {label && <FieldLabel required={required}>{label}</FieldLabel>}
    <select value={value} onChange={onChange} style={{ ...inputBase }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

const StatusBadge = ({ status }) => {
  const cfg = {
    publié:    { bg: C.emeraldPale, color: C.emerald, label: '● Publié' },
    brouillon: { bg: '#FEF3C7',     color: C.orange,  label: '○ Brouillon' },
  }[status] || { bg: C.brownPale, color: C.textSec, label: status }
  return (
    <span style={{ backgroundColor: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  )
}

const DiffBadge = ({ level }) => {
  const cfg = {
    1: { bg: C.emeraldPale, color: C.emerald, label: '▲ Facile' },
    2: { bg: '#FEF3C7',     color: C.orange,  label: '▲▲ Moyen' },
    3: { bg: '#FEE2E2',     color: C.red,     label: '▲▲▲ Difficile' },
  }[level] || { bg: C.brownPale, color: C.textSec, label: `Niv. ${level}` }
  return (
    <span style={{ backgroundColor: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
      {cfg.label}
    </span>
  )
}

const TypeBadge = ({ type }) => {
  const cfg = {
    qcm:           { bg: C.bluePale, color: C.blue,    label: 'QCM' },
    texte_trou:    { bg: '#F3E8FF',  color: '#7C3AED', label: 'Trou' },
    reponse_libre: { bg: '#FEF3C7',  color: C.orange,  label: 'Libre' },
  }[type] || { bg: C.brownPale, color: C.textSec, label: type }
  return (
    <span style={{ backgroundColor: cfg.bg, color: cfg.color, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
      {cfg.label}
    </span>
  )
}

// ── Modal ───────────────────────────────────────────────────────
function Modal({ title, onClose, children, size = 600 }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(26,18,7,.6)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 1000, padding: '24px 16px', overflowY: 'auto',
      backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        backgroundColor: C.surface, borderRadius: 20, padding: '24px 28px',
        maxWidth: size, width: '100%', boxShadow: '0 24px 80px rgba(0,0,0,.35)',
        animation: 'slideDown .2s ease', position: 'relative', margin: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, color: C.brown, margin: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: C.brownPale, border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: C.brown, display: 'flex' }}>
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Confirmation suppression ────────────────────────────────────
function ConfirmDelete({ item, onConfirm, onCancel }) {
  return (
    <Modal title="Confirmer la suppression" onClose={onCancel} size={440}>
      <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <AlertTriangle size={24} color={C.red} />
        </div>
        <p style={{ fontSize: 14, color: C.text, fontWeight: 600, marginBottom: 6 }}>
          Supprimer <strong>"{item}"</strong> ?
        </p>
        <p style={{ fontSize: 12, color: C.textSec, marginBottom: 24 }}>
          Cette action est irréversible. L'élément sera désactivé.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Annuler
          </button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '10px', background: C.red, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Oui, supprimer
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── TagList (compétences/prérequis dynamiques) ──────────────────
function TagList({ label, items, onChange, placeholder }) {
  const [draft, setDraft] = useState('')
  function add() {
    const t = draft.trim()
    if (t && !items.includes(t)) { onChange([...items, t]); setDraft('') }
  }
  return (
    <div style={{ marginBottom: 14 }}>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
        {items.map((item, i) => (
          <span key={i} style={{ background: C.brownPale, color: C.brown, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
            {item}
            <button onClick={() => onChange(items.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.brownLight, padding: 0, display: 'flex', lineHeight: 1 }}>
              <X size={11} />
            </button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={draft} onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder}
          style={{ ...inputBase, flex: 1 }}
          onFocus={e => e.target.style.borderColor = C.brown}
          onBlur={e => e.target.style.borderColor = C.brownPale}
        />
        <button type="button" onClick={add} style={{ padding: '0 14px', background: C.brown, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
          + Ajouter
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ── FORMULAIRES ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// ── Formulaire Matière ──────────────────────────────────────────
function FormMatiere({ onSubmit, onClose, initial = {}, modules = [] }) {
  const [form, setForm] = useState({
    nom: initial.nom || '',
    code: initial.code || '',
    icone: initial.icone || '📚',
    couleur: initial.couleur || '#6B3A2A',
    module_id: initial.module_id || modules[0]?.id || '',
  })
  const [loading, setLoading] = useState(false)
  const EMOJIS = ['📚', '📐', '🔬', '🌍', '💡', '🖥️', '🎨', '📊', '✏️', '🧮']

  async function handleSubmit(e) {
  e.preventDefault(); setLoading(true)
  try {
    await onSubmit({
      nom:  form.nom,
      code: form.code,
    })
  } finally { setLoading(false) }
}

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <FInput label="Nom de la matière" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="ex: Mathématiques" required />
        <FInput label="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="ex: MATH" required />
      </div>

      <div style={{ marginBottom: 14 }}>
        <FieldLabel>Icône</FieldLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {EMOJIS.map(em => (
            <button type="button" key={em} onClick={() => setForm(f => ({ ...f, icone: em }))} style={{
              width: 40, height: 40, borderRadius: 10, border: `2px solid ${form.icone === em ? C.brown : C.brownPale}`,
              background: form.icone === em ? C.brownPale : 'transparent',
              cursor: 'pointer', fontSize: 18,
            }}>{em}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={{ marginBottom: 14 }}>
          <FieldLabel>Couleur</FieldLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="color" value={form.couleur} onChange={e => setForm(f => ({ ...f, couleur: e.target.value }))}
              style={{ width: 42, height: 36, borderRadius: 8, border: `1.5px solid ${C.brownPale}`, cursor: 'pointer', padding: 2 }} />
            <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>{form.couleur}</span>
          </div>
        </div>
        {modules.length > 0 && (
          <FSelect label="Module associé" value={form.module_id} onChange={e => setForm(f => ({ ...f, module_id: e.target.value }))}
            options={modules.map(m => ({ value: m.id, label: m.titre }))} />
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Annuler
        </button>
        <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Save size={14} /> {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

// ── Formulaire UA ───────────────────────────────────────────────
function FormUA({ onSubmit, onClose, initial = {}, familles = [] }) {
  const [form, setForm] = useState({
    titre: initial.titre || '',
    reference_ue: initial.reference_ue || '',
    description: initial.description || '',
    situation_probleme: initial.situation_probleme || '',
    duree_estimee: initial.duree_estimee || 60,
    difficulte: initial.difficulte || 1,
    statut: initial.statut || 'brouillon',
    famille_id: initial.famille_id || familles[0]?.id || '',
    competences: initial.competences || [],
    prerequis: initial.prerequis || [],
  })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
  e.preventDefault(); setLoading(true)
  try {
    const payload = {
      titre:              form.titre,
      reference_ue:       form.reference_ue,
      situation_probleme: form.situation_probleme,
      duree_estimee:      parseInt(form.duree_estimee),
      famille_id:         form.famille_id,
      competences:        form.competences,
      prerequis:          form.prerequis,
    }
    await onSubmit(payload)
  } finally { setLoading(false) }
}

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 14 }}>
        <FInput label="Titre de l'UA" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="ex: Les structures de contrôle" required />
        <FInput label="Référence" value={form.reference_ue} onChange={e => setForm(f => ({ ...f, reference_ue: e.target.value }))} placeholder="UA1.1" required />
      </div>

      <FTextarea label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Présentation générale de l'unité…" rows={2} />
      <FTextarea label="Situation problème" value={form.situation_probleme} onChange={e => setForm(f => ({ ...f, situation_probleme: e.target.value }))} placeholder="Contexte concret d'apprentissage…" rows={3} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <div style={{ marginBottom: 14 }}>
          <FieldLabel>Durée (min)</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <input type="range" min={15} max={240} step={15} value={form.duree_estimee}
              onChange={e => setForm(f => ({ ...f, duree_estimee: e.target.value }))}
              style={{ width: '100%', accentColor: C.brown }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: C.brown, textAlign: 'center' }}>{form.duree_estimee} min</span>
          </div>
        </div>
        <FSelect label="Difficulté" value={form.difficulte} onChange={e => setForm(f => ({ ...f, difficulte: e.target.value }))}
          options={[{ value: 1, label: '▲ Facile' }, { value: 2, label: '▲▲ Moyen' }, { value: 3, label: '▲▲▲ Difficile' }]} />
        <FSelect label="Statut" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
          options={[{ value: 'brouillon', label: '○ Brouillon' }, { value: 'publié', label: '● Publié' }]} />
      </div>

      {familles.length > 0 && (
        <FSelect label="Famille de situations" value={form.famille_id} onChange={e => setForm(f => ({ ...f, famille_id: e.target.value }))}
          options={familles.map(f => ({ value: f.id, label: f.titre }))} />
      )}

      <TagList label="Compétences visées" items={form.competences} onChange={v => setForm(f => ({ ...f, competences: v }))} placeholder="Ajouter une compétence puis Entrée…" />
      <TagList label="Prérequis" items={form.prerequis} onChange={v => setForm(f => ({ ...f, prerequis: v }))} placeholder="Ajouter un prérequis…" />

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
        <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Save size={14} /> {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

// ── Formulaire Exercice ─────────────────────────────────────────
function FormExercice({ onSubmit, onClose, initial = {}, uas = [] }) {
  const [form, setForm] = useState({
    titre: initial.titre || '',
    type: initial.type || 'qcm',
    enonce: initial.enonce || '',
    options: initial.options?.length === 4 ? initial.options : ['', '', '', ''],
    reponse_correcte: initial.reponse_correcte || '',
    mots_cles: initial.mots_cles || '',
    bareme: initial.bareme || '',
    explication: initial.explication || '',
    indice_1: initial.indice_1 || '',
    indice_2: initial.indice_2 || '',
    competence_evaluee: initial.competence_evaluee || '',
    difficulte: initial.difficulte || 1,
    points: initial.points || 10,
    ua_id: initial.ua_id || uas[0]?.id || '',
    statut: initial.statut || 'brouillon',
  })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
  e.preventDefault(); setLoading(true)
  try {
    const payload = {
      titre:              form.titre,
      type:               form.type,
      enonce:             form.enonce,
      options:            form.type === 'qcm' ? form.options.filter(o => o.trim()) : null,
      reponse_correcte:   form.reponse_correcte,
      explication:        form.explication,
      indice_1:           form.indice_1,
      indice_2:           form.indice_2,
      competence_evaluee: form.competence_evaluee,
      difficulte:         parseInt(form.difficulte),
      points:             parseInt(form.points),
      ua_id:              form.ua_id,
    }
    await onSubmit(payload)
  } finally { setLoading(false) }
}
  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <FInput label="Titre" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Titre court de l'exercice" required />
        <FSelect label="Type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          options={[{ value: 'qcm', label: 'QCM' }, { value: 'texte_trou', label: 'Texte à trou' }, { value: 'reponse_libre', label: 'Réponse libre' }]} />
      </div>

      <FTextarea label="Énoncé" value={form.enonce} onChange={e => setForm(f => ({ ...f, enonce: e.target.value }))} placeholder="Question ou problème à résoudre…" rows={3} required />

      {form.type === 'qcm' && (
        <div style={{ marginBottom: 14 }}>
          <FieldLabel>Options (A, B, C, D)</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {form.options.map((opt, i) => (
              <input key={i} value={opt}
                onChange={e => { const o = [...form.options]; o[i] = e.target.value; setForm(f => ({ ...f, options: o })) }}
                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                style={{ ...inputBase }}
                onFocus={e => e.target.style.borderColor = C.brown}
                onBlur={e => e.target.style.borderColor = C.brownPale}
              />
            ))}
          </div>
        </div>
      )}

      {form.type !== 'reponse_libre' && (
        <FInput label="Réponse correcte" value={form.reponse_correcte} onChange={e => setForm(f => ({ ...f, reponse_correcte: e.target.value }))} placeholder="Texte exact de la bonne réponse" required />
      )}

      {form.type === 'reponse_libre' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FInput label="Barème" value={form.bareme} onChange={e => setForm(f => ({ ...f, bareme: e.target.value }))} placeholder="ex: 2 pts par idée clé" />
          <FInput label="Mots-clés attendus" value={form.mots_cles} onChange={e => setForm(f => ({ ...f, mots_cles: e.target.value }))} placeholder="mot1, mot2, mot3" />
        </div>
      )}

      <FTextarea label="Explication (feedback)" value={form.explication} onChange={e => setForm(f => ({ ...f, explication: e.target.value }))} placeholder="Pourquoi c'est la bonne réponse…" rows={2} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <FInput label="Indice 1" value={form.indice_1} onChange={e => setForm(f => ({ ...f, indice_1: e.target.value }))} placeholder="Premier indice…" />
        <FInput label="Indice 2" value={form.indice_2} onChange={e => setForm(f => ({ ...f, indice_2: e.target.value }))} placeholder="Deuxième indice…" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14 }}>
        <FInput label="Points" value={form.points} type="number" onChange={e => setForm(f => ({ ...f, points: e.target.value }))} />
        <FSelect label="Difficulté" value={form.difficulte} onChange={e => setForm(f => ({ ...f, difficulte: e.target.value }))}
          options={[{ value: 1, label: '▲ Facile' }, { value: 2, label: '▲▲ Moyen' }, { value: 3, label: '▲▲▲ Difficile' }]} />
        <FSelect label="Statut" value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
          options={[{ value: 'brouillon', label: '○ Brouillon' }, { value: 'publié', label: '● Publié' }]} />
        {uas.length > 0 && (
          <FSelect label="UA parente" value={form.ua_id} onChange={e => setForm(f => ({ ...f, ua_id: e.target.value }))}
            options={uas.map(u => ({ value: u.id, label: u.titre.substring(0, 24) }))} />
        )}
      </div>

      <FInput label="Compétence évaluée" value={form.competence_evaluee} onChange={e => setForm(f => ({ ...f, competence_evaluee: e.target.value }))} placeholder="ex: Identifier les structures de contrôle" />

      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
        <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Save size={14} /> {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

// ═══════════════════════════════════════════════════════════════
// ── TABS ───────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

// ── Tab Matières ────────────────────────────────────────────────
function TabMatieres({ structure, onReload }) {
  const [modal, setModal] = useState(null) // null | 'create' | editObj
  const [deleting, setDeleting] = useState(null)
  const { mobile } = useBreakpoint()

  const matieres = structure.flatMap(m => [{ ...m, modules_count: m.modules?.length || 0 }])

  async function handleSubmit(payload) {
    try {
      if (modal?.id) { await api.put(`/api/cours/matieres/${modal.id}`, payload); toast.success('Matière mise à jour !') }
      else           { await api.post('/api/cours/matieres', payload); toast.success('Matière créée !') }
      setModal(null); onReload()
    } catch { toast.error('Erreur lors de la sauvegarde') }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/cours/matieres/${deleting.id}`)
      toast.success('Matière supprimée'); setDeleting(null); onReload()
    } catch { toast.error('Erreur') }
  }

  const allModules = structure.flatMap(m => m.modules || [])

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <button onClick={() => setModal('create')} style={{
          padding: '9px 18px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
          color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <Plus size={14} /> Ajouter une matière
        </button>
      </div>

      {/* Grille */}
      <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {matieres.map(mat => (
          <div key={mat.id} style={{
            backgroundColor: C.surface, borderRadius: 16, padding: '18px 20px',
            border: `1px solid ${C.brownPale}`, boxShadow: '0 2px 10px rgba(107,58,42,0.07)',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, background: `${mat.couleur || C.brown}20`, border: `2px solid ${mat.couleur || C.brown}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                {mat.icone || '📚'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mat.nom}</p>
                <span style={{ fontSize: 10, fontWeight: 700, background: C.brownPale, color: C.brown, padding: '2px 8px', borderRadius: 20 }}>{mat.code}</span>
              </div>
            </div>
            <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>
              {mat.modules_count} module(s) · {mat.modules?.flatMap(m => m.familles?.flatMap(f => f.unites || []) || []).length || 0} UA
            </p>
            <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
              <button onClick={() => setModal(mat)} style={{ flex: 1, padding: '7px', background: C.bluePale, color: C.blue, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Edit3 size={12} /> Modifier
              </button>
              <button onClick={() => setDeleting(mat)} style={{ padding: '7px 10px', background: '#FEE2E2', color: C.red, border: 'none', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={modal?.id ? 'Modifier la matière' : 'Nouvelle matière'} onClose={() => setModal(null)}>
          <FormMatiere initial={modal?.id ? modal : {}} modules={allModules} onSubmit={handleSubmit} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleting && <ConfirmDelete item={deleting.nom} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
    </div>
  )
}

// ── Tab UA ──────────────────────────────────────────────────────
function TabUA({ structure, onReload }) {
  const [search, setSearch] = useState('')
  const [filterMatiere, setFilterMatiere] = useState('all')
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const { mobile } = useBreakpoint()

  const allUAs = structure.flatMap(m =>
    m.modules?.flatMap(mod =>
      mod.familles?.flatMap(fam =>
        (fam.unites || []).map(u => ({
          ...u, matiere_nom: m.nom, matiere_id: m.id, famille_id: fam.id,
          famille_titre: fam.titre,
        }))
      ) || []
    ) || []
  )
  const familles = structure.flatMap(m => m.modules?.flatMap(mod => mod.familles || []) || [])
  const matiereOpts = [{ value: 'all', label: 'Toutes les matières' }, ...structure.map(m => ({ value: m.id, label: m.nom }))]

  const filtered = allUAs.filter(ua => {
    const matchMat = filterMatiere === 'all' || ua.matiere_id === filterMatiere
    const matchQ = !search || ua.titre.toLowerCase().includes(search.toLowerCase()) || ua.reference_ue?.toLowerCase().includes(search.toLowerCase())
    return matchMat && matchQ
  })

  async function handleSubmit(payload) {
    try {
      if (modal?.id) { await api.put(`/api/cours/ua/${modal.id}`, payload); toast.success('UA mise à jour !') }
      else           { await api.post('/api/cours/ua', payload); toast.success('UA créée !') }
      setModal(null); onReload()
    } catch { toast.error('Erreur') }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/cours/ua/${deleting.id}`)
      toast.success('UA supprimée'); setDeleting(null); onReload()
    } catch { toast.error('Erreur') }
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180, position: 'relative' }}>
          <Search size={14} color={C.textSec} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une UA…"
            style={{ ...inputBase, paddingLeft: 32 }}
            onFocus={e => e.target.style.borderColor = C.brown}
            onBlur={e => e.target.style.borderColor = C.brownPale}
          />
        </div>
        <select value={filterMatiere} onChange={e => setFilterMatiere(e.target.value)} style={{ ...inputBase, width: 'auto', minWidth: 180 }}>
          {matiereOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button onClick={() => setModal('create')} style={{
          padding: '9px 16px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
          color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}>
          <Plus size={14} /> Nouvelle UA
        </button>
      </div>

      {/* Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: C.textSec, background: C.surface, borderRadius: 16, border: `1px dashed ${C.brownLight}` }}>
            <FileText size={32} color={C.brownLight} style={{ margin: '0 auto 10px' }} />
            <p style={{ fontWeight: 600, fontSize: 14 }}>Aucune UA trouvée</p>
          </div>
        )}
        {filtered.map(ua => (
          <div key={ua.id} style={{
            backgroundColor: C.surface, borderRadius: 14, padding: mobile ? '14px' : '14px 18px',
            border: `1px solid ${C.brownPale}`, boxShadow: '0 1px 8px rgba(107,58,42,0.06)',
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: mobile ? 'wrap' : 'nowrap',
          }}>
            {/* Badge réf */}
            <span style={{ background: C.brownPale, color: C.brown, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
              {ua.reference_ue || 'UA'}
            </span>
            {/* Titre + meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ua.titre}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <DiffBadge level={ua.difficulte} />
                <StatusBadge status={ua.statut || 'brouillon'} />
                <span style={{ fontSize: 10, color: C.textSec, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <BookOpen size={10} /> {ua.nb_exercices || 0} exos
                </span>
                <span style={{ fontSize: 10, color: C.textSec, display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Clock size={10} /> {ua.duree_estimee}min
                </span>
                <span style={{ fontSize: 10, color: C.textSec }}>· {ua.matiere_nom}</span>
              </div>
            </div>
            {/* Actions */}
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => setModal(ua)} style={{ padding: '6px 10px', background: C.bluePale, color: C.blue, border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                <Edit3 size={12} /> {!mobile && 'Modifier'}
              </button>
              <button onClick={() => setDeleting(ua)} style={{ padding: '6px 8px', background: '#FEE2E2', color: C.red, border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <Modal title={modal?.id ? "Modifier l'UA" : 'Nouvelle Unité d\'apprentissage'} onClose={() => setModal(null)} size={680}>
          <FormUA initial={modal?.id ? modal : {}} familles={familles} onSubmit={handleSubmit} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleting && <ConfirmDelete item={deleting.titre} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
    </div>
  )
}

// ── Tab Exercices ───────────────────────────────────────────────
function TabExercices({ structure, onReload }) {
  const [search, setSearch] = useState('')
  const [filterUA, setFilterUA] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterDiff, setFilterDiff] = useState('all')
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [exercices, setExercices] = useState([])
  const [loadingEx, setLoadingEx] = useState(true)
  const { mobile } = useBreakpoint()

  const allUAs = structure.flatMap(m =>
    m.modules?.flatMap(mod =>
      mod.familles?.flatMap(fam => fam.unites || []) || []
    ) || []
  )

  useEffect(() => {
    async function load() {
      setLoadingEx(true)
      try { const { data } = await api.get('/api/cours/exercices'); setExercices(data) }
      catch {}
      finally { setLoadingEx(false) }
    }
    load()
  }, [])

  const filtered = exercices.filter(ex => {
    const matchUA = filterUA === 'all' || ex.ua_id === filterUA
    const matchType = filterType === 'all' || ex.type === filterType
    const matchDiff = filterDiff === 'all' || String(ex.difficulte) === filterDiff
    const matchQ = !search || ex.titre?.toLowerCase().includes(search.toLowerCase()) || ex.enonce?.toLowerCase().includes(search.toLowerCase())
    return matchUA && matchType && matchDiff && matchQ
  })

  async function handleSubmit(payload) {
    try {
      if (modal?.id) { await api.put(`/api/cours/exercices/${modal.id}`, payload); toast.success('Exercice mis à jour !') }
      else           { await api.post('/api/cours/exercices', payload); toast.success('Exercice créé !') }
      setModal(null)
      const { data } = await api.get('/api/cours/exercices')
      setExercices(data)
    } catch { toast.error('Erreur') }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/cours/exercices/${deleting.id}`)
      toast.success('Exercice supprimé')
      setDeleting(null)
      setExercices(prev => prev.filter(e => e.id !== deleting.id))
    } catch { toast.error('Erreur') }
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 160, position: 'relative' }}>
          <Search size={14} color={C.textSec} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ ...inputBase, paddingLeft: 32 }}
            onFocus={e => e.target.style.borderColor = C.brown}
            onBlur={e => e.target.style.borderColor = C.brownPale}
          />
        </div>
        <select value={filterUA} onChange={e => setFilterUA(e.target.value)} style={{ ...inputBase, width: 'auto', minWidth: 150 }}>
          <option value="all">Toutes les UA</option>
          {allUAs.map(u => <option key={u.id} value={u.id}>{u.titre?.substring(0, 30)}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ ...inputBase, width: 'auto' }}>
          <option value="all">Tous types</option>
          <option value="qcm">QCM</option>
          <option value="texte_trou">Texte à trou</option>
          <option value="reponse_libre">Réponse libre</option>
        </select>
        <select value={filterDiff} onChange={e => setFilterDiff(e.target.value)} style={{ ...inputBase, width: 'auto' }}>
          <option value="all">Toutes difficultés</option>
          <option value="1">Facile</option>
          <option value="2">Moyen</option>
          <option value="3">Difficile</option>
        </select>
        <button onClick={() => setModal('create')} style={{
          padding: '9px 16px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
          color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        }}>
          <Plus size={14} /> Nouvel exercice
        </button>
      </div>

      {loadingEx ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.brownPale}`, borderTopColor: C.brown, margin: '0 auto', animation: 'spin 1s linear infinite' }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: C.textSec, background: C.surface, borderRadius: 16, border: `1px dashed ${C.brownLight}` }}>
              <Zap size={32} color={C.brownLight} style={{ margin: '0 auto 10px' }} />
              <p style={{ fontWeight: 600, fontSize: 14 }}>Aucun exercice trouvé</p>
            </div>
          )}
          {filtered.map((ex, i) => (
            <div key={ex.id} style={{
              backgroundColor: C.surface, borderRadius: 13, padding: mobile ? '12px' : '12px 18px',
              border: `1px solid ${C.brownPale}`, boxShadow: '0 1px 6px rgba(107,58,42,0.05)',
              display: 'flex', alignItems: 'center', gap: 12, flexWrap: mobile ? 'wrap' : 'nowrap',
            }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ex.titre || ex.enonce?.substring(0, 60) + '…'}
                </p>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TypeBadge type={ex.type} />
                  <DiffBadge level={ex.difficulte} />
                  <StatusBadge status={ex.statut || 'brouillon'} />
                  <span style={{ fontSize: 10, color: C.textSec }}>{ex.points} pts</span>
                  {ex.competence_evaluee && (
                    <span style={{ fontSize: 10, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                      · {ex.competence_evaluee}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => setModal(ex)} style={{ padding: '6px 10px', background: C.bluePale, color: C.blue, border: 'none', borderRadius: 7, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 }}>
                  <Edit3 size={12} />{!mobile && ' Modifier'}
                </button>
                <button onClick={() => setDeleting(ex)} style={{ padding: '6px 8px', background: '#FEE2E2', color: C.red, border: 'none', borderRadius: 7, cursor: 'pointer' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal?.id ? "Modifier l'exercice" : 'Nouvel exercice'} onClose={() => setModal(null)} size={700}>
          <FormExercice initial={modal?.id ? modal : {}} uas={allUAs} onSubmit={handleSubmit} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleting && <ConfirmDelete item={deleting.titre || 'cet exercice'} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// ── PAGE PRINCIPALE ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════
export default function AdminCours() {
  const [structure, setStructure] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('matieres')
  const { mobile, xs } = useBreakpoint()

  const loadStructure = useCallback(async () => {
    try { const { data } = await api.get('/api/admin/structure'); setStructure(data) }
    catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStructure() }, [loadStructure])

  // Stats globales
  const totalUAs = structure.flatMap(m => m.modules?.flatMap(mod => mod.familles?.flatMap(f => f.unites || []) || []) || []).length
  const totalEx  = structure.flatMap(m => m.modules?.flatMap(mod => mod.familles?.flatMap(f => (f.unites || []).map(u => u.nb_exercices || 0)) || []) || []).reduce((a, b) => a + b, 0)
  const totalFam = structure.flatMap(m => m.modules?.flatMap(mod => mod.familles || []) || []).length

  const TABS = [
    { id: 'matieres',  label: 'Matières',   icon: BookOpen,  count: structure.length },
    { id: 'ua',        label: 'Unités d\'apprentissage', icon: Layers, count: totalUAs },
    { id: 'exercices', label: 'Exercices',  icon: Zap,       count: totalEx },
  ]

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
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes slideDown { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes fadeIn  { from { opacity: 0 } to { opacity: 1 } }
        * { box-sizing: border-box; }
      `}</style>

      {/* ── Hero ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brown} 0%, ${C.brownLight} 100%)`,
        borderRadius: xs ? 16 : 20, padding: xs ? '18px 16px' : mobile ? '20px 18px' : '26px 30px',
        marginBottom: xs ? 16 : 22, position: 'relative', overflow: 'hidden', color: 'white',
      }}>
        {/* Motif adinkra */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .05, pointerEvents: 'none' }}>
          <defs>
            <pattern id="adk-admin" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5" />
              <circle cx="30" cy="30" r="6"  fill="none" stroke="white" strokeWidth="1.5" />
              <line x1="30" y1="18" x2="30" y2="12" stroke="white" strokeWidth="1.5" />
              <line x1="18" y1="30" x2="12" y2="30" stroke="white" strokeWidth="1.5" />
              <line x1="42" y1="30" x2="48" y2="30" stroke="white" strokeWidth="1.5" />
              <line x1="30" y1="42" x2="30" y2="48" stroke="white" strokeWidth="1.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#adk-admin)" />
        </svg>

        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ opacity: .7, fontSize: 11, fontWeight: 600, marginBottom: 3 }}>Administration</p>
            <h1 style={{ fontSize: xs ? 18 : mobile ? 20 : 24, fontWeight: 900, marginBottom: 10, lineHeight: 1.15 }}>
              Gestion des cours
            </h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { label: `${structure.length} matière${structure.length > 1 ? 's' : ''}` },
                { label: `${totalUAs} UA` },
                { label: `${totalEx} exercices` },
                { label: `${totalFam} familles` },
              ].map(s => (
                <span key={s.label} style={{ background: 'rgba(255,255,255,.2)', padding: '3px 10px', borderRadius: 20, fontSize: xs ? 10 : 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 22,
        background: C.surface, borderRadius: 14, padding: 4,
        border: `1px solid ${C.brownPale}`,
        boxShadow: '0 2px 8px rgba(107,58,42,0.06)',
        overflowX: 'auto',
      }}>
        {TABS.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex: mobile ? 'none' : 1, padding: xs ? '8px 12px' : '10px 16px',
              background: active ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})` : 'transparent',
              color: active ? 'white' : C.textSec,
              border: 'none', borderRadius: 10, cursor: 'pointer',
              fontSize: xs ? 11 : 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all .2s ease', whiteSpace: 'nowrap',
              boxShadow: active ? `0 4px 14px ${C.brown}30` : 'none',
            }}>
              <Icon size={14} />
              {tab.label}
              <span style={{
                background: active ? 'rgba(255,255,255,.25)' : C.brownPale,
                color: active ? 'white' : C.brown,
                padding: '1px 7px', borderRadius: 20, fontSize: 10, fontWeight: 800,
              }}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Contenu du tab actif ── */}
      <div style={{ animation: 'fadeIn .25s ease' }}>
        {activeTab === 'matieres'  && <TabMatieres  structure={structure} onReload={loadStructure} />}
        {activeTab === 'ua'        && <TabUA        structure={structure} onReload={loadStructure} />}
        {activeTab === 'exercices' && <TabExercices structure={structure} onReload={loadStructure} />}
      </div>
    </div>
  )
}