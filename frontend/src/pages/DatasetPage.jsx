import { useEffect, useState } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import { useTheme } from '../styles/theme.jsx'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { Spinner } from '../components/Skeleton'
import { Database, Download, CheckSquare, Square, Image, BarChart2, FileText, RefreshCw } from 'lucide-react'

export default function DatasetPage() {
  const { C }           = useTheme()
  const { mobile, xs }  = useBreakpoint()
  const pad             = xs ? 12 : mobile ? 16 : 28

  const [stats,        setStats]        = useState(null)
  const [copies,       setCopies]       = useState([])
  const [loading,      setLoading]      = useState(true)
  const [exporting,    setExporting]    = useState(false)
  const [lightboxUrl,  setLightboxUrl]  = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [statsRes, copiesRes] = await Promise.all([
        api.get('/api/examens/dataset/stats'),
        api.get('/api/examens/dataset/copies'),
      ])
      setStats(statsRes.data)
      setCopies(copiesRes.data)
    } catch {
      toast.error('Erreur de chargement du dataset')
    } finally {
      setLoading(false)
    }
  }

  async function exportDataset() {
    setExporting(true)
    try {
      const { data } = await api.get('/api/examens/dataset/export', { responseType: 'blob' })
      const url = URL.createObjectURL(data)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `dataset_copies_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success('Dataset exporté !')
    } catch {
      toast.error("Échec de l'export")
    } finally {
      setExporting(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <Spinner/>
    </div>
  )

  const validated  = copies.filter(c => c.dataset_valide)
  const withVision = copies.filter(c => c.has_vision)
  const withTeacher = copies.filter(c => c.has_teacher_correction)

  return (
    <div style={{ background: C.bg, minHeight: '100vh', padding: pad, fontFamily: "'DM Sans', system-ui, sans-serif", boxSizing: 'border-box' }}>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 24 }}
        >
          <img src={lightboxUrl} alt="Copie agrandie" style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: 12, boxShadow: '0 0 40px rgba(0,0,0,.6)' }} onClick={e => e.stopPropagation()}/>
          <button onClick={() => setLightboxUrl(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'white', border: 'none', borderRadius: '50%', width: 36, height: 36, cursor: 'pointer', fontSize: 18, fontWeight: 900 }}>✕</button>
        </div>
      )}

      {/* En-tête */}
      <div style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)', borderRadius: xs ? 14 : 20, padding: xs ? '16px 14px' : '24px 28px', marginBottom: xs ? 16 : 24, color: 'white', animation: 'fadeUp .35s ease both' }}>
        <p style={{ opacity: .7, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Administration</p>
        <h1 style={{ fontSize: xs ? 18 : 22, fontWeight: 900, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Database size={22}/> Dataset d'entraînement
        </h1>
        <p style={{ opacity: .75, fontSize: xs ? 11 : 13 }}>
          Copies papier collectées et validées pour l'entraînement d'un modèle de correction
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: xs ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10, marginBottom: 24 }}>
        {[
          { label: 'Total copies papier', value: copies.length, color: '#7C3AED', icon: FileText },
          { label: 'Validées pour training', value: validated.length, color: '#059669', icon: CheckSquare },
          { label: 'Analysées par IA',     value: withVision.length, color: '#2563EB', icon: Database },
          { label: 'Corrigées manuellement', value: withTeacher.length, color: C.orange, icon: BarChart2 },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{ background: C.surface, borderRadius: 12, padding: '14px 16px', border: `1px solid ${C.brownPale}`, textAlign: 'center', animation: 'fadeUp .35s ease both' }}>
            <Icon size={18} color={color} style={{ marginBottom: 6 }}/>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color }}>{value}</p>
            <p style={{ margin: 0, fontSize: 10, color: C.textSec, fontWeight: 700, lineHeight: 1.3 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Barre de progression */}
      {copies.length > 0 && (
        <div style={{ background: C.surface, borderRadius: 14, padding: '16px 20px', marginBottom: 24, border: `1px solid ${C.brownPale}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800, color: C.text }}>Progression de la validation</p>
            <span style={{ fontSize: 12, fontWeight: 900, color: '#7C3AED' }}>
              {validated.length}/{copies.length} ({stats?.pct_valide ?? 0}%)
            </span>
          </div>
          <div style={{ height: 8, background: C.brownPale, borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${stats?.pct_valide ?? 0}%`, background: 'linear-gradient(90deg, #7C3AED, #5B21B6)', borderRadius: 8, transition: 'width .5s' }}/>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: C.textSec }}>
            Pour un dataset de qualité, visez au moins 50 copies validées avec correction enseignant.
          </p>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 24, flexWrap: 'wrap' }}>
        <button
          onClick={exportDataset}
          disabled={exporting || validated.length === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: validated.length > 0 ? 'linear-gradient(135deg, #7C3AED, #5B21B6)' : C.brownPale, color: validated.length > 0 ? 'white' : C.textSec, border: 'none', borderRadius: 10, cursor: validated.length > 0 ? 'pointer' : 'default', fontSize: 13, fontWeight: 700, boxShadow: validated.length > 0 ? '0 4px 16px rgba(124,58,237,.3)' : 'none' }}
        >
          {exporting ? <Spinner/> : <Download size={15}/>}
          {exporting ? 'Export en cours…' : `Exporter le dataset (${validated.length} copies validées)`}
        </button>
        <button
          onClick={loadData}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: C.surface, border: `1px solid ${C.brownPale}`, borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: C.textSec }}
        >
          <RefreshCw size={14}/> Actualiser
        </button>
      </div>

      {/* Guide fine-tuning */}
      <div style={{ background: `${C.brown}08`, borderRadius: 14, padding: '16px 20px', marginBottom: 24, border: `1px solid ${C.brownPale}` }}>
        <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 800, color: C.brown }}>📚 Pipeline d'entraînement</p>
        <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.textSec, lineHeight: 2 }}>
          <li>L'élève upload une photo de sa copie manuscrite → Claude Vision lit et corrige automatiquement</li>
          <li>L'enseignant valide / ajuste la correction dans la page "Mes Épreuves"</li>
          <li>L'enseignant clique sur "Dataset ✓" pour marquer la copie comme validée</li>
          <li>Le super admin exporte le dataset JSON (image_url + corrections validées)</li>
          <li>Fine-tuning : chaque entrée contient l'image, les corrections IA et les corrections enseignant</li>
          <li>Le modèle entraîné améliore ses prochaines lectures de copies</li>
        </ol>
      </div>

      {/* Liste des copies */}
      <div style={{ background: C.surface, borderRadius: 16, border: `1px solid ${C.brownPale}`, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.brownPale}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.text }}>
            Toutes les copies papier ({copies.length})
          </h2>
        </div>

        {copies.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px' }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>📭</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Aucune copie papier</p>
            <p style={{ fontSize: 12, color: C.textSec, marginTop: 4 }}>
              Les copies papier apparaîtront ici quand les apprenants les soumettront.
            </p>
          </div>
        ) : (
          <div>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: xs ? '1fr 1fr' : '2fr 2fr 60px 80px 80px 80px', gap: 8, padding: '10px 20px', background: C.bg, fontSize: 10, fontWeight: 800, color: C.textSec, textTransform: 'uppercase', letterSpacing: .5 }}>
              {!xs && <span>Apprenant</span>}
              {!xs && <span>Épreuve</span>}
              {!xs && <span>Score</span>}
              {!xs && <span>Vision IA</span>}
              {!xs && <span>Enseignant</span>}
              {!xs && <span>Dataset</span>}
              {xs && <span>Copie</span>}
              {xs && <span>Statut</span>}
            </div>

            {copies.map((copie, i) => (
              <div
                key={copie.id}
                style={{ display: 'grid', gridTemplateColumns: xs ? '1fr 1fr' : '2fr 2fr 60px 80px 80px 80px', gap: 8, padding: '12px 20px', borderTop: `1px solid ${C.brownPale}`, alignItems: 'center', background: copie.dataset_valide ? `${C.emerald}05` : 'transparent' }}
              >
                {/* Apprenant + photo miniature */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {copie.image_copie_url && (
                    <button
                      onClick={() => setLightboxUrl(copie.image_copie_url)}
                      style={{ border: '2px solid #C4B5FD', borderRadius: 6, overflow: 'hidden', cursor: 'pointer', flexShrink: 0, background: 'none', padding: 0 }}
                      title="Voir la copie"
                    >
                      <img src={copie.image_copie_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover', display: 'block' }}/>
                    </button>
                  )}
                  <div>
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: C.text }}>{copie.apprenant_nom}</p>
                    <p style={{ margin: 0, fontSize: 10, color: C.textSec }}>
                      {copie.submitted_at ? new Date(copie.submitted_at).toLocaleDateString('fr-FR') : '—'}
                    </p>
                  </div>
                </div>

                {/* Épreuve */}
                <p style={{ margin: 0, fontSize: 11, color: C.textSec, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{copie.epreuve_titre}</p>

                {/* Score */}
                {!xs && (
                  <span style={{ fontSize: 13, fontWeight: 900, color: copie.score_total !== null ? (copie.score_total >= 10 ? C.emerald : '#EF4444') : C.textSec }}>
                    {copie.score_total !== null ? `${copie.score_total}/20` : '—'}
                  </span>
                )}

                {/* Vision IA */}
                {!xs && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: copie.has_vision ? '#2563EB' : C.textSec }}>
                    {copie.has_vision ? '✓ Oui' : '✗ Non'}
                  </span>
                )}

                {/* Correction enseignant */}
                {!xs && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: copie.has_teacher_correction ? C.emerald : C.textSec }}>
                    {copie.has_teacher_correction ? '✓ Oui' : '✗ Non'}
                  </span>
                )}

                {/* Dataset validé */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {copie.dataset_valide
                    ? <CheckSquare size={15} color={C.emerald}/>
                    : <Square size={15} color={C.textSec}/>
                  }
                  <span style={{ fontSize: 11, fontWeight: 700, color: copie.dataset_valide ? C.emerald : C.textSec }}>
                    {copie.dataset_valide ? 'Validée' : 'En attente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
      `}</style>
    </div>
  )
}
