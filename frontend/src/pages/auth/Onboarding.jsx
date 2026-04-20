import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { loginSuccess } from '../../store/authSlice'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Copy, CheckCircle, GraduationCap, Brain } from 'lucide-react'

const C = {
  brown:       '#6B3A2A', brownLight:  '#C4865A',
  emerald:     '#0D9373', bg:          '#FAF7F4',
  surface:     '#FFFFFF', text:        '#1A1207',
  textSec:     '#6B5744', brownPale:   '#F5EDE5',
  emeraldPale: '#E6F5F0', gold:        '#D4A853',
}

const ORDRES = [
  {
    id: 'general',
    label: 'Enseignement Général',
    icon: '🎓',
    filieres: [
      { id: 'A',  label: 'Série A',  desc: 'Lettres & Sciences Humaines' },
      { id: 'C',  label: 'Série C',  desc: 'Maths & Sciences Physiques' },
      { id: 'D',  label: 'Série D',  desc: 'Maths & Sciences de la Vie' },
      { id: 'TI', label: 'Série TI', desc: 'Technologies de l\'Information' },
    ]
  },
  {
    id: 'technique_ind',
    label: 'Technique Industriel',
    icon: '⚙️',
    filieres: [
      { id: 'F1', label: 'F1', desc: 'Construction Mécanique' },
      { id: 'F2', label: 'F2', desc: 'Électronique' },
      { id: 'F3', label: 'F3', desc: 'Électrotechnique' },
      { id: 'F4', label: 'F4', desc: 'Génie Civil / BTP' },
      { id: 'F6', label: 'F6', desc: 'BIPE — Informatique' },
    ]
  },
  {
    id: 'technique_com',
    label: 'Technique Commercial',
    icon: '💼',
    filieres: [
      { id: 'G1', label: 'G1', desc: 'Secrétariat' },
      { id: 'G2', label: 'G2', desc: 'Comptabilité' },
      { id: 'G3', label: 'G3', desc: 'Action Commerciale' },
      { id: 'H',  label: 'H',  desc: 'Hôtellerie & Restauration' },
    ]
  },
]

const NIVEAUX = ['Seconde', 'Première', 'Terminale']

export default function Onboarding() {
  const { user, token } = useSelector(s => s.auth)
  const dispatch        = useDispatch()
  const navigate        = useNavigate()
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({ niveau: '', pays: 'CM' })
  const [loading, setLoading] = useState(false)
  const [copied, setCopied]   = useState(false)

  async function finish() {
    setLoading(true)
    try {
      await api.put(`/api/admin/apprenant/${user.id}`, {
        niveau: form.niveau,
        pays:   PAYS.find(p => p.code === form.pays)?.name || 'Cameroun',
      })
      dispatch(loginSuccess({
        token,
        user: { ...user, niveau: form.niveau }
      }))
      toast.success('Profil configuré !')
      navigate('/dashboard')
    } catch {
      toast.error('Erreur lors de la configuration')
    } finally {
      setLoading(false)
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(user?.code_invitation || '')
    setCopied(true)
    toast.success('Code copié !')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${C.brown} 0%, #3D1F13 50%, #1A0A05 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, position: 'relative', overflow: 'hidden'
    }}>
      <style>{`
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{box-shadow:0 0 8px rgba(212,168,83,0.3)}50%{box-shadow:0 0 24px rgba(212,168,83,0.7)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* Motif adinkra en fond */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.07, pointerEvents: 'none' }}>
        <defs>
          <pattern id="adinkra-bg" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <circle cx="40" cy="40" r="16" fill="none" stroke="white" strokeWidth="1.5"/>
            <circle cx="40" cy="40" r="8"  fill="none" stroke="white" strokeWidth="1.5"/>
            <line x1="40" y1="24" x2="40" y2="14" stroke="white" strokeWidth="1.5"/>
            <line x1="40" y1="56" x2="40" y2="66" stroke="white" strokeWidth="1.5"/>
            <line x1="24" y1="40" x2="14" y2="40" stroke="white" strokeWidth="1.5"/>
            <line x1="56" y1="40" x2="66" y2="40" stroke="white" strokeWidth="1.5"/>
            <rect x="4"  y="4"  width="8" height="8" fill="none" stroke={C.gold} strokeWidth="1" transform="rotate(45 8 8)"/>
            <rect x="68" y="4"  width="8" height="8" fill="none" stroke={C.gold} strokeWidth="1" transform="rotate(45 72 8)"/>
            <rect x="4"  y="68" width="8" height="8" fill="none" stroke={C.gold} strokeWidth="1" transform="rotate(45 8 72)"/>
            <rect x="68" y="68" width="8" height="8" fill="none" stroke={C.gold} strokeWidth="1" transform="rotate(45 72 72)"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#adinkra-bg)"/>
      </svg>

      {/* Cercles décoratifs */}
      <div style={{ position: 'absolute', top: -100, right: -100, width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${C.brownLight}15, transparent 70%)`, pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', bottom: -80, left: -80, width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${C.gold}10, transparent 70%)`, pointerEvents: 'none' }}/>

      {/* Carte principale */}
      <div style={{
        backgroundColor: C.surface, borderRadius: 28,
        padding: '36px 40px', maxWidth: 500, width: '100%',
        boxShadow: '0 32px 80px rgba(0,0,0,.5)',
        border: `1px solid rgba(255,255,255,.08)`,
        animation: 'fadeIn .5s ease', position: 'relative'
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: '0 auto 14px',
            background: `linear-gradient(135deg, ${C.brown}, ${C.gold})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'glow 3s infinite, float 4s ease-in-out infinite',
            boxShadow: `0 8px 24px ${C.brown}60`
          }}>
            <Brain size={30} color="white"/>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: C.brown, marginBottom: 4 }}>
            EduSmart AI
          </h1>
          <p style={{ fontSize: 13, color: C.textSec, fontWeight: 600 }}>
            Bienvenue, <span style={{ color: C.brown, fontWeight: 800 }}>{user?.prenom}</span> ! 👋
          </p>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: 28 }}>
          {[1, 2, 3].map((s, i) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: step >= s
                  ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`
                  : '#E5E7EB',
                color: step >= s ? 'white' : C.textSec,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 900, transition: 'all .3s ease',
                boxShadow: step === s ? `0 0 0 4px ${C.brown}25` : 'none',
              }}>
                {step > s ? <CheckCircle size={16} color="white"/> : s}
              </div>
              {i < 2 && (
                <div style={{
                  width: 60, height: 2,
                  backgroundColor: step > s ? C.brown : '#E5E7EB',
                  transition: 'background .3s'
                }}/>
              )}
            </div>
          ))}
        </div>

        {/* ── Étape 1 — Niveau ── */}
        {step === 1 && (
          <div style={{ animation: 'slideDown .3s ease' }}>
            <h2 style={{ fontSize: 19, fontWeight: 900, color: C.text, marginBottom: 6 }}>
              Quel est ton niveau ? 📚
            </h2>
            <p style={{ color: C.textSec, fontSize: 13, marginBottom: 20 }}>
              Cela détermine les cours qui te seront proposés
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
              {NIVEAUX.map(n => (
                <div key={n.id} onClick={() => setForm(f => ({ ...f, niveau: n.id }))} style={{
                  padding: '16px 20px', borderRadius: 14,
                  border: `2px solid ${form.niveau === n.id ? C.brown : C.brownPale}`,
                  backgroundColor: form.niveau === n.id ? C.brownPale : C.surface,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16,
                  transition: 'all .2s ease',
                  boxShadow: form.niveau === n.id ? `0 4px 16px ${C.brown}20` : 'none'
                }}>
                  <span style={{ fontSize: 28 }}>{n.icon}</span>
                  <div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: form.niveau === n.id ? C.brown : C.text }}>
                      {n.label}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: C.textSec }}>{n.desc}</p>
                  </div>
                  {form.niveau === n.id && (
                    <CheckCircle size={20} color={C.brown} style={{ marginLeft: 'auto' }}/>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => form.niveau && setStep(2)} style={{
              width: '100%', padding: '14px',
              background: form.niveau ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})` : '#E5E7EB',
              color: form.niveau ? 'white' : C.textSec,
              border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 800,
              cursor: form.niveau ? 'pointer' : 'not-allowed',
              boxShadow: form.niveau ? `0 4px 18px ${C.brown}35` : 'none',
              transition: 'all .2s ease'
            }}>
              Continuer →
            </button>
          </div>
        )}

        {/* ── Étape 2 — Pays ── */}
        {step === 2 && (
          <div style={{ animation: 'slideDown .3s ease' }}>
            <h2 style={{ fontSize: 19, fontWeight: 900, color: C.text, marginBottom: 6 }}>
              Dans quel pays es-tu ? 🌍
            </h2>
            <p style={{ color: C.textSec, fontSize: 13, marginBottom: 20 }}>
              Pour adapter le contenu à ton contexte local
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
              {PAYS.map(p => (
                <div key={p.code} onClick={() => setForm(f => ({ ...f, pays: p.code }))} style={{
                  padding: '12px 8px', borderRadius: 12, textAlign: 'center',
                  border: `2px solid ${form.pays === p.code ? C.brown : C.brownPale}`,
                  backgroundColor: form.pays === p.code ? C.brownPale : C.surface,
                  cursor: 'pointer', transition: 'all .2s ease',
                  boxShadow: form.pays === p.code ? `0 2px 10px ${C.brown}20` : 'none'
                }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{p.flag}</div>
                  <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: form.pays === p.code ? C.brown : C.textSec }}>
                    {p.name}
                  </p>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: '12px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                ← Retour
              </button>
              <button onClick={() => setStep(3)} style={{
                flex: 2, padding: '12px',
                background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                color: 'white', border: 'none', borderRadius: 12,
                fontSize: 14, fontWeight: 800, cursor: 'pointer',
                boxShadow: `0 4px 18px ${C.brown}35`
              }}>
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ── Étape 3 — Récapitulatif ── */}
        {step === 3 && (
          <div style={{ animation: 'slideDown .3s ease' }}>
            <h2 style={{ fontSize: 19, fontWeight: 900, color: C.text, marginBottom: 6 }}>
              Presque là ! 🚀
            </h2>
            <p style={{ color: C.textSec, fontSize: 13, marginBottom: 20 }}>
              Voici ton profil — vérifie et confirme
            </p>

            {/* Récapitulatif */}
            <div style={{
              background: `linear-gradient(135deg, ${C.brownPale}, ${C.emeraldPale})`,
              borderRadius: 16, padding: '20px 24px', marginBottom: 20,
              border: `1px solid ${C.brownLight}30`
            }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14,
                  background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                  color: 'white', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 18, fontWeight: 900
                }}>
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: C.text }}>
                    {user?.prenom} {user?.nom}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: 12, color: C.textSec }}>
                    {NIVEAUX.find(n => n.id === form.niveau)?.icon} {form.niveau} · {PAYS.find(p => p.code === form.pays)?.flag} {PAYS.find(p => p.code === form.pays)?.name}
                  </p>
                </div>
              </div>
              {[
                { label: 'Email',  value: user?.email },
                { label: 'Niveau', value: form.niveau },
                { label: 'Pays',   value: PAYS.find(p => p.code === form.pays)?.name },
              ].map(row => (
                <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderTop: `1px solid ${C.brownLight}20` }}>
                  <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>{row.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Code invitation */}
            <div style={{
              backgroundColor: C.surface, borderRadius: 16, padding: '18px 20px',
              marginBottom: 20, border: `1px solid ${C.emerald}25`,
              background: `linear-gradient(135deg, ${C.emeraldPale}, ${C.brownPale})`
            }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: C.emerald, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>
                Ton code d'invitation tuteur
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderRadius: 10, padding: '12px 16px', border: `1px solid ${C.emerald}20` }}>
                <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 900, color: C.brown, letterSpacing: 3 }}>
                  {user?.code_invitation}
                </span>
                <button onClick={copyCode} style={{
                  backgroundColor: copied ? C.emeraldPale : C.brownPale,
                  border: 'none', borderRadius: 8, padding: '6px 12px',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: 12, fontWeight: 700,
                  color: copied ? C.emerald : C.brown, transition: 'all .2s ease'
                }}>
                  {copied ? <CheckCircle size={13}/> : <Copy size={13}/>}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>
              <p style={{ fontSize: 11, color: C.textSec, marginTop: 8 }}>
                Partage ce code à ton enseignant pour qu'il suive ta progression
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, padding: '12px', background: C.brownPale, color: C.brown, border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                ← Retour
              </button>
              <button onClick={finish} disabled={loading} style={{
                flex: 2, padding: '14px',
                background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                color: 'white', border: 'none', borderRadius: 12,
                fontSize: 14, fontWeight: 800, cursor: loading ? 'wait' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: `0 4px 18px ${C.brown}35`
              }}>
                <GraduationCap size={16}/>
                {loading ? 'Enregistrement…' : 'Commencer à apprendre !'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}