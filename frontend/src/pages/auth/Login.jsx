import { useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { loginSuccess } from '../../store/authSlice'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react'
import SensiaLogo from '../../components/SensiaLogo'
import Alisha from '../../components/Alisha'
import { useBreakpoint } from '../../hooks/useBreakpoint'

const C = {
  brown:       '#6B3A2A', brownDark:   '#3D1F13',
  brownLight:  '#C4865A', brownPale:   '#F5EDE5',
  border:      '#E8DDD6', emerald:     '#0D9373',
  emeraldDark: '#0A7A5E', surface:     '#FFFFFF',
  surfaceWarm: '#FDF8F5', text:        '#1A1207',
  textSec:     '#7C6256', textMuted:   '#C8B8B0',
  gold:        '#D4A853', red:         '#DC2626',
  redPale:     '#FEF2F2', info:        '#2563EB',
  infoPale:    '#EFF6FF', successPale: '#D1FAE5',
  gradient:    'linear-gradient(135deg, #6B3A2A 0%, #C4865A 60%, #D4A853 100%)',
  glow:        'rgba(107,58,42,0.15)',
  shadowCard:  '0 28px 72px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.07)',
}

const COMPTES_TEST = [
  { label:'Admin',      icon:'🛡️', email:'admin@sti.cm', pw:'serge', color:C.red,     pale:C.redPale },
  { label:'Enseignant', icon:'👨‍🏫', email:'prof@sti.cm',  pw:'serge',  color:C.info,    pale:C.infoPale },
  { label:'Apprenant',  icon:'🎓', email:'alice@sti.cm', pw:'alice1234', color:C.emerald, pale:C.successPale },
]

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink:0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function ECGWave({ width = 34, height = 22, color = 'white' }) {
  const h = height, w = width
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display:'block' }}>
      <polyline
        points={`0,${h/2} ${w*.18},${h/2} ${w*.28},${h*.82} ${w*.38},${h*.09} ${w*.48},${h*.82} ${w*.58},${h/2} ${w*.72},${h/2} ${w*.80},${h*.25} ${w*.87},${h/2} ${w},${h/2}`}
        fill="none" stroke={color} strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

export default function Login() {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { xs, mobile } = useBreakpoint()
  const [form,    setForm]    = useState({ email:'', password:'' })
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)
  const [focused, setFocused] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setTimeout(() => setMounted(true), 80) }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('username', form.email)
      params.append('password', form.password)
      const { data } = await api.post('/auth/login', params)
dispatch(loginSuccess({
  token:        data.access_token,
  refreshToken: data.refresh_token,
  user: {
    id:                  data.user_id,
    role:                data.role,
    email:               form.email,
    nom:                 data.nom,
    prenom:              data.prenom,
    niveau:              data.niveau,
    niveau_label:        data.niveau_label ?? data.niveau,
    niveau_id:           data.niveau_id,
    filiere_label:       data.filiere_label,
    pays:                data.pays,
    avatar:              data.avatar,
    code_invitation:     data.code_invitation,
    etablissement:       data.etablissement,
    ville:               data.ville,
    matieres_enseignees: data.matieres_enseignees,
    niveaux_enseignes:   data.niveaux_enseignes,
    code_classe:         data.code_classe,
  }
}))
      toast.success('Connexion réussie !')
      navigate(data.role === 'enseignant' ? '/prof' : data.role === 'super_admin' ? '/admin' : '/dashboard')
    } catch {
      toast.error('Email ou mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  function remplir(c) {
    setForm({ email: c.email, password: c.pw })
    toast(`${c.icon} Compte ${c.label} sélectionné`, { duration: 1500 })
  }

  const fw = (id) => ({
    display:'flex', alignItems:'center', gap:8,
    border:`1.5px solid ${focused === id ? C.brown : C.border}`,
    borderRadius:10, padding:'0 12px',
    backgroundColor: focused === id ? '#FDF8F5' : C.surface,
    boxShadow: focused === id ? `0 0 0 3px ${C.brown}1A` : 'none',
    transition:'border-color .2s, box-shadow .2s, background-color .2s',
  })

  const fi = {
    flex:1, minWidth:0, border:'none', outline:'none',
    padding:'11px 0', fontSize:14, fontWeight:500,
    color:C.text, backgroundColor:'transparent', fontFamily:'inherit',
  }

  const fl = (id) => ({
    fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.7px',
    color: focused === id ? C.brown : C.textSec,
    transition:'color .2s', marginBottom:5, display:'block',
  })

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:"'Sora','Segoe UI',sans-serif",
      background:`linear-gradient(145deg, ${C.brownDark} 0%, #2A1008 55%, #0F0503 100%)`,
      padding:'20px', position:'relative', overflow:'hidden',
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <style>{`
        *,*::before,*::after { box-sizing:border-box; }
        input::placeholder { color:#C8B8B0; font-weight:400; }
        button { font-family:inherit; cursor:pointer }
        @keyframes spin      { to { transform:rotate(360deg); } }
        @keyframes floatY    { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-7px); } }
        @keyframes glowPulse { 0%,100% { opacity:.8; } 50% { opacity:1; } }
        @keyframes fadeUp    { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      {/* Motif adinkra */}
      <svg style={{ position:'absolute',inset:0,width:'100%',height:'100%',opacity:.05,pointerEvents:'none' }} aria-hidden="true">
        <defs>
          <pattern id="adk-login" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <circle cx="30" cy="30" r="11" fill="none" stroke="white" strokeWidth=".9"/>
            <circle cx="30" cy="30" r="5"  fill="none" stroke="white" strokeWidth=".9"/>
            <line x1="30" y1="19" x2="30" y2="11" stroke="white" strokeWidth=".9"/>
            <line x1="30" y1="41" x2="30" y2="49" stroke="white" strokeWidth=".9"/>
            <line x1="19" y1="30" x2="11" y2="30" stroke="white" strokeWidth=".9"/>
            <line x1="41" y1="30" x2="49" y2="30" stroke="white" strokeWidth=".9"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#adk-login)"/>
      </svg>

      {/* Halos */}
      <div style={{ position:'absolute',top:-150,right:-100,width:480,height:480,borderRadius:'50%',background:`radial-gradient(circle,${C.brownLight}22,transparent 70%)`,pointerEvents:'none',animation:'glowPulse 5s ease-in-out infinite' }}/>
      <div style={{ position:'absolute',bottom:-100,left:-80,width:380,height:380,borderRadius:'50%',background:`radial-gradient(circle,${C.gold}14,transparent 70%)`,pointerEvents:'none' }}/>

      {/* ── Carte ── */}
      <div style={{
        backgroundColor:C.surface, borderRadius: xs ? 18 : 22,
        padding: xs ? '22px 16px 20px' : mobile ? '26px 24px 22px' : '32px 36px 28px',
        width:'100%', maxWidth:440,
        boxShadow:C.shadowCard,
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(24px)',
        transition: 'all .65s cubic-bezier(0.16,1,0.3,1)',
        position:'relative',
      }}>
        {/* Bande déco top */}
        <div style={{ position:'absolute',top:0,left:28,right:28,height:3,borderRadius:'0 0 3px 3px',background:`linear-gradient(90deg,${C.brown},${C.gold},${C.emerald})` }}/>

        {/* ── Header : Alisha + SensiaLogo ── */}
        <div style={{ display:'flex', alignItems:'flex-end', gap:13, marginBottom:24 }}>
          <div style={{ flexShrink: 0, marginBottom: -4 }}>
            <Alisha state="idle" size={64} />
          </div>
          <div>
            <SensiaLogo size={28} light={false}/>
            <p style={{ fontSize:12, color:C.textSec, margin:'3px 0 0', fontWeight:500 }}>
              Content de te revoir ! Connecte-toi.
            </p>
          </div>
        </div>

        {/* ── Formulaire ── */}
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:13 }}>

          <div style={{ display:'flex', flexDirection:'column' }}>
            <label htmlFor="l-email" style={fl('email')}>Adresse email</label>
            <div style={fw('email')}>
              <Mail size={15} color={focused === 'email' ? C.brown : '#C0AFA7'} style={{ flexShrink:0 }}/>
              <input id="l-email" type="email" placeholder="alice@sti.cm"
                value={form.email} onChange={e => setForm(f => ({ ...f, email:e.target.value }))}
                onFocus={() => setFocused('email')} onBlur={() => setFocused(null)}
                required autoComplete="email" style={fi}/>
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:5 }}>
              <label htmlFor="l-pw" style={{ ...fl('pw'), marginBottom:0 }}>Mot de passe</label>
              <Link to="/forgot-password"
                style={{ background:'none', border:'none', padding:0, fontSize:11, fontWeight:700, color:C.brownLight, textDecoration:'none' }}>
                Oublié ?
              </Link>
            </div>
            <div style={fw('pw')}>
              <Lock size={15} color={focused === 'pw' ? C.brown : '#C0AFA7'} style={{ flexShrink:0 }}/>
              <input id="l-pw" type={showPw ? 'text' : 'password'} placeholder="••••••••"
                value={form.password} onChange={e => setForm(f => ({ ...f, password:e.target.value }))}
                onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)}
                required autoComplete="current-password" style={fi}/>
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ background:'none', border:'none', cursor:'pointer', padding:'4px 0 4px 4px', display:'flex', alignItems:'center', color:'#C0AFA7', flexShrink:0 }}>
                {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={{
            width:'100%', padding:'12px', marginTop:2,
            background: loading ? '#E8E0DB' : C.gradient,
            color: loading ? C.textSec : 'white',
            border:'none', borderRadius:10,
            fontSize:14, fontWeight:700, letterSpacing:'.2px',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            boxShadow: loading ? 'none' : `0 6px 22px ${C.brown}45`,
            transition:'all .2s ease', cursor: loading ? 'wait' : 'pointer',
          }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow=`0 10px 30px ${C.brown}55` } }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : `0 6px 22px ${C.brown}45` }}
          >
            {loading ? (
              <><div style={{ width:15,height:15,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'white',animation:'spin 1s linear infinite' }}/>Connexion…</>
            ) : (
              <>Se connecter <ArrowRight size={15}/></>
            )}
          </button>
        </form>

        <p style={{ textAlign:'center', margin:'14px 0 0', fontSize:13, color:C.textSec }}>
          Pas encore de compte ?{' '}
          <Link to="/register" style={{ color:C.brown, fontWeight:700, textDecoration:'none' }}>Créer un compte →</Link>
        </p>

        <div style={{ display:'flex', alignItems:'center', gap:12, margin:'16px 0' }}>
          <div style={{ flex:1, height:1, backgroundColor:C.border }}/>
          <span style={{ fontSize:11, fontWeight:600, color:C.textMuted, whiteSpace:'nowrap' }}>ou</span>
          <div style={{ flex:1, height:1, backgroundColor:C.border }}/>
        </div>

        <button type="button" onClick={() => toast('Connexion Google bientôt disponible 🔜')} style={{
          width:'100%', padding:'11px 16px',
          display:'flex', alignItems:'center', justifyContent:'center', gap:10,
          background:C.surface, border:`1.5px solid ${C.border}`,
          borderRadius:10, fontSize:14, fontWeight:600, color:C.text,
          transition:'all .2s ease', boxShadow:'0 1px 4px rgba(0,0,0,.06)',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor=C.brownLight; e.currentTarget.style.boxShadow='0 2px 10px rgba(0,0,0,.1)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor=C.border; e.currentTarget.style.boxShadow='0 1px 4px rgba(0,0,0,.06)' }}
        >
          <GoogleIcon/> Continuer avec Google
        </button>

        {/* Comptes de test */}
        <div style={{ marginTop:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
            <div style={{ flex:1, height:1, backgroundColor:C.border }}/>
            <span style={{ fontSize:10, fontWeight:800, color:C.textMuted, textTransform:'uppercase', letterSpacing:1, whiteSpace:'nowrap' }}>Comptes de test</span>
            <div style={{ flex:1, height:1, backgroundColor:C.border }}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
            {COMPTES_TEST.map(c => (
              <button key={c.email} type="button" onClick={() => remplir(c)} style={{
                padding:'10px 8px', background:c.pale,
                border:'1.5px solid transparent', borderRadius:12, textAlign:'center',
                transition:'all .2s cubic-bezier(0.16,1,0.3,1)',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor=c.color; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 6px 16px ${c.color}22` }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='transparent'; e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none' }}
              >
                <div style={{ fontSize:20, marginBottom:4, lineHeight:1 }}>{c.icon}</div>
                <div style={{ fontSize:10, fontWeight:800, color:c.color, letterSpacing:.3 }}>{c.label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Badge ENSET */}
        
      </div>

      <p style={{ textAlign:'center', fontSize:12, position:'absolute', bottom:16, left:0, right:0, color:C.textMuted }}>
        © 2026 SenSia · STI ADAPTATIF ·{' '}
        <span style={{ color:C.brownLight, cursor:'pointer', fontWeight:600 }}>Mentions légales</span>
      </p>
    </div>
  )
}