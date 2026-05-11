import { useTheme } from '../styles/theme.jsx'

// ── Inline Markdown : **gras** et `code` ─────────────────────────
function renderInline(text, C) {
  if (!text) return text
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ fontWeight: 800 }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={{ background: C?.brownPale || '#F5EDE5', color: C?.brown || '#6B3A2A', padding: '1px 6px', borderRadius: 5, fontSize: '0.9em', fontFamily: 'monospace', fontWeight: 700 }}>{part.slice(1, -1)}</code>
    return part
  })
}

// ── Rendu Markdown legacy ────────────────────────────────────────
function MarkdownBlock({ content, C }) {
  if (!content) return <p style={{ color: C.textSec, fontStyle: 'italic' }}>Aucun contenu.</p>
  const lines = content.split('\n')
  const elements = []
  let codeBlock = [], inCode = false

  lines.forEach((line, i) => {
    if (line.startsWith('```')) {
      if (inCode) {
        elements.push(
          <pre key={i} style={{ background: '#1A1207', color: '#E2D8C8', padding: '16px', borderRadius: 10, overflowX: 'auto', fontSize: 13, lineHeight: 1.6, margin: '12px 0', fontFamily: 'monospace' }}>
            <code>{codeBlock.join('\n')}</code>
          </pre>
        )
        codeBlock = []; inCode = false
      } else { inCode = true }
      return
    }
    if (inCode) { codeBlock.push(line); return }

    if (line.startsWith('### '))
      elements.push(<h3 key={i} style={{ fontSize: 15, fontWeight: 800, color: C.brown, margin: '20px 0 8px', borderLeft: `3px solid ${C.brownLight}`, paddingLeft: 10 }}>{line.slice(4)}</h3>)
    else if (line.startsWith('## '))
      elements.push(<h2 key={i} style={{ fontSize: 17, fontWeight: 800, color: C.text, margin: '24px 0 10px', paddingBottom: 6, borderBottom: `2px solid ${C.border || C.brownPale}` }}>{line.slice(3)}</h2>)
    else if (line.startsWith('# '))
      elements.push(<h1 key={i} style={{ fontSize: 20, fontWeight: 900, color: C.text, margin: '0 0 16px' }}>{line.slice(2)}</h1>)
    else if (line.startsWith('- ') || line.startsWith('* '))
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
          <span style={{ color: C.brownLight, fontWeight: 900, flexShrink: 0 }}>•</span>
          <p style={{ fontSize: 14, color: C.text, margin: 0, lineHeight: 1.7 }}>{renderInline(line.slice(2), C)}</p>
        </div>
      )
    else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\. /)[1]
      elements.push(
        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
          <span style={{ background: C.brown, color: 'white', width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, flexShrink: 0, marginTop: 2 }}>{num}</span>
          <p style={{ fontSize: 14, color: C.text, margin: 0, lineHeight: 1.7 }}>{renderInline(line.replace(/^\d+\. /, ''), C)}</p>
        </div>
      )
    } else if (line.startsWith('> '))
      elements.push(
        <blockquote key={i} style={{ borderLeft: `4px solid ${C.gold}`, padding: '10px 14px', margin: '10px 0', background: `${C.gold}12`, borderRadius: '0 8px 8px 0' }}>
          <p style={{ fontSize: 13, color: C.text, margin: 0, fontStyle: 'italic', lineHeight: 1.6 }}>{line.slice(2)}</p>
        </blockquote>
      )
    else if (line.trim() === '')
      elements.push(<div key={i} style={{ height: 8 }} />)
    else
      elements.push(<p key={i} style={{ fontSize: 14, color: C.text, lineHeight: 1.8, margin: '0 0 6px' }}>{renderInline(line, C)}</p>)
  })

  return <div>{elements}</div>
}

// ── Styles alerte ────────────────────────────────────────────────
const ALERTE = {
  info:    { bg: '#EFF6FF', border: '#3B82F6', color: '#1E40AF', emoji: 'ℹ' },
  success: { bg: '#F0FDF4', border: '#22C55E', color: '#166534', emoji: '✓' },
  warning: { bg: '#FFFBEB', border: '#F59E0B', color: '#92400E', emoji: '⚠' },
  danger:  { bg: '#FEF2F2', border: '#EF4444', color: '#991B1B', emoji: '✕' },
}

// ── Rendu d'un bloc ──────────────────────────────────────────────
function renderBlock(block, i, C) {
  if (block.type === 'texte') return (
    <p key={i} style={{ margin: '0 0 12px', whiteSpace: 'pre-wrap', fontSize: 14, color: C.text, lineHeight: 1.8 }}>{block.valeur}</p>
  )

  if (block.type === 'titre') {
    const s = {
      h1: { fontSize: 20, fontWeight: 900, color: C.brownDark || C.brown, margin: '4px 0 14px', borderBottom: `2px solid ${C.brownPale}`, paddingBottom: 6 },
      h2: { fontSize: 17, fontWeight: 800, color: C.brown, margin: '20px 0 10px', borderBottom: `2px solid ${C.brownPale}`, paddingBottom: 4 },
      h3: { fontSize: 14, fontWeight: 800, color: C.brown, margin: '16px 0 8px', borderLeft: `3px solid ${C.brownLight}`, paddingLeft: 8 },
    }[block.niveau] || {}
    return <div key={i} style={s}>{block.valeur}</div>
  }

  if (block.type === 'code') return (
    <div key={i} style={{ margin: '14px 0', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ background: '#1E293B', padding: '5px 14px' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase' }}>{block.langage}</span>
      </div>
      <pre style={{ background: '#0F172A', color: '#E2E8F0', padding: '14px 16px', margin: 0, overflow: 'auto', fontSize: 13, lineHeight: 1.6, fontFamily: 'monospace' }}>
        <code>{block.valeur}</code>
      </pre>
    </div>
  )

  if (block.type === 'alerte') {
    const s = ALERTE[block.style] || ALERTE.info
    return (
      <div key={i} style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 10, padding: '12px 16px', margin: '12px 0', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>{s.emoji}</span>
        <p style={{ margin: 0, color: s.color, fontWeight: 600, fontSize: 14 }}>{block.valeur}</p>
      </div>
    )
  }

  if (block.type === 'liste') return (
    <ul key={i} style={{ margin: '8px 0 14px', paddingLeft: 0, listStyle: 'none' }}>
      {(block.items || []).map((item, j) => (
        <li key={j} style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
          <span style={{ color: C.brownLight, fontWeight: 900, flexShrink: 0 }}>•</span>
          <span style={{ fontSize: 14, color: C.text, lineHeight: 1.7 }}>{item}</span>
        </li>
      ))}
    </ul>
  )

  if (block.type === 'video') {
    const ytM = block.url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/)
    if (ytM) return (
      <div key={i} style={{ margin: '14px 0', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
        <div style={{ position: 'relative', paddingBottom: '56.25%', height: 0 }}>
          <iframe src={`https://www.youtube.com/embed/${ytM[1]}`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
            allowFullScreen frameBorder="0" title={block.titre || 'Vidéo'} />
        </div>
        {block.titre && <p style={{ padding: '6px 12px', background: '#1F2937', color: '#9CA3AF', fontSize: 11, margin: 0 }}>{block.titre}</p>}
      </div>
    )
    return (
      <div key={i} style={{ margin: '12px 0' }}>
        <a href={block.url} target="_blank" rel="noopener noreferrer" style={{ color: C.blue, textDecoration: 'underline', fontSize: 14 }}>
          🎬 {block.titre || block.url}
        </a>
      </div>
    )
  }

  if (block.type === 'image' && block.url) return (
    <figure key={i} style={{ margin: '14px 0', textAlign: 'center' }}>
      <img src={block.url} alt={block.alt || ''}
        style={{ maxWidth: '100%', borderRadius: 10, boxShadow: '0 4px 14px rgba(0,0,0,.1)', display: 'block', margin: '0 auto' }} />
      {block.legende && <figcaption style={{ fontSize: 12, color: C.textSec, marginTop: 6, fontStyle: 'italic' }}>{block.legende}</figcaption>}
    </figure>
  )

  if (block.type === 'audio' && block.url) return (
    <div key={i} style={{ margin: '14px 0', background: '#F5F3FF', borderRadius: 12, padding: '14px 16px', border: '1.5px solid #DDD6FE' }}>
      {block.titre && <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#6D28D9' }}>🎵 {block.titre}</p>}
      <audio controls src={block.url} style={{ width: '100%' }} />
    </div>
  )

  if (block.type === 'tableau') {
    const entetes = block.entetes || []
    const lignes  = block.lignes  || []
    return (
      <div key={i} style={{ overflowX: 'auto', margin: '14px 0', borderRadius: 10, border: `1px solid ${C.brownPale}`, boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          {entetes.length > 0 && (
            <thead>
              <tr>
                {entetes.map((h, ci) => (
                  <th key={ci} style={{ background: C.brown, color: 'white', padding: '9px 14px', textAlign: 'left', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {lignes.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? C.surface : C.brownPale }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '8px 14px', borderBottom: `1px solid ${C.brownPale}`, color: C.text, lineHeight: 1.5 }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return null
}

// ── Export principal ─────────────────────────────────────────────
export default function ContentRenderer({ content }) {
  const { C } = useTheme()
  if (!content) return <p style={{ color: C.textSec, fontStyle: 'italic', fontSize: 14 }}>Aucun contenu.</p>

  let blocks = null
  try {
    const p = JSON.parse(content)
    if (Array.isArray(p) && p.length > 0) blocks = p
  } catch {}

  if (!blocks) return <MarkdownBlock content={content} C={C} />

  return (
    <div>{blocks.map((block, i) => renderBlock(block, i, C))}</div>
  )
}
