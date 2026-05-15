import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Lock, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react'

const C = {
  brown: '#6B3A2A', brownDark: '#3D1F13', brownLight: '#C4865A',
  brownPale: '#F5EDE5', border: '#E8DDD6', surface: '#FFFFFF',
  surfaceWarm: '#FDF8F5', text: '#1A1207', textSec: '#7C6256',
  textMuted: '#C8B8B0', red: '#DC2626', redPale: '#FEF2F2',
  gradient: 'linear-gradient(135deg, #6B3A2A 0%, #C4865A 60%, #D4A853 100%)',
  shadowCard: '0 28px 72px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.07)',
}

export default function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [pw,       setPw]      = useState('')
  const [pwConf,   setPwConf]  = useState('')
  const [showPw,   setShowPw]  = useState(false)
  const [loading,  setLoading] = useState(false)
  const [done,     setDone]    = useState(false)
  const [focused,  setFocused] = useState(null)

  const mismatch = pwConf && pw !== pwConf
  const tooShort = pw && pw.length < 6

  async function handleSubmit(e) {
    e.preventDefault()
    if (mismatch || tooShort || !token) return
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, new_password: pw })
      setDone(true)
      toast.success('Mot de passe réinitialisé !')
      setTimeout(() => navigate('/login'), 2500)
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Lien invalide ou expiré'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const fw = (id) => ({
    display: 'flex', alignItems: 'center', gap: 8,
    border: `1.5px solid ${focused === id ? C.brown : mismatch && id === 'conf' ? C.red : C.border}`,
    borderRadius: 10, padding: '0 12px',
    background: focused === id ? C.surfaceWarm : C.surface,
    boxShadow: focused === id ? `0 0 0 3px ${C.brown}1A` : 'none',
    transition: 'all .2s',
  })

  const fi = {
    flex: 1, border: 'none', outline: 'none', padding: '11px 0',
    fontSize: 14, color: C.text, background: 'transparent', fontFamily: 'inherit',
  }

  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(145deg,${C.brownDark},#0F0503)`, fontFamily: "'Sora','Segoe UI',sans-serif", padding: 20 }}>
        <div style={{ background: C.surface, borderRadius: 20, padding: '32px 36px', maxWidth: 400, width: '100%', boxShadow: C.shadowCard, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 900, color: C.text }}>Lien invalide</h2>
          <p style={{ color: C.textSec, fontSize: 13, marginBottom: 20 }}>Ce lien de réinitialisation est invalide ou a expiré.</p>
          <Link to="/forgot-password" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: C.gradient, color: 'white', borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            Demander un nouveau lien
          </Link>
        </div>
      </div>
    )
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

        {done ? (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 900, color: C.text }}>Mot de passe mis à jour !</h2>
            <p style={{ color: C.textSec, fontSize: 13 }}>Redirection vers la connexion…</p>
          </div>
        ) : (
          <>
            <Link to="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: C.textSec, fontSize: 12, fontWeight: 700, textDecoration: 'none', marginBottom: 24 }}>
              <ArrowLeft size={13}/> Retour à la connexion
            </Link>

            <h1 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 900, color: C.text }}>Nouveau mot de passe</h1>
            <p style={{ margin: '0 0 24px', fontSize: 13, color: C.textSec }}>Choisis un mot de passe d'au moins 6 caractères.</p>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Nouveau mot de passe */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: focused === 'pw' ? C.brown : C.textSec, display: 'block', marginBottom: 5 }}>
                  Nouveau mot de passe
                </label>
                <div style={fw('pw')}>
                  <Lock size={15} color={focused === 'pw' ? C.brown : C.textMuted} style={{ flexShrink: 0 }}/>
                  <input
                    type={showPw ? 'text' : 'password'} value={pw} required minLength={6}
                    onChange={e => setPw(e.target.value)}
                    onFocus={() => setFocused('pw')}
                    onBlur={() => setFocused(null)}
                    placeholder="••••••••"
                    style={fi}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0 4px 4px', color: C.textMuted, display: 'flex' }}>
                    {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
                {tooShort && <p style={{ margin: '4px 0 0', fontSize: 11, color: C.red }}>Au moins 6 caractères requis.</p>}
              </div>

              {/* Confirmation */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.7px', color: focused === 'conf' ? C.brown : C.textSec, display: 'block', marginBottom: 5 }}>
                  Confirmer le mot de passe
                </label>
                <div style={fw('conf')}>
                  <Lock size={15} color={focused === 'conf' ? C.brown : C.textMuted} style={{ flexShrink: 0 }}/>
                  <input
                    type={showPw ? 'text' : 'password'} value={pwConf} required
                    onChange={e => setPwConf(e.target.value)}
                    onFocus={() => setFocused('conf')}
                    onBlur={() => setFocused(null)}
                    placeholder="••••••••"
                    style={fi}
                  />
                </div>
                {mismatch && <p style={{ margin: '4px 0 0', fontSize: 11, color: C.red }}>Les mots de passe ne correspondent pas.</p>}
              </div>

              <button type="submit" disabled={loading || !!mismatch || !!tooShort} style={{
                width: '100%', padding: '12px', marginTop: 4,
                background: (loading || mismatch || tooShort) ? '#E8E0DB' : C.gradient,
                color: (loading || mismatch || tooShort) ? C.textSec : 'white',
                border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: (loading || mismatch || tooShort) ? 'not-allowed' : 'pointer',
                boxShadow: (loading || mismatch || tooShort) ? 'none' : `0 6px 22px ${C.brown}45`,
              }}>
                {loading
                  ? <><div style={{ width: 15, height: 15, borderRadius: '50%', border: '2px solid rgba(255,255,255,.3)', borderTopColor: 'white', animation: 'spin 1s linear infinite' }}/>Enregistrement…</>
                  : <>Enregistrer le mot de passe <ArrowRight size={15}/></>
                }
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
