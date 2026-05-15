import { useDispatch, useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { logout } from '../../store/authSlice'
import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../../services/api'
import {
  Home, Map, ClipboardList, UserCircle, MoreHorizontal,
  BarChart2, FileText, PenLine, Shield, BookOpen,
  Camera, Mic, FlaskConical, LogOut, Sun, Moon,
  Bell, X, ChevronRight, MessageCircle,
} from 'lucide-react'
import { useTheme } from '../../styles/theme.jsx'
import { radius, shadow, motion, space, type, weight, z } from '../../design-system/tokens'
import SensiaLogo from '../SensiaLogo'
import { useWebSocket } from '../../hooks/useWebSocket'

// ─── Constantes ───────────────────────────────────────────────────────────────
const BAR_H   = 60   // hauteur de la barre bottom
const ROLE_INFO = {
  super_admin: { label: 'Super Admin', color: '#D4A853' },
  enseignant:  { label: 'Enseignant',  color: '#0D9373' },
  apprenant:   { label: 'Apprenant',   color: '#C4865A' },
}

// ─── Tab item de la barre bottom ──────────────────────────────────────────────
function TabItem({ icon: Icon, label, active, badge, onClick }) {
  const { C } = useTheme()

  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      style={{
        flex:           1,
        height:         '100%',
        background:     'none',
        border:         'none',
        cursor:         'pointer',
        display:       'flex',
        flexDirection: 'column',
        alignItems:    'center',
        justifyContent: 'center',
        gap:             4,
        padding:        '6px 0 4px',
        position:       'relative',
        outline:        'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Indicateur top actif */}
      {active && (
        <div style={{
          position:    'absolute',
          top:          0, left: '50%',
          transform:   'translateX(-50%)',
          width:        28, height: 2,
          borderRadius: `0 0 ${radius.sm}px ${radius.sm}px`,
          background:  `linear-gradient(90deg, ${C.brown}, ${C.gold})`,
          transition:  `width ${motion.mid_spring}`,
        }} aria-hidden="true" />
      )}

      {/* Icône dans pill si actif */}
      <div style={{
        width:          36, height: 26,
        borderRadius:   radius.md,
        background:     active ? `${C.brown}40` : 'transparent',
        display:       'flex',
        alignItems:    'center',
        justifyContent: 'center',
        transition:    `background ${motion.fast_out}`,
        position:      'relative',
      }}>
        <Icon
          size={17}
          color={active ? C.brownLight : 'rgba(255,255,255,0.38)'}
          style={{ transition: `color ${motion.fast_out}` }}
        />
        {badge > 0 && (
          <span style={{
            position:       'absolute', top: -4, right: -4,
            minWidth:        14, height: 14,
            borderRadius:    radius.pill,
            background:      '#EF4444', color: 'white',
            fontSize:        8, fontWeight: weight.black,
            display:        'flex', alignItems: 'center', justifyContent: 'center',
            padding:        '0 3px', border: '1.5px solid rgba(0,0,0,0.4)',
          }}>
            {badge > 9 ? '9+' : badge}
          </span>
        )}
      </div>

      {/* Label */}
      <span style={{
        fontSize:   9,
        fontWeight: active ? weight.bold : weight.medium,
        color:      active ? C.brownLight : 'rgba(255,255,255,0.32)',
        transition: `color ${motion.fast_out}`,
        lineHeight:  1,
      }}>
        {label}
      </span>
    </button>
  )
}

// ─── Lien dans le bottom sheet ────────────────────────────────────────────────
function SheetLink({ icon: Icon, label, active, badge, onClick }) {
  const { C } = useTheme()
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width:         '100%',
        padding:       `${space[3]}px ${space[4]}px`,
        background:     active
          ? `${C.brown}28`
          : hovered
          ? 'rgba(255,255,255,0.05)'
          : 'rgba(255,255,255,0.03)',
        border:         'none',
        borderLeft:    `3px solid ${active ? C.brownLight : 'transparent'}`,
        borderRadius:  `0 ${radius.md}px ${radius.md}px 0`,
        cursor:        'pointer',
        display:       'flex',
        alignItems:    'center',
        gap:            space[3],
        color:          active ? 'white' : 'rgba(255,255,255,0.62)',
        fontSize:       type.base,
        fontWeight:     active ? weight.bold : weight.medium,
        transition:    `all ${motion.fast_out}`,
        outline:        'none',
        textAlign:      'left',
        position:      'relative',
      }}
    >
      <Icon size={16} style={{ flexShrink: 0, color: active ? C.brownLight : 'inherit' }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && (
        <span style={{
          background: '#EF4444', color: 'white',
          borderRadius: radius.pill, padding: '2px 7px',
          fontSize: 9, fontWeight: weight.black,
        }}>
          {badge}
        </span>
      )}
      <ChevronRight size={13} color="rgba(255,255,255,0.2)" />
    </button>
  )
}

// ─── Bottom Sheet ──────────────────────────────────────────────────────────────
function BottomSheet({ open, onClose, user, activeView, onViewChange, epBadge, nbNonLues, notifications, onMarkRead, onMarkAllRead }) {
  const { C, isDark, toggleTheme } = useTheme()
  const dispatch  = useDispatch()
  const navigate  = useNavigate()
  const location  = useLocation()
  const sheetRef  = useRef(null)
  const roleInfo  = ROLE_INFO[user?.role] || ROLE_INFO.apprenant

  // Fermeture swipe bas (simplifié: touch start/end)
  const touchStartY = useRef(0)
  function onTouchStart(e) { touchStartY.current = e.touches[0].clientY }
  function onTouchEnd(e) {
    const delta = e.changedTouches[0].clientY - touchStartY.current
    if (delta > 60) onClose()
  }

  function goTo(path) {
    onViewChange('main')
    navigate(path)
    onClose()
  }

  function isActive(path) {
    return activeView === 'main' && location.pathname === path
  }

  const ALL_LINKS = [
    { path: '/dashboard',         label: 'Tableau de bord',     icon: Home,          show: user?.role === 'apprenant' },
    { path: '/epreuves',          label: 'Mes épreuves',         icon: ClipboardList, show: user?.role === 'apprenant', badge: epBadge },
    { path: '/prof',              label: 'Suivi des apprenants', icon: BarChart2,     show: ['enseignant','super_admin'].includes(user?.role) },
    { path: '/corrections',       label: 'Corrections',          icon: PenLine,       show: ['enseignant','super_admin'].includes(user?.role) },
    { path: '/prof/examens',      label: 'Épreuves IA',          icon: FileText,      show: user?.role === 'enseignant' },
    { path: '/chat',              label: 'Messages',             icon: MessageCircle, show: ['apprenant','enseignant'].includes(user?.role) },
    { path: '/admin',             label: 'Gestion des cours',    icon: Shield,        show: user?.role === 'super_admin' },
    { path: '/admin/referentiel', label: 'Référentiel',          icon: BookOpen,      show: user?.role === 'super_admin' },
    { path: '/contribuer',        label: "Contribuer à l'IA",    icon: FlaskConical,  show: ['apprenant','enseignant'].includes(user?.role) },
    { path: '/collect-emotions',  label: 'Collecte émotions',    icon: Camera,        show: user?.role === 'super_admin' },
    { path: '/collect-audio',     label: 'Collecte audio',       icon: Mic,           show: user?.role === 'super_admin' },
    { path: '/profil',            label: 'Mon profil',           icon: UserCircle,    show: true },
  ].filter(l => l.show)

  return (
    <>
      {/* Overlay avec blur */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{
          position:        'fixed', inset: 0,
          background:      'rgba(0,0,0,0.6)',
          backdropFilter:  'blur(4px)',
          zIndex:           z.overlay,
          opacity:          open ? 1 : 0,
          pointerEvents:    open ? 'auto' : 'none',
          transition:      `opacity ${motion.mid_out}`,
        }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label="Menu principal"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          position:        'fixed',
          bottom:           0, left: 0, right: 0,
          maxHeight:       '82vh',
          background:       C.sidebarBg,
          borderRadius:   `${radius.xl}px ${radius.xl}px 0 0`,
          border:          '1px solid rgba(255,255,255,0.08)',
          borderBottom:    'none',
          zIndex:           z.modal,
          display:         'flex',
          flexDirection:   'column',
          overflow:         'hidden',
          fontFamily:      "'DM Sans', system-ui, sans-serif",
          transform:        open ? 'translateY(0)' : 'translateY(110%)',
          transition:      `transform ${motion.mid_out}`,
          boxShadow:        open ? '0 -12px 60px rgba(0,0,0,0.55)' : 'none',
          // Espace safe-area iOS
          paddingBottom:   'env(safe-area-inset-bottom)',
        }}
      >
        {/* Handle de swipe */}
        <div style={{
          display:        'flex',
          justifyContent: 'center',
          padding:        `${space[3]}px 0 0`,
          flexShrink:      0,
        }} aria-hidden="true">
          <div style={{ width: 36, height: 4, borderRadius: radius.pill, background: 'rgba(255,255,255,0.15)' }} />
        </div>

        {/* Header */}
        <div style={{
          padding:        `${space[2]}px ${space[4]}px ${space[3]}px`,
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          borderBottom:   '1px solid rgba(255,255,255,0.07)',
          flexShrink:      0,
        }}>
          <SensiaLogo size={18} light />
          <button
            onClick={onClose}
            aria-label="Fermer le menu"
            style={{
              background:  'rgba(255,255,255,0.08)',
              border:       'none',
              borderRadius: radius.md,
              padding:       space[2],
              cursor:       'pointer',
              color:        'rgba(255,255,255,0.55)',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              transition:   `background ${motion.fast_out}`,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* Profil card */}
          <div style={{
            margin:          `${space[3]}px ${space[4]}px`,
            padding:        `${space[3]}px ${space[4]}px`,
            background:      'rgba(255,255,255,0.05)',
            borderRadius:    radius.lg,
            display:        'flex',
            alignItems:     'center',
            gap:             space[3],
            border:          '1px solid rgba(255,255,255,0.07)',
          }}>
            <div style={{
              width:          44, height: 44,
              borderRadius:   radius.md,
              background:    `linear-gradient(135deg, rgba(196,134,90,0.6), rgba(107,58,42,0.9))`,
              display:       'flex',
              alignItems:    'center',
              justifyContent: 'center',
              fontSize:       16,
              fontWeight:     weight.extrabold,
              color:          'white',
              flexShrink:     0,
              border:        `2px solid ${roleInfo.color}30`,
            }}>
              {user?.prenom?.[0]}{user?.nom?.[0]}
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <p style={{ fontSize: type.md, fontWeight: weight.bold, color: 'white', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.prenom} {user?.nom}
              </p>
              <p style={{ fontSize: type.xs, color: roleInfo.color, margin: `${space[1]}px 0 0`, fontWeight: weight.semibold }}>
                {roleInfo.label}
              </p>
              {user?.niveau_label && (
                <p style={{ fontSize: type['2xs'], color: 'rgba(255,255,255,0.3)', margin: `${space[1]}px 0 0` }}>
                  {user.niveau_label}{user.filiere_label && ` · ${user.filiere_label}`}
                </p>
              )}
            </div>
          </div>

          {/* Notifications section */}
          {nbNonLues > 0 && (
            <div style={{
              margin:         `0 ${space[4]}px ${space[3]}px`,
              padding:       `${space[3]}px ${space[4]}px`,
              background:     'rgba(239,68,68,0.08)',
              borderRadius:   radius.lg,
              border:         '1px solid rgba(239,68,68,0.2)',
              display:       'flex',
              alignItems:    'center',
              gap:            space[3],
            }}>
              <Bell size={16} color="#EF4444" style={{ flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: type.sm, color: 'rgba(255,255,255,0.75)', fontWeight: weight.medium }}>
                {nbNonLues} notification{nbNonLues > 1 ? 's' : ''} non lue{nbNonLues > 1 ? 's' : ''}
              </span>
              <button
                onClick={() => { onMarkAllRead(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C4865A', fontSize: type.xs, fontWeight: weight.semibold, padding: 0 }}
              >
                Tout lire
              </button>
            </div>
          )}

          {/* Liens navigation */}
          <div style={{ padding: `0 ${space[2]}px`, display: 'flex', flexDirection: 'column', gap: space[1] }}>
            {ALL_LINKS.map(link => (
              <SheetLink
                key={link.path}
                icon={link.icon}
                label={link.label}
                active={isActive(link.path)}
                badge={link.badge ?? 0}
                onClick={() => goTo(link.path)}
              />
            ))}
          </div>

          {/* Séparateur */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: `${space[3]}px ${space[4]}px` }} />

          {/* Actions secondaires */}
          <div style={{ padding: `0 ${space[2]}px ${space[4]}px`, display: 'flex', flexDirection: 'column', gap: space[1] }}>
            <SheetLink
              icon={isDark ? Sun : Moon}
              label={isDark ? 'Thème clair' : 'Thème sombre'}
              active={false}
              onClick={() => { toggleTheme(); }}
            />
            <button
              onClick={() => { dispatch(logout()); navigate('/'); onClose() }}
              style={{
                width:         '100%',
                padding:       `${space[3]}px ${space[4]}px`,
                background:    'rgba(220,38,38,0.08)',
                border:         'none',
                borderLeft:    '3px solid rgba(220,38,38,0.4)',
                borderRadius:  `0 ${radius.md}px ${radius.md}px 0`,
                cursor:        'pointer',
                display:       'flex',
                alignItems:    'center',
                gap:            space[3],
                color:          'rgba(220,38,38,0.85)',
                fontSize:       type.base,
                fontWeight:     weight.semibold,
                transition:    `background ${motion.fast_out}`,
                outline:        'none',
                textAlign:      'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.14)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)' }}
            >
              <LogOut size={16} style={{ flexShrink: 0 }} />
              Déconnexion
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── MobileNav — export principal ─────────────────────────────────────────────
export default function MobileNav({ activeView, onViewChange }) {
  const { user }    = useSelector(s => s.auth)
  const navigate    = useNavigate()
  const location    = useLocation()
  const { C }       = useTheme()

  const [sheetOpen,     setSheetOpen]     = useState(false)
  const [epBadge,       setEpBadge]       = useState(0)
  const [nbNonLues,     setNbNonLues]     = useState(0)
  const [notifications, setNotifications] = useState([])

  // Badge épreuves
  useEffect(() => {
    if (user?.role !== 'apprenant') return
    api.get('/api/examens/disponibles')
      .then(({ data }) => setEpBadge(data.filter(e => !e.soumis).length))
      .catch(() => {})
  }, [user?.role])

  // Notifications — chargement initial + polling de secours 120s
  useEffect(() => {
    if (!user) return
    function load() {
      api.get('/api/notifications?limit=20').then(({ data }) => {
        setNbNonLues(data.nb_non_lues)
        setNotifications(data.notifications)
      }).catch(() => {})
    }
    load()
    const id = setInterval(load, 120000)
    return () => clearInterval(id)
  }, [user?.id])

  // Notifications temps réel via WebSocket
  const handleWsNotif = useCallback((data) => {
    if (data.type === 'notification') {
      const newNotif = {
        id:         data.id,
        type:       data.notif_type,
        titre:      data.titre,
        message:    data.message,
        meta:       data.meta || {},
        lu:         false,
        created_at: data.created_at,
      }
      setNotifications(prev => [newNotif, ...prev.slice(0, 19)])
      setNbNonLues(prev => prev + 1)
    }
  }, [])

  useWebSocket('/ws/notifications', {
    onMessage: handleWsNotif,
    enabled: !!user,
  })

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

  function isActive(path) {
    return activeView === 'main' && location.pathname === path
  }

  // Définition des tabs par rôle (3-4 max + bouton menu)
  const TABS = {
    apprenant: [
      { id: 'home',     icon: Home,          label: 'Accueil',  action: 'nav', path: '/dashboard' },
      { id: 'parcours', icon: Map,           label: 'Parcours', action: 'parcours'                },
      { id: 'epreuves', icon: ClipboardList, label: 'Épreuves', action: 'nav', path: '/epreuves', badge: epBadge },
      { id: 'menu',     icon: MoreHorizontal, label: 'Menu',    action: 'menu', badge: nbNonLues  },
    ],
    enseignant: [
      { id: 'suivi',   icon: BarChart2,     label: 'Suivi',    action: 'nav', path: '/prof'         },
      { id: 'examens', icon: FileText,      label: 'Épreuves', action: 'nav', path: '/prof/examens' },
      { id: 'profil',  icon: UserCircle,    label: 'Profil',   action: 'nav', path: '/profil'       },
      { id: 'menu',    icon: MoreHorizontal, label: 'Menu',    action: 'menu', badge: nbNonLues     },
    ],
    super_admin: [
      { id: 'admin', icon: Shield,          label: 'Admin',  action: 'nav', path: '/admin'             },
      { id: 'ref',   icon: BookOpen,        label: 'Référ.', action: 'nav', path: '/admin/referentiel' },
      { id: 'menu',  icon: MoreHorizontal,  label: 'Menu',   action: 'menu', badge: nbNonLues          },
    ],
  }
  const tabs = TABS[user?.role] || TABS.apprenant

  function handleTab(tab) {
    if (tab.action === 'nav')      { onViewChange('main'); navigate(tab.path) }
    else if (tab.action === 'parcours') onViewChange(activeView === 'parcours' ? 'main' : 'parcours')
    else if (tab.action === 'menu')     setSheetOpen(o => !o)
  }

  function tabActive(tab) {
    if (tab.action === 'parcours') return activeView === 'parcours'
    if (tab.action === 'menu')     return sheetOpen
    if (tab.path)                  return isActive(tab.path)
    return false
  }

  return (
    <>
      {/* Barre de navigation bottom */}
      <nav
        aria-label="Navigation mobile"
        style={{
          position:      'fixed',
          bottom:         0, left: 0, right: 0,
          height:         BAR_H,
          background:     C.sidebarBg,
          borderTop:     '1px solid rgba(255,255,255,0.07)',
          display:       'flex',
          alignItems:    'stretch',
          zIndex:         z.overlay,
          boxShadow:     '0 -4px 28px rgba(0,0,0,0.4)',
          fontFamily:    "'DM Sans', system-ui, sans-serif",
          // Safe area iOS
          paddingBottom:  'env(safe-area-inset-bottom)',
        }}
      >
        {tabs.map(tab => (
          <TabItem
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            active={tabActive(tab)}
            badge={tab.badge ?? 0}
            onClick={() => handleTab(tab)}
          />
        ))}
      </nav>

      {/* Bottom Sheet menu */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        user={user}
        activeView={activeView}
        onViewChange={onViewChange}
        epBadge={epBadge}
        nbNonLues={nbNonLues}
        notifications={notifications}
        onMarkRead={markRead}
        onMarkAllRead={markAllRead}
      />
    </>
  )
}
