import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { loginSuccess } from '../../store/authSlice'
import api from '../../services/api'
import toast from 'react-hot-toast'

const NIVEAUX = [
  { id: 'Seconde',   label: 'Seconde',   desc: '2nde A, B, C, D, TI...' },
  { id: 'Première',  label: 'Première',  desc: '1ère A, C, D, F, TI...' },
  { id: 'Terminale', label: 'Terminale', desc: 'Tle A, C, D, E, TI...' },
]

const PAYS = ['Cameroun', "Côte d'Ivoire", 'Sénégal', 'Mali',
              'Burkina Faso', 'Congo', 'Gabon', 'Autre']

export default function Onboarding() {
  const { user, token } = useSelector(s => s.auth)
  const dispatch        = useDispatch()
  const navigate        = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ niveau: '', pays: 'Cameroun' })
  const [loading, setLoading] = useState(false)

  async function finish() {
    setLoading(true)
    try {
      await api.put(`/api/admin/apprenant/${user.id}`, {
        niveau: form.niveau,
        pays:   form.pays,
      })
      dispatch(loginSuccess({
        token,
        user: { ...user, niveau: form.niveau, pays: form.pays }
      }))
      toast.success('Profil configuré !')
      navigate('/dashboard')
    } catch {
      toast.error('Erreur lors de la configuration')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24
    }}>
      <div className="card" style={{ maxWidth: 480, width: '100%' }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#dbeafe', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 24
          }}>🎓</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
            Bienvenue, {user?.prenom} !
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Configurons ton profil en quelques secondes
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 32 }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{
              width: s <= step ? 24 : 8, height: 8, borderRadius: 4,
              background: s <= step ? '#1e40af' : '#e2e8f0',
              transition: 'all .3s'
            }}/>
          ))}
        </div>

        {step === 1 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>
              Quel est ton niveau scolaire ?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20 }}>
              Cela détermine les cours qui te seront proposés
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {NIVEAUX.map(n => (
                <button key={n.id}
                  onClick={() => setForm(f => ({ ...f, niveau: n.id }))}
                  style={{
                    padding: '16px 20px', borderRadius: 10,
                    border: `2px solid ${form.niveau === n.id ? '#1e40af' : '#e2e8f0'}`,
                    background: form.niveau === n.id ? '#dbeafe' : 'white',
                    cursor: 'pointer', textAlign: 'left', transition: 'all .15s'
                  }}
                >
                  <p style={{
                    fontWeight: 600, fontSize: 15, marginBottom: 2,
                    color: form.niveau === n.id ? '#1e40af' : 'var(--text)'
                  }}>{n.label}</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n.desc}</p>
                </button>
              ))}
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 20 }}
              onClick={() => setStep(2)}
              disabled={!form.niveau}
            >
              Continuer →
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, textAlign: 'center' }}>
              Dans quel pays es-tu ?
            </h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20 }}>
              Pour adapter le contenu à ton contexte
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
              {PAYS.map(p => (
                <button key={p}
                  onClick={() => setForm(f => ({ ...f, pays: p }))}
                  style={{
                    padding: '12px 16px', borderRadius: 8,
                    border: `2px solid ${form.pays === p ? '#1e40af' : '#e2e8f0'}`,
                    background: form.pays === p ? '#dbeafe' : 'white',
                    cursor: 'pointer', fontSize: 13,
                    fontWeight: form.pays === p ? 600 : 400,
                    color: form.pays === p ? '#1e40af' : 'var(--text)',
                    transition: 'all .15s'
                  }}
                >{p}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(1)}>
                ← Retour
              </button>
              <button className="btn btn-primary" style={{ flex: 2, justifyContent: 'center' }} onClick={() => setStep(3)}>
                Continuer →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, textAlign: 'center' }}>
              Récapitulatif de ton profil
            </h2>
            {[
              { label: 'Prénom', value: user?.prenom },
              { label: 'Email',  value: user?.email },
              { label: 'Niveau', value: form.niveau },
              { label: 'Pays',   value: form.pays },
            ].map(row => (
              <div key={row.label} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '10px 0', borderBottom: '1px solid var(--border)'
              }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{row.value}</span>
              </div>
            ))}

            <div style={{
              marginTop: 20, padding: 16, background: '#f0fdf4',
              borderRadius: 10, border: '1px solid #86efac'
            }}>
              <p style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginBottom: 8 }}>
                Ton code d'invitation tuteur
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 4, color: '#15803d' }}>
                  {user?.code_invitation}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(user?.code_invitation)
                    toast.success('Code copié !')
                  }}
                  style={{
                    padding: '6px 12px', borderRadius: 6,
                    background: '#16a34a', color: 'white',
                    border: 'none', cursor: 'pointer', fontSize: 12
                  }}
                >
                  Copier
                </button>
              </div>
              <p style={{ fontSize: 11, color: '#166534', marginTop: 8 }}>
                Partage ce code à ton enseignant pour qu'il suive ta progression
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button className="btn btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setStep(2)}>
                ← Retour
              </button>
              <button
                className="btn btn-success"
                style={{ flex: 2, justifyContent: 'center' }}
                onClick={finish}
                disabled={loading}
              >
                {loading ? 'Enregistrement...' : 'Commencer à apprendre !'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}