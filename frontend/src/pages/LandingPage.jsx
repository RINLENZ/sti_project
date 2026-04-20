import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const C = {
  dark: '#0A0A0A',
  primary: '#7C3AED',
  primaryDark: '#5B21B6',
  secondary: '#EC4899',
  accent: '#F59E0B',
  success: '#10B981',
  surface: '#1F1F2E',
  surfaceLight: '#2D2D3F',
  text: '#FFFFFF',
  textSec: '#A1A1AA',
  bg: '#0F0F1A',
  gradient1: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 50%, #F59E0B 100%)',
  gradient2: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)',
}

// ── Hook intersection observer ──
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

// ── Particules flottantes ──
function FloatingParticles() {
  const canvasRef = useRef(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animationId
    let particles = []
    
    const initParticles = () => {
      const particleCount = 40
      particles = Array.from({ length: particleCount }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: Math.random() * 2 + 1,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.15,
        alpha: Math.random() * 0.3 + 0.1,
        color: `hsl(${Math.random() * 60 + 260}, 80%, 65%)`
      }))
    }
    
    const resize = () => {
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      initParticles()
    }
    
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0
        if (p.y < 0) p.y = canvas.height
        if (p.y > canvas.height) p.y = 0
        
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.alpha
        ctx.fill()
      })
      animationId = requestAnimationFrame(animate)
    }
    
    window.addEventListener('resize', resize)
    resize()
    animate()
    
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [])
  
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />
}

// ── Navbar responsive ──
function Navbar({ onLogin }) {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])
  
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      padding: scrolled ? '12px 20px' : '20px',
      transition: 'all 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)',
      background: scrolled ? 'rgba(15, 15, 26, 0.95)' : 'transparent',
      backdropFilter: scrolled ? 'blur(20px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(124, 58, 237, 0.2)' : 'none'
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: C.gradient1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, boxShadow: '0 0 15px rgba(124,58,237,0.4)'
          }}>✨</div>
          <div>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>EduSmart</span>
            <span style={{ fontSize: 12, fontWeight: 700, background: C.gradient1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}> AI</span>
          </div>
        </div>
        
        {/* Desktop Menu */}
        <div style={{ display: 'none', alignItems: 'center', gap: 32, '@media (minWidth: 768px)': { display: 'flex' } }}>
          {['Fonctionnalités', 'Témoignages', 'Niveaux'].map(link => (
            <a key={link} href={`#${link.toLowerCase().replace(/ /g, '-')}`} style={{
              fontSize: 14, fontWeight: 600, color: scrolled ? C.textSec : 'rgba(255,255,255,0.7)',
              textDecoration: 'none', transition: 'color 0.2s'
            }}>
              {link}
            </a>
          ))}
        </div>
        
        {/* Boutons desktop */}
        <div style={{ display: 'none', gap: 12, '@media (minWidth: 768px)': { display: 'flex' } }}>
          <button onClick={onLogin} style={{
            padding: '8px 20px', borderRadius: 40, cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'white', fontSize: 13, fontWeight: 600
          }}>
            Connexion
          </button>
          <button onClick={onLogin} style={{
            padding: '8px 24px', borderRadius: 40, cursor: 'pointer',
            background: C.gradient1, border: 'none', color: 'white',
            fontSize: 13, fontWeight: 700
          }}>
            Commencer
          </button>
        </div>
        
        {/* Menu burger mobile */}
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} style={{
          display: 'flex', background: 'none', border: 'none', cursor: 'pointer',
          '@media (minWidth: 768px)': { display: 'none' }
        }}>
          <div style={{ width: 24, height: 2, background: 'white', margin: '4px 0', transition: 'all 0.3s' }} />
          <div style={{ width: 24, height: 2, background: 'white', margin: '4px 0' }} />
          <div style={{ width: 24, height: 2, background: 'white', margin: '4px 0' }} />
        </button>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div style={{
          marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', flexDirection: 'column', gap: 16
        }}>
          {['Fonctionnalités', 'Témoignages', 'Niveaux'].map(link => (
            <a key={link} href={`#${link.toLowerCase().replace(/ /g, '-')}`} style={{
              fontSize: 14, fontWeight: 600, color: C.textSec, textDecoration: 'none'
            }} onClick={() => setMobileMenuOpen(false)}>
              {link}
            </a>
          ))}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button onClick={onLogin} style={{
              flex: 1, padding: '10px', borderRadius: 40, cursor: 'pointer',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
              color: 'white', fontSize: 13, fontWeight: 600
            }}>Connexion</button>
            <button onClick={onLogin} style={{
              flex: 1, padding: '10px', borderRadius: 40, cursor: 'pointer',
              background: C.gradient1, border: 'none', color: 'white', fontSize: 13, fontWeight: 700
            }}>Commencer</button>
          </div>
        </div>
      )}
    </nav>
  )
}

// ── Hero Section responsive ──
function HeroSection({ onLogin }) {
  const [ref, inView] = useInView()
  
  return (
    <section ref={ref} style={{
      minHeight: '100vh',
      background: C.gradient2,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      padding: '100px 20px 60px'
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 50%, rgba(124,58,237,0.3), transparent 50%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 80% 80%, rgba(236,72,153,0.2), transparent 60%)' }} />
      <FloatingParticles />
      
      <div style={{
        maxWidth: 1000, width: '100%', textAlign: 'center', position: 'relative', zIndex: 2,
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 0.6s ease'
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          padding: '6px 16px', borderRadius: 60, marginBottom: 28,
          backdropFilter: 'blur(4px)'
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.success, animation: 'pulse 2s infinite' }}/>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
            🚀 Nouveau · Tutorat IA
          </span>
        </div>
        
        <h1 style={{
          fontSize: 'clamp(36px, 8vw, 72px)', fontWeight: 900,
          background: C.gradient1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          lineHeight: 1.1, marginBottom: 20, letterSpacing: -1.5
        }}>
          Apprends comme<br />un champion 🏆
        </h1>
        
        <p style={{
          fontSize: 'clamp(14px, 4vw, 18px)', color: C.textSec, maxWidth: 600,
          margin: '0 auto 32px', lineHeight: 1.6
        }}>
          L'IA qui s'adapte à TOI. Programme camerounais, exercices interactifs,
          et une expérience d'apprentissage qui déchire. 100% gratuit.
        </p>
        
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 48 }}>
          <button onClick={onLogin} style={{
            padding: '14px 32px', borderRadius: 60, cursor: 'pointer',
            background: C.gradient1, border: 'none', color: 'white',
            fontSize: 'clamp(14px, 4vw, 16px)', fontWeight: 800,
            boxShadow: '0 8px 32px rgba(124,58,237,0.4)'
          }}>
            🎮 C'est parti !
          </button>
          <button style={{
            padding: '14px 28px', borderRadius: 60, cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.2)',
            color: 'white', fontSize: 'clamp(14px, 4vw, 15px)', fontWeight: 700
          }}>
            ▶ Voir démo
          </button>
        </div>
        
        {/* Stats responsive */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, maxWidth: 400, margin: '0 auto' }}>
          {[
            { value: '3', label: 'Niveaux', icon: '📚' },
            { value: '∞', label: 'Exercices', icon: '⚡' },
            { value: '100%', label: 'Gratuit', icon: '🎁' },
            { value: 'IA', label: 'Temps réel', icon: '🤖' },
          ].map(stat => (
            <div key={stat.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{stat.icon}</div>
              <p style={{ fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: 900, background: C.gradient1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>{stat.value}</p>
              <p style={{ fontSize: 12, color: C.textSec, margin: '4px 0 0' }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Section Fonctionnalités (simplifiée) ──
function FeaturesSection() {
  const [ref, inView] = useInView()
  
  const features = [
    { icon: '👁️‍🗨️', title: 'Analyse IA', desc: 'MediaPipe détecte ton attention en temps réel.', color: C.primary },
    { icon: '🧠', title: 'BKT intelligent', desc: 'Mesure ta maîtrise après chaque exercice.', color: C.secondary },
    { icon: '🎮', title: 'Apprentissage ludique', desc: 'Gagne des points et débloque des badges.', color: C.accent },
    { icon: '💡', title: 'Indices malins', desc: '3 niveaux d\'aide personnalisés.', color: C.success },
  ]
  
  return (
    <section id="fonctionnalités" ref={ref} style={{ padding: '60px 20px', background: C.bg }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          textAlign: 'center', marginBottom: 48,
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.5s ease'
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: 3 }}>✨ Super pouvoirs</span>
          <h2 style={{ fontSize: 'clamp(28px, 6vw, 42px)', fontWeight: 900, background: C.gradient1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginTop: 12 }}>
            Ce qui rend EduSmart unique
          </h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {features.map((f, i) => (
            <div key={f.title} style={{
              background: C.surface, borderRadius: 24, padding: '28px 24px',
              border: `1px solid rgba(124,58,237,0.2)`,
              transition: 'all 0.3s ease',
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(30px)',
              transitionDelay: `${i * 0.1}s`,
              textAlign: 'center'
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 18, marginBottom: 16, marginInline: 'auto',
                background: `linear-gradient(135deg, ${f.color}20, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
                border: `1px solid ${f.color}40`
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: 'white', marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Section Témoignages (NOUVELLE) ──
function TestimonialsSection() {
  const [ref, inView] = useInView()
  
  const testimonials = [
    { name: 'Sarah M.', role: 'Lycéenne, Terminale', text: 'Grâce à EduSmart, j\'ai compris les boucles en C en 2 jours ! L\'IA m\'a guidée pas à pas.', rating: 5, avatar: '👩‍🎓' },
    { name: 'Prof. Emmanuel', role: 'Enseignant NSI', text: 'Un outil formidable pour suivre la progression de mes élèves. Le tableau de bord est très clair.', rating: 5, avatar: '👨‍🏫' },
    { name: 'David K.', role: 'Étudiant, Première', text: 'Les exercices sont super bien faits et le système d\'indices m\'a sauvé plus d\'une fois !', rating: 5, avatar: '🧑‍💻' },
  ]
  
  return (
    <section id="témoignages" ref={ref} style={{ padding: '60px 20px', background: C.surface }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          textAlign: 'center', marginBottom: 48,
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.5s ease'
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: 3 }}>💬 Ils nous adorent</span>
          <h2 style={{ fontSize: 'clamp(28px, 6vw, 42px)', fontWeight: 900, color: 'white', marginTop: 12 }}>
            +200 apprenants conquis
          </h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {testimonials.map((t, i) => (
            <div key={t.name} style={{
              background: C.bg, borderRadius: 24, padding: 28,
              border: '1px solid rgba(124,58,237,0.15)',
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(30px)',
              transition: `all 0.5s ${i * 0.1}s ease`
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 24, background: C.gradient1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
                }}>{t.avatar}</div>
                <div>
                  <h4 style={{ fontSize: 15, fontWeight: 800, color: 'white' }}>{t.name}</h4>
                  <p style={{ fontSize: 11, color: C.accent }}>{t.role}</p>
                </div>
              </div>
              <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6, marginBottom: 12 }}>"{t.text}"</p>
              <div style={{ display: 'flex', gap: 2 }}>
                {[...Array(t.rating)].map((_, i) => <span key={i}>⭐</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Section Niveaux ──
function NiveauxSection({ onLogin }) {
  const [ref, inView] = useInView()
  
  const niveaux = [
    { name: 'Seconde', icon: '🌱', color: '#10B981', modules: ['Algorithmique', 'Variables', 'Instructions'], badge: 'Débutant', popular: false },
    { name: 'Première', icon: '⚡', color: '#EC4899', modules: ['Structures', 'Programmation C', 'Réseaux'], badge: 'Populaire', popular: true },
    { name: 'Terminale', icon: '🏆', color: '#F59E0B', modules: ['SQL', 'Modèle relationnel', 'Algorithmes avancés'], badge: 'Expert', popular: false },
  ]
  
  return (
    <section id="niveaux" ref={ref} style={{ padding: '60px 20px', background: C.bg }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          textAlign: 'center', marginBottom: 48,
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.5s ease'
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: 3 }}>📖 Parcours</span>
          <h2 style={{ fontSize: 'clamp(28px, 6vw, 42px)', fontWeight: 900, background: C.gradient1, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginTop: 12 }}>
            Choisis ton niveau
          </h2>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {niveaux.map((n, i) => (
            <div key={n.name} style={{
              background: n.popular ? `linear-gradient(135deg, ${C.primaryDark}, ${C.surface})` : C.surface,
              borderRadius: 28, padding: '28px 24px',
              border: n.popular ? `1px solid ${C.primary}` : '1px solid rgba(255,255,255,0.05)',
              position: 'relative',
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(40px)',
              transition: `all 0.5s ${i * 0.1}s ease`
            }}>
              {n.popular && (
                <div style={{ position: 'absolute', top: 16, right: 16, background: C.accent, color: C.dark, fontSize: 10, fontWeight: 800, padding: '4px 12px', borderRadius: 40 }}>
                  🔥 POP
                </div>
              )}
              <div style={{ fontSize: 40, marginBottom: 12 }}>{n.icon}</div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: 'white', marginBottom: 4 }}>{n.name}</h3>
              <p style={{ fontSize: 11, fontWeight: 600, color: n.color, marginBottom: 20 }}>{n.badge}</p>
              <div style={{ marginBottom: 24 }}>
                {n.modules.map(m => (
                  <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ color: n.color, fontSize: 12 }}>✓</span>
                    <span style={{ fontSize: 13, color: C.textSec }}>{m}</span>
                  </div>
                ))}
              </div>
              <button onClick={onLogin} style={{
                width: '100%', padding: '12px',
                background: n.popular ? C.gradient1 : `linear-gradient(135deg, ${C.primary}, ${C.secondary})`,
                border: 'none', borderRadius: 40, color: 'white',
                fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}>
                {n.popular ? '🔥 Je commence' : 'Explorer →'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Section FAQ (NOUVELLE) ──
function FAQSection() {
  const [ref, inView] = useInView()
  const [openIndex, setOpenIndex] = useState(null)
  
  const faqs = [
    { q: 'C\'est vraiment gratuit ?', a: 'Oui, 100% gratuit ! Pas de carte bancaire, pas d\'essai limité. L\'éducation doit être accessible à tous.' },
    { q: 'Quels sont les prérequis techniques ?', a: 'Un navigateur récent (Chrome, Firefox, Edge) et une connexion internet. La caméra est optionnelle pour l\'analyse d\'attention.' },
    { q: 'Le contenu suit-il vraiment le programme camerounais ?', a: 'Absolument ! Nous avons travaillé avec des enseignants camerounais pour aligner chaque chapitre sur le programme APC officiel.' },
    { q: 'Puis-je l\'utiliser sur mon téléphone ?', a: 'Oui ! EduSmart est entièrement responsive et fonctionne parfaitement sur mobile et tablette.' },
  ]
  
  return (
    <section ref={ref} style={{ padding: '60px 20px', background: C.surface }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{
          textAlign: 'center', marginBottom: 48,
          opacity: inView ? 1 : 0,
          transform: inView ? 'translateY(0)' : 'translateY(30px)',
          transition: 'all 0.5s ease'
        }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: 3 }}>❓ Questions fréquentes</span>
          <h2 style={{ fontSize: 'clamp(28px, 6vw, 42px)', fontWeight: 900, color: 'white', marginTop: 12 }}>
            On répond à tout
          </h2>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {faqs.map((faq, i) => (
            <div key={i} style={{
              background: C.bg, borderRadius: 20, overflow: 'hidden',
              opacity: inView ? 1 : 0,
              transform: inView ? 'translateY(0)' : 'translateY(20px)',
              transition: `all 0.5s ${i * 0.05}s ease`
            }}>
              <button onClick={() => setOpenIndex(openIndex === i ? null : i)} style={{
                width: '100%', padding: '18px 20px', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer'
              }}>
                <span style={{ fontSize: 'clamp(14px, 4vw, 16px)', fontWeight: 600, color: 'white', textAlign: 'left' }}>{faq.q}</span>
                <span style={{ fontSize: 20, color: C.accent }}>{openIndex === i ? '−' : '+'}</span>
              </button>
              {openIndex === i && (
                <div style={{ padding: '0 20px 20px 20px' }}>
                  <p style={{ fontSize: 14, color: C.textSec, lineHeight: 1.6 }}>{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── CTA final ──
function CTASection({ onLogin }) {
  const [ref, inView] = useInView()
  
  return (
    <section ref={ref} style={{
      padding: '60px 20px',
      background: C.gradient2,
      position: 'relative', overflow: 'hidden', textAlign: 'center'
    }}>
      <FloatingParticles />
      <div style={{
        maxWidth: 600, margin: '0 auto', position: 'relative', zIndex: 2,
        opacity: inView ? 1 : 0,
        transform: inView ? 'scale(1)' : 'scale(0.95)',
        transition: 'all 0.6s ease'
      }}>
        <h2 style={{ fontSize: 'clamp(28px, 6vw, 44px)', fontWeight: 900, color: 'white', marginBottom: 16 }}>
          Prêt à commencer ? 🚀
        </h2>
        <p style={{ fontSize: 'clamp(14px, 4vw, 16px)', color: C.textSec, marginBottom: 32, lineHeight: 1.6 }}>
          Rejoins les pionniers d'EduSmart AI. Gratuit, sans carte, 100% adapté au programme camerounais.
        </p>
        <button onClick={onLogin} style={{
          padding: '14px 40px', borderRadius: 60, cursor: 'pointer',
          background: 'white', border: 'none', color: C.primary,
          fontSize: 'clamp(14px, 4vw, 16px)', fontWeight: 900,
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
        }}>
          ✨ Créer mon compte ✨
        </button>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 20 }}>
          Aucune carte · Accès immédiat · 100% gratuit
        </p>
      </div>
    </section>
  )
}

// ── Footer ──
function Footer() {
  return (
    <footer style={{ background: C.dark, padding: '48px 20px 32px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 32, marginBottom: 40, textAlign: 'center'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: C.gradient1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✨</div>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>EduSmart AI</span>
            </div>
            <p style={{ fontSize: 12, color: C.textSec, maxWidth: 250, margin: '0 auto' }}>
              L'IA au service de l'éducation africaine.
            </p>
          </div>
          {[
            { title: 'Produit', links: ['Fonctionnalités', 'Niveaux', 'Témoignages'] },
            { title: 'Support', links: ['FAQ', 'Contact', 'Mentions légales'] },
            { title: 'Académique', links: ['Programme APC', 'BKT', 'ENSET Ebolowa'] },
          ].map(section => (
            <div key={section.title}>
              <p style={{ fontSize: 11, fontWeight: 800, color: C.accent, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 16 }}>{section.title}</p>
              {section.links.map(link => (
                <p key={link} style={{ fontSize: 12, color: C.textSec, marginBottom: 10, cursor: 'pointer' }}>{link}</p>
              ))}
            </div>
          ))}
        </div>
        <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>© 2025 EduSmart AI · ENSET Ebolowa · Master Informatique</p>
        </div>
      </div>
    </footer>
  )
}

// ── Page principale ──
export default function LandingPage() {
  const navigate = useNavigate()
  
  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", background: C.bg }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #0F0F1A; }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        button { cursor: pointer; transition: transform 0.2s, opacity 0.2s; }
        button:hover { transform: scale(1.03); }
        @media (max-width: 768px) {
          button:active { transform: scale(0.98); }
        }
      `}</style>
      <Navbar onLogin={() => navigate('/login')} />
      <HeroSection onLogin={() => navigate('/login')} />
      <FeaturesSection />
      <TestimonialsSection />
      <NiveauxSection onLogin={() => navigate('/login')} />
      <FAQSection />
      <CTASection onLogin={() => navigate('/login')} />
      <Footer />
    </div>
  )
}