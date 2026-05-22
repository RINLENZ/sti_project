import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { loginSuccess } from '../../store/authSlice'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Copy, CheckCircle, Edit3, Save, X, User, Mail, Globe, GraduationCap, ShieldCheck, Sparkles, Camera, RefreshCw, BookOpen, Clock, Target, TrendingUp, Award, Zap, Hash, Users, ChevronDown, FileDown } from 'lucide-react'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'

const PAYS    = ['Cameroun', "Côte d'Ivoire", 'Sénégal', 'Mali', 'Burkina Faso', 'Congo', 'Gabon', 'Autre']

import { AVATARS, getAvatarEmoji } from '../../utils/avatars'

/* ── AvatarDisplay ── */
function AvatarDisplay({ avatarId, initiales, size = 80, editable = false, onClick }) {
  const [hovering, setHovering] = useState(false)
  const av = AVATARS.find(a => a.id === avatarId)
  const br = size > 60 ? 22 : 14

  return (
    <div
      style={{
        width: size, height: size, borderRadius: br, flexShrink: 0,
        background: av ? av.bg : 'rgba(255,255,255,0.18)',
        border: av ? `2.5px solid ${av.ring}60` : '2px solid rgba(255,255,255,0.30)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: av ? Math.round(size * 0.48) : Math.round(size * 0.36),
        fontWeight: 900, color: av ? 'inherit' : 'white',
        cursor: editable ? 'pointer' : 'default', position: 'relative', overflow: 'hidden',
        transition: 'transform .18s, box-shadow .18s',
        transform: hovering && editable ? 'scale(1.05)' : 'scale(1)',
        boxShadow: av ? `0 6px 20px ${av.ring}35` : '0 4px 16px rgba(107,58,42,0.25)',
      }}
      onClick={editable ? onClick : undefined}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {av ? av.emoji : initiales}
      {editable && hovering && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.42)', borderRadius: br,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
          animation: 'fadeIn .15s ease',
        }}>
          <Camera size={size > 60 ? 18 : 13} color="white" />
          {size > 60 && <span style={{ fontSize: 9, color: 'white', fontWeight: 700 }}>Changer</span>}
        </div>
      )}
    </div>
  )
}

/* ── AvatarPicker (modal) ── */
function AvatarPicker({ current, onSelect, onClose }) {
  const { C } = useTheme()
  const [hovered, setHovered] = useState(null)
  const categories = [
    { label: '🧑🏿 Personnes', ids: ['student_boy_1','student_girl_1','student_boy_2','student_girl_2','scholar_1','scholar_2','scholar_3','scholar_4','coder_1','coder_2','scientist_1','teacher_f','teacher_m','artist'] },
    { label: '🦁 Animaux',    ids: ['lion','elephant','leopard','owl','eagle','parrot'] },
    { label: '✨ Symboles',   ids: ['books','microscope','rocket','star','trophy','brain','globe','drum','seedling','sun','gem'] },
  ]

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(26,18,7,0.55)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, animation: 'fadeIn .18s ease' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.surface, borderRadius: 24, width: '100%', maxWidth: 540, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 28px 70px rgba(26,18,7,0.32)', animation: 'scaleIn .22s ease' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 900, color: C.brown, margin: 0 }}>Choisis ton avatar</h2>
            <p style={{ fontSize: 11, color: C.textSec, margin: '3px 0 0' }}>{AVATARS.length} avatars disponibles · clique pour sélectionner</p>
          </div>
          <button onClick={onClose} style={{ background: C.brownPale, border: 'none', borderRadius: 9, padding: 8, cursor: 'pointer', display: 'flex' }}>
            <X size={15} color={C.brown} />
          </button>
        </div>

        {/* Grille par catégorie */}
        <div style={{ overflowY: 'auto', padding: '16px 20px 22px' }}>
          {categories.map(cat => (
            <div key={cat.label} style={{ marginBottom: 20 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .7, margin: '0 0 10px' }}>{cat.label}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
                {cat.ids.map(id => {
                  const av = AVATARS.find(a => a.id === id)
                  if (!av) return null
                  const isSel = current === id
                  const isHov = hovered === id
                  return (
                    <button
                      key={id}
                      onClick={() => { onSelect(id); onClose() }}
                      onMouseEnter={() => setHovered(id)}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        background: isSel ? av.bg : isHov ? av.bg + 'BB' : C.brownGhost,
                        border: `2.5px solid ${isSel ? av.ring : isHov ? av.ring + '70' : C.border}`,
                        borderRadius: 14, padding: '10px 6px 8px',
                        cursor: 'pointer', textAlign: 'center',
                        transition: 'all .16s ease',
                        transform: isSel ? 'scale(1.07)' : isHov ? 'scale(1.04)' : 'scale(1)',
                        boxShadow: isSel ? `0 4px 16px ${av.ring}35` : 'none',
                        position: 'relative',
                      }}
                    >
                      {isSel && (
                        <div style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: av.ring, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <CheckCircle size={11} color="white" />
                        </div>
                      )}
                      <div style={{ fontSize: 26, lineHeight: 1, marginBottom: 5 }}>{av.emoji}</div>
                      <p style={{ fontSize: 9, fontWeight: 700, color: isSel ? av.ring : C.textSec, margin: 0, lineHeight: 1.2 }}>{av.label}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── InfoRow ── */
function InfoRow({ icon: Icon, label, children, value }) {
  const { C } = useTheme()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${C.border}` }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: C.brownPale, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} color={C.brownMid} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: .6, margin: '0 0 2px' }}>{label}</p>
        {children || <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>}
      </div>
    </div>
  )
}

/* ── SelectField ── */
function SelectField({ value, onChange, options }) {
  const { C } = useTheme()
  return (
    <select value={value} onChange={onChange} style={{ padding: '7px 12px', border: `2px solid ${C.brownLight}`, borderRadius: 9, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', background: C.surface, color: C.brown }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

/* ════════════════════════════════════════════════
   PAGE PROFIL
   ════════════════════════════════════════════════ */
export default function Profil() {
  const { user, token } = useSelector(s => s.auth)
  const dispatch        = useDispatch()
  const navigate        = useNavigate()
  const { xs, mobile }  = useBreakpoint()
  const { C }           = useTheme()

  const [editing,        setEditing]        = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [copied,         setCopied]         = useState(false)
  const [showPicker,     setShowPicker]     = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || null)
  const [referentiel,    setReferentiel]    = useState([])
  const [stats,          setStats]          = useState(null)
  const [codeClasse,     setCodeClasse]     = useState('')
  const [savingLink,     setSavingLink]     = useState(false)
  const [linkedTeacher,  setLinkedTeacher]  = useState(null)
  const [showCompletion,    setShowCompletion]    = useState(false)
  const [showProgression,   setShowProgression]   = useState(false)
  const [dlBulletin,        setDlBulletin]        = useState(false)
  const [form, setForm] = useState({
    prenom:        user?.prenom        || '',
    nom:           user?.nom           || '',
    niveau_label:  user?.niveau_label  || user?.niveau || '',
    niveau_id:     user?.niveau_id     || '',
    filiere_label: user?.filiere_label || '',
    filiere_id:    user?.filiere_id    || '',
    pays:          user?.pays          || 'Cameroun',
  })

  useEffect(() => {
    api.get('/api/tuteur/referentiel').then(({ data }) => setReferentiel(data)).catch(() => {})
    api.get(`/api/bkt/apprenant/${user?.id}/stats`).then(({ data }) => setStats(data)).catch(() => {})
  }, [user?.id])

  async function downloadBulletin() {
    setDlBulletin(true)
    try {
      const res = await api.get(`/api/bkt/apprenant/${user.id}/bulletin.pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `bulletin_${user.prenom}_${user.nom}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Impossible de générer le bulletin')
    } finally {
      setDlBulletin(false)
    }
  }

  // Niveaux de tous les cycles (liste plate)
  const allNiveaux = referentiel.flatMap(c => c.niveaux.map(n => ({ ...n, cycle_id: c.cycle_id })))

  // Filières du cycle du niveau sélectionné
  const filieresDuNiveau = (() => {
    const choisi = allNiveaux.find(n => n.id === form.niveau_id)
    if (!choisi) return []
    const cycle = referentiel.find(c => c.cycle_id === choisi.cycle_id)
    return cycle?.filieres || []
  })()
  const initiales = `${user?.prenom?.[0] || ''}${user?.nom?.[0] || ''}`.toUpperCase()
  const currentAv = AVATARS.find(a => a.id === selectedAvatar)

  function copyCode() {
    navigator.clipboard.writeText(user?.code_invitation || '')
    setCopied(true); toast.success('Code copié !')
    setTimeout(() => setCopied(false), 2500)
  }

  async function joinClasse() {
    const val = codeClasse.trim().toUpperCase()
    if (!val) { toast.error('Entre un code classe'); return }
    setSavingLink(true)
    try {
      const { data } = await api.post('/auth/lier-enseignant', { code_classe: val })
      setLinkedTeacher(data.enseignant)
      setCodeClasse('')
      toast.success(`Classe rejointe ! Enseignant : ${data.enseignant}`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Code invalide ou introuvable')
    } finally {
      setSavingLink(false)
    }
  }

  async function handleAvatarSelect(id) {
    setSelectedAvatar(id)
    try {
    await api.put(`/auth/profil/${user.id}/update`, { avatar: id })
    const { data: fresh } = await api.get(`/auth/profil/${user.id}`)
    dispatch(loginSuccess({ token, user: { ...user, ...fresh } }))
    toast.success('Avatar mis à jour !')
  } catch {
    toast.error("Erreur lors de la mise à jour")
    setSelectedAvatar(user?.avatar || null)
  }
}

  async function saveProfile() {
    if (!form.prenom.trim() || !form.nom.trim()) {
      toast.error('Le prénom et le nom sont obligatoires')
      return
    }
    setLoading(true)
    try {
      const { data: updated } = await api.put(`/auth/profil/${user.id}/update`, {
        prenom:        form.prenom.trim(),
        nom:           form.nom.trim(),
        niveau_label:  form.niveau_label,
        niveau_id:     form.niveau_id     || null,
        filiere_label: form.filiere_label || null,
        filiere_id:    form.filiere_id    || null,
        pays:          form.pays,
      })
      dispatch(loginSuccess({ token, user: { ...user, ...updated } }))
      toast.success('Profil mis à jour !'); setEditing(false)
    } catch (err) {
      toast.error('Erreur : ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  // ── Complétion du profil ──────────────────────────────────────
  const completionItems = [
    { label: 'Avatar personnalisé', done: !!user?.avatar,        points: 25, icon: Camera,       hint: 'Clique sur ton avatar pour en choisir un' },
    { label: 'Niveau défini',       done: !!user?.niveau_label,  points: 35, icon: GraduationCap, hint: 'Modifie ton profil ou refais la configuration' },
    { label: 'Filière choisie',     done: !!user?.filiere_label, points: 25, icon: BookOpen,      hint: 'Choisis ta filière dans les informations' },
    { label: 'Pays renseigné',      done: !!user?.pays,          points: 15, icon: Globe,         hint: 'Renseigne ton pays dans le formulaire' },
  ]
  const completionPct = completionItems.reduce((acc, i) => acc + (i.done ? i.points : 0), 0)

  function formatDuree(minutes) {
    if (minutes < 60) return `${minutes} min`
    const h = Math.floor(minutes / 60), m = minutes % 60
    return m > 0 ? `${h}h ${m}min` : `${h}h`
  }

  const pad = xs ? 10 : mobile ? 14 : 28

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: pad, boxSizing: 'border-box' }}>
      <style>{`
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:${C.brownPale};border-radius:5px}
        .inp-prof{width:100%;padding:12px 16px;border:2px solid ${C.brownLight};border-radius:10px;outline:none;background:${C.surface};color:${C.text};box-sizing:border-box;font-family:inherit;transition:border-color .2s}
        .inp-prof:focus{border-color:${C.brown}}
        .inp-prof::placeholder{color:${C.textSec};letter-spacing:1px}
      `}</style>

      {showPicker && <AvatarPicker current={selectedAvatar} onSelect={handleAvatarSelect} onClose={() => setShowPicker(false)} />}

      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* ══ HERO ══ */}
        <div style={{
          background: `linear-gradient(135deg, ${C.brownDark} 0%, ${C.brown} 55%, ${C.brownLight} 100%)`,
          borderRadius: xs ? 14 : mobile ? 18 : 24, padding: xs ? '18px 14px' : mobile ? '24px 20px' : '36px 36px 32px',
          marginBottom: mobile ? 16 : 22, position: 'relative', overflow: 'hidden', color: 'white',
          animation: 'fadeUp .4s ease both',
        }}>
          <svg width="100%" height="100%" style={{ position:'absolute',inset:0,opacity:.06,pointerEvents:'none' }}>
            <defs><pattern id="ap" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="30" cy="30" r="5" fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="30" y1="18" x2="30" y2="10" stroke="white" strokeWidth="1.5"/>
              <line x1="18" y1="30" x2="10" y2="30" stroke="white" strokeWidth="1.5"/>
              <line x1="42" y1="30" x2="50" y2="30" stroke="white" strokeWidth="1.5"/>
              <line x1="30" y1="42" x2="30" y2="50" stroke="white" strokeWidth="1.5"/>
            </pattern></defs>
            <rect width="100%" height="100%" fill="url(#ap)"/>
          </svg>

          <div style={{ position: 'relative', display: 'flex', alignItems: mobile ? 'flex-start' : 'center', gap: mobile ? 16 : 24, flexWrap: 'wrap' }}>
            {/* Avatar hero */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <AvatarDisplay avatarId={selectedAvatar} initiales={initiales} size={xs ? 56 : mobile ? 68 : 84} editable onClick={() => setShowPicker(true)} />
              <button
                onClick={() => setShowPicker(true)}
                style={{ position: 'absolute', bottom: -5, right: -5, width: 26, height: 26, borderRadius: '50%', background: `linear-gradient(135deg, ${C.gold}, #F59E0B)`, border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)', transition: 'transform .15s' }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.18)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <Camera size={11} color="white" />
              </button>
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 11, opacity: .65, fontWeight: 600, margin: '0 0 3px' }}>Mon profil</p>
              <h1 style={{ fontSize: xs ? 17 : mobile ? 20 : 26, fontWeight: 900, margin: '0 0 5px', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.prenom} {user?.nom}
              </h1>
              <p style={{ fontSize: 13, opacity: .7, margin: '0 0 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.email}</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[`🎓 ${user?.niveau || 'Niveau non défini'}`, `🌍 ${user?.pays || 'Cameroun'}`, '✓ Actif'].map(tag => (
                  <span key={tag} style={{ background: 'rgba(255,255,255,0.16)', border: '1px solid rgba(255,255,255,0.22)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ══ GRILLE ══ */}
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : '1fr 300px', gap: mobile ? 14 : 20, alignItems: 'start' }}>

          {/* Colonne gauche */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: mobile ? 12 : 16 }}>

            {/* Carte avatar */}
            <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: '0 2px 16px rgba(107,58,42,0.07)', padding: mobile ? '14px 16px' : '16px 22px', animation: 'fadeUp .4s .04s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <AvatarDisplay avatarId={selectedAvatar} initiales={initiales} size={52} />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: '0 0 3px' }}>
                      {currentAv?.label || 'Initiales'}
                    </p>
                    <p style={{ fontSize: 11, color: C.textSec, margin: 0 }}>
                      {selectedAvatar ? `Avatar · ${currentAv?.emoji}` : 'Aucun avatar sélectionné'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPicker(true)}
                  style={{
                    background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                    border: 'none', borderRadius: 11, padding: '9px 18px',
                    cursor: 'pointer', color: 'white', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 6,
                    boxShadow: `0 3px 12px ${C.brown}30`, whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'transform .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.04)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <Camera size={13} /> Changer l'avatar
                </button>
              </div>
            </div>

            {/* Carte infos personnelles */}
            <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: '0 2px 16px rgba(107,58,42,0.07)', overflow: 'hidden', animation: 'fadeUp .4s .08s ease both' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: mobile ? '14px 16px' : '18px 22px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: C.brownPale, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <User size={14} color={C.brown} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.brown }}>Informations personnelles</span>
                </div>
                {!editing ? (
                  <button onClick={() => setEditing(true)} style={{ background: C.brownPale, border: 'none', borderRadius: 9, padding: '7px 14px', cursor: 'pointer', color: C.brown, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, transition: 'background .2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#EAD9CA'} onMouseLeave={e => e.currentTarget.style.background = C.brownPale}>
                    <Edit3 size={12}/> Modifier
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setForm({ prenom: user?.prenom || '', nom: user?.nom || '', niveau_label: user?.niveau_label || user?.niveau || '', niveau_id: user?.niveau_id || '', filiere_label: user?.filiere_label || '', filiere_id: user?.filiere_id || '', pays: user?.pays || 'Cameroun' }); setEditing(false) }} style={{ background: C.redPale, border: `1px solid #FCA5A5`, borderRadius: 9, padding: '7px 10px', cursor: 'pointer', color: C.red, display: 'flex' }}><X size={13}/></button>
                    <button onClick={saveProfile} disabled={loading} style={{ background: `linear-gradient(135deg,${C.brown},${C.brownLight})`, border: 'none', borderRadius: 9, padding: '7px 16px', cursor: 'pointer', color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, opacity: loading ? .7 : 1 }}>
                      <Save size={12}/> {loading ? 'Sauvegarde…' : 'Sauvegarder'}
                    </button>
                  </div>
                )}
              </div>
              <div style={{ padding: mobile ? '4px 16px 8px' : '4px 22px 12px' }}>
                <InfoRow icon={User} label="Prénom">
                  {editing
                    ? <input value={form.prenom} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}
                        placeholder="Prénom"
                        style={{ padding: '7px 12px', border: `2px solid ${C.brownLight}`, borderRadius: 9, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', outline: 'none', background: C.surface, color: C.text, width: '100%', boxSizing: 'border-box' }}/>
                    : <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{user?.prenom}</p>}
                </InfoRow>
                <InfoRow icon={User} label="Nom">
                  {editing
                    ? <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                        placeholder="Nom de famille"
                        style={{ padding: '7px 12px', border: `2px solid ${C.brownLight}`, borderRadius: 9, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', outline: 'none', background: C.surface, color: C.text, width: '100%', boxSizing: 'border-box' }}/>
                    : <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{user?.nom}</p>}
                </InfoRow>
                <InfoRow icon={Mail}          label="Email"          value={user?.email} />
                <InfoRow icon={GraduationCap} label="Niveau scolaire">
                  {editing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Sélecteur niveau */}
                      <select
                        value={form.niveau_id || ''}
                        onChange={e => {
                          const choisi = allNiveaux.find(n => n.id === e.target.value)
                          setForm(f => ({
                            ...f,
                            niveau_id:     choisi?.id    || '',
                            niveau_label:  choisi?.nom   || '',
                            filiere_id:    '',
                            filiere_label: '',
                          }))
                        }}
                        style={{ padding: '7px 12px', border: `2px solid ${C.brownLight}`, borderRadius: 9, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', background: C.surface, color: C.brown }}
                      >
                        <option value="">— Choisir un niveau —</option>
                        {referentiel.map(c => (
                          <optgroup key={c.cycle_id} label={c.cycle_nom}>
                            {c.niveaux.map(n => (
                              <option key={n.id} value={n.id}>{n.nom}</option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                      {/* Sélecteur filière — apparaît seulement si le cycle a des filières */}
                      {filieresDuNiveau.length > 0 && (
                        <select
                          value={form.filiere_id || ''}
                          onChange={e => {
                            const f = filieresDuNiveau.find(f => f.id === e.target.value)
                            setForm(prev => ({
                              ...prev,
                              filiere_id:    f?.id  || '',
                              filiere_label: f?.nom || '',
                            }))
                          }}
                          style={{ padding: '7px 12px', border: `2px solid ${C.emerald}`, borderRadius: 9, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', outline: 'none', cursor: 'pointer', background: C.emeraldPale, color: C.emerald }}
                        >
                          <option value="">— Choisir une filière —</option>
                          {filieresDuNiveau.map(f => (
                            <option key={f.id} value={f.id}>{f.nom}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>
                        {user?.niveau_label || user?.niveau || '—'}
                      </p>
                      {user?.filiere_label && (
                        <p style={{ fontSize: 11, color: C.textSec, margin: '2px 0 0', fontWeight: 600 }}>
                          {user.filiere_label}
                        </p>
                      )}
                    </div>
                  )}
                </InfoRow>
                <div style={{ borderBottom: 'none' }}>
                  <InfoRow icon={Globe} label="Pays">
                    {editing
                      ? <SelectField value={form.pays} onChange={e => setForm(f => ({ ...f, pays: e.target.value }))} options={PAYS} />
                      : <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: 0 }}>{user?.pays || 'Cameroun'}</p>}
                  </InfoRow>
                </div>
              </div>
            </div>

            {/* Carte compte */}
            <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: '0 2px 16px rgba(107,58,42,0.07)', animation: 'fadeUp .4s .12s ease both' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: mobile ? '14px 16px' : '16px 22px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: C.emeraldPale, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={14} color={C.emerald} />
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: C.brown }}>Mon compte</span>
              </div>
              <div style={{ padding: mobile ? '8px 16px 14px' : '8px 22px 16px' }}>
                {[
                  { label: 'Rôle',   value: user?.role === 'apprenant' ? '🎓 Apprenant' : user?.role, color: C.brown },
                  { label: 'Statut', value: '✓ Compte actif',                                          color: C.emerald },
                  { label: 'Niveau', value: user?.niveau_label || user?.niveau || '—',                 color: C.text },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <span style={{ fontSize: 12, color: C.textSec, fontWeight: 600 }}>{row.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: row.color }}>{row.value}</span>
                  </div>
                ))}
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
                  <button
                    onClick={() => navigate('/onboarding')}
                    style={{
                      width: '100%', padding: '10px 0',
                      background: C.brownPale,
                      border: `1.5px solid ${C.brownLight}`,
                      borderRadius: 11, cursor: 'pointer',
                      color: C.brown, fontSize: 12, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      transition: 'background .15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#EAD9CA'}
                    onMouseLeave={e => e.currentTarget.style.background = C.brownPale}
                  >
                    <RefreshCw size={13} /> Refaire la configuration du niveau
                  </button>
                  <p style={{ fontSize: 10, color: C.textMuted, textAlign: 'center', margin: '6px 0 0' }}>
                    Modifie ton niveau scolaire, ta filière et ton code enseignant
                  </p>
                </div>
              </div>
            </div>
            {/* ── Carte complétion du profil ── */}
            <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: '0 2px 16px rgba(107,58,42,0.07)', overflow: 'hidden', animation: 'fadeUp .4s .16s ease both' }}>
              <button
                onClick={() => setShowCompletion(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: mobile ? '14px 16px' : '16px 22px', width: '100%', background: 'none', border: 'none', borderBottom: showCompletion ? `1px solid ${C.border}` : 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: completionPct === 100 ? C.emeraldPale : C.brownPale, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={14} color={completionPct === 100 ? C.emerald : C.brown} />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.brown }}>Complétion du profil</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: completionPct === 100 ? C.emerald : C.brown }}>{completionPct}%</span>
                  <ChevronDown size={16} color={C.textSec} style={{ transition: 'transform .25s', transform: showCompletion ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </div>
              </button>
              {showCompletion && (
                <div style={{ padding: mobile ? '14px 16px' : '16px 22px', animation: 'slideDown .22s ease' }}>
                  {/* Barre de progression */}
                  <div style={{ height: 8, background: C.border, borderRadius: 8, overflow: 'hidden', marginBottom: 14 }}>
                    <div style={{
                      height: '100%', borderRadius: 8, transition: 'width .6s ease',
                      width: `${completionPct}%`,
                      background: completionPct === 100
                        ? `linear-gradient(90deg, ${C.emerald}, #0A7A5E)`
                        : `linear-gradient(90deg, ${C.brown}, ${C.brownLight})`,
                    }}/>
                  </div>
                  {/* Checklist */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {completionItems.map(item => (
                      <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                          background: item.done ? C.emeraldPale : C.brownGhost,
                          border: `1.5px solid ${item.done ? C.emerald + '60' : C.border}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {item.done
                            ? <CheckCircle size={12} color={C.emerald}/>
                            : <item.icon size={11} color={C.textMuted}/>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: item.done ? C.text : C.textSec }}>{item.label}</span>
                          {!item.done && <p style={{ fontSize: 10, color: C.textMuted, margin: '1px 0 0' }}>{item.hint}</p>}
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 800, color: item.done ? C.emerald : C.textMuted, flexShrink: 0 }}>+{item.points}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Carte statistiques de progression ── */}
            <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: '0 2px 16px rgba(107,58,42,0.07)', overflow: 'hidden', animation: 'fadeUp .4s .20s ease both' }}>
              <button
                onClick={() => setShowProgression(v => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: mobile ? '14px 16px' : '16px 22px', width: '100%', background: 'none', border: 'none', borderBottom: showProgression ? `1px solid ${C.border}` : 'none', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={14} color="#7C3AED" />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 800, color: C.brown }}>Ma progression</span>
                </div>
                <ChevronDown size={16} color={C.textSec} style={{ transition: 'transform .25s', transform: showProgression ? 'rotate(180deg)' : 'rotate(0deg)' }} />
              </button>
              {showProgression && <div style={{ padding: mobile ? '14px 16px' : '16px 22px', animation: 'slideDown .22s ease' }}>
                {!stats ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[0,1,2,3].map(i => (
                      <div key={i} style={{ height: 72, borderRadius: 12, background: C.brownGhost, animation: 'pulse 1.5s infinite' }}/>
                    ))}
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                      {[
                        { icon: BookOpen, label: 'Exercices tentés',   value: stats.nb_tentatives,                 color: '#7C3AED', bg: '#EDE9FE' },
                        { icon: Target,   label: 'Taux de réussite',   value: `${stats.taux_reussite}%`,           color: C.emerald, bg: C.emeraldPale },
                        { icon: Clock,    label: 'Temps d\'étude',     value: formatDuree(stats.duree_totale_minutes), color: C.brown, bg: C.brownPale },
                        { icon: Award,    label: 'Score moyen BKT',    value: `${stats.p_mastery_moyen}%`,         color: '#F59E0B', bg: '#FEF3C7' },
                      ].map(s => (
                        <div key={s.label} style={{ background: s.bg, borderRadius: 12, padding: '12px 14px', border: `1px solid ${s.color}20` }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                            <s.icon size={12} color={s.color}/>
                            <span style={{ fontSize: 10, fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: .4 }}>{s.label}</span>
                          </div>
                          <p style={{ fontSize: 22, fontWeight: 900, color: s.color, margin: 0, lineHeight: 1 }}>{s.value}</p>
                        </div>
                      ))}
                    </div>
                    {/* Compétences maîtrisées */}
                    <div style={{ background: C.brownGhost, borderRadius: 12, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Sparkles size={13} color={C.gold}/>
                        <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Compétences maîtrisées</span>
                      </div>
                      <span style={{ fontSize: 15, fontWeight: 900, color: C.brown }}>
                        {stats.nb_maitrisees} <span style={{ fontSize: 11, fontWeight: 600, color: C.textSec }}>/ {stats.nb_competences}</span>
                      </span>
                    </div>
                    {stats.nb_sessions === 0 && (
                      <p style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', marginTop: 12 }}>
                        Lance ta première session d'apprentissage pour voir tes stats !
                      </p>
                    )}
                  </>
                )}
              </div>}
            </div>

            {/* ── Bouton bulletin PDF ── */}
            <button
              onClick={downloadBulletin}
              disabled={dlBulletin}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '14px 20px',
                background: dlBulletin ? C.brownPale : `linear-gradient(135deg, ${C.brown}, ${C.brownDark || '#5C3D1E'})`,
                border: 'none', borderRadius: 14, cursor: dlBulletin ? 'default' : 'pointer',
                color: dlBulletin ? C.brown : 'white',
                fontSize: 13, fontWeight: 800,
                boxShadow: dlBulletin ? 'none' : '0 4px 14px rgba(124,92,58,.35)',
                transition: 'all .2s', animation: 'fadeUp .4s .24s ease both',
              }}
            >
              <FileDown size={16} style={{ flexShrink: 0 }}/>
              {dlBulletin ? 'Génération en cours…' : 'Télécharger mon bulletin PDF'}
            </button>

          </div>

          {/* Colonne droite — code tuteur + rejoindre classe */}
          <div style={{ animation: 'fadeUp .4s .16s ease both', display: 'flex', flexDirection: 'column', gap: mobile ? 12 : 16 }}>
            <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: '0 2px 16px rgba(107,58,42,0.07)', overflow: 'hidden' }}>
              <div style={{ background: `linear-gradient(135deg, ${C.emerald}, ${C.emeraldDark})`, padding: mobile ? '18px 18px 16px' : '22px 22px 18px', position: 'relative', overflow: 'hidden' }}>
                <svg width="100%" height="100%" style={{ position:'absolute',inset:0,opacity:.08,pointerEvents:'none' }}>
                  <defs><pattern id="dots2" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.2" fill="white"/></pattern></defs>
                  <rect width="100%" height="100%" fill="url(#dots2)"/>
                </svg>
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Sparkles size={16} color="white" />
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>Code tuteur</span>
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', margin: 0, lineHeight: 1.55 }}>
                    Partage ce code à ton enseignant pour qu'il suive ta progression.
                  </p>
                </div>
              </div>
              <div style={{ padding: mobile ? '18px' : '22px' }}>
                <div style={{ background: `linear-gradient(135deg, ${C.emeraldPale}, ${C.brownGhost})`, borderRadius: 14, padding: '18px 18px 14px', border: `1.5px solid ${C.emerald}25`, marginBottom: 16, textAlign: 'center' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: C.emerald, textTransform: 'uppercase', letterSpacing: .8, margin: '0 0 10px' }}>Code d'invitation</p>
                  <p style={{ fontFamily: 'monospace', fontSize: mobile ? 26 : 30, fontWeight: 900, color: C.brown, letterSpacing: 6, margin: '0 0 14px', lineHeight: 1 }}>
                    {user?.code_invitation}
                  </p>
                  <button onClick={copyCode} style={{
                    width: '100%', padding: '10px 0',
                    background: copied ? `linear-gradient(135deg,${C.emerald},${C.emeraldDark})` : `linear-gradient(135deg,${C.brown},${C.brownLight})`,
                    border: 'none', borderRadius: 10, cursor: 'pointer', color: 'white', fontSize: 12, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                    boxShadow: `0 4px 14px ${copied ? C.emerald : C.brown}35`, transition: 'all .25s',
                    transform: copied ? 'scale(0.98)' : 'scale(1)',
                  }}>
                    {copied ? <CheckCircle size={14}/> : <Copy size={14}/>}
                    {copied ? 'Code copié !' : 'Copier le code'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: C.brownPale, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
                    <span style={{ fontSize: 10 }}>💡</span>
                  </div>
                  <p style={{ fontSize: 11, color: C.textSec, lineHeight: 1.6, margin: 0 }}>
                    L'enseignant entre ce code dans son tableau de bord pour accéder à ton suivi personnalisé.
                  </p>
                </div>
              </div>
            </div>
            {/* ── Carte rejoindre une classe ── */}
            <div style={{ background: C.surface, borderRadius: 18, border: `1px solid ${C.border}`, boxShadow: '0 2px 16px rgba(107,58,42,0.07)', overflow: 'hidden' }}>
              <div style={{ background: `linear-gradient(135deg, ${C.brownDark}, ${C.brown})`, padding: mobile ? '18px 18px 16px' : '22px 22px 18px', position: 'relative', overflow: 'hidden' }}>
                <svg width="100%" height="100%" style={{ position:'absolute',inset:0,opacity:.08,pointerEvents:'none' }}>
                  <defs><pattern id="dots3" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.2" fill="white"/></pattern></defs>
                  <rect width="100%" height="100%" fill="url(#dots3)"/>
                </svg>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Users size={16} color="white"/>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: 'white', margin: 0 }}>Rejoindre une classe</p>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,.75)', margin: '2px 0 0' }}>Entre le code donné par ton enseignant</p>
                  </div>
                </div>
              </div>
              <div style={{ padding: mobile ? '16px' : '20px 22px' }}>
                {linkedTeacher ? (
                  <div style={{ textAlign: 'center', padding: '8px 0' }}>
                    <div style={{ width: 44, height: 44, borderRadius: '50%', background: C.emeraldPale, border: `2px solid ${C.emerald}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px', fontSize: 20 }}>✓</div>
                    <p style={{ fontSize: 13, fontWeight: 800, color: C.emerald, margin: '0 0 3px' }}>Classe rejointe !</p>
                    <p style={{ fontSize: 12, color: C.textSec, margin: 0 }}>Enseignant : <strong style={{ color: C.text }}>{linkedTeacher}</strong></p>
                    <button onClick={() => setLinkedTeacher(null)} style={{ marginTop: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: C.textSec, textDecoration: 'underline' }}>
                      Rejoindre une autre classe
                    </button>
                  </div>
                ) : (
                  <>
                    <p style={{ fontSize: 11, color: C.textSec, margin: '0 0 12px', lineHeight: 1.5 }}>
                      Ton enseignant te donnera un code court (ex : MATH2A). Entre-le ci-dessous pour apparaître dans son tableau de bord.
                    </p>
                    <input
                      className="inp-prof"
                      value={codeClasse}
                      onChange={e => setCodeClasse(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      placeholder="Ex : MATH2A"
                      maxLength={12}
                      onKeyDown={e => e.key === 'Enter' && joinClasse()}
                      style={{ fontFamily: 'monospace', letterSpacing: 3, fontSize: 18, textAlign: 'center', marginBottom: 10 }}
                    />
                    <button
                      onClick={joinClasse}
                      disabled={savingLink || !codeClasse.trim()}
                      style={{
                        width: '100%', padding: '10px 0',
                        background: savingLink || !codeClasse.trim()
                          ? C.border
                          : `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
                        border: 'none', borderRadius: 10, cursor: savingLink || !codeClasse.trim() ? 'not-allowed' : 'pointer',
                        color: savingLink || !codeClasse.trim() ? C.textMuted : 'white',
                        fontSize: 13, fontWeight: 800,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        transition: 'all .2s',
                      }}
                    >
                      <Hash size={13}/>
                      {savingLink ? 'Liaison…' : 'Rejoindre la classe'}
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}