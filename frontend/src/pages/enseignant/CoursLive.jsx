import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../../styles/theme.jsx'
import { useCoursLive } from '../../hooks/useCoursLive'
import Alisha from '../../components/Alisha'
import api from '../../services/api'

// ── Barre de progression engagement ───────────────────────────────
function EngagementBar({ emotions, C }) {
  const recent = emotions.slice(0, 10)
  const map = { engaged: 1, confused: 0.5, bored: 0.25, absent: 0 }
  const avg = recent.length
    ? recent.reduce((a, e) => a + (map[e.valeur] ?? 0.5), 0) / recent.length
    : null

  if (avg === null) return null

  const color = avg > 0.7 ? C.emerald : avg > 0.4 ? C.gold : C.red
  const pct   = Math.round(avg * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.textSec, textTransform: 'uppercase' }}>
          Engagement
        </span>
        <span style={{ fontSize: 13, fontWeight: 800, color }}>{pct}%</span>
      </div>
      <div style={{ height: 8, borderRadius: 6, background: C.border, overflow: 'hidden' }}>
        <div style={{
          height:     '100%',
          width:      `${pct}%`,
          background:  color,
          borderRadius: 6,
          transition: 'width .4s ease',
        }}/>
      </div>
    </div>
  )
}

// ── Panneau quiz ───────────────────────────────────────────────────
function QuizPanel({ exercices, quizActif, quizProgress, onStartQuiz, onEndQuiz, C }) {
  const [selectedId, setSelectedId] = useState('')

  return (
    <div style={{
      background:    C.surface,
      borderRadius:   16,
      border:        `1.5px solid ${C.border}`,
      padding:       '18px',
      display:       'flex',
      flexDirection: 'column',
      gap:            14,
    }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: C.text, margin: 0 }}>Quiz</p>

      {!quizActif ? (
        <>
          <select
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
            style={{
              padding:      '10px 14px',
              borderRadius:  10,
              border:       `1.5px solid ${C.border}`,
              background:    C.bg,
              color:         C.text,
              fontSize:      13,
              width:        '100%',
            }}
          >
            <option value="">Choisir un exercice…</option>
            {exercices.map(ex => (
              <option key={ex.id} value={ex.id}>
                [{ex.type.toUpperCase()}] {ex.titre || ex.enonce?.slice(0, 60)}
              </option>
            ))}
          </select>
          <button
            onClick={() => selectedId && onStartQuiz(selectedId)}
            disabled={!selectedId}
            style={{
              padding:      '11px',
              borderRadius:  10,
              border:       'none',
              background:   `linear-gradient(135deg, ${C.gold}, #B8862A)`,
              color:        'white',
              fontWeight:    700,
              fontSize:      13,
              cursor:        'pointer',
              opacity:       selectedId ? 1 : 0.4,
            }}
          >
            ❓ Lancer le quiz
          </button>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            background:    '#FEF3C7',
            borderRadius:   10,
            padding:       '12px 16px',
            textAlign:     'center',
          }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#B45309', margin: '0 0 4px' }}>Quiz en cours</p>
            {quizProgress && (
              <p style={{ fontSize: 20, fontWeight: 900, color: C.text, margin: 0 }}>
                {quizProgress.repondu} / {quizProgress.total_eleves} ont répondu
              </p>
            )}
          </div>
          <button
            onClick={onEndQuiz}
            style={{
              padding:      '11px',
              borderRadius:  10,
              border:       'none',
              background:   C.red,
              color:        'white',
              fontWeight:    700,
              fontSize:      13,
              cursor:        'pointer',
            }}
          >
            ⏹ Clore le quiz
          </button>
        </div>
      )}
    </div>
  )
}

export default function CoursLive() {
  const { sessionId } = useParams()
  const navigate      = useNavigate()
  const { C }         = useTheme()

  const {
    connected, statut, slideIndex, slideTotal, slideData,
    quizActif, quizStats, quizProgress,
    count, emotions,
  } = useCoursLive(sessionId)

  const [contenu,    setContenu]    = useState(null)
  const [sessionInfo, setSessionInfo] = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [pilotError, setPilotError] = useState('')   // message d'erreur affiché à l'enseignant
  const [code,       setCode]       = useState('')

  useEffect(() => {
    if (!sessionId) return
    // Charge contenu + infos session en parallèle
    api.get(`/api/live/${sessionId}/contenu`).then(r => setContenu(r.data)).catch(() => {})
    // Récupère le code de session
    const savedCode = sessionStorage.getItem(`live_code_${sessionId}`)
    if (savedCode) setCode(savedCode)
    // Fetch HTTP du statut réel au chargement (évite la race condition WS)
    // useCoursLive initialise statut = 'attente' par défaut, mais si la session
    // est déjà 'actif' (rechargement de page), le hook WS met à jour via 'connected'.
    // Ce fetch permet d'afficher un message d'erreur si l'état est incohérent.
  }, [sessionId])

  async function callPilot(endpoint) {
    setPilotError('')
    setLoading(true)
    try {
      await api.post(`/api/live/${sessionId}/${endpoint}`)
    } catch (err) {
      const detail = err.response?.data?.detail || `Erreur lors de "${endpoint}"`
      setPilotError(detail)
      console.error(`[CoursLive] ${endpoint} →`, err.response?.status, detail)
    } finally {
      setLoading(false)
    }
  }

  async function startQuiz(exerciceId) {
    await api.post(`/api/live/${sessionId}/quiz/start`, { exercice_id: exerciceId })
  }

  async function endQuiz() {
    await api.post(`/api/live/${sessionId}/quiz/end`)
  }

  async function terminer() {
    if (!window.confirm('Terminer le cours ? Les élèves seront déconnectés.')) return
    await callPilot('terminer')
    navigate('/prof')
  }

  const currentSlide = contenu?.ressources?.[slideIndex]

  return (
    <div style={{
      minHeight:     '100vh',
      background:     C.bg,
      fontFamily:    "'DM Sans', system-ui, sans-serif",
      display:       'flex',
      flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        background:     C.surface,
        borderBottom:  `1px solid ${C.border}`,
        padding:       '12px 24px',
        display:       'flex',
        alignItems:    'center',
        justifyContent:'space-between',
        gap:            12,
        position:      'sticky',
        top:            0,
        zIndex:         10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Alisha state={quizActif ? 'question' : statut === 'actif' ? 'speaking' : 'idle'} size={38} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 800, color: C.brown, margin: 0 }}>
              Mode pilote
              {code && <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700,
                background: C.brownPale, color: C.brown,
                padding: '2px 10px', borderRadius: 8, letterSpacing: '0.1em',
              }}>{code}</span>}
            </p>
            <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>
              {count} élève{count !== 1 ? 's' : ''} · Slide {slideIndex + 1}/{slideTotal || contenu?.ressources?.length || '?'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* "Démarrer" uniquement si WS confirmé + statut = attente */}
            {statut === 'attente' && connected && (
              <button onClick={() => callPilot('demarrer')} disabled={loading}
                style={btnStyle(C.emerald, loading)}>
                ▶ Démarrer
              </button>
            )}
            {statut === 'attente' && !connected && (
              <span style={{ fontSize: 12, color: C.textMuted, alignSelf: 'center' }}>
                Connexion…
              </span>
            )}
            {statut === 'actif' && (
              <button onClick={() => callPilot('pause')} disabled={loading}
                style={btnStyle(C.gold, loading)}>
                ⏸ Pause
              </button>
            )}
            {statut === 'pause' && (
              <button onClick={() => callPilot('reprendre')} disabled={loading}
                style={btnStyle(C.emerald, loading)}>
                ▶ Reprendre
              </button>
            )}
            <button onClick={terminer} disabled={loading || statut === 'termine'}
              style={btnStyle(C.red, loading || statut === 'termine')}>
              ⏹ Terminer
            </button>
          </div>
          {/* Message d'erreur visible pour l'enseignant */}
          {pilotError && (
            <p style={{ margin: 0, fontSize: 11, color: C.red, fontWeight: 700 }}>
              ⚠ {pilotError}
            </p>
          )}
        </div>
      </div>

      {/* Layout principal */}
      <div style={{
        flex:          1,
        display:       'grid',
        gridTemplateColumns: '1fr 320px',
        gap:            0,
        maxWidth:       1200,
        width:         '100%',
        margin:        '0 auto',
        padding:       '24px 20px',
        gap:            24,
        alignItems:    'start',
      }}>
        {/* Colonne gauche — slide actuel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Slide preview */}
          <div style={{
            background:     C.surface,
            borderRadius:    20,
            border:         `1.5px solid ${C.border}`,
            padding:        '28px',
            boxShadow:      `0 4px 20px ${C.brown}0C`,
            minHeight:       360,
          }}>
            {currentSlide ? (
              <>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20 }}>
                  <span style={{
                    background:    C.brownPale,
                    color:         C.brown,
                    fontSize:      11,
                    fontWeight:    700,
                    padding:       '4px 10px',
                    borderRadius:   10,
                    textTransform: 'uppercase',
                  }}>
                    {currentSlide.type}
                  </span>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: C.text, margin: 0 }}>
                    {currentSlide.titre}
                  </h2>
                </div>
                <p style={{
                  fontSize:   15,
                  color:      C.text,
                  lineHeight: 1.75,
                  whiteSpace: 'pre-wrap',
                  margin:     0,
                }}>
                  {currentSlide.contenu}
                </p>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: C.textMuted }}>
                {statut === 'attente' ? 'Appuie sur Démarrer pour commencer' : 'Aucun contenu'}
              </div>
            )}
          </div>

          {/* Contrôles navigation */}
          {(statut === 'actif' || statut === 'pause') && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => callPilot('reculer')}
                disabled={loading || slideIndex <= 0}
                style={navBtnStyle(C, loading || slideIndex <= 0)}
              >
                ← Précédent
              </button>
              <span style={{ fontSize: 13, color: C.textMuted, alignSelf: 'center', fontWeight: 600 }}>
                {slideIndex + 1} / {slideTotal || contenu?.ressources?.length || '?'}
              </span>
              <button
                onClick={() => callPilot('avancer')}
                disabled={loading || slideIndex >= (slideTotal || contenu?.ressources?.length || 1) - 1}
                style={navBtnStyle(C, loading || slideIndex >= (slideTotal || contenu?.ressources?.length || 1) - 1)}
              >
                Suivant →
              </button>
            </div>
          )}

          {/* Stats quiz */}
          {quizStats && !quizActif && (
            <div style={{
              background:    C.emeraldPale,
              borderRadius:   16,
              padding:       '18px 24px',
              border:        `1.5px solid ${C.emerald}44`,
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.emerald, margin: '0 0 4px', textTransform: 'uppercase' }}>
                Résultats du quiz
              </p>
              <p style={{ fontSize: 28, fontWeight: 900, color: C.text, margin: 0 }}>
                {quizStats.pct}% <span style={{ fontSize: 16, color: C.textSec }}>
                  ({quizStats.correct}/{quizStats.total} corrects)
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Colonne droite — panneau pilote */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Participants */}
          <div style={{
            background:    C.surface,
            borderRadius:   16,
            border:        `1.5px solid ${C.border}`,
            padding:       '16px 18px',
            textAlign:     'center',
          }}>
            <p style={{ fontSize: 32, fontWeight: 900, color: C.brown, margin: 0 }}>{count}</p>
            <p style={{ fontSize: 12, color: C.textSec, margin: '2px 0 0' }}>
              élève{count !== 1 ? 's' : ''} connecté{count !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Engagement */}
          {emotions.length > 0 && (
            <div style={{
              background:    C.surface,
              borderRadius:   16,
              border:        `1.5px solid ${C.border}`,
              padding:       '16px 18px',
              display:       'flex',
              flexDirection: 'column',
              gap:            12,
            }}>
              <EngagementBar emotions={emotions} C={C} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {emotions.slice(0, 5).map((e, i) => (
                  <div key={i} style={{
                    display:       'flex',
                    justifyContent:'space-between',
                    fontSize:       12,
                    color:          C.textSec,
                  }}>
                    <span>{e.nom}</span>
                    <span style={{ fontWeight: 700 }}>
                      {e.valeur === 'engaged' ? '👍' : e.valeur === 'confused' ? '🤔' : e.valeur === 'bored' ? '😴' : '😶'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quiz panel */}
          {statut === 'actif' && contenu?.exercices?.length > 0 && (
            <QuizPanel
              exercices={contenu.exercices}
              quizActif={quizActif}
              quizProgress={quizProgress}
              onStartQuiz={startQuiz}
              onEndQuiz={endQuiz}
              C={C}
            />
          )}

          {/* Plan du cours */}
          {contenu?.ressources?.length > 0 && (
            <div style={{
              background:    C.surface,
              borderRadius:   16,
              border:        `1.5px solid ${C.border}`,
              padding:       '16px 18px',
              display:       'flex',
              flexDirection: 'column',
              gap:            8,
            }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: C.text, margin: 0, textTransform: 'uppercase' }}>
                Plan du cours
              </p>
              {contenu.ressources.map((r, i) => (
                <div key={r.id} style={{
                  display:       'flex',
                  alignItems:    'center',
                  gap:            8,
                  padding:       '8px 10px',
                  borderRadius:   8,
                  background:    i === slideIndex ? C.brownPale : 'transparent',
                  border:        `1.5px solid ${i === slideIndex ? C.brownLight : 'transparent'}`,
                }}>
                  <span style={{
                    fontSize:     11,
                    fontWeight:   700,
                    color:        i === slideIndex ? C.brown : C.textMuted,
                    minWidth:     20,
                  }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 12, color: i === slideIndex ? C.brown : C.textSec, fontWeight: i === slideIndex ? 700 : 400 }}>
                    {r.titre}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function btnStyle(color, disabled) {
  return {
    padding:      '9px 18px',
    borderRadius:  10,
    border:       'none',
    background:    color,
    color:        'white',
    fontWeight:    700,
    fontSize:      13,
    cursor:        disabled ? 'not-allowed' : 'pointer',
    opacity:       disabled ? 0.5 : 1,
  }
}

function navBtnStyle(C, disabled) {
  return {
    padding:      '11px 22px',
    borderRadius:  12,
    border:       `2px solid ${disabled ? C.border : C.brownLight}`,
    background:    disabled ? C.surface : C.brownPale,
    color:         disabled ? C.textMuted : C.brown,
    fontWeight:    700,
    fontSize:      14,
    cursor:        disabled ? 'not-allowed' : 'pointer',
    opacity:       disabled ? 0.5 : 1,
  }
}
