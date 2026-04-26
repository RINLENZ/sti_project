import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { loginSuccess } from '../../store/authSlice'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Copy, CheckCircle, GraduationCap, Brain, ChevronRight } from 'lucide-react'
import { C } from '../../styles/theme'

const PAYS = [
  { code: 'CM', name: 'Cameroun',      flag: '🇨🇲' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: 'SN', name: 'Sénégal',       flag: '🇸🇳' },
  { code: 'ML', name: 'Mali',          flag: '🇲🇱' },
  { code: 'BF', name: 'Burkina Faso',  flag: '🇧🇫' },
  { code: 'CG', name: 'Congo',         flag: '🇨🇬' },
  { code: 'GA', name: 'Gabon',         flag: '🇬🇦' },
  { code: 'XX', name: 'Autre',         flag: '🌍' },
]

const CYCLE_ICONS = {
  'PRI': '🏫', 'COL': '📚', 'LYC': '🎓', 'SUP': '🏛️'
}

const ORDRE_ICONS = {
  'GEN': '🎓', 'TI': '⚙️', 'TC': '💼'
}

export default function Onboarding() {
  const { user, token } = useSelector(s => s.auth)
  const dispatch        = useDispatch()
  const navigate        = useNavigate()

  // ── Navigation par étapes ──────────────────────────────────────
  // Étape 1 : Cycle
  // Étape 2 : Ordre (si le cycle en a)
  // Étape 3 : Filière (si l'ordre en a)
  // Étape 4 : Niveau
  // Étape 5 : Pays
  // Étape 6 : Récapitulatif
  const [step, setStep] = useState(1)

  // ── Données référentiel depuis l'API ───────────────────────────
  const [referentiel, setReferentiel] = useState([])
  const [loadingRef,  setLoadingRef]  = useState(true)

  // ── Sélections de l'apprenant ──────────────────────────────────
  const [selectedCycle,   setSelectedCycle]   = useState(null)
  const [selectedOrdre,   setSelectedOrdre]   = useState(null)
  const [selectedFiliere, setSelectedFiliere] = useState(null)
  const [selectedNiveau,  setSelectedNiveau]  = useState(null)
  const [selectedPays,    setSelectedPays]    = useState(PAYS[0])

  const [loading, setLoading] = useState(false)
  const [copied,  setCopied]  = useState(false)

  // ── Chargement du référentiel depuis l'API ─────────────────────
  useEffect(() => {
    api.get('/api/cours/referentiel/public')
      .then(({ data }) => {
        // Filtre uniquement les cycles avec du contenu
        const actifs = data.filter(c => c.ordres.length > 0 || c.niveaux.length > 0)
        setReferentiel(actifs)
      })
      .catch(() => toast.error('Impossible de charger le référentiel'))
      .finally(() => setLoadingRef(false))
  }, [])

  // ── Données dérivées ───────────────────────────────────────────
  // Ordres disponibles pour le cycle sélectionné
  const ordresDisponibles = selectedCycle?.ordres || []

  // Filières disponibles pour l'ordre sélectionné
  const filieresDisponibles = selectedOrdre?.filieres || []

  // Niveaux disponibles pour le cycle sélectionné
  const niveauxDisponibles = selectedCycle?.niveaux || []

  // Le cycle a-t-il des ordres ? (Lycée en a, Primaire non)
  const cycleHasOrdres = ordresDisponibles.length > 0

  // ── Navigation entre étapes ────────────────────────────────────
  function nextStep() {
    if (step === 1) {
      // Après cycle : aller vers ordre si disponible, sinon niveau direct
      if (cycleHasOrdres) { setStep(2); return }
      setStep(4) // Pas d'ordre → aller au niveau
    }
    if (step === 2) {
      // Après ordre : aller vers filière si disponible, sinon niveau
      if (filieresDisponibles.length > 0) { setStep(3); return }
      setStep(4)
    }
    if (step === 3) setStep(4) // Après filière → niveau
    if (step === 4) setStep(5) // Après niveau → pays
    if (step === 5) setStep(6) // Après pays → récap
  }

  function prevStep() {
    if (step === 2) { setStep(1); return }
    if (step === 3) { setStep(2); return }
    if (step === 4) {
      if (filieresDisponibles.length > 0) { setStep(3); return }
      if (cycleHasOrdres) { setStep(2); return }
      setStep(1)
    }
    if (step === 5) setStep(4)
    if (step === 6) setStep(5)
  }

  // ── Nombre total d'étapes selon le cycle ──────────────────────
  function getTotalSteps() {
    if (!selectedCycle) return 6
    let steps = 4 // cycle + niveau + pays + récap (minimum)
    if (cycleHasOrdres) steps++
    if (filieresDisponibles.length > 0) steps++
    return steps
  }

  // ── Numéro d'étape visuel (pour le stepper) ───────────────────
  function getVisualStep() {
    // Normalise le step réel en position visuelle 1→totalSteps
    const mapping = { 1: 1, 2: 2, 3: 3, 4: cycleHasOrdres ? (filieresDisponibles.length > 0 ? 4 : 3) : 2, 5: getTotalSteps() - 1, 6: getTotalSteps() }
    return mapping[step] || step
  }

  // ── Enregistrement final ───────────────────────────────────────
  async function finish() {
    if (!selectedNiveau) { toast.error('Choisis un niveau'); return }
    setLoading(true)
    try {
      const pays = selectedPays?.name || 'Cameroun'
      const payload = {
  niveau_label:  selectedNiveau.nom,
  filiere_label: selectedFiliere?.nom || null,
  pays,
}
      await api.put(`/auth/profil/${user.id}/update`, payload)
      dispatch(loginSuccess({
        token,
        user: {
          ...user,
          niveau_label:  selectedNiveau.nom,
          filiere_label: selectedFiliere?.nom || null,
          pays,
        }
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

  // ── Validation par étape ───────────────────────────────────────
  const canNext = {
    1: !!selectedCycle,
    2: !!selectedOrdre,
    3: !!selectedFiliere,
    4: !!selectedNiveau,
    5: !!selectedPays,
  }[step] ?? true

  const totalSteps = getTotalSteps()

  if (loadingRef) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${C.brown}, #1A0A05)` }}>
      <div style={{ textAlign: 'center', color: 'white' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', border: '3px solid rgba(255,255,255,.2)', borderTopColor: C.gold, margin: '0 auto 16px', animation: 'spin 1s linear infinite' }}/>
        <p style={{ fontSize: 14, opacity: .7 }}>Chargement du référentiel…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

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
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* Motif adinkra */}
      <svg style={{ position:'absolute',inset:0,width:'100%',height:'100%',opacity:.07,pointerEvents:'none' }}>
        <defs>
          <pattern id="adinkra-ob" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
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
        <rect width="100%" height="100%" fill="url(#adinkra-ob)"/>
      </svg>

      {/* Cercles décoratifs */}
      <div style={{ position:'absolute',top:-100,right:-100,width:400,height:400,borderRadius:'50%',background:`radial-gradient(circle, ${C.brownLight}15, transparent 70%)`,pointerEvents:'none' }}/>
      <div style={{ position:'absolute',bottom:-80,left:-80,width:300,height:300,borderRadius:'50%',background:`radial-gradient(circle, ${C.gold}10, transparent 70%)`,pointerEvents:'none' }}/>

      {/* ── Carte principale ── */}
      <div style={{
        backgroundColor: C.surface, borderRadius: 28,
        padding: '36px 40px', maxWidth: 520, width: '100%',
        boxShadow: '0 32px 80px rgba(0,0,0,.5)',
        border: '1px solid rgba(255,255,255,.08)',
        animation: 'fadeIn .5s ease', position: 'relative'
      }}>

        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom: 24 }}>
          <div style={{
            width:64, height:64, borderRadius:20, margin:'0 auto 14px',
            background:`linear-gradient(135deg, ${C.brown}, ${C.gold})`,
            display:'flex', alignItems:'center', justifyContent:'center',
            animation:'glow 3s infinite, float 4s ease-in-out infinite',
            boxShadow:`0 8px 24px ${C.brown}60`
          }}>
            <Brain size={30} color="white"/>
          </div>
          <h1 style={{ fontSize:22, fontWeight:900, color:C.brown, marginBottom:4 }}>EduSmart AI</h1>
          <p style={{ fontSize:13, color:C.textSec, fontWeight:600 }}>
            Bienvenue, <span style={{ color:C.brown, fontWeight:800 }}>{user?.prenom}</span> ! 👋
          </p>
        </div>

        {/* Stepper */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:0, marginBottom:28 }}>
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((s, i) => (
            <div key={s} style={{ display:'flex', alignItems:'center' }}>
              <div style={{
                width:30, height:30, borderRadius:'50%',
                background: getVisualStep() >= s
                  ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`
                  : '#E5E7EB',
                color: getVisualStep() >= s ? 'white' : C.textSec,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:12, fontWeight:900, transition:'all .3s ease',
                boxShadow: getVisualStep() === s ? `0 0 0 4px ${C.brown}25` : 'none',
              }}>
                {getVisualStep() > s ? <CheckCircle size={14} color="white"/> : s}
              </div>
              {i < totalSteps - 1 && (
                <div style={{
                  width: Math.max(20, Math.floor(280 / totalSteps)),
                  height:2,
                  backgroundColor: getVisualStep() > s ? C.brown : '#E5E7EB',
                  transition:'background .3s'
                }}/>
              )}
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════ */}
        {/* ÉTAPE 1 — Choix du cycle                          */}
        {/* ══════════════════════════════════════════════════ */}
        {step === 1 && (
          <div style={{ animation:'slideDown .3s ease' }}>
            <h2 style={{ fontSize:19, fontWeight:900, color:C.text, marginBottom:6 }}>
              Quel cycle d'enseignement ? 🏫
            </h2>
            <p style={{ color:C.textSec, fontSize:13, marginBottom:20 }}>
              Sélectionne ton niveau d'études actuel
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {referentiel.map(cycle => (
                <div key={cycle.id}
                  onClick={() => {
                    setSelectedCycle(cycle)
                    setSelectedOrdre(null)
                    setSelectedFiliere(null)
                    setSelectedNiveau(null)
                  }}
                  style={{
                    padding:'16px 20px', borderRadius:14,
                    border:`2px solid ${selectedCycle?.id === cycle.id ? C.brown : C.brownPale}`,
                    backgroundColor: selectedCycle?.id === cycle.id ? C.brownPale : C.surface,
                    cursor:'pointer', display:'flex', alignItems:'center', gap:16,
                    transition:'all .2s ease',
                    boxShadow: selectedCycle?.id === cycle.id ? `0 4px 16px ${C.brown}20` : 'none'
                  }}
                >
                  <span style={{ fontSize:28 }}>{CYCLE_ICONS[cycle.code] || '📚'}</span>
                  <div style={{ flex:1 }}>
                    <p style={{ margin:0, fontSize:15, fontWeight:800, color: selectedCycle?.id === cycle.id ? C.brown : C.text }}>
                      {cycle.nom}
                    </p>
                    <p style={{ margin:'2px 0 0', fontSize:12, color:C.textSec }}>
                      {cycle.niveaux?.map(n => n.nom).join(' · ') || 'Voir les niveaux'}
                    </p>
                  </div>
                  {selectedCycle?.id === cycle.id && <CheckCircle size={20} color={C.brown}/>}
                </div>
              ))}
            </div>
            <BtnNext disabled={!canNext} onClick={nextStep}/>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* ÉTAPE 2 — Choix de l'ordre                        */}
        {/* ══════════════════════════════════════════════════ */}
        {step === 2 && (
          <div style={{ animation:'slideDown .3s ease' }}>
            <h2 style={{ fontSize:19, fontWeight:900, color:C.text, marginBottom:6 }}>
              Quel ordre d'enseignement ? 📋
            </h2>
            <p style={{ color:C.textSec, fontSize:13, marginBottom:20 }}>
              {selectedCycle?.nom} — choisis ta filière générale
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:24 }}>
              {ordresDisponibles.map(ordre => (
                <div key={ordre.id}
                  onClick={() => {
                    setSelectedOrdre(ordre)
                    setSelectedFiliere(null)
                  }}
                  style={{
                    padding:'14px 18px', borderRadius:14,
                    border:`2px solid ${selectedOrdre?.id === ordre.id ? C.brown : C.brownPale}`,
                    backgroundColor: selectedOrdre?.id === ordre.id ? C.brownPale : C.surface,
                    cursor:'pointer', display:'flex', alignItems:'center', gap:14,
                    transition:'all .2s ease',
                    boxShadow: selectedOrdre?.id === ordre.id ? `0 4px 16px ${C.brown}20` : 'none'
                  }}
                >
                  <span style={{ fontSize:26 }}>{ORDRE_ICONS[ordre.code] || '📚'}</span>
                  <div style={{ flex:1 }}>
                    <p style={{ margin:0, fontSize:14, fontWeight:800, color: selectedOrdre?.id === ordre.id ? C.brown : C.text }}>
                      {ordre.nom}
                    </p>
                    <p style={{ margin:'2px 0 0', fontSize:11, color:C.textSec }}>
                      {ordre.filieres?.length} filière(s) disponible(s)
                    </p>
                  </div>
                  {selectedOrdre?.id === ordre.id && <CheckCircle size={18} color={C.brown}/>}
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <BtnBack onClick={prevStep}/>
              <BtnNext disabled={!canNext} onClick={nextStep}/>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* ÉTAPE 3 — Choix de la filière                     */}
        {/* ══════════════════════════════════════════════════ */}
        {step === 3 && (
          <div style={{ animation:'slideDown .3s ease' }}>
            <h2 style={{ fontSize:19, fontWeight:900, color:C.text, marginBottom:6 }}>
              Quelle est ta filière ? 🎯
            </h2>
            <p style={{ color:C.textSec, fontSize:13, marginBottom:20 }}>
              {selectedOrdre?.nom}
            </p>
            <div style={{
              display:'grid',
              gridTemplateColumns: filieresDisponibles.length > 4 ? 'repeat(2, 1fr)' : '1fr',
              gap:8, marginBottom:24, maxHeight:300, overflowY:'auto'
            }}>
              {filieresDisponibles.map(filiere => (
                <div key={filiere.id}
                  onClick={() => setSelectedFiliere(filiere)}
                  style={{
                    padding:'12px 14px', borderRadius:12,
                    border:`2px solid ${selectedFiliere?.id === filiere.id ? C.brown : C.brownPale}`,
                    backgroundColor: selectedFiliere?.id === filiere.id ? C.brownPale : C.surface,
                    cursor:'pointer', transition:'all .2s ease',
                    display:'flex', alignItems:'center', gap:10
                  }}
                >
                  <div style={{
                    width:36, height:36, borderRadius:8, flexShrink:0,
                    background: selectedFiliere?.id === filiere.id
                      ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`
                      : '#E5E7EB',
                    color: selectedFiliere?.id === filiere.id ? 'white' : C.textSec,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:12, fontWeight:900
                  }}>
                    {filiere.code}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ margin:0, fontSize:13, fontWeight:700, color: selectedFiliere?.id === filiere.id ? C.brown : C.text }}>
                      {filiere.nom}
                    </p>
                  </div>
                  {selectedFiliere?.id === filiere.id && <CheckCircle size={16} color={C.brown}/>}
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <BtnBack onClick={prevStep}/>
              <BtnNext disabled={!canNext} onClick={nextStep}/>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* ÉTAPE 4 — Choix du niveau / classe                */}
        {/* ══════════════════════════════════════════════════ */}
        {step === 4 && (
          <div style={{ animation:'slideDown .3s ease' }}>
            <h2 style={{ fontSize:19, fontWeight:900, color:C.text, marginBottom:6 }}>
              Quelle est ta classe ? 📖
            </h2>
            <p style={{ color:C.textSec, fontSize:13, marginBottom:20 }}>
              {selectedCycle?.nom}
              {selectedFiliere ? ` — ${selectedFiliere.nom}` : ''}
            </p>
            <div style={{
              display:'grid',
              gridTemplateColumns: niveauxDisponibles.length > 3 ? 'repeat(2, 1fr)' : '1fr',
              gap:10, marginBottom:24
            }}>
              {niveauxDisponibles.map(niveau => (
                <div key={niveau.id}
                  onClick={() => setSelectedNiveau(niveau)}
                  style={{
                    padding:'14px 16px', borderRadius:12,
                    border:`2px solid ${selectedNiveau?.id === niveau.id ? C.brown : C.brownPale}`,
                    backgroundColor: selectedNiveau?.id === niveau.id ? C.brownPale : C.surface,
                    cursor:'pointer', transition:'all .2s ease',
                    display:'flex', alignItems:'center', gap:12,
                    boxShadow: selectedNiveau?.id === niveau.id ? `0 4px 14px ${C.brown}20` : 'none'
                  }}
                >
                  <div style={{
                    width:40, height:40, borderRadius:10, flexShrink:0,
                    background: selectedNiveau?.id === niveau.id
                      ? `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`
                      : '#E5E7EB',
                    color: selectedNiveau?.id === niveau.id ? 'white' : C.textSec,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:13, fontWeight:900
                  }}>
                    {niveau.code}
                  </div>
                  <p style={{ margin:0, fontSize:14, fontWeight:800, color: selectedNiveau?.id === niveau.id ? C.brown : C.text }}>
                    {niveau.nom}
                  </p>
                  {selectedNiveau?.id === niveau.id && <CheckCircle size={18} color={C.brown} style={{ marginLeft:'auto' }}/>}
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <BtnBack onClick={prevStep}/>
              <BtnNext disabled={!canNext} onClick={nextStep}/>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* ÉTAPE 5 — Choix du pays                           */}
        {/* ══════════════════════════════════════════════════ */}
        {step === 5 && (
          <div style={{ animation:'slideDown .3s ease' }}>
            <h2 style={{ fontSize:19, fontWeight:900, color:C.text, marginBottom:6 }}>
              Dans quel pays es-tu ? 🌍
            </h2>
            <p style={{ color:C.textSec, fontSize:13, marginBottom:20 }}>
              Pour adapter le contenu à ton contexte local
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:24 }}>
              {PAYS.map(p => (
                <div key={p.code}
                  onClick={() => setSelectedPays(p)}
                  style={{
                    padding:'12px 8px', borderRadius:12, textAlign:'center',
                    border:`2px solid ${selectedPays?.code === p.code ? C.brown : C.brownPale}`,
                    backgroundColor: selectedPays?.code === p.code ? C.brownPale : C.surface,
                    cursor:'pointer', transition:'all .2s ease',
                    boxShadow: selectedPays?.code === p.code ? `0 2px 10px ${C.brown}20` : 'none'
                  }}
                >
                  <div style={{ fontSize:24, marginBottom:4 }}>{p.flag}</div>
                  <p style={{ margin:0, fontSize:10, fontWeight:700, color: selectedPays?.code === p.code ? C.brown : C.textSec }}>
                    {p.name}
                  </p>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <BtnBack onClick={prevStep}/>
              <BtnNext disabled={!canNext} onClick={nextStep} label="Voir le récapitulatif"/>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════ */}
        {/* ÉTAPE 6 — Récapitulatif et confirmation           */}
        {/* ══════════════════════════════════════════════════ */}
        {step === 6 && (
          <div style={{ animation:'slideDown .3s ease' }}>
            <h2 style={{ fontSize:19, fontWeight:900, color:C.text, marginBottom:6 }}>
              Presque là ! 🚀
            </h2>
            <p style={{ color:C.textSec, fontSize:13, marginBottom:20 }}>
              Vérifie ton profil avant de commencer
            </p>

            {/* Résumé profil */}
            <div style={{
              background:`linear-gradient(135deg, ${C.brownPale}, ${C.emeraldPale})`,
              borderRadius:16, padding:'20px 24px', marginBottom:16,
              border:`1px solid ${C.brownLight}30`
            }}>
              <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:14 }}>
                <div style={{
                  width:52, height:52, borderRadius:14, flexShrink:0,
                  background:`linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                  color:'white', display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:18, fontWeight:900
                }}>
                  {user?.prenom?.[0]}{user?.nom?.[0]}
                </div>
                <div>
                  <p style={{ margin:0, fontSize:16, fontWeight:900, color:C.text }}>
                    {user?.prenom} {user?.nom}
                  </p>
                  <p style={{ margin:'3px 0 0', fontSize:12, color:C.textSec }}>
                    {user?.email}
                  </p>
                </div>
              </div>

              {[
                { label:'Cycle',    value: selectedCycle?.nom },
                { label:'Ordre',    value: selectedOrdre?.nom,   hide: !selectedOrdre },
                { label:'Filière',  value: selectedFiliere?.nom, hide: !selectedFiliere },
                { label:'Classe',   value: selectedNiveau?.nom },
                { label:'Pays',     value: `${selectedPays?.flag} ${selectedPays?.name}` },
              ].filter(r => !r.hide && r.value).map(row => (
                <div key={row.label} style={{
                  display:'flex', justifyContent:'space-between',
                  padding:'7px 0', borderTop:`1px solid ${C.brownLight}20`
                }}>
                  <span style={{ fontSize:12, color:C.textSec, fontWeight:600 }}>{row.label}</span>
                  <span style={{ fontSize:13, fontWeight:700, color:C.text }}>{row.value}</span>
                </div>
              ))}
            </div>

            {/* Code invitation */}
            <div style={{
              background:`linear-gradient(135deg, ${C.emeraldPale}, ${C.brownPale})`,
              borderRadius:16, padding:'16px 20px', marginBottom:20,
              border:`1px solid ${C.emerald}25`
            }}>
              <p style={{ fontSize:11, fontWeight:800, color:C.emerald, textTransform:'uppercase', letterSpacing:.8, marginBottom:10 }}>
                Ton code d'invitation tuteur
              </p>
              <div style={{
                display:'flex', alignItems:'center', justifyContent:'space-between',
                backgroundColor:'white', borderRadius:10, padding:'12px 16px',
                border:`1px solid ${C.emerald}20`
              }}>
                <span style={{ fontFamily:'monospace', fontSize:20, fontWeight:900, color:C.brown, letterSpacing:3 }}>
                  {user?.code_invitation}
                </span>
                <button onClick={copyCode} style={{
                  backgroundColor: copied ? C.emeraldPale : C.brownPale,
                  border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer',
                  display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700,
                  color: copied ? C.emerald : C.brown, transition:'all .2s ease'
                }}>
                  {copied ? <CheckCircle size={13}/> : <Copy size={13}/>}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>
              <p style={{ fontSize:11, color:C.textSec, marginTop:8 }}>
                Partage ce code à ton enseignant pour qu'il suive ta progression
              </p>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <BtnBack onClick={prevStep}/>
              <button onClick={finish} disabled={loading} style={{
                flex:2, padding:'14px',
                background:`linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                color:'white', border:'none', borderRadius:12,
                fontSize:14, fontWeight:800, cursor: loading ? 'wait' : 'pointer',
                display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                boxShadow:`0 4px 18px ${C.brown}35`, opacity: loading ? .7 : 1
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

// ── Composants boutons réutilisables ──────────────────────────────
function BtnNext({ onClick, disabled, label = 'Continuer →' }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      flex:2, padding:'13px',
      background: disabled
        ? '#E5E7EB'
        : `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
      color: disabled ? C.textSec : 'white',
      border:'none', borderRadius:12, fontSize:14, fontWeight:800,
      cursor: disabled ? 'not-allowed' : 'pointer',
      boxShadow: disabled ? 'none' : `0 4px 18px ${C.brown}35`,
      transition:'all .2s ease',
      display:'flex', alignItems:'center', justifyContent:'center', gap:6
    }}>
      {label} {!disabled && <ChevronRight size={16}/>}
    </button>
  )
}

function BtnBack({ onClick }) {
  return (
    <button onClick={onClick} style={{
      flex:1, padding:'13px',
      background: C.brownPale, color: C.brown,
      border:'none', borderRadius:12, fontSize:14, fontWeight:700, cursor:'pointer'
    }}>
      ← Retour
    </button>
  )
}