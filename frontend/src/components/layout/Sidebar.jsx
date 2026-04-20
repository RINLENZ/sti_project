import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../../store/authSlice'
import { C } from '../../styles/theme'
import {
  LayoutDashboard, BookOpen, Users, Settings,
  LogOut, GraduationCap, ChevronLeft, ChevronRight,
  BarChart2, Shield
} from 'lucide-react'

export default function Sidebar({ collapsed, setCollapsed }) {
  const { user }  = useSelector(s => s.auth)
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const location  = useLocation()

  const linksApprenant = [
    { path: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { path: '/profil',    label: 'Mon profil',       icon: Users },
  ]

  const linksEnseignant = [
    { path: '/prof',  label: 'Suivi classe',    icon: BarChart2 },
    { path: '/admin', label: 'Gestion cours',   icon: BookOpen },
  ]

 const linksAdmin = [
  { path: '/admin',     label: 'Administration', icon: Shield },
  { path: '/dashboard', label: 'Vue apprenant',  icon: GraduationCap },
]

  const links = user?.role === 'super_admin'    ? linksAdmin
  : user?.role === 'enseignant' ? linksEnseignant
  : linksApprenant

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

      {/* Logo */}
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
              background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <GraduationCap size={18} color="white"/>
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 900, color: 'white', lineHeight: 1 }}>
                EduSmart AI
              </p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                {user?.niveau || user?.role}
              </p>
            </div>
          </div>
        )}
        {collapsed && (
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <GraduationCap size={18} color="white"/>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'rgba(255,255,255,0.4)', padding: 4,
          display: collapsed ? 'none' : 'block'
        }}>
          <ChevronLeft size={16}/>
        </button>
      </div>

      {/* Avatar utilisateur */}
      {!collapsed && (
        <div style={{
          margin: '16px 12px',
          padding: '12px 14px',
          background: C.sidebarAccent,
          borderRadius: 12,
          border: `1px solid ${C.sidebarBorder}`,
          display: 'flex', alignItems: 'center', gap: 10
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: `linear-gradient(135deg, ${C.brownLight}, ${C.brown})`,
            display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 13, fontWeight: 900, color: 'white'
          }}>
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div style={{ overflow: 'hidden' }}>
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

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!collapsed && (
          <p style={{
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)',
            letterSpacing: '.08em', textTransform: 'uppercase',
            padding: '8px 6px 4px'
          }}>
            Navigation
          </p>
        )}
        {links.map(link => {
          const Icon    = link.icon
          const active  = location.pathname === link.path
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
      </nav>

      {/* Bouton déconnexion */}
      <div style={{ padding: '12px 10px', borderTop: `1px solid ${C.sidebarBorder}` }}>
        <button
          onClick={() => { dispatch(logout()); navigate('/login') }}
          className="sidebar-link"
          style={{
            width: '100%',
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'rgba(220,38,38,0.7)'
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