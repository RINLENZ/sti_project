import { useState, useEffect } from 'react'

export function useBreakpoint() {
  const [w, setW] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024
  )
  useEffect(() => {
    const h = () => setW(window.innerWidth)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return {
    w,
    xs:      w < 480,
    mobile:  w < 768,
    tablet:  w >= 768 && w < 1024,
    desktop: w >= 1024,
  }
}
