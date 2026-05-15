import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTheme } from '../styles/theme.jsx'
import 'katex/dist/katex.min.css'
import katex from 'katex'
import { Copy, Check, X } from 'lucide-react'

// ── KaTeX ────────────────────────────────────────────────────────────
function renderMath(src, displayMode) {
  try {
    return katex.renderToString(src, { displayMode, throwOnError: false })
  } catch {
    return `<code>${src}</code>`
  }
}

// ── Inline parser ────────────────────────────────────────────────────
// Handles: ![img](url), [link](url), **bold**, *italic*, $math$, `code`
const INLINE_RE = /(!\[[^\]]*\]\([^)]+\)|\[[^\]]*\]\([^)]+\)|\*\*[^*\n]+\*\*|\*[^*\n]+\*|\$[^$\n]+\$|`[^`\n]+`)/g

function parseInline(text, C, onImg) {
  const parts = []
  let last = 0, m
  INLINE_RE.lastIndex = 0
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('![')) {
      const [, alt, url] = tok.match(/!\[([^\]]*)\]\(([^)]+)\)/)
      parts.push(
        <img key={m.index} src={url} alt={alt} onClick={() => onImg?.(url, alt)}
          style={{ maxWidth: '100%', borderRadius: 8, cursor: 'zoom-in', margin: '6px 0', display: 'block' }}/>
      )
    } else if (tok.startsWith('[')) {
      const [, label, url] = tok.match(/\[([^\]]*)\]\(([^)]+)\)/)
      parts.push(
        <a key={m.index} href={url} target="_blank" rel="noopener noreferrer"
          style={{ color: C.brown, textDecoration: 'underline' }}>{label}</a>
      )
    } else if (tok.startsWith('**')) {
      parts.push(<strong key={m.index}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('*')) {
      parts.push(<em key={m.index}>{tok.slice(1, -1)}</em>)
    } else if (tok.startsWith('$')) {
      parts.push(
        <span key={m.index}
          dangerouslySetInnerHTML={{ __html: renderMath(tok.slice(1, -1), false) }}/>
      )
    } else if (tok.startsWith('`')) {
      parts.push(
        <code key={m.index} style={{ fontFamily: 'monospace', fontSize: '0.9em',
          background: C.brownPale, padding: '1px 5px', borderRadius: 4, color: C.brown }}>
          {tok.slice(1, -1)}
        </code>
      )
    }
    last = m.index + tok.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

// ── Code block ───────────────────────────────────────────────────────
function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <div style={{ position: 'relative', background: '#1e1e2e', borderRadius: 10, margin: '12px 0', overflow: 'hidden' }}>
      {lang && (
        <div style={{ padding: '5px 14px', fontSize: 11, fontWeight: 700, color: '#7f7f9e',
          borderBottom: '1px solid #2a2a3c', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '.5px' }}>
          {lang}
        </div>
      )}
      <button onClick={copy}
        style={{ position: 'absolute', top: lang ? 30 : 8, right: 10,
          background: 'rgba(255,255,255,.1)', border: 'none', borderRadius: 6,
          padding: '4px 8px', cursor: 'pointer', color: '#aaa',
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
        {copied ? <Check size={12} color="#4ade80"/> : <Copy size={12}/>}
        {copied ? 'Copié' : 'Copier'}
      </button>
      <pre style={{ margin: 0, padding: '14px', overflowX: 'auto',
        fontFamily: "'Fira Code','Cascadia Code','Courier New',monospace",
        fontSize: 13, lineHeight: 1.6, color: '#cdd6f4' }}>
        <code>{code}</code>
      </pre>
    </div>
  )
}

// ── Fullscreen image ─────────────────────────────────────────────────
function FullscreenImg({ url, alt, onClose }) {
  return createPortal(
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.92)',
        backdropFilter: 'blur(8px)', zIndex: 3000, display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 24, cursor: 'zoom-out' }}>
      <button onClick={onClose}
        style={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,.15)',
          border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer',
          color: '#fff', display: 'flex', lineHeight: 1 }}>
        <X size={20}/>
      </button>
      <img src={url} alt={alt} onClick={e => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12,
          objectFit: 'contain', cursor: 'default' }}/>
      {alt && (
        <p style={{ position: 'absolute', bottom: 20, color: 'rgba(255,255,255,.55)',
          fontSize: 13, textAlign: 'center', margin: 0 }}>{alt}</p>
      )}
    </div>,
    document.body
  )
}

// ── Table renderer ───────────────────────────────────────────────────
function TableRender({ rows, C, onImg }) {
  const isSep = r => /^\|[-| :]+\|$/.test(r.trim())
  const hasHeader = rows.length > 1 && isSep(rows[1] || '')
  const cells = rows.filter(r => !isSep(r))
    .map(r => r.split('|').slice(1, -1).map(c => c.trim()))
  const head = hasHeader ? cells[0] : null
  const body = hasHeader ? cells.slice(1) : cells
  return (
    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
      <table style={{ borderCollapse: 'collapse', minWidth: '100%', fontSize: 13 }}>
        {head && (
          <thead>
            <tr>
              {head.map((c, ci) => (
                <th key={ci} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700,
                  color: C.text, borderBottom: `2px solid ${C.brownPale}`, whiteSpace: 'nowrap' }}>
                  {parseInline(c, C, onImg)}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 ? `${C.brownPale}50` : 'transparent' }}>
              {row.map((c, ci) => (
                <td key={ci} style={{ padding: '7px 12px', borderBottom: `1px solid ${C.brownPale}`, color: C.text }}>
                  {parseInline(c, C, onImg)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Block parser ─────────────────────────────────────────────────────
function parseBlocks(text) {
  const blocks = []
  const lines = text.split('\n')
  let i = 0
  while (i < lines.length) {
    const raw = lines[i]
    const line = raw.trim()

    // Display math fenced $$
    if (line === '$$') {
      const src = []; i++
      while (i < lines.length && lines[i].trim() !== '$$') { src.push(lines[i]); i++ }
      blocks.push({ type: 'math', src: src.join('\n') }); i++; continue
    }
    // Display math single-line $$...$$
    if (line.startsWith('$$') && line.endsWith('$$') && line.length > 4) {
      blocks.push({ type: 'math', src: line.slice(2, -2) }); i++; continue
    }
    // Code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const code = []; i++
      while (i < lines.length && !lines[i].trim().startsWith('```')) { code.push(lines[i]); i++ }
      blocks.push({ type: 'code', lang, code: code.join('\n') }); i++; continue
    }
    // Table
    if (line.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i]); i++ }
      blocks.push({ type: 'table', rows }); continue
    }
    // Blockquote
    if (raw.startsWith('>')) {
      const qt = []
      while (i < lines.length && lines[i].startsWith('>')) {
        qt.push(lines[i].replace(/^>\s?/, '')); i++
      }
      blocks.push({ type: 'quote', text: qt.join('\n') }); continue
    }
    // Horizontal rule
    if (/^[-*_]{3,}$/.test(line)) { blocks.push({ type: 'hr' }); i++; continue }
    // Heading
    const hm = line.match(/^(#{1,3})\s+(.+)$/)
    if (hm) { blocks.push({ type: 'h', level: hm[1].length, text: hm[2] }); i++; continue }
    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      const items = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].replace(/^\s*\d+\.\s/, '')); i++
      }
      blocks.push({ type: 'ol', items }); continue
    }
    // Unordered list
    if (/^[-*]\s/.test(line)) {
      const items = []
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].replace(/^\s*[-*]\s/, '')); i++
      }
      blocks.push({ type: 'ul', items }); continue
    }
    // Empty line
    if (line === '') { i++; continue }
    // Paragraph — collect until block-starting line
    const para = []
    while (i < lines.length) {
      const lt = lines[i].trim()
      if (lt === '' || lt.startsWith('```') || lt.startsWith('>') ||
          lt.startsWith('#') || lt.startsWith('|') || /^[-*_]{3,}$/.test(lt) ||
          lt.startsWith('$$') || /^\d+\.\s/.test(lt) || /^[-*]\s/.test(lt)) break
      para.push(lines[i]); i++
    }
    if (para.length) blocks.push({ type: 'p', text: para.join('\n') })
  }
  return blocks
}

// ── RichText (block-level) ───────────────────────────────────────────
export default function RichText({ text, style }) {
  const { C } = useTheme()
  const [fs, setFs] = useState(null)
  if (!text) return null
  const onImg = (url, alt) => setFs({ url, alt })
  const blocks = parseBlocks(String(text))
  return (
    <div style={{ lineHeight: 1.75, color: C.text, ...style }}>
      {blocks.map((b, bi) => {
        switch (b.type) {
          case 'math':
            return (
              <div key={bi} style={{ overflowX: 'auto', margin: '10px 0', textAlign: 'center' }}
                dangerouslySetInnerHTML={{ __html: renderMath(b.src, true) }}/>
            )
          case 'code':
            return <CodeBlock key={bi} lang={b.lang} code={b.code}/>
          case 'table':
            return <TableRender key={bi} rows={b.rows} C={C} onImg={onImg}/>
          case 'quote':
            return (
              <blockquote key={bi} style={{ borderLeft: `3px solid ${C.brown}`, margin: '10px 0',
                padding: '6px 16px', background: `${C.brown}0a`,
                borderRadius: '0 8px 8px 0', color: C.textSec, fontStyle: 'italic' }}>
                {parseInline(b.text, C, onImg)}
              </blockquote>
            )
          case 'hr':
            return <hr key={bi} style={{ border: 'none', borderTop: `1px solid ${C.brownPale}`, margin: '16px 0' }}/>
          case 'h': {
            const sz = { 1: 20, 2: 17, 3: 15 }[b.level] || 15
            return (
              <p key={bi} style={{ fontSize: sz, fontWeight: 800, color: C.text, margin: '14px 0 6px' }}>
                {parseInline(b.text, C, onImg)}
              </p>
            )
          }
          case 'ul':
            return (
              <ul key={bi} style={{ margin: '8px 0', paddingLeft: 22 }}>
                {b.items.map((it, ii) => (
                  <li key={ii} style={{ color: C.text, marginBottom: 3 }}>
                    {parseInline(it, C, onImg)}
                  </li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={bi} style={{ margin: '8px 0', paddingLeft: 22 }}>
                {b.items.map((it, ii) => (
                  <li key={ii} style={{ color: C.text, marginBottom: 3 }}>
                    {parseInline(it, C, onImg)}
                  </li>
                ))}
              </ol>
            )
          default: // 'p'
            return (
              <p key={bi} style={{ margin: '4px 0', color: C.text }}>
                {parseInline(b.text, C, onImg)}
              </p>
            )
        }
      })}
      {fs && <FullscreenImg url={fs.url} alt={fs.alt} onClose={() => setFs(null)}/>}
    </div>
  )
}

// ── RichTextInline (inline-only, no block structure) ─────────────────
export function RichTextInline({ text, style }) {
  const { C } = useTheme()
  const [fs, setFs] = useState(null)
  if (!text) return null
  return (
    <span style={style}>
      {parseInline(String(text), C, (url, alt) => setFs({ url, alt }))}
      {fs && <FullscreenImg url={fs.url} alt={fs.alt} onClose={() => setFs(null)}/>}
    </span>
  )
}
