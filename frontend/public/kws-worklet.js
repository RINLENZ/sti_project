/**
 * kws-capture — AudioWorkletProcessor de capture micro pour le KWS.
 * Remplace le ScriptProcessorNode déprécié.
 *
 * Accumule l'audio par blocs (~2048 échantillons) et les transmet au thread
 * principal via le port, qui se charge du fenêtrage et de l'inférence ONNX.
 */
class KwsCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this._size = 2048
    this._buf  = new Float32Array(this._size)
    this._n    = 0
  }

  process(inputs) {
    const input = inputs[0]
    const ch = input && input[0]
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this._buf[this._n++] = ch[i]
        if (this._n >= this._size) {
          // Copie transférable pour ne pas réutiliser le même buffer
          this.port.postMessage(this._buf.slice(0, this._n))
          this._n = 0
        }
      }
    }
    return true   // garde le processeur vivant
  }
}

registerProcessor('kws-capture', KwsCaptureProcessor)
