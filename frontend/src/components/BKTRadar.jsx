import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer, Tooltip
} from 'recharts'
import { useTheme } from '../styles/theme.jsx'

export default function BKTRadar({ competences }) {
  const { C } = useTheme()

  if (!competences || Object.keys(competences).length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: C.textMuted, fontSize: 13 }}>
        Fais des exercices pour voir ta progression par compétence
      </div>
    )
  }

  const data = Object.entries(competences).map(([comp, val]) => ({
    competence: comp.length > 30 ? comp.substring(0, 30) + '…' : comp,
    valeur:     val.pourcentage,
    fullName:   comp,
  }))

  const avgScore = data.reduce((a, b) => a + b.valeur, 0) / data.length
  const color = avgScore >= 70 ? C.emerald : avgScore >= 40 ? C.blue : C.red

  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data}>
          <PolarGrid stroke={C.border} />
          <PolarAngleAxis
            dataKey="competence"
            tick={{ fontSize: 11, fill: C.textSec }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: C.textMuted }}
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
            formatter={(value, name, props) => [`${value}%`, props.payload.fullName]}
            contentStyle={{
              fontSize: 12, borderRadius: 8,
              border: `1px solid ${C.border}`,
              background: C.surface,
              color: C.text,
            }}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Légende détaillée */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 8, marginTop: 8,
      }}>
        {Object.entries(competences).map(([comp, val]) => (
          <div key={comp} style={{
            display: 'flex', alignItems: 'center',
            gap: 8, padding: '6px 10px',
            background: C.brownGhost,
            borderRadius: 6,
            borderLeft: `3px solid ${val.color}`,
          }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 500, color: C.text, lineHeight: 1.3, marginBottom: 2 }}>
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
