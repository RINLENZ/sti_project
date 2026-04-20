import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../../store/authSlice'
import { C } from '../../styles/theme'
import {
  LayoutDashboard, BookOpen, Users, LogOut,
  GraduationCap, ChevronLeft, ChevronRight,
  BarChart2, Shield, UserCircle, Brain
} from 'lucide-react'

// ── Badge rôle ────────────────────────────────────────────────────
const roleLabel = {
  super_admin: { label: '⚙️ Super Admin', color: '#D4A853' },
  enseignant:  { label: '👨‍🏫 Enseignant',  color: '#0D9373' },
  apprenant:   { label: '🎓 Apprenant',   color: '#C4865A' },
}

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user }  = useSelector(s => s.auth)
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const location  = useLocation()

  // ── Liens par rôle ────────────────────────────────────────────
  // Super admin — accès exclusif à l'administration
  const linksAdmin = [
  { path: '/admin',             label: 'Gestion des cours',    icon: Shield,        section: 'admin' },
  { path: '/admin/referentiel', label: 'Référentiel éducatif', icon: BookOpen,      section: 'admin' },
  { path: '/dashboard',         label: 'Vue apprenant',        icon: GraduationCap, section: 'test'  },
  { path: '/prof',              label: 'Vue enseignant',        icon: BarChart2,     section: 'test'  },
]

  // Enseignant — suivi des apprenants uniquement
  const linksEnseignant = [
    { path: '/prof',   label: 'Suivi des apprenants', icon: BarChart2,       section: 'main' },
    { path: '/profil', label: 'Mon profil',            icon: UserCircle,      section: 'main' },
  ]

  // Apprenant — cours et progression
  const linksApprenant = [
    { path: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, section: 'main' },
    { path: '/profil',    label: 'Mon profil',       icon: UserCircle,      section: 'main' },
  ]

  const links = user?.role === 'super_admin' ? linksAdmin
    : user?.role === 'enseignant'            ? linksEnseignant
    : linksApprenant

  // Regroupe par section pour afficher des séparateurs
  const sections = links.reduce((acc, link) => {
    if (!acc[link.section]) acc[link.section] = []
    acc[link.section].push(link)
    return acc
  }, {})

  const roleInfo = roleLabel[user?.role] || roleLabel.apprenant

  return (
    <div style={{
      width: collapsed ? 64 : 240,
      minHeight: '100vh',
      background: C.sidebarBg,
      borderRight: `1px solid ${C.sidebarBorder}`,
      display: 'flex', flexDirection: 'column',
      transition: 'width .3s ease',
      flexShrink: 0, position: 'sticky', top: 0,
      height: '100vh', overflowY: 'auto'
    }}>

      {/* ── Logo + collapse ── */}
      <div style={{
        padding: '20px 16px',
        borderBottom: `1px solid ${C.sidebarBorder}`,
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between'
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: `linear-gradient(135deg, ${C.brown}, ${C.gold || '#D4A853'})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 12px ${C.brown}40`
            }}>
              <Brain size={18} color="white"/>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 900, color: 'white', lineHeight: 1, letterSpacing: -.2 }}>
                EduSmart AI
              </p>
              <p style={{ fontSize: 10, color: roleInfo.color, marginTop: 2, fontWeight: 700 }}>
                {roleInfo.label}
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.brown}, ${C.gold || '#D4A853'})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Brain size={18} color="white"/>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)', padding: 4, borderRadius: 6,
          display: 'flex', alignItems: 'center',
          transition: 'color .2s'
        }}>
          {collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}
        </button>
      </div>

      {/* ── Avatar utilisateur ── */}
      {!collapsed && (
        <div style={{
          margin: '12px 10px',
          padding: '12px 14px',
          background: C.sidebarAccent || 'rgba(255,255,255,0.06)',
          borderRadius: 12,
          border: `1px solid ${C.sidebarBorder}`,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.brownLight}, ${C.brown})`,
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 13, fontWeight: 900, color: 'white',
            border: `2px solid ${roleInfo.color}40`
          }}>
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{
              fontSize: 13, fontWeight: 700, color: 'white',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {user?.prenom} {user?.nom}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
              {user?.email}
            </p>
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>

        {/* Section principale */}
        {sections.main && (
          <>
            {!collapsed && (
              <p style={{
                fontSize: 10, fontWeight: 700,
                color: 'rgba(255,255,255,0.25)',
                letterSpacing: '.1em', textTransform: 'uppercase',
                padding: '8px 6px 4px'
              }}>
                Navigation
              </p>
            )}
            {sections.main.map(link => {
              const Icon   = link.icon
              const active = location.pathname === link.path
              return (
                <button key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`sidebar-link ${active ? 'active' : ''}`}
                  style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
                  title={collapsed ? link.label : ''}
                >
                  <Icon size={16} style={{ flexShrink: 0 }}/>
                  {!collapsed && <span>{link.label}</span>}
                </button>
              )
            })}
          </>
        )}

        {/* Section admin */}
        {sections.admin && (
          <>
            {!collapsed && (
              <p style={{
                fontSize: 10, fontWeight: 700,
                color: '#D4A853',
                letterSpacing: '.1em', textTransform: 'uppercase',
                padding: '16px 6px 4px'
              }}>
                Administration
              </p>
            )}
            {sections.admin.map(link => {
              const Icon   = link.icon
              const active = location.pathname === link.path
              return (
                <button key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`sidebar-link ${active ? 'active' : ''}`}
                  style={{
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    borderLeft: active ? `3px solid #D4A853` : '3px solid transparent'
                  }}
                  title={collapsed ? link.label : ''}
                >
                  <Icon size={16} style={{ flexShrink: 0, color: '#D4A853' }}/>
                  {!collapsed && <span style={{ color: '#D4A853', fontWeight: 700 }}>{link.label}</span>}
                </button>
              )
            })}
          </>
        )}

        {/* Section test (super admin seulement — vues de test) */}
        {sections.test && (
          <>
            {!collapsed && (
              <>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '12px 6px' }}/>
                <p style={{
                  fontSize: 10, fontWeight: 700,
                  color: 'rgba(255,255,255,0.25)',
                  letterSpacing: '.1em', textTransform: 'uppercase',
                  padding: '0 6px 4px'
                }}>
                  Vues de test
                </p>
              </>
            )}
            {sections.test.map(link => {
              const Icon   = link.icon
              const active = location.pathname === link.path
              return (
                <button key={link.path}
                  onClick={() => navigate(link.path)}
                  className={`sidebar-link ${active ? 'active' : ''}`}
                  style={{ justifyContent: collapsed ? 'center' : 'flex-start', opacity: .7 }}
                  title={collapsed ? link.label : ''}
                >
                  <Icon size={16} style={{ flexShrink: 0 }}/>
                  {!collapsed && <span>{link.label}</span>}
                </button>
              )
            })}
          </>
        )}
      </nav>

      {/* ── Niveau apprenant (si applicable) ── */}
      {!collapsed && user?.niveau_label && (
        <div style={{
          margin: '0 10px 8px',
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 8, border: `1px solid ${C.sidebarBorder}`
        }}>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>Niveau</p>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>
            {user.niveau_label}
            {user.filiere_label && ` — ${user.filiere_label}`}
          </p>
        </div>
      )}

      {/* ── Déconnexion ── */}
      <div style={{ padding: '10px', borderTop: `1px solid ${C.sidebarBorder}` }}>
        <button
          onClick={() => { dispatch(logout()); navigate('/') }}
          className="sidebar-link"
          style={{
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'rgba(220,38,38,0.7)',
            gap: 8
          }}
          title={collapsed ? 'Déconnexion' : ''}
        >
          <LogOut size={16} style={{ flexShrink: 0 }}/>
          {!collapsed && <span>Déconnexion</span>}
        </button>
      </div>
    </div>
  )
}