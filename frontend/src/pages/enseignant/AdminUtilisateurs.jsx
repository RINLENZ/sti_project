import { useState, useEffect, useCallback, useRef } from 'react'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import {
  Users, Search, RefreshCw, UserX, UserCheck,
  GraduationCap, BookOpen, Shield, ChevronDown,
} from 'lucide-react'

const ROLE_INFO = {
  apprenant:   { label: 'Apprenant',   color: '#C4865A', bg: '#C4865A18' },
  enseignant:  { label: 'Enseignant',  color: '#0D9373', bg: '#0D937318' },
  super_admin: { label: 'Super Admin', color: '#D4A853', bg: '#D4A85318' },
}

const ROLE_TABS = [
  { value: '',             label: 'Tous' },
  { value: 'apprenant',   label: 'Apprenants',  icon: GraduationCap },
  { value: 'enseignant',  label: 'Enseignants', icon: BookOpen },
  { value: 'super_admin', label: 'Super Admins', icon: Shield },
]

export default function AdminUtilisateurs() {
  const { C } = useTheme()
  const { xs, mobile } = useBreakpoint()
  const { user: me } = useSelector(s => s.auth)
  const pad = xs ? 12 : mobile ? 16 : 28

  const [users,      setUsers]      = useState([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [updating,   setUpdating]   = useState({})
  const [roleMenuOpen, setRoleMenuOpen] = useState(null) // user_id with open menu

  const debounceRef = useRef(null)

  const load = useCallback((q = search, r = roleFilter) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (r) params.set('role', r)
    if (q.trim()) params.set('search', q.trim())
    api.get(`/api/admin/utilisateurs?${params}`)
      .then(({ data }) => setUsers(data))
      .catch(() => toast.error('Impossible de charger les utilisateurs'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line

  // Chargement initial
  useEffect(() => { load(search, roleFilter) }, [roleFilter]) // eslint-disable-line

  // Debounce recherche texte
  function handleSearch(val) {
    setSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => load(val, roleFilter), 300)
  }

  async function toggleActif(u) {
    setUpdating(p => ({ ...p, [u.id]: true }))
    try {
      await api.put(`/api/admin/utilisateurs/${u.id}`, { actif: !u.actif })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, actif: !x.actif } : x))
      toast.success(u.actif ? 'Compte suspendu' : 'Compte réactivé')
    } catch {
      toast.error('Mise à jour échouée')
    } finally {
      setUpdating(p => ({ ...p, [u.id]: false }))
    }
  }

  async function changeRole(u, newRole) {
    if (newRole === u.role) { setRoleMenuOpen(null); return }
    if (newRole === 'super_admin') {
      const ok = window.confirm(
        `Promouvoir ${u.prenom} ${u.nom} en Super Admin ?\n\nCette personne aura accès à toute la gestion de la plateforme.`
      )
      if (!ok) { setRoleMenuOpen(null); return }
    }
    setUpdating(p => ({ ...p, [u.id]: true }))
    setRoleMenuOpen(null)
    try {
      await api.put(`/api/admin/utilisateurs/${u.id}`, { role: newRole })
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: newRole } : x))
      toast.success('Rôle mis à jour')
    } catch {
      toast.error('Mise à jour échouée')
    } finally {
      setUpdating(p => ({ ...p, [u.id]: false }))
    }
  }

  const actifCount   = users.filter(u => u.actif).length
  const suspendCount = users.length - actifCount

  return (
    <div style={{ padding: pad, maxWidth: 900, margin: '0 auto', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
        <div style={{ width: 42, height: 42, borderRadius: 12, background: `${C.brown}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Users size={20} color={C.brown}/>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text }}>Gestion des utilisateurs</h1>
          <p style={{ margin: 0, fontSize: 12, color: C.textSec }}>
            {users.length} utilisateur{users.length > 1 ? 's' : ''}
            {suspendCount > 0 && ` · ${suspendCount} suspendu${suspendCount > 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => load(search, roleFilter)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: C.brownPale, border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.brown }}>
          <RefreshCw size={13}/> Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Recherche */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={13} color={C.textSec} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
          <input
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Nom, prénom ou email…"
            style={{ width: '100%', padding: '9px 12px 9px 34px', border: `1.5px solid ${C.brownPale}`, borderRadius: 10, fontSize: 13, color: C.text, background: C.surface, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = C.brown}
            onBlur={e => e.target.style.borderColor = C.brownPale}
          />
        </div>

        {/* Tabs rôle */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {ROLE_TABS.map(t => (
            <button key={t.value} onClick={() => { setRoleFilter(t.value); load(search, t.value) }}
              style={{ padding: '7px 14px', borderRadius: 10, border: `1.5px solid ${roleFilter === t.value ? C.brown : C.brownPale}`, background: roleFilter === t.value ? `${C.brown}15` : 'transparent', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: roleFilter === t.value ? C.brown : C.textSec, transition: 'all .15s' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 56, color: C.textSec, fontSize: 13 }}>Chargement…</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '56px 20px' }}>
          <p style={{ fontSize: 32, margin: '0 0 10px' }}>🔍</p>
          <p style={{ fontSize: 14, fontWeight: 700, color: C.text, margin: 0 }}>Aucun utilisateur trouvé</p>
          <p style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>Essaie d'autres critères de recherche.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map(u => {
            const ri       = ROLE_INFO[u.role] || ROLE_INFO.apprenant
            const initials = `${u.prenom?.[0] || ''}${u.nom?.[0] || ''}`
            const busy     = !!updating[u.id]
            const menuOpen = roleMenuOpen === u.id

            return (
              <div key={u.id} style={{ background: C.surface, borderRadius: 14, padding: '13px 16px', border: `1.5px solid ${u.actif ? C.brownPale : '#EF444425'}`, display: 'flex', alignItems: 'center', gap: 12, opacity: u.actif ? 1 : 0.72, transition: 'opacity .2s' }}>

                {/* Avatar */}
                <div style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg, ${ri.color}35, ${ri.color}15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: ri.color, flexShrink: 0, border: `1.5px solid ${ri.color}30` }}>
                  {initials}
                </div>

                {/* Infos */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{u.prenom} {u.nom}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: ri.bg, color: ri.color }}>{ri.label}</span>
                    {!u.actif && <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FEE2E2', color: '#DC2626' }}>Suspendu</span>}
                  </div>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                  {u.niveau && <p style={{ margin: '1px 0 0', fontSize: 10, color: C.textMuted }}>{u.niveau}{u.pays ? ` · ${u.pays}` : ''}</p>}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                  {/* Changement de rôle (désactivé sur son propre compte) */}
                  {!mobile && u.id !== me?.id && (
                    <div style={{ position: 'relative' }}>
                      <button disabled={busy} onClick={() => setRoleMenuOpen(menuOpen ? null : u.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', background: ri.bg, border: `1px solid ${ri.color}40`, borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: ri.color }}>
                        {ri.label} <ChevronDown size={11}/>
                      </button>
                      {menuOpen && (
                        <>
                          <div onClick={() => setRoleMenuOpen(null)} style={{ position: 'fixed', inset: 0, zIndex: 10 }}/>
                          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: C.surface, border: `1px solid ${C.brownPale}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.15)', zIndex: 11, minWidth: 160, overflow: 'hidden' }}>
                            {['apprenant', 'enseignant', 'super_admin'].filter(r => r !== u.role).map(r => {
                              const ri2 = ROLE_INFO[r]
                              const isSuperAdmin = r === 'super_admin'
                              return (
                                <button key={r} onClick={() => changeRole(u, r)}
                                  style={{ width: '100%', padding: '10px 14px', background: 'none', border: 'none', borderTop: isSuperAdmin ? `1px solid ${C.brownPale}` : 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: ri2.color, textAlign: 'left', display: 'block' }}
                                  onMouseEnter={e => e.currentTarget.style.background = ri2.bg}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                  → {ri2.label}
                                </button>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {/* Badge "Vous" sur son propre compte */}
                  {!mobile && u.id === me?.id && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 8, background: C.brownPale, color: C.textSec }}>Vous</span>
                  )}

                  {/* Suspendre / Activer (désactivé sur son propre compte) */}
                  <button disabled={busy || u.id === me?.id} onClick={() => toggleActif(u)}
                    title={u.id === me?.id ? 'Impossible de suspendre votre propre compte' : u.actif ? 'Suspendre le compte' : 'Réactiver le compte'}
                    style={{ display: 'flex', alignItems: 'center', gap: mobile ? 0 : 5, padding: mobile ? '6px' : '6px 12px', background: u.actif ? '#FEE2E210' : '#D1FAE510', border: `1px solid ${u.actif ? '#FCA5A5' : '#6EE7B7'}`, borderRadius: 8, cursor: busy ? 'wait' : 'pointer', fontSize: 11, fontWeight: 700, color: u.actif ? '#DC2626' : '#059669', transition: 'opacity .15s' }}>
                    {u.actif
                      ? <><UserX size={13}/>{!mobile && ' Suspendre'}</>
                      : <><UserCheck size={13}/>{!mobile && ' Activer'}</>}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
