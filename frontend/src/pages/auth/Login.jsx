import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { loginSuccess } from '../../store/authSlice'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function Login() {
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('username', form.email)
      params.append('password', form.password)

      const { data } = await api.post('/auth/login', params)

dispatch(loginSuccess({
  token: data.access_token,
  user: {
    id:              data.user_id,
    role:            data.role,
    email:           form.email,
    nom:             data.nom,
    prenom:          data.prenom,
    niveau:          data.niveau,
    code_invitation: data.code_invitation
  }
}))

      toast.success('Connexion réussie !')
      navigate(data.role === 'enseignant' ? '/prof' : '/dashboard')
    } catch {
      toast.error('Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)'
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>

        {/* Logo / titre */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: '#dbeafe', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 28
          }}>🎓</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e293b' }}>
            STI Adaptatif
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
            Système de Tutorat Intelligent — ENSET Ebolowa
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Adresse email</label>
            <input
              type="email"
              placeholder="alice@sti.cm"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        {/* Comptes de test */}
        <div style={{
          marginTop: 24, padding: 12,
          background: '#f8fafc', borderRadius: 8,
          border: '1px solid var(--border)'
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>
            Comptes de test :
          </p>
          {[
            { label: 'Enseignant', email: 'prof@sti.cm',   pw: 'prof1234' },
            { label: 'Apprenant',  email: 'alice@sti.cm',  pw: 'alice1234' },
          ].map(c => (
            <button key={c.email}
              onClick={() => setForm({ email: c.email, password: c.pw })}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '6px 8px', marginBottom: 4, cursor: 'pointer',
                background: 'white', border: '1px solid var(--border)',
                borderRadius: 6, fontSize: 12, color: 'var(--text)'
              }}
            >
              <strong>{c.label}</strong> — {c.email}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}