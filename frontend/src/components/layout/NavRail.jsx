import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../../store/authSlice'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import api from '../../services/api'
import SearchModal from '../SearchModal'
import {
  LayoutDashboard, BookOpen, LogOut, GraduationCap,
  BarChart2, Bell, Shield, UserCircle, Map,
  Sun, Moon, FileText, ClipboardList,
  Camera, Mic, FlaskConical, PenLine, ChevronRight, MessageCircle, Users, Search,
} from 'lucide-react'
import { useTheme } from '../../styles/theme.jsx'
import { radius, shadow, motion, space, type, weight, z } from '../../design-system/tokens'
import SensiaLogo from '../SensiaLogo'
import { useNotifications } from '../../contexts/NotificationsContext'

// ─── Constantes ───────────────────────────────────────────────────────────────
const RAIL_W = 64

const ROLE_INFO = {
  super_admin: { label: 'Super Admin', color: '#D4A853' },
  enseignant:  { label: 'Enseignant',  color: '#0D9373' },
  apprenant:   { label: 'Apprenant',   color: '#C4865A' },
}

function ECGWave({ color = 'white' }) {
  return (
    <svg width={22} height={14} viewBox="0 0 22 14" style={{ display: 'block' }}>
      <polyline
        points="0,7 3.96,7 6.16,11.48 8.36,1.26 10.56,11.48 12.76,7 15.84,7 17.6,3.5 19.14,7 22,7"
        fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  )
}

// ─── NavItem — bouton avec tooltip ────────────────────────────────────────────
function NavItem({ icon: Icon, label, active, onClick, accentColor, badge }) {
  const { C } = useTheme()
  const [hovered, setHovered] = useState(false)
  const col = accentColor ?? C.brownLight

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width:          '100%',
          height:          44,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     active
            ? `${col}22`
            : hovered
            ? 'rgba(255,255,255,0.07)'
            : 'transparent',
          border:         'none',
          borderRadius:   radius.md,
          cursor:         'pointer',
          position:       'relative',
          transition:     `background ${motion.fast_out}`,
          outline:        'none',
        }}
      >
        {/* Pill indicateur actif */}
        {active && (
          <div style={{
            position:   'absolute',
            left:        0,
            top:        '50%',
            transform:  'translateY(-50%)',
            width:       3,
            height:      24,
            borderRadius: `0 ${radius.sm}px ${radius.sm}px 0`,
            background:  `linear-gradient(180deg, ${col}, ${col}88)`,
          }} aria-hidden="true" />
        )}

        {/* Icône */}
        <div style={{ position: 'relative' }}>
          <Icon
            size={18}
            color={active ? col : hovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.42)'}
            style={{ transition: `color ${motion.fast_out}`, display: 'block' }}
          />
          {badge > 0 && (
            <span style={{
              position:       'absolute',
              top:            -5, right: -6,
              minWidth:        14, height: 14,
              borderRadius:    radius.pill,
              background:      '#EF4444',
              color:           'white',
              fontSize:        8,
              fontWeight:      weight.black,
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              padding:        '0 3px',
              border:         '1.5px solid rgba(0,0,0,0.4)',
              lineHeight:      1,
            }} aria-label={`${badge} élément(s)`}>
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </div>
      </button>

      {/* Tooltip à droite */}
      {hovered && (
        <div style={{
          position:      'fixed',
          left:           RAIL_W + 8,
          top:            'auto',
          transform:     'translateY(-50%)',
          pointerEvents: 'none',
          zIndex:         z.tooltip,
          // On positionne via JS ref dans un vrai usage, ici on reste en approach CSS simple
          // Le tooltip suit la souris grâce au positionnement "fixed" sans top défini —
          // le navigateur le place relativement au contexte stacking; on le centre via
          // un wrapper positionné sur l'item.
        }}>
          <TooltipBubble>{label}</TooltipBubble>
        </div>
      )}
    </div>
  )
}

// On utilise un tooltip positionné via l'item parent
function RailItemWithTooltip({ icon: Icon, label, active, onClick, accentColor, badge }) {
  const { C } = useTheme()
  const [hovered, setHovered] = useState(false)
  const itemRef = useRef(null)
  const [tooltipTop, setTooltipTop] = useState(0)
  const col = accentColor ?? C.brownLight

  function handleEnter() {
    setHovered(true)
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect()
      setTooltipTop(rect.top + rect.height / 2)
    }
  }

  return (
    <div ref={itemRef} style={{ position: 'relative' }}>
      <button
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setHovered(false)}
        style={{
          width:          '100%',
          height:          44,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          background:     active
            ? `${col}22`
            : hovered
            ? 'rgba(255,255,255,0.07)'
            : 'transparent',
          border:         'none',
          borderRadius:   radius.md,
          cursor:         'pointer',
          transition:     `background ${motion.fast_out}`,
          outline:        'none',
        }}
      >
        {active && (
          <div style={{
            position:    'absolute',
            left:         0, top: '50%',
            transform:   'translateY(-50%)',
            width:        3, height: 24,
            borderRadius: `0 ${radius.sm}px ${radius.sm}px 0`,
            background:  `linear-gradient(180deg, ${col}, ${col}88)`,
          }} aria-hidden="true" />
        )}

        <div style={{ position: 'relative' }}>
          <Icon
            size={18}
            color={active ? col : hovered ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.42)'}
            style={{ transition: `color ${motion.fast_out}`, display: 'block' }}
          />
          {badge > 0 && (
            <span style={{
              position:       'absolute', top: -5, right: -6,
              minWidth:        14, height: 14, borderRadius: radius.pill,
              background:      '#EF4444', color: 'white',
              fontSize:        8, fontWeight: weight.black,
              display:        'flex', alignItems: 'center', justifyContent: 'center',
              padding:        '0 3px', border: '1.5px solid rgba(0,0,0,0.4)', lineHeight: 1,
            }}>
              {badge > 9 ? '9+' : badge}
            </span>
          )}
        </div>
      </button>

      {/* Tooltip via portail */}
      {hovered && createPortal(
        <div style={{
          position:      'fixed',
          left:           RAIL_W + 8,
          top:            tooltipTop,
          transform:     'translateY(-50%)',
          pointerEvents: 'none',
          zIndex:         z.tooltip,
          animation:     'fadeIn 0.1s ease',
        }}>
          <TooltipBubble>{label}</TooltipBubble>
        </div>,
        document.body
      )}
    </div>
  )
}

function TooltipBubble({ children }) {
  const { C } = useTheme()
  return (
    <div style={{
      background:    '#1A1207',
      color:         'rgba(255,255,255,0.92)',
      fontSize:       type.sm,
      fontWeight:     weight.semibold,
      padding:       `${space[1]}px ${space[3]}px`,
      borderRadius:   radius.md,
      whiteSpace:    'nowrap',
      boxShadow:      shadow.lg,
      border:        '1px solid rgba(255,255,255,0.08)',
      display:       'flex',
      alignItems:    'center',
      gap:            space[1],
    }}>
      <ChevronRight size={10} color="rgba(255,255,255,0.35)" aria-hidden="true" />
      {children}
    </div>
  )
}

// ─── Séparateur ───────────────────────────────────────────────────────────────
function Divider() {
  return (
    <div style={{
      height:     1,
      background: 'rgba(255,255,255,0.07)',
      margin:    `${space[2]}px ${space[2]}px`,
      borderRadius: radius.pill,
    }} aria-hidden="true" />
  )
}

// ─── Avatar initiales ─────────────────────────────────────────────────────────
function Avatar({ user, roleColor, size = 34 }) {
  return (
    <div style={{
      width:          size, height: size,
      borderRadius:   radius.md,
      background:    `linear-gradient(135deg, rgba(196,134,90,0.6), rgba(107,58,42,0.8))`,
      display:       'flex',
      alignItems:    'center',
      justifyContent: 'center',
      fontSize:       size > 30 ? 12 : 10,
      fontWeight:     weight.extrabold,
      color:          'white',
      border:        `2px solid ${roleColor ?? '#C4865A'}30`,
      flexShrink:     0,
      userSelect:    'none',
    }}>
      {user?.prenom?.[0]}{user?.nom?.[0]}
    </div>
  )
}

// ─── URL de destination par type de notification ──────────────────────────────
function getNotifUrl(notif) {
  switch (notif.type) {
    case 'badge_debloque':       return '/profil'
    case 'competence_maitrisee': return '/dashboard'
    case 'competence_progres':   return '/dashboard'
    case 'session_terminee':     return '/dashboard'
    case 'enseignant_lie':       return '/profil'
    case 'apprenant_lie':        return '/prof'
    case 'apprenant_session':    return '/prof'
    case 'apprenant_decrocheur': return '/prof'
    default:                     return null
  }
}

// ─── Panel notifications ───────────────────────────────────────────────────────
function NotifPanel({ notifications, nbNonLues, onMarkRead, onMarkAll, onClose, anchorRect }) {
  const { C } = useTheme()
  const navigate = useNavigate()

  const top  = Math.max(8, anchorRect ? anchorRect.top - 8 : 100)
  const left = RAIL_W + 8

  function handleClick(notif) {
    if (!notif.lu) onMarkRead(notif.id)
    const url = getNotifUrl(notif)
    if (url) { navigate(url); onClose() }
  }

  return createPortal(
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: z.overlay }} />
      <div
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Notifications"
        style={{
          position:      'fixed',
          top:            Math.min(top, window.innerHeight - 400 - 16),
          left:           left,
          width:          320,
          maxHeight:     '65vh',
          background:     C.sidebarBg,
          border:        '1px solid rgba(255,255,255,0.1)',
          borderRadius:   radius.lg,
          boxShadow:      '0 16px 56px rgba(0,0,0,0.7)',
          zIndex:         z.modal,
          display:       'flex',
          flexDirection: 'column',
          fontFamily:    "'DM Sans', system-ui, sans-serif",
          animation:     'scaleIn 0.15s ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding:       `${space[3]}px ${space[4]}px`,
          borderBottom:  '1px solid rgba(255,255,255,0.08)',
          display:       'flex',
          alignItems:    'center',
          justifyContent: 'space-between',
          flexShrink:     0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: space[2] }}>
            <span style={{ fontSize: type.md, fontWeight: weight.bold, color: 'white' }}>Notifications</span>
            {nbNonLues > 0 && (
              <span style={{ background: '#EF4444', color: 'white', borderRadius: radius.pill, padding: '1px 7px', fontSize: 9, fontWeight: weight.black }}>
                {nbNonLues}
              </span>
            )}
          </div>
          {nbNonLues > 0 && (
            <button
              onClick={onMarkAll}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C4865A', fontSize: type.xs, fontWeight: weight.semibold, padding: 0 }}
            >
              Tout marquer lu
            </button>
          )}
        </div>

        {/* Liste */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {notifications.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.28)', fontSize: type.sm, padding: `${space[6]}px ${space[4]}px`, margin: 0 }}>
              Aucune notification
            </p>
          ) : notifications.map(n => {
            const url = getNotifUrl(n)
            return (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  width:          '100%',
                  padding:       `${space[3]}px ${space[4]}px`,
                  background:     n.lu ? 'none' : 'rgba(255,255,255,0.05)',
                  border:         'none',
                  borderBottom:  '1px solid rgba(255,255,255,0.06)',
                  cursor:         url ? 'pointer' : 'default',
                  textAlign:      'left',
                  display:       'flex',
                  alignItems:    'flex-start',
                  gap:            space[2],
                  transition:    `background ${motion.fast_out}`,
                }}
                onMouseEnter={e => { if (url) e.currentTarget.style.background = n.lu ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.09)' }}
                onMouseLeave={e => { e.currentTarget.style.background = n.lu ? 'none' : 'rgba(255,255,255,0.05)' }}
              >
                {/* Point non-lu */}
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: n.lu ? 'transparent' : '#C4865A', flexShrink: 0, marginTop: 5 }} />

                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: space[1] }}>
                  <span style={{ fontSize: type.sm, fontWeight: n.lu ? weight.normal : weight.bold, color: n.lu ? 'rgba(255,255,255,0.4)' : 'white', lineHeight: 1.35 }}>
                    {n.titre}
                  </span>
                  <span style={{ fontSize: type.xs, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
                    {n.message}
                  </span>
                  <span style={{ fontSize: type['2xs'], color: 'rgba(255,255,255,0.2)' }}>
                    {n.created_at
                      ? new Date(n.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </span>
                </div>

                {/* Flèche si navigable */}
                {url && <ChevronRight size={13} color="rgba(255,255,255,0.25)" style={{ flexShrink: 0, marginTop: 3 }} />}
              </button>
            )
          })}
        </div>
      </div>
    </>,
    document.body
  )
}

// ─── NavRail principal ─────────────────────────────────────────────────────────
export default function NavRail({ activeView, onViewChange }) {
  const { user }                   = useSelector(s => s.auth)
  const dispatch                   = useDispatch()
  const navigate                   = useNavigate()
  const location                   = useLocation()
  const { isDark, toggleTheme, C } = useTheme()

  const { notifications, nbNonLues, markRead, markAllRead } = useNotifications()
  const [epBadge,         setEpBadge]         = useState(0)
  const [notifOpen,       setNotifOpen]       = useState(false)
  const [notifAnchorRect, setNotifAnchorRect] = useState(null)
  const [searchOpen,      setSearchOpen]      = useState(false)
  const bellRef = useRef(null)

  // Ctrl+K ou Cmd+K pour ouvrir la recherche
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(o => !o)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Charge badge épreuves (apprenant uniquement)
  useEffect(() => {
    if (user?.role !== 'apprenant') return
    api.get('/api/examens/disponibles')
      .then(({ data }) => setEpBadge(data.filter(e => !e.soumis).length))
      .catch(() => {})
  }, [user?.role])

  function openNotif() {
    if (!notifOpen && bellRef.current) {
      setNotifAnchorRect(bellRef.current.getBoundingClientRect())
    }
    setNotifOpen(o => !o)
  }

  // ── Définition de la navigation par rôle ─────────────────────────
  const roleInfo = ROLE_INFO[user?.role] || ROLE_INFO.apprenant

  const NAV = {
    super_admin: {
      main: [],
      admin: [
        { path: '/admin',               label: 'Gestion des cours',    icon: Shield   },
        { path: '/admin/referentiel',   label: 'Référentiel éducatif', icon: BookOpen },
        { path: '/admin/utilisateurs',  label: 'Utilisateurs',         icon: Users    },
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
        { path: '/prof',         label: 'Suivi des apprenants', icon: BarChart2      },
        { path: '/corrections',  label: 'Corrections',          icon: PenLine        },
        { path: '/prof/examens', label: 'Épreuves IA',          icon: FileText       },
        { path: '/chat',         label: 'Messages',             icon: MessageCircle  },
        { path: '/profil',       label: 'Mon profil',            icon: UserCircle     },
        { path: '/contribuer',   label: "Contribuer à l'IA",    icon: FlaskConical   },
      ],
    },
    apprenant: {
      main: [
        { path: '/dashboard',  label: 'Tableau de bord',  icon: LayoutDashboard },
        { path: '/epreuves',   label: 'Mes épreuves',      icon: ClipboardList   },
        { path: '/chat',       label: 'Messages',          icon: MessageCircle   },
        { path: '/profil',     label: 'Mon profil',         icon: UserCircle      },
        { path: '/contribuer', label: "Contribuer à l'IA", icon: FlaskConical    },
      ],
    },
  }

  const nav = NAV[user?.role] || NAV.apprenant

  function goTo(path) {
    onViewChange('main')
    navigate(path)
  }

  function isActive(path) {
    return activeView === 'main' && location.pathname === path
  }

  // ── Rendu ─────────────────────────────────────────────────────────
  return (
    <aside
      aria-label="Navigation principale"
      style={{
        width:          RAIL_W,
        minHeight:     '100vh',
        height:        '100vh',
        background:     C.sidebarBg,
        borderRight:   '1px solid rgba(255,255,255,0.06)',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        flexShrink:     0,
        position:      'sticky',
        top:            0,
        overflowY:     'auto',
        overflowX:     'hidden',
        scrollbarWidth: 'none',
        paddingBottom:  space[4],
        fontFamily:    "'DM Sans', system-ui, sans-serif",
        boxShadow:      'inset -1px 0 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* ── Logo ── */}
      <div style={{
        width:          '100%',
        padding:        `${space[4]}px 0`,
        display:       'flex',
        justifyContent: 'center',
        borderBottom:  '1px solid rgba(255,255,255,0.06)',
        flexShrink:     0,
      }}>
        <button
          onClick={() => goTo(user?.role === 'apprenant' ? '/dashboard' : '/prof')}
          aria-label="Accueil SenSia"
          style={{
            width:          40, height: 40,
            borderRadius:   radius.md,
            background:    `linear-gradient(145deg, ${C.brown} 0%, ${C.brownMid} 60%, ${C.gold} 100%)`,
            display:       'flex',
            alignItems:    'center',
            justifyContent: 'center',
            border:         'none',
            cursor:         'pointer',
            boxShadow:     `0 4px 18px ${C.brown}55`,
            transition:    `transform ${motion.mid_spring}, box-shadow ${motion.fast_out}`,
            flexShrink:     0,
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.06)'; e.currentTarget.style.boxShadow = `0 6px 24px ${C.brown}70` }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.boxShadow = `0 4px 18px ${C.brown}55` }}
        >
          <ECGWave />
        </button>
      </div>

      {/* ── Navigation principale ── */}
      <nav
        style={{
          flex:    1,
          width:   '100%',
          padding: `${space[3]}px ${space[2]}px`,
          display: 'flex',
          flexDirection: 'column',
          gap:      space[1],
        }}
      >
        {/* Liens section principale */}
        {nav.main?.map(l => (
          <RailItemWithTooltip
            key={l.path}
            icon={l.icon}
            label={l.label}
            active={isActive(l.path)}
            badge={l.path === '/epreuves' ? epBadge : 0}
            onClick={() => goTo(l.path)}
          />
        ))}

        {/* Parcours (apprenant uniquement) */}
        {user?.role === 'apprenant' && (
          <RailItemWithTooltip
            icon={Map}
            label="Parcours"
            active={activeView === 'parcours'}
            accentColor={C.gold}
            onClick={() => onViewChange(activeView === 'parcours' ? 'main' : 'parcours')}
          />
        )}

        {/* Section admin (super_admin) */}
        {nav.admin?.length > 0 && (
          <>
            <Divider />
            {nav.admin.map(l => (
              <RailItemWithTooltip
                key={l.path}
                icon={l.icon}
                label={l.label}
                active={isActive(l.path)}
                accentColor={C.gold}
                onClick={() => goTo(l.path)}
              />
            ))}
          </>
        )}

        {/* Section collecte (super_admin) */}
        {nav.collect?.length > 0 && (
          <>
            <Divider />
            {nav.collect.map(l => (
              <RailItemWithTooltip
                key={l.path}
                icon={l.icon}
                label={l.label}
                active={isActive(l.path)}
                onClick={() => goTo(l.path)}
              />
            ))}
          </>
        )}

        {/* Vues de test (super_admin) */}
        {nav.test?.length > 0 && (
          <>
            <Divider />
            {nav.test.map(l => (
              <RailItemWithTooltip
                key={l.path}
                icon={l.icon}
                label={l.label}
                active={isActive(l.path)}
                onClick={() => goTo(l.path)}
              />
            ))}
          </>
        )}
      </nav>

      {/* ── Zone basse : notif + thème + avatar + logout ── */}
      <div style={{
        width:   '100%',
        padding: `0 ${space[2]}px`,
        display: 'flex',
        flexDirection: 'column',
        gap:      space[1],
        borderTop: '1px solid rgba(255,255,255,0.06)',
        paddingTop: space[3],
        flexShrink: 0,
      }}>
        {/* Recherche */}
        <RailItemWithTooltip
          icon={Search}
          label="Rechercher (Ctrl+K)"
          active={searchOpen}
          onClick={() => setSearchOpen(o => !o)}
        />

        {/* Notifications */}
        <div ref={bellRef}>
          <RailItemWithTooltip
            icon={Bell}
            label={`Notifications${nbNonLues > 0 ? ` (${nbNonLues})` : ''}`}
            active={notifOpen}
            badge={nbNonLues}
            onClick={openNotif}
          />
        </div>

        {/* Thème */}
        <RailItemWithTooltip
          icon={isDark ? Sun : Moon}
          label={isDark ? 'Thème clair' : 'Thème sombre'}
          active={false}
          onClick={toggleTheme}
        />

        <Divider />

        {/* Avatar / profil */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: space[1] }}>
          <button
            onClick={() => goTo('/profil')}
            aria-label="Mon profil"
            title="Mon profil"
            style={{
              background:    'none',
              border:        'none',
              cursor:        'pointer',
              padding:        0,
              borderRadius:   radius.md,
              display:       'flex',
              alignItems:    'center',
              justifyContent: 'center',
            }}
          >
            <Avatar user={user} roleColor={roleInfo.color} />
          </button>
        </div>

        {/* Logout */}
        <RailItemWithTooltip
          icon={LogOut}
          label="Déconnexion"
          active={false}
          accentColor="rgba(220,38,38,0.85)"
          onClick={() => { dispatch(logout()); navigate('/') }}
        />
      </div>

      {/* Panel notifications */}
      {notifOpen && (
        <NotifPanel
          notifications={notifications}
          nbNonLues={nbNonLues}
          onMarkRead={markRead}
          onMarkAll={markAllRead}
          onClose={() => setNotifOpen(false)}
          anchorRect={notifAnchorRect}
        />
      )}

      {/* Modal recherche globale */}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)}/>}
    </aside>
  )
}
