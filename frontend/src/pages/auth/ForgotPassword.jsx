import { useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'
import { Mail, ArrowLeft, ArrowRight, ExternalLink } from 'lucide-react'

const C = {
  brown: '#6B3A2A', brownDark: '#3D1F13', brownLight: '#C4865A',
  brownPale: '#F5EDE5', border: '#E8DDD6', surface: '#FFFFFF',
  surfaceWarm: '#FDF8F5', text: '#1A1207', textSec: '#7C6256',
  textMuted: '#C8B8B0', gold: '#D4A853',
  gradient: 'linear-gradient(135deg, #6B3A2A 0%, #C4865A 60%, #D4A853 100%)',
  shadowCard: '0 28px 72px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.07)',
}

export default function ForgotPassword() {
  const [email,    setEmail]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [resetUrl, setResetUrl] = useState(null) // dev only
  const [focused,  setFocused]  = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() })
      setSent(true)
      if (data.reset_url) setResetUrl(data.reset_url) // SMTP non configuré
    } catch {
      setSent(true) // Afficher le même message même si erreur (sécurité)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Sora','Segoe UI',sans-serif",
      background: `linear-gradient(145deg, ${C.brownDark} 0%, #2A1008 55%, #0F0503 100%)`,
      padding: '20px',
    }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        input::placeholder { color: #C8B8B0; font-weight: 400; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{
        background: C.surface, borderRadius: 22,
        padding: '32px 36px 28px', width: '100%', maxWidth: 420,
        boxShadow: C.shadowCard, animation: 'fadeUp .5s ease',
        position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 0, left: 28, right: 28, height: 3, borderRadius: '0 0 3px 3px', background: C.gradient }}/>

        {!sent ? (
          <>
            <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.textSec, fontSize: 12, fontWeight: 700, textDecoration: 'none', marginBottom: 24 }}>
              <ArrowLeft size={13}/> Retour à la connexion
            </Link>

            <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: C.text }}>Mot de passe oublié</h1>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>
              Saisis ton adresse email et nous t'enverrons un lien pour réinitialiser ton mot de passe.
            </p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: focused ? C.brown : C.textSec, display: 'block', marginBottom: 5 }}>
                  Adresse email
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1.5px solid ${focused ? C.brown : C.border}`, borderRadius: 10, padding: '0 12px', background: focused ? C.surfaceWarm : C.surface, boxShadow: focused ? `0 0 0 3px ${C.brown}1A` : 'none', transition: 'all .2s' }}>
                  <Mail size={15} color={focused ? C.brown : C.textMuted} style={{ flexShrink: 0 }}/>
                  <input
                    type="email" value={email} required autoComplete="email"
                    onChange={e => setEmail(e.target.value)}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="alice@sti.cm"
                    style={{ flex: 1, border: 'none', outline: 'none', padding: '11px 0', fontSize: 14, color: C.text, background: 'transparent', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} style={{
                width: '100%', padding: '12px', background: loading ? '#E8E0DB' : C.gradient,
                color: loading ? C.textSec : 'white', border: 'none', borderRadius: 10,
                fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: loading ? 'wait' : 'pointer', boxShadow: loading ? 'none' : `0 6px 22px ${C.brown}45`,
              }}>
                {loading
                  ? <><div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', animation: 'spin 1s linear infinite' }}/>Envoi…</>
                  : <>Envoyer le lien <ArrowRight size={15}/></>
                }
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📬</div>
              <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: C.text }}>Email envoyé !</h2>
              <p style={{ margin: '0 0 6px', fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>
                Si l'adresse <strong>{email}</strong> est enregistrée, un lien de réinitialisation a été envoyé.
              </p>
              <p style={{ margin: 0, fontSize: 12, color: C.textMuted }}>Vérifie aussi ton dossier spam.</p>
            </div>

            {/* Lien direct si SMTP non configuré (dev/test) */}
            {resetUrl && (
              <div style={{ margin: '16px 0', padding: '12px 14px', background: '#FEF3C7', border: '1px solid #D97706', borderRadius: 10 }}>
                <p style={{ margin: '0 0 6px', fontSize: 11, fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>Mode dev — SMTP non configuré</p>
                <a href={resetUrl} style={{ fontSize: 12, color: '#B45309', wordBreak: 'break-all', display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                  <ExternalLink size={12} style={{ flexShrink: 0, marginTop: 2 }}/>{resetUrl}
                </a>
              </div>
            )}

            <Link to="/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: C.brownPale, borderRadius: 10, color: C.brown, fontSize: 13, fontWeight: 700, textDecoration: 'none', marginTop: 4 }}>
              <ArrowLeft size={14}/> Retour à la connexion
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
