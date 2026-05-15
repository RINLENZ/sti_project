import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useTheme } from '../styles/theme.jsx'
import api from '../services/api'
import { Search, BookOpen, Layers, PenLine, X } from 'lucide-react'

export default function SearchModal({ onClose }) {
  const { C } = useTheme()
  const navigate  = useNavigate()
  const { user }  = useSelector(s => s.auth)
  const inputRef  = useRef(null)
  const [q,       setQ]       = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  // Auto-focus à l'ouverture
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 60)
  }, [])

  // Fermer sur Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const search = useCallback((val) => {
    if (val.trim().length < 2) { setResults(null); return }
    setLoading(true)
    api.get(`/api/cours/recherche?q=${encodeURIComponent(val.trim())}`)
      .then(({ data }) => setResults(data))
      .catch(() => setResults(null))
      .finally(() => setLoading(false))
  }, [])

  function handleChange(e) {
    const val = e.target.value
    setQ(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 250)
  }

  function goTo(path) {
    navigate(path)
    onClose()
  }

  const isAdmin = user?.role === 'super_admin'
  const isApprenant = user?.role === 'apprenant'

  const hasResults = results && (
    results.matieres.length > 0 || results.uas.length > 0 || results.exercices.length > 0
  )

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
          backdropFilter: 'blur(4px)', zIndex: 2000,
          animation: 'fadeIn .15s ease',
        }}
      />

      {/* Panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: '12%', left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 580,
          background: C.surface,
          borderRadius: 18,
          boxShadow: '0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.06)',
          zIndex: 2001,
          animation: 'slideDown .18s cubic-bezier(0.16,1,0.3,1)',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          overflow: 'hidden',
        }}
      >
        <style>{`
          @keyframes fadeIn   { from { opacity: 0; } to { opacity: 1; } }
          @keyframes slideDown { from { opacity: 0; transform: translateX(-50%) translateY(-12px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
        `}</style>

        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: `1px solid ${C.brownPale}` }}>
          <Search size={18} color={C.brown} style={{ flexShrink: 0 }}/>
          <input
            ref={inputRef}
            value={q}
            onChange={handleChange}
            placeholder="Rechercher une matière, une UA, un exercice…"
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, color: C.text, background: 'transparent', fontFamily: 'inherit' }}
          />
          {q && (
            <button onClick={() => { setQ(''); setResults(null); inputRef.current?.focus() }}
              style={{ background: C.brownPale, border: 'none', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', display: 'flex', color: C.textSec }}>
              <X size={13}/>
            </button>
          )}
          <kbd style={{ fontSize: 10, fontWeight: 700, color: C.textMuted, background: C.bg || C.brownPale, padding: '3px 7px', borderRadius: 6, border: `1px solid ${C.brownPale}`, flexShrink: 0 }}>
            Esc
          </kbd>
        </div>

        {/* Résultats */}
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: hasResults || loading ? '8px 0' : 0 }}>

          {loading && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: C.textSec, fontSize: 13 }}>Recherche…</div>
          )}

          {!loading && q.trim().length >= 2 && !hasResults && results && (
            <div style={{ padding: '28px 20px', textAlign: 'center' }}>
              <p style={{ fontSize: 28, margin: '0 0 8px' }}>🔍</p>
              <p style={{ fontSize: 13, color: C.textSec, margin: 0 }}>Aucun résultat pour « {q} »</p>
            </div>
          )}

          {!loading && q.trim().length < 2 && (
            <div style={{ padding: '20px 20px 16px', color: C.textMuted, fontSize: 12, textAlign: 'center' }}>
              Tape au moins 2 caractères pour rechercher
            </div>
          )}

          {/* Matières */}
          {results?.matieres?.length > 0 && (
            <Section label="Matières" icon={BookOpen} color={C.brown}>
              {results.matieres.map(m => (
                <ResultRow
                  key={m.id}
                  icon={<BookOpen size={14} color={C.brown}/>}
                  title={m.nom}
                  sub="Matière"
                  color={C.brown}
                  C={C}
                  onClick={() => goTo(isApprenant ? '/dashboard' : '/admin')}
                />
              ))}
            </Section>
          )}

          {/* UAs */}
          {results?.uas?.length > 0 && (
            <Section label="Unités d'apprentissage" icon={Layers} color="#0D9373">
              {results.uas.map(u => (
                <ResultRow
                  key={u.id}
                  icon={<Layers size={14} color="#0D9373"/>}
                  title={u.titre}
                  sub={u.reference_ue || 'UA'}
                  color="#0D9373"
                  C={C}
                  onClick={() => goTo(isAdmin ? '/admin' : `/cours/${u.id}`)}
                />
              ))}
            </Section>
          )}

          {/* Exercices */}
          {results?.exercices?.length > 0 && (
            <Section label="Exercices" icon={PenLine} color="#D4A853">
              {results.exercices.map(e => (
                <ResultRow
                  key={e.id}
                  icon={<PenLine size={14} color="#D4A853"/>}
                  title={e.titre}
                  sub="Exercice"
                  color="#D4A853"
                  C={C}
                  onClick={() => goTo(isAdmin ? '/admin' : `/cours/${e.ua_id}`)}
                />
              ))}
            </Section>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 18px', borderTop: `1px solid ${C.brownPale}`, display: 'flex', gap: 16 }}>
          {[['↵', 'Ouvrir'], ['Esc', 'Fermer']].map(([k, l]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: C.textMuted }}>
              <kbd style={{ background: C.brownPale, padding: '2px 6px', borderRadius: 5, fontSize: 10, fontWeight: 700 }}>{k}</kbd> {l}
            </span>
          ))}
        </div>
      </div>
    </>,
    document.body
  )
}

function Section({ label, icon: Icon, color, children }) {
  const { C } = useTheme()
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 18px 4px', fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '.6px' }}>
        <Icon size={10}/> {label}
      </div>
      {children}
    </div>
  )
}

function ResultRow({ icon, title, sub, color, onClick, C }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 18px', border: 'none', background: hovered ? `${color}10` : 'transparent',
        cursor: 'pointer', textAlign: 'left', transition: 'background .1s',
      }}
    >
      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</p>
        <p style={{ margin: 0, fontSize: 11, color: C.textSec }}>{sub}</p>
      </div>
    </button>
  )
}
