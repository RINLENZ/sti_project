import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useNavigate, Link } from 'react-router-dom'
import { loginSuccess } from '../../store/authSlice'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Check, X } from 'lucide-react'
import SensiaLogo from '../../components/SensiaLogo'

const C = {
  brown:       '#6B3A2A', brownDark:   '#3D1F13',
  brownLight:  '#C4865A', brownPale:   '#F5EDE5',
  border:      '#E8DDD6', emerald:     '#0D9373',
  emeraldDark: '#0A7A5E', surface:     '#FFFFFF',
  text:        '#1A1207', textSec:     '#7C6256',
  textMuted:   '#C8B8B0', gold:        '#D4A853',
  red:         '#DC2626', orange:      '#E07B39',
  gradient:    'linear-gradient(135deg, #6B3A2A 0%, #C4865A 60%, #D4A853 100%)',
}

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

// ── Onde ECG (identique à Login) ─────────────────────────────────
function ECGWave({ width = 32, height = 20, color = 'white' }) {
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

// ── Composant Field — hors de Register pour éviter re-mount ──────
function Field({ id, label, type='text', placeholder, icon:Icon, value, onChange, focused, setFocused, rightSlot }) {
  const active = focused === id
  return (
    <div style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
      <label htmlFor={id} style={{
        fontSize:11, fontWeight:700, color: active ? C.brown : C.textSec,
        marginBottom:5, textTransform:'uppercase', letterSpacing:'.7px', transition:'color .2s',
      }}>
        {label}
      </label>
      <div style={{
        display:'flex', alignItems:'center', gap:8,
        border:`1.5px solid ${active ? C.brown : C.border}`,
        borderRadius:10, padding:'0 12px',
        backgroundColor: active ? '#FDF8F5' : C.surface,
        boxShadow: active ? `0 0 0 3px ${C.brown}1A` : 'none',
        transition:'border-color .2s, box-shadow .2s, background-color .2s',
        minWidth:0,
      }}>
        <Icon size={15} color={active ? C.brown : '#C0AFA7'} style={{ flexShrink:0 }}/>
        <input id={id} type={type} placeholder={placeholder} value={value} onChange={onChange}
          onFocus={() => setFocused(id)} onBlur={() => setFocused(null)}
          required autoComplete={type === 'password' ? 'new-password' : 'off'}
          style={{ flex:1, minWidth:0, border:'none', outline:'none', padding:'11px 0', fontSize:14, fontWeight:500, color:C.text, backgroundColor:'transparent', fontFamily:'inherit' }}
        />
        {rightSlot}
      </div>
    </div>
  )
}

function getPwStrength(pw) {
  if (!pw.length)    return { score:0, label:'',           color:C.border }
  if (pw.length < 6) return { score:1, label:'Trop court', color:C.red }
  if (pw.length < 10)return { score:2, label:'Moyen',      color:C.orange }
  return                     { score:3, label:'Fort',       color:C.emerald }
}

export default function Register() {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const [form,    setForm]    = useState({ prenom:'', nom:'', email:'', password:'', confirm:'' })
  const [loading, setLoading] = useState(false)
  const [showPw,  setShowPw]  = useState(false)
  const [focused, setFocused] = useState(null)

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password !== form.confirm) { toast.error('Les mots de passe ne correspondent pas'); return }
    if (form.password.length < 6)       { toast.error('Mot de passe trop court (6 min)'); return }
    setLoading(true)
    try {
      await api.post('/auth/register', {
        email:form.email, nom:form.nom, prenom:form.prenom,
        password:form.password, role:'apprenant',
      })
      const params = new URLSearchParams()
      params.append('username', form.email)
      params.append('password', form.password)
      const { data } = await api.post('/auth/login', params)
dispatch(loginSuccess({
  token: data.access_token,
  user: {
    id:                  data.user_id,
    role:                data.role,
    email:               form.email,
    nom:                 data.nom,
    prenom:              data.prenom,
    niveau_label:        data.niveau,
    filiere_label:       data.filiere_label,
    code_invitation:     data.code_invitation,
    etablissement:       data.etablissement,
    ville:               data.ville,
    matieres_enseignees: data.matieres_enseignees,
    niveaux_enseignes:   data.niveaux_enseignes,
    code_classe:         data.code_classe,
  }
}))
      toast.success('Compte créé ! Bienvenue 🎉')
      navigate('/onboarding-enseignant')
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erreur lors de la création du compte')
    } finally {
      setLoading(false)
    }
  }

  const pw            = getPwStrength(form.password)
  const confirmStatus = form.confirm ? (form.confirm === form.password ? 'ok' : 'err') : null

  const eyeBtn = (
    <button type="button" onClick={() => setShowPw(v => !v)} style={{ background:'none', border:'none', cursor:'pointer', padding:'4px 0 4px 4px', display:'flex', alignItems:'center', color:'#C0AFA7', flexShrink:0 }}>
      {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
    </button>
  )

  const confirmBadge = confirmStatus && (
    <div style={{ width:18, height:18, borderRadius:'50%', flexShrink:0, backgroundColor: confirmStatus === 'ok' ? C.emerald : C.red, display:'flex', alignItems:'center', justifyContent:'center' }}>
      {confirmStatus === 'ok' ? <Check size={11} color="white" strokeWidth={3}/> : <X size={11} color="white" strokeWidth={3}/>}
    </div>
  )

  return (
    <div style={{
      minHeight:'100vh',
      background:`linear-gradient(145deg, ${C.brownDark} 0%, #2A1008 55%, #0F0503 100%)`,
      display:'flex', alignItems:'center', justifyContent:'center',
      padding:'20px', position:'relative', overflow:'hidden',
      fontFamily:"'Sora','Segoe UI',sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
      <style>{`
        *,*::before,*::after { box-sizing:border-box; }
        input::placeholder { color:#C8B8B0; font-weight:400; }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
        @keyframes floatY    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
        @keyframes glowPulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        button { font-family:inherit; cursor:pointer }
      `}</style>

      {/* Motif adinkra */}
      <svg style={{ position:'absolute',inset:0,width:'100%',height:'100%',opacity:.05,pointerEvents:'none' }} aria-hidden="true">
        <defs>
          <pattern id="adk-reg" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
            <circle cx="30" cy="30" r="11" fill="none" stroke="white" strokeWidth=".9"/>
            <circle cx="30" cy="30" r="5"  fill="none" stroke="white" strokeWidth=".9"/>
            <line x1="30" y1="19" x2="30" y2="11" stroke="white" strokeWidth=".9"/>
            <line x1="30" y1="41" x2="30" y2="49" stroke="white" strokeWidth=".9"/>
            <line x1="19" y1="30" x2="11" y2="30" stroke="white" strokeWidth=".9"/>
            <line x1="41" y1="30" x2="49" y2="30" stroke="white" strokeWidth=".9"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#adk-reg)"/>
      </svg>

      {/* Halos */}
      <div style={{ position:'absolute',top:-150,right:-100,width:480,height:480,borderRadius:'50%',background:`radial-gradient(circle,${C.brownLight}22,transparent 70%)`,pointerEvents:'none',animation:'glowPulse 5s ease-in-out infinite' }}/>
      <div style={{ position:'absolute',bottom:-100,left:-80,width:380,height:380,borderRadius:'50%',background:`radial-gradient(circle,${C.gold}14,transparent 70%)`,pointerEvents:'none' }}/>

      {/* ── Carte ── */}
      <div style={{
        backgroundColor:C.surface, borderRadius:22,
        padding:'32px 36px 28px', width:'100%', maxWidth:440,
        boxShadow:'0 28px 72px rgba(0,0,0,.55), 0 0 0 1px rgba(255,255,255,.07)',
        animation:'fadeUp .45s cubic-bezier(.22,1,.36,1) both',
        position:'relative',
      }}>
        {/* Bande déco */}
        <div style={{ position:'absolute',top:0,left:28,right:28,height:3,borderRadius:'0 0 3px 3px',background:`linear-gradient(90deg,${C.brown},${C.gold},${C.emerald})` }}/>

        {/* ── Header : onde ECG + SensiaLogo ── */}
        <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:24 }}>
          {/* Carré gradient avec onde ECG */}
          <div style={{
            width:50, height:50, borderRadius:14, flexShrink:0,
            background:`linear-gradient(135deg,${C.brown},${C.gold})`,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:`0 6px 20px ${C.brown}55`,
            animation:'floatY 4s ease-in-out infinite',
          }}>
            <ECGWave width={32} height={20} color="white"/>
          </div>
          {/* SensiaLogo + sous-titre */}
          <div>
            <SensiaLogo size={28} light={false}/>
            <p style={{ fontSize:12, color:C.textSec, margin:'3px 0 0', fontWeight:500 }}>
              Créer votre compte apprenant
            </p>
          </div>
        </div>

        {/* ── Formulaire ── */}
        <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:13 }}>

          {/* Prénom + Nom côte à côte */}
          <div style={{ display:'flex', gap:12 }}>
            <div style={{ flex:'1 1 0', minWidth:0 }}>
              <Field id="prenom" label="Prénom" placeholder="Alice" icon={User}
                value={form.prenom} onChange={set('prenom')} focused={focused} setFocused={setFocused}/>
            </div>
            <div style={{ flex:'1 1 0', minWidth:0 }}>
              <Field id="nom" label="Nom" placeholder="Mballa" icon={User}
                value={form.nom} onChange={set('nom')} focused={focused} setFocused={setFocused}/>
            </div>
          </div>

          <Field id="email" label="Adresse email" type="email" placeholder="alice@sti.cm" icon={Mail}
            value={form.email} onChange={set('email')} focused={focused} setFocused={setFocused}/>

          {/* Mot de passe + force */}
          <div style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
            <label htmlFor="password" style={{ fontSize:11, fontWeight:700, color: focused==='pw' ? C.brown : C.textSec, marginBottom:5, textTransform:'uppercase', letterSpacing:'.7px', transition:'color .2s' }}>
              Mot de passe
            </label>
            <div style={{ display:'flex', alignItems:'center', gap:8, border:`1.5px solid ${focused==='pw' ? C.brown : C.border}`, borderRadius:10, padding:'0 12px', backgroundColor: focused==='pw' ? '#FDF8F5' : C.surface, boxShadow: focused==='pw' ? `0 0 0 3px ${C.brown}1A` : 'none', transition:'border-color .2s, box-shadow .2s, background-color .2s' }}>
              <Lock size={15} color={focused==='pw' ? C.brown : '#C0AFA7'} style={{ flexShrink:0 }}/>
              <input id="password" type={showPw ? 'text' : 'password'} placeholder="6 caractères minimum"
                value={form.password} onChange={set('password')}
                onFocus={() => setFocused('pw')} onBlur={() => setFocused(null)}
                required autoComplete="new-password"
                style={{ flex:1, minWidth:0, border:'none', outline:'none', padding:'11px 0', fontSize:14, fontWeight:500, color:C.text, backgroundColor:'transparent', fontFamily:'inherit' }}/>
              {eyeBtn}
            </div>
            {form.password.length > 0 && (
              <div style={{ marginTop:7, display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ flex:1, display:'flex', gap:3 }}>
                  {[1,2,3].map(i => (
                    <div key={i} style={{ flex:1, height:3, borderRadius:2, transition:'background-color .3s', backgroundColor: i <= pw.score ? pw.color : C.border }}/>
                  ))}
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:pw.color, minWidth:52, textAlign:'right' }}>{pw.label}</span>
              </div>
            )}
          </div>

          {/* Confirmation */}
          <div style={{ display:'flex', flexDirection:'column', minWidth:0 }}>
            <label htmlFor="confirm" style={{ fontSize:11, fontWeight:700, color: focused==='confirm' ? C.brown : C.textSec, marginBottom:5, textTransform:'uppercase', letterSpacing:'.7px', transition:'color .2s' }}>
              Confirmer le mot de passe
            </label>
            <div style={{ display:'flex', alignItems:'center', gap:8, border:`1.5px solid ${focused==='confirm' ? C.brown : confirmStatus === 'err' ? C.red : confirmStatus === 'ok' ? C.emerald : C.border}`, borderRadius:10, padding:'0 12px', backgroundColor: focused==='confirm' ? '#FDF8F5' : C.surface, boxShadow: focused==='confirm' ? `0 0 0 3px ${C.brown}1A` : confirmStatus === 'ok' ? `0 0 0 3px ${C.emerald}1A` : 'none', transition:'border-color .2s, box-shadow .2s, background-color .2s' }}>
              <Lock size={15} color={confirmStatus==='err' ? C.red : confirmStatus==='ok' ? C.emerald : '#C0AFA7'} style={{ flexShrink:0 }}/>
              <input id="confirm" type={showPw ? 'text' : 'password'} placeholder="Répète ton mot de passe"
                value={form.confirm} onChange={set('confirm')}
                onFocus={() => setFocused('confirm')} onBlur={() => setFocused(null)}
                required autoComplete="new-password"
                style={{ flex:1, minWidth:0, border:'none', outline:'none', padding:'11px 0', fontSize:14, fontWeight:500, color:C.text, backgroundColor:'transparent', fontFamily:'inherit' }}/>
              {confirmBadge}
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} style={{
            width:'100%', padding:'12px', marginTop:2,
            background: loading ? '#E8E0DB' : `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`,
            color: loading ? C.textSec : 'white',
            border:'none', borderRadius:10, fontSize:14, fontWeight:700, letterSpacing:'.2px',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            boxShadow: loading ? 'none' : `0 4px 18px ${C.emerald}40`,
            transition:'all .2s ease', cursor: loading ? 'wait' : 'pointer',
          }}
            onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow=`0 6px 22px ${C.emerald}55` }}}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow = loading ? 'none' : `0 4px 18px ${C.emerald}40` }}
          >
            {loading ? (
              <><div style={{ width:15,height:15,borderRadius:'50%',border:'2px solid rgba(255,255,255,.3)',borderTopColor:'white',animation:'spin 1s linear infinite' }}/>Création du compte…</>
            ) : (
              <>Créer mon compte <ArrowRight size={15}/></>
            )}
          </button>
        </form>

        <p style={{ textAlign:'center', margin:'14px 0 0', fontSize:13, color:C.textSec }}>
          Déjà un compte ?{' '}
          <Link to="/login" style={{ color:C.brown, fontWeight:700, textDecoration:'none' }}>Se connecter</Link>
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
      </div>

       <p style={{ textAlign:'center', marginTop:630, fontSize:12, color:C.textMuted, position:'absolute' }}>
        © 2026 SENSIA Studs · STI ADAPTATIF ·{' '}
        <span style={{ color:C.brownLight, cursor:'pointer', fontWeight:600 }}>Mentions légales</span>
      </p>
    </div>
  )
}