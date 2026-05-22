import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTheme } from '../../styles/theme.jsx'
import { useCoursLive } from '../../hooks/useCoursLive'
import Alisha from '../../components/Alisha'
import api from '../../services/api'

const EMOTION_OPTIONS = [
  { valeur: 'engaged',  label: '👍 Je suis',       color: '#0D9373' },
  { valeur: 'confused', label: '🤔 Pas compris',   color: '#F59E0B' },
  { valeur: 'bored',    label: '😴 C\'est lent',   color: '#6B3A2A' },
]

function SlideView({ ressource, C }) {
  if (!ressource) return (
    <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>
      En attente de la prochaine diapositive…
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:            10,
        paddingBottom:  16,
        borderBottom:  `1.5px solid ${C.border}`,
      }}>
        <span style={{
          background:    C.brownPale,
          color:         C.brown,
          fontSize:      11,
          fontWeight:    700,
          padding:       '4px 10px',
          borderRadius:   10,
          textTransform: 'uppercase',
        }}>
          {ressource.type}
        </span>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: C.text, margin: 0 }}>
          {ressource.titre}
        </h2>
      </div>
      <div style={{
        fontSize:   15,
        color:      C.text,
        lineHeight: 1.75,
        whiteSpace: 'pre-wrap',
      }}>
        {ressource.contenu}
      </div>
      {ressource.points_cles?.length > 0 && (
        <div style={{
          background:    C.goldPale,
          borderRadius:   14,
          padding:       '16px 20px',
          border:        `1.5px solid ${C.gold}44`,
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.gold, margin: '0 0 10px', textTransform: 'uppercase' }}>
            Points clés
          </p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ressource.points_cles.map((p, i) => (
              <li key={i} style={{ fontSize: 14, color: C.text }}>{p}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function QuizView({ exercice, quizRepondu, quizCorrect, quizStats, onReponse, C }) {
  const [selected, setSelected] = useState(null)

  if (!exercice) return null

  function handleChoix(opt) {
    if (quizRepondu) return
    setSelected(opt)
    onReponse(opt)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (quizRepondu || !selected) return
    onReponse(selected)
  }

  // QCM
  if (exercice.type === 'qcm' || exercice.type === 'vrai_faux') {
    const options = exercice.options?.choix || (exercice.type === 'vrai_faux' ? ['Vrai', 'Faux'] : [])
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{
          background:    C.brownPale,
          borderRadius:   14,
          padding:       '16px 20px',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: C.brown, margin: '0 0 8px', textTransform: 'uppercase' }}>
            ❓ Quiz
          </p>
          <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{exercice.enonce}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {options.map((opt, i) => {
            let bg = C.surface
            let border = C.border
            let color = C.text
            if (quizRepondu) {
              if (opt === exercice.reponse_correcte) { bg = C.emeraldPale; border = C.emerald; color = C.emerald }
              else if (opt === selected && !quizCorrect) { bg = '#FEF2F2'; border = C.red; color = C.red }
            } else if (opt === selected) {
              bg = C.brownPale; border = C.brown; color = C.brown
            }
            return (
              <button
                key={i}
                onClick={() => handleChoix(opt)}
                disabled={quizRepondu}
                style={{
                  padding:      '14px 18px',
                  borderRadius:  12,
                  border:       `2px solid ${border}`,
                  background:    bg,
                  color,
                  fontWeight:    600,
                  fontSize:      15,
                  cursor:        quizRepondu ? 'default' : 'pointer',
                  textAlign:    'left',
                  transition:   'all .15s ease',
                }}
              >
                {opt}
              </button>
            )
          })}
        </div>
        {quizRepondu && (
          <div style={{
            background:    quizCorrect ? C.emeraldPale : '#FEF2F2',
            borderRadius:   12,
            padding:       '12px 16px',
            textAlign:     'center',
            fontWeight:     700,
            color:          quizCorrect ? C.emerald : C.red,
          }}>
            {quizCorrect ? '✅ Bonne réponse !' : `❌ La bonne réponse était : ${exercice.reponse_correcte}`}
          </div>
        )}
      </div>
    )
  }

  // Réponse libre / texte à trou
  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{
        background:    C.brownPale,
        borderRadius:   14,
        padding:       '16px 20px',
      }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: C.brown, margin: '0 0 8px', textTransform: 'uppercase' }}>
          ❓ Quiz
        </p>
        <p style={{ fontSize: 16, fontWeight: 700, color: C.text, margin: 0 }}>{exercice.enonce}</p>
      </div>
      <input
        value={selected || ''}
        onChange={e => setSelected(e.target.value)}
        disabled={quizRepondu}
        placeholder="Ta réponse…"
        style={{
          padding:      '14px 18px',
          borderRadius:  12,
          border:       `2px solid ${C.border}`,
          background:    C.surface,
          color:         C.text,
          fontSize:      15,
          outline:      'none',
        }}
      />
      {!quizRepondu && (
        <button
          type="submit"
          disabled={!selected}
          style={{
            padding:      '13px',
            borderRadius:  12,
            border:       'none',
            background:   `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
            color:        'white',
            fontWeight:    700,
            fontSize:      15,
            cursor:        'pointer',
            opacity:       selected ? 1 : 0.5,
          }}
        >
          Envoyer
        </button>
      )}
      {quizRepondu && (
        <div style={{
          background:    quizCorrect ? C.emeraldPale : '#FEF2F2',
          borderRadius:   12,
          padding:       '12px 16px',
          textAlign:     'center',
          fontWeight:     700,
          color:          quizCorrect ? C.emerald : C.red,
        }}>
          {quizCorrect ? '✅ Bonne réponse !' : `❌ La bonne réponse était : ${exercice.reponse_correcte}`}
        </div>
      )}
    </form>
  )
}

export default function EleveLive() {
  const { sessionId } = useParams()
  const navigate      = useNavigate()
  const { C }         = useTheme()

  const {
    connected, statut, slideIndex, slideTotal, slideData,
    quizActif, quizExercice, quizRepondu, quizCorrect, quizStats,
    count, sendEmotion, sendQuizReponse,
  } = useCoursLive(sessionId)

  const [alishaState, setAlishaState] = useState('idle')
  const [emotionSent, setEmotionSent] = useState(null)

  // Synchronise l'état Alisha avec le statut du cours
  useEffect(() => {
    if (statut === 'attente')   setAlishaState('thinking')
    else if (quizActif)         setAlishaState('question')
    else if (statut === 'actif') setAlishaState('speaking')
    else if (statut === 'pause') setAlishaState('idle')
    else if (statut === 'termine') setAlishaState('correct')
  }, [statut, quizActif])

  function handleEmotion(valeur) {
    sendEmotion(valeur)
    setEmotionSent(valeur)
    setTimeout(() => setEmotionSent(null), 3000)
  }

  if (statut === 'termine') {
    return (
      <div style={{
        minHeight:      '100vh',
        background:      C.bg,
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        gap:             20,
        padding:        '32px 20px',
        fontFamily:     "'DM Sans', system-ui, sans-serif",
      }}>
        <Alisha state="correct" size={140} />
        <h1 style={{ fontSize: 24, fontWeight: 900, color: C.brown, margin: 0 }}>Cours terminé !</h1>
        <p style={{ color: C.textSec, margin: 0 }}>Merci d'avoir participé à ce cours en live.</p>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding:      '13px 28px',
            borderRadius:  14,
            border:       'none',
            background:   `linear-gradient(135deg, ${C.brown}, ${C.brownMid})`,
            color:        'white',
            fontWeight:    700,
            cursor:        'pointer',
          }}
        >
          Retour au tableau de bord
        </button>
      </div>
    )
  }

  return (
    <div style={{
      minHeight:     '100vh',
      background:     C.bg,
      display:       'flex',
      flexDirection: 'column',
      fontFamily:    "'DM Sans', system-ui, sans-serif",
    }}>
      {/* Barre du haut */}
      <div style={{
        background:     C.surface,
        borderBottom:  `1px solid ${C.border}`,
        padding:       '12px 20px',
        display:       'flex',
        alignItems:    'center',
        justifyContent:'space-between',
        gap:            12,
        position:      'sticky',
        top:            0,
        zIndex:         10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Alisha state={alishaState} size={36} />
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: C.brown, margin: 0 }}>Cours en live</p>
            <p style={{ fontSize: 11, color: C.textMuted, margin: 0 }}>
              {count} participant{count !== 1 ? 's' : ''} · Slide {slideIndex + 1}/{slideTotal || '?'}
            </p>
          </div>
        </div>
        <span style={{
          padding:      '4px 12px',
          borderRadius:  20,
          fontSize:      12,
          fontWeight:    700,
          background:    statut === 'actif' ? '#FEF3C7' : statut === 'pause' ? C.brownPale : C.brownPale,
          color:         statut === 'actif' ? '#B45309' : C.brown,
        }}>
          {statut === 'attente' ? '⏳ Attente' : statut === 'actif' ? '🔴 Live' : statut === 'pause' ? '⏸ Pause' : statut}
        </span>
      </div>

      {/* Contenu principal */}
      <div style={{
        flex:          1,
        maxWidth:       720,
        width:         '100%',
        margin:        '0 auto',
        padding:       '24px 20px',
        display:       'flex',
        flexDirection: 'column',
        gap:            20,
      }}>
        {/* Attente du démarrage */}
        {statut === 'attente' && (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <Alisha state="thinking" size={100} />
            <p style={{ fontSize: 16, color: C.textSec, marginTop: 16 }}>
              En attente du démarrage par l'enseignant…
            </p>
          </div>
        )}

        {/* Pause */}
        {statut === 'pause' && (
          <div style={{
            background:    C.goldPale,
            borderRadius:   16,
            padding:       '20px',
            textAlign:     'center',
            border:        `1.5px solid ${C.gold}44`,
          }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.brownMid, margin: 0 }}>
              ⏸ Cours en pause — reprise dans quelques instants
            </p>
          </div>
        )}

        {/* Slide ou Quiz */}
        {statut === 'actif' && (
          <div style={{
            background:     C.surface,
            borderRadius:    20,
            border:         `1.5px solid ${C.border}`,
            padding:        '24px',
            boxShadow:      `0 4px 20px ${C.brown}0C`,
          }}>
            {quizActif
              ? <QuizView
                  key={quizExercice?.id}
                  exercice={quizExercice}
                  quizRepondu={quizRepondu}
                  quizCorrect={quizCorrect}
                  quizStats={quizStats}
                  onReponse={sendQuizReponse}
                  C={C}
                />
              : <SlideView ressource={slideData} C={C} />
            }
          </div>
        )}

        {/* Résultats quiz collectifs */}
        {quizStats && !quizActif && (
          <div style={{
            background:    C.emeraldPale,
            borderRadius:   16,
            padding:       '16px 20px',
            border:        `1.5px solid ${C.emerald}44`,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.emerald, margin: '0 0 4px' }}>
              Résultats du quiz
            </p>
            <p style={{ fontSize: 22, fontWeight: 900, color: C.text, margin: 0 }}>
              {quizStats.pct}% de bonnes réponses ({quizStats.correct}/{quizStats.total})
            </p>
          </div>
        )}

        {/* Boutons émotion */}
        {statut === 'actif' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, margin: 0, textTransform: 'uppercase' }}>
              Comment tu te sens ?
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {EMOTION_OPTIONS.map(opt => (
                <button
                  key={opt.valeur}
                  onClick={() => handleEmotion(opt.valeur)}
                  style={{
                    padding:      '10px 16px',
                    borderRadius:  12,
                    border:       `2px solid ${emotionSent === opt.valeur ? opt.color : C.border}`,
                    background:    emotionSent === opt.valeur ? opt.color + '22' : C.surface,
                    color:         emotionSent === opt.valeur ? opt.color : C.textSec,
                    fontWeight:    600,
                    fontSize:      13,
                    cursor:        'pointer',
                    transition:   'all .15s ease',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {emotionSent && (
              <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>Signal envoyé ✓</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
