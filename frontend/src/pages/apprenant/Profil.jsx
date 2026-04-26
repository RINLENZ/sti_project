import { useState, useEffect } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { loginSuccess } from '../../store/authSlice'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Copy, CheckCircle, Edit3, Save, X, User, Mail, Globe, GraduationCap, ShieldCheck, Sparkles, Camera } from 'lucide-react'
import { C } from '../../styles/theme'
import { useBreakpoint } from '../../hooks/useBreakpoint'

const PAYS    = ['Cameroun', "Côte d'Ivoire", 'Sénégal', 'Mali', 'Burkina Faso', 'Congo', 'Gabon', 'Autre']

/* ── Collection d'avatars ── */
const AVATARS = [
  { id: 'student_boy_1',  emoji: '👦🏿', label: 'Élève',        bg: '#DBEAFE', ring: '#3B82F6' },
  { id: 'student_girl_1', emoji: '👧🏿', label: 'Élève',        bg: '#FCE7F3', ring: '#EC4899' },
  { id: 'student_boy_2',  emoji: '👦🏾', label: 'Étudiant',     bg: '#D1FAE5', ring: '#10B981' },
  { id: 'student_girl_2', emoji: '👧🏾', label: 'Étudiante',    bg: '#FEF3C7', ring: '#F59E0B' },
  { id: 'scholar_1',      emoji: '🧑🏿‍🎓', label: 'Diplômé',     bg: '#EDE9FE', ring: '#8B5CF6' },
  { id: 'scholar_2',      emoji: '👩🏾‍🎓', label: 'Diplômée',    bg: '#FFE4E6', ring: '#F43F5E' },
  { id: 'scholar_3',      emoji: '👨🏿‍🎓', label: 'Diplômé',     bg: '#ECFDF5', ring: '#059669' },
  { id: 'scholar_4',      emoji: '🧑🏾‍🎓', label: 'Diplômé',     bg: '#FFF7ED', ring: '#EA580C' },
  { id: 'coder_1',        emoji: '🧑🏿‍💻', label: 'Codeur',      bg: '#F0FDF4', ring: '#22C55E' },
  { id: 'coder_2',        emoji: '👩🏾‍💻', label: 'Codeuse',     bg: '#EFF6FF', ring: '#2563EB' },
  { id: 'scientist_1',    emoji: '🧑🏿‍🔬', label: 'Scientifique',bg: '#F0FDFA', ring: '#14B8A6' },
  { id: 'teacher_f',      emoji: '👩🏾‍🏫', label: 'Enseignante', bg: '#FDF4FF', ring: '#A855F7' },
  { id: 'teacher_m',      emoji: '👨🏿‍🏫', label: 'Enseignant',  bg: '#FFFBEB', ring: '#D97706' },
  { id: 'artist',         emoji: '🧑🏾‍🎨', label: 'Artiste',     bg: '#FFF1F2', ring: '#FB7185' },
  { id: 'lion',           emoji: '🦁',    label: 'Lion',         bg: '#FEF9C3', ring: '#EAB308' },
  { id: 'elephant',       emoji: '🐘',    label: 'Éléphant',     bg: '#E0E7FF', ring: '#6366F1' },
  { id: 'leopard',        emoji: '🐆',    label: 'Léopard',      bg: '#FEF3C7', ring: '#F59E0B' },
  { id: 'owl',            emoji: '🦉',    label: 'Hibou',        bg: '#FDF4FF', ring: '#C026D3' },
  { id: 'eagle',          emoji: '🦅',    label: 'Aigle',        bg: '#ECFDF5', ring: '#10B981' },
  { id: 'parrot',         emoji: '🦜',    label: 'Perroquet',    bg: '#D1FAE5', ring: '#34D399' },
  { id: 'books',          emoji: '📚',    label: 'Livres',       bg: '#DBEAFE', ring: '#60A5FA' },
  { id: 'microscope',     emoji: '🔬',    label: 'Sciences',     bg: '#D1FAE5', ring: '#34D399' },
  { id: 'rocket',         emoji: '🚀',    label: 'Explorateur',  bg: '#EDE9FE', ring: '#7C3AED' },
  { id: 'star',           emoji: '⭐',    label: 'Étoile',       bg: '#FEF9C3', ring: '#FBBF24' },
  { id: 'trophy',         emoji: '🏆',    label: 'Champion',     bg: '#FFF7ED', ring: '#D4A853' },
  { id: 'brain',          emoji: '🧠',    label: 'Génie',        bg: '#FCE7F3', ring: '#DB2777' },
  { id: 'globe',          emoji: '🌍',    label: 'Afrique',      bg: '#ECFDF5', ring: '#0D9373' },
  { id: 'drum',           emoji: '🥁',    label: 'Rythme',       bg: '#FFF1F2', ring: '#E11D48' },
  { id: 'seedling',       emoji: '🌱',    label: 'Croissance',   bg: '#F0FDF4', ring: '#16A34A' },
  { id: 'sun',            emoji: '☀️',    label: 'Soleil',        bg: '#FFFBEB', ring: '#F59E0B' },
  { id: 'gem',            emoji: '💎',    label: 'Diamant',      bg: '#EFF6FF', ring: '#3B82F6' },
]

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
  const { mobile }      = useBreakpoint()

  const [editing,        setEditing]        = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [copied,         setCopied]         = useState(false)
  const [showPicker,     setShowPicker]     = useState(false)
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || null)
  const [referentiel,    setReferentiel]    = useState([])   // cycles [{ cycle_id, niveaux, filieres }]
  const [form, setForm] = useState({
    niveau_label:  user?.niveau_label || user?.niveau || '',
    niveau_id:     user?.niveau_id    || '',
    filiere_label: user?.filiere_label || '',
    filiere_id:    user?.filiere_id   || '',
    pays:          user?.pays         || 'Cameroun',
  })

  useEffect(() => {
    api.get('/api/tuteur/referentiel')
      .then(({ data }) => setReferentiel(data))
      .catch(() => {})
  }, [])

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
    setLoading(true)
    try {
      const { data: updated } = await api.put(`/auth/profil/${user.id}/update`, {
        niveau_label:  form.niveau_label,
        niveau_id:     form.niveau_id     || null,
        filiere_label: form.filiere_label || null,
        filiere_id:    form.filiere_id    || null,
        pays:          form.pays,
      })
      dispatch(loginSuccess({ token, user: { ...user, ...updated } }))
      toast.success('Profil mis à jour !'); setEditing(false)
    } catch (err) {
      console.error('Erreur profil:', err.response?.data || err.message)
      toast.error('Erreur : ' + (err.response?.data?.detail || err.message))
    } finally {
      setLoading(false)
    }
  }

  const pad = mobile ? 14 : 28

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: pad, boxSizing: 'border-box' }}>
      <style>{`
        @keyframes fadeIn  { from{opacity:0} to{opacity:1} }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes scaleIn { from{opacity:0;transform:scale(.93)} to{opacity:1;transform:scale(1)} }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:${C.brownPale};border-radius:5px}
      `}</style>

      {showPicker && <AvatarPicker current={selectedAvatar} onSelect={handleAvatarSelect} onClose={() => setShowPicker(false)} />}

      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* ══ HERO ══ */}
        <div style={{
          background: `linear-gradient(135deg, ${C.brownDark} 0%, ${C.brown} 55%, ${C.brownLight} 100%)`,
          borderRadius: mobile ? 18 : 24, padding: mobile ? '24px 20px' : '36px 36px 32px',
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
              <AvatarDisplay avatarId={selectedAvatar} initiales={initiales} size={mobile ? 68 : 84} editable onClick={() => setShowPicker(true)} />
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
              <h1 style={{ fontSize: mobile ? 20 : 26, fontWeight: 900, margin: '0 0 5px', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                    <button onClick={() => { setForm({ niveau_label: user?.niveau_label || user?.niveau || '', pays: user?.pays || 'Cameroun' }); setEditing(false) }} style={{ background: C.redPale, border: `1px solid #FCA5A5`, borderRadius: 9, padding: '7px 10px', cursor: 'pointer', color: C.red, display: 'flex' }}><X size={13}/></button>
                    <button onClick={saveProfile} disabled={loading} style={{ background: `linear-gradient(135deg,${C.brown},${C.brownLight})`, border: 'none', borderRadius: 9, padding: '7px 16px', cursor: 'pointer', color: 'white', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, opacity: loading ? .7 : 1 }}>
                      <Save size={12}/> {loading ? 'Sauvegarde…' : 'Sauvegarder'}
                    </button>
                  </div>
                )}
              </div>
              <div style={{ padding: mobile ? '4px 16px 8px' : '4px 22px 12px' }}>
                <InfoRow icon={User}          label="Prénom"         value={user?.prenom} />
                <InfoRow icon={User}          label="Nom"            value={user?.nom} />
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
              </div>
            </div>
          </div>

          {/* Colonne droite — code tuteur */}
          <div style={{ animation: 'fadeUp .4s .16s ease both' }}>
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
          </div>

        </div>
      </div>
    </div>
  )
}