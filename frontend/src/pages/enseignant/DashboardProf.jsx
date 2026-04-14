import { useEffect, useState, useCallback } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../../store/authSlice'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function DashboardProf() {
  const { user }    = useSelector(s => s.auth)
  const dispatch    = useDispatch()
  const navigate    = useNavigate()
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const { data: res } = await api.get('/api/cours/dashboard/enseignant')
      setData(res)
      setLastUpdate(new Date())
    } catch {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  // Chargement initial
  useEffect(() => { fetchData() }, [fetchData])

  // Rafraîchissement automatique toutes les 10 secondes
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [autoRefresh, fetchData])

  function handleLogout() {
    dispatch(logout())
    navigate('/login')
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <p>Chargement du tableau de bord...</p>
    </div>
  )

  const { apprenants, stats_classe, exercices_difficiles } = data

  const scoreColor = s => s >= 0.7 ? '#16a34a' : s >= 0.4 ? '#d97706' : '#dc2626'
  const scoreBg    = s => s >= 0.7 ? '#dcfce7' : s >= 0.4 ? '#fef9c3' : '#fee2e2'
  const niveauLabel = n => n === 'eleve' ? '🟢 Élevé' : n === 'modere' ? '🟡 Modéré' : '🔴 Faible'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Navbar */}
      <nav style={{
        background: '#1e40af', padding: '0 24px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', height: 60,
        boxShadow: '0 2px 8px rgba(0,0,0,.15)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22 }}>🎓</span>
          <span style={{ color: 'white', fontWeight: 700, fontSize: 16 }}>
            STI Adaptatif — Tableau de bord enseignant
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

          {/* Toggle auto-refresh */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 8,
            cursor: 'pointer', color: '#bfdbfe', fontSize: 13
          }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Actualisation auto (10s)
          </label>

          <button
            onClick={fetchData}
            style={{
              background: 'rgba(255,255,255,.15)', border: 'none',
              color: 'white', padding: '6px 14px', borderRadius: 6,
              cursor: 'pointer', fontSize: 13
            }}
          >
            Actualiser
          </button>

          <button
            onClick={handleLogout}
            className="btn btn-outline"
            style={{ color: 'white', borderColor: 'white', padding: '6px 14px', fontSize: 13 }}
          >
            Déconnexion
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

        {/* Dernière mise à jour */}
        {lastUpdate && (
          <p style={{
            fontSize: 12, color: 'var(--text-muted)',
            marginBottom: 24, textAlign: 'right'
          }}>
            Dernière mise à jour : {lastUpdate.toLocaleTimeString()}
            {autoRefresh && ' · Actualisation auto active'}
          </p>
        )}

        {/* ── Statistiques globales ── */}
        <h2 style={{
          fontSize: 14, fontWeight: 600, color: 'var(--text-muted)',
          textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 16
        }}>
          Vue d'ensemble de la classe
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16, marginBottom: 32
        }}>
          {[
            {
              label: 'Apprenants',
              value: stats_classe.nb_apprenants,
              sub: 'inscrits',
              color: '#1e40af', bg: '#dbeafe'
            },
            {
              label: 'Engagement moyen',
              value: `${Math.round(stats_classe.score_moyen * 100)}%`,
              sub: niveauLabel(stats_classe.niveau_global),
              color: scoreColor(stats_classe.score_moyen),
              bg: scoreBg(stats_classe.score_moyen)
            },
            {
              label: 'En décrochage',
              value: stats_classe.nb_decrocheurs,
              sub: 'score < 40%',
              color: stats_classe.nb_decrocheurs > 0 ? '#dc2626' : '#16a34a',
              bg:    stats_classe.nb_decrocheurs > 0 ? '#fee2e2' : '#dcfce7'
            },
            {
              label: 'Actifs maintenant',
              value: apprenants.filter(a => a.derniere_session).length,
              sub: 'ont une session',
              color: '#d97706', bg: '#fef9c3'
            }
          ].map(s => (
            <div key={s.label} style={{
              background: s.bg, borderRadius: 12,
              padding: '20px 24px',
              border: `1px solid ${s.color}30`
            }}>
              <p style={{ fontSize: 12, color: s.color, fontWeight: 600, marginBottom: 8 }}>
                {s.label}
              </p>
              <p style={{ fontSize: 28, fontWeight: 700, color: s.color }}>
                {s.value}
              </p>
              <p style={{ fontSize: 12, color: s.color, opacity: .7, marginTop: 4 }}>
                {s.sub}
              </p>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>

          {/* ── Liste des apprenants ── */}
          <div>
            <h2 style={{
              fontSize: 14, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 16
            }}>
              Engagement en temps réel
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {apprenants.map(apprenant => {
                const score  = apprenant.engagement.score
                const niveau = apprenant.engagement.niveau
                const pct    = apprenant.progression.pourcentage

                return (
                  <div key={apprenant.user_id} className="card" style={{
                    padding: '16px 20px',
                    borderLeft: `4px solid ${scoreColor(score)}`
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'flex-start', flexWrap: 'wrap', gap: 12
                    }}>

                      {/* Infos apprenant */}
                      <div style={{ flex: 1 }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8
                        }}>
                          {/* Avatar initiales */}
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            background: '#dbeafe', color: '#1e40af',
                            display: 'flex', alignItems: 'center',
                            justifyContent: 'center', fontSize: 13,
                            fontWeight: 700, flexShrink: 0
                          }}>
                            {apprenant.prenom[0]}{apprenant.nom[0]}
                          </div>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: 14 }}>
                              {apprenant.prenom} {apprenant.nom}
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {apprenant.email}
                            </p>
                          </div>
                        </div>

                        {/* Barre progression exercices */}
                        <div style={{ marginTop: 4 }}>
                          <div style={{
                            display: 'flex', justifyContent: 'space-between',
                            fontSize: 11, color: 'var(--text-muted)', marginBottom: 4
                          }}>
                            <span>Progression</span>
                            <span>
                              {apprenant.progression.exercices_reussis}
                              /{apprenant.progression.total_exercices} exercices
                              · {apprenant.progression.score_total} pts
                            </span>
                          </div>
                          <div style={{
                            height: 6, background: '#e2e8f0',
                            borderRadius: 3, overflow: 'hidden'
                          }}>
                            <div style={{
                              height: '100%', borderRadius: 3,
                              background: pct === 100 ? '#16a34a' : '#3b82f6',
                              width: `${pct}%`, transition: 'width .5s'
                            }}/>
                          </div>
                        </div>
                      </div>

                      {/* Score engagement */}
                      <div style={{
                        textAlign: 'center', minWidth: 100,
                        padding: '8px 16px', borderRadius: 10,
                        background: scoreBg(score),
                        border: `1px solid ${scoreColor(score)}40`
                      }}>
                        <p style={{
                          fontSize: 22, fontWeight: 700,
                          color: scoreColor(score), lineHeight: 1
                        }}>
                          {Math.round(score * 100)}%
                        </p>
                        <p style={{
                          fontSize: 11, color: scoreColor(score),
                          marginTop: 4
                        }}>
                          {niveauLabel(niveau)}
                        </p>
                        <p style={{
                          fontSize: 10, color: 'var(--text-muted)', marginTop: 4
                        }}>
                          {apprenant.engagement.nb_events} événements
                        </p>
                      </div>
                    </div>

                    {/* Alerte décrochage */}
                    {score < 0.4 && (
                      <div style={{
                        marginTop: 12, padding: '8px 12px',
                        background: '#fef2f2', borderRadius: 6,
                        border: '1px solid #fca5a5',
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <p style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>
                          ⚠️ Apprenant en décrochage — intervention recommandée
                        </p>
                        <button style={{
                          fontSize: 11, color: '#dc2626',
                          background: 'white', border: '1px solid #fca5a5',
                          borderRadius: 4, padding: '3px 10px', cursor: 'pointer'
                        }}>
                          Envoyer un message
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Panneau droit ── */}
          <div>

            {/* Exercices difficiles */}
            <h2 style={{
              fontSize: 14, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 16
            }}>
              Exercices problématiques
            </h2>

            {exercices_difficiles.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 24 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  Aucune donnée encore disponible
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {exercices_difficiles.map((ex, i) => (
                  <div key={i} className="card" style={{ padding: '12px 16px' }}>
                    <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                      {ex.titre}
                    </p>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      fontSize: 12, color: 'var(--text-muted)', marginBottom: 6
                    }}>
                      <span>{ex.total_tentatives} tentatives</span>
                      <span style={{
                        color: ex.taux_echec > 50 ? '#dc2626' : '#d97706',
                        fontWeight: 600
                      }}>
                        {ex.taux_echec}% d'échec
                      </span>
                    </div>
                    <div style={{
                      height: 5, background: '#e2e8f0',
                      borderRadius: 3, overflow: 'hidden'
                    }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: ex.taux_echec > 50 ? '#dc2626' : '#d97706',
                        width: `${ex.taux_echec}%`
                      }}/>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Légende engagement */}
            <h2 style={{
              fontSize: 14, fontWeight: 600, color: 'var(--text-muted)',
              textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 16
            }}>
              Légende
            </h2>

            <div className="card" style={{ padding: 16 }}>
              {[
                { color: '#16a34a', bg: '#dcfce7', label: 'Engagé', desc: 'Score ≥ 70%' },
                { color: '#d97706', bg: '#fef9c3', label: 'Modéré', desc: 'Score 40–70%' },
                { color: '#dc2626', bg: '#fee2e2', label: 'Décroché', desc: 'Score < 40%' },
              ].map(l => (
                <div key={l.label} style={{
                  display: 'flex', alignItems: 'center',
                  gap: 10, marginBottom: 10
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: l.bg, border: `1px solid ${l.color}40`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <div style={{
                      width: 10, height: 10,
                      borderRadius: '50%', background: l.color
                    }}/>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600 }}>{l.label}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{l.desc}</p>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}