/**
 * useProctoringCamera
 * Pipeline de surveillance caméra adapté de Session.jsx pour l'épreuve.
 * MediaPipe FaceMesh (géométrie) + face-api.js (CNN expressions).
 * Ne fait PAS d'analyse audio (trop invasif en composition).
 */
import { useState, useRef, useCallback } from 'react'

const FACEAPI_MODELS_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights'
let _faceApiReady = false

async function _loadFaceApiModels() {
  if (_faceApiReady || !window.faceapi) return false
  try {
    await Promise.all([
      window.faceapi.nets.tinyFaceDetector.loadFromUri(FACEAPI_MODELS_URL),
      window.faceapi.nets.faceExpressionNet.loadFromUri(FACEAPI_MODELS_URL),
    ])
    _faceApiReady = true
    return true
  } catch { return false }
}

const CNN_TO_ETAT = {
  happy: 'engagement_eleve', neutral: 'neutre', sad: 'ennui',
  angry: 'frustration', fearful: 'confusion', surprised: 'confusion', disgusted: 'frustration',
}

function _fusionnerEmotion(cnnEmotion, cnnProbs, ear, yaw, pitch) {
  if (ear < 0.18 && Math.abs(pitch) > 10) return 'ennui'
  if (Math.abs(yaw) > 28 && (!cnnProbs || (cnnProbs.neutral || 0) > 0.5)) return 'engagement_faible'
  if (cnnEmotion) return cnnEmotion
  if (Math.abs(yaw) > 25) return 'engagement_faible'
  return 'neutre'
}

function _computeEAR(lm, idx) {
  const p = idx.map(i => lm[i])
  return (
    Math.hypot(p[1].x - p[5].x, p[1].y - p[5].y) +
    Math.hypot(p[2].x - p[4].x, p[2].y - p[4].y)
  ) / (2 * Math.hypot(p[0].x - p[3].x, p[0].y - p[3].y))
}

// Seuil absence : 3 secondes sans visage détecté = 1 incident
const ABSENCE_THRESHOLD_MS = 3000

export default function useProctoringCamera() {
  const [cameraActive,     setCameraActive]     = useState(false)
  const [faceDetected,     setFaceDetected]     = useState(false)
  const [engagementScore,  setEngagementScore]  = useState(1.0)
  const [emotion,          setEmotion]          = useState('neutre')
  const [nbIncidents,      setNbIncidents]      = useState(0)
  const [cameraError,      setCameraError]      = useState(null)

  // Refs — ne déclenchent pas de re-render
  const videoRef         = useRef(null)
  const faceMeshRef      = useRef(null)
  const mediaPipeCamRef  = useRef(null)
  const cnnEmotionRef    = useRef({ emotion: null, probs: null, dominant: null })
  const faceApiIntervalRef = useRef(null)
  const earBufferRef     = useRef([])
  const lastFaceSeenRef  = useRef(Date.now())  // ts du dernier visage détecté
  const faceAbsentRef    = useRef(false)        // état courant : visage absent
  const incidentsRef     = useRef([])           // log détaillé

  const onFaceResults = useCallback((results) => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const now = Date.now()

    if (!results.multiFaceLandmarks?.length) {
      setFaceDetected(false)
      // Début d'absence : démarrer le chrono
      if (!faceAbsentRef.current) {
        faceAbsentRef.current = true
        lastFaceSeenRef.current = now
      }
      // Incident si absence dépasse le seuil
      const absenceDuration = now - lastFaceSeenRef.current
      if (absenceDuration >= ABSENCE_THRESHOLD_MS) {
        // Incident non encore enregistré pour cette absence
        const last = incidentsRef.current[incidentsRef.current.length - 1]
        const alreadyOpen = last && !last.fin
        if (!alreadyOpen) {
          incidentsRef.current.push({ debut: lastFaceSeenRef.current, fin: null })
          setNbIncidents(n => n + 1)
        }
      }
      setEngagementScore(s => Math.max(0, s - 0.02))
      return
    }

    // Visage détecté : fermer l'incident en cours si existant
    if (faceAbsentRef.current) {
      faceAbsentRef.current = false
      const last = incidentsRef.current[incidentsRef.current.length - 1]
      if (last && !last.fin) last.fin = now
    }
    lastFaceSeenRef.current = now
    setFaceDetected(true)

    const lm = results.multiFaceLandmarks[0]
    const earRaw = (
      _computeEAR(lm, [362, 385, 387, 263, 373, 380]) +
      _computeEAR(lm, [33, 160, 158, 133, 153, 144])
    ) / 2

    earBufferRef.current.push(earRaw)
    if (earBufferRef.current.length > 8) earBufferRef.current.shift()
    const ear   = earBufferRef.current.reduce((a, b) => a + b, 0) / earBufferRef.current.length
    const yaw   = (lm[1].x - 0.5) * 180
    const pitch = (lm[1].y - lm[152].y) * 200

    let score = 1.0
    if (ear < 0.15) score -= 0.5; else if (ear < 0.20) score -= 0.4; else if (ear < 0.25) score -= 0.2
    if (Math.abs(yaw) > 45) score -= 0.4; else if (Math.abs(yaw) > 30) score -= 0.3; else if (Math.abs(yaw) > 15) score -= 0.1
    if (Math.abs(pitch) > 30) score -= 0.2; else if (Math.abs(pitch) > 15) score -= 0.1
    score = Math.max(0, Math.min(1, score))
    setEngagementScore(score)

    const { emotion: cnnEmotion, probs: cnnProbs } = cnnEmotionRef.current
    const em = _fusionnerEmotion(cnnEmotion, cnnProbs, ear, yaw, pitch)
    setEmotion(em)
  }, [])

  const startCamera = useCallback(async () => {
    setCameraError(null)

    // Attendre que MediaPipe soit chargé (scripts CDN asynchrones)
    let attempts = 0
    while ((!window.FaceMesh || !window.Camera) && attempts < 10) {
      await new Promise(r => setTimeout(r, 500)); attempts++
    }
    if (!window.FaceMesh || !window.Camera) {
      setCameraError('MediaPipe non disponible')
      return false
    }

    try {
      const fm = new window.FaceMesh({
        locateFile: f => `/mediapipe/face_mesh/${f}`
      })
      fm.setOptions({
        maxNumFaces: 1, refineLandmarks: true,
        minDetectionConfidence: 0.5, minTrackingConfidence: 0.5,
      })
      fm.onResults(onFaceResults)
      faceMeshRef.current = fm

      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 } })
      if (!videoRef.current) { stream.getTracks().forEach(t => t.stop()); return false }
      videoRef.current.srcObject = stream

      const cam = new window.Camera(videoRef.current, {
        onFrame: async () => {
          if (!faceMeshRef.current || !videoRef.current?.videoWidth) return
          try { await faceMeshRef.current.send({ image: videoRef.current }) } catch {}
        },
        width: 320, height: 240,
      })
      await cam.start()
      mediaPipeCamRef.current = cam
      await new Promise(r => setTimeout(r, 800))
      setCameraActive(true)

      // CNN face-api.js en arrière-plan (toutes les 3s)
      const ok = await _loadFaceApiModels()
      if (ok) {
        faceApiIntervalRef.current = setInterval(async () => {
          const vid = videoRef.current
          if (!vid || !vid.videoWidth || !_faceApiReady) return
          try {
            const opts = new window.faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.4 })
            const det  = await window.faceapi.detectSingleFace(vid, opts).withFaceExpressions()
            if (det?.expressions) {
              const probs    = det.expressions
              const dominant = Object.entries(probs).sort((a, b) => b[1] - a[1])[0][0]
              cnnEmotionRef.current = { emotion: CNN_TO_ETAT[dominant] || 'neutre', probs, dominant }
            }
          } catch {}
        }, 3000)
      }

      return true
    } catch (err) {
      setCameraError('Caméra non disponible')
      return false
    }
  }, [onFaceResults])

  const stopCamera = useCallback(() => {
    clearInterval(faceApiIntervalRef.current)
    try { mediaPipeCamRef.current?.stop() } catch {}
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop())
      videoRef.current.srcObject = null
    }
    faceMeshRef.current  = null
    mediaPipeCamRef.current = null
    setCameraActive(false)
    setFaceDetected(false)
  }, [])

  const getIncidentsLog = useCallback(() => incidentsRef.current, [])

  return {
    // État
    cameraActive, faceDetected, engagementScore, emotion,
    nbIncidents, cameraError,
    // DOM refs à attacher à un <video hidden>
    videoRef,
    // Contrôles
    startCamera, stopCamera, getIncidentsLog,
  }
}
