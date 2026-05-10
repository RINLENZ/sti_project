import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../../store/authSlice'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import SensiaLogo from '../SensiaLogo'
import api from '../../services/api'
import {
  LayoutDashboard, BookOpen, LogOut,
  GraduationCap, ChevronLeft, ChevronRight,
  BarChart2, Bell, Shield, UserCircle,
  Map, Menu, X, Home, Sun, Moon, FileText, ClipboardList,
  Camera, Mic,
} from 'lucide-react'
import { C, useTheme } from '../../styles/theme.jsx'

const ROLE_INFO = {
  super_admin: { label: 'Super Admin', color: '#D4A853', emoji: '⚙️' },
  enseignant:  { label: 'Enseignant',  color: '#0D9373', emoji: '👨‍🏫' },
  apprenant:   { label: 'Apprenant',   color: '#C4865A', emoji: '🎓' },
}

function ECGWave({ width = 22, height = 14, color = 'white' }) {
  const w = width, h = height
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
      <polyline
        points={`0,${h/2} ${w*.18},${h/2} ${w*.28},${h*.82} ${w*.38},${h*.09} ${w*.48},${h*.82} ${w*.58},${h/2} ${w*.72},${h/2} ${w*.80},${h*.25} ${w*.87},${h/2} ${w},${h/2}`}
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

// ── Bouton nav réutilisable ───────────────────────────────────────
function NavBtn({ icon: Icon, label, active, onClick, color, collapsed, title, badge }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      title={collapsed ? (title || label) : ''}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', background: active
          ? `linear-gradient(90deg, ${color || C.brown}70, ${color || C.brown}20)`
          : hovered ? 'rgba(255,255,255,0.05)' : 'none',
        border: 'none',
        borderLeft: active ? `2px solid ${color || C.brownLight}` : '2px solid transparent',
        cursor: 'pointer',
        padding: collapsed ? '11px 0' : '9px 12px',
        display: 'flex', alignItems: 'center', gap: 10,
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: '0 9px 9px 0',
        color: active ? 'white' : hovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
        fontSize: 13, fontWeight: active ? 700 : 500,
        transition: 'all .15s', position: 'relative',
      }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Icon size={16} style={{ color: color || 'inherit' }}/>
        {badge > 0 && (
          <span style={{
            position: 'absolute', top: -5, right: -6,
            background: '#EF4444', color: 'white',
            borderRadius: '50%', width: 14, height: 14,
            fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1.5px solid rgba(0,0,0,0.3)',
          }}>{badge > 9 ? '9+' : badge}</span>
        )}
      </div>
      {!collapsed && <span style={{ color: color || 'inherit', flex: 1 }}>{label}</span>}
      {!collapsed && badge > 0 && (
        <span style={{ background: '#EF4444', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 800 }}>{badge}</span>
      )}
    </button>
  )
}

// ══ SIDEBAR DESKTOP ═══════════════════════════════════════════════
function DesktopSidebar({ collapsed, setCollapsed, activeView, onViewChange }) {
  const { user } = useSelector(s => s.auth)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useTheme()
  const [epBadge, setEpBadge] = useState(0)

  useEffect(() => {
    if (user?.role !== 'apprenant') return
    api.get('/api/examens/disponibles').then(({ data }) => {
      setEpBadge(data.filter(e => !e.soumis).length)
    }).catch(() => {})
  }, [user?.role])

  const [nbNonLues, setNbNonLues] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [panelPos, setPanelPos] = useState({ bottom: 60, left: 260 })
  const bellRef = useRef(null)

  useEffect(() => {
    if (!user) return
    function load() {
      api.get('/api/notifications?limit=20').then(({ data }) => {
        setNbNonLues(data.nb_non_lues)
        setNotifications(data.notifications)
      }).catch(() => {})
    }
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [user?.id])

  function toggleNotif() {
    if (!notifOpen && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect()
      setPanelPos({
        bottom: window.innerHeight - rect.top + 6,
        left: rect.right + 10,
      })
    }
    setNotifOpen(o => !o)
  }

  function markRead(notifId) {
    api.put(`/api/notifications/${notifId}/lire`).then(() => {
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, lu: true } : n))
      setNbNonLues(prev => Math.max(0, prev - 1))
    }).catch(() => {})
  }

  function markAllRead() {
    api.put('/api/notifications/tout-lire').then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
      setNbNonLues(0)
    }).catch(() => {})
  }

  const roleInfo = ROLE_INFO[user?.role] || ROLE_INFO.apprenant

  // ── Définition des liens par rôle ──────────────────────────────
  const NAV = {
    super_admin: {
      main: [],
      admin: [
        { path: '/admin',             label: 'Gestion des cours',    icon: Shield   },
        { path: '/admin/referentiel', label: 'Référentiel éducatif', icon: BookOpen },
      ],
      collect: [
        { path: '/collect-emotions', label: 'Collecte émotions', icon: Camera },
        { path: '/collect-audio',    label: 'Collecte audio',    icon: Mic    },
      ],
      test: [
        { path: '/dashboard', label: 'Vue apprenant',  icon: GraduationCap },
        { path: '/prof',      label: 'Vue enseignant', icon: BarChart2     },
      ],
    },
    enseignant: {
      main: [
        { path: '/prof',          label: 'Suivi des apprenants', icon: BarChart2  },
        { path: '/prof/examens',  label: 'Épreuves IA',          icon: FileText   },
        { path: '/profil',        label: 'Mon profil',            icon: UserCircle },
      ],
    },
    apprenant: {
      main: [
        { path: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard  },
        { path: '/epreuves',  label: 'Mes épreuves',    icon: ClipboardList    },
        { path: '/profil',    label: 'Mon profil',       icon: UserCircle       },
      ],
    },
  }

  const nav = NAV[user?.role] || NAV.apprenant

  return (
    <div style={{
      width: collapsed ? 64 : 248,
      minHeight: '100vh', height: '100vh',
      background: C.sidebarBg,
      borderRight: `1px solid ${C.sidebarBorder}`,
      display: 'flex', flexDirection: 'column',
      transition: 'width .3s cubic-bezier(.4,0,.2,1)',
      flexShrink: 0, position: 'sticky', top: 0,
      overflowY: 'auto', overflowX: 'hidden',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>

      {/* ── Logo ── */}
      <div style={{ padding: '16px 14px', borderBottom: `1px solid ${C.sidebarBorder}`, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 8 }}>
        {!collapsed ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: `linear-gradient(135deg, ${C.brown}, ${C.gold})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 16px ${C.brown}60`, flexShrink: 0 }}>
              <ECGWave/>
            </div>
            <div>
              <SensiaLogo size={20} light={true}/>
              <p style={{ fontSize: 10, color: roleInfo.color, margin: 0, fontWeight: 700 }}>
                {roleInfo.emoji} {roleInfo.label}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: 11, background: `linear-gradient(135deg, ${C.brown}, ${C.gold})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ECGWave/>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: 6, borderRadius: 8, display: 'flex', flexShrink: 0, transition: 'all .2s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'white' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
        >
          {collapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
        </button>
      </div>

      {/* ── Avatar ── */}
      {!collapsed && (
        <div style={{ margin: '12px 12px 0', padding: '11px 13px', background: 'rgba(255,255,255,0.05)', borderRadius: 12, border: `1px solid ${C.sidebarBorder}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg, ${C.brownLight}, ${C.brown})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: 'white', border: `2px solid ${roleInfo.color}40` }}>
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
              {user?.prenom} {user?.nom}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: 0 }}>{user?.email}</p>
          </div>
        </div>
      )}

      {/* ── Nav ── */}
      <nav style={{ flex: 1, padding: '12px 0 8px', overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}>
        <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>

          {/* Section principale */}
          {nav.main?.length > 0 && (
            <>
              {!collapsed && <p style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.2)', letterSpacing: '.12em', textTransform: 'uppercase', padding: '6px 6px 4px', margin: 0 }}>Navigation</p>}
              {nav.main.map(l => (
                <NavBtn key={l.path} icon={l.icon} label={l.label} collapsed={collapsed}
                  active={activeView === 'main' && location.pathname === l.path}
                  badge={l.path === '/epreuves' ? epBadge : 0}
                  onClick={() => { onViewChange('main'); navigate(l.path) }}
                />
              ))}
            </>
          )}

          {/* Parcours (apprenant uniquement) */}
          {user?.role === 'apprenant' && (
            <NavBtn
              icon={Map} label="Parcours" collapsed={collapsed}
              active={activeView === 'parcours'}
              color={C.gold}
              onClick={() => onViewChange(activeView === 'parcours' ? 'main' : 'parcours')}
            />
          )}

          {/* Section admin */}
          {nav.admin?.length > 0 && (
            <>
              {!collapsed && <p style={{ fontSize: 9, fontWeight: 800, color: C.gold, letterSpacing: '.12em', textTransform: 'uppercase', padding: '14px 6px 4px', margin: 0 }}>Administration</p>}
              {nav.admin.map(l => (
                <NavBtn key={l.path} icon={l.icon} label={l.label} collapsed={collapsed} color={C.gold}
                  active={location.pathname === l.path}
                  onClick={() => { onViewChange('main'); navigate(l.path) }}
                />
              ))}
            </>
          )}

          {/* Section collecte de données (super_admin) */}
          {nav.collect?.length > 0 && (
            <>
              {!collapsed && <p style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.18)', letterSpacing: '.12em', textTransform: 'uppercase', padding: '14px 6px 4px', margin: 0 }}>Collecte données</p>}
              {nav.collect.map(l => (
                <NavBtn key={l.path} icon={l.icon} label={l.label} collapsed={collapsed}
                  active={location.pathname === l.path}
                  onClick={() => { onViewChange('main'); navigate(l.path) }}
                />
              ))}
            </>
          )}

          {/* Section test */}
          {nav.test?.length > 0 && (
            <>
              {!collapsed && (
                <>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '10px 4px' }}/>
                  <p style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.18)', letterSpacing: '.12em', textTransform: 'uppercase', padding: '0 6px 4px', margin: 0 }}>Vues de test</p>
                </>
              )}
              {nav.test.map(l => (
                <NavBtn key={l.path} icon={l.icon} label={l.label} collapsed={collapsed}
                  active={location.pathname === l.path}
                  onClick={() => { onViewChange('main'); navigate(l.path) }}
                />
              ))}
            </>
          )}
        </div>
      </nav>

      {/* ── Niveau apprenant ── */}
      {!collapsed && user?.niveau_label && (
        <div style={{ margin: '0 12px 8px', padding: '8px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: `1px solid ${C.sidebarBorder}` }}>
          <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.22)', fontWeight: 700, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '.08em' }}>Niveau</p>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            {user.niveau_label}{user.filiere_label && ` — ${user.filiere_label}`}
          </p>
        </div>
      )}

      {/* ── Notification flyout panel (portail — échappe overflow/stacking sidebar) ── */}
      {notifOpen && createPortal(
        <>
          <div onClick={() => setNotifOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }}/>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'fixed',
            left: panelPos.left,
            bottom: panelPos.bottom,
            width: 300,
            maxHeight: '60vh',
            background: C.sidebarBg,
            border: `1px solid ${C.sidebarBorder}`,
            borderRadius: 14,
            boxShadow: '0 12px 48px rgba(0,0,0,0.65)',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: "'DM Sans', system-ui, sans-serif",
          }}>
            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.sidebarBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>Notifications</span>
              {nbNonLues > 0 && (
                <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.brownLight, fontSize: 11, fontWeight: 600, padding: 0 }}>
                  Tout marquer lu
                </button>
              )}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {notifications.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '24px 14px', margin: 0 }}>Aucune notification</p>
              ) : notifications.map(n => (
                <button key={n.id}
                  onClick={() => !n.lu && markRead(n.id)}
                  style={{
                    width: '100%', padding: '10px 14px',
                    background: n.lu ? 'none' : 'rgba(255,255,255,0.05)',
                    border: 'none', borderBottom: `1px solid ${C.sidebarBorder}`,
                    cursor: n.lu ? 'default' : 'pointer', textAlign: 'left',
                    display: 'flex', flexDirection: 'column', gap: 2, transition: 'background .15s',
                  }}
                  onMouseEnter={e => { if (!n.lu) e.currentTarget.style.background = 'rgba(255,255,255,0.09)' }}
                  onMouseLeave={e => { if (!n.lu) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: n.lu ? 500 : 700, color: n.lu ? 'rgba(255,255,255,0.45)' : 'white', lineHeight: 1.3 }}>{n.titre}</span>
                    {!n.lu && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.brownLight, flexShrink: 0 }}/>}
                  </div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.4 }}>{n.message}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 2 }}>
                    {n.created_at ? new Date(n.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* ── Thème + Notifications + Déconnexion ── */}
      <div style={{ padding: '10px 10px', borderTop: `1px solid ${C.sidebarBorder}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          ref={bellRef}
          onClick={toggleNotif}
          title={collapsed ? `Notifications (${nbNonLues})` : ''}
          style={{ width: '100%', background: notifOpen ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: notifOpen ? 'white' : 'rgba(255,255,255,0.55)', padding: collapsed ? '9px 0' : '8px 12px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start', fontSize: 13, fontWeight: 500, transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white' }}
          onMouseLeave={e => { e.currentTarget.style.background = notifOpen ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = notifOpen ? 'white' : 'rgba(255,255,255,0.55)' }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Bell size={15}/>
            {nbNonLues > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -6, background: '#EF4444', color: 'white', borderRadius: '50%', width: 14, height: 14, fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(0,0,0,0.3)' }}>
                {nbNonLues > 9 ? '9+' : nbNonLues}
              </span>
            )}
          </div>
          {!collapsed && <span style={{ flex: 1 }}>Notifications</span>}
          {!collapsed && nbNonLues > 0 && (
            <span style={{ background: '#EF4444', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 800 }}>{nbNonLues}</span>
          )}
        </button>
        <button onClick={toggleTheme} title={isDark ? 'Thème clair' : 'Thème sombre'}
          style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: 'rgba(255,255,255,0.55)', padding: collapsed ? '9px 0' : '8px 12px', borderRadius: 9, display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start', fontSize: 13, fontWeight: 500, transition: 'all .15s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'white' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)' }}
        >
          {isDark ? <Sun size={15} style={{ flexShrink: 0 }}/> : <Moon size={15} style={{ flexShrink: 0 }}/>}
          {!collapsed && <span>{isDark ? 'Thème clair' : 'Thème sombre'}</span>}
        </button>
        <NavBtn
          icon={LogOut} label="Déconnexion" collapsed={collapsed}
          active={false} color="rgba(220,38,38,0.7)"
          onClick={() => { dispatch(logout()); navigate('/') }}
        />
      </div>
    </div>
  )
}

// ══ BOTTOM NAV MOBILE ════════════════════════════════════════════
function MobileBottomNav({ activeView, onViewChange }) {
  const { user }   = useSelector(s => s.auth)
  const dispatch   = useDispatch()
  const navigate   = useNavigate()
  const location   = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [epBadge,  setEpBadge]  = useState(0)
  const { isDark, toggleTheme } = useTheme()
  const [nbNonLues, setNbNonLues] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [notifPanelOpen, setNotifPanelOpen] = useState(false)

  useEffect(() => {
    if (user?.role !== 'apprenant') return
    api.get('/api/examens/disponibles').then(({ data }) => {
      setEpBadge(data.filter(e => !e.soumis).length)
    }).catch(() => {})
  }, [user?.role])

  useEffect(() => {
    if (!user) return
    function load() {
      api.get('/api/notifications?limit=20').then(({ data }) => {
        setNbNonLues(data.nb_non_lues)
        setNotifications(data.notifications)
      }).catch(() => {})
    }
    load()
    const id = setInterval(load, 60000)
    return () => clearInterval(id)
  }, [user?.id])

  function markReadMobile(notifId) {
    api.put(`/api/notifications/${notifId}/lire`).then(() => {
      setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, lu: true } : n))
      setNbNonLues(prev => Math.max(0, prev - 1))
    }).catch(() => {})
  }

  function markAllReadMobile() {
    api.put('/api/notifications/tout-lire').then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
      setNbNonLues(0)
    }).catch(() => {})
  }

  const roleInfo = ROLE_INFO[user?.role] || ROLE_INFO.apprenant

  // Tabs selon rôle
  const TABS = {
    apprenant: [
      { id: 'home',     icon: Home,          label: 'Accueil',  action: 'nav', path: '/dashboard' },
      { id: 'parcours', icon: Map,           label: 'Parcours', action: 'parcours'                },
      { id: 'epreuves', icon: ClipboardList, label: 'Épreuves', action: 'nav', path: '/epreuves' },
      { id: 'profil',   icon: UserCircle,    label: 'Profil',   action: 'nav', path: '/profil'   },
      { id: 'menu',     icon: Menu,          label: 'Menu',     action: 'menu'                   },
    ],
    enseignant: [
      { id: 'suivi',    icon: BarChart2,  label: 'Suivi',    action: 'nav', path: '/prof'         },
      { id: 'examens',  icon: FileText,   label: 'Épreuves', action: 'nav', path: '/prof/examens' },
      { id: 'profil',   icon: UserCircle, label: 'Profil',   action: 'nav', path: '/profil'       },
      { id: 'menu',     icon: Menu,       label: 'Menu',     action: 'menu'                        },
    ],
    super_admin: [
      { id: 'admin', icon: Shield,   label: 'Admin',  action: 'nav', path: '/admin'             },
      { id: 'ref',   icon: BookOpen, label: 'Référ.', action: 'nav', path: '/admin/referentiel' },
      { id: 'menu',  icon: Menu,     label: 'Menu',   action: 'menu'                            },
    ],
  }
  const tabs = TABS[user?.role] || TABS.apprenant

  function handleTab(tab) {
    if (tab.action === 'nav') {
      onViewChange('main')
      navigate(tab.path)
      setMenuOpen(false)
    } else if (tab.action === 'parcours') {
      onViewChange(activeView === 'parcours' ? 'main' : 'parcours')
      setMenuOpen(false)
    } else if (tab.action === 'menu') {
      setMenuOpen(o => !o)
    }
  }

  function isActive(tab) {
    if (tab.action === 'parcours') return activeView === 'parcours'
    if (tab.action === 'menu')     return menuOpen
    if (tab.path)                  return activeView === 'main' && location.pathname === tab.path
    return false
  }

  // Menu links pour le drawer
  const menuLinks = [
    { path: '/dashboard',         label: 'Tableau de bord',     icon: LayoutDashboard, show: user?.role === 'apprenant' },
    { path: '/epreuves',          label: 'Mes épreuves',         icon: ClipboardList,   show: user?.role === 'apprenant' },
    { path: '/prof',              label: 'Suivi des apprenants', icon: BarChart2,       show: ['enseignant','super_admin'].includes(user?.role) },
    { path: '/prof/examens',      label: 'Épreuves IA',          icon: FileText,        show: user?.role === 'enseignant' },
    { path: '/admin',             label: 'Gestion des cours',    icon: Shield,          show: user?.role === 'super_admin' },
    { path: '/admin/referentiel', label: 'Référentiel',          icon: BookOpen,        show: user?.role === 'super_admin' },
    { path: '/collect-emotions',  label: 'Collecte émotions',    icon: Camera,          show: user?.role === 'super_admin' },
    { path: '/collect-audio',     label: 'Collecte audio',       icon: Mic,             show: user?.role === 'super_admin' },
    { path: '/profil',            label: 'Mon profil',           icon: UserCircle,      show: true },
  ].filter(l => l.show)

  return (
    <>
      {/* Overlay menu */}
      {menuOpen && (
        <div onClick={() => setMenuOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 998, backdropFilter: 'blur(3px)' }}/>
      )}

      {/* Drawer menu */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 64,
        height: menuOpen ? 'auto' : 0,
        maxHeight: menuOpen ? '70vh' : 0,
        background: C.sidebarBg,
        borderRadius: '20px 20px 0 0',
        border: menuOpen ? `1px solid ${C.sidebarBorder}` : 'none',
        borderBottom: 'none',
        overflow: 'hidden',
        transition: 'max-height .35s cubic-bezier(.4,0,.2,1)',
        zIndex: 999,
        boxShadow: menuOpen ? '0 -8px 40px rgba(0,0,0,0.5)' : 'none',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        {/* Handle + Header */}
        <div style={{ padding: '14px 18px 12px', borderBottom: `1px solid ${C.sidebarBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 9, background: `linear-gradient(135deg, ${C.brown}, ${C.gold})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ECGWave width={18} height={12}/>
            </div>
            <SensiaLogo size={18} light={true}/>
          </div>
          <button onClick={() => setMenuOpen(false)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: 7, cursor: 'pointer', color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
            <X size={15}/>
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '12px 14px 16px' }}>
          {/* Profil card */}
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.05)', borderRadius: 14, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: `linear-gradient(135deg, ${C.brownLight}, ${C.brown})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: 'white' }}>
              {user?.prenom?.[0]}{user?.nom?.[0]}
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'white', margin: 0 }}>{user?.prenom} {user?.nom}</p>
              <p style={{ fontSize: 11, color: roleInfo.color, margin: '2px 0 0', fontWeight: 600 }}>{roleInfo.emoji} {roleInfo.label}</p>
              {user?.niveau_label && <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', margin: '2px 0 0' }}>{user.niveau_label}{user.filiere_label && ` · ${user.filiere_label}`}</p>}
            </div>
          </div>

          {/* Notifications accordion */}
          <div style={{ marginBottom: 8 }}>
            <button
              onClick={() => setNotifPanelOpen(o => !o)}
              style={{ width: '100%', padding: '10px 14px', background: notifPanelOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 500 }}
            >
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Bell size={16}/>
                {nbNonLues > 0 && (
                  <span style={{ position: 'absolute', top: -5, right: -6, background: '#EF4444', color: 'white', borderRadius: '50%', width: 14, height: 14, fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(0,0,0,0.3)' }}>
                    {nbNonLues > 9 ? '9+' : nbNonLues}
                  </span>
                )}
              </div>
              <span style={{ flex: 1 }}>Notifications</span>
              {nbNonLues > 0 && <span style={{ background: '#EF4444', color: 'white', borderRadius: 10, padding: '1px 6px', fontSize: 9, fontWeight: 800 }}>{nbNonLues}</span>}
            </button>
            {notifPanelOpen && (
              <div style={{ marginTop: 4, background: 'rgba(0,0,0,0.2)', borderRadius: 10, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                {nbNonLues > 0 && (
                  <div style={{ padding: '8px 14px', borderBottom: `1px solid ${C.sidebarBorder}`, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={markAllReadMobile} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.brownLight, fontSize: 11, fontWeight: 600, padding: 0 }}>
                      Tout marquer lu
                    </button>
                  </div>
                )}
                {notifications.length === 0 ? (
                  <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12, padding: '16px 14px', margin: 0 }}>Aucune notification</p>
                ) : notifications.map(n => (
                  <button key={n.id} onClick={() => !n.lu && markReadMobile(n.id)}
                    style={{ width: '100%', padding: '10px 14px', background: n.lu ? 'none' : 'rgba(255,255,255,0.05)', border: 'none', borderBottom: `1px solid rgba(255,255,255,0.06)`, cursor: n.lu ? 'default' : 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 2 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: n.lu ? 500 : 700, color: n.lu ? 'rgba(255,255,255,0.4)' : 'white' }}>{n.titre}</span>
                      {!n.lu && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.brownLight, flexShrink: 0 }}/>}
                    </div>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{n.message}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Liens */}
          {menuLinks.map(link => {
            const Icon   = link.icon
            const active = activeView === 'main' && location.pathname === link.path
            return (
              <button key={link.path}
                onClick={() => { onViewChange('main'); navigate(link.path); setMenuOpen(false) }}
                style={{
                  width: '100%', padding: '12px 14px', marginBottom: 4,
                  background: active ? `${C.brown}50` : 'rgba(255,255,255,0.04)',
                  border: 'none', borderLeft: active ? `3px solid ${C.brownLight}` : '3px solid transparent',
                  borderRadius: 10, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 12,
                  color: active ? 'white' : 'rgba(255,255,255,0.65)',
                  fontSize: 14, fontWeight: active ? 700 : 500, transition: 'all .15s',
                }}
              >
                <Icon size={16} style={{ flexShrink: 0 }}/>{link.label}
              </button>
            )
          })}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '10px 0' }}/>

          <button onClick={toggleTheme}
            style={{ width: '100%', padding: '12px 14px', background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: 500, marginBottom: 4 }}
          >
            {isDark ? <Sun size={16} style={{ flexShrink: 0 }}/> : <Moon size={16} style={{ flexShrink: 0 }}/>}
            {isDark ? 'Thème clair' : 'Thème sombre'}
          </button>
          <button
            onClick={() => { dispatch(logout()); navigate('/'); setMenuOpen(false) }}
            style={{ width: '100%', padding: '12px 14px', background: 'rgba(220,38,38,0.08)', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, color: 'rgba(220,38,38,0.8)', fontSize: 14, fontWeight: 600 }}
          >
            <LogOut size={16} style={{ flexShrink: 0 }}/> Déconnexion
          </button>
        </div>
      </div>

      {/* ── Barre de navigation ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: 64,
        background: C.sidebarBg,
        borderTop: `1px solid ${C.sidebarBorder}`,
        display: 'flex', alignItems: 'stretch',
        zIndex: 1000,
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -4px 24px rgba(0,0,0,0.35)',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        {tabs.map(tab => {
          const Icon   = tab.icon
          const active = isActive(tab)
          return (
            <button key={tab.id} onClick={() => handleTab(tab)} style={{
              flex: 1, background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 4, color: active ? C.brownLight : 'rgba(255,255,255,0.32)',
              transition: 'all .15s', position: 'relative',
            }}>
              {/* Indicateur top */}
              {active && (
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2, borderRadius: '0 0 3px 3px', background: `linear-gradient(90deg, ${C.brown}, ${C.gold})` }}/>
              )}
              <div style={{ width: 34, height: 26, borderRadius: 8, background: active ? `${C.brown}45` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s', position: 'relative' }}>
                <Icon size={17}/>
                {tab.id === 'epreuves' && epBadge > 0 && (
                  <span style={{ position: 'absolute', top: -3, right: -3, background: '#EF4444', color: 'white', borderRadius: '50%', width: 14, height: 14, fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(0,0,0,0.4)' }}>
                    {epBadge > 9 ? '9+' : epBadge}
                  </span>
                )}
                {tab.id === 'menu' && nbNonLues > 0 && (
                  <span style={{ position: 'absolute', top: -3, right: -3, background: '#EF4444', color: 'white', borderRadius: '50%', width: 14, height: 14, fontSize: 8, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(0,0,0,0.4)' }}>
                    {nbNonLues > 9 ? '9+' : nbNonLues}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>{tab.label}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

// ══ EXPORT ═══════════════════════════════════════════════════════
export default function Sidebar({ collapsed, setCollapsed, mobile, activeView, onViewChange }) {
  if (mobile) return <MobileBottomNav activeView={activeView} onViewChange={onViewChange}/>
  return <DesktopSidebar collapsed={collapsed} setCollapsed={setCollapsed} activeView={activeView} onViewChange={onViewChange}/>
}