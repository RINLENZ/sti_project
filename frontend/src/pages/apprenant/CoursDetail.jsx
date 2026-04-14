import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function CoursDetail() {
  const { uaId }  = useParams()
  const navigate  = useNavigate()
  const [ua, setUA]         = useState(null)
  const [tab, setTab]       = useState('lecon')  // 'lecon' | 'exercices'
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/cours/ua/${uaId}`)
      .then(({ data }) => setUA(data))
      .catch(() => toast.error('Erreur de chargement'))
      .finally(() => setLoading(false))
  }, [uaId])

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <p>Chargement...</p>
    </div>
  )

  if (!ua) return null

  const lecon = ua.ressources?.find(r => r.type === 'lecon')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Header */}
      <div style={{
        background: '#1e40af', padding: '20px 24px',
        color: 'white'
      }}>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            background: 'none', border: 'none',
            color: '#bfdbfe', cursor: 'pointer',
            fontSize: 14, marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          ← Retour au tableau de bord
        </button>
        <span style={{
          background: 'rgba(255,255,255,.2)',
          padding: '2px 10px', borderRadius: 20,
          fontSize: 12, marginBottom: 8,
          display: 'inline-block'
        }}>
          {ua.reference_ue}
        </span>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>
          {ua.titre}
        </h1>
        <p style={{ opacity: .8, fontSize: 13, marginTop: 4 }}>
          ⏱ {ua.duree_estimee} min · 📝 {ua.exercices?.length} exercices
        </p>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 24px' }}>

        {/* Situation problème */}
        {ua.situation_probleme && (
          <div className="card" style={{
            marginBottom: 24,
            borderLeft: '4px solid #3b82f6',
            borderRadius: '0 8px 8px 0'
          }}>
            <p style={{
              fontSize: 12, fontWeight: 600,
              color: '#3b82f6', marginBottom: 8,
              textTransform: 'uppercase'
            }}>
              Situation problème
            </p>
            <p style={{
              fontSize: 14, lineHeight: 1.7,
              whiteSpace: 'pre-line', color: 'var(--text)'
            }}>
              {ua.situation_probleme}
            </p>
          </div>
        )}

        {/* Compétences visées */}
        <div className="card" style={{ marginBottom: 24 }}>
          <p style={{
            fontSize: 12, fontWeight: 600,
            color: 'var(--text-muted)', marginBottom: 12,
            textTransform: 'uppercase'
          }}>
            Compétences visées
          </p>
          {ua.competences?.map((c, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'flex-start',
              gap: 8, marginBottom: 8
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: '#dbeafe', color: '#1e40af',
                fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center',
                justifyContent: 'center', flexShrink: 0, marginTop: 1
              }}>
                {i + 1}
              </span>
              <p style={{ fontSize: 14, lineHeight: 1.5 }}>{c}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex', gap: 4, marginBottom: 24,
          background: '#e2e8f0', padding: 4, borderRadius: 8
        }}>
          {[
            { key: 'lecon',     label: '📖 Leçon' },
            { key: 'exercices', label: '✏️ Exercices' }
          ].map(t => (
            <button key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flex: 1, padding: '8px 16px',
                border: 'none', borderRadius: 6,
                cursor: 'pointer', fontSize: 14,
                fontWeight: tab === t.key ? 600 : 400,
                background: tab === t.key ? 'white' : 'transparent',
                color: tab === t.key ? '#1e40af' : 'var(--text-muted)',
                boxShadow: tab === t.key ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                transition: 'all .2s'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenu Leçon */}
        {tab === 'lecon' && lecon && (
          <div>
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 style={{
                fontSize: 16, fontWeight: 600, marginBottom: 16
              }}>
                {lecon.titre}
              </h2>
              {/* Rendu simple du Markdown — sans librairie */}
              <div style={{
                fontSize: 14, lineHeight: 1.8,
                color: 'var(--text)'
              }}>
                {lecon.contenu.split('\n').map((line, i) => {
                  if (line.startsWith('## '))
                    return <h2 key={i} style={{
                      fontSize: 17, fontWeight: 700,
                      margin: '20px 0 8px',
                      color: '#1e40af'
                    }}>{line.replace('## ', '')}</h2>
                  if (line.startsWith('### '))
                    return <h3 key={i} style={{
                      fontSize: 15, fontWeight: 600,
                      margin: '16px 0 6px'
                    }}>{line.replace('### ', '')}</h3>
                  if (line.startsWith('```'))
                    return null
                  if (line.startsWith('- '))
                    return <p key={i} style={{
                      paddingLeft: 16,
                      borderLeft: '2px solid #e2e8f0',
                      marginBottom: 4, fontSize: 13
                    }}>• {line.replace('- ', '')}</p>
                  if (line.trim() === '')
                    return <br key={i}/>
                  return <p key={i} style={{ marginBottom: 4 }}>{line}</p>
                })}
              </div>
            </div>

            {/* Points clés */}
            {lecon.points_cles && (
              <div className="card" style={{
                background: '#f0fdf4',
                border: '1px solid #86efac'
              }}>
                <p style={{
                  fontSize: 12, fontWeight: 600,
                  color: '#16a34a', marginBottom: 12,
                  textTransform: 'uppercase'
                }}>
                  Points clés à retenir
                </p>
                {lecon.points_cles.map((pt, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 8,
                    alignItems: 'flex-start', marginBottom: 6
                  }}>
                    <span style={{ color: '#16a34a', fontWeight: 700 }}>✓</span>
                    <p style={{ fontSize: 13, lineHeight: 1.5 }}>{pt}</p>
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 24 }}
              onClick={() => navigate(`/session/${uaId}`)}
            >
              Commencer les exercices →
            </button>
          </div>
        )}

        {/* Aperçu des exercices */}
        {tab === 'exercices' && (
          <div>
            {ua.exercices?.map((ex, i) => (
              <div key={ex.id} className="card" style={{ marginBottom: 12 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: '#dbeafe', color: '#1e40af',
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 13,
                      fontWeight: 700, flexShrink: 0
                    }}>{i + 1}</span>
                    <div>
                      <p style={{ fontWeight: 500, fontSize: 14 }}>
                        {ex.titre}
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {ex.competence_evaluee}
                      </p>
                    </div>
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8
                  }}>
                    <span className={`badge ${
                      ex.difficulte === 1 ? 'badge-success' :
                      ex.difficulte === 2 ? 'badge-warning' : 'badge-danger'
                    }`}>
                      {ex.difficulte === 1 ? 'Facile' :
                       ex.difficulte === 2 ? 'Moyen' : 'Difficile'}
                    </span>
                    <span style={{
                      fontSize: 12, color: 'var(--text-muted)'
                    }}>
                      {ex.points} pts
                    </span>
                  </div>
                </div>
              </div>
            ))}

            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 16 }}
              onClick={() => navigate(`/session/${uaId}`)}
            >
              Démarrer la session →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}