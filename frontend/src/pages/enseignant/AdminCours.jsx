import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Plus, Trash2, Edit3, BookOpen, ChevronRight,
  Upload, CheckCircle, X, Save, FileText, Target
} from 'lucide-react'

const C = {
  brown:       '#6B3A2A', brownLight:  '#C4865A',
  emerald:     '#0D9373', bg:          '#FAF7F4',
  surface:     '#FFFFFF', text:        '#1A1207',
  textSec:     '#6B5744', brownPale:   '#F5EDE5',
  emeraldPale: '#E6F5F0', red:         '#DC2626',
  orange:      '#F59E0B', gold:        '#D4A853',
}

// ── Composants utilitaires ────────────────────────────────────────
const Badge = ({ label, color = C.brown, bg = C.brownPale }) => (
  <span style={{ backgroundColor: bg, color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
    {label}
  </span>
)

const Input = ({ label, value, onChange, placeholder, type = 'text', required, disabled }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 12, fontWeight: 700, color: C.textSec, display: 'block', marginBottom: 5 }}>
      {label} {required && <span style={{ color: C.red }}>*</span>}
    </label>
    <input
      type={type} value={value} onChange={onChange}
      placeholder={placeholder} required={required} disabled={disabled}
      style={{
        width: '100%', padding: '10px 14px',
        border: `1px solid ${C.brownPale}`, borderRadius: 8,
        fontSize: 13, color: C.text, background: disabled ? C.brownPale : C.surface,
        outline: 'none', transition: 'border .2s',
        fontFamily: 'inherit'
      }}
      onFocus={e => e.target.style.borderColor = C.brown}
      onBlur={e => e.target.style.borderColor = C.brownPale}
    />
  </div>
)

const Textarea = ({ label, value, onChange, placeholder, rows = 4, required }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 12, fontWeight: 700, color: C.textSec, display: 'block', marginBottom: 5 }}>
      {label} {required && <span style={{ color: C.red }}>*</span>}
    </label>
    <textarea
      value={value} onChange={onChange} placeholder={placeholder}
      rows={rows} required={required}
      style={{
        width: '100%', padding: '10px 14px',
        border: `1px solid ${C.brownPale}`, borderRadius: 8,
        fontSize: 13, color: C.text, background: C.surface,
        outline: 'none', resize: 'vertical', fontFamily: 'inherit'
      }}
      onFocus={e => e.target.style.borderColor = C.brown}
      onBlur={e => e.target.style.borderColor = C.brownPale}
    />
  </div>
)

const Select = ({ label, value, onChange, options, required }) => (
  <div style={{ marginBottom: 14 }}>
    <label style={{ fontSize: 12, fontWeight: 700, color: C.textSec, display: 'block', marginBottom: 5 }}>
      {label} {required && <span style={{ color: C.red }}>*</span>}
    </label>
    <select value={value} onChange={onChange} required={required}
      style={{
        width: '100%', padding: '10px 14px',
        border: `1px solid ${C.brownPale}`, borderRadius: 8,
        fontSize: 13, color: C.text, background: C.surface,
        outline: 'none', fontFamily: 'inherit'
      }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

// ── Modal ─────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        backgroundColor: C.surface, borderRadius: 20, padding: '28px 32px',
        maxWidth: 600, width: '100%', maxHeight: '85vh', overflowY: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,.3)',
        animation: 'slideDown .2s ease'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.brown }}>{title}</h2>
          <button onClick={onClose} style={{ background: C.brownPale, border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: C.brown }}>
            <X size={16}/>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Formulaire UA ─────────────────────────────────────────────────
function FormUA({ familles, onSubmit, onClose, initial = {} }) {
  const [form, setForm] = useState({
    famille_id: initial.famille_id || familles[0]?.id || '',
    titre: initial.titre || '',
    reference_ue: initial.reference_ue || '',
    situation_probleme: initial.situation_probleme || '',
    duree_estimee: initial.duree_estimee || 60,
    competences: initial.competences?.join('\n') || '',
    prerequis: initial.prerequis?.join('\n') || '',
    ordre: initial.ordre || 1,
  })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit({
        ...form,
        competences: form.competences.split('\n').filter(c => c.trim()),
        prerequis: form.prerequis.split('\n').filter(p => p.trim()),
        duree_estimee: parseInt(form.duree_estimee),
        ordre: parseInt(form.ordre),
      })
    } finally { setLoading(false) }
  }

  const familleOptions = familles.map(f => ({ value: f.id, label: f.titre }))

  return (
    <form onSubmit={handleSubmit}>
      <Select label="Famille de situations" value={form.famille_id}
        onChange={e => setForm(f => ({ ...f, famille_id: e.target.value }))}
        options={familleOptions} required/>
      <Input label="Titre de l'UA" value={form.titre}
        onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
        placeholder="ex: Les structures de contrôle" required/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Référence UE" value={form.reference_ue}
          onChange={e => setForm(f => ({ ...f, reference_ue: e.target.value }))}
          placeholder="ex: UE 15 & 16"/>
        <Input label="Durée (minutes)" value={form.duree_estimee} type="number"
          onChange={e => setForm(f => ({ ...f, duree_estimee: e.target.value }))}/>
      </div>
      <Textarea label="Compétences visées (une par ligne)" value={form.competences}
        onChange={e => setForm(f => ({ ...f, competences: e.target.value }))}
        placeholder={"Identifier les structures de contrôle\nExécuter un algorithme itératif"} rows={3} required/>
      <Textarea label="Situation problème" value={form.situation_probleme}
        onChange={e => setForm(f => ({ ...f, situation_probleme: e.target.value }))}
        placeholder="Décris le contexte concret..." rows={3}/>
      <Textarea label="Prérequis (un par ligne)" value={form.prerequis}
        onChange={e => setForm(f => ({ ...f, prerequis: e.target.value }))}
        placeholder={"Variables et types\nInstructions d'entrée/sortie"} rows={2}/>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Annuler
        </button>
        <button type="submit" disabled={loading} style={{ flex: 2, padding: '11px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Save size={14}/> {loading ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </form>
  )
}

// ── Formulaire Exercice ───────────────────────────────────────────
function FormExercice({ uaId, competences = [], onSubmit, onClose, initial = {} }) {
  const [form, setForm] = useState({
    ua_id: uaId,
    titre: initial.titre || '',
    type: initial.type || 'qcm',
    enonce: initial.enonce || '',
    options: initial.options || ['', '', '', ''],
    reponse_correcte: initial.reponse_correcte || '',
    explication: initial.explication || '',
    indice_1: initial.indice_1 || '',
    indice_2: initial.indice_2 || '',
    competence_evaluee: initial.competence_evaluee || competences[0] || '',
    difficulte: initial.difficulte || 1,
    points: initial.points || 10,
    ordre: initial.ordre || 1,
  })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await onSubmit({
        ...form,
        options: form.type === 'qcm' ? form.options.filter(o => o.trim()) : null,
        difficulte: parseInt(form.difficulte),
        points: parseInt(form.points),
        ordre: parseInt(form.ordre),
      })
    } finally { setLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Titre" value={form.titre}
          onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
          placeholder="ex: Comprendre SI...SINON" required/>
        <Select label="Type" value={form.type}
          onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          options={[
            { value: 'qcm', label: 'QCM' },
            { value: 'texte_trou', label: 'Texte à trou' },
            { value: 'reponse_libre', label: 'Réponse libre' },
          ]}/>
      </div>

      <Textarea label="Énoncé" value={form.enonce}
        onChange={e => setForm(f => ({ ...f, enonce: e.target.value }))}
        placeholder="Question ou problème à résoudre…" rows={3} required/>

      {form.type === 'qcm' && (
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: C.textSec, display: 'block', marginBottom: 8 }}>
            Options (A, B, C, D)
          </label>
          {form.options.map((opt, i) => (
            <input key={i} value={opt}
              onChange={e => {
                const opts = [...form.options]; opts[i] = e.target.value
                setForm(f => ({ ...f, options: opts }))
              }}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.brownPale}`, borderRadius: 7, fontSize: 13, marginBottom: 7, fontFamily: 'inherit', outline: 'none' }}
            />
          ))}
        </div>
      )}

      <Input label="Réponse correcte" value={form.reponse_correcte}
        onChange={e => setForm(f => ({ ...f, reponse_correcte: e.target.value }))}
        placeholder="Texte exact de la bonne réponse" required/>

      <Textarea label="Explication" value={form.explication}
        onChange={e => setForm(f => ({ ...f, explication: e.target.value }))}
        placeholder="Pourquoi c'est la bonne réponse…" rows={2}/>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <Input label="Indice 1" value={form.indice_1}
          onChange={e => setForm(f => ({ ...f, indice_1: e.target.value }))}
          placeholder="Premier indice…"/>
        <Input label="Indice 2" value={form.indice_2}
          onChange={e => setForm(f => ({ ...f, indice_2: e.target.value }))}
          placeholder="Deuxième indice…"/>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: C.textSec, display: 'block', marginBottom: 5 }}>
          Compétence APC évaluée
        </label>
        {competences.length > 0 ? (
          <select value={form.competence_evaluee}
            onChange={e => setForm(f => ({ ...f, competence_evaluee: e.target.value }))}
            style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.brownPale}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}>
            {competences.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        ) : (
          <input value={form.competence_evaluee}
            onChange={e => setForm(f => ({ ...f, competence_evaluee: e.target.value }))}
            placeholder="ex: Identifier les structures de contrôle"
            style={{ width: '100%', padding: '10px 14px', border: `1px solid ${C.brownPale}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}/>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <Select label="Difficulté" value={form.difficulte}
          onChange={e => setForm(f => ({ ...f, difficulte: e.target.value }))}
          options={[{ value: 1, label: '1 — Facile' }, { value: 2, label: '2 — Moyen' }, { value: 3, label: '3 — Difficile' }]}/>
        <Input label="Points" value={form.points} type="number"
          onChange={e => setForm(f => ({ ...f, points: e.target.value }))}/>
        <Input label="Ordre" value={form.ordre} type="number"
          onChange={e => setForm(f => ({ ...f, ordre: e.target.value }))}/>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: '11px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          Annuler
        </button>
        <button type="submit" disabled={loading} style={{ flex: 2, padding: '11px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Save size={14}/> {loading ? 'Enregistrement…' : 'Créer l\'exercice'}
        </button>
      </div>
    </form>
  )
}

// ── Page principale AdminCours ────────────────────────────────────
export default function AdminCours() {
  const { user }     = useSelector(s => s.auth)
  const navigate     = useNavigate()
  const [structure,  setStructure]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [importing,  setImporting]  = useState(false)

  // État des panels
  const [selectedUA,  setSelectedUA]  = useState(null)
  const [exercices,   setExercices]   = useState([])
  const [view,        setView]        = useState('structure') // 'structure' | 'detail-ua'

  // Modals
  const [modalUA,  setModalUA]  = useState(false)
  const [modalEx,  setModalEx]  = useState(false)
  const [editUA,   setEditUA]   = useState(null)

  // Toutes les familles à plat pour le formulaire
  const familles = structure.flatMap(m => m.modules.flatMap(mod => mod.familles))

  useEffect(() => { loadStructure() }, [])

  async function loadStructure() {
    try {
      const { data } = await api.get('/api/admin/structure')
      setStructure(data)
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function loadExercices(uaId) {
    const { data } = await api.get(`/api/admin/ua/${uaId}/exercices`)
    setExercices(data)
  }

  async function createUA(payload) {
    try {
      await api.post('/api/admin/ua', payload)
      toast.success('UA créée avec succès !')
      setModalUA(false); loadStructure()
    } catch { toast.error('Erreur lors de la création') }
  }

  async function updateUA(payload) {
    try {
      await api.put(`/api/admin/ua/${editUA.id}`, payload)
      toast.success('UA mise à jour !')
      setEditUA(null); setModalUA(false); loadStructure()
      if (selectedUA?.id === editUA.id) setSelectedUA({ ...selectedUA, ...payload })
    } catch { toast.error('Erreur lors de la mise à jour') }
  }

  async function deleteUA(uaId) {
    if (!confirm('Désactiver cette UA ?')) return
    try {
      await api.delete(`/api/admin/ua/${uaId}`)
      toast.success('UA désactivée')
      loadStructure()
      if (selectedUA?.id === uaId) { setView('structure'); setSelectedUA(null) }
    } catch { toast.error('Erreur') }
  }

  async function createExercice(payload) {
    try {
      await api.post('/api/admin/exercice', payload)
      toast.success('Exercice créé !')
      setModalEx(false)
      if (selectedUA) loadExercices(selectedUA.id)
    } catch { toast.error('Erreur lors de la création') }
  }

  async function deleteExercice(id) {
    if (!confirm('Supprimer cet exercice ?')) return
    try {
      await api.delete(`/api/admin/exercice/${id}`)
      toast.success('Exercice supprimé')
      if (selectedUA) loadExercices(selectedUA.id)
    } catch { toast.error('Erreur') }
  }

  async function importPDF(e) {
    const file = e.target.files[0]
    if (!file) return
    if (familles.length === 0) { toast.error('Aucune famille disponible'); return }

    const familleId = familles[0].id
    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post(
        `/api/admin/import/pdf?famille_id=${familleId}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      toast.success(`✓ "${data.titre}" créée avec ${data.nb_exercices_crees} exercices !`)
      loadStructure()
    } catch {
      toast.error('Erreur d\'import — vérifie que le fichier est une fiche de préparation')
    } finally {
      setImporting(false); e.target.value = ''
    }
  }

  // Statistiques globales
  const totalUAs = structure.flatMap(m => m.modules.flatMap(mod => mod.familles.flatMap(f => f.unites))).length
  const totalEx  = structure.flatMap(m => m.modules.flatMap(mod => mod.familles.flatMap(f => f.unites.map(u => u.nb_exercices)))).reduce((a, b) => a + b, 0)

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: C.bg }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: `3px solid ${C.brownPale}`, borderTopColor: C.brown, margin: '0 auto 12px', animation: 'spin 1s linear infinite' }}/>
        <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600 }}>Chargement…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  )

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: '28px' }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}@keyframes fadeIn{from{opacity:0}to{opacity:1}}`}</style>

      {/* ── En-tête ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brown} 0%, ${C.brownLight} 100%)`,
        borderRadius: 20, padding: '24px 32px', marginBottom: 28,
        position: 'relative', overflow: 'hidden', color: 'white'
      }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }}>
          <defs>
            <pattern id="adinkra-admin" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="30" cy="30" r="6" fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="30" y1="18" x2="30" y2="12" stroke="white" strokeWidth="1.5"/>
              <line x1="18" y1="30" x2="12" y2="30" stroke="white" strokeWidth="1.5"/>
              <line x1="42" y1="30" x2="48" y2="30" stroke="white" strokeWidth="1.5"/>
              <line x1="30" y1="42" x2="30" y2="48" stroke="white" strokeWidth="1.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#adinkra-admin)"/>
        </svg>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, position: 'relative' }}>
          <div>
            <p style={{ opacity: .75, fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Administration</p>
            <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>Gestion des cours</h1>
            <div style={{ display: 'flex', gap: 16 }}>
              <span style={{ background: 'rgba(255,255,255,.2)', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                {totalUAs} unités d'apprentissage
              </span>
              <span style={{ background: 'rgba(255,255,255,.15)', padding: '3px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                {totalEx} exercices
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {/* Import PDF */}
            <label style={{
              background: importing ? '#E5E7EB' : `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`,
              color: 'white', padding: '10px 18px', borderRadius: 10,
              cursor: importing ? 'wait' : 'pointer', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8,
              boxShadow: `0 4px 14px rgba(13,147,115,.4)`
            }}>
              <Upload size={14}/>
              {importing ? 'Import IA en cours…' : 'Importer PDF'}
              <input type="file" accept=".pdf" onChange={importPDF} style={{ display: 'none' }} disabled={importing}/>
            </label>

            {/* Nouvelle UA */}
            <button onClick={() => { setEditUA(null); setModalUA(true) }} style={{
              background: 'rgba(255,255,255,.2)', border: '1px solid rgba(255,255,255,.3)',
              color: 'white', padding: '10px 18px', borderRadius: 10,
              cursor: 'pointer', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <Plus size={14}/> Nouvelle UA
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Structure pédagogique ── */}
        <div style={{ flex: 1, minWidth: 320 }}>
          {view === 'structure' && (
            <div style={{ animation: 'fadeIn .3s ease' }}>
              {structure.map(mat => (
                <div key={mat.id} style={{ marginBottom: 24 }}>
                  {/* Matière */}
                  <div style={{
                    background: `linear-gradient(135deg, ${C.brownPale}, ${C.emeraldPale})`,
                    borderRadius: 14, padding: '14px 20px', marginBottom: 14,
                    border: `1px solid ${C.brownLight}30`
                  }}>
                    <h2 style={{ fontSize: 15, fontWeight: 900, color: C.brown, marginBottom: 2 }}>
                      📚 {mat.nom}
                    </h2>
                    <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>{mat.niveau}</p>
                  </div>

                  {mat.modules.map(mod => (
                    <div key={mod.id} style={{ marginLeft: 12, marginBottom: 16 }}>
                      {/* Module */}
                      <p style={{ fontSize: 12, fontWeight: 800, color: C.brownLight, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                        Module {mod.numero} — {mod.titre.substring(0, 50)}{mod.titre.length > 50 ? '…' : ''}
                      </p>

                      {mod.familles.map(fam => (
                        <div key={fam.id} style={{ marginLeft: 8, marginBottom: 14 }}>
                          {/* Famille */}
                          <p style={{ fontSize: 12, fontWeight: 700, color: C.textSec, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.brownLight, display: 'inline-block' }}/>
                            {fam.titre}
                          </p>

                          {/* UAs */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 16 }}>
                            {fam.unites.map(ua => (
                              <div key={ua.id} style={{
                                backgroundColor: C.surface, borderRadius: 12, padding: '14px 16px',
                                border: `1px solid ${ua.actif ? C.brownPale : '#FCA5A5'}`,
                                boxShadow: '0 2px 8px rgba(107,58,42,0.06)',
                                opacity: ua.actif ? 1 : 0.6,
                                display: 'flex', alignItems: 'center', gap: 12
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <Badge label={ua.reference_ue || 'UE'}/>
                                    {!ua.actif && <Badge label="Désactivée" color={C.red} bg="#FEE2E2"/>}
                                  </div>
                                  <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {ua.titre}
                                  </p>
                                  <p style={{ fontSize: 11, color: C.textSec, margin: '3px 0 0' }}>
                                    {ua.nb_exercices} exercices · {ua.nb_ressources} ressources · {ua.duree_estimee} min
                                  </p>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                  <button
                                    onClick={async () => {
                                      setSelectedUA(ua)
                                      await loadExercices(ua.id)
                                      setView('detail-ua')
                                    }}
                                    style={{ padding: '6px 10px', background: C.brownPale, border: 'none', borderRadius: 7, cursor: 'pointer', color: C.brown, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <BookOpen size={12}/> Exercices
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditUA({ ...ua, famille_id: fam.id })
                                      setModalUA(true)
                                    }}
                                    style={{ padding: '6px 8px', background: '#DBEAFE', border: 'none', borderRadius: 7, cursor: 'pointer', color: '#1E40AF' }}>
                                    <Edit3 size={12}/>
                                  </button>
                                  <button
                                    onClick={() => deleteUA(ua.id)}
                                    style={{ padding: '6px 8px', background: '#FEE2E2', border: 'none', borderRadius: 7, cursor: 'pointer', color: C.red }}>
                                    <Trash2 size={12}/>
                                  </button>
                                </div>
                              </div>
                            ))}

                            {/* Bouton ajouter UA dans cette famille */}
                            <button
                              onClick={() => {
                                setEditUA(null)
                                setModalUA(true)
                              }}
                              style={{
                                padding: '10px 16px', background: 'transparent',
                                border: `1.5px dashed ${C.brownLight}`,
                                borderRadius: 10, cursor: 'pointer',
                                color: C.brownLight, fontSize: 12, fontWeight: 700,
                                display: 'flex', alignItems: 'center', gap: 6
                              }}>
                              <Plus size={13}/> Ajouter une UA dans {fam.titre}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* ── Détail UA ── */}
          {view === 'detail-ua' && selectedUA && (
            <div style={{ animation: 'fadeIn .3s ease' }}>
              <button onClick={() => setView('structure')} style={{ background: C.brownPale, border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', color: C.brown, fontSize: 13, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}>
                ← Retour à la structure
              </button>

              {/* Info UA */}
              <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '20px 24px', marginBottom: 20, border: `1px solid ${C.brownPale}`, boxShadow: '0 2px 10px rgba(107,58,42,0.07)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <Badge label={selectedUA.reference_ue || 'UE'} style={{ marginBottom: 8 }}/>
                    <h2 style={{ fontSize: 16, fontWeight: 800, color: C.brown, margin: '8px 0 4px' }}>
                      {selectedUA.titre}
                    </h2>
                    <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>
                      {selectedUA.duree_estimee} min · {exercices.length} exercices
                    </p>
                  </div>
                  <button onClick={() => setModalEx(true)} style={{
                    padding: '10px 18px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                    color: 'white', border: 'none', borderRadius: 10,
                    cursor: 'pointer', fontSize: 13, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: `0 4px 14px ${C.brown}30`
                  }}>
                    <Plus size={14}/> Ajouter un exercice
                  </button>
                </div>

                {/* Compétences */}
                {selectedUA.competences?.length > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Compétences</p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {selectedUA.competences.map((c, i) => (
                        <span key={i} style={{ background: C.brownPale, color: C.brown, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Liste exercices */}
              {exercices.length === 0 ? (
                <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: 32, textAlign: 'center', border: `1px dashed ${C.brownLight}` }}>
                  <FileText size={32} color={C.brownLight} style={{ margin: '0 auto 12px' }}/>
                  <p style={{ color: C.textSec, fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
                    Aucun exercice pour cette UA
                  </p>
                  <button onClick={() => setModalEx(true)} style={{ padding: '10px 20px', background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>
                    Créer le premier exercice
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {exercices.map((ex, i) => {
                    const diffColor = { 1: C.emerald, 2: C.orange, 3: C.red }
                    const diffBg    = { 1: C.emeraldPale, 2: '#FEF3C7', 3: '#FEE2E2' }
                    const diffLabel = { 1: 'Facile', 2: 'Moyen', 3: 'Difficile' }
                    return (
                      <div key={ex.id} style={{ backgroundColor: C.surface, borderRadius: 12, padding: '14px 18px', border: `1px solid ${C.brownPale}`, boxShadow: '0 2px 6px rgba(107,58,42,0.06)', display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, flexShrink: 0 }}>
                          {i + 1}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {ex.titre}
                          </p>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            <span style={{ backgroundColor: diffBg[ex.difficulte], color: diffColor[ex.difficulte], padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 700 }}>
                              {diffLabel[ex.difficulte]}
                            </span>
                            <span style={{ fontSize: 10, color: C.textSec, fontWeight: 600 }}>
                              {ex.type.toUpperCase()} · {ex.points} pts
                            </span>
                            {ex.competence_evaluee && (
                              <span style={{ fontSize: 10, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>
                                · {ex.competence_evaluee}
                              </span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => deleteExercice(ex.id)} style={{ padding: '6px 8px', background: '#FEE2E2', border: 'none', borderRadius: 7, cursor: 'pointer', color: C.red, flexShrink: 0 }}>
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Panneau droit — stats et guide ── */}
        <div style={{ width: 260, flexShrink: 0 }}>

          {/* Stats */}
          <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '20px', marginBottom: 16, boxShadow: '0 2px 10px rgba(107,58,42,0.07)', border: `1px solid ${C.brownPale}` }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.brown, marginBottom: 14 }}>
              📊 Statistiques
            </h3>
            {[
              { label: 'Matières',  value: structure.length },
              { label: 'UAs actives', value: totalUAs },
              { label: 'Exercices', value: totalEx },
              { label: 'Familles',  value: structure.flatMap(m => m.modules.flatMap(mod => mod.familles)).length },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${C.brownPale}` }}>
                <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: C.brown }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Guide import PDF */}
          <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '20px', marginBottom: 16, border: `1px solid ${C.emerald}30`, background: `linear-gradient(135deg, ${C.emeraldPale}, ${C.brownPale})` }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.emerald, marginBottom: 10 }}>
              🤖 Import IA — Guide
            </h3>
            <p style={{ fontSize: 12, color: C.textSec, lineHeight: 1.6, marginBottom: 10 }}>
              Uploade une fiche de préparation PDF et l'IA extrait automatiquement :
            </p>
            {['Titre et référence UE', 'Compétences APC', 'Situation problème', 'Contenu de la leçon', 'Exercices QCM + indices'].map(item => (
              <div key={item} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginBottom: 6 }}>
                <CheckCircle size={12} color={C.emerald} style={{ flexShrink: 0, marginTop: 2 }}/>
                <p style={{ fontSize: 11, color: C.textSec, margin: 0, lineHeight: 1.5 }}>{item}</p>
              </div>
            ))}
          </div>

          {/* Hiérarchie APC */}
          <div style={{ backgroundColor: C.surface, borderRadius: 16, padding: '20px', border: `1px solid ${C.brownPale}`, boxShadow: '0 2px 10px rgba(107,58,42,0.07)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.brown, marginBottom: 12 }}>
              🗂️ Hiérarchie APC
            </h3>
            {[
              { level: 'Matière',           icon: '📚', color: C.brown },
              { level: 'Module',            icon: '📦', color: C.brownLight },
              { level: 'Famille',           icon: '🗂️', color: C.emerald },
              { level: 'UA (Unité)',         icon: '📄', color: C.orange },
              { level: 'Exercice',          icon: '✏️', color: C.textSec },
            ].map((h, i) => (
              <div key={h.level} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: i * 10 }}>
                <span style={{ fontSize: 14 }}>{h.icon}</span>
                <div style={{ flex: 1, height: 1, background: `${h.color}30` }}/>
                <span style={{ fontSize: 11, fontWeight: 700, color: h.color }}>{h.level}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {modalUA && (
        <Modal
          title={editUA ? 'Modifier l\'UA' : 'Créer une Unité d\'Apprentissage'}
          onClose={() => { setModalUA(false); setEditUA(null) }}
        >
          <FormUA
            familles={familles}
            initial={editUA || {}}
            onSubmit={editUA ? updateUA : createUA}
            onClose={() => { setModalUA(false); setEditUA(null) }}
          />
        </Modal>
      )}

      {modalEx && selectedUA && (
        <Modal
          title={`Ajouter un exercice — ${selectedUA.titre}`}
          onClose={() => setModalEx(false)}
        >
          <FormExercice
            uaId={selectedUA.id}
            competences={selectedUA.competences || []}
            onSubmit={createExercice}
            onClose={() => setModalEx(false)}
          />
        </Modal>
      )}
    </div>
  )
}