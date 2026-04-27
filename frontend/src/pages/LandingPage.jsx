import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
const T = {
  bg:        '#1d0902',
  bgLight:   '#362212',
  surface:   '#342818',
  card:      '#42291e',
  cardHover: '#504124',
  border:    'rgba(255,255,255,0.07)',
  gold:      '#F0B429',
  goldLight: '#FFD060',
  goldPale:  'rgba(240,180,41,0.12)',
  teal:      '#00C9A7',
  tealPale:  'rgba(0,201,167,0.1)',
  coral:     '#FF6B6B',
  coralPale: 'rgba(255,107,107,0.1)',
  sky:       '#38BDF8',
  skyPale:   'rgba(248, 203, 56, 0.1)',
  text:      '#EEF2FF',
  textSec:   '#b09f88',
  textMuted: '#685a4a',
}

const gGold   = `linear-gradient(135deg, ${T.gold}, #E8952A)`
const gTeal   = `linear-gradient(135deg, ${T.teal}, #00A896)`
const gHero   = `linear-gradient(135deg, ${T.gold} 0%, ${T.teal} 50%, ${T.sky} 100%)`
const gCool   = `linear-gradient(135deg, ${T.sky}, #f1c463)`

/* ═══════════════════════════════════════════════════════════════
   HOOKS
═══════════════════════════════════════════════════════════════ */
function useInView(threshold = 0.12) {
  const ref   = useRef(null)
  const [vis, setVis] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVis(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, vis]
}

function useCounter(target, duration = 1800, started = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!started) return
    let start = null
    const step = ts => {
      if (!start) start = ts
      const progress = Math.min((ts - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setVal(Math.floor(ease * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [target, duration, started])
  return val
}

function useTypewriter(words, speed = 80, pause = 2200) {
  const [idx,     setIdx]     = useState(0)
  const [text,    setText]    = useState('')
  const [deleting,setDeleting]= useState(false)

  useEffect(() => {
    const current = words[idx]
    const timeout = setTimeout(() => {
      if (!deleting) {
        setText(current.slice(0, text.length + 1))
        if (text.length === current.length - 1) setTimeout(() => setDeleting(true), pause)
      } else {
        setText(current.slice(0, text.length - 1))
        if (text.length === 1) { setDeleting(false); setIdx((idx + 1) % words.length) }
      }
    }, deleting ? speed / 2 : speed)
    return () => clearTimeout(timeout)
  }, [text, deleting, idx, words, speed, pause])
  return text
}

/* ═══════════════════════════════════════════════════════════════
   ANIMATED ORBS BACKGROUND
═══════════════════════════════════════════════════════════════ */
function OrbsBackground() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position:'absolute', width:600, height:600, borderRadius:'50%', top:'-15%', left:'-10%', background:`radial-gradient(circle, ${T.gold}18 0%, transparent 70%)`, animation:'orbFloat1 12s ease-in-out infinite' }}/>
      <div style={{ position:'absolute', width:500, height:500, borderRadius:'50%', top:'20%', right:'-8%', background:`radial-gradient(circle, ${T.teal}14 0%, transparent 70%)`, animation:'orbFloat2 15s ease-in-out infinite' }}/>
      <div style={{ position:'absolute', width:400, height:400, borderRadius:'50%', bottom:'-10%', left:'30%', background:`radial-gradient(circle, ${T.sky}12 0%, transparent 70%)`, animation:'orbFloat3 18s ease-in-out infinite' }}/>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   GRID LINES BACKGROUND
═══════════════════════════════════════════════════════════════ */
function GridBg({ opacity = 0.03 }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage: `linear-gradient(${T.text}20 1px, transparent 1px), linear-gradient(90deg, ${T.text}20 1px, transparent 1px)`,
      backgroundSize: '60px 60px',
      opacity,
    }}/>
  )
}

/* ═══════════════════════════════════════════════════════════════
   BADGE
═══════════════════════════════════════════════════════════════ */
function Badge({ children, color = T.gold }) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'5px 14px', borderRadius:40, border:`1px solid ${color}40`, backgroundColor:`${color}12`, marginBottom:18 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', backgroundColor:color, animation:'pulse 2s infinite' }}/>
      <span style={{ fontSize:11, fontWeight:700, color, textTransform:'uppercase', letterSpacing:'1px' }}>{children}</span>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   NAVBAR
═══════════════════════════════════════════════════════════════ */
function Navbar({ onLogin }) {
  const [scrolled,       setScrolled]       = useState(false)
  const [mobileOpen,     setMobileOpen]     = useState(false)
  const [activeSection,  setActiveSection]  = useState('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const links = ['Fonctionnalités', 'Comment ça marche', 'Niveaux', 'Témoignages']

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      padding: scrolled ? '10px 24px' : '18px 24px',
      background: scrolled ? 'rgba(40, 29, 13, 0.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? `1px solid ${T.border}` : 'none',
      transition: 'all 0.35s cubic-bezier(.4,0,.2,1)',
    }}>
      <div style={{ maxWidth:1200, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between' }}>

        {/* Logo */}
        <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={() => window.scrollTo({top:0, behavior:'smooth'})}>
          <div style={{ width:36, height:36, borderRadius:10, background:gGold, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, boxShadow:`0 0 20px ${T.gold}40` }}>
            🧠</div>
          <div>
            <span style={{ fontSize:17, fontWeight:800, color:T.text }}>SenSia</span>
            <span style={{ fontSize:15, fontWeight:800, background:gHero, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}> StudS</span>
          </div>
        </div>

        {/* Desktop links */}
        <div className="nav-links" style={{ display:'flex', alignItems:'center', gap:28 }}>
          {links.map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-').replace(/é/g,'e').replace(/è/g,'e').replace(/ç/g,'c').replace(/à/g,'a')}`}
              style={{ fontSize:13, fontWeight:600, color:T.textSec, textDecoration:'none', transition:'color .2s' }}
              onMouseEnter={e => e.target.style.color = T.gold}
              onMouseLeave={e => e.target.style.color = T.textSec}
            >{l}</a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="nav-ctas" style={{ display:'flex', gap:10 }}>
          <button onClick={onLogin} style={{ padding:'8px 20px', borderRadius:40, border:`1px solid ${T.border}`, background:'rgba(255,255,255,0.04)', color:T.text, fontSize:13, fontWeight:600, cursor:'pointer', transition:'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.gold+'60'; e.currentTarget.style.color = T.gold }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border;   e.currentTarget.style.color = T.text }}>
            Connexion
          </button>
          <button onClick={onLogin} style={{ padding:'8px 22px', borderRadius:40, border:'none', background:gGold, color:'#0D1628', fontSize:13, fontWeight:800, cursor:'pointer', boxShadow:`0 4px 18px ${T.gold}35`, transition:'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; e.currentTarget.style.boxShadow=`0 6px 24px ${T.gold}55` }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';   e.currentTarget.style.boxShadow=`0 4px 18px ${T.gold}35` }}>
            Commencer maintenant
          </button>
        </div>

        {/* Burger */}
        <button className="burger" onClick={() => setMobileOpen(v => !v)} style={{ display:'none', background:'none', border:'none', cursor:'pointer', flexDirection:'column', gap:5, padding:4 }}>
          {[0,1,2].map(i => <div key={i} style={{ width:22, height:2, background:T.text, borderRadius:2 }}/>)}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div style={{ marginTop:16, padding:'16px 0', borderTop:`1px solid ${T.border}`, display:'flex', flexDirection:'column', gap:16 }}>
          {links.map(l => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-')}`}
              style={{ fontSize:15, fontWeight:600, color:T.textSec, textDecoration:'none' }}
              onClick={() => setMobileOpen(false)}>{l}</a>
          ))}
          <div style={{ display:'flex', gap:10, marginTop:8 }}>
            <button onClick={onLogin} style={{ flex:1, padding:'11px', borderRadius:40, border:`1px solid ${T.border}`, background:'transparent', color:T.text, fontSize:13, fontWeight:600, cursor:'pointer' }}>Connexion</button>
            <button onClick={onLogin} style={{ flex:1, padding:'11px', borderRadius:40, border:'none', background:gGold, color:'#0D1628', fontSize:13, fontWeight:700, cursor:'pointer' }}>Commencer</button>
          </div>
        </div>
      )}
    </nav>
  )
}

/* ═══════════════════════════════════════════════════════════════
   HERO
═══════════════════════════════════════════════════════════════ */
function HeroSection({ onLogin }) {
  const typed = useTypewriter(['brillamment', 'efficacement', 'à ton rythme', 'avec l\'IA'], 75, 2000)
  const [show, setShow] = useState(false)
  useEffect(() => { setTimeout(() => setShow(true), 100) }, [])

  return (
    <section style={{ minHeight:'100vh', background:T.bg, display:'flex', alignItems:'center', justifyContent:'center', padding:'120px 24px 80px', position:'relative', overflow:'hidden' }}>
      <OrbsBackground/>
      <GridBg opacity={0.025}/>

      {/* Adinkra SVG subtil */}
      <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', opacity:.03, pointerEvents:'none' }} aria-hidden="true">
        <defs>
          <pattern id="adk-lp" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
            <circle cx="40" cy="40" r="14" fill="none" stroke="white" strokeWidth="1.2"/>
            <circle cx="40" cy="40" r="6"  fill="none" stroke="white" strokeWidth="1.2"/>
            <line x1="40" y1="26" x2="40" y2="16" stroke="white" strokeWidth="1.2"/>
            <line x1="40" y1="54" x2="40" y2="64" stroke="white" strokeWidth="1.2"/>
            <line x1="26" y1="40" x2="16" y2="40" stroke="white" strokeWidth="1.2"/>
            <line x1="54" y1="40" x2="64" y2="40" stroke="white" strokeWidth="1.2"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#adk-lp)"/>
      </svg>

      <div style={{ maxWidth:900, width:'100%', textAlign:'center', position:'relative', zIndex:2 }}>

        <div style={{ opacity: show?1:0, transform: show?'translateY(0)':'translateY(24px)', transition:'all .7s cubic-bezier(.22,1,.36,1)' }}>
          <Badge color={T.teal}>🚀 STI ADAPTATIF · Analyse Multimodale</Badge>
        </div>

        <h1 style={{
          fontSize:'clamp(38px, 7vw, 76px)', fontWeight:900, lineHeight:1.08,
          letterSpacing:'-2px', color:T.text, marginBottom:10,
          opacity: show?1:0, transform: show?'translateY(0)':'translateY(32px)',
          transition:'all .7s .1s cubic-bezier(.22,1,.36,1)',
        }}>
          Apprends
          <br/>
          <span style={{ background:gHero, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            {typed}<span style={{ animation:'blink 1s step-end infinite', opacity:.8 }}>|</span>
          </span>
        </h1>

        <p style={{
          fontSize:'clamp(15px, 2.5vw, 19px)', color:T.textSec, maxWidth:580, margin:'20px auto 36px', lineHeight:1.7,
          opacity: show?1:0, transform: show?'translateY(0)':'translateY(24px)',
          transition:'all .7s .2s cubic-bezier(.22,1,.36,1)',
        }}>
          L'IA qui s'adapte à ton niveau, mesure ta progression en temps réel et t'accompagne sur tout le programme NSI/Informatique du Cameroun. <strong style={{color:T.text}}>100% gratuit.</strong>
        </p>

        <div style={{
          display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap',
          opacity: show?1:0, transform: show?'translateY(0)':'translateY(24px)',
          transition:'all .7s .3s cubic-bezier(.22,1,.36,1)',
        }}>
          <button onClick={onLogin} style={{ padding:'14px 34px', borderRadius:50, border:'none', background:gGold, color:'#0D1628', fontSize:15, fontWeight:800, cursor:'pointer', boxShadow:`0 6px 28px ${T.gold}45`, transition:'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 10px 36px ${T.gold}60` }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';   e.currentTarget.style.boxShadow=`0 6px 28px ${T.gold}45` }}>
            🎯 Créer mon compte gratuit
          </button>
          <button onClick={onLogin} style={{ padding:'14px 28px', borderRadius:50, border:`1.5px solid ${T.border}`, background:'rgba(255,255,255,0.04)', color:T.text, fontSize:15, fontWeight:600, cursor:'pointer', transition:'all .2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.teal+'60'}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
            ▶ Voir une démo
          </button>
        </div>

        {/* Social proof */}
        <div style={{
          marginTop:52, display:'flex', alignItems:'center', justifyContent:'center', gap:24, flexWrap:'wrap',
          opacity: show?1:0, transition:'opacity .7s .5s',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ display:'flex' }}>
              {['👩‍🎓','🧑‍💻','👨‍🏫','🎓','👩‍💼'].map((e,i) => (
                <div key={i} style={{ width:32, height:32, borderRadius:'50%', border:`2px solid ${T.bg}`, background:T.card, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, marginLeft:i?-10:0 }}>{e}</div>
              ))}
            </div>
            <div>
              <p style={{ fontSize:13, fontWeight:700, color:T.text, margin:0 }}>+200 apprenants</p>
              <p style={{ fontSize:11, color:T.textSec, margin:0 }}>nous font confiance</p>
            </div>
          </div>
          <div style={{ width:1, height:36, background:T.border }}/>
          <div style={{ display:'flex', gap:2 }}>
            {'⭐⭐⭐⭐⭐'.split('').map((s,i) => <span key={i} style={{ fontSize:14 }}>{s}</span>)}
            <span style={{ fontSize:13, fontWeight:700, color:T.text, marginLeft:6 }}>4.9/5</span>
          </div>
          <div style={{ width:1, height:36, background:T.border }}/>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:T.teal, display:'inline-block', animation:'pulse 2s infinite' }}/>
            <span style={{ fontSize:12, fontWeight:600, color:T.textSec }}>Disponible maintenant · Gratuit</span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div style={{ position:'absolute', bottom:32, left:'50%', transform:'translateX(-50%)', display:'flex', flexDirection:'column', alignItems:'center', gap:6, opacity:.4 }}>
        <span style={{ fontSize:10, fontWeight:600, color:T.textSec, letterSpacing:'2px', textTransform:'uppercase' }}>Défiler</span>
        <div style={{ width:1, height:32, background:`linear-gradient(to bottom, ${T.textSec}, transparent)`, animation:'scrollPulse 2s ease-in-out infinite' }}/>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   STATS ANIMATED COUNTER
═══════════════════════════════════════════════════════════════ */
function StatItem({ target, suffix, label, icon, started }) {
  const val = useCounter(target, 1800, started)
  return (
    <div style={{ textAlign:'center', padding:'0 16px' }}>
      <div style={{ fontSize:28, marginBottom:6 }}>{icon}</div>
      <p style={{ fontSize:'clamp(32px, 5vw, 48px)', fontWeight:900, color:T.text, margin:'0 0 4px', lineHeight:1, fontVariantNumeric:'tabular-nums' }}>
        <span style={{ background:gHero, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{val}{suffix}</span>
      </p>
      <p style={{ fontSize:12, color:T.textSec, margin:0, fontWeight:600, textTransform:'uppercase', letterSpacing:'.8px' }}>{label}</p>
    </div>
  )
}

function StatsSection() {
  const [ref, vis] = useInView(0.3)
  const stats = [
    { target:200, suffix:'+', label:'Apprenants actifs',  icon:'🎓' },
    { target:3,   suffix:'',  label:'Niveaux scolaires',  icon:'📚' },
    { target:100, suffix:'%', label:'Gratuit pour tous',  icon:'🎁' },
    { target:99,  suffix:'%', label:'Satisfaction',       icon:'⭐' },
  ]
  return (
    <section ref={ref} style={{ background:T.bgLight, padding:'56px 24px', borderTop:`1px solid ${T.border}`, borderBottom:`1px solid ${T.border}` }}>
      <div style={{ maxWidth:900, margin:'0 auto', display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px, 1fr))', gap:32 }}>
        {stats.map(s => <StatItem key={s.label} {...s} started={vis}/>)}
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FEATURES
═══════════════════════════════════════════════════════════════ */
function FeaturesSection() {
  const [ref, vis] = useInView()

  const features = [
    { icon:'🤖', title:'IA adaptative', desc:'Le système apprend de toi. Chaque exercice est choisi en fonction de ta maîtrise réelle, mesurée en temps réel par le modèle BKT.', color:T.gold, delay:0 },
    { icon:'👁️', title:'Détection d\'attention', desc:'Grâce à MediaPipe, la caméra analyse ton niveau d\'attention pour alerter l\'enseignant si tu décroches.', color:T.teal, delay:.1 },
    { icon:'🎮', title:'Gamification', desc:'Points XP, badges débloquables, classement de classe. Apprendre devient aussi engageant qu\'un jeu.', color:T.coral, delay:.15 },
    { icon:'💡', title:'Indices progressifs', desc:'Bloqué sur un exercice ? 3 niveaux d\'indices sont disponibles, du plus léger au plus détaillé.', color:T.sky, delay:.2 },
    { icon:'📊', title:'Tableau de bord', desc:'L\'enseignant voit la progression de chaque élève en temps réel et peut personnaliser les parcours.', color:'#A78BFA', delay:.25 },
    { icon:'📱', title:'100% responsive', desc:'Fonctionne parfaitement sur mobile, tablette et ordinateur. Apprends partout, tout le temps.', color:'#FB923C', delay:.3 },
  ]

  return (
    <section id="fonctionnalites" ref={ref} style={{ background:T.bg, padding:'80px 24px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:56, opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(28px)', transition:'all .6s ease' }}>
          <Badge color={T.gold}>✨ Super pouvoirs</Badge>
          <h2 style={{ fontSize:'clamp(28px, 5vw, 44px)', fontWeight:900, color:T.text, margin:'0 0 14px', letterSpacing:'-1px' }}>
            Ce qui rend EduSmart unique
          </h2>
          <p style={{ fontSize:16, color:T.textSec, maxWidth:480, margin:'0 auto', lineHeight:1.6 }}>
            Une stack technologique moderne au service de l'apprentissage africain.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(300px, 1fr))', gap:20 }}>
          {features.map(f => (
            <div key={f.title}
              style={{
                background:T.card, borderRadius:20, padding:'28px 26px',
                border:`1px solid ${T.border}`,
                opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(32px)',
                transition:`all .6s ${f.delay}s ease`,
                cursor:'default',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = T.cardHover; e.currentTarget.style.borderColor = f.color+'50'; e.currentTarget.style.transform = 'translateY(-4px)' }}
              onMouseLeave={e => { e.currentTarget.style.background = T.card;      e.currentTarget.style.borderColor = T.border;       e.currentTarget.style.transform = 'translateY(0)' }}
            >
              <div style={{ width:52, height:52, borderRadius:14, background:`${f.color}18`, border:`1px solid ${f.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, marginBottom:18 }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize:18, fontWeight:800, color:T.text, margin:'0 0 10px' }}>{f.title}</h3>
              <p  style={{ fontSize:14, color:T.textSec, lineHeight:1.65, margin:0 }}>{f.desc}</p>
              <div style={{ marginTop:18, display:'flex', alignItems:'center', gap:6, fontSize:12, fontWeight:700, color:f.color }}>
                <span style={{ width:16, height:1.5, background:f.color, borderRadius:2 }}/>
                En savoir plus
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   HOW IT WORKS  (nouvelle section)
═══════════════════════════════════════════════════════════════ */
function HowItWorksSection({ onLogin }) {
  const [ref, vis] = useInView(0.1)

  const steps = [
    { num:'01', icon:'📝', title:'Crée ton compte', desc:'Inscription en 30 secondes. Aucune carte bancaire, aucun engagement. Tu choisis ton niveau et ta filière.', color:T.gold },
    { num:'02', icon:'🎯', title:'Évalue ton niveau', desc:'Un test rapide permet à l\'IA de calibrer ton point de départ et de construire ton parcours personnalisé.', color:T.teal },
    { num:'03', icon:'⚡', title:'Pratique avec l\'IA', desc:'Des exercices interactifs, des indices intelligents, des corrections détaillées. L\'IA s\'adapte à chaque bonne ou mauvaise réponse.', color:T.sky },
    { num:'04', icon:'🏆', title:'Mesure ta progression', desc:'Badges, points XP, courbe de progression — tu vois clairement ce que tu maîtrises et ce qu\'il reste à conquérir.', color:T.coral },
  ]

  return (
    <section id="comment-ca-marche" ref={ref} style={{ background:T.bgLight, padding:'80px 24px', position:'relative', overflow:'hidden' }}>
      <GridBg opacity={0.02}/>
      <div style={{ maxWidth:1000, margin:'0 auto', position:'relative', zIndex:1 }}>

        <div style={{ textAlign:'center', marginBottom:60, opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(28px)', transition:'all .6s ease' }}>
          <Badge color={T.teal}>🗺️ Processus</Badge>
          <h2 style={{ fontSize:'clamp(28px, 5vw, 44px)', fontWeight:900, color:T.text, margin:'0 0 14px', letterSpacing:'-1px' }}>Comment ça marche ?</h2>
          <p style={{ fontSize:16, color:T.textSec, maxWidth:440, margin:'0 auto' }}>4 étapes simples pour transformer ton apprentissage.</p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:8, position:'relative' }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{
              display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center', padding:'28px 20px',
              opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(40px)',
              transition:`all .6s ${i*.12}s ease`,
            }}>
              {/* Circle */}
              <div style={{ width:80, height:80, borderRadius:'50%', background:T.card, border:`2px solid ${s.color}50`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, marginBottom:16, position:'relative', boxShadow:`0 0 32px ${s.color}20` }}>
                {s.icon}
                <div style={{ position:'absolute', top:-10, right:-8, width:28, height:28, borderRadius:'50%', background:s.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:900, color:'#0D1628' }}>{s.num}</div>
              </div>
              {/* Connector */}
              {i < steps.length - 1 && (
                <div style={{ position:'absolute', top:60, left:`calc(${(i+1) * 25}% - 4px)`, width:'25%', height:2, background:`linear-gradient(90deg, ${s.color}60, ${steps[i+1].color}60)`, display:'none' }} className="step-connector"/>
              )}
              <h3 style={{ fontSize:17, fontWeight:800, color:T.text, margin:'0 0 10px' }}>{s.title}</h3>
              <p  style={{ fontSize:13, color:T.textSec, lineHeight:1.65, margin:0 }}>{s.desc}</p>
            </div>
          ))}
        </div>

        <div style={{ textAlign:'center', marginTop:48, opacity:vis?1:0, transition:'opacity .6s .5s' }}>
          <button onClick={onLogin} style={{ padding:'13px 32px', borderRadius:50, border:`1.5px solid ${T.gold}50`, background:T.goldPale, color:T.gold, fontSize:14, fontWeight:700, cursor:'pointer', transition:'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.background=gGold; e.currentTarget.style.color='#0D1628'; e.currentTarget.style.borderColor='transparent' }}
            onMouseLeave={e => { e.currentTarget.style.background=T.goldPale; e.currentTarget.style.color=T.gold; e.currentTarget.style.borderColor=T.gold+'50' }}>
            Commencer maintenant →
          </button>
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TECHNOLOGY STACK  (nouvelle section)
═══════════════════════════════════════════════════════════════ */
function TechSection() {
  const [ref, vis] = useInView()
  const techs = [
    { name:'BKT Model', desc:'Bayesian Knowledge Tracing', icon:'🧮', color:T.gold },
    { name:'MediaPipe', desc:'Détection d\'attention IA', icon:'👁️', color:T.teal },
    { name:'FastAPI',   desc:'Backend performant',       icon:'⚡', color:T.sky },
    { name:'React',     desc:'Interface réactive',       icon:'⚛️', color:'#61DAFB' },
    { name:'PostgreSQL',desc:'Base de données robuste',  icon:'🗄️', color:'#4EA8DE' },
    { name:'Programme APC', desc:'Contenu certifié',    icon:'📋', color:T.coral },
  ]
  return (
    <section ref={ref} style={{ background:T.bg, padding:'60px 24px' }}>
      <div style={{ maxWidth:1000, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:40, opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(24px)', transition:'all .5s ease' }}>
          <Badge color={T.sky}>⚙️ Stack technologique</Badge>
          <h2 style={{ fontSize:'clamp(24px, 4vw, 36px)', fontWeight:900, color:T.text, margin:0, letterSpacing:'-.8px' }}>Bâti avec les meilleures technologies</h2>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(150px, 1fr))', gap:16 }}>
          {techs.map((t, i) => (
            <div key={t.name} style={{
              background:T.card, borderRadius:16, padding:'22px 16px', textAlign:'center',
              border:`1px solid ${T.border}`,
              opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(24px)',
              transition:`all .5s ${i*.07}s ease`,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = t.color+'60'; e.currentTarget.style.background = T.cardHover }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.border;    e.currentTarget.style.background = T.card }}>
              <div style={{ fontSize:28, marginBottom:10 }}>{t.icon}</div>
              <p style={{ fontSize:13, fontWeight:800, color:T.text, margin:'0 0 4px' }}>{t.name}</p>
              <p style={{ fontSize:11, color:T.textSec, margin:0 }}>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   NIVEAUX
═══════════════════════════════════════════════════════════════ */
function NiveauxSection({ onLogin }) {
  const [ref, vis] = useInView()
  const niveaux = [
    { name:'Seconde',   icon:'🌱', color:T.teal,  badge:'Fondations', desc:'Algorithmique, variables, structures de base et initiation à la programmation.', modules:['Algorithmique de base','Structures conditionnelles','Initiation au C','Logique booléenne'], popular:false, delay:0 },
    { name:'Première',  icon:'⚡', color:T.gold,  badge:'Populaire ·  le plus actif', desc:'Structures de données, programmation en C, réseaux et systèmes.', modules:['Programmation en C','Structures de données','Réseaux fondamentaux','Systèmes d\'exploitation'], popular:true,  delay:.1 },
    { name:'Terminale', icon:'🏆', color:T.coral, badge:'Expert',    desc:'SQL, modèle relationnel, algorithmes avancés et projets transversaux.', modules:['SQL & bases de données','Modèle relationnel','Algorithmes avancés','Projets transversaux'], popular:false, delay:.2 },
  ]
  return (
    <section id="niveaux" ref={ref} style={{ background:T.bgLight, padding:'80px 24px' }}>
      <div style={{ maxWidth:1050, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:56, opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(28px)', transition:'all .6s ease' }}>
          <Badge color={T.coral}>📖 Parcours</Badge>
          <h2 style={{ fontSize:'clamp(28px, 5vw, 44px)', fontWeight:900, color:T.text, margin:'0 0 14px', letterSpacing:'-1px' }}>Choisis ton niveau</h2>
          <p style={{ fontSize:16, color:T.textSec, maxWidth:440, margin:'0 auto' }}>Du programme de Seconde à la Terminale, chaque niveau est couvert.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(290px, 1fr))', gap:20 }}>
          {niveaux.map(n => (
            <div key={n.name} style={{
              borderRadius:24, padding:'30px 26px', position:'relative',
              background: n.popular ? `linear-gradient(160deg, #1A2B4A, ${T.card})` : T.card,
              border: `1px solid ${n.popular ? n.color+'60' : T.border}`,
              boxShadow: n.popular ? `0 0 40px ${n.color}15` : 'none',
              opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(40px)',
              transition:`all .6s ${n.delay}s ease`,
            }}>
              {n.popular && (
                <div style={{ position:'absolute', top:-14, left:'50%', transform:'translateX(-50%)', background:gGold, color:'#0D1628', fontSize:10, fontWeight:900, padding:'5px 16px', borderRadius:40, whiteSpace:'nowrap' }}>
                  🔥 Le plus populaire
                </div>
              )}
              <div style={{ fontSize:36, marginBottom:14 }}>{n.icon}</div>
              <h3 style={{ fontSize:26, fontWeight:900, color:T.text, margin:'0 0 2px' }}>{n.name}</h3>
              <p  style={{ fontSize:11, fontWeight:700, color:n.color, marginBottom:14, textTransform:'uppercase', letterSpacing:'.8px' }}>{n.badge}</p>
              <p  style={{ fontSize:13, color:T.textSec, lineHeight:1.6, marginBottom:20 }}>{n.desc}</p>
              <div style={{ marginBottom:24, display:'flex', flexDirection:'column', gap:8 }}>
                {n.modules.map(m => (
                  <div key={m} style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <div style={{ width:18, height:18, borderRadius:'50%', background:`${n.color}22`, border:`1.5px solid ${n.color}50`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <span style={{ fontSize:9, color:n.color, fontWeight:900 }}>✓</span>
                    </div>
                    <span style={{ fontSize:13, color:T.textSec }}>{m}</span>
                  </div>
                ))}
              </div>
              <button onClick={onLogin} style={{
                width:'100%', padding:'12px',
                background: n.popular ? gGold : `${n.color}18`,
                border: n.popular ? 'none' : `1.5px solid ${n.color}40`,
                borderRadius:12, color: n.popular ? '#0D1628' : n.color,
                fontSize:14, fontWeight:800, cursor:'pointer', transition:'all .2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-1px)'; if (!n.popular) { e.currentTarget.style.background=n.color+'30' } }}
              onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';   if (!n.popular) { e.currentTarget.style.background=n.color+'18' } }}>
                {n.popular ? '🔥 Commencer maintenant' : `Explorer la ${n.name} →`}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TESTIMONIALS
═══════════════════════════════════════════════════════════════ */
function TestimonialsSection() {
  const [ref, vis] = useInView()
  const [active, setActive] = useState(0)

  const testimonials = [
    { name:'Sarah Mboua', role:'Lycéenne · Terminale D', text:'EduSmart m\'a permis de passer de la moyenne à 16 en informatique en 3 semaines. Les exercices adaptatifs sont vraiment efficaces.', rating:5, avatar:'👩‍🎓', school:'Lycée de Mendong' },
    { name:'Prof. Emmanuel N.', role:'Enseignant NSI · 12 ans d\'expérience', text:'Le tableau de bord me permet de suivre chaque élève en temps réel. Je peux intervenir avant même qu\'ils décrochent.', rating:5, avatar:'👨‍🏫', school:'ENSET Ebolowa' },
    { name:'David Kamga', role:'Étudiant · Première C', text:'Les indices progressifs sont géniaux. Je n\'ai jamais l\'impression d\'être bloqué car l\'aide arrive exactement au bon moment.', rating:5, avatar:'🧑‍💻', school:'Lycée Général Leclerc' },
    { name:'Fatima Oumarou', role:'Étudiante · Seconde', text:'J\'avais peur de l\'algorithmique mais avec EduSmart, les concepts s\'apprennent à travers des exercices ludiques. C\'est addictif !', rating:5, avatar:'👩‍💼', school:'Lycée de Ngoa-Ekele' },
  ]

  useEffect(() => {
    if (!vis) return
    const t = setInterval(() => setActive(a => (a + 1) % testimonials.length), 4500)
    return () => clearInterval(t)
  }, [vis, testimonials.length])

  return (
    <section id="temoignages" ref={ref} style={{ background:T.bg, padding:'80px 24px' }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:52, opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(28px)', transition:'all .6s ease' }}>
          <Badge color={T.sky}>💬 Témoignages</Badge>
          <h2 style={{ fontSize:'clamp(28px, 5vw, 44px)', fontWeight:900, color:T.text, margin:'0 0 14px', letterSpacing:'-1px' }}>+200 apprenants conquis</h2>
          <p style={{ fontSize:16, color:T.textSec }}>Ils ont transformé leur rapport à l'apprentissage.</p>
        </div>

        {/* Featured testimonial */}
        <div style={{ background:T.card, borderRadius:24, padding:'36px', border:`1px solid ${T.border}`, marginBottom:20, minHeight:200, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:20, right:28, fontSize:64, opacity:.06, lineHeight:1 }}>"</div>
          <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:20 }}>
            <div style={{ width:52, height:52, borderRadius:'50%', background:gHero, display:'flex', alignItems:'center', justifyContent:'center', fontSize:26 }}>
              {testimonials[active].avatar}
            </div>
            <div>
              <p style={{ fontSize:15, fontWeight:800, color:T.text, margin:0 }}>{testimonials[active].name}</p>
              <p style={{ fontSize:12, color:T.gold, margin:'2px 0 0', fontWeight:600 }}>{testimonials[active].role}</p>
              <p style={{ fontSize:11, color:T.textMuted, margin:'1px 0 0' }}>{testimonials[active].school}</p>
            </div>
            <div style={{ marginLeft:'auto', display:'flex', gap:2 }}>
              {'⭐'.repeat(testimonials[active].rating).split('').map((s,i) => <span key={i} style={{ fontSize:13 }}>{s}</span>)}
            </div>
          </div>
          <p style={{ fontSize:16, color:T.textSec, lineHeight:1.7, margin:0, fontStyle:'italic' }}>"{testimonials[active].text}"</p>
        </div>

        {/* Dots */}
        <div style={{ display:'flex', justifyContent:'center', gap:8 }}>
          {testimonials.map((_,i) => (
            <button key={i} onClick={() => setActive(i)} style={{ width: i===active?24:8, height:8, borderRadius:4, background: i===active ? T.gold : T.border, border:'none', cursor:'pointer', transition:'all .3s ease', padding:0 }}/>
          ))}
        </div>

        {/* Mini cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:14, marginTop:24 }}>
          {testimonials.map((t,i) => (
            <div key={t.name} onClick={() => setActive(i)} style={{
              background: i===active ? T.cardHover : T.card,
              border:`1px solid ${i===active ? T.gold+'40' : T.border}`,
              borderRadius:16, padding:'16px', cursor:'pointer',
              transition:'all .25s ease',
              opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(24px)',
              transitionDelay:`${.3 + i*.07}s`,
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                <span style={{ fontSize:22 }}>{t.avatar}</span>
                <div>
                  <p style={{ fontSize:12, fontWeight:800, color:T.text, margin:0 }}>{t.name}</p>
                  <p style={{ fontSize:10, color:T.textSec, margin:0 }}>{t.role.split('·')[0].trim()}</p>
                </div>
              </div>
              <p style={{ fontSize:12, color:T.textSec, margin:0, lineHeight:1.5, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                "{t.text}"
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FAQ
═══════════════════════════════════════════════════════════════ */
function FAQSection() {
  const [ref, vis] = useInView()
  const [open, setOpen] = useState(null)

  const faqs = [
    { q:'C\'est vraiment 100% gratuit ?', a:'Oui, sans exception. Pas de freemium, pas de carte bancaire. L\'éducation de qualité doit être accessible à tous les lycéens camerounais.' },
    { q:'Le contenu suit le programme officiel camerounais ?', a:'Absolument. Chaque exercice et chapitre est aligné sur le programme APC (Approche Par Compétences) en vigueur au Cameroun, validé avec des enseignants certifiés.' },
    { q:'Comment l\'IA mesure ma progression ?', a:'Grâce au modèle BKT (Bayesian Knowledge Tracing), chaque bonne ou mauvaise réponse met à jour une probabilité de maîtrise par compétence. Le système choisit ensuite les exercices optimaux.' },
    { q:'Ai-je besoin d\'une webcam ?', a:'Non. La webcam est optionnelle et sert uniquement pour l\'analyse d\'attention. Toutes les autres fonctionnalités fonctionnent sans caméra.' },
    { q:'Les enseignants peuvent-ils accéder à l\'outil ?', a:'Oui ! Un espace enseignant dédié permet de suivre la progression de chaque élève, d\'assigner des parcours et de recevoir des alertes en temps réel.' },
    { q:'Sur quels appareils puis-je utiliser EduSmart ?', a:'Sur tous ! L\'application est responsive et fonctionne sur ordinateur, tablette et smartphone. Chrome, Firefox et Edge sont supportés.' },
  ]

  return (
    <section ref={ref} style={{ background:T.bgLight, padding:'80px 24px' }}>
      <div style={{ maxWidth:760, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:52, opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(28px)', transition:'all .6s ease' }}>
          <Badge color={T.sky}>❓ FAQ</Badge>
          <h2 style={{ fontSize:'clamp(28px, 5vw, 40px)', fontWeight:900, color:T.text, margin:'0 0 14px', letterSpacing:'-1px' }}>On répond à tout</h2>
          <p style={{ fontSize:16, color:T.textSec }}>Toutes les réponses aux questions fréquentes.</p>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {faqs.map((f,i) => (
            <div key={i} style={{
              background:T.card, borderRadius:16, overflow:'hidden',
              border:`1px solid ${open===i ? T.gold+'40' : T.border}`,
              opacity:vis?1:0, transform:vis?'translateY(0)':'translateY(20px)',
              transition:`all .5s ${i*.06}s ease`,
            }}>
              <button onClick={() => setOpen(open===i ? null : i)} style={{
                width:'100%', padding:'18px 22px', display:'flex', justifyContent:'space-between', alignItems:'center',
                background:'none', border:'none', cursor:'pointer',
              }}>
                <span style={{ fontSize:15, fontWeight:700, color:T.text, textAlign:'left', lineHeight:1.4 }}>{f.q}</span>
                <div style={{ width:24, height:24, borderRadius:'50%', background: open===i ? T.goldPale : T.surface, border:`1px solid ${open===i ? T.gold+'50' : T.border}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginLeft:12, transition:'all .2s' }}>
                  <span style={{ fontSize:14, color: open===i ? T.gold : T.textSec, fontWeight:700, lineHeight:1 }}>{open===i?'−':'+'}</span>
                </div>
              </button>
              <div style={{ maxHeight: open===i?200:0, overflow:'hidden', transition:'max-height .35s ease' }}>
                <p style={{ fontSize:14, color:T.textSec, lineHeight:1.7, padding:'0 22px 20px', margin:0 }}>{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   CTA FINAL
═══════════════════════════════════════════════════════════════ */
function CTASection({ onLogin }) {
  const [ref, vis] = useInView(0.2)
  return (
    <section ref={ref} style={{ background:T.bg, padding:'80px 24px', position:'relative', overflow:'hidden' }}>
      <OrbsBackground/>
      <GridBg opacity={0.02}/>
      <div style={{
        maxWidth:700, margin:'0 auto', textAlign:'center', position:'relative', zIndex:2,
        opacity:vis?1:0, transform:vis?'scale(1)':'scale(.97)',
        transition:'all .7s cubic-bezier(.22,1,.36,1)',
      }}>
        <div style={{ width:72, height:72, borderRadius:22, background:gGold, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 24px', boxShadow:`0 8px 32px ${T.gold}40` }}>🧠</div>
        <h2 style={{ fontSize:'clamp(30px, 5vw, 52px)', fontWeight:900, color:T.text, margin:'0 0 16px', letterSpacing:'-1.5px' }}>
          Prêt à transformer<br/>ton apprentissage ?
        </h2>
        <p style={{ fontSize:17, color:T.textSec, margin:'0 auto 36px', maxWidth:480, lineHeight:1.7 }}>
          Rejoins la première plateforme de tutorat IA adaptée au programme camerounais. Gratuit pour toujours.
        </p>
        <div style={{ display:'flex', gap:14, justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={onLogin} style={{ padding:'15px 40px', borderRadius:50, border:'none', background:gGold, color:'#0D1628', fontSize:16, fontWeight:900, cursor:'pointer', boxShadow:`0 8px 32px ${T.gold}40`, transition:'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow=`0 12px 40px ${T.gold}55` }}
            onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)';   e.currentTarget.style.boxShadow=`0 8px 32px ${T.gold}40` }}>
            ✨ Créer mon compte — c'est gratuit
          </button>
          <button onClick={onLogin} style={{ padding:'15px 28px', borderRadius:50, border:`1.5px solid ${T.border}`, background:'rgba(255,255,255,0.04)', color:T.text, fontSize:15, fontWeight:600, cursor:'pointer', transition:'all .2s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.teal+'60'}
            onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
            Se connecter
          </button>
        </div>
        <p style={{ fontSize:11, color:T.textMuted, marginTop:20, letterSpacing:'.5px' }}>
          Aucune carte · Accès immédiat · Programme camerounais certifié
        </p>
      </div>
    </section>
  )
}

/* ═══════════════════════════════════════════════════════════════
   FOOTER
═══════════════════════════════════════════════════════════════ */
function Footer() {
  const cols = [
    { title:'Produit',    links:['Fonctionnalités','Comment ça marche','Niveaux','Témoignages'] },
    { title:'Ressources', links:['FAQ','Documentation','Blog','Changelog'] },
    { title:'Académique', links:['Programme APC','Méthode BKT','ENSET Ebolowa','Contacts'] },
  ]
  return (
    <footer style={{ background:'#1c1008', padding:'56px 24px 32px', borderTop:`1px solid ${T.border}` }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:40, marginBottom:48 }}>
          {/* Brand */}
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
              <div style={{ width:38, height:38, borderRadius:10, background:gGold, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🧠</div>
              <div>
                <span style={{ fontSize:16, fontWeight:800, color:T.text }}>SenSia</span>
                <span style={{ fontSize:14, fontWeight:800, background:gHero, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}> StudS</span>
              </div>
            </div>
            <p style={{ fontSize:13, color:T.textSec, lineHeight:1.7, margin:'0 0 20px' }}>L'intelligence artificielle au service de l'éducation camerounaise.</p>
            <p style={{ fontSize:11, fontWeight:700, color:T.textMuted }}>🏛️ ENSET Ebolowa — Département GI</p>
          </div>

          {/* Columns */}
          {cols.map(col => (
            <div key={col.title}>
              <p style={{ fontSize:11, fontWeight:800, color:T.gold, textTransform:'uppercase', letterSpacing:'1.5px', marginBottom:18 }}>{col.title}</p>
              {col.links.map(l => (
                <p key={l} style={{ fontSize:13, color:T.textSec, marginBottom:12, cursor:'pointer', transition:'color .2s' }}
                  onMouseEnter={e => e.target.style.color = T.text}
                  onMouseLeave={e => e.target.style.color = T.textSec}>
                  {l}
                </p>
              ))}
            </div>
          ))}
        </div>

        <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:24, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:16 }}>
          <p style={{ fontSize:12, color:T.textMuted, margin:0 }}>© 2025 SenSia Studs · STI ADAPTATIF · Master II</p>
          <div style={{ display:'flex', gap:16 }}>
            {['Confidentialité','Conditions','Mentions légales'].map(l => (
              <span key={l} style={{ fontSize:11, color:T.textMuted, cursor:'pointer', transition:'color .2s' }}
                onMouseEnter={e => e.target.style.color = T.textSec}
                onMouseLeave={e => e.target.style.color = T.textMuted}>{l}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ═══════════════════════════════════════════════════════════════
   ROOT PAGE
═══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate()
  const go = useCallback(() => navigate('/login'), [navigate])

  return (
    <div style={{ fontFamily:"'Plus Jakarta Sans', 'DM Sans', 'Segoe UI', sans-serif", background:T.bg, overflowX:'hidden' }}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"/>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0D1628; }
        ::-webkit-scrollbar-thumb { background: ${T.gold}50; border-radius: 3px; }
        @keyframes blink       { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes orbFloat1   { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-20px) scale(1.05)} 66%{transform:translate(-20px,15px) scale(.95)} }
        @keyframes orbFloat2   { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-25px,20px) scale(1.04)} 66%{transform:translate(20px,-15px) scale(.96)} }
        @keyframes orbFloat3   { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(15px,-25px) scale(1.06)} }
        @keyframes scrollPulse { 0%,100%{opacity:.2; transform:scaleY(1)} 50%{opacity:.6; transform:scaleY(1.1)} }
        @media (max-width: 768px) {
          .nav-links, .nav-ctas { display: none !important; }
          .burger { display: flex !important; }
        }
      `}</style>

      <Navbar onLogin={go}/>
      <HeroSection onLogin={go}/>
      <StatsSection/>
      <FeaturesSection/>
      <HowItWorksSection onLogin={go}/>
      <TechSection/>
      <NiveauxSection onLogin={go}/>
      <TestimonialsSection/>
      <FAQSection/>
      <CTASection onLogin={go}/>
      <Footer/>
    </div>
  )
}