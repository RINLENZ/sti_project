/**
 * Page de démo Alisha v2 — visible sur /dev/alisha.
 * Teste tous les 17 états de l'avatar.
 */
import { useState } from 'react'
import Alisha from '../../components/Alisha'
import { useTheme } from '../../styles/theme.jsx'
import { STATES as ALL_STATES, BUBBLES } from '../../components/AlishaStates'

const STATES = ALL_STATES

export default function AlishaDemo() {
  const { C, isDark } = useTheme()
  const [active, setActive] = useState('idle')
  const [size,   setSize]   = useState(180)

  return (
    <div style={{
      minHeight:    '100vh',
      background:    C.bg,
      display:      'flex',
      flexDirection: 'column',
      alignItems:   'center',
      padding:      '40px 20px',
      fontFamily:   "'DM Sans', system-ui, sans-serif",
      gap:           32,
    }}>
      <div>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: C.brown, margin: 0, textAlign: 'center' }}>
          Alisha — Mascotte Sensia
        </h1>
        <p style={{ fontSize: 14, color: C.textSec, textAlign: 'center', margin: '6px 0 0' }}>
          Prévisualisation de tous les états animés
        </p>
      </div>

      {/* ── Scène principale ── */}
      <div style={{
        background:   isDark ? '#1A0F06' : '#FDF8F0',
        borderRadius:  24,
        border:       `2px solid ${C.brownPale}`,
        padding:      '40px 60px',
        display:      'flex',
        flexDirection: 'column',
        alignItems:   'center',
        gap:           24,
        minWidth:      360,
        boxShadow:    `0 8px 40px ${C.brown}22`,
      }}>
        {/* Avatar */}
        <Alisha state={active} size={size} label="Alisha" />

        {/* Bulle de texte */}
        <div style={{
          maxWidth:     320,
          background:    C.surface,
          borderRadius:  16,
          border:       `1.5px solid ${C.brownPale}`,
          padding:      '14px 18px',
          fontSize:      14,
          color:         C.text,
          lineHeight:    1.55,
          position:     'relative',
          boxShadow:    `0 2px 12px ${C.brown}14`,
        }}>
          {/* Flèche vers le haut */}
          <div style={{
            position:   'absolute',
            top:        -10, left: '50%',
            transform:  'translateX(-50%)',
            width:       0, height: 0,
            borderLeft: '10px solid transparent',
            borderRight:'10px solid transparent',
            borderBottom:`10px solid ${C.brownPale}`,
          }}/>
          <div style={{
            position:   'absolute',
            top:        -8, left: '50%',
            transform:  'translateX(-50%)',
            width:       0, height: 0,
            borderLeft: '9px solid transparent',
            borderRight:'9px solid transparent',
            borderBottom:`9px solid ${C.surface}`,
          }}/>
          {BUBBLES[active]}
        </div>
      </div>

      {/* ── Boutons de state ── */}
      <div style={{
        display:        'flex',
        flexWrap:       'wrap',
        gap:             10,
        justifyContent: 'center',
        maxWidth:        480,
      }}>
        {STATES.map(s => (
          <button
            key={s.id}
            onClick={() => setActive(s.id)}
            style={{
              padding:      '9px 16px',
              borderRadius:  12,
              border:       `2px solid ${active === s.id ? C.brown : C.brownPale}`,
              background:    active === s.id
                ? `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`
                : C.surface,
              color:         active === s.id ? 'white' : C.text,
              fontWeight:    700,
              fontSize:      13,
              cursor:        'pointer',
              fontFamily:   "'DM Sans', system-ui, sans-serif",
              transition:   'all .18s ease',
              display:      'flex',
              alignItems:   'center',
              gap:            6,
            }}
          >
            <span>{s.emoji}</span> {s.label}
          </button>
        ))}
      </div>

      {/* ── Taille ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, color: C.textSec, fontWeight: 600 }}>Taille</span>
        <input
          type="range" min={100} max={300} value={size}
          onChange={e => setSize(Number(e.target.value))}
          style={{ width: 140, accentColor: C.brown }}
        />
        <span style={{ fontSize: 13, color: C.textSec, fontWeight: 700, minWidth: 40 }}>{size}px</span>
      </div>

      {/* ── Grille tous les states ── */}
      <div>
        <p style={{ textAlign: 'center', fontSize: 13, color: C.textSec, fontWeight: 600, marginBottom: 16 }}>
          Tous les états côte à côte
        </p>
        <div style={{
          display:        'flex',
          flexWrap:       'wrap',
          gap:             20,
          justifyContent: 'center',
        }}>
          {STATES.map(s => (
            <div key={s.id} style={{
              display:       'flex',
              flexDirection: 'column',
              alignItems:   'center',
              gap:            6,
              background:    C.surface,
              borderRadius:   16,
              padding:       '16px 12px 10px',
              border:        `1.5px solid ${C.brownPale}`,
              minWidth:       100,
            }}>
              <Alisha state={s.id} size={90} />
              <span style={{ fontSize: 11, fontWeight: 700, color: C.textSec }}>
                {s.emoji} {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
