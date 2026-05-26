/**
 * Calcul MFCC en JS pur — correspond à librosa.feature.mfcc(
 *   y, sr=16000, n_mfcc=40, hop_length=160, n_fft=512
 * ) suivi d'une normalisation par clip (zero-mean / unit-std).
 */

const SR        = 16_000
const N_MFCC    = 40
const N_FFT     = 512
const HOP_LENGTH= 160
const N_MELS    = 128
export const N_FRAMES = Math.floor((SR - N_FFT) / HOP_LENGTH) + 1  // ~101

// ── Hann window ───────────────────────────────────────────────────────
function hannWindow(n) {
  const w = new Float32Array(n)
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)))
  return w
}
const HANN = hannWindow(N_FFT)

// ── Radix-2 FFT in-place (real + imag arrays length = power of 2) ─────
function fftInPlace(re, im) {
  const n = re.length
  let j = 0
  for (let i = 1; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len
    for (let i = 0; i < n; i += len) {
      let wr = 1, wi = 0
      const dwr = Math.cos(ang), dwi = Math.sin(ang)
      for (let k = 0; k < len >> 1; k++) {
        const tr = wr * re[i + k + len/2] - wi * im[i + k + len/2]
        const ti = wr * im[i + k + len/2] + wi * re[i + k + len/2]
        re[i + k + len/2] = re[i + k] - tr
        im[i + k + len/2] = im[i + k] - ti
        re[i + k] += tr
        im[i + k] += ti
        const nwr = wr * dwr - wi * dwi
        wi = wr * dwi + wi * dwr
        wr = nwr
      }
    }
  }
}

// ── Mel filterbank (N_MELS triangular filters, 0 Hz → SR/2) ─────────
function buildMelFilterbank() {
  const hzToMel = hz => 2595 * Math.log10(1 + hz / 700)
  const melToHz = mel => 700 * (10 ** (mel / 2595) - 1)
  const melMin = hzToMel(0)
  const melMax = hzToMel(SR / 2)
  const pts = new Float32Array(N_MELS + 2)
  for (let i = 0; i <= N_MELS + 1; i++)
    pts[i] = melToHz(melMin + (melMax - melMin) * i / (N_MELS + 1))
  const bins = pts.map(f => Math.floor((N_FFT + 1) * f / SR))
  const fb = Array.from({ length: N_MELS }, () => new Float32Array(N_FFT / 2 + 1))
  for (let m = 1; m <= N_MELS; m++) {
    for (let k = bins[m - 1]; k <= bins[m]; k++)
      fb[m - 1][k] = (k - bins[m - 1]) / Math.max(1, bins[m] - bins[m - 1])
    for (let k = bins[m]; k <= bins[m + 1]; k++)
      fb[m - 1][k] = (bins[m + 1] - k) / Math.max(1, bins[m + 1] - bins[m])
  }
  return fb
}
const MEL_FB = buildMelFilterbank()

// ── DCT-II orthonormal (Type 2, norm='ortho') ─────────────────────────
function dctOrtho(x) {
  const n = x.length
  const out = new Float32Array(N_MFCC)
  const scale0 = Math.sqrt(1 / (4 * n))
  const scaleK  = Math.sqrt(1 / (2 * n))
  for (let k = 0; k < N_MFCC; k++) {
    let s = 0
    for (let i = 0; i < n; i++) s += x[i] * Math.cos(Math.PI * k * (2 * i + 1) / (2 * n))
    out[k] = s * (k === 0 ? 2 * scale0 : 2 * scaleK)
  }
  return out
}

// ── power_to_db (librosa default: ref=max, top_db=80) ─────────────────
function powerToDb(melSpec) {
  // melSpec: Float32Array of length N_MELS
  let maxVal = 0
  for (let i = 0; i < melSpec.length; i++) if (melSpec[i] > maxVal) maxVal = melSpec[i]
  const refVal = Math.max(maxVal, 1e-10)
  const out = new Float32Array(melSpec.length)
  const maxDb = 10 * Math.log10(refVal / refVal)  // = 0
  for (let i = 0; i < melSpec.length; i++) {
    const db = 10 * Math.log10(Math.max(melSpec[i], 1e-10) / refVal)
    out[i] = Math.max(db, maxDb - 80)  // top_db = 80
  }
  return out
}

export const MAX_FRAMES_V3 = 100  // longueur fixe pour le modèle V3 KWS (MFCC)

// ══════════════════════════════════════════════════════════════════════════
//  log-Mel V4 — AudioResNet (n_mels=80, max_len=150, hop_length=160)
// ══════════════════════════════════════════════════════════════════════════

export const MAX_FRAMES_V4  = 150
const N_MELS_V4  = 80
const HOP_V4     = 160
const FMIN_V4    = 50    // Hz — filtrage des basses fréquences (idem notebook)
const FMAX_V4    = 8000  // Hz

// Mel filterbank 80 bandes avec fmin=50, fmax=8000 (paramètres du notebook)
function buildMelFilterbankV4() {
  const hzToMel = hz => 2595 * Math.log10(1 + hz / 700)
  const melToHz = mel => 700 * (10 ** (mel / 2595) - 1)
  const melMin  = hzToMel(FMIN_V4)
  const melMax  = hzToMel(FMAX_V4)
  const pts = new Float32Array(N_MELS_V4 + 2)
  for (let i = 0; i <= N_MELS_V4 + 1; i++)
    pts[i] = melToHz(melMin + (melMax - melMin) * i / (N_MELS_V4 + 1))
  const bins = pts.map(f => Math.floor((N_FFT + 1) * f / SR))
  const fb = Array.from({ length: N_MELS_V4 }, () => new Float32Array(N_FFT / 2 + 1))
  for (let m = 1; m <= N_MELS_V4; m++) {
    for (let k = bins[m - 1]; k <= bins[m]; k++)
      fb[m - 1][k] = (k - bins[m - 1]) / Math.max(1, bins[m] - bins[m - 1])
    for (let k = bins[m]; k <= bins[m + 1]; k++)
      fb[m - 1][k] = (bins[m + 1] - k) / Math.max(1, bins[m + 1] - bins[m])
  }
  return fb
}
const MEL_FB_V4 = buildMelFilterbankV4()

/**
 * Extrait log-Mel + Δ + ΔΔ — format AudioResNet V2.
 * Input  : Float32Array PCM mono 16 kHz
 * Output : Float32Array shape (3, 80, 150) row-major = 36 000 valeurs
 *          canal 0 = log-mel, canal 1 = Δ, canal 2 = ΔΔ
 */
export function computeLogMelFull(pcm) {
  // Pad/tronque à 1 500 ms (24 000 samples) → ~149 frames, complété à 150
  const TARGET = Math.round(SR * 1.5)
  const audio  = new Float32Array(TARGET)
  audio.set(pcm.slice(0, Math.min(pcm.length, TARGET)))

  // Normalisation amplitude
  let maxAmp = 0
  for (let i = 0; i < audio.length; i++) if (Math.abs(audio[i]) > maxAmp) maxAmp = Math.abs(audio[i])
  if (maxAmp > 0) for (let i = 0; i < audio.length; i++) audio[i] /= maxAmp

  const nFramesRaw = Math.floor((audio.length - N_FFT) / HOP_V4) + 1
  const nFrames    = Math.min(MAX_FRAMES_V4, nFramesRaw)

  const re  = new Float32Array(N_FFT)
  const im  = new Float32Array(N_FFT)
  // Passe 1 : collecter le spectrogramme mel brut (puissance)
  const melMatrix = new Float32Array(N_MELS_V4 * MAX_FRAMES_V4)

  for (let t = 0; t < nFrames; t++) {
    const start = t * HOP_V4
    re.fill(0); im.fill(0)
    for (let i = 0; i < N_FFT && start + i < audio.length; i++)
      re[i] = audio[start + i] * HANN[i]

    fftInPlace(re, im)

    const power = new Float32Array(N_FFT / 2 + 1)
    for (let i = 0; i <= N_FFT / 2; i++)
      power[i] = (re[i] ** 2 + im[i] ** 2) / N_FFT

    for (let m = 0; m < N_MELS_V4; m++) {
      let s = 0
      for (let k = 0; k <= N_FFT / 2; k++) s += MEL_FB_V4[m][k] * power[k]
      melMatrix[m * MAX_FRAMES_V4 + t] = s
    }
  }

  // Passe 2 : power_to_db(ref=global_max, top_db=80) — identique à librosa
  let globalMax = 0
  for (let i = 0; i < melMatrix.length; i++) if (melMatrix[i] > globalMax) globalMax = melMatrix[i]
  const refVal = Math.max(globalMax, 1e-10)
  const logMel = new Float32Array(N_MELS_V4 * MAX_FRAMES_V4)
  for (let i = 0; i < melMatrix.length; i++) {
    const db = 10 * Math.log10(Math.max(melMatrix[i], 1e-10) / refVal)
    logMel[i] = Math.max(db, -80)  // top_db = 80, plage [-80, 0] dB
  }

  // Δ et ΔΔ sur les 80 bandes (width=9, même paramètre que V3)
  const delta1 = computeDelta(logMel, N_MELS_V4, MAX_FRAMES_V4)
  const delta2 = computeDelta(delta1,  N_MELS_V4, MAX_FRAMES_V4)

  // Empiler 3 canaux : (3, 80, 150) row-major
  const out = new Float32Array(3 * N_MELS_V4 * MAX_FRAMES_V4)
  out.set(logMel,  0)
  out.set(delta1,  N_MELS_V4 * MAX_FRAMES_V4)
  out.set(delta2,  2 * N_MELS_V4 * MAX_FRAMES_V4)
  return out  // 36 000 éléments
}

/**
 * Différentiel MFCC (équivalent librosa.feature.delta, width=9).
 * mfccMatrix : Float32Array row-major [coeff * nFrames].
 * Retourne Float32Array de même taille.
 */
function computeDelta(mfccMatrix, nCoeff, nFrames, width = 9) {
  const W = Math.floor(width / 2)   // = 4
  // dénominateur = 2 * sum(k^2) pour k=1..W
  let denom = 0
  for (let k = 1; k <= W; k++) denom += k * k
  denom *= 2   // = 60

  const delta = new Float32Array(nCoeff * nFrames)
  for (let c = 0; c < nCoeff; c++) {
    for (let t = 0; t < nFrames; t++) {
      let s = 0
      for (let k = 1; k <= W; k++) {
        const tFwd = Math.min(t + k, nFrames - 1)
        const tBwd = Math.max(t - k, 0)
        s += k * (mfccMatrix[c * nFrames + tFwd] - mfccMatrix[c * nFrames + tBwd])
      }
      delta[c * nFrames + t] = s / denom
    }
  }
  return delta
}

/**
 * Extrait MFCC + Δ + Δ² (120 × MAX_FRAMES_V3) depuis un PCM mono 16kHz.
 * Retourne Float32Array shape (120 * 100) row-major, sans normalisation globale
 * (la normalisation est appliquée dans useKWSModel avec les stats du train set).
 */
export function computeMFCCFull(pcm) {
  const target = SR
  let audio = new Float32Array(target)
  audio.set(pcm.slice(0, Math.min(pcm.length, target)))

  // Normalise amplitude
  let maxAmp = 0
  for (let i = 0; i < audio.length; i++) if (Math.abs(audio[i]) > maxAmp) maxAmp = Math.abs(audio[i])
  if (maxAmp > 0) for (let i = 0; i < audio.length; i++) audio[i] /= maxAmp

  const nFramesRaw = Math.floor((audio.length - N_FFT) / HOP_LENGTH) + 1
  const nFrames    = Math.min(MAX_FRAMES_V3, nFramesRaw)

  const re = new Float32Array(N_FFT)
  const im = new Float32Array(N_FFT)
  const mfccMatrix = new Float32Array(N_MFCC * MAX_FRAMES_V3)

  for (let t = 0; t < nFrames; t++) {
    const start = t * HOP_LENGTH
    re.fill(0); im.fill(0)
    for (let i = 0; i < N_FFT && start + i < audio.length; i++)
      re[i] = audio[start + i] * HANN[i]

    fftInPlace(re, im)

    const power = new Float32Array(N_FFT / 2 + 1)
    for (let i = 0; i <= N_FFT / 2; i++)
      power[i] = (re[i] ** 2 + im[i] ** 2) / N_FFT

    const melSpec = new Float32Array(N_MELS)
    for (let m = 0; m < N_MELS; m++) {
      let s = 0
      for (let k = 0; k <= N_FFT / 2; k++) s += MEL_FB[m][k] * power[k]
      melSpec[m] = s
    }

    const melDb  = powerToDb(melSpec)
    const coeffs = dctOrtho(melDb)
    for (let k = 0; k < N_MFCC; k++) mfccMatrix[k * MAX_FRAMES_V3 + t] = coeffs[k]
  }

  // Δ et Δ²
  const delta1 = computeDelta(mfccMatrix, N_MFCC, MAX_FRAMES_V3)
  const delta2 = computeDelta(delta1,     N_MFCC, MAX_FRAMES_V3)

  // Concatène : (120, 100) row-major
  const full = new Float32Array(N_MFCC * 3 * MAX_FRAMES_V3)
  full.set(mfccMatrix)
  full.set(delta1, N_MFCC * MAX_FRAMES_V3)
  full.set(delta2, N_MFCC * 2 * MAX_FRAMES_V3)
  return full  // (120 * 100) = 12 000 éléments
}

/**
 * Calcule la matrice MFCC (40 × N_FRAMES × 1) depuis un Float32Array PCM mono 16kHz.
 * Renvoie un Float32Array shape (N_MFCC × N_FRAMES × 1) = 40 × 101 × 1 = 4040 éléments.
 */
export function computeMFCC(pcm) {
  // Pad ou tronque à exactement SR samples
  const target = SR
  let audio = new Float32Array(target)
  audio.set(pcm.slice(0, Math.min(pcm.length, target)))

  // Normalisation amplitude
  let maxAmp = 0
  for (let i = 0; i < audio.length; i++) if (Math.abs(audio[i]) > maxAmp) maxAmp = Math.abs(audio[i])
  if (maxAmp > 0) for (let i = 0; i < audio.length; i++) audio[i] /= maxAmp

  const nFramesActual = Math.floor((audio.length - N_FFT) / HOP_LENGTH) + 1
  const nFrames = Math.min(N_FRAMES, nFramesActual)

  // Matrices temporaires
  const re = new Float32Array(N_FFT)
  const im = new Float32Array(N_FFT)
  const mfccMatrix = new Float32Array(N_MFCC * N_FRAMES)  // row-major [coeff, frame]

  for (let t = 0; t < nFrames; t++) {
    const start = t * HOP_LENGTH
    re.fill(0); im.fill(0)
    for (let i = 0; i < N_FFT && start + i < audio.length; i++)
      re[i] = audio[start + i] * HANN[i]

    fftInPlace(re, im)

    // Power spectrum (unilatéral)
    const power = new Float32Array(N_FFT / 2 + 1)
    for (let i = 0; i <= N_FFT / 2; i++)
      power[i] = (re[i] ** 2 + im[i] ** 2) / N_FFT

    // Mel filterbank → power mel spectrogram
    const melSpec = new Float32Array(N_MELS)
    for (let m = 0; m < N_MELS; m++) {
      let s = 0
      for (let k = 0; k <= N_FFT / 2; k++) s += MEL_FB[m][k] * power[k]
      melSpec[m] = s
    }

    // power_to_db → dB scale
    const melDb = powerToDb(melSpec)

    // DCT ortho → N_MFCC coefficients
    const coeffs = dctOrtho(melDb)
    for (let k = 0; k < N_MFCC; k++) mfccMatrix[k * N_FRAMES + t] = coeffs[k]
  }

  // Normalisation par clip (zero-mean, unit-std) — même que librosa dans train_kws_model.py
  let mean = 0, std = 0, count = N_MFCC * N_FRAMES
  for (let i = 0; i < count; i++) mean += mfccMatrix[i]
  mean /= count
  for (let i = 0; i < count; i++) std += (mfccMatrix[i] - mean) ** 2
  std = Math.sqrt(std / count + 1e-8)
  for (let i = 0; i < count; i++) mfccMatrix[i] = (mfccMatrix[i] - mean) / std

  // Reshape vers (N_MFCC, N_FRAMES, 1) pour ONNX — ajouter dim channel
  const output = new Float32Array(N_MFCC * N_FRAMES)  // même layout
  output.set(mfccMatrix)
  return output  // shape (40 * 101) → interprété comme (1, 40, 101, 1) par le hook
}

/**
 * Rééchantillonne un Float32Array depuis `fromSR` vers 16000 Hz
 * via interpolation linéaire.
 */
export function resampleTo16k(pcm, fromSR) {
  if (fromSR === SR) return pcm
  const ratio = fromSR / SR
  const outLen = Math.floor(pcm.length / ratio)
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio
    const lo = Math.floor(src)
    const hi = Math.min(lo + 1, pcm.length - 1)
    out[i] = pcm[lo] + (src - lo) * (pcm[hi] - pcm[lo])
  }
  return out
}
