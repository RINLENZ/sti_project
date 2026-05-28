import { useState, useEffect, useRef, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import {
  MessageCircle, Send, Plus, Users, ArrowLeft, Check, CheckCheck,
  Trash2, AlertCircle, RefreshCw, Search, GraduationCap, BookOpen,
} from 'lucide-react'
import { useTheme } from '../styles/theme.jsx'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useWebSocket } from '../hooks/useWebSocket'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function Chat() {
  const { C } = useTheme()
  const { user } = useSelector(s => s.auth)
  const { mobile } = useBreakpoint()
  const location = useLocation()

  const [rooms, setRooms]             = useState([])
  const [activeRoom, setActiveRoom]   = useState(null)
  const [messages, setMessages]       = useState([])
  const [input, setInput]             = useState('')
  const [sending, setSending]         = useState(false)
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [msgLoading, setMsgLoading]   = useState(false)
  const [msgError, setMsgError]       = useState(false)
  const [showNewRoom, setShowNewRoom] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [typingUsers,  setTypingUsers]  = useState({})

  const bottomRef      = useRef(null)
  const inputRef       = useRef(null)
  const typingTimers   = useRef({})
  const lastTypingSent = useRef(0)

  // ── Chargement des salles ──────────────────────────────────────
  const loadRooms = useCallback(() => {
    setRoomsLoading(true)
    api.get('/api/chat/rooms')
      .then(({ data }) => setRooms(data))
      .catch(() => toast.error('Impossible de charger les conversations'))
      .finally(() => setRoomsLoading(false))
  }, [])

  useEffect(() => { loadRooms() }, [loadRooms])

  // ── Ouverture automatique depuis une autre page (ex: Corrections) ──
  // location.state.openWith = userId → crée/ouvre la salle avec cet utilisateur
  useEffect(() => {
    const targetId = location.state?.openWith
    if (!targetId || roomsLoading) return

    // Cherche une salle directe existante avec ce membre
    const existing = rooms.find(r =>
      r.type === 'direct' && r.membres?.some(m => String(m.id) === String(targetId))
    )
    if (existing) {
      setActiveRoom(existing)
      return
    }

    // Sinon crée la salle automatiquement
    api.post('/api/chat/rooms', { type: 'direct', membres: [targetId] })
      .then(({ data }) => {
        setRooms(prev => [data, ...prev.filter(r => r.id !== data.id)])
        setActiveRoom(data)
      })
      .catch(() => {})
  }, [location.state?.openWith, roomsLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chargement messages ───────────────────────────────────────
  const loadMessages = useCallback((roomId) => {
    setMessages([])
    setMsgLoading(true)
    setMsgError(false)
    api.get(`/api/chat/rooms/${roomId}/messages`)
      .then(({ data }) => setMessages(data))
      .catch(() => setMsgError(true))
      .finally(() => setMsgLoading(false))
  }, [])

  useEffect(() => {
    if (!activeRoom) return
    loadMessages(activeRoom.id)
  }, [activeRoom?.id, loadMessages])

  // ── Scroll bas automatique ─────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── WebSocket — réception ─────────────────────────────────────
  const activeRoomIdRef = useRef(null)
  useEffect(() => { activeRoomIdRef.current = activeRoom?.id ?? null }, [activeRoom?.id])

  const handleWsMessage = useCallback((data) => {
    if (data.type === 'chat_message') {
      if (data.room_id === activeRoomIdRef.current) {
        setMessages(prev => {
          if (prev.some(m => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
      }
      setRooms(prev => prev.map(r =>
        r.id === data.room_id
          ? { ...r, last_message: { contenu: data.message.contenu, sender_id: data.message.sender_id, created_at: data.message.created_at } }
          : r
      ))
    }
    if (data.type === 'new_room') {
      setRooms(prev => [data.room, ...prev.filter(r => r.id !== data.room.id)])
    }
    if (data.type === 'typing' && data.room_id === activeRoomIdRef.current) {
      const uid = data.user_id
      clearTimeout(typingTimers.current[uid])
      setTypingUsers(prev => ({ ...prev, [uid]: data.nom }))
      typingTimers.current[uid] = setTimeout(() => {
        setTypingUsers(prev => { const n = { ...prev }; delete n[uid]; return n })
        delete typingTimers.current[uid]
      }, 3000)
    }
  }, [])

  const { send: wsSend } = useWebSocket(
    activeRoom ? `/ws/chat/${activeRoom.id}` : null,
    { onMessage: handleWsMessage, enabled: !!activeRoom }
  )

  useEffect(() => {
    Object.values(typingTimers.current).forEach(clearTimeout)
    typingTimers.current = {}
    setTypingUsers({})
  }, [activeRoom?.id])

  // ── Envoi message REST ────────────────────────────────────────
  const sendMessage = async () => {
    const contenu = input.trim()
    if (!contenu || sending || !activeRoom) return
    setInput('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
    setSending(true)
    try {
      await api.post(`/api/chat/rooms/${activeRoom.id}/messages`, { contenu })
    } catch {
      toast.error('Message non envoyé — réessaie')
      setInput(contenu)
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  // ── Suppression conversation ──────────────────────────────────
  const deleteRoom = async (roomId) => {
    try {
      await api.delete(`/api/chat/rooms/${roomId}`)
      setRooms(prev => prev.filter(r => r.id !== roomId))
      if (activeRoom?.id === roomId) setActiveRoom(null)
      setConfirmDelete(null)
      toast.success('Conversation supprimée')
    } catch {
      toast.error('Impossible de supprimer la conversation')
    }
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const showList = !mobile || !activeRoom

  // ── Nom affiché d'une salle ───────────────────────────────────
  function roomDisplayName(room) {
    if (room.type === 'classe') return room.nom || 'Ma classe'
    const other = room.membres?.find(m => String(m.id) !== String(user.id))
    return other?.nom || room.nom || 'Conversation'
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* ── Liste des salles ── */}
      {showList && (
        <div style={{ width: mobile ? '100%' : 300, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', background: C.surface, flexShrink: 0 }}>

          {/* Header */}
          <div style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MessageCircle size={20} color={C.brown}/>
              <h1 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: C.brown }}>Messages</h1>
            </div>
            {/* Bouton "Nouveau" disponible pour tous les rôles */}
            <button onClick={() => setShowNewRoom(true)} style={{
              background: C.brown, border: 'none', color: 'white',
              borderRadius: 9, padding: '6px 10px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700,
            }}>
              <Plus size={14}/> Nouveau
            </button>
          </div>

          {/* Salles */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {roomsLoading ? (
              <div style={{ padding: 24, textAlign: 'center', color: C.textSec, fontSize: 13 }}>Chargement…</div>
            ) : rooms.length === 0 ? (
              <EmptyRooms user={user} C={C} onNew={() => setShowNewRoom(true)}/>
            ) : (
              rooms.map(room => (
                <RoomItem
                  key={room.id}
                  room={room}
                  isActive={activeRoom?.id === room.id}
                  displayNom={roomDisplayName(room)}
                  user={user}
                  C={C}
                  onClick={() => setActiveRoom(room)}
                  onDelete={() => setConfirmDelete(room)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Zone de chat ── */}
      {(!mobile || activeRoom) && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {activeRoom ? (
            <>
              {/* Header conversation */}
              <div style={{ padding: '12px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12, background: C.surface }}>
                {mobile && (
                  <button onClick={() => setActiveRoom(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
                    <ArrowLeft size={20} color={C.brown}/>
                  </button>
                )}
                {/* Avatar */}
                <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: activeRoom.type === 'classe' ? `${C.emerald}20` : `${C.brown}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {activeRoom.type === 'classe'
                    ? <Users size={15} color={C.emerald}/>
                    : <span style={{ fontSize: 13, fontWeight: 900, color: C.brown }}>
                        {roomDisplayName(activeRoom)[0]?.toUpperCase()}
                      </span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>{roomDisplayName(activeRoom)}</p>
                  <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>
                    {activeRoom.membres?.length || 0} participant{(activeRoom.membres?.length || 0) > 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={() => setConfirmDelete(activeRoom)}
                  title="Quitter la conversation"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', transition: 'background .15s' }}
                  onMouseEnter={e => e.currentTarget.style.background = C.redPale}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <Trash2 size={16} color={C.red}/>
                </button>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, scrollbarWidth: 'thin', scrollbarColor: `${C.brownPale} transparent` }}>

                {msgLoading && (
                  <div style={{ textAlign: 'center', padding: 32, color: C.textSec, fontSize: 13 }}>Chargement des messages…</div>
                )}

                {msgError && !msgLoading && (
                  <div style={{ textAlign: 'center', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <AlertCircle size={28} color={C.red}/>
                    <p style={{ color: C.textSec, fontSize: 13, fontWeight: 600, margin: 0 }}>Impossible de charger les messages</p>
                    <button onClick={() => loadMessages(activeRoom.id)} style={{
                      display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                      background: C.brownPale, border: 'none', borderRadius: 10,
                      cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.brown,
                    }}>
                      <RefreshCw size={13}/> Réessayer
                    </button>
                  </div>
                )}

                {!msgLoading && !msgError && messages.map((msg, i) => {
                  const isMe     = String(msg.sender_id) === String(user.id)
                  const showDate = i === 0 || new Date(messages[i-1].created_at).toDateString() !== new Date(msg.created_at).toDateString()
                  return (
                    <div key={msg.id}>
                      {showDate && (
                        <div style={{ textAlign: 'center', margin: '8px 0' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: C.textSec, background: C.border, padding: '3px 10px', borderRadius: 10 }}>
                            {new Date(msg.created_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '75%',
                          background: isMe ? C.brown : C.surface,
                          color: isMe ? 'white' : C.text,
                          padding: '9px 14px',
                          borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          fontSize: 13, lineHeight: 1.5,
                          border: isMe ? 'none' : `1px solid ${C.border}`,
                        }}>
                          {/* Nom de l'expéditeur dans les salles groupe — visible sur les msgs des autres */}
                          {!isMe && activeRoom.type === 'classe' && (
                            <p style={{ margin: '0 0 3px', fontSize: 10, fontWeight: 800, color: C.brown, opacity: 0.85 }}>
                              {msg.sender_nom || 'Utilisateur'}
                            </p>
                          )}
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{msg.contenu}</p>
                          <p style={{ margin: '4px 0 0', fontSize: 9, color: isMe ? 'rgba(255,255,255,.6)' : C.textSec, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                            {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            {/* Double-coche : envoyé = 1 coche, lu = 2 coches */}
                            {isMe && (msg.lu_par?.length > 1
                              ? <CheckCheck size={10} style={{ color: 'rgba(255,255,255,.9)' }}/>
                              : <Check size={10}/>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {!msgLoading && !msgError && messages.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: C.textSec, fontSize: 13 }}>
                    Aucun message pour l'instant. Dis bonjour ! 👋
                  </div>
                )}

                <div ref={bottomRef}/>
              </div>

              {/* Indicateur de saisie */}
              {Object.keys(typingUsers).length > 0 && (
                <div style={{ padding: '4px 20px 0', minHeight: 20 }}>
                  <p style={{ margin: 0, fontSize: 11, color: C.textSec, fontStyle: 'italic' }}>
                    {Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'écrit' : 'écrivent'}…
                  </p>
                </div>
              )}

              {/* Saisie */}
              <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, alignItems: 'flex-end', background: C.surface }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => {
                    setInput(e.target.value)
                    const now = Date.now()
                    if (now - lastTypingSent.current > 2000) {
                      lastTypingSent.current = now
                      wsSend({ type: 'typing' })
                    }
                  }}
                  onKeyDown={onKey}
                  placeholder="Écrire un message…"
                  rows={1}
                  style={{ flex: 1, padding: '10px 14px', background: C.bg, border: `1.5px solid ${C.border}`, borderRadius: 20, fontSize: 13, color: C.text, outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto' }}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
                  onFocus={e => e.target.style.borderColor = C.brown}
                  onBlur={e => e.target.style.borderColor = C.border}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: input.trim() && !sending ? C.brown : C.border, border: 'none', cursor: input.trim() && !sending ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .15s' }}
                >
                  <Send size={18} color="white"/>
                </button>
              </div>
            </>
          ) : (
            /* Écran vide desktop */
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.textSec, gap: 12, padding: 24 }}>
              <MessageCircle size={48} color={C.brownPale}/>
              <p style={{ fontSize: 15, fontWeight: 700, color: C.textSec, margin: 0 }}>Sélectionne une conversation</p>
              <p style={{ fontSize: 12, color: C.textSec, margin: 0, textAlign: 'center' }}>
                ou démarre-en une nouvelle avec ton enseignant ou un camarade
              </p>
              <button onClick={() => setShowNewRoom(true)} style={{
                marginTop: 8, padding: '10px 22px', background: C.brown, color: 'white',
                border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <Plus size={14}/> Nouvelle conversation
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Modal nouvelle salle ── */}
      {showNewRoom && (
        <NewRoomModal C={C} user={user} onClose={() => setShowNewRoom(false)} onCreated={(room) => {
          setRooms(prev => [room, ...prev.filter(r => r.id !== room.id)])
          setActiveRoom(room)
          setShowNewRoom(false)
        }}/>
      )}

      {/* ── Confirmation suppression ── */}
      {confirmDelete && (
        <ConfirmDeleteModal
          C={C}
          room={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => deleteRoom(confirmDelete.id)}
        />
      )}
    </div>
  )
}

// ── État vide liste salles ────────────────────────────────────────

function EmptyRooms({ user, C, onNew }) {
  const isEnseignant = user?.role === 'enseignant' || user?.role === 'super_admin'
  return (
    <div style={{ padding: '32px 20px', textAlign: 'center' }}>
      <p style={{ fontSize: 28, marginBottom: 8 }}>💬</p>
      <p style={{ color: C.textSec, fontSize: 13, fontWeight: 700, margin: '0 0 6px' }}>Aucune conversation</p>
      <p style={{ color: C.textSec, fontSize: 12, margin: '0 0 16px', lineHeight: 1.5 }}>
        {isEnseignant
          ? 'Démarre une conversation avec un apprenant ou crée un groupe classe.'
          : 'Contacte ton enseignant ou un camarade de classe.'}
      </p>
      <button onClick={onNew} style={{
        padding: '9px 18px', background: C.brown, color: 'white',
        border: 'none', borderRadius: 10, cursor: 'pointer',
        fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <Plus size={13}/> Démarrer
      </button>
    </div>
  )
}

// ── Item de salle ─────────────────────────────────────────────────

function RoomItem({ room, isActive, displayNom, user, C, onClick, onDelete }) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      style={{ position: 'relative', borderLeft: `3px solid ${isActive ? C.brown : 'transparent'}` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        onClick={onClick}
        style={{
          padding: '13px 18px', cursor: 'pointer', transition: 'background .15s',
          background: isActive ? C.brownPale : hovered ? C.bg : 'transparent',
          display: 'flex', alignItems: 'center', gap: 12,
          paddingRight: hovered ? 50 : 18,
        }}
      >
        <div style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: room.type === 'classe' ? `${C.emerald}20` : `${C.brown}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {room.type === 'classe'
            ? <Users size={18} color={C.emerald}/>
            : <span style={{ fontSize: 16, fontWeight: 900, color: C.brown }}>{displayNom[0]?.toUpperCase()}</span>
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayNom}
            </p>
            {room.unread > 0 && (
              <span style={{ background: C.brown, color: 'white', borderRadius: 10, fontSize: 10, fontWeight: 900, padding: '1px 7px', flexShrink: 0, marginLeft: 6 }}>
                {room.unread}
              </span>
            )}
          </div>
          {room.last_message && (
            <p style={{ margin: 0, fontSize: 11, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>
              {String(room.last_message.sender_id) === String(user.id) ? 'Vous : ' : ''}{room.last_message.contenu}
            </p>
          )}
        </div>
      </div>

      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Supprimer"
          style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: C.redPale, border: 'none', borderRadius: 8, padding: '5px 6px', cursor: 'pointer', display: 'flex' }}
        >
          <Trash2 size={13} color={C.red}/>
        </button>
      )}
    </div>
  )
}

// ── Modal confirmation suppression ───────────────────────────────

function ConfirmDeleteModal({ C, room, onCancel, onConfirm }) {
  const [deleting, setDeleting] = useState(false)
  const nom = room.nom || (room.type === 'classe' ? 'ce groupe' : 'cette conversation')

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,7,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 18, padding: '24px', maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.3)' }}>
        <p style={{ fontSize: 26, textAlign: 'center', marginBottom: 8 }}>🗑️</p>
        <h2 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 900, color: C.text, textAlign: 'center' }}>Quitter la conversation ?</h2>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: C.textSec, textAlign: 'center', lineHeight: 1.5 }}>
          Tu vas quitter <strong>{nom}</strong>. Les messages resteront visibles pour les autres participants.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: 'none', cursor: 'pointer', fontWeight: 700, color: C.textSec, fontSize: 13 }}>
            Annuler
          </button>
          <button onClick={async () => { setDeleting(true); await onConfirm() }} disabled={deleting} style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: C.red, color: 'white', cursor: deleting ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13 }}>
            {deleting ? 'Suppression…' : 'Quitter'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal création de salle — contacts curatés ────────────────────
// Charge /api/chat/contacts (backend scope : tuteurs + camarades pour apprenant,
// apprenants liés pour enseignant). Filtre local par nom sans requête supplémentaire.

function NewRoomModal({ C, user, onClose, onCreated }) {
  const isEnseignant = user?.role === 'enseignant' || user?.role === 'super_admin'

  const [type,     setType]     = useState('direct')
  const [contacts, setContacts] = useState([])
  const [selected, setSelected] = useState([])
  const [nom,      setNom]      = useState('')
  const [filter,   setFilter]   = useState('')   // filtre local par nom
  const [loading,  setLoading]  = useState(false)
  const [fetching, setFetching] = useState(true)

  // Groupes selon les contacts retournés
  const groups = contacts.reduce((acc, c) => {
    const g = c.groupe || 'Autres'
    if (!acc[g]) acc[g] = []
    acc[g].push(c)
    return acc
  }, {})

  // Filtrage local par prénom/nom (insensible à la casse, sans accent)
  const normalize = s => s?.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') || ''
  const q = normalize(filter)
  const filteredGroups = Object.fromEntries(
    Object.entries(groups).map(([g, list]) => [
      g,
      list.filter(c => !q || normalize(c.prenom + ' ' + c.nom).includes(q))
    ]).filter(([, list]) => list.length > 0)
  )

  useEffect(() => {
    setFetching(true)
    api.get('/api/chat/contacts')
      .then(({ data }) => setContacts(data))
      .catch(() => toast.error('Impossible de charger les contacts'))
      .finally(() => setFetching(false))
  }, [])

  // Pour les direct : max 1 sélectionné ; pour classe : multiple
  const toggle = (id) => {
    if (type === 'direct') {
      setSelected(prev => prev.includes(id) ? [] : [id])
    } else {
      setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }
  }

  const create = async () => {
    if (selected.length === 0) return
    setLoading(true)
    try {
      const { data } = await api.post('/api/chat/rooms', {
        type,
        nom: type === 'classe' ? (nom || 'Mon groupe') : undefined,
        membres: selected,
      })
      onCreated(data)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Impossible de créer la conversation')
    } finally {
      setLoading(false)
    }
  }

  const totalVisible = Object.values(filteredGroups).reduce((s, l) => s + l.length, 0)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(26,18,7,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(3px)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.surface, borderRadius: 20, padding: '24px', maxWidth: 440, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,.3)', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

        <h2 style={{ margin: '0 0 16px', fontSize: 17, fontWeight: 900, color: C.brown }}>Nouvelle conversation</h2>

        {/* Type (enseignants uniquement : peuvent créer groupes) */}
        {isEnseignant && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[{ k: 'direct', l: '💬 Direct' }, { k: 'classe', l: '👥 Groupe' }].map(t => (
              <button key={t.k} onClick={() => { setType(t.k); setSelected([]) }} style={{ flex: 1, padding: '9px', borderRadius: 10, cursor: 'pointer', border: `2px solid ${type === t.k ? C.brown : C.border}`, background: type === t.k ? C.brownPale : C.bg, fontWeight: 700, fontSize: 13, color: type === t.k ? C.brown : C.textSec }}>
                {t.l}
              </button>
            ))}
          </div>
        )}

        {type === 'classe' && (
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Nom du groupe (ex : Terminale F6)" style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.bg, fontSize: 13, color: C.text, outline: 'none', marginBottom: 12, boxSizing: 'border-box' }}/>
        )}

        {/* Champ de filtre — recherche par nom dans la liste curatée */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <Search size={14} color={C.textSec} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}/>
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Rechercher par nom…"
            style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: C.bg, fontSize: 13, color: C.text, outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => e.target.style.borderColor = C.brown}
            onBlur={e => e.target.style.borderColor = C.border}
          />
        </div>

        {/* Liste des contacts groupés */}
        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16, minHeight: 80 }}>
          {fetching ? (
            <p style={{ textAlign: 'center', color: C.textSec, fontSize: 13, padding: '20px 0' }}>Chargement des contacts…</p>
          ) : totalVisible === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>
                {filter ? `Aucun résultat pour « ${filter} »` : 'Aucun contact disponible'}
              </p>
              {!filter && !isEnseignant && (
                <p style={{ fontSize: 11, color: C.textSec, margin: '6px 0 0', lineHeight: 1.5 }}>
                  Assure-toi d'avoir lié un enseignant via ton profil,<br/>et d'être inscrit dans une classe.
                </p>
              )}
            </div>
          ) : (
            Object.entries(filteredGroups).map(([groupe, list]) => (
              <div key={groupe} style={{ marginBottom: 6 }}>
                {/* En-tête de groupe */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px 4px', marginBottom: 2 }}>
                  {groupe === 'Enseignants'
                    ? <GraduationCap size={12} color={C.brown}/>
                    : groupe === 'Camarades'
                    ? <Users size={12} color={C.emerald}/>
                    : <BookOpen size={12} color={C.blue}/>
                  }
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5 }}>
                    {groupe} ({list.length})
                  </span>
                </div>

                {/* Contacts du groupe */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {list.map(c => {
                    const isSelected = selected.includes(c.id)
                    const disabled   = type === 'direct' && !isSelected && selected.length >= 1
                    const initiales  = `${c.prenom?.[0] || ''}${c.nom?.[0] || ''}`.toUpperCase()
                    const avatarBg   = c.role === 'enseignant' ? C.brown : C.emerald

                    return (
                      <div
                        key={c.id}
                        onClick={() => !disabled && toggle(c.id)}
                        style={{
                          padding: '9px 12px', borderRadius: 10,
                          cursor: disabled ? 'not-allowed' : 'pointer',
                          background: isSelected ? C.brownPale : C.bg,
                          border: `1.5px solid ${isSelected ? C.brown : C.border}`,
                          display: 'flex', alignItems: 'center', gap: 10,
                          transition: 'all .15s', opacity: disabled ? 0.4 : 1,
                        }}
                      >
                        {/* Avatar initiales */}
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: `${avatarBg}20`, color: avatarBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, flexShrink: 0 }}>
                          {initiales}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>{c.prenom} {c.nom}</p>
                          <p style={{ margin: 0, fontSize: 10, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.role === 'enseignant' ? '👩‍🏫 Enseignant' : c.niveau || 'Apprenant'}
                            {c.filiere ? ` · ${c.filiere}` : ''}
                          </p>
                        </div>
                        {isSelected && (
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.brown, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Check size={11} color="white"/>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Sélection résumée + actions */}
        {selected.length > 0 && type === 'classe' && (
          <p style={{ margin: '0 0 10px', fontSize: 11, color: C.textSec, fontWeight: 600 }}>
            {selected.length} membre{selected.length > 1 ? 's' : ''} sélectionné{selected.length > 1 ? 's' : ''}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1.5px solid ${C.border}`, background: 'none', cursor: 'pointer', fontWeight: 700, color: C.textSec, fontSize: 13 }}>
            Annuler
          </button>
          <button
            onClick={create}
            disabled={loading || selected.length === 0}
            style={{ flex: 1, padding: '11px', borderRadius: 10, border: 'none', background: selected.length > 0 ? C.brown : C.border, color: 'white', cursor: selected.length > 0 && !loading ? 'pointer' : 'not-allowed', fontWeight: 800, fontSize: 13, transition: 'background .15s' }}
          >
            {loading ? 'Création…' : type === 'direct' ? 'Ouvrir la discussion' : 'Créer le groupe'}
          </button>
        </div>
      </div>
    </div>
  )
}
