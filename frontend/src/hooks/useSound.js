/**
 * useSound — sons d'interface générés via la WebAudio API (aucun fichier MP3).
 * ============================================================================
 *
 * Tous les sons sont synthétisés à la volée par des oscillateurs, ce qui évite
 * de charger des assets et garantit une latence nulle. Les sons sont volontairement
 * doux (enveloppes courtes, gain faible) pour ne pas être agressifs.
 *
 * Sons disponibles :
 *   - unlockBadge() : cloche douce, 2 notes montantes (660 → 880 Hz)
 *   - success()     : 2 notes montantes courtes
 *   - error()       : 1 note descendante douce (jamais agressive)
 *   - resume()      : pulsation légère (reprise d'activité)
 *
 * Mute global persisté dans localStorage (clé "alisha_sound_muted").
 *
 * Usage :
 *   const { playSound, isMuted, toggleMute } = useSound()
 *   playSound('success')
 *   <button onClick={toggleMute}>{isMuted ? '🔇' : '🔊'}</button>
 */
import { useCallback, useState, useRef, useEffect } from 'react'

const STORAGE_KEY = 'alisha_sound_muted'

function readMuted() {
  try { return localStorage.getItem(STORAGE_KEY) === '1' } catch { return false }
}

// Un seul AudioContext partagé par toute l'app (créé paresseusement après un
// geste utilisateur — exigence des navigateurs modernes).
let _ctx = null
function getCtx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!_ctx) _ctx = new AC()
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {})
  return _ctx
}

/**
 * Joue une note simple avec enveloppe douce (attaque + release).
 * @param ctx    AudioContext
 * @param freq   fréquence en Hz
 * @param start  décalage de départ (s) depuis ctx.currentTime
 * @param dur    durée (s)
 * @param type   forme d'onde ('sine' par défaut = doux)
 * @param peak   gain max (0..1)
 */
function tone(ctx, freq, start, dur, type = 'sine', peak = 0.18) {
  const t0  = ctx.currentTime + start
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  // Enveloppe ADSR simplifiée : montée rapide, descente exponentielle douce.
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

const RECIPES = {
  // Cloche douce, 2 notes montantes
  unlockBadge: (ctx) => {
    tone(ctx, 660, 0,    0.22, 'sine', 0.20)
    tone(ctx, 880, 0.16, 0.30, 'sine', 0.20)
  },
  // 2 notes montantes courtes
  success: (ctx) => {
    tone(ctx, 523.25, 0,    0.13, 'sine', 0.16) // do
    tone(ctx, 783.99, 0.11, 0.18, 'sine', 0.16) // sol
  },
  // 1 note descendante douce (non agressive)
  error: (ctx) => {
    tone(ctx, 392.00, 0,    0.16, 'sine', 0.14) // sol
    tone(ctx, 293.66, 0.12, 0.22, 'sine', 0.14) // ré
  },
  // Pulsation légère (reprise)
  resume: (ctx) => {
    tone(ctx, 440, 0, 0.12, 'triangle', 0.12)
  },
}

export function useSound() {
  const [isMuted, setIsMuted] = useState(readMuted)
  // Garde une ref synchrone pour éviter les closures périmées dans playSound.
  const mutedRef = useRef(isMuted)
  useEffect(() => { mutedRef.current = isMuted }, [isMuted])

  // Synchronise entre onglets/instances du hook.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === STORAGE_KEY) setIsMuted(readMuted()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const playSound = useCallback((name) => {
    if (mutedRef.current) return
    const recipe = RECIPES[name]
    if (!recipe) return
    try {
      const ctx = getCtx()
      if (ctx) recipe(ctx)
    } catch { /* audio indisponible — on ignore silencieusement */ }
  }, [])

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev
      try { localStorage.setItem(STORAGE_KEY, next ? '1' : '0') } catch {}
      return next
    })
  }, [])

  return { playSound, isMuted, toggleMute }
}

export default useSound
