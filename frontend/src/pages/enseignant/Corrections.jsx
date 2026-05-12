import { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { useTheme } from '../../styles/theme.jsx'

export default function Corrections() {
  const { C } = useTheme()
  const { user } = useSelector(s => s.auth)

  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [form,     setForm]     = useState({}) // { [prog_id]: { correct, points, commentaire } }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/api/cours/corrections/en_attente')
      setItems(data)
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function getForm(id, defaults) {
    return form[id] ?? defaults
  }

  function setField(id, field, value) {
    setForm(f => ({ ...f, [id]: { ...getForm(id, {}), [field]: value } }))
  }

  async function soumettre(item) {
    const f = getForm(item.progression_id, {})
    if (f.correct === undefined) return toast.error('Cochez Correct ou Incorrect')
    try {
      await api.post(`/api/cours/corrections/${item.progression_id}/evaluer`, {
        correct:     f.correct,
        points:      f.correct ? (f.points ?? item.points_max) : 0,
        commentaire: f.commentaire || null,
      })
      toast.success('Évaluation enregistrée')
      setItems(prev => prev.filter(i => i.progression_id !== item.progression_id))
      setExpanded(null)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erreur')
    }
  }

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: C.textSec }}>Chargement…</div>
  )

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 18, fontWeight: 900, color: C.brown, margin: 0 }}>
          ✍️ Corrections des réponses libres
        </h1>
        <p style={{ fontSize: 13, color: C.textSec, margin: '4px 0 0' }}>
          {items.length} réponse{items.length !== 1 ? 's' : ''} en attente d'évaluation
        </p>
      </div>

      {items.length === 0 ? (
        <div style={{ background: C.emeraldPale, borderRadius: 14, padding: '32px 24px', textAlign: 'center', border: `1px solid ${C.emerald}30` }}>
          <CheckCircle size={32} color={C.emerald} style={{ marginBottom: 10 }}/>
          <p style={{ fontSize: 15, fontWeight: 800, color: C.emerald, margin: 0 }}>
            Aucune réponse en attente — tout est corrigé !
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {items.map(item => {
            const isOpen = expanded === item.progression_id
            const f      = getForm(item.progression_id, {})

            return (
              <div key={item.progression_id} style={{
                background: '#fff', borderRadius: 14,
                border: `1.5px solid ${C.brownPale}`,
                boxShadow: '0 2px 8px rgba(107,58,42,.06)',
                overflow: 'hidden',
              }}>
                {/* Header */}
                <button
                  onClick={() => setExpanded(isOpen ? null : item.progression_id)}
                  style={{
                    width: '100%', padding: '14px 18px', background: 'none', border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                  }}
                >
                  <Clock size={16} color="#F59E0B" style={{ flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.apprenant_nom} — {item.exercice_titre}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>
                      {item.date_soumission ? new Date(item.date_soumission).toLocaleString('fr-FR') : ''} · {item.points_max} pts
                    </p>
                  </div>
                  {isOpen ? <ChevronUp size={16} color={C.textSec}/> : <ChevronDown size={16} color={C.textSec}/>}
                </button>

                {/* Corps dépliable */}
                {isOpen && (
                  <div style={{ padding: '0 18px 18px', borderTop: `1px solid ${C.brownPale}` }}>

                    {/* Consigne */}
                    <div style={{ marginTop: 14, background: C.brownPale, borderRadius: 10, padding: '10px 14px', borderLeft: `4px solid ${C.brown}` }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: C.brown, textTransform: 'uppercase', letterSpacing: .5 }}>Consigne</p>
                      <p style={{ margin: 0, fontSize: 13, color: C.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                        {item.exercice_enonce.startsWith('__APC__')
                          ? (() => { try { return JSON.parse(item.exercice_enonce.slice(7)).consigne } catch { return item.exercice_enonce } })()
                          : item.exercice_enonce}
                      </p>
                    </div>

                    {/* Réponse apprenant */}
                    <div style={{ marginTop: 10, background: '#EFF6FF', borderRadius: 10, padding: '10px 14px', border: '1px solid #BFDBFE' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: .5 }}>Réponse de {item.apprenant_nom.split(' ')[0]}</p>
                      <p style={{ margin: 0, fontSize: 13, color: '#1E3A5F', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{item.reponse_apprenant}</p>
                    </div>

                    {/* Réponse modèle */}
                    <div style={{ marginTop: 10, background: '#F0FDF4', borderRadius: 10, padding: '10px 14px', border: '1px solid #BBF7D0' }}>
                      <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: .5 }}>Réponse modèle</p>
                      <p style={{ margin: 0, fontSize: 13, color: '#14532D', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{item.reponse_modele}</p>
                    </div>

                    {/* Formulaire évaluation */}
                    <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {/* Correct / Incorrect */}
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[
                          { val: true,  label: '✓ Correct',   bg: C.emeraldPale, color: C.emerald, border: C.emerald },
                          { val: false, label: '✗ Incorrect', bg: '#FEE2E2',     color: '#EF4444',  border: '#EF4444' },
                        ].map(({ val, label, bg, color, border }) => (
                          <button key={String(val)} onClick={() => setField(item.progression_id, 'correct', val)}
                            style={{
                              flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                              border: `2px solid ${f.correct === val ? border : C.brownPale}`,
                              background: f.correct === val ? bg : '#fff',
                              color: f.correct === val ? color : C.textSec,
                              fontSize: 13, fontWeight: 800, transition: 'all .15s',
                            }}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {/* Points */}
                      {f.correct === true && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: C.textSec, flexShrink: 0 }}>Points :</label>
                          <input type="number" min={0} max={item.points_max}
                            value={f.points ?? item.points_max}
                            onChange={e => setField(item.progression_id, 'points', parseInt(e.target.value))}
                            style={{ width: 70, padding: '6px 10px', border: `1.5px solid ${C.brownPale}`, borderRadius: 8, fontSize: 13, fontWeight: 800, textAlign: 'center' }}/>
                          <span style={{ fontSize: 12, color: C.textSec }}>/ {item.points_max}</span>
                        </div>
                      )}

                      {/* Commentaire */}
                      <textarea rows={2}
                        placeholder="Commentaire à l'apprenant (optionnel)…"
                        value={f.commentaire || ''}
                        onChange={e => setField(item.progression_id, 'commentaire', e.target.value)}
                        style={{ padding: '10px 12px', border: `1.5px solid ${C.brownPale}`, borderRadius: 10, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                      />

                      {/* Soumettre */}
                      <button onClick={() => soumettre(item)}
                        disabled={f.correct === undefined}
                        style={{
                          padding: '11px', borderRadius: 10, border: 'none', cursor: f.correct === undefined ? 'not-allowed' : 'pointer',
                          background: f.correct === undefined ? '#E5E7EB' : `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                          color: f.correct === undefined ? C.textSec : 'white',
                          fontSize: 14, fontWeight: 800,
                        }}>
                        Enregistrer l'évaluation
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
