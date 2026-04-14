import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function Session() {
  const { uaId }     = useParams()
  const navigate     = useNavigate()
  const { user }     = useSelector(s => s.auth)
  const sessionIdRef = useRef(null)

  // Données cours
  const [ua, setUA]               = useState(null)
  const [exercices, setExercices] = useState([])
  const [sessionId, setSessionId] = useState(null)

  // Navigation exercices
  const [current, setCurrent]   = useState(0)
  const [reponse, setReponse]   = useState('')
  const [resultat, setResultat] = useState(null)
  const [indices, setIndices]   = useState(0)
  const [termine, setTermine]   = useState(false)
  const [scores, setScores]     = useState([])

  // Engagement
  const [engagementScore, setEngagementScore] = useState(1.0)
  const [engagementLevel, setEngagementLevel] = useState('eleve')
  const [adaptation, setAdaptation]           = useState(null)
  const [tempsDebut, setTempsDebut]           = useState(Date.now())

  // Refs MediaPipe
  const videoRef    = useRef(null)
  const canvasRef   = useRef(null)
  const cameraRef   = useRef(null)
  const faceMeshRef = useRef(null)
  const lastSendRef = useRef(0)
  const [cameraActive, setCameraActive] = useState(false)

  // ── Chargement initial ──────────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const { data: uaData } = await api.get(`/api/cours/ua/${uaId}`)
        setUA(uaData)
        setExercices(uaData.exercices || [])

        const { data: sess } = await api.post('/api/cours/session/creer', {
          user_id: user.id,
          ua_id: uaId
        })
        setSessionId(sess.session_id)
        sessionIdRef.current = sess.session_id
      } catch {
        toast.error('Erreur de chargement')
      }
    }
    init()
  }, [uaId, user.id])

  useEffect(() => {
  if (!sessionId) return

  let inactivityTimer = null

  function resetTimer() {
    clearTimeout(inactivityTimer)
    inactivityTimer = setTimeout(() => {
      // Utilise directement la ref pour éviter la dépendance à sendEvent
      const sid = sessionIdRef.current
      if (!sid) return
      api.post('/api/interaction', {
        session_id: sid,
        user_id: user.id,
        type: 'idle',
        data: { duration_seconds: 120 }
      }).catch(() => {})
    }, 120000)
  }

  const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'click']
  events.forEach(e => window.addEventListener(e, resetTimer))
  resetTimer()

  return () => {
    clearTimeout(inactivityTimer)
    events.forEach(e => window.removeEventListener(e, resetTimer))
  }
}, [sessionId, user.id])  // sendEvent retiré des dépendances


  // ── Envoie un événement — NE met PAS à jour engagementScore ────
  const sendEvent = useCallback(async (type, data = {}) => {
    const sid = sessionIdRef.current
    if (!sid) return
    try {
      const { data: res } = await api.post('/api/interaction', {
        session_id: sid,
        user_id: user.id,
        type,
        data
      })
      // Le score visuel prime — on ne remplace pas avec le score comportemental
      // On récupère seulement l'adaptation éventuelle
      if (res.adaptation) setAdaptation(res.adaptation)
    } catch (e) {
      console.error('sendEvent error:', e)
    }
  }, [user.id])
  

  // ── Initialise MediaPipe ────────────────────────────────────────
  async function startCamera() {
    let attempts = 0
    while ((!window.FaceMesh || !window.Camera) && attempts < 10) {
      await new Promise(r => setTimeout(r, 500))
      attempts++
    }

    if (!window.FaceMesh || !window.Camera) {
      toast.error('MediaPipe non disponible — vérifie ta connexion')
      return
    }

    try {
      const faceMesh = new window.FaceMesh({
        locateFile: f =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${f}`
      })
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })
      faceMesh.onResults(onFaceResults)
      faceMeshRef.current = faceMesh

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 }
      })
      videoRef.current.srcObject = stream

      const camera = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (faceMeshRef.current && videoRef.current) {
            await faceMeshRef.current.send({ image: videoRef.current })
          }
        },
        width: 320, height: 240
      })
      await camera.start()
      cameraRef.current = camera
      setCameraActive(true)
      toast.success('Analyse visuelle activée')
    } catch (err) {
      console.error('Erreur caméra:', err)
      toast.error('Caméra non disponible — mode comportemental uniquement')
    }
  }

  // ── Traitement des résultats MediaPipe ─────────────────────────
  function onFaceResults(results) {
    const canvas = canvasRef.current
    const video  = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    canvas.width  = video.videoWidth  || 320
    canvas.height = video.videoHeight || 240
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Visage absent = désengagement total
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      setEngagementScore(0.0)
      setEngagementLevel('faible')

      const now = Date.now()
      if (now - lastSendRef.current > 5000) {
        sendEvent('facial_analysis', {
          visual_score: 0.0,
          ear: 0,
          yaw: 90,
          face_detected: false
        })
        lastSendRef.current = now
      }
      return
    }

    const lm = results.multiFaceLandmarks[0]

    // Calcul EAR
    const LEFT_EYE  = [362, 385, 387, 263, 373, 380]
    const RIGHT_EYE = [33,  160, 158, 133, 153, 144]
    const ear = (computeEAR(lm, LEFT_EYE) + computeEAR(lm, RIGHT_EYE)) / 2

    // Pose de tête
    const yaw   = (lm[1].x - 0.5) * 180
    const pitch = (lm[1].y - lm[152].y) * 200

    // Score visuel
    let visualScore = 1.0
    if (ear < 0.15)               visualScore -= 0.5
    else if (ear < 0.20)          visualScore -= 0.4
    else if (ear < 0.25)          visualScore -= 0.2
    if (Math.abs(yaw) > 45)       visualScore -= 0.4
    else if (Math.abs(yaw) > 30)  visualScore -= 0.3
    else if (Math.abs(yaw) > 15)  visualScore -= 0.1
    if (Math.abs(pitch) > 30)     visualScore -= 0.2
    else if (Math.abs(pitch) > 15) visualScore -= 0.1

    visualScore = Math.max(0.0, Math.min(1.0, visualScore))

    // ← Met à jour l'affichage IMMÉDIATEMENT à chaque frame
    setEngagementScore(visualScore)
    setEngagementLevel(
      visualScore >= 0.7 ? 'eleve' :
      visualScore >= 0.4 ? 'modere' : 'faible'
    )

    console.log(
      `EAR: ${ear.toFixed(3)} | Yaw: ${Math.round(yaw)}° | ` +
      `Pitch: ${Math.round(pitch)}° | Score: ${visualScore.toFixed(2)}`
    )

    // Envoie au backend toutes les 5 secondes
    const now = Date.now()
    if (now - lastSendRef.current > 5000) {
      sendEvent('facial_analysis', {
        visual_score: Math.round(visualScore * 100) / 100,
        ear: Math.round(ear * 100) / 100,
        yaw: Math.round(yaw),
        pitch: Math.round(pitch),
        face_detected: true
      })
      lastSendRef.current = now
    }
  }

  function computeEAR(lm, idx) {
    const p = idx.map(i => lm[i])
    const A = Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y)
    const B = Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y)
    const C = Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y)
    return (A + B) / (2.0 * C)
  }

  // ── Soumettre une réponse ───────────────────────────────────────
  async function soumettre() {
    if (!reponse.trim()) {
      toast.error('Choisis une réponse')
      return
    }
    const ex = exercices[current]
    const tempsReponse = Math.round((Date.now() - tempsDebut) / 1000)

    try {
      const { data } = await api.post('/api/cours/exercice/verifier', {
        exercice_id: ex.id,
        user_id: user.id,
        reponse
      })
      setResultat(data)
      setScores(prev => [...prev, data.points_gagnes])

      if (sessionId) {
        await sendEvent('response', {
          exercice_id: ex.id,
          correct: data.correct,
          time_seconds: tempsReponse
        })
      }

      if (data.correct) toast.success(`+${data.points_gagnes} points !`)
    } catch {
      toast.error('Erreur lors de la vérification')
    }
  }

  // ── Exercice suivant ────────────────────────────────────────────
  function suivant() {
    if (current + 1 >= exercices.length) {
      setTermine(true)
    } else {
      setCurrent(c => c + 1)
      setReponse('')
      setResultat(null)
      setIndices(0)
      setTempsDebut(Date.now())
      setAdaptation(null)
    }
  }

  // ── Couleur selon score ─────────────────────────────────────────
  const scoreColor = engagementScore >= 0.7 ? '#16a34a'
    : engagementScore >= 0.4 ? '#d97706' : '#dc2626'

  // ── Chargement ─────────────────────────────────────────────────
  if (!ua || exercices.length === 0) return (
    <div style={{
      minHeight: '100vh', display: 'flex',
      alignItems: 'center', justifyContent: 'center'
    }}>
      <p>Chargement...</p>
    </div>
  )

  // ── Écran de fin ────────────────────────────────────────────────
  if (termine) {
    const total   = scores.reduce((a, b) => a + b, 0)
    const reussis = scores.filter(s => s > 0).length
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>
            {reussis === exercices.length ? '🏆' : reussis >= exercices.length / 2 ? '👍' : '📚'}
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Session terminée !
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>
            {ua.titre}
          </p>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16, marginBottom: 24
          }}>
            {[
              { label: 'Score',    value: `${total} pts` },
              { label: 'Réussis',  value: `${reussis}/${exercices.length}` },
              { label: 'Réussite', value: `${Math.round(reussis / exercices.length * 100)}%` }
            ].map(s => (
              <div key={s.label} style={{
                padding: 16, background: '#f8fafc',
                borderRadius: 8, border: '1px solid var(--border)'
              }}>
                <p style={{ fontSize: 22, fontWeight: 700, color: '#1e40af' }}>
                  {s.value}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => navigate('/dashboard')}
          >
            Retour au tableau de bord
          </button>
        </div>
      </div>
    )
  }

  const ex = exercices[current]

  // ── Rendu principal ─────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Header session */}
      <div style={{
        background: 'white', borderBottom: '1px solid var(--border)',
        padding: '12px 24px',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {ua.reference_ue} — {ua.titre}
          </p>
          <p style={{ fontSize: 13, fontWeight: 600 }}>
            Exercice {current + 1} / {exercices.length}
          </p>
        </div>

        {/* Barre de progression */}
        <div style={{ flex: 1, maxWidth: 300 }}>
          <div style={{
            height: 6, background: '#e2e8f0',
            borderRadius: 3, overflow: 'hidden'
          }}>
            <div style={{
              height: '100%', borderRadius: 3, background: '#3b82f6',
              width: `${((current + (resultat ? 1 : 0)) / exercices.length) * 100}%`,
              transition: 'width .4s'
            }}/>
          </div>
        </div>

        {/* Score engagement header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 20,
          background: '#f8fafc', border: '1px solid var(--border)'
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: scoreColor
          }}/>
          <span style={{ fontSize: 12, fontWeight: 600, color: scoreColor }}>
            Engagement : {Math.round(engagementScore * 100)}%
          </span>
        </div>
      </div>

      <div style={{
        maxWidth: 700, margin: '0 auto',
        padding: '24px', display: 'flex', gap: 20, flexWrap: 'wrap'
      }}>

        {/* Zone principale exercice */}
        <div style={{ flex: 1, minWidth: 300 }}>

          {/* Alerte adaptation */}
          {adaptation && (
            <div style={{
              padding: 14, borderRadius: 8, marginBottom: 16,
              background: adaptation.priority === 'haute' ? '#fef2f2' : '#fffbeb',
              border: `1px solid ${adaptation.priority === 'haute' ? '#fca5a5' : '#fcd34d'}`
            }}>
              <p style={{
                fontSize: 13, fontWeight: 600,
                color: adaptation.priority === 'haute' ? '#dc2626' : '#d97706'
              }}>
                {adaptation.priority === 'haute' ? '⚠️' : '💡'} {adaptation.message}
              </p>
              <button
                onClick={() => setAdaptation(null)}
                style={{
                  fontSize: 11, color: 'var(--text-muted)',
                  background: 'none', border: 'none',
                  cursor: 'pointer', marginTop: 4
                }}
              >
                Ignorer
              </button>
            </div>
          )}

          {/* Carte exercice */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 16
            }}>
              <span className={`badge ${
                ex.difficulte === 1 ? 'badge-success' :
                ex.difficulte === 2 ? 'badge-warning' : 'badge-danger'
              }`}>
                {ex.difficulte === 1 ? 'Facile' :
                 ex.difficulte === 2 ? 'Moyen' : 'Difficile'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {ex.points} points
              </span>
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, lineHeight: 1.5 }}>
              {ex.titre}
            </h3>

            <p style={{
              fontSize: 14, lineHeight: 1.7, marginBottom: 20,
              whiteSpace: 'pre-line', color: 'var(--text)'
            }}>
              {ex.enonce}
            </p>

            {/* QCM */}
            {ex.type === 'qcm' && ex.options && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ex.options.map((opt, i) => {
                  let bg = 'white', border = 'var(--border)', color = 'var(--text)'
                  if (reponse === opt && !resultat) {
                    bg = '#dbeafe'; border = '#3b82f6'; color = '#1e40af'
                  }
                  if (resultat) {
                    if (opt === resultat.reponse_correcte) {
                      bg = '#dcfce7'; border = '#16a34a'; color = '#166534'
                    } else if (opt === reponse && !resultat.correct) {
                      bg = '#fee2e2'; border = '#dc2626'; color = '#991b1b'
                    }
                  }
                  return (
                    <button key={i}
                      onClick={() => !resultat && setReponse(opt)}
                      style={{
                        padding: '12px 16px', borderRadius: 8,
                        border: `1.5px solid ${border}`,
                        background: bg, color,
                        cursor: resultat ? 'default' : 'pointer',
                        textAlign: 'left', fontSize: 14,
                        transition: 'all .15s',
                        fontWeight: reponse === opt ? 500 : 400
                      }}
                    >
                      <span style={{
                        display: 'inline-block', width: 22, height: 22,
                        borderRadius: '50%', background: border, color: bg,
                        fontSize: 11, fontWeight: 700, textAlign: 'center',
                        lineHeight: '22px', marginRight: 10, flexShrink: 0
                      }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      {opt}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Réponse libre */}
            {ex.type === 'reponse_libre' && (
              <textarea
                rows={3}
                placeholder="Écris ta réponse ici..."
                value={reponse}
                onChange={e => setReponse(e.target.value)}
                disabled={!!resultat}
                style={{ resize: 'vertical' }}
              />
            )}

            {/* Texte à trou */}
            {ex.type === 'texte_trou' && (
              <input
                type="text"
                placeholder="Complète le texte..."
                value={reponse}
                onChange={e => setReponse(e.target.value)}
                disabled={!!resultat}
              />
            )}
          </div>

          {/* Résultat */}
          {resultat && (
            <div className="card" style={{
              marginBottom: 16,
              background: resultat.correct ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${resultat.correct ? '#86efac' : '#fca5a5'}`
            }}>
              <p style={{
                fontWeight: 700, fontSize: 15, marginBottom: 8,
                color: resultat.correct ? '#16a34a' : '#dc2626'
              }}>
                {resultat.correct ? '✓ Bonne réponse !' : '✗ Pas tout à fait...'}
              </p>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
                {resultat.explication}
              </p>
              {!resultat.correct && (
                <p style={{ fontSize: 13, marginTop: 8, color: '#166534' }}>
                  <strong>Réponse correcte :</strong> {resultat.reponse_correcte}
                </p>
              )}
            </div>
          )}

          {/* Indices */}
          {!resultat && (
            <div style={{ marginBottom: 16 }}>
              {indices === 0 && (
                <button
                  onClick={() => {
                    setIndices(1)
                    sendEvent('help_requested', { level: 1 })
                  }}
                  style={{
                    background: 'none', border: '1px dashed #94a3b8',
                    borderRadius: 8, padding: '8px 16px',
                    cursor: 'pointer', fontSize: 13,
                    color: 'var(--text-muted)', width: '100%'
                  }}
                >
                  💡 Besoin d'un indice ?
                </button>
              )}
              {indices >= 1 && ex.indice_1 && (
                <div style={{
                  padding: 12, borderRadius: 8, marginBottom: 8,
                  background: '#fffbeb', border: '1px solid #fcd34d'
                }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>
                    Indice 1
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text)', marginTop: 4 }}>
                    {ex.indice_1}
                  </p>
                  {indices === 1 && ex.indice_2 && (
                    <button
                      onClick={() => {
                        setIndices(2)
                        sendEvent('help_requested', { level: 2 })
                      }}
                      style={{
                        fontSize: 12, color: '#92400e', background: 'none',
                        border: 'none', cursor: 'pointer', marginTop: 8
                      }}
                    >
                      Voir l'indice 2 →
                    </button>
                  )}
                </div>
              )}
              {indices >= 2 && ex.indice_2 && (
                <div style={{
                  padding: 12, borderRadius: 8,
                  background: '#fff7ed', border: '1px solid #fdba74'
                }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#9a3412' }}>
                    Indice 2
                  </p>
                  <p style={{ fontSize: 13, color: 'var(--text)', marginTop: 4 }}>
                    {ex.indice_2}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Boutons action */}
          <div style={{ display: 'flex', gap: 12 }}>
            {!resultat ? (
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={soumettre}
                disabled={!reponse.trim()}
              >
                Valider la réponse
              </button>
            ) : (
              <button
                className="btn btn-success"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={suivant}
              >
                {current + 1 >= exercices.length
                  ? 'Terminer la session'
                  : 'Exercice suivant →'}
              </button>
            )}
          </div>
        </div>

        {/* Panneau latéral — caméra + engagement */}
        <div style={{ width: 200, flexShrink: 0 }}>
          <div className="card" style={{ padding: 16 }}>
            <p style={{
              fontSize: 12, fontWeight: 600,
              color: 'var(--text-muted)', marginBottom: 12
            }}>
              Analyse en direct
            </p>

            {/* Canvas (affiche le flux vidéo) */}
            <div style={{
              background: '#1e293b', borderRadius: 8,
              overflow: 'hidden', marginBottom: 12,
              aspectRatio: '4/3', position: 'relative'
            }}>
              <video
                ref={videoRef}
                autoPlay playsInline muted
                style={{ display: 'none' }}
              />
              <canvas
                ref={canvasRef}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  display: cameraActive ? 'block' : 'none'
                }}
              />
              {!cameraActive && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8
                }}>
                  <span style={{ fontSize: 24 }}>📷</span>
                  <p style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
                    Caméra désactivée
                  </p>
                </div>
              )}
            </div>

            {!cameraActive && (
              <button
                onClick={startCamera}
                style={{
                  width: '100%', padding: '8px',
                  background: '#1e40af', color: 'white',
                  border: 'none', borderRadius: 6,
                  cursor: 'pointer', fontSize: 12, marginBottom: 12
                }}
              >
                Activer la caméra
              </button>
            )}

            {/* Jauge engagement */}
            <div style={{ marginBottom: 8 }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', marginBottom: 4
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Engagement
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor }}>
                  {Math.round(engagementScore * 100)}%
                </span>
              </div>
              <div style={{
                height: 8, background: '#e2e8f0',
                borderRadius: 4, overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%', borderRadius: 4,
                  background: scoreColor,
                  width: `${engagementScore * 100}%`,
                  transition: 'width .3s, background .3s'
                }}/>
              </div>
            </div>

            {/* Niveau */}
            <div style={{
              padding: '6px 10px', borderRadius: 6,
              background: engagementLevel === 'eleve'  ? '#dcfce7' :
                          engagementLevel === 'modere' ? '#fef9c3' : '#fee2e2',
              textAlign: 'center'
            }}>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: engagementLevel === 'eleve'  ? '#166534' :
                       engagementLevel === 'modere' ? '#854d0e' : '#991b1b'
              }}>
                {engagementLevel === 'eleve'  ? '🟢 Engagé' :
                 engagementLevel === 'modere' ? '🟡 Modéré' : '🔴 Décroché'}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}