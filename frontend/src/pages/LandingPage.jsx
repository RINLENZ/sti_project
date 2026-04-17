import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const C = {
  brown:       '#6B3A2A',
  brownLight:  '#C4865A',
  emerald:     '#0D9373',
  bg:          '#FAF7F4',
  surface:     '#FFFFFF',
  text:        '#1A1207',
  textSec:     '#6B5744',
  brownPale:   '#F5EDE5',
  emeraldPale: '#E6F5F0',
  gold:        '#D4A853',
  dark:        '#0F0704',
}

// ── Hook intersection observer pour animations au scroll ──────────
function useInView(threshold = 0.15) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true) }, { threshold })
    if (ref.current) obs.observe(ref.current)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

// ── Hook count-up ─────────────────────────────────────────────────
function useCountUp(target, duration = 1500, inView = false) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      start = Math.min(start + step, target)
      setVal(Math.round(start))
      if (start >= target) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [inView, target, duration])
  return val
}

// ── Motif adinkra SVG ────────────────────────────────────────────
const AdinkraPattern = ({ opacity = 0.06, color = 'white' }) => (
  <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
    <defs>
      <pattern id={`adinkra-${color}`} x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
        <circle cx="40" cy="40" r="16" fill="none" stroke={color} strokeWidth="1.2"/>
        <circle cx="40" cy="40" r="8" fill="none" stroke={color} strokeWidth="1.2"/>
        <line x1="40" y1="24" x2="40" y2="14" stroke={color} strokeWidth="1.2"/>
        <line x1="40" y1="56" x2="40" y2="66" stroke={color} strokeWidth="1.2"/>
        <line x1="24" y1="40" x2="14" y2="40" stroke={color} strokeWidth="1.2"/>
        <line x1="56" y1="40" x2="66" y2="40" stroke={color} strokeWidth="1.2"/>
        <rect x="3" y="3" width="10" height="10" fill="none" stroke={C.gold} strokeWidth=".8" transform="rotate(45 8 8)"/>
        <rect x="67" y="3" width="10" height="10" fill="none" stroke={C.gold} strokeWidth=".8" transform="rotate(45 72 8)"/>
        <rect x="3" y="67" width="10" height="10" fill="none" stroke={C.gold} strokeWidth=".8" transform="rotate(45 8 72)"/>
        <rect x="67" y="67" width="10" height="10" fill="none" stroke={C.gold} strokeWidth=".8" transform="rotate(45 72 72)"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill={`url(#adinkra-${color})`} opacity={opacity}/>
  </svg>
)

// ── Navbar ────────────────────────────────────────────────────────
function Navbar({ onLogin }) {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      padding: '0 32px', height: 64,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: scrolled ? 'rgba(250,247,244,0.95)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? `1px solid ${C.brownPale}` : 'none',
      transition: 'all .3s ease',
      boxShadow: scrolled ? '0 2px 20px rgba(107,58,42,0.08)' : 'none',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `linear-gradient(135deg, ${C.brown}, ${C.gold})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18
        }}>🧠</div>
        <div>
          <span style={{ fontSize: 16, fontWeight: 900, color: scrolled ? C.brown : 'white', letterSpacing: -.3 }}>
            EduSmart
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.gold }}> AI</span>
        </div>
      </div>

      {/* Links desktop */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        {['Fonctionnalités', 'Comment ça marche', 'Niveaux'].map(link => (
          <a key={link} href={`#${link.toLowerCase().replace(/ /g, '-')}`} style={{
            fontSize: 14, fontWeight: 600,
            color: scrolled ? C.textSec : 'rgba(255,255,255,.8)',
            textDecoration: 'none', transition: 'color .2s'
          }}>
            {link}
          </a>
        ))}
      </div>

      {/* CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onLogin} style={{
          padding: '8px 18px', borderRadius: 8, cursor: 'pointer',
          background: 'transparent',
          border: `1.5px solid ${scrolled ? C.brown : 'rgba(255,255,255,.6)'}`,
          color: scrolled ? C.brown : 'white',
          fontSize: 13, fontWeight: 700, transition: 'all .2s'
        }}>
          Se connecter
        </button>
        <button onClick={onLogin} style={{
          padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
          background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
          border: 'none', color: 'white',
          fontSize: 13, fontWeight: 800,
          boxShadow: `0 4px 14px ${C.brown}40`, transition: 'all .2s'
        }}>
          Commencer
        </button>
      </div>
    </nav>
  )
}

// ── Section Hero ─────────────────────────────────────────────────
function HeroSection({ onLogin }) {
  return (
    <section style={{
      minHeight: '100vh',
      background: `linear-gradient(135deg, ${C.dark} 0%, ${C.brown} 45%, #3D200F 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', padding: '80px 32px 60px'
    }}>
      <AdinkraPattern opacity={0.07}/>

      {/* Cercles lumineux */}
      <div style={{ position: 'absolute', top: '20%', right: '10%', width: 400, height: 400, borderRadius: '50%', background: `radial-gradient(circle, ${C.brownLight}20, transparent 70%)`, pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', bottom: '10%', left: '5%', width: 300, height: 300, borderRadius: '50%', background: `radial-gradient(circle, ${C.gold}15, transparent 70%)`, pointerEvents: 'none' }}/>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, borderRadius: '50%', background: `radial-gradient(circle, ${C.emerald}08, transparent 60%)`, pointerEvents: 'none' }}/>

      <div style={{ maxWidth: 900, width: '100%', textAlign: 'center', position: 'relative' }}>
        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.15)',
          padding: '6px 18px', borderRadius: 20, marginBottom: 28,
          animation: 'fadeInDown .8s ease'
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.emerald, animation: 'pulse 2s infinite' }}/>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>
            🎓 Nouveau · Tutorat IA adaptatif au programme camerounais
          </span>
        </div>

        {/* Titre */}
        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 68px)', fontWeight: 900, color: 'white',
          lineHeight: 1.05, marginBottom: 24, letterSpacing: -1.5,
          animation: 'fadeInUp .8s .1s ease both'
        }}>
          Apprends à ton rythme,{' '}
          <span style={{
            background: `linear-gradient(135deg, ${C.gold}, ${C.brownLight})`,
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            guidé par l'IA
          </span>
        </h1>

        {/* Sous-titre */}
        <p style={{
          fontSize: 18, color: 'rgba(255,255,255,.7)', maxWidth: 600,
          margin: '0 auto 36px', lineHeight: 1.7, fontWeight: 400,
          animation: 'fadeInUp .8s .2s ease both'
        }}>
          EduSmart AI analyse ton engagement en temps réel et adapte les cours
          au programme officiel APC du Cameroun — Seconde, Première, Terminale.
        </p>

        {/* CTAs */}
        <div style={{
          display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap',
          marginBottom: 48, animation: 'fadeInUp .8s .3s ease both'
        }}>
          <button onClick={onLogin} style={{
            padding: '16px 36px', borderRadius: 14, cursor: 'pointer',
            background: `linear-gradient(135deg, ${C.brownLight}, ${C.gold})`,
            border: 'none', color: 'white', fontSize: 16, fontWeight: 800,
            boxShadow: `0 8px 28px ${C.brown}60`, transition: 'all .2s',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            Commencer gratuitement →
          </button>
          <button style={{
            padding: '16px 32px', borderRadius: 14, cursor: 'pointer',
            background: 'rgba(255,255,255,.08)',
            border: '1.5px solid rgba(255,255,255,.25)',
            color: 'white', fontSize: 15, fontWeight: 700, transition: 'all .2s',
            display: 'flex', alignItems: 'center', gap: 8
          }}>
            ▶ Voir la démo
          </button>
        </div>

        {/* Stats */}
        <div style={{
          display: 'flex', gap: 32, justifyContent: 'center', flexWrap: 'wrap',
          animation: 'fadeInUp .8s .4s ease both'
        }}>
          {[
            { value: '3', label: 'Niveaux couverts' },
            { value: '8+', label: 'Exercices disponibles' },
            { value: '100%', label: 'Gratuit' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 28, fontWeight: 900, color: C.gold, margin: 0, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,.55)', margin: '4px 0 0', fontWeight: 600 }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Mockup UI */}
        <div style={{
          marginTop: 60, background: 'rgba(255,255,255,.06)',
          border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 20, padding: '20px 24px',
          backdropFilter: 'blur(8px)',
          animation: 'fadeInUp .8s .5s ease both',
          maxWidth: 700, margin: '60px auto 0'
        }}>
          {/* Barre de navigateur */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            {['#FF5F57','#FFBD2E','#28CA41'].map(c => (
              <div key={c} style={{ width: 12, height: 12, borderRadius: '50%', background: c }}/>
            ))}
            <div style={{ flex: 1, height: 24, background: 'rgba(255,255,255,.08)', borderRadius: 6, margin: '0 8px' }}/>
          </div>
          {/* Aperçu dashboard simulé */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
            {[
              { label: 'Score', value: '87%', color: C.emerald },
              { label: 'Exercices', value: '6/8', color: C.brownLight },
              { label: 'BKT', value: '0 maîtrisées', color: C.gold },
              { label: 'Engagement', value: '92%', color: C.emerald },
            ].map(s => (
              <div key={s.label} style={{ background: 'rgba(255,255,255,.08)', borderRadius: 10, padding: '10px 12px' }}>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,.5)', margin: '0 0 4px', fontWeight: 600 }}>{s.label}</p>
                <p style={{ fontSize: 16, fontWeight: 900, color: s.color, margin: 0 }}>{s.value}</p>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', borderRadius: 10, padding: 14 }}>
              <div style={{ height: 8, background: C.brownPale, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: '75%', background: `linear-gradient(90deg, ${C.brown}, ${C.brownLight})`, borderRadius: 4 }}/>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', margin: 0 }}>Structures de contrôle — 75%</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(255,255,255,.06)', borderRadius: 10, padding: 14 }}>
              <div style={{ height: 8, background: C.brownPale, borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', width: '45%', background: `linear-gradient(90deg, ${C.emerald}, #0A7A5E)`, borderRadius: 4 }}/>
              </div>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', margin: 0 }}>Programmation C — 45%</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ── Bande stats ───────────────────────────────────────────────────
function StatsSection() {
  const [ref, inView] = useInView()
  const s1 = useCountUp(3,   1200, inView)
  const s2 = useCountUp(7,   1400, inView)
  const s3 = useCountUp(100, 1600, inView)

  return (
    <section ref={ref} style={{
      background: `linear-gradient(135deg, ${C.brown}, #3D200F)`,
      padding: '48px 32px', position: 'relative', overflow: 'hidden'
    }}>
      <AdinkraPattern opacity={0.05}/>
      <div style={{
        maxWidth: 900, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 0, position: 'relative'
      }}>
        {[
          { value: s1,  suffix: '',  label: 'Niveaux couverts', sub: 'Seconde · Première · Terminale' },
          { value: s2,  suffix: '',  label: 'Compétences APC',  sub: 'Du programme officiel camerounais' },
          { value: s3,  suffix: '%', label: 'Gratuit',          sub: 'Sans carte bancaire' },
          { value: 'IA',suffix: '',  label: 'Analyse temps réel',sub: 'Via MediaPipe + BKT' },
        ].map((s, i) => (
          <div key={s.label} style={{
            textAlign: 'center', padding: '24px 16px',
            borderRight: i < 3 ? '1px solid rgba(255,255,255,.12)' : 'none'
          }}>
            <p style={{ fontSize: 44, fontWeight: 900, color: C.gold, margin: '0 0 6px', lineHeight: 1 }}>
              {s.value}{s.suffix}
            </p>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'white', margin: '0 0 4px' }}>{s.label}</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,.45)', margin: 0 }}>{s.sub}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Fonctionnalités ───────────────────────────────────────────────
function FeaturesSection() {
  const [ref, inView] = useInView()
  const features = [
    { icon: '👁️', title: 'Analyse visuelle IA', desc: 'MediaPipe détecte ton niveau d\'attention via la caméra. Si tu décroches, le système s\'adapte immédiatement.', color: C.brown },
    { icon: '🧠', title: 'BKT — Maîtrise APC',  desc: 'L\'algorithme de Corbett & Anderson calcule ta probabilité de maîtrise pour chaque compétence après chaque exercice.', color: C.emerald },
    { icon: '📚', title: 'Programme officiel',   desc: 'Contenu aligné sur le programme camerounais APC : Seconde, Première F6/F4, Terminale. Algorithmique, Programmation C, Réseaux.', color: C.brownLight },
    { icon: '💡', title: 'Indices progressifs',  desc: '3 niveaux d\'indices pour chaque exercice. Le tuteur IA génère une explication personnalisée si tu bloques encore.', color: C.gold },
    { icon: '👨‍🏫', title: 'Suivi enseignant',   desc: 'Partage ton code invitation à ton enseignant. Il suit ton engagement et ta progression en temps réel.', color: C.brown },
    { icon: '🌍', title: 'Contexte africain',    desc: 'Situations problèmes contextualisées : marchés locaux, FCFA, noms camerounais. Fonctionne avec une connexion lente.', color: C.emerald },
  ]

  return (
    <section id="fonctionnalités" ref={ref} style={{ padding: '80px 32px', background: C.bg }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.brownLight, textTransform: 'uppercase', letterSpacing: 2 }}>
            Fonctionnalités
          </span>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: C.brown, margin: '10px 0 16px', lineHeight: 1.1 }}>
            Tout ce dont tu as besoin pour progresser
          </h2>
          <p style={{ fontSize: 16, color: C.textSec, maxWidth: 500, margin: '0 auto', lineHeight: 1.7 }}>
            Une plateforme complète conçue pour le lycéen africain moderne
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {features.map((f, i) => (
            <div key={f.title} style={{
              backgroundColor: C.surface, borderRadius: 20, padding: '28px 24px',
              border: `1px solid ${C.brownPale}`,
              boxShadow: '0 2px 12px rgba(107,58,42,0.06)',
              transition: 'all .3s ease', cursor: 'default',
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(20px)',
              transitionDelay: `${i * 0.08}s`,
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(107,58,42,0.14)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(107,58,42,0.06)' }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14, marginBottom: 16,
                background: `${f.color}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Comment ça marche ────────────────────────────────────────────
function HowItWorksSection() {
  const [ref, inView] = useInView()
  const steps = [
    { num: '01', icon: '👤', title: 'Crée ton compte', desc: 'Inscris-toi avec ton email, choisis ton niveau scolaire et ton pays. C\'est gratuit et sans carte bancaire.' },
    { num: '02', icon: '📖', title: 'Choisis ton cours', desc: 'Accède aux cours du programme officiel camerounais. Commence par la leçon, puis enchaîne les exercices.' },
    { num: '03', icon: '⚡', title: 'Progresse avec l\'IA', desc: 'Le système analyse ton engagement via la caméra, adapte la difficulté et mesure ta maîtrise en temps réel.' },
  ]

  return (
    <section id="comment-ça-marche" ref={ref} style={{
      padding: '80px 32px', background: C.brownPale, position: 'relative', overflow: 'hidden'
    }}>
      <AdinkraPattern opacity={0.04} color={C.brown}/>
      <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.brownLight, textTransform: 'uppercase', letterSpacing: 2 }}>
            Mode d'emploi
          </span>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: C.brown, margin: '10px 0 0', lineHeight: 1.1 }}>
            Commence en 3 étapes simples
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, position: 'relative' }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateX(0)' : 'translateX(-20px)',
              transition: `all .6s ${i * .15}s ease`
            }}>
              <div style={{ backgroundColor: C.surface, borderRadius: 20, padding: '32px 28px', boxShadow: '0 4px 20px rgba(107,58,42,0.1)', border: `1px solid ${C.brownLight}30`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 80, fontWeight: 900, color: `${C.brown}06`, lineHeight: 1, userSelect: 'none' }}>
                  {s.num}
                </div>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, marginBottom: 18, boxShadow: `0 6px 20px ${C.brown}30` }}>
                  {s.icon}
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingRight: -12, marginTop: 12 }}>
                  <span style={{ fontSize: 24, color: C.brownLight, display: 'none' }}>→</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Niveaux ──────────────────────────────────────────────────────
function NiveauxSection({ onLogin }) {
  const [ref, inView] = useInView()
  const niveaux = [
    {
      label: 'Seconde', icon: '🌱', badge: 'Niveau 1',
      modules: ['Introduction à l\'algorithmique', 'Variables et types', 'Instructions séquentielles'],
      exercices: 'En cours d\'ajout', popular: false,
      color: C.emerald
    },
    {
      label: 'Première', icon: '📗', badge: 'Niveau 2',
      modules: ['Structures de contrôle (UE 15&16)', 'Programmation C (UE 19)', 'Réseaux & Internet'],
      exercices: '8 exercices disponibles', popular: true,
      color: C.brown
    },
    {
      label: 'Terminale', icon: '🎓', badge: 'Niveau 3',
      modules: ['Bases de données SQL', 'Modèle relationnel', 'Algorithmes avancés'],
      exercices: 'En cours d\'ajout', popular: false,
      color: C.brownLight
    },
  ]

  return (
    <section id="niveaux" ref={ref} style={{ padding: '80px 32px', background: C.bg }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.brownLight, textTransform: 'uppercase', letterSpacing: 2 }}>
            Niveaux & Programmes
          </span>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 900, color: C.brown, margin: '10px 0 0', lineHeight: 1.1 }}>
            Couvre tout le programme lycée
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {niveaux.map((n, i) => (
            <div key={n.label} style={{
              backgroundColor: n.popular ? C.brown : C.surface,
              borderRadius: 24, padding: '32px 28px',
              border: n.popular ? 'none' : `1px solid ${C.brownPale}`,
              boxShadow: n.popular ? `0 16px 48px ${C.brown}40` : '0 2px 12px rgba(107,58,42,0.06)',
              position: 'relative', overflow: 'hidden',
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(24px)',
              transition: `all .6s ${i * .12}s ease`
            }}>
              {n.popular && <AdinkraPattern opacity={0.08}/>}

              {n.popular && (
                <div style={{ position: 'absolute', top: 16, right: 16, background: C.gold, color: C.dark, fontSize: 10, fontWeight: 900, padding: '3px 10px', borderRadius: 20, letterSpacing: .5 }}>
                  ★ POPULAIRE
                </div>
              )}

              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 32 }}>{n.icon}</span>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: n.popular ? 'rgba(255,255,255,.6)' : C.textSec, textTransform: 'uppercase', letterSpacing: .8 }}>
                      {n.badge}
                    </span>
                    <h3 style={{ fontSize: 22, fontWeight: 900, color: n.popular ? 'white' : C.text, margin: 0 }}>{n.label}</h3>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  {n.modules.map(m => (
                    <div key={m} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ color: n.popular ? C.gold : C.brownLight, fontWeight: 900, flexShrink: 0, fontSize: 13 }}>✓</span>
                      <p style={{ fontSize: 13, color: n.popular ? 'rgba(255,255,255,.8)' : C.textSec, margin: 0, lineHeight: 1.5 }}>{m}</p>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: 12, color: n.popular ? 'rgba(255,255,255,.5)' : C.textSec, marginBottom: 20, fontWeight: 600 }}>
                  📝 {n.exercices}
                </p>

                <button onClick={onLogin} style={{
                  width: '100%', padding: '12px',
                  background: n.popular ? `linear-gradient(135deg, ${C.brownLight}, ${C.gold})` : `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                  color: 'white', border: 'none', borderRadius: 12,
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  boxShadow: `0 4px 14px ${n.color}40`
                }}>
                  {n.popular ? 'Commencer →' : 'Voir les cours →'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── CTA final ────────────────────────────────────────────────────
function CTASection({ onLogin }) {
  return (
    <section style={{
      padding: '80px 32px',
      background: `linear-gradient(135deg, ${C.brown} 0%, #2D1208 100%)`,
      position: 'relative', overflow: 'hidden', textAlign: 'center'
    }}>
      <AdinkraPattern opacity={0.07}/>
      <div style={{ maxWidth: 600, margin: '0 auto', position: 'relative' }}>
        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: 'white', marginBottom: 16, lineHeight: 1.1 }}>
          Prêt à transformer ta façon d'apprendre ?
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,.65)', marginBottom: 36, lineHeight: 1.7 }}>
          Rejoins les premiers apprenants sur EduSmart AI. Gratuit, sans carte bancaire, adapté au programme camerounais.
        </p>
        <button onClick={onLogin} style={{
          padding: '16px 40px', borderRadius: 14, cursor: 'pointer',
          background: 'white', border: 'none', color: C.brown,
          fontSize: 16, fontWeight: 900,
          boxShadow: '0 8px 32px rgba(0,0,0,.3)', transition: 'all .2s',
          display: 'inline-flex', alignItems: 'center', gap: 10
        }}>
          🎓 Créer mon compte gratuitement →
        </button>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,.35)', marginTop: 16 }}>
          Aucune carte bancaire requise · Accès immédiat · 100% gratuit
        </p>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: C.dark, padding: '48px 32px 32px', color: 'rgba(255,255,255,.45)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 40, marginBottom: 40, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `linear-gradient(135deg, ${C.brown}, ${C.gold})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🧠</div>
              <span style={{ fontSize: 16, fontWeight: 900, color: 'white' }}>EduSmart AI</span>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.7, maxWidth: 280, color: 'rgba(255,255,255,.4)' }}>
              L'intelligence artificielle au service de l'éducation africaine. Système de tutorat intelligent adaptatif pour les lycéens camerounais.
            </p>
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Produit</p>
            {['Fonctionnalités', 'Niveaux', 'Comment ça marche', 'Se connecter'].map(l => (
              <p key={l} style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 8, cursor: 'pointer' }}>{l}</p>
            ))}
          </div>
          <div>
            <p style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.6)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>Académique</p>
            {['Programme APC', 'Méthode BKT', 'Analyse multimodale', 'ENSET Ebolowa'].map(l => (
              <p key={l} style={{ fontSize: 13, color: 'rgba(255,255,255,.4)', marginBottom: 8, cursor: 'pointer' }}>{l}</p>
            ))}
          </div>
        </div>
        <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontSize: 12, margin: 0 }}>© 2025 EduSmart AI · ENSET Ebolowa · Mémoire de Master en Informatique</p>
          <p style={{ fontSize: 12, margin: 0 }}>Conçu avec ❤️ pour l'éducation africaine</p>
        </div>
      </div>
    </footer>
  )
}

// ── Page principale ───────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate()

  function goLogin() { navigate('/login') }

  return (
    <div style={{ fontFamily: "'Nunito', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap');
        @keyframes fadeInDown{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        a { text-decoration: none; }
        button { font-family: inherit; }
      `}</style>
      <Navbar onLogin={goLogin}/>
      <HeroSection onLogin={goLogin}/>
      <StatsSection/>
      <FeaturesSection/>
      <HowItWorksSection/>
      <NiveauxSection onLogin={goLogin}/>
      <CTASection onLogin={goLogin}/>
      <Footer/>
    </div>
  )
}
