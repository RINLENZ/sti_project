import { C } from '../styles/theme'

const base = {
  background: `linear-gradient(90deg, ${C.brownPale} 25%, #f0e8e0 50%, ${C.brownPale} 75%)`,
  backgroundSize: '400px 100%',
  animation: 'shimmer 1.4s ease-in-out infinite',
  borderRadius: 8,
}

export function Sk({ w = '100%', h = 14, r = 8, mb = 0, style = {} }) {
  return (
    <div style={{ ...base, width: w, height: h, borderRadius: r, marginBottom: mb, flexShrink: 0, ...style }} />
  )
}

export function SkCard({ style = {} }) {
  return (
    <div style={{
      background: C.surface, borderRadius: 14,
      padding: '16px 18px', border: `1px solid ${C.border}`,
      boxShadow: '0 2px 10px rgba(107,58,42,0.06)',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <Sk w={38} h={38} r={10} />
        <div style={{ flex: 1 }}>
          <Sk h={13} mb={6} />
          <Sk h={10} w="60%" />
        </div>
      </div>
      <Sk h={6} r={4} mb={6} />
      <Sk h={6} r={4} w="80%" />
    </div>
  )
}

export function SkStatCard({ xs = false }) {
  return (
    <div style={{
      backgroundColor: C.surface, borderRadius: xs ? 12 : 14,
      padding: xs ? '12px 13px' : '15px 17px',
      border: `1px solid ${C.border}`,
      boxShadow: '0 1px 8px rgba(107,58,42,0.07)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
        <Sk w={60} h={9} />
        <Sk w={26} h={26} r={7} />
      </div>
      <Sk h={xs ? 19 : 23} w="55%" mb={6} r={6} />
      <Sk h={10} w="70%" />
    </div>
  )
}

export function SkDashboard({ xs, mobile }) {
  const pad = xs ? 12 : mobile ? 16 : 24
  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: pad, boxSizing: 'border-box' }}>
      {/* Hero */}
      <div style={{ background: `${C.brownDark}`, borderRadius: xs ? 16 : 20, padding: xs ? '18px 16px' : '24px 28px', marginBottom: xs ? 12 : 18 }}>
        <Sk w={120} h={11} mb={8} style={{ background: 'rgba(255,255,255,0.2)', backgroundSize: '400px 100%' }} />
        <Sk w="60%" h={xs ? 18 : 22} mb={12} style={{ background: 'rgba(255,255,255,0.25)', backgroundSize: '400px 100%' }} />
        <Sk w={90} h={22} r={20} style={{ background: 'rgba(255,255,255,0.15)', backgroundSize: '400px 100%' }} />
        <div style={{ marginTop: 18 }}>
          <Sk h={6} r={4} style={{ background: 'rgba(255,255,255,0.2)', backgroundSize: '400px 100%' }} />
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: xs || mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: xs ? 7 : 11, marginBottom: xs ? 12 : 18 }}>
        {[0,1,2,3].map(i => <SkStatCard key={i} xs={xs} />)}
      </div>

      {/* Content */}
      <div style={{ display: 'flex', gap: mobile ? 0 : 18, flexDirection: mobile ? 'column' : 'row', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SkCard style={{ marginBottom: 10 }} />
          <SkCard style={{ marginBottom: 10 }} />
          <SkCard />
        </div>
        {!mobile && (
          <div style={{ width: 240, flexShrink: 0 }}>
            <SkCard style={{ marginBottom: 14 }} />
            <SkCard />
          </div>
        )}
      </div>
    </div>
  )
}

export function SkList({ count = 4, gap = 10 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: count }).map((_, i) => <SkCard key={i} />)}
    </div>
  )
}

export function Spinner({ size = 36, color = C.brown }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `3px solid ${C.brownPale}`, borderTopColor: color,
      animation: 'spin 1s linear infinite', flexShrink: 0,
    }} />
  )
}
