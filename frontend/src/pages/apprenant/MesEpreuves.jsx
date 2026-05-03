import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../services/api'
import toast from 'react-hot-toast'
import { useTheme } from '../../styles/theme.jsx'
import { useBreakpoint } from '../../hooks/useBreakpoint'
import { Spinner } from '../../components/Skeleton'
import { FileText, Clock, Award, ChevronRight, CheckCircle } from 'lucide-react'

const TYPE_LABELS = {
  sequence: 'Épreuve de séquence',
  examen:   'Examen',
  devoir:   'Devoir surveillé',
  tp_note:  'TP noté',
}

export default function MesEpreuves() {
  const { C }    = useTheme()
  const navigate = useNavigate()
  const { mobile, xs } = useBreakpoint()
  const pad = xs ? 12 : mobile ? 16 : 28

  const [epreuves, setEpreuves] = useState([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    api.get('/api/examens/disponibles')
      .then(({ data }) => setEpreuves(data))
      .catch(() => toast.error('Impossible de charger les épreuves'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: pad, boxSizing: 'border-box', fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${C.brown}, ${C.brownLight})`, borderRadius: 20, padding: '22px 28px', marginBottom: 24, color: 'white', position: 'relative', overflow: 'hidden' }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06, pointerEvents: 'none' }}>
          <defs>
            <pattern id="adinkra-ep" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
              <rect x="10" y="10" width="30" height="30" fill="none" stroke="white" strokeWidth="1.5" rx="4"/>
              <line x1="10" y1="25" x2="40" y2="25" stroke="white" strokeWidth="1"/>
              <line x1="25" y1="10" x2="25" y2="40" stroke="white" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#adinkra-ep)"/>
        </svg>
        <div style={{ position: 'relative' }}>
          <p style={{ opacity: .7, fontSize: 12, fontWeight: 600, marginBottom: 3 }}>Espace apprenant</p>
          <h1 style={{ fontSize: mobile ? 20 : 24, fontWeight: 900, marginBottom: 4 }}>Mes épreuves</h1>
          <p style={{ opacity: .75, fontSize: 13 }}>
            {epreuves.length} épreuve{epreuves.length !== 1 ? 's' : ''} disponible{epreuves.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner/></div>
      ) : epreuves.length === 0 ? (
        <div style={{ background: C.surface, borderRadius: 20, padding: 56, textAlign: 'center', border: `1.5px solid ${C.brownPale}` }}>
          <p style={{ fontSize: 48, marginBottom: 12 }}>📄</p>
          <p style={{ fontSize: 16, fontWeight: 800, color: C.text, marginBottom: 8 }}>Aucune épreuve disponible</p>
          <p style={{ fontSize: 13, color: C.textSec }}>Ton enseignant n'a pas encore publié d'épreuve pour ton niveau.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {epreuves.map(ep => (
            <div
              key={ep.id}
              onClick={() => navigate(`/epreuve/${ep.id}`)}
              style={{
                background: C.surface, borderRadius: 16, padding: '20px 22px',
                border: `1.5px solid ${ep.soumis ? `${C.emerald}40` : C.brownPale}`,
                cursor: 'pointer', transition: 'all .2s',
                boxShadow: '0 2px 10px rgba(107,58,42,0.07)',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 4px 20px ${C.brown}20`; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 10px rgba(107,58,42,0.07)'; e.currentTarget.style.transform = 'none' }}
            >
              {/* Badge statut */}
              {ep.soumis && (
                <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', alignItems: 'center', gap: 5, background: `${C.emerald}18`, padding: '3px 10px', borderRadius: 20 }}>
                  <CheckCircle size={12} color={C.emerald}/>
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.emerald }}>Soumis</span>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: ep.soumis ? `${C.emerald}18` : `${C.brown}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={20} color={ep.soumis ? C.emerald : C.brown}/>
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text, paddingRight: ep.soumis ? 80 : 0 }}>{ep.titre}</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: C.textSec }}>
                    {TYPE_LABELS[ep.type_epreuve] || ep.type_epreuve}
                    {ep.classe_label && ` · ${ep.classe_label}`}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.textSec }}>
                  <Clock size={13} color={C.textSec}/>{ep.duree_minutes} min
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.textSec }}>
                  <Award size={13} color={C.textSec}/>Coeff. {ep.coefficient}
                </span>
                {ep.soumis && ep.score_total !== null && (
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.emerald, marginLeft: 'auto' }}>
                    {ep.score_total.toFixed(1)}/20
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: ep.soumis ? C.textSec : C.brown, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {ep.soumis ? 'Voir les résultats' : 'Passer l\'épreuve'}
                  <ChevronRight size={14}/>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
