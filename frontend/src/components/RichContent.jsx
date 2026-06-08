/**
 * Rendu progressif du contenu riche des ressources pédagogiques.
 * Blocs supportés : titre, texte, image, alerte, tableau, markdown.
 * Affichage section par section (groupé par h1) avec stagger par bloc.
 * StaticContent : rendu complet sans pagination (pour CoursDetail).
 */
import { useState, useEffect, useMemo } from 'react'
import { useTheme } from '../styles/theme.jsx'
import RichText, { RichTextInline } from './RichText'

// ── Parsing ───────────────────────────────────────────────────────

export function parseBlocks(contenu) {
  if (!contenu) return []
  if (Array.isArray(contenu)) return contenu
  try {
    const parsed = JSON.parse(contenu)
    if (Array.isArray(parsed)) return parsed
    // JSON valide mais pas un tableau → Markdown brut
    return [{ id: 'plain', type: 'markdown', valeur: String(contenu) }]
  } catch {
    // Pas du JSON → contenu Markdown / texte brut
    return [{ id: 'plain', type: 'markdown', valeur: String(contenu) }]
  }
}

export function groupBySections(blocks) {
  if (!blocks.length) return [[]]
  const sections = []
  let current = []
  for (const block of blocks) {
    if (block.type === 'titre' && block.niveau === 'h1') {
      if (current.length) sections.push(current)
      current = [block]
    } else {
      current.push(block)
    }
  }
  if (current.length) sections.push(current)
  return sections.length ? sections : [blocks]
}

// ── Alertes ───────────────────────────────────────────────────────

const ALERT_LIGHT = {
  info:    { bg: '#EFF6FF', border: '#3B82F6', color: '#1E40AF', icon: 'ℹ️' },
  warning: { bg: '#FFF7ED', border: '#F97316', color: '#9A3412', icon: '⚠️' },
  success: { bg: '#ECFDF5', border: '#10B981', color: '#065F46', icon: '✅' },
  danger:  { bg: '#FEF2F2', border: '#EF4444', color: '#991B1B', icon: '🚨' },
}
const ALERT_DARK = {
  info:    { bg: '#1E3A5F', border: '#3B82F6', color: '#93C5FD', icon: 'ℹ️' },
  warning: { bg: '#78350F', border: '#F97316', color: '#FED7AA', icon: '⚠️' },
  success: { bg: '#14532D', border: '#10B981', color: '#6EE7B7', icon: '✅' },
  danger:  { bg: '#7F1D1D', border: '#EF4444', color: '#FCA5A5', icon: '🚨' },
}

// ── Rendu d'un bloc ───────────────────────────────────────────────

export function Block({ block, C, idx }) {
  const { isDark } = useTheme()
  switch (block.type) {

    case 'titre': {
      const isH1 = block.niveau === 'h1'
      const isH2 = block.niveau === 'h2'
      return (
        <div id={idx != null ? `h-${idx}` : undefined} style={{
          borderLeft: isH1
            ? `4px solid ${C.brown}`
            : isH2 ? `3px solid ${C.brownPale}` : 'none',
          paddingLeft: isH1 ? 12 : isH2 ? 10 : 0,
          margin: `${isH1 ? 20 : 12}px 0 4px`,
          scrollMarginTop: 16,
        }}>
          <p style={{
            fontSize:      isH1 ? 16 : isH2 ? 14 : 13,
            fontWeight:    isH1 ? 900 : isH2 ? 800 : 700,
            color:         isH1 ? C.brown : C.text,
            margin:        0,
            textTransform: isH1 ? 'uppercase' : 'none',
            letterSpacing: isH1 ? '.05em' : 0,
          }}>
            {block.valeur}
          </p>
        </div>
      )
    }

    case 'texte':
      return (
        <p style={{
          fontSize:   14,
          color:      C.text,
          lineHeight: 1.9,
          margin:     '6px 0',
          whiteSpace: 'pre-line',
        }}>
          <RichTextInline text={block.valeur} />
        </p>
      )

    case 'image':
      return (
        <figure style={{ margin: '14px 0', textAlign: 'center' }}>
          <img
            src={block.url}
            alt={block.alt || ''}
            style={{
              maxWidth:    '100%',
              maxHeight:    300,
              borderRadius: 12,
              boxShadow:   '0 2px 16px rgba(0,0,0,0.12)',
              display:     'block',
              margin:      '0 auto',
              objectFit:   'contain',
            }}
          />
          {(block.legende || block.alt) && (
            <figcaption style={{
              fontSize:   12,
              color:      C.textMuted,
              marginTop:  8,
              fontStyle: 'italic',
              lineHeight: 1.5,
            }}>
              {block.legende || block.alt}
            </figcaption>
          )}
        </figure>
      )

    case 'alerte': {
      const palette = isDark ? ALERT_DARK : ALERT_LIGHT
      const s = palette[block.style] || palette.info
      return (
        <div style={{
          background:   s.bg,
          borderLeft:  `4px solid ${s.border}`,
          borderRadius: '0 10px 10px 0',
          padding:     '10px 14px',
          margin:      '10px 0',
          display:     'flex',
          gap:          10,
          alignItems:  'flex-start',
        }}>
          <span style={{ fontSize: 15, lineHeight: 1.5, flexShrink: 0 }}>{s.icon}</span>
          <p style={{ fontSize: 13, color: s.color, lineHeight: 1.7, margin: 0 }}>
            <RichTextInline text={block.valeur} />
          </p>
        </div>
      )
    }

    case 'tableau':
      return (
        <div style={{
          overflowX:    'auto',
          margin:       '12px 0',
          borderRadius:  10,
          border:       `1px solid ${C.border}`,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            {block.entetes?.length > 0 && (
              <thead>
                <tr>
                  {block.entetes.map((h, i) => (
                    <th key={i} style={{
                      background:  C.brownPale,
                      color:       C.brown,
                      padding:    '9px 14px',
                      textAlign:  'left',
                      fontWeight:  700,
                      borderBottom:`2px solid ${C.brown}33`,
                      whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.lignes?.map((row, i) => (
                <tr key={i} style={{ background: i % 2 !== 0 ? C.bg : 'transparent' }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{
                      padding:      '8px 14px',
                      borderBottom: `1px solid ${C.border}`,
                      color:         C.text,
                    }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    case 'markdown':
      // Contenu non structuré — rendu via RichText (Markdown + KaTeX)
      return <RichText text={block.valeur} />

    default:
      return null
  }
}

// ── Rendu statique (tout à la fois, sans pagination) ─────────────
// Utilisé par CoursDetail (lecture libre) et tout contexte hors tutoriel.

export function StaticContent({ data, C, xs }) {
  const [tocOpen, setTocOpen] = useState(false)
  const blocks = useMemo(() => parseBlocks(data.contenu), [data.contenu])

  // Extraire les titres h1/h2 pour le sommaire auto
  const headings = useMemo(() =>
    blocks
      .map((b, i) => ({ ...b, _idx: i }))
      .filter(b => b.type === 'titre' && (b.niveau === 'h1' || b.niveau === 'h2')),
    [blocks]
  )

  return (
    <div>
      {data.titre && (
        <h2 style={{ fontSize: xs ? 15 : 17, fontWeight: 800, color: C.brown, marginBottom: 16, paddingBottom: 10, borderBottom: `2px solid ${C.brownPale}` }}>
          {data.titre}
        </h2>
      )}

      {/* Sommaire auto — s'affiche si ≥ 3 titres dans la leçon */}
      {headings.length >= 3 && (
        <div style={{ background: `${C.brown}08`, border: `1px solid ${C.brownPale}`, borderRadius: 12, marginBottom: 20, overflow: 'hidden' }}>
          <button
            onClick={() => setTocOpen(o => !o)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: C.brown }}
          >
            <span>📋 Sommaire · {headings.length} sections</span>
            <span style={{ fontSize: 10, transform: tocOpen ? 'rotate(180deg)' : 'none', transition: 'transform .2s', display: 'inline-block' }}>▼</span>
          </button>
          {tocOpen && (
            <ul style={{ margin: 0, padding: '4px 0 10px', listStyle: 'none', borderTop: `1px solid ${C.brownPale}` }}>
              {headings.map((h, hi) => (
                <li key={hi}>
                  <button
                    onClick={() => document.getElementById(`h-${h._idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    style={{
                      width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer',
                      padding: `5px 14px 5px ${h.niveau === 'h2' ? 28 : 14}px`,
                      fontSize: h.niveau === 'h1' ? 13 : 12,
                      fontWeight: h.niveau === 'h1' ? 700 : 500,
                      color: h.niveau === 'h1' ? C.brown : C.textSec,
                    }}
                  >
                    {h.niveau === 'h1' ? '▸ ' : '· '}{h.valeur}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {blocks.map((block, i) => (
        <Block key={block.id || i} block={block} C={C} idx={i} />
      ))}
      {data.points_cles?.length > 0 && (
        <div style={{ background: C.goldPale, borderRadius: 14, padding: '14px 18px', border: `1.5px solid ${C.gold}44`, marginTop: 20 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: C.brownMid, margin: '0 0 10px', textTransform: 'uppercase' }}>🔑 À retenir</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.points_cles.map((p, i) => (
              <li key={i} style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ── Affichage progressif complet ──────────────────────────────────

export function ProgressiveContent({ data, onDone, C, xs }) {
  const blocks   = useMemo(() => parseBlocks(data.contenu),    [data.contenu])
  const sections = useMemo(() => groupBySections(blocks), [blocks])

  const [sectionIdx,   setSectionIdx]   = useState(0)
  const [visibleCount, setVisibleCount] = useState(0)

  const section       = sections[sectionIdx] || []
  const allVisible    = visibleCount >= section.length
  const isLastSection = sectionIdx >= sections.length - 1

  // Stagger : révèle les blocs un à un (280 ms entre chaque)
  useEffect(() => {
    setVisibleCount(0)
    let cancelled = false
    function reveal(n) {
      if (cancelled || n > section.length) return
      setVisibleCount(n)
      setTimeout(() => reveal(n + 1), 280)
    }
    // Petit délai initial pour laisser la carte apparaître
    const t = setTimeout(() => reveal(1), 80)
    return () => { cancelled = true; clearTimeout(t) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIdx])

  function nextSection() {
    if (isLastSection) onDone()
    else setSectionIdx(s => s + 1)
  }

  return (
    <div>
      {/* En-tête : titre + mini-progress sections */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <span style={{
            display:      'inline-block',
            padding:      '3px 12px',
            borderRadius:  20,
            background:    C.brownPale,
            color:         C.brown,
            fontSize:      11,
            fontWeight:    700,
            textTransform: 'uppercase',
            marginBottom:  8,
          }}>
            📖 Leçon
          </span>
          <h2 style={{ fontSize: xs ? 16 : 18, fontWeight: 800, color: C.text, margin: 0 }}>
            {data.titre}
          </h2>
        </div>
        {sections.length > 1 && (
          <span style={{
            fontSize:    12,
            fontWeight:  700,
            color:       C.textMuted,
            background:  C.bg,
            border:     `1px solid ${C.border}`,
            padding:    '4px 10px',
            borderRadius: 20,
            whiteSpace:  'nowrap',
            marginLeft:   12,
            flexShrink:   0,
          }}>
            {sectionIdx + 1}&thinsp;/&thinsp;{sections.length}
          </span>
        )}
      </div>

      {/* Blocs avec stagger */}
      <div>
        {section.map((block, i) => (
          <div
            key={block.id || i}
            style={{
              opacity:    i < visibleCount ? 1 : 0,
              transform:  i < visibleCount ? 'translateY(0)' : 'translateY(10px)',
              transition: 'opacity 0.32s ease, transform 0.32s ease',
            }}
          >
            <Block block={block} C={C} idx={i} />
          </div>
        ))}
      </div>

      {/* Points clés — seulement sur la dernière section */}
      {allVisible && isLastSection && data.points_cles?.length > 0 && (
        <div style={{
          background:    C.goldPale,
          borderRadius:   14,
          padding:       '14px 18px',
          border:        `1.5px solid ${C.gold}44`,
          marginTop:      20,
          animation:     'fadeUp .35s ease',
        }}>
          <p style={{
            fontSize: 11, fontWeight: 800, color: C.brownMid,
            margin: '0 0 10px', textTransform: 'uppercase',
          }}>
            🔑 À retenir
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.points_cles.map((p, i) => (
              <li key={i} style={{ fontSize: 14, color: C.text, lineHeight: 1.6 }}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Bouton — n'apparaît qu'une fois tous les blocs visibles */}
      {allVisible && (
        <button
          data-advance
          onClick={nextSection}
          style={{
            marginTop:    24,
            padding:      '14px',
            borderRadius:  14,
            border:       'none',
            background:   `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
            color:        'white',
            fontWeight:    800,
            fontSize:      15,
            cursor:        'pointer',
            width:        '100%',
            animation:    'fadeUp .3s ease',
          }}
        >
          {isLastSection ? "J'ai compris →" : 'Suite →'}

        </button>
      )}
    </div>
  )
}
