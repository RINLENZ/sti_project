import { useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { loginSuccess } from '../../store/authSlice'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { Copy, CheckCircle, Edit3, Save, X } from 'lucide-react'

const C = {
  brown:'#6B3A2A',brownLight:'#C4865A',emerald:'#0D9373',
  bg:'#FAF7F4',surface:'#FFFFFF',text:'#1A1207',
  textSec:'#6B5744',brownPale:'#F5EDE5',emeraldPale:'#E6F5F0',
  gold:'#D4A853',red:'#DC2626',
}

const NIVEAUX = ['Seconde','Première','Terminale']
const PAYS    = ['Cameroun',"Côte d'Ivoire",'Sénégal','Mali','Burkina Faso','Congo','Gabon','Autre']

export default function Profil() {
  const { user, token } = useSelector(s => s.auth)
  const dispatch        = useDispatch()
  const [editing, setEditing]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [copied,  setCopied]    = useState(false)
  const [form, setForm]         = useState({
    niveau: user?.niveau || '',
    pays:   user?.pays   || 'Cameroun',
  })

  function copyCode() {
    navigator.clipboard.writeText(user?.code_invitation || '')
    setCopied(true)
    toast.success('Code copié !')
    setTimeout(() => setCopied(false), 2000)
  }

  async function saveProfile() {
    setLoading(true)
    try {
      await api.put(`/api/admin/apprenant/${user.id}`, form)
      dispatch(loginSuccess({ token, user: { ...user, ...form } }))
      toast.success('Profil mis à jour !')
      setEditing(false)
    } catch {
      toast.error('Erreur lors de la mise à jour')
    } finally { setLoading(false) }
  }

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: 28 }}>

      {/* Hero */}
      <div style={{
        background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`,
        borderRadius: 20, padding: '32px', marginBottom: 28,
        position: 'relative', overflow: 'hidden', color: 'white'
      }}>
        <svg width="100%" height="100%" style={{ position:'absolute',inset:0,opacity:.06,pointerEvents:'none' }}>
          <defs>
            <pattern id="ap" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="12" fill="none" stroke="white" strokeWidth="1.5"/>
              <circle cx="30" cy="30" r="6" fill="none" stroke="white" strokeWidth="1.5"/>
              <line x1="30" y1="18" x2="30" y2="12" stroke="white" strokeWidth="1.5"/>
              <line x1="18" y1="30" x2="12" y2="30" stroke="white" strokeWidth="1.5"/>
              <line x1="42" y1="30" x2="48" y2="30" stroke="white" strokeWidth="1.5"/>
              <line x1="30" y1="42" x2="30" y2="48" stroke="white" strokeWidth="1.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ap)"/>
        </svg>
        <div style={{ display:'flex', alignItems:'center', gap:20, position:'relative' }}>
          <div style={{
            width:72, height:72, borderRadius:20, flexShrink:0,
            background:'rgba(255,255,255,.2)', border:'2px solid rgba(255,255,255,.3)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:28, fontWeight:900
          }}>
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div>
            <h1 style={{ fontSize:24, fontWeight:900, marginBottom:4 }}>
              {user?.prenom} {user?.nom}
            </h1>
            <p style={{ opacity:.75, fontSize:14 }}>{user?.email}</p>
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <span style={{ background:'rgba(255,255,255,.2)', padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                🎓 {user?.niveau || 'Niveau non défini'}
              </span>
              <span style={{ background:'rgba(255,255,255,.15)', padding:'3px 12px', borderRadius:20, fontSize:12, fontWeight:700 }}>
                🌍 {user?.pays || 'Cameroun'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>

        {/* Infos profil */}
        <div style={{ flex:1, minWidth:280 }}>
          <div style={{ backgroundColor:C.surface, borderRadius:16, padding:'24px', marginBottom:16, boxShadow:'0 2px 10px rgba(107,58,42,0.07)', border:`1px solid ${C.brownPale}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontSize:15, fontWeight:800, color:C.brown }}>Informations personnelles</h2>
              {!editing ? (
                <button onClick={() => setEditing(true)} style={{ background:C.brownPale, border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', color:C.brown, fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
                  <Edit3 size={12}/> Modifier
                </button>
              ) : (
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => setEditing(false)} style={{ background:'#FEE2E2', border:'none', borderRadius:8, padding:'6px 10px', cursor:'pointer', color:C.red }}>
                    <X size={13}/>
                  </button>
                  <button onClick={saveProfile} disabled={loading} style={{ background:`linear-gradient(135deg,${C.brown},${C.brownLight})`, border:'none', borderRadius:8, padding:'6px 12px', cursor:'pointer', color:'white', fontSize:12, fontWeight:700, display:'flex', alignItems:'center', gap:5 }}>
                    <Save size={12}/> {loading ? 'Sauvegarde…' : 'Sauvegarder'}
                  </button>
                </div>
              )}
            </div>

            {[
              { label:'Prénom',   value:user?.prenom,  editable:false },
              { label:'Nom',      value:user?.nom,     editable:false },
              { label:'Email',    value:user?.email,   editable:false },
            ].map(row => (
              <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${C.brownPale}` }}>
                <span style={{ fontSize:12, color:C.textSec, fontWeight:700 }}>{row.label}</span>
                <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{row.value}</span>
              </div>
            ))}

            {/* Niveau — éditable */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:`1px solid ${C.brownPale}` }}>
              <span style={{ fontSize:12, color:C.textSec, fontWeight:700 }}>Niveau scolaire</span>
              {editing ? (
                <select value={form.niveau} onChange={e => setForm(f => ({ ...f, niveau:e.target.value }))}
                  style={{ padding:'6px 10px', border:`1px solid ${C.brownPale}`, borderRadius:7, fontSize:12, fontFamily:'inherit', outline:'none' }}>
                  {NIVEAUX.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              ) : (
                <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{user?.niveau || '—'}</span>
              )}
            </div>

            {/* Pays — éditable */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0' }}>
              <span style={{ fontSize:12, color:C.textSec, fontWeight:700 }}>Pays</span>
              {editing ? (
                <select value={form.pays} onChange={e => setForm(f => ({ ...f, pays:e.target.value }))}
                  style={{ padding:'6px 10px', border:`1px solid ${C.brownPale}`, borderRadius:7, fontSize:12, fontFamily:'inherit', outline:'none' }}>
                  {PAYS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <span style={{ fontSize:13, fontWeight:600, color:C.text }}>{user?.pays || 'Cameroun'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Code invitation */}
        <div style={{ width:280, flexShrink:0 }}>
          <div style={{
            background:`linear-gradient(135deg, ${C.emeraldPale}, ${C.brownPale})`,
            borderRadius:16, padding:'24px', marginBottom:16,
            border:`1px solid ${C.emerald}25`
          }}>
            <h3 style={{ fontSize:14, fontWeight:800, color:C.emerald, marginBottom:6 }}>
              🔗 Ton code tuteur
            </h3>
            <p style={{ fontSize:12, color:C.textSec, lineHeight:1.6, marginBottom:16 }}>
              Partage ce code à ton enseignant pour qu'il puisse suivre ta progression en temps réel.
            </p>
            <div style={{ backgroundColor:'white', borderRadius:12, padding:'14px 16px', border:`1px solid ${C.emerald}20`, marginBottom:12 }}>
              <p style={{ fontSize:11, color:C.emerald, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, marginBottom:6 }}>
                Code d'invitation
              </p>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ fontFamily:'monospace', fontSize:22, fontWeight:900, color:C.brown, letterSpacing:3 }}>
                  {user?.code_invitation}
                </span>
                <button onClick={copyCode} style={{ background:copied?C.emeraldPale:C.brownPale, border:'none', borderRadius:8, padding:'7px 12px', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, color:copied?C.emerald:C.brown, transition:'all .2s' }}>
                  {copied ? <CheckCircle size={13}/> : <Copy size={13}/>}
                  {copied ? 'Copié !' : 'Copier'}
                </button>
              </div>
            </div>
            <p style={{ fontSize:11, color:C.textSec, lineHeight:1.5 }}>
              L'enseignant devra entrer ce code dans son tableau de bord pour accéder à ton suivi.
            </p>
          </div>

          {/* Rôle */}
          <div style={{ backgroundColor:C.surface, borderRadius:16, padding:'20px', border:`1px solid ${C.brownPale}`, boxShadow:'0 2px 10px rgba(107,58,42,0.07)' }}>
            <h3 style={{ fontSize:13, fontWeight:800, color:C.brown, marginBottom:12 }}>Compte</h3>
            {[
              { label:'Rôle',    value: user?.role === 'apprenant' ? '🎓 Apprenant' : user?.role },
              { label:'Statut',  value:'✓ Actif' },
            ].map(s => (
              <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${C.brownPale}` }}>
                <span style={{ fontSize:12, color:C.textSec, fontWeight:600 }}>{s.label}</span>
                <span style={{ fontSize:12, fontWeight:700, color:C.text }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}