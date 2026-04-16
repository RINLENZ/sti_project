import { useEffect, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { logout } from '../../store/authSlice'
import api from '../../services/api'
import toast from 'react-hot-toast'
import BKTRadar from '../../components/BKTRadar'

export default function Dashboard() {
  const { user }    = useSelector(s => s.auth)
  const dispatch    = useDispatch()
  const navigate    = useNavigate()
  const [matieres,  setMatieres]  = useState([])
  const [familles,  setFamilles]  = useState([])
  const [moduleId,  setModuleId]  = useState(null)
  const [progression, setProgression] = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [bktData, setBktData] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        const { data } = await api.get('/api/cours/matieres')
        setMatieres(data)
        if (data[0]?.modules[0]) {
          const mid = data[0].modules[0].id
          setModuleId(mid)
          const { data: fam } = await api.get(
            `/api/cours/modules/${mid}/familles`
          )
          setFamilles(fam)
        }
        const { data: prog } = await api.get(
          `/api/cours/progression/${user.id}`
        )
        setProgression(prog)
        const { data: bkt } = await api.get(`/api/bkt/apprenant/${user.id}`)
setBktData(bkt)
      } catch {
        toast.error('Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user.id])

  function handleLogout() {
    dispatch(logout())
    navigate('/login')
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <p style={{ color: 'var(--text-muted)' }}>Chargement...</p>
    </div>
  )

  const matiere = matieres[0]

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
          <span style={{
            color: 'white', fontWeight: 700, fontSize: 16
          }}>STI Adaptatif</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ color: '#bfdbfe', fontSize: 14 }}>
            {user?.email}
          </span>
          <button
            onClick={handleLogout}
            className="btn btn-outline"
            style={{
              color: 'white', borderColor: 'white',
              padding: '6px 14px', fontSize: 13
            }}
          >
            Déconnexion
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px' }}>

        {/* En-tête */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
            Bonjour 👋
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            {matiere?.nom} — {matiere?.niveau}
          </p>
        </div>

        {/* Carte progression globale */}
        {progression && (
          <div className="card" style={{
            marginBottom: 32,
            background: 'linear-gradient(135deg, #1e40af, #3b82f6)',
            border: 'none', color: 'white'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', flexWrap: 'wrap', gap: 16
            }}>
              <div>
                <p style={{ opacity: .8, fontSize: 13, marginBottom: 4 }}>
                  Progression globale
                </p>
                <p style={{ fontSize: 32, fontWeight: 700 }}>
                  {progression.pourcentage}%
                </p>
                <p style={{ opacity: .8, fontSize: 13 }}>
                  {progression.exercices_reussis} / {progression.total_exercices} exercices réussis
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ opacity: .8, fontSize: 13, marginBottom: 4 }}>
                  Score total
                </p>
                <p style={{ fontSize: 32, fontWeight: 700 }}>
                  {progression.score_total} pts
                </p>
              </div>
            </div>
            {/* Barre de progression */}
            <div style={{
              marginTop: 16, height: 8,
              background: 'rgba(255,255,255,.3)',
              borderRadius: 4, overflow: 'hidden'
            }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: 'white',
                width: `${progression.pourcentage}%`,
                transition: 'width .5s'
              }}/>
            </div>
          </div>
        )}

        {/* Section BKT — Maîtrise par compétence */}
{bktData && Object.keys(bktData.competences).length > 0 && (
  <div className="card" style={{ marginBottom: 32 }}>
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', marginBottom: 16
    }}>
      <div>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
          Maîtrise par compétence
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Algorithme BKT — Corbett & Anderson (1994)
        </p>
      </div>
      <span className="badge badge-info">
        {bktData.nb_competences_maitrisees} maîtrisée(s)
      </span>
    </div>
    <BKTRadar competences={bktData.competences} />
  </div>
)}

        {/* Liste des familles et UA */}
        {familles.map(famille => (
          <div key={famille.id} style={{ marginBottom: 32 }}>
            <h2 style={{
              fontSize: 16, fontWeight: 600,
              color: 'var(--text-muted)', marginBottom: 16,
              textTransform: 'uppercase', letterSpacing: '.05em'
            }}>
              {famille.titre}
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16
            }}>
              {famille.unites.map((ua, idx) => {
                // Calcule la progression pour cette UA
                const exReussis = progression?.details?.filter(
                  d => d.correct
                ).length || 0
                const pct = ua.nb_exercices > 0
                  ? Math.round(exReussis / ua.nb_exercices * 100)
                  : 0

                return (
                  <div key={ua.id} className="card"
                    style={{ cursor: 'pointer', transition: 'transform .2s' }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                    onClick={() => navigate(`/cours/${ua.id}`)}
                  >
                    {/* Badge UE */}
                    <span className="badge badge-info" style={{ marginBottom: 12 }}>
                      {ua.reference_ue}
                    </span>

                    <h3 style={{
                      fontSize: 15, fontWeight: 600,
                      marginBottom: 8, lineHeight: 1.4
                    }}>
                      {ua.titre}
                    </h3>

                    {/* Compétences */}
                    <div style={{ marginBottom: 16 }}>
                      {ua.competences?.slice(0, 2).map((c, i) => (
                        <p key={i} style={{
                          fontSize: 12, color: 'var(--text-muted)',
                          paddingLeft: 12, borderLeft: '2px solid #bfdbfe',
                          marginBottom: 4, lineHeight: 1.4
                        }}>
                          {c}
                        </p>
                      ))}
                    </div>

                    {/* Infos bas */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', marginBottom: 12
                    }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        ⏱ {ua.duree_estimee} min
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        📝 {ua.nb_exercices} exercices
                      </span>
                    </div>

                    {/* Barre progression UA */}
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
                    <p style={{
                      fontSize: 11, color: 'var(--text-muted)',
                      marginTop: 4, textAlign: 'right'
                    }}>
                      {pct === 100
                        ? '✓ Terminé'
                        : pct > 0
                        ? `${pct}% complété`
                        : 'Non commencé'}
                    </p>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}