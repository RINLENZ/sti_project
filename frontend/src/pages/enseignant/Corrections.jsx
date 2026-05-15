import { useEffect, useState, useCallback } from 'react'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Clock, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Spinner } from '../../components/Skeleton'
import RichText from '../../components/RichText'

export default function Corrections() {
  const { C }    = useTheme()
  const { user } = useSelector(s => s.auth)
  const { xs, mobile } = useBreakpoint()
  const pad = xs ? 10 : mobile ? 16 : 24

  const [items,    setItems]    = useState([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [form,     setForm]     = useState({})

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

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: pad, boxSizing: 'border-box' }}>

      {/* ── Header ── */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
        borderRadius: xs ? 14 : 18, padding: xs ? '16px 14px' : '20px 24px',
        marginBottom: 20, color: 'white',
        position: 'relative', overflow: 'hidden',
        animation: 'fadeUp .35s ease both',
      }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: .06, pointerEvents: 'none' }}>
          <defs><pattern id="corr-bg" x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse">
            <rect x="8" y="8" width="16" height="16" fill="none" stroke="white" strokeWidth="1.2" rx="3"/>
            <line x1="8" y1="16" x2="24" y2="16" stroke="white" strokeWidth=".8"/>
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#corr-bg)"/>
        </svg>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ClipboardList size={18} color="white"/>
          </div>
          <div>
            <p style={{ fontSize: 11, opacity: .7, fontWeight: 600, margin: '0 0 2px' }}>Espace enseignant</p>
            <h1 style={{ fontSize: xs ? 16 : 19, fontWeight: 900, margin: 0 }}>Corrections des réponses libres</h1>
          </div>
          {!loading && (
            <span style={{ marginLeft: 'auto', background: items.length > 0 ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.12)', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800, flexShrink: 0 }}>
              {items.length} en attente
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner/></div>
      ) : items.length === 0 ? (
        /* ── Empty state ── */
        <div style={{
          background: C.surface, borderRadius: 18, padding: xs ? '32px 20px' : '48px 36px',
          textAlign: 'center', border: `1.5px solid ${C.emerald}30`,
          animation: 'fadeUp .35s ease both',
        }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: C.emeraldPale, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <CheckCircle size={28} color={C.emerald}/>
          </div>
          <p style={{ fontSize: 16, fontWeight: 900, color: C.emerald, margin: '0 0 6px' }}>
            Tout est corrigé !
          </p>
          <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>Aucune réponse libre en attente d'évaluation.</p>
        </div>
      ) : (
        /* ── Liste ── */
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: xs ? 8 : 12 }}>
          {items.map((item, i) => {
            const isOpen = expanded === item.progression_id
            const f      = getForm(item.progression_id, {})

            return (
              <div key={item.progression_id} style={{
                background: C.surface, borderRadius: xs ? 12 : 16,
                border: `1.5px solid ${C.border}`,
                boxShadow: '0 2px 10px rgba(107,58,42,.06)',
                overflow: 'hidden',
                animation: `fadeUp .35s ${i * 0.04}s ease both`,
              }}>
                {/* ── Header cliquable ── */}
                <button
                  onClick={() => setExpanded(isOpen ? null : item.progression_id)}
                  style={{
                    width: '100%', padding: xs ? '12px 14px' : '14px 20px',
                    background: 'none', border: 'none',
                    cursor: 'pointer', display: 'flex', alignItems: 'center',
                    gap: 12, textAlign: 'left',
                    borderBottom: isOpen ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Clock size={15} color="#D97706"/>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: xs ? 12 : 13, fontWeight: 800, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.apprenant_nom} — {item.exercice_titre}
                    </p>
                    <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>
                      {item.date_soumission
                        ? new Date(item.date_soumission).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                        : ''}
                      {' · '}{item.points_max} pt{item.points_max > 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronDown size={16} color={C.textSec} style={{ flexShrink: 0, transition: 'transform .2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)' }}/>
                </button>

                {/* ── Corps ── */}
                {isOpen && (
                  <div style={{ padding: xs ? '12px 14px' : '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, animation: 'slideDown .2s ease' }}>

                    {/* Consigne */}
                    <div style={{ background: C.brownGhost, borderRadius: 10, padding: '10px 14px', borderLeft: `4px solid ${C.brown}` }}>
                      <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 800, color: C.brown, textTransform: 'uppercase', letterSpacing: .5 }}>Consigne</p>
                      <RichText
                        text={item.exercice_enonce.startsWith('__APC__')
                          ? (() => { try { return JSON.parse(item.exercice_enonce.slice(7)).consigne } catch { return item.exercice_enonce } })()
                          : item.exercice_enonce}
                        style={{ fontSize: 13, lineHeight: 1.7 }}
                      />
                    </div>

                    {/* Réponse apprenant */}
                    <div style={{ background: '#EFF6FF', borderRadius: 10, padding: '10px 14px', border: '1px solid #BFDBFE' }}>
                      <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 800, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: .5 }}>
                        Réponse de {item.apprenant_nom.split(' ')[0]}
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: '#1E3A5F', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{item.reponse_apprenant}</p>
                    </div>

                    {/* Réponse modèle */}
                    <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '10px 14px', border: '1px solid #BBF7D0' }}>
                      <p style={{ margin: '0 0 5px', fontSize: 10, fontWeight: 800, color: '#166534', textTransform: 'uppercase', letterSpacing: .5 }}>Réponse modèle</p>
                      <RichText text={item.reponse_modele} style={{ fontSize: 13, lineHeight: 1.7, color: '#14532D' }}/>
                    </div>

                    {/* ── Formulaire évaluation ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[
                          { val: true,  label: '✓ Correct',   bg: C.emeraldPale, color: C.emerald, border: C.emerald },
                          { val: false, label: '✗ Incorrect', bg: '#FEE2E2',     color: '#EF4444',  border: '#EF4444' },
                        ].map(({ val, label, bg, color, border }) => (
                          <button key={String(val)} onClick={() => setField(item.progression_id, 'correct', val)}
                            style={{
                              flex: 1, padding: '10px', borderRadius: 10, cursor: 'pointer',
                              border: `2px solid ${f.correct === val ? border : C.border}`,
                              background: f.correct === val ? bg : C.bg,
                              color: f.correct === val ? color : C.textSec,
                              fontSize: 13, fontWeight: 800, transition: 'all .15s',
                            }}>
                            {label}
                          </button>
                        ))}
                      </div>

                      {f.correct === true && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: C.textSec, flexShrink: 0 }}>Points :</label>
                          <input type="number" min={0} max={item.points_max}
                            value={f.points ?? item.points_max}
                            onChange={e => setField(item.progression_id, 'points', parseInt(e.target.value))}
                            style={{ width: 70, padding: '6px 10px', border: `1.5px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontWeight: 800, textAlign: 'center', background: C.surface, color: C.text, outline: 'none' }}/>
                          <span style={{ fontSize: 12, color: C.textSec }}>/ {item.points_max}</span>
                        </div>
                      )}

                      <textarea rows={2}
                        placeholder="Commentaire à l'apprenant (optionnel)…"
                        value={f.commentaire || ''}
                        onChange={e => setField(item.progression_id, 'commentaire', e.target.value)}
                        style={{ padding: '10px 12px', border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6, background: C.bg, color: C.text, outline: 'none' }}
                      />

                      <button onClick={() => soumettre(item)}
                        disabled={f.correct === undefined}
                        style={{
                          padding: '12px', borderRadius: 10, border: 'none',
                          cursor: f.correct === undefined ? 'not-allowed' : 'pointer',
                          background: f.correct === undefined ? C.border : `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                          color: f.correct === undefined ? C.textSec : 'white',
                          fontSize: 14, fontWeight: 800, transition: 'all .15s',
                          boxShadow: f.correct !== undefined ? `0 3px 14px ${C.brown}35` : 'none',
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
