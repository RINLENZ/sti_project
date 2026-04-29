import { useEffect, useState, useCallback } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Edit3, BookOpen, X, Save,
  Search, ChevronDown, ChevronRight,
  Clock, Zap, Layers, FolderOpen, Grid,
  FileText, AlertTriangle, Sparkles, Loader, Upload
} from 'lucide-react'
import { C } from '../../styles/theme'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { SkList, Spinner } from '../../components/Skeleton'

// ── UI de base ──────────────────────────────────────────────────
const inputBase = {
  width: '100%', padding: '9px 12px', border: `1.5px solid ${C.brownPale}`,
  borderRadius: 8, fontSize: 13, color: C.text, background: C.surface,
  outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
}
const FieldLabel = ({ children, required }) => (
  <label style={{ fontSize: 11, fontWeight: 700, color: C.textSec, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: .4 }}>
    {children}{required && <span style={{ color: C.red, marginLeft: 3 }}>*</span>}
  </label>
)
const FInput = ({ label, value, onChange, placeholder, type = 'text', required, hint }) => (
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
const FTextarea = ({ label, value, onChange, placeholder, rows = 3, required }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <FieldLabel required={required}>{label}</FieldLabel>}
    <textarea value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{ ...inputBase, resize: 'vertical' }}
      onFocus={e => e.target.style.borderColor = C.brown}
      onBlur={e => e.target.style.borderColor = C.brownPale}
    />
  </div>
)
const FSelect = ({ label, value, onChange, options, required }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <FieldLabel required={required}>{label}</FieldLabel>}
    <select value={value} onChange={onChange} style={inputBase}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

// ── Modal ───────────────────────────────────────────────────────
function Modal({ title, onClose, children, size = 560 }) {
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = '' } }, [])
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{
      position: 'fixed', inset: 0, background: 'rgba(26,18,7,.6)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 1000, padding: '24px 16px', overflowY: 'auto', backdropFilter: 'blur(3px)',
    }}>
      <div style={{
        backgroundColor: C.surface, borderRadius: 20, padding: '24px 28px',
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

const SaveBtn = ({ loading }) => (
  <button type="submit" disabled={loading} style={{ flex: 2, padding: '10px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
    <Save size={14} /> {loading ? 'Enregistrement…' : 'Enregistrer'}
  </button>
)
const CancelBtn = ({ onClose }) => (
  <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Annuler</button>
)

// ── TagList ─────────────────────────────────────────────────────
function TagList({ label, items, onChange, placeholder }) {
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
  const [form, setForm] = useState({ nom: initial.nom || '', code: initial.code || '', description: initial.description || '' })
  const [loading, setLoading] = useState(false)
  async function handle(e) { e.preventDefault(); setLoading(true); try { await onSubmit({ nom: form.nom, code: form.code, description: form.description }) } finally { setLoading(false) } }
  return (
    <form onSubmit={handle}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
        <FInput label="Nom" value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="ex: Mathématiques" required />
        <FInput label="Code" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="MATH" required />
      </div>
      <FInput label="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description optionnelle" />
      <div style={{ display: 'flex', gap: 10 }}><CancelBtn onClose={onClose} /><SaveBtn loading={loading} /></div>
    </form>
  )
}

function FormModule({ initial = {}, matieres = [], niveaux = [], onSubmit, onClose }) {
  const [form, setForm] = useState({
    titre: initial.titre || '', numero: initial.numero || 1, description: initial.description || '',
    matiere_id: initial.matiere_id || matieres[0]?.id || '',
    niveau_id: initial.niveau_id || '',
    ordre: initial.ordre || 1,
  })
  const [loading, setLoading] = useState(false)
  async function handle(e) { e.preventDefault(); setLoading(true); try { await onSubmit(form) } finally { setLoading(false) } }
  return (
    <form onSubmit={handle}>
      <FSelect label="Matière" value={form.matiere_id} onChange={e => setForm(f => ({ ...f, matiere_id: e.target.value }))} required
        options={matieres.map(m => ({ value: m.id, label: m.nom }))} />
      <FSelect label="Niveau" value={form.niveau_id} onChange={e => setForm(f => ({ ...f, niveau_id: e.target.value }))}
        options={[{ value: '', label: '— Tous niveaux (générique) —' }, ...niveaux.map(n => ({ value: n.id, label: n.nom }))]} />
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

function TabStructure({ structure, niveaux, filterNiveau, filterMat, onReload }) {
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
          <FormModule initial={modal.editModule || {}} matieres={allMatieres} niveaux={niveaux} onSubmit={handleSubmitModule} onClose={() => setModal(null)} />
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px', gap: 12 }}>
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
        { headers: { 'Content-Type': 'multipart/form-data' } }
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
  const [form, setForm] = useState({
    titre: initial.titre || '', type: initial.type || 'qcm',
    enonce: initial.enonce || '',
    options: initial.options?.length ? initial.options : ['', '', '', ''],
    propositions: initial.options?.length ? initial.options.join(', ') : '',
    reponse_correcte: initial.reponse_correcte || '',
    explication: initial.explication || '', indice_1: initial.indice_1 || '',
    indice_2: initial.indice_2 || '', competence_evaluee: initial.competence_evaluee || '',
    difficulte: initial.difficulte || 1, points: initial.points || 10,
    ua_id: initial.ua_id || uas[0]?.id || '',
  })
  const [loading, setLoading] = useState(false)

  function getOptions() {
    if (form.type === 'qcm')       return form.options.filter(o => o.trim())
    if (form.type === 'vrai_faux') return ['Vrai', 'Faux']
    if (form.type === 'texte_trou') {
      const props = form.propositions.split(',').map(s => s.trim()).filter(Boolean)
      return props.length ? props : null
    }
    return null
  }

  async function handle(e) {
    e.preventDefault(); setLoading(true)
    const apiType = form.type === 'vrai_faux' ? 'qcm' : form.type
    try {
      await onSubmit({
        titre: form.titre, type: apiType, enonce: form.enonce,
        options: getOptions(),
        reponse_correcte: form.reponse_correcte, explication: form.explication,
        indice_1: form.indice_1, indice_2: form.indice_2,
        competence_evaluee: form.competence_evaluee,
        difficulte: parseInt(form.difficulte), points: parseInt(form.points),
        ua_id: form.ua_id,
      })
    } finally { setLoading(false) }
  }
  return (
    <form onSubmit={handle}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FInput label="Titre" value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} placeholder="Titre court" required />
        <FSelect label="Type d'exercice" value={form.type}
          onChange={e => {
            const t = e.target.value
            const rc = t === 'vrai_faux' ? form.reponse_correcte || 'Vrai' : form.reponse_correcte
            setForm(f => ({ ...f, type: t, reponse_correcte: rc }))
          }}
          options={[
            { value: 'qcm',          label: '🔤 QCM — choix multiple (A B C D)' },
            { value: 'vrai_faux',    label: '✅ Vrai / Faux' },
            { value: 'texte_trou',   label: '🔲 Texte à trous + propositions' },
            { value: 'reponse_libre',label: '✏️ Réponse libre (rédaction)' },
          ]} />
      </div>
      {uas.length > 0 && (
        <FSelect label="UA parente" value={form.ua_id} onChange={e => setForm(f => ({ ...f, ua_id: e.target.value }))} required
          options={uas.map(u => ({ value: u.id, label: u.titre.substring(0, 50) }))} />
      )}
      <FTextarea label="Énoncé" value={form.enonce} onChange={e => setForm(f => ({ ...f, enonce: e.target.value }))} placeholder="Question complète…" rows={3} required />

      {/* Options QCM */}
      {form.type === 'qcm' && (
        <div style={{ marginBottom: 12 }}>
          <FieldLabel>Options A B C D</FieldLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {form.options.map((opt, i) => (
              <input key={i} value={opt}
                onChange={e => { const o = [...form.options]; o[i] = e.target.value; setForm(f => ({ ...f, options: o })) }}
                placeholder={`Option ${String.fromCharCode(65 + i)}`} style={inputBase}
                onFocus={e => e.target.style.borderColor = C.brown} onBlur={e => e.target.style.borderColor = C.brownPale}
              />
            ))}
          </div>
        </div>
      )}

      {/* Propositions pour texte à trous */}
      {form.type === 'texte_trou' && (
        <div style={{ marginBottom:12 }}>
          <FieldLabel>Propositions (word bank, séparées par des virgules)</FieldLabel>
          <input value={form.propositions}
            onChange={e => setForm(f => ({ ...f, propositions: e.target.value }))}
            placeholder="Ex : atome, molécule, proton, électron"
            style={inputBase}
            onFocus={e => e.target.style.borderColor = C.brown}
            onBlur={e => e.target.style.borderColor = C.brownPale}/>
          <p style={{ fontSize:10, color:C.textSec, margin:'4px 0 0' }}>
            L'apprenant cliquera sur la bonne proposition — laisse vide pour une saisie libre.
          </p>
        </div>
      )}

      {/* Vrai/Faux — sélecteur réponse correcte */}
      {form.type === 'vrai_faux' && (
        <div style={{ marginBottom:12 }}>
          <FieldLabel>Réponse correcte</FieldLabel>
          <div style={{ display:'flex', gap:10 }}>
            {['Vrai','Faux'].map(v => (
              <button key={v} type="button"
                onClick={() => setForm(f => ({ ...f, reponse_correcte: v }))}
                style={{ flex:1, padding:'12px', borderRadius:10, cursor:'pointer', fontWeight:800, fontSize:14,
                  background: form.reponse_correcte === v ? (v==='Vrai'?C.emeraldPale:'#FEE2E2') : C.surface,
                  border:`2px solid ${form.reponse_correcte === v ? (v==='Vrai'?C.emerald:C.red) : C.brownPale}`,
                  color: form.reponse_correcte === v ? (v==='Vrai'?C.emerald:C.red) : C.text,
                }}>
                {v === 'Vrai' ? '✅ Vrai' : '❌ Faux'}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.type !== 'reponse_libre' && form.type !== 'vrai_faux' && (
        <FInput label="Réponse correcte" value={form.reponse_correcte} onChange={e => setForm(f => ({ ...f, reponse_correcte: e.target.value }))} placeholder="Texte exact de la bonne réponse" required />
      )}
      <FTextarea label="Explication (feedback)" value={form.explication} onChange={e => setForm(f => ({ ...f, explication: e.target.value }))} placeholder="Pourquoi c'est la bonne réponse…" rows={2} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FInput label="Indice 1" value={form.indice_1} onChange={e => setForm(f => ({ ...f, indice_1: e.target.value }))} placeholder="Premier indice…" />
        <FInput label="Indice 2" value={form.indice_2} onChange={e => setForm(f => ({ ...f, indice_2: e.target.value }))} placeholder="Deuxième indice…" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <FInput label="Points" value={form.points} type="number" onChange={e => setForm(f => ({ ...f, points: e.target.value }))} />
        <FSelect label="Difficulté" value={form.difficulte} onChange={e => setForm(f => ({ ...f, difficulte: e.target.value }))}
          options={[{ value: 1, label: '▲ Facile' }, { value: 2, label: '▲▲ Moyen' }, { value: 3, label: '▲▲▲ Difficile' }]} />
        <FInput label="Compétence évaluée" value={form.competence_evaluee} onChange={e => setForm(f => ({ ...f, competence_evaluee: e.target.value }))} placeholder="Compétence…" />
      </div>
      <div style={{ display: 'flex', gap: 10 }}><CancelBtn onClose={onClose} /><SaveBtn loading={loading} /></div>
    </form>
  )
}

function TabExercices({ structure, filterNiveau = 'all', filterMat = 'all', onReload }) {
  const [exercices, setExercices] = useState([])
  const [loadingEx, setLoadingEx] = useState(true)
  const [search, setSearch] = useState('')
  const [filterUA, setFilterUA] = useState('all')
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [genModal, setGenModal] = useState(null)
  const [genLoading, setGenLoading] = useState(false)
  const [genForm, setGenForm] = useState({ nb: 3, type: 'qcm', difficulte: 1 })
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

  const TypeBadge = ({ type, options }) => {
    const isVF = type === 'qcm' && options?.length === 2 && (options.includes('Vrai') || options.includes('Faux'))
    const effectiveType = isVF ? 'vrai_faux' : type
    const cfg = {
      qcm:          { bg: C.bluePale,  color: C.blue,     label: 'QCM'       },
      vrai_faux:    { bg: '#D1FAE5',   color: '#065F46',  label: 'Vrai/Faux' },
      texte_trou:   { bg: '#F3E8FF',   color: '#7C3AED',  label: 'Trou'      },
      reponse_libre:{ bg: '#FEF3C7',   color: C.orange,   label: 'Libre'     },
    }[effectiveType] || { bg: C.brownPale, color: C.textSec, label: type }
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
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: C.textSec, background: C.surface, borderRadius: 16, border: `1px dashed ${C.brownLight}` }}>
              <Zap size={30} color={C.brownLight} style={{ margin: '0 auto 10px' }} />
              <p style={{ fontWeight: 600, fontSize: 14 }}>Aucun exercice</p>
              <p style={{ fontSize: 12 }}>Créez-en un manuellement ou utilisez la génération IA.</p>
            </div>
          )}
          {filtered.map((ex, i) => (
            <div key={ex.id} style={{ backgroundColor: C.surface, borderRadius: 12, padding: mobile ? '12px' : '12px 18px', border: `1px solid ${C.brownPale}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.titre || ex.enonce?.substring(0, 50) + '…'}</p>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <TypeBadge type={ex.type} options={ex.options} />
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
          ))}
        </div>
      )}

      {modal && (
        <Modal title={modal?.id ? "Modifier l'exercice" : 'Nouvel exercice'} onClose={() => setModal(null)} size={680}>
          <FormExercice initial={modal?.id ? modal : {}} uas={allUAs} onSubmit={handleSubmit} onClose={() => setModal(null)} />
        </Modal>
      )}
      {deleting && <ConfirmDelete item={deleting.titre || 'cet exercice'} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />}
    </div>
  )
}


// ════════════════════════════════════════════════════════════════
// TAB CONTENU — ajoute ce composant dans AdminCours.jsx
// avant le composant "export default AdminCours"
//
// Dans AdminCours, modifie :
// 1. TABS array : ajoute { id: 'contenu', label: 'Contenu', icon: FileText, badge: '...' }
// 2. loadAll : déjà OK (structure contient les UA avec nb_ressources)
// 3. Rendu : ajoute {activeTab === 'contenu' && <TabContenu structure={structure} onReload={loadAll} />}
// 4. Import : ajoute FileText depuis lucide-react
// ════════════════════════════════════════════════════════════════

function FormRessource({ initial = {}, uas = [], onSubmit, onClose }) {
  const [form, setForm] = useState({
    titre:       initial.titre       || '',
    type:        initial.type        || 'lecon',
    contenu:     initial.contenu     || '',
    points_cles: initial.points_cles || [],
    ordre:       initial.ordre       || 1,
    ua_id:       initial.ua_id       || uas[0]?.id || '',
  })
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
        contenu:     form.contenu,
        points_cles: form.points_cles,
        ordre:       parseInt(form.ordre),
      })
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handle}>
      {/* UA + type */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
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

      {/* Éditeur avec preview */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <FieldLabel required>Contenu (Markdown)</FieldLabel>
          <button type="button" onClick={() => setPreview(p => !p)} style={{
            padding: '3px 10px', background: preview ? C.brownPale : C.bluePale,
            color: preview ? C.brown : C.blue, border: 'none', borderRadius: 6,
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
          }}>
            {preview ? '✏️ Éditer' : '👁 Aperçu'}
          </button>
        </div>

        {preview ? (
          <div style={{ border: `1.5px solid ${C.brownPale}`, borderRadius: 8, padding: 16, minHeight: 200, background: '#FAFAFA' }}>
            <MarkdownPreview content={form.contenu} />
          </div>
        ) : (
          <textarea value={form.contenu} onChange={e => setForm(f => ({ ...f, contenu: e.target.value }))}
            placeholder={`# Titre\n\nIntroduction...\n\n## Définition\n\nTexte explicatif...\n\n- Point 1\n- Point 2\n\n\`\`\`\nExemple de code\n\`\`\``}
            rows={12}
            style={{ ...inputBase, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
            onFocus={e => e.target.style.borderColor = C.brown}
            onBlur={e => e.target.style.borderColor = C.brownPale}
          />
        )}
        <p style={{ fontSize: 10, color: C.textSec, marginTop: 4 }}>
          Supports : # Titres, **gras**, `code`, ```blocs```, - listes, &gt; citations
        </p>
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
  const [ressources,   setRessources]   = useState([])
  const [loadingRes,   setLoadingRes]   = useState(true)
  const [modal,        setModal]        = useState(null)
  const [deleting,     setDeleting]     = useState(null)
  const [filterUA,     setFilterUA]     = useState('all')
  const [search,       setSearch]       = useState('')
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
            Les ressources sont affichées à l'apprenant <strong>avant les exercices</strong>. Utilisez le Markdown pour structurer : <code style={{ background: C.brownPale, padding: '0 4px', borderRadius: 4, fontSize: 11 }}># Titre</code>, <code style={{ background: C.brownPale, padding: '0 4px', borderRadius: 4, fontSize: 11 }}>**gras**</code>, <code style={{ background: C.brownPale, padding: '0 4px', borderRadius: 4, fontSize: 11 }}>```code```</code>
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
            const wordCount = r.contenu?.split(' ').length || 0
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
  const [structure, setStructure] = useState([])
  const [niveaux,   setNiveaux]   = useState([])
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
      <div style={{ background: `linear-gradient(135deg, ${C.brownDark} 0%, ${C.brown} 60%, ${C.brownLight} 100%)`, borderRadius: xs ? 16 : 20, padding: xs ? '18px 16px' : '24px 28px', marginBottom: 20, position: 'relative', overflow: 'hidden', color: 'white' }}>
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
        {activeTab === 'structure'  && <TabStructure  structure={structure} niveaux={niveaux} filterNiveau={filterNiveau} filterMat={filterMat} onReload={loadAll} />}
        {activeTab === 'ua'         && <TabUA         structure={structure} filterNiveau={filterNiveau} filterMat={filterMat} onReload={loadAll} />}
        {activeTab === 'exercices'  && <TabExercices  structure={structure} filterNiveau={filterNiveau} filterMat={filterMat} onReload={loadAll} />}
        {activeTab === 'contenu'    && <TabContenu    structure={structure} filterNiveau={filterNiveau} filterMat={filterMat} onReload={loadAll} />}
      </div>
    </div>
  )
}