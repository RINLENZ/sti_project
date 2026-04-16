import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts'

export default function BKTRadar({ competences }) {
  if (!competences || Object.keys(competences).length === 0) {
    return (
      <div style={{
        padding: 24, textAlign: 'center',
        color: 'var(--text-muted)', fontSize: 13
      }}>
        Fais des exercices pour voir ta progression par compétence
      </div>
    )
  }

  // Prépare les données pour le radar
  const data = Object.entries(competences).map(([comp, val]) => ({
    competence: comp.length > 30 ? comp.substring(0, 30) + '...' : comp,
    valeur: val.pourcentage,
    fullName: comp
  }))

  // Couleur selon niveau moyen
  const avgScore = data.reduce((a, b) => a + b.valeur, 0) / data.length
  const color = avgScore >= 70 ? '#16a34a' : avgScore >= 40 ? '#2563eb' : '#dc2626'

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data}>
          <PolarGrid stroke="#e2e8f0"/>
          <PolarAngleAxis
            dataKey="competence"
            tick={{ fontSize: 11, fill: '#64748b' }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            tickCount={4}
          />
          <Radar
            name="Maîtrise"
            dataKey="valeur"
            stroke={color}
            fill={color}
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Tooltip
            formatter={(value, name, props) => [
              `${value}%`,
              props.payload.fullName
            ]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid #e2e8f0'
            }}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Légende détaillée */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 8, marginTop: 8
      }}>
        {Object.entries(competences).map(([comp, val]) => (
          <div key={comp} style={{
            display: 'flex', alignItems: 'center',
            gap: 8, padding: '6px 10px',
            background: 'var(--color-background-secondary)',
            borderRadius: 6,
            borderLeft: `3px solid ${val.color}`
          }}>
            <div style={{ flex: 1 }}>
              <p style={{
                fontSize: 11, fontWeight: 500,
                color: 'var(--color-text-primary)',
                lineHeight: 1.3, marginBottom: 2
              }}>
                {comp}
              </p>
              <p style={{ fontSize: 11, color: val.color, fontWeight: 600 }}>
                {val.pourcentage}% — {val.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}