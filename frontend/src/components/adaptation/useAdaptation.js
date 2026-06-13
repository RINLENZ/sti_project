import { useState, useRef, useCallback } from 'react'
import api from '../../services/api'

export function useAdaptation() {
  const [currentAdaptation, setCurrentAdaptation] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const processingRef = useRef(false)

  const evaluate = useCallback(async (payload) => {
    if (processingRef.current || currentAdaptation) return
    processingRef.current = true
    setIsProcessing(true)
    try {
      const { data } = await api.post('/api/adaptation/evaluer', payload)
      if (data?.id) setCurrentAdaptation(data)
    } catch {
      // non-critique
    } finally {
      processingRef.current = false
      setIsProcessing(false)
    }
  }, [currentAdaptation])

  const dismiss = useCallback(async (actionType) => {
    const id = currentAdaptation?.id
    setCurrentAdaptation(null)
    if (id) {
      api.post(`/api/adaptation/${id}/confirmer`, { action_type: actionType ?? 'dismiss' }).catch(() => {})
    }
  }, [currentAdaptation])

  return { currentAdaptation, evaluate, dismiss, isProcessing }
}
