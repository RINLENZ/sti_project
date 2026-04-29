import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { loginSuccess } from '../../store/authSlice'
import api from '../../services/api'
import toast from 'react-hot-toast'
import {
  Copy, CheckCircle, ChevronRight,
  Building2, BookOpen, Users, Hash, Sparkles,
  X, Search, GraduationCap, RefreshCw, ArrowLeft
} from 'lucide-react'
import SensiaLogo from '../../components/SensiaLogo'
import { C, useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'

// ── Onde ECG ──────────────────────────────────────────────────────
function ECGWave({ width=28, height=18, color='white' }) {
  const w=width, h=height
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display:'block' }}>
      <polyline
        points={`0,${h/2} ${w*.18},${h/2} ${w*.28},${h*.82} ${w*.38},${h*.09} ${w*.48},${h*.82} ${w*.58},${h/2} ${w*.72},${h/2} ${w*.80},${h*.25} ${w*.87},${h/2} ${w},${h/2}`}
        fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Pays ──────────────────────────────────────────────────────────
const PAYS = [
  { code:'CM', name:'Cameroun',      flag:'🇨🇲' },
  { code:'CI', name:"Côte d'Ivoire", flag:'🇨🇮' },
  { code:'SN', name:'Sénégal',       flag:'🇸🇳' },
  { code:'ML', name:'Mali',          flag:'🇲🇱' },
  { code:'BF', name:'Burkina Faso',  flag:'🇧🇫' },
  { code:'CG', name:'Congo',         flag:'🇨🇬' },
  { code:'GA', name:'Gabon',         flag:'🇬🇦' },
  { code:'XX', name:'Autre',         flag:'🌍' },
]

// ── Matières fallback ─────────────────────────────────────────────
const MATIERES_FALLBACK = [
  { id:1,  nom:'Mathématiques',      code:'MATH',  icon:'📐', couleur:'#3B82F6' },
  { id:2,  nom:'Physique-Chimie',    code:'PC',    icon:'⚗️', couleur:'#8B5CF6' },
  { id:3,  nom:'Informatique',       code:'INFO',  icon:'💻', couleur:'#0D9373' },
  { id:4,  nom:'Sciences de la Vie', code:'SVT',   icon:'🧬', couleur:'#10B981' },
  { id:5,  nom:'Français',           code:'FR',    icon:'📝', couleur:'#F59E0B' },
  { id:6,  nom:'Anglais',            code:'ANG',   icon:'🇬🇧', couleur:'#EF4444' },
  { id:7,  nom:'Histoire-Géo',       code:'HG',    icon:'🌍', couleur:'#6B3A2A' },
  { id:8,  nom:'Philosophie',        code:'PHILO', icon:'💡', couleur:'#7C3AED' },
  { id:9,  nom:'Économie',           code:'ECO',   icon:'📊', couleur:'#D4A853' },
  { id:10, nom:'Comptabilité',       code:'COMPT', icon:'🧾', couleur:'#C4865A' },
  { id:11, nom:'Arts plastiques',    code:'ART',   icon:'🎨', couleur:'#EC4899' },
  { id:12, nom:'Éducation physique', code:'EPS',   icon:'⚽', couleur:'#14B8A6' },
]

// ── Niveaux fallback ──────────────────────────────────────────────
const NIVEAUX_FALLBACK = [
  { cycleNom:'Collège', items:[
    {id:'6e',nom:'6ème',code:'6E'},{id:'5e',nom:'5ème',code:'5E'},
    {id:'4e',nom:'4ème',code:'4E'},{id:'3e',nom:'3ème',code:'3E'},
  ]},
  { cycleNom:'Lycée général', items:[
    {id:'2de',nom:'2nde',code:'2D'},{id:'1es',nom:'1ère ES',code:'1ES'},
    {id:'1l',nom:'1ère L',code:'1L'},{id:'1s',nom:'1ère S',code:'1S'},
    {id:'tles',nom:'Tle ES',code:'TES'},{id:'tlel',nom:'Tle L',code:'TL'},
    {id:'tls',nom:'Tle S',code:'TS'},
  ]},
  { cycleNom:'Lycée technique', items:[
    {id:'1f6',nom:'1ère F6',code:'1F6'},{id:'tlc',nom:'Tle C',code:'TLC'},
    {id:'tld',nom:'Tle D',code:'TLD'},{id:'1ti',nom:'1ère TI',code:'1TI'},
  ]},
  { cycleNom:'Supérieur', items:[
    {id:'l1',nom:'Licence 1',code:'L1'},{id:'l2',nom:'Licence 2',code:'L2'},
    {id:'l3',nom:'Licence 3',code:'L3'},{id:'m1',nom:'Master 1',code:'M1'},
    {id:'m2',nom:'Master 2',code:'M2'},
  ]},
]

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 7; i++) {
    if (i === 3) code += '-'
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ── Composants boutons ────────────────────────────────────────────
function BtnNext({ onClick, disabled, label='Continuer', mobile }) {
  const { C } = useTheme()
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex:2, padding:mobile?'12px':'13px',
      background: disabled ? '#E5E7EB' : `linear-gradient(135deg,${C.brown},${C.brownLight})`,
      color: disabled ? C.textSec : 'white',
      border:'none', borderRadius:12, fontSize:mobile?13:14, fontWeight:800,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : `0 4px 18px ${C.brown}35`,
      transition:'all .2s ease',
      display:'flex', alignItems:'center', justifyContent:'center', gap:6
    }}>
      {label} {!disabled && <ChevronRight size={15}/>}
    </button>
  )
}

function BtnBack({ onClick, mobile }) {
  const { C } = useTheme()
  return (
    <button onClick={onClick} style={{
      flex:1, padding:mobile?'12px':'13px',
      background:C.brownPale, color:C.brown,
      border:'none', borderRadius:12, fontSize:13, fontWeight:700,
      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:4,
    }}>
      <ArrowLeft size={14}/> Retour
    </button>
  )
}

// ── Grille niveaux ────────────────────────────────────────────────
function NiveauxGrid({ niveauxParCycle, selected, toggle, mobile }) {
  const { C } = useTheme()
  const data = Object.keys(niveauxParCycle).length > 0
    ? Object.entries(niveauxParCycle).map(([cycleNom, items]) => ({ cycleNom, items }))
    : NIVEAUX_FALLBACK

  return (
    <>
      {data.map(({ cycleNom, items }) => (
        <div key={cycleNom} style={{ marginBottom:14 }}>
          <p style={{ fontSize:10, fontWeight:800, color:C.textSec, textTransform:'uppercase', letterSpacing:.8, marginBottom:8, display:'flex', alignItems:'center', gap:6, margin:'0 0 8px' }}>
            <span style={{ width:18, height:2, backgroundColor:C.brownLight, display:'inline-block' }}/>
            {cycleNom}
          </p>
          <div style={{ display:'grid', gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap:7 }}>
            {items.map(n => {
              const isSel = !!selected.find(x => x.id === n.id)
              return (
                <div key={n.id} onClick={() => toggle(n)} style={{
                  padding:'10px 8px', borderRadius:10, textAlign:'center',
                  border:`2px solid ${isSel ? C.brown : C.brownPale}`,
                  backgroundColor: isSel ? C.brownPale : C.surface,
                  cursor:'pointer', transition:'all .18s ease',
                  boxShadow: isSel ? `0 3px 10px ${C.brown}20` : 'none'
                }}>
                  <div style={{ width:30, height:30, borderRadius:8, margin:'0 auto 5px', background: isSel ? `linear-gradient(135deg,${C.brown},${C.brownLight})` : '#E5E7EB', color: isSel ? 'white' : C.textSec, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900 }}>
                    {n.code || n.nom?.slice(0,3)}
                  </div>
                  <p style={{ margin:0, fontSize:10, fontWeight:700, color: isSel ? C.brown : C.text }}>{n.nom}</p>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}

// ── Page principale ───────────────────────────────────────────────
export default function OnboardingEnseignant() {
  const { C } = useTheme()
  const { user, token } = useSelector(s => s.auth)
  const dispatch        = useDispatch()
  const navigate        = useNavigate()
  const { mobile }      = useBreakpoint()

  const TOTAL_STEPS = 5
  const [step, setStep] = useState(1)

  // Référentiel
  const [matieres,   setMatieres]   = useState([])
  const [niveaux,    setNiveaux]    = useState([])
  const [loadingRef, setLoadingRef] = useState(true)

  // Étape 1
  const [etablissement, setEtablissement] = useState('')
  const [ville,         setVille]         = useState('')
  const [selectedPays,  setSelectedPays]  = useState(PAYS[0])
  const [showPaysGrid,  setShowPaysGrid]  = useState(false)

  // Étape 2
  const [selectedMatieres, setSelectedMatieres] = useState([])
  const [searchMatiere,    setSearchMatiere]     = useState('')

  // Étape 3
  const [selectedNiveaux, setSelectedNiveaux] = useState([])

  // Étape 4
  const [codeClasse, setCodeClasse] = useState(() => generateCode())
  const [codeCopied, setCodeCopied] = useState(false)

  // Global
  const [loading, setLoading] = useState(false)

  // ── Chargement référentiel ────────────────────────────────────
  useEffect(() => {
    Promise.all([
      api.get('/api/cours/matieres/public').catch(() => null),
      api.get('/api/cours/referentiel/public').catch(() => null),
    ]).then(([matRes, refRes]) => {
      setMatieres(matRes?.data?.length ? matRes.data : MATIERES_FALLBACK)
      if (refRes?.data?.length) {
        const tous = []
        refRes.data.forEach(cycle => {
          cycle.niveaux?.forEach(n => tous.push({ ...n, cycleNom:cycle.nom, cycleCode:cycle.code }))
        })
        setNiveaux(tous)
      }
    }).finally(() => setLoadingRef(false))
  }, [])

  const matieresFiltrees = matieres.filter(m =>
    m.nom.toLowerCase().includes(searchMatiere.toLowerCase()) ||
    m.code?.toLowerCase().includes(searchMatiere.toLowerCase())
  )

  function toggleMatiere(m) {
    setSelectedMatieres(prev => prev.find(x=>x.id===m.id) ? prev.filter(x=>x.id!==m.id) : [...prev,m])
  }
  function toggleNiveau(n) {
    setSelectedNiveaux(prev => prev.find(x=>x.id===n.id) ? prev.filter(x=>x.id!==n.id) : [...prev,n])
  }

  const canNext = ({
    1: !!etablissement.trim() && !!ville.trim() && !!selectedPays,
    2: selectedMatieres.length > 0,
    3: selectedNiveaux.length > 0,
    4: !!codeClasse.trim(),
  })[step] ?? true

  function nextStep() { if (step < TOTAL_STEPS) setStep(s=>s+1) }
  function prevStep() { if (step > 1) setStep(s=>s-1) }

  function copyCode() {
    navigator.clipboard.writeText(codeClasse)
    setCodeCopied(true); toast.success('Code copié !')
    setTimeout(() => setCodeCopied(false), 2000)
  }

  async function finish() {
    setLoading(true)
    try {
      const payload = {
        etablissement:     etablissement.trim(),
        ville:             ville.trim(),
        pays:              selectedPays.name,
        matieres:          selectedMatieres.map(m=>m.nom),
        niveaux_enseignes: selectedNiveaux.map(n=>n.nom),
        code_classe:       codeClasse,
      }
      const { data: updated } = await api.put(`/auth/profil/${user.id}/update`, payload)
dispatch(loginSuccess({
  token,
  user: {
    ...user,
    etablissement:       updated.etablissement,
    ville:               updated.ville,
    matieres_enseignees: updated.matieres_enseignees,
    niveaux_enseignes:   updated.niveaux_enseignes,
    code_classe:         updated.code_classe,
  }
}))
      localStorage.setItem(`onboarding_done_${user.id}`, '1')
      toast.success('Profil enseignant configuré !')
      navigate('/prof')
    } catch {
      toast.error('Erreur lors de la configuration')
    } finally {
      setLoading(false)
    }
  }

  const niveauxParCycle = niveaux.reduce((acc,n) => {
    const key = n.cycleNom || 'Autres'
    if (!acc[key]) acc[key] = []
    acc[key].push(n)
    return acc
  }, {})

  const STEP_ICONS  = {
    1:<Building2 size={12}/>, 2:<BookOpen size={12}/>, 3:<Users size={12}/>,
    4:<Hash size={12}/>,      5:<CheckCircle size={12}/>
  }
  const STEP_LABELS = {
    1:'Établissement', 2:'Matières', 3:'Niveaux', 4:'Code classe', 5:'Confirmation'
  }

  if (loadingRef) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:`linear-gradient(135deg,${C.brown},#1A0A05)` }}>
      <div style={{ textAlign:'center', color:'white' }}>
        <div style={{ width:44,height:44,borderRadius:'50%',border:'3px solid rgba(255,255,255,.2)',borderTopColor:C.gold,margin:'0 auto 16px',animation:'spin 1s linear infinite' }}/>
        <p style={{ fontSize:14, opacity:.7 }}>Chargement…</p>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight:'100vh',
      background:`linear-gradient(135deg,${C.brown} 0%,${C.brownDark} 50%,#1A0A05 100%)`,
      display:'flex', alignItems:'center', justifyContent:'center',
      padding: mobile ? '16px 12px' : '24px 16px',
      position:'relative', overflow:'hidden',
      fontFamily:"'Sora','Segoe UI',sans-serif",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <style>{`
        input::placeholder{color:#C8B8B0;font-weight:400}
        .input-ens:focus{outline:none;border-color:${C.brown}!important;box-shadow:0 0 0 3px ${C.brown}18!important}
        button{font-family:inherit;cursor:pointer}
      `}</style>

      {/* Motif adinkra */}
      <svg style={{ position:'absolute',inset:0,width:'100%',height:'100%',opacity:.06,pointerEvents:'none' }}>
        <defs>
          <pattern id="adk-ens" x="0" y="0" width="70" height="70" patternUnits="userSpaceOnUse">
            <circle cx="35" cy="35" r="14" fill="none" stroke="white" strokeWidth="1.2"/>
            <circle cx="35" cy="35" r="7"  fill="none" stroke="white" strokeWidth="1.2"/>
            <line x1="35" y1="21" x2="35" y2="13" stroke="white" strokeWidth="1.2"/>
            <line x1="35" y1="49" x2="35" y2="57" stroke="white" strokeWidth="1.2"/>
            <line x1="21" y1="35" x2="13" y2="35" stroke="white" strokeWidth="1.2"/>
            <line x1="49" y1="35" x2="57" y2="35" stroke="white" strokeWidth="1.2"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#adk-ens)"/>
      </svg>

      <div style={{ position:'absolute',top:-100,right:-100,width:380,height:380,borderRadius:'50%',background:`radial-gradient(circle,${C.brownLight}18,transparent 70%)`,pointerEvents:'none' }}/>
      <div style={{ position:'absolute',bottom:-80,left:-80,width:320,height:320,borderRadius:'50%',background:`radial-gradient(circle,${C.gold}12,transparent 70%)`,pointerEvents:'none' }}/>

      {/* ── Carte ── */}
      <div style={{
        backgroundColor:C.surface, borderRadius:mobile?20:26,
        padding: mobile ? '24px 20px' : '32px 38px',
        maxWidth:540, width:'100%',
        boxShadow:'0 32px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.07)',
        animation:'fadeUp .5s ease', position:'relative',
        maxHeight: mobile ? '95vh' : 'none', overflowY: mobile ? 'auto' : 'visible',
      }}>
        {/* Bande top */}
        <div style={{ position:'absolute',top:0,left:mobile?20:28,right:mobile?20:28,height:3,borderRadius:'0 0 3px 3px',background:`linear-gradient(90deg,${C.brown},${C.gold},${C.emerald})` }}/>

        {/* ── Header logo (ECGWave + SensiaLogo) ── */}
        <div style={{ display:'flex', alignItems:'center', gap:13, marginBottom:mobile?18:24 }}>
          <div style={{
            width:mobile?46:54, height:mobile?46:54, borderRadius:15, flexShrink:0,
            background:`linear-gradient(135deg,${C.brown},${C.gold})`,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow:`0 8px 24px ${C.brown}60`,
            animation:'glow 3s infinite, float 4s ease-in-out infinite',
          }}>
            <ECGWave width={mobile?28:34} height={mobile?18:22} color="white"/>
          </div>
          <div>
            <SensiaLogo size={mobile?24:28} light={false}/>
            <p style={{ fontSize:12, color:C.textSec, margin:'3px 0 0', fontWeight:500 }}>
              Bienvenue, Prof. <strong style={{ color:C.brown }}>{user?.prenom}</strong> ! 🎓
            </p>
          </div>
        </div>

        {/* ── Stepper ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', marginBottom:mobile?16:22 }}>
          {Array.from({ length:TOTAL_STEPS }, (_,i)=>i+1).map((s,i) => (
            <div key={s} style={{ display:'flex', alignItems:'center' }}>
              <div style={{
                width:mobile?26:30, height:mobile?26:30, borderRadius:'50%',
                background: step>=s ? `linear-gradient(135deg,${C.brown},${C.brownLight})` : '#E5E7EB',
                color: step>=s ? 'white' : C.textSec,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:11, fontWeight:900, transition:'all .3s ease', flexShrink:0,
                boxShadow: step===s ? `0 0 0 4px ${C.brown}25` : 'none',
              }}>
                {step>s ? <CheckCircle size={12} color="white"/> : STEP_ICONS[s]}
              </div>
              {i < TOTAL_STEPS-1 && (
                <div style={{ width:mobile?28:40, height:2, backgroundColor: step>s ? C.brown : '#E5E7EB', transition:'background .3s' }}/>
              )}
            </div>
          ))}
        </div>

        {/* Badge étape */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:5, backgroundColor:C.brownPale, borderRadius:20, padding:'4px 12px', marginBottom:16, fontSize:10, fontWeight:800, color:C.brown, textTransform:'uppercase', letterSpacing:.8 }}>
          <Sparkles size={10}/>
          Étape {step}/{TOTAL_STEPS} — {STEP_LABELS[step]}
        </div>

        {/* ════════════════════════════════════
            ÉTAPE 1 — Établissement
        ════════════════════════════════════ */}
        {step === 1 && (
          <div style={{ animation:'slideDown .3s ease' }}>
            <h2 style={{ fontSize:mobile?16:19, fontWeight:900, color:C.text, marginBottom:4 }}>Ton établissement 🏫</h2>
            <p style={{ color:C.textSec, fontSize:13, marginBottom:18 }}>Ces informations identifient ton école sur la plateforme</p>

            <div style={{ display:'flex', flexDirection:'column', gap:13, marginBottom:18 }}>
              {/* Nom établissement */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.textSec, display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
                  <Building2 size={12}/> Nom de l'établissement *
                </label>
                <input className="input-ens" value={etablissement} onChange={e=>setEtablissement(e.target.value)}
                  placeholder="Ex : Lycée Général Leclerc"
                  style={{ width:'100%',padding:'12px 14px',borderRadius:11,border:`2px solid ${etablissement?C.brown:C.brownPale}`,fontSize:14,color:C.text,backgroundColor:C.surface,transition:'all .2s ease',fontWeight:etablissement?600:400 }}
                />
              </div>

              {/* Ville */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.textSec, display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
                  📍 Ville *
                </label>
                <input className="input-ens" value={ville} onChange={e=>setVille(e.target.value)}
                  placeholder="Ex : Yaoundé"
                  style={{ width:'100%',padding:'12px 14px',borderRadius:11,border:`2px solid ${ville?C.brown:C.brownPale}`,fontSize:14,color:C.text,backgroundColor:C.surface,transition:'all .2s ease',fontWeight:ville?600:400 }}
                />
              </div>

              {/* Pays */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:C.textSec, display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>🌍 Pays *</label>
                <div onClick={()=>setShowPaysGrid(v=>!v)} style={{ padding:'11px 14px',borderRadius:11,border:`2px solid ${C.brown}`,backgroundColor:C.brownPale,cursor:'pointer',display:'flex',alignItems:'center',gap:12 }}>
                  <span style={{ fontSize:20 }}>{selectedPays.flag}</span>
                  <span style={{ fontSize:14, fontWeight:700, color:C.brown, flex:1 }}>{selectedPays.name}</span>
                  <ChevronRight size={14} color={C.brown} style={{ transform:showPaysGrid?'rotate(90deg)':'none', transition:'transform .2s' }}/>
                </div>
                {showPaysGrid && (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:7, marginTop:10, animation:'slideDown .2s ease' }}>
                    {PAYS.map(p => (
                      <div key={p.code} onClick={()=>{setSelectedPays(p);setShowPaysGrid(false)}} style={{ padding:'9px 5px',borderRadius:10,textAlign:'center',border:`2px solid ${selectedPays.code===p.code?C.brown:C.brownPale}`,backgroundColor:selectedPays.code===p.code?C.brownPale:C.surface,cursor:'pointer',transition:'all .15s ease' }}>
                        <div style={{ fontSize:18, marginBottom:3 }}>{p.flag}</div>
                        <p style={{ margin:0, fontSize:9, fontWeight:700, color:selectedPays.code===p.code?C.brown:C.textSec }}>{p.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <BtnNext disabled={!canNext} onClick={nextStep} mobile={mobile}/>
          </div>
        )}

        {/* ════════════════════════════════════
            ÉTAPE 2 — Matières
        ════════════════════════════════════ */}
        {step === 2 && (
          <div style={{ animation:'slideDown .3s ease' }}>
            <h2 style={{ fontSize:mobile?16:19, fontWeight:900, color:C.text, marginBottom:4 }}>Tes matières enseignées 📚</h2>
            <p style={{ color:C.textSec, fontSize:13, marginBottom:14 }}>Sélectionne une ou plusieurs matières</p>

            {selectedMatieres.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                {selectedMatieres.map(m => (
                  <div key={m.id} onClick={()=>toggleMatiere(m)} style={{ display:'inline-flex',alignItems:'center',gap:5,backgroundColor:m.couleur||C.brown,color:'white',borderRadius:20,padding:'4px 10px 4px 8px',fontSize:11,fontWeight:700,cursor:'pointer',transition:'transform .15s' }}>
                    <span>{m.icon||'📖'}</span>{m.nom}<X size={10} style={{ opacity:.8 }}/>
                  </div>
                ))}
              </div>
            )}

            <div style={{ position:'relative', marginBottom:10 }}>
              <Search size={14} color={C.textSec} style={{ position:'absolute',left:12,top:'50%',transform:'translateY(-50%)' }}/>
              <input className="input-ens" value={searchMatiere} onChange={e=>setSearchMatiere(e.target.value)} placeholder="Rechercher…"
                style={{ width:'100%',padding:'10px 12px 10px 34px',borderRadius:10,border:`2px solid ${C.brownPale}`,fontSize:13,color:C.text,backgroundColor:C.surface }}
              />
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:7, maxHeight:mobile?220:260, overflowY:'auto', marginBottom:14 }}>
              {matieresFiltrees.map(m => {
                const isSel = !!selectedMatieres.find(x=>x.id===m.id)
                return (
                  <div key={m.id} onClick={()=>toggleMatiere(m)} style={{ padding:'10px 12px',borderRadius:11,border:`2px solid ${isSel?(m.couleur||C.brown):C.brownPale}`,backgroundColor:isSel?`${m.couleur||C.brown}12`:C.surface,cursor:'pointer',display:'flex',alignItems:'center',gap:9,transition:'all .18s ease',boxShadow:isSel?`0 3px 12px ${m.couleur||C.brown}25`:'none' }}>
                    <span style={{ fontSize:18, flexShrink:0 }}>{m.icon||'📖'}</span>
                    <span style={{ fontSize:12,fontWeight:isSel?800:600,color:isSel?(m.couleur||C.brown):C.text,flex:1,lineHeight:1.3 }}>{m.nom}</span>
                    {isSel && <CheckCircle size={13} color={m.couleur||C.brown}/>}
                  </div>
                )
              })}
              {matieresFiltrees.length === 0 && (
                <div style={{ gridColumn:'1/-1',textAlign:'center',padding:'16px',color:C.textSec,fontSize:13 }}>
                  Aucun résultat pour « {searchMatiere} »
                </div>
              )}
            </div>

            <p style={{ fontSize:11, color:selectedMatieres.length?C.emerald:C.textSec, fontWeight:700, textAlign:'right', marginBottom:12 }}>
              {selectedMatieres.length} matière(s) sélectionnée(s)
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <BtnBack onClick={prevStep} mobile={mobile}/>
              <BtnNext disabled={!canNext} onClick={nextStep} mobile={mobile}/>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════
            ÉTAPE 3 — Niveaux
        ════════════════════════════════════ */}
        {step === 3 && (
          <div style={{ animation:'slideDown .3s ease' }}>
            <h2 style={{ fontSize:mobile?16:19, fontWeight:900, color:C.text, marginBottom:4 }}>Les niveaux que tu encadres 🏛️</h2>
            <p style={{ color:C.textSec, fontSize:13, marginBottom:14 }}>Sélectionne toutes les classes dans lesquelles tu interviens</p>

            {selectedNiveaux.length > 0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                {selectedNiveaux.map(n => (
                  <div key={n.id} onClick={()=>toggleNiveau(n)} style={{ display:'inline-flex',alignItems:'center',gap:5,backgroundColor:C.brown,color:'white',borderRadius:20,padding:'4px 10px 4px 8px',fontSize:11,fontWeight:700,cursor:'pointer' }}>
                    {n.nom}<X size={10} style={{ opacity:.8 }}/>
                  </div>
                ))}
              </div>
            )}

            <div style={{ maxHeight:mobile?230:290, overflowY:'auto', paddingRight:4, marginBottom:12 }}>
              <NiveauxGrid niveauxParCycle={niveauxParCycle} selected={selectedNiveaux} toggle={toggleNiveau} mobile={mobile}/>
            </div>

            <p style={{ fontSize:11, color:selectedNiveaux.length?C.emerald:C.textSec, fontWeight:700, textAlign:'right', marginBottom:12 }}>
              {selectedNiveaux.length} classe(s) sélectionnée(s)
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <BtnBack onClick={prevStep} mobile={mobile}/>
              <BtnNext disabled={!canNext} onClick={nextStep} mobile={mobile}/>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════
            ÉTAPE 4 — Code classe
        ════════════════════════════════════ */}
        {step === 4 && (
          <div style={{ animation:'slideDown .3s ease' }}>
            <h2 style={{ fontSize:mobile?16:19, fontWeight:900, color:C.text, marginBottom:4 }}>Ton code classe 🔑</h2>
            <p style={{ color:C.textSec, fontSize:13, marginBottom:18 }}>Partage ce code à tes apprenants pour suivre leur progression</p>

            <div style={{ background:`linear-gradient(135deg,${C.brownPale},${C.emeraldPale})`,borderRadius:16,padding:mobile?'18px 16px':'24px 20px',marginBottom:14,border:`1px solid ${C.brownLight}30`,textAlign:'center' }}>
              <p style={{ fontSize:10, fontWeight:800, color:C.textSec, textTransform:'uppercase', letterSpacing:.8, marginBottom:12 }}>Code de ta classe</p>
              <div style={{ background:'white',borderRadius:12,padding:'16px 20px',border:`2px dashed ${C.brown}40`,marginBottom:14 }}>
                <span style={{ fontFamily:'monospace', fontSize:mobile?28:34, fontWeight:900, color:C.brown, letterSpacing:6, display:'block' }}>
                  {codeClasse}
                </span>
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                <button onClick={copyCode} style={{ display:'inline-flex',alignItems:'center',gap:6,backgroundColor:codeCopied?C.emeraldPale:C.brownPale,color:codeCopied?C.emerald:C.brown,border:'none',borderRadius:9,padding:'9px 16px',fontSize:12,fontWeight:700,transition:'all .2s ease' }}>
                  {codeCopied?<CheckCircle size={14}/>:<Copy size={14}/>} {codeCopied?'Copié !':'Copier'}
                </button>
                <button onClick={()=>setCodeClasse(generateCode())} style={{ display:'inline-flex',alignItems:'center',gap:6,backgroundColor:C.surface,color:C.textSec,border:`2px solid ${C.brownPale}`,borderRadius:9,padding:'9px 16px',fontSize:12,fontWeight:700 }}>
                  <RefreshCw size={13}/> Regénérer
                </button>
              </div>
            </div>

            <div style={{ marginBottom:16 }}>
              <label style={{ fontSize:11, fontWeight:700, color:C.textSec, display:'flex', alignItems:'center', gap:5, marginBottom:6 }}>
                <Hash size={11}/> Personnaliser (optionnel)
              </label>
              <input className="input-ens" value={codeClasse}
                onChange={e=>setCodeClasse(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,'').slice(0,7))}
                placeholder="Ex : MATH-1A"
                style={{ width:'100%',padding:'12px 14px',borderRadius:11,border:`2px solid ${codeClasse?C.brown:C.brownPale}`,fontSize:18,color:C.brown,backgroundColor:C.surface,fontFamily:'monospace',fontWeight:900,letterSpacing:3,textTransform:'uppercase',transition:'all .2s ease' }}
              />
              <p style={{ fontSize:10, color:C.textSec, marginTop:5 }}>6-7 caractères · Lettres et chiffres uniquement</p>
            </div>

            <div style={{ backgroundColor:`${C.emerald}10`,border:`1px solid ${C.emerald}25`,borderRadius:11,padding:'11px 14px',marginBottom:16,display:'flex',gap:10,alignItems:'flex-start' }}>
              <Users size={14} color={C.emerald} style={{ marginTop:1, flexShrink:0 }}/>
              <p style={{ fontSize:12, color:C.emerald, fontWeight:600, margin:0, lineHeight:1.5 }}>
                Tes apprenants saisissent ce code lors de leur inscription pour apparaître dans ta liste.
              </p>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <BtnBack onClick={prevStep} mobile={mobile}/>
              <BtnNext disabled={!canNext} onClick={nextStep} label="Récapitulatif" mobile={mobile}/>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════
            ÉTAPE 5 — Récapitulatif
        ════════════════════════════════════ */}
        {step === 5 && (
          <div style={{ animation:'slideDown .3s ease' }}>
            <h2 style={{ fontSize:mobile?16:19, fontWeight:900, color:C.text, marginBottom:4 }}>Presque là ! 🚀</h2>
            <p style={{ color:C.textSec, fontSize:13, marginBottom:16 }}>Vérifie ton profil enseignant avant de commencer</p>

            <div style={{ background:`linear-gradient(135deg,${C.brownPale},${C.emeraldPale})`,borderRadius:14,padding:mobile?'16px':'20px 22px',marginBottom:12,border:`1px solid ${C.brownLight}30` }}>
              {/* Avatar */}
              <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:14 }}>
                <div style={{ width:mobile?42:50, height:mobile?42:50, borderRadius:13, flexShrink:0, background:`linear-gradient(135deg,${C.brown},${C.brownLight})`, color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:mobile?15:18, fontWeight:900 }}>
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </div>
                <div>
                  <p style={{ margin:0, fontSize:mobile?14:16, fontWeight:900, color:C.text }}>{user?.prenom} {user?.nom}</p>
                  <p style={{ margin:'2px 0 0', fontSize:11, color:C.textSec }}>{user?.email}</p>
                </div>
              </div>

              {[
                { icon:'🏫', label:'Établissement', value:etablissement },
                { icon:'📍', label:'Ville / Pays',  value:`${ville}, ${selectedPays.flag} ${selectedPays.name}` },
              ].map(r => (
                <div key={r.label} style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'7px 0',borderTop:`1px solid ${C.brownLight}20` }}>
                  <span style={{ fontSize:11,color:C.textSec,fontWeight:600 }}>{r.icon} {r.label}</span>
                  <span style={{ fontSize:12,fontWeight:700,color:C.text,textAlign:'right',maxWidth:'58%' }}>{r.value}</span>
                </div>
              ))}

              <div style={{ padding:'8px 0', borderTop:`1px solid ${C.brownLight}20` }}>
                <p style={{ fontSize:11,color:C.textSec,fontWeight:600,margin:'0 0 7px',display:'flex',alignItems:'center',gap:4 }}>📚 Matières</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {selectedMatieres.map(m => (
                    <span key={m.id} style={{ fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20,backgroundColor:`${m.couleur||C.brown}18`,color:m.couleur||C.brown,border:`1px solid ${m.couleur||C.brown}30` }}>
                      {m.icon} {m.nom}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ padding:'8px 0', borderTop:`1px solid ${C.brownLight}20` }}>
                <p style={{ fontSize:11,color:C.textSec,fontWeight:600,margin:'0 0 7px',display:'flex',alignItems:'center',gap:4 }}>🏛️ Niveaux encadrés</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {selectedNiveaux.map(n => (
                    <span key={n.id} style={{ fontSize:11,fontWeight:700,padding:'3px 9px',borderRadius:20,backgroundColor:C.brownPale,color:C.brown,border:`1px solid ${C.brownLight}30` }}>
                      {n.nom}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Code classe */}
            <div style={{ background:`linear-gradient(135deg,${C.emeraldPale},${C.brownPale})`,borderRadius:13,padding:mobile?'13px':'16px 20px',marginBottom:mobile?16:20,border:`1px solid ${C.emerald}25` }}>
              <p style={{ fontSize:10,fontWeight:800,color:C.emerald,textTransform:'uppercase',letterSpacing:.8,marginBottom:8 }}>Code classe à partager</p>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',backgroundColor:'white',borderRadius:9,padding:'10px 14px',border:`1px solid ${C.emerald}20` }}>
                <span style={{ fontFamily:'monospace',fontSize:mobile?18:22,fontWeight:900,color:C.brown,letterSpacing:4 }}>{codeClasse}</span>
                <button onClick={copyCode} style={{ backgroundColor:codeCopied?C.emeraldPale:C.brownPale,border:'none',borderRadius:7,padding:'6px 10px',cursor:'pointer',display:'flex',alignItems:'center',gap:5,fontSize:11,fontWeight:700,color:codeCopied?C.emerald:C.brown }}>
                  {codeCopied?<CheckCircle size={12}/>:<Copy size={12}/>} {codeCopied?'Copié':'Copier'}
                </button>
              </div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <BtnBack onClick={prevStep} mobile={mobile}/>
              <button onClick={finish} disabled={loading} style={{
                flex:2, padding:mobile?'12px':'14px',
                background:`linear-gradient(135deg,${C.brown},${C.brownLight})`,
                color:'white', border:'none', borderRadius:12,
                fontSize:mobile?13:14, fontWeight:800,
                cursor:loading?'wait':'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow:`0 4px 18px ${C.brown}35`, opacity:loading?.7:1,
                transition:'all .2s ease',
              }}>
                <GraduationCap size={15}/>
                {loading ? 'Enregistrement…' : 'Commencer à enseigner !'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}