import { useEffect, useState } from 'react'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, ChevronDown, ChevronRight, Shield } from 'lucide-react'

const C = {
  brown:'#6B3A2A', brownLight:'#C4865A', emerald:'#0D9373',
  bg:'#FAF7F4', surface:'#FFFFFF', text:'#1A1207',
  textSec:'#6B5744', brownPale:'#F5EDE5', emeraldPale:'#E6F5F0',
  red:'#DC2626', orange:'#F59E0B', gold:'#D4A853',
}

const Input = ({ label, value, onChange, placeholder, required }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 700, color: C.textSec, display: 'block', marginBottom: 4 }}>
      {label} {required && <span style={{ color: C.red }}>*</span>}
    </label>}
    <input value={value} onChange={onChange} placeholder={placeholder} required={required}
      style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.brownPale}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
      onFocus={e => e.target.style.borderColor = C.brown}
      onBlur={e => e.target.style.borderColor = C.brownPale}
    />
  </div>
)

const Select = ({ label, value, onChange, options }) => (
  <div style={{ marginBottom: 12 }}>
    {label && <label style={{ fontSize: 12, fontWeight: 700, color: C.textSec, display: 'block', marginBottom: 4 }}>{label}</label>}
    <select value={value} onChange={onChange}
      style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.brownPale}`, borderRadius: 8, fontSize: 13, fontFamily: 'inherit', outline: 'none', background: C.surface }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
)

export default function AdminReferentiel() {
  const [referentiel, setReferentiel] = useState([])
  const [loading, setLoading]         = useState(true)
  const [expanded, setExpanded]       = useState({})

  // Formulaires
  const [newFiliere, setNewFiliere] = useState({ ordre_id: '', nom: '', code: '', description: '' })
  const [newNiveau,  setNewNiveau]  = useState({ cycle_id: '', nom: '', code: '' })
  const [activeForm, setActiveForm] = useState(null) // 'filiere' | 'niveau'

  useEffect(() => { loadReferentiel() }, [])

  async function loadReferentiel() {
    try {
      const { data } = await api.get('/api/admin/referentiel')
      setReferentiel(data)
      // Pré-sélectionner le premier ordre et cycle
      if (data.length > 0) {
        const firstOrdre  = data.flatMap(c => c.ordres)[0]
        const firstCycle  = data[0]
        if (firstOrdre) setNewFiliere(f => ({ ...f, ordre_id: firstOrdre.id }))
        if (firstCycle) setNewNiveau(n => ({ ...n, cycle_id: firstCycle.id }))
      }
    } catch { toast.error('Erreur de chargement') }
    finally { setLoading(false) }
  }

  async function createFiliere(e) {
    e.preventDefault()
    if (!newFiliere.ordre_id || !newFiliere.nom || !newFiliere.code) {
      toast.error('Ordre, nom et code sont requis')
      return
    }
    try {
      await api.post('/api/admin/filiere', newFiliere)
      toast.success(`Filière "${newFiliere.nom}" créée !`)
      setNewFiliere(f => ({ ...f, nom: '', code: '', description: '' }))
      setActiveForm(null)
      loadReferentiel()
    } catch { toast.error('Erreur lors de la création') }
  }

  async function deleteFiliere(id, nom) {
    if (!confirm(`Désactiver la filière "${nom}" ?`)) return
    try {
      await api.delete(`/api/admin/filiere/${id}`)
      toast.success('Filière désactivée')
      loadReferentiel()
    } catch { toast.error('Erreur') }
  }

  async function createNiveau(e) {
    e.preventDefault()
    if (!newNiveau.cycle_id || !newNiveau.nom || !newNiveau.code) {
      toast.error('Cycle, nom et code sont requis')
      return
    }
    try {
      await api.post('/api/admin/niveau', newNiveau)
      toast.success(`Niveau "${newNiveau.nom}" créé !`)
      setNewNiveau(n => ({ ...n, nom: '', code: '' }))
      setActiveForm(null)
      loadReferentiel()
    } catch { toast.error('Erreur lors de la création') }
  }

  async function deleteNiveau(id, nom) {
    if (!confirm(`Désactiver le niveau "${nom}" ?`)) return
    try {
      await api.delete(`/api/admin/niveau/${id}`)
      toast.success('Niveau désactivé')
      loadReferentiel()
    } catch { toast.error('Erreur') }
  }

  function toggleExpand(key) {
    setExpanded(e => ({ ...e, [key]: !e[key] }))
  }

  // Toutes les options pour les selects
  const allOrdres  = referentiel.flatMap(c => c.ordres)
  const allCycles  = referentiel
  const ordreOpts  = allOrdres.map(o => ({ value: o.id, label: `${o.nom} (${o.code})` }))
  const cycleOpts  = allCycles.map(c => ({ value: c.id, label: c.nom }))

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: `3px solid ${C.brownPale}`, borderTopColor: C.brown, animation: 'spin 1s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: 28 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* ── En-tête ── */}
      <div style={{
        background: `linear-gradient(135deg, #2D1208, ${C.brown})`,
        borderRadius: 20, padding: '24px 32px', marginBottom: 28,
        position: 'relative', overflow: 'hidden', color: 'white'
      }}>
        <svg width="100%" height="100%" style={{ position:'absolute',inset:0,opacity:.06,pointerEvents:'none' }}>
          <defs><pattern id="adr" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5"/>
            <circle cx="30" cy="30" r="6" fill="none" stroke="white" strokeWidth="1.5"/>
            <line x1="30" y1="18" x2="30" y2="12" stroke="white" strokeWidth="1.5"/>
            <line x1="18" y1="30" x2="12" y2="30" stroke="white" strokeWidth="1.5"/>
            <line x1="42" y1="30" x2="48" y2="30" stroke="white" strokeWidth="1.5"/>
            <line x1="30" y1="42" x2="30" y2="48" stroke="white" strokeWidth="1.5"/>
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#adr)"/>
        </svg>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Shield size={20} color={C.gold}/>
            <p style={{ opacity: .75, fontSize: 13, fontWeight: 600 }}>Super Admin — Accès exclusif</p>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 6 }}>
            Référentiel éducatif camerounais
          </h1>
          <p style={{ opacity: .7, fontSize: 13 }}>
            Gère les cycles, ordres, filières et niveaux. Toute modification est immédiatement disponible pour les apprenants.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Structure arborescente ── */}
        <div style={{ flex: 1, minWidth: 340 }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.brown, marginBottom: 16 }}>
            Structure actuelle
          </h2>

          {referentiel.map(cycle => (
            <div key={cycle.id} style={{ marginBottom: 16 }}>
              {/* Cycle */}
              <div
                onClick={() => toggleExpand(`cycle-${cycle.id}`)}
                style={{
                  backgroundColor: C.surface, borderRadius: 12, padding: '12px 16px',
                  border: `1px solid ${C.brownPale}`, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                  boxShadow: '0 2px 8px rgba(107,58,42,0.06)'
                }}
              >
                {expanded[`cycle-${cycle.id}`]
                  ? <ChevronDown size={14} color={C.brown}/>
                  : <ChevronRight size={14} color={C.brown}/>}
                <span style={{ fontSize: 14, fontWeight: 800, color: C.brown }}>
                  📚 {cycle.nom}
                </span>
                <span style={{ fontSize: 11, color: C.textSec, marginLeft: 'auto' }}>
                  {cycle.ordres?.length} ordre(s) · {cycle.niveaux?.length} niveau(x)
                </span>
              </div>

              {expanded[`cycle-${cycle.id}`] && (
                <div style={{ marginLeft: 20, marginTop: 6, animation: 'fadeIn .2s ease' }}>

                  {/* Niveaux du cycle */}
                  {cycle.niveaux?.length > 0 && (
                    <div style={{
                      backgroundColor: C.brownPale, borderRadius: 10, padding: '10px 14px',
                      marginBottom: 8, border: `1px solid ${C.brownLight}30`
                    }}>
                      <p style={{ fontSize: 11, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>
                        Niveaux / Classes
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {cycle.niveaux.map(niveau => (
                          <div key={niveau.id} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: C.surface, borderRadius: 20, padding: '4px 10px',
                            border: `1px solid ${C.brownPale}`
                          }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>
                              {niveau.nom}
                            </span>
                            <span style={{ fontSize: 10, color: C.textSec }}>
                              ({niveau.code})
                            </span>
                            <button onClick={() => deleteNiveau(niveau.id, niveau.nom)} style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#FCA5A5', padding: 0, display: 'flex'
                            }}>
                              <Trash2 size={11}/>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Ordres et filières */}
                  {cycle.ordres?.map(ordre => (
                    <div key={ordre.id} style={{ marginBottom: 8 }}>
                      <div
                        onClick={() => toggleExpand(`ordre-${ordre.id}`)}
                        style={{
                          backgroundColor: C.surface, borderRadius: 10, padding: '10px 14px',
                          border: `1px solid ${C.brownPale}`, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 8,
                          boxShadow: '0 1px 4px rgba(107,58,42,0.04)'
                        }}
                      >
                        {expanded[`ordre-${ordre.id}`]
                          ? <ChevronDown size={12} color={C.brownLight}/>
                          : <ChevronRight size={12} color={C.brownLight}/>}
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
                          {ordre.nom}
                        </span>
                        <span style={{ fontSize: 10, color: C.textSec, marginLeft: 'auto' }}>
                          {ordre.filieres?.length} filière(s)
                        </span>
                      </div>

                      {expanded[`ordre-${ordre.id}`] && (
                        <div style={{ marginLeft: 16, marginTop: 6, animation: 'fadeIn .2s ease' }}>
                          {ordre.filieres?.map(filiere => (
                            <div key={filiere.id} style={{
                              display: 'flex', alignItems: 'center', gap: 10,
                              padding: '8px 12px', marginBottom: 4,
                              backgroundColor: C.surface, borderRadius: 8,
                              border: `1px solid ${C.brownPale}`
                            }}>
                              <div style={{
                                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                                background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                                color: 'white', display: 'flex', alignItems: 'center',
                                justifyContent: 'center', fontSize: 10, fontWeight: 900
                              }}>
                                {filiere.code}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>
                                  {filiere.nom}
                                </p>
                                {filiere.description && (
                                  <p style={{ fontSize: 11, color: C.textSec, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {filiere.description}
                                  </p>
                                )}
                              </div>
                              <button onClick={() => deleteFiliere(filiere.id, filiere.nom)} style={{
                                background: '#FEE2E2', border: 'none', borderRadius: 6,
                                padding: '4px 6px', cursor: 'pointer', color: C.red,
                                display: 'flex', alignItems: 'center', flexShrink: 0
                              }}>
                                <Trash2 size={12}/>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Formulaires d'ajout ── */}
        <div style={{ width: 300, flexShrink: 0 }}>

          {/* Boutons d'action */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button onClick={() => setActiveForm(activeForm === 'filiere' ? null : 'filiere')} style={{
              flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: activeForm === 'filiere'
                ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`
                : C.brownPale,
              color: activeForm === 'filiere' ? 'white' : C.brown,
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
              <Plus size={13}/> Nouvelle filière
            </button>
            <button onClick={() => setActiveForm(activeForm === 'niveau' ? null : 'niveau')} style={{
              flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: activeForm === 'niveau'
                ? `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`
                : C.emeraldPale,
              color: activeForm === 'niveau' ? 'white' : C.emerald,
              fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
              <Plus size={13}/> Nouveau niveau
            </button>
          </div>

          {/* Formulaire filière */}
          {activeForm === 'filiere' && (
            <div style={{
              backgroundColor: C.surface, borderRadius: 16, padding: '20px',
              border: `1px solid ${C.brownPale}`, marginBottom: 16,
              animation: 'fadeIn .2s ease',
              boxShadow: '0 4px 16px rgba(107,58,42,0.1)'
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.brown, marginBottom: 16 }}>
                Nouvelle filière
              </h3>
              <form onSubmit={createFiliere}>
                <Select label="Ordre d'enseignement" value={newFiliere.ordre_id}
                  onChange={e => setNewFiliere(f => ({ ...f, ordre_id: e.target.value }))}
                  options={ordreOpts}/>
                <Input label="Nom complet" value={newFiliere.nom}
                  onChange={e => setNewFiliere(f => ({ ...f, nom: e.target.value }))}
                  placeholder="ex: F7 Génie Informatique" required/>
                <Input label="Code" value={newFiliere.code}
                  onChange={e => setNewFiliere(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="ex: F7" required/>
                <Input label="Description (optionnel)" value={newFiliere.description}
                  onChange={e => setNewFiliere(f => ({ ...f, description: e.target.value }))}
                  placeholder="ex: Brevet en Génie Informatique"/>
                <button type="submit" style={{
                  width: '100%', padding: '11px',
                  background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                  color: 'white', border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 800, cursor: 'pointer'
                }}>
                  Créer la filière
                </button>
              </form>
            </div>
          )}

          {/* Formulaire niveau */}
          {activeForm === 'niveau' && (
            <div style={{
              backgroundColor: C.surface, borderRadius: 16, padding: '20px',
              border: `1px solid ${C.emerald}30`, marginBottom: 16,
              animation: 'fadeIn .2s ease',
              boxShadow: '0 4px 16px rgba(13,147,115,0.1)'
            }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: C.emerald, marginBottom: 16 }}>
                Nouveau niveau / classe
              </h3>
              <form onSubmit={createNiveau}>
                <Select label="Cycle" value={newNiveau.cycle_id}
                  onChange={e => setNewNiveau(n => ({ ...n, cycle_id: e.target.value }))}
                  options={cycleOpts}/>
                <Input label="Nom" value={newNiveau.nom}
                  onChange={e => setNewNiveau(n => ({ ...n, nom: e.target.value }))}
                  placeholder="ex: CM2" required/>
                <Input label="Code" value={newNiveau.code}
                  onChange={e => setNewNiveau(n => ({ ...n, code: e.target.value.toUpperCase() }))}
                  placeholder="ex: CM2" required/>
                <button type="submit" style={{
                  width: '100%', padding: '11px',
                  background: `linear-gradient(135deg, ${C.emerald}, #0A7A5E)`,
                  color: 'white', border: 'none', borderRadius: 10,
                  fontSize: 13, fontWeight: 800, cursor: 'pointer'
                }}>
                  Créer le niveau
                </button>
              </form>
            </div>
          )}

          {/* Résumé stats */}
          <div style={{
            backgroundColor: C.surface, borderRadius: 16, padding: '20px',
            border: `1px solid ${C.brownPale}`,
            boxShadow: '0 2px 10px rgba(107,58,42,0.07)'
          }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: C.brown, marginBottom: 14 }}>
              📊 Statistiques du référentiel
            </h3>
            {[
              { label: 'Cycles',    value: referentiel.length },
              { label: 'Ordres',    value: referentiel.flatMap(c => c.ordres).length },
              { label: 'Filières',  value: referentiel.flatMap(c => c.ordres.flatMap(o => o.filieres)).length },
              { label: 'Niveaux',   value: referentiel.flatMap(c => c.niveaux).length },
            ].map(s => (
              <div key={s.label} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '8px 0', borderBottom: `1px solid ${C.brownPale}`
              }}>
                <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>{s.label}</span>
                <span style={{ fontSize: 14, fontWeight: 900, color: C.brown }}>{s.value}</span>
              </div>
            ))}

            <div style={{
              marginTop: 14, padding: '10px 12px',
              background: `linear-gradient(135deg, ${C.brownPale}, ${C.emeraldPale})`,
              borderRadius: 10, fontSize: 11, color: C.textSec, lineHeight: 1.6
            }}>
              💡 Les filières désactivées restent visibles dans les anciens profils mais n'apparaissent plus dans l'onboarding.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
