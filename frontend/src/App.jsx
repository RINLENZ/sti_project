import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useEffect, Suspense, lazy } from 'react'
import { useTheme } from './styles/theme.jsx'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

// ── Imports paresseux — chaque page = chunk séparé ───────────────
const LandingPage          = lazy(() => import('./pages/LandingPage'))
const Login                = lazy(() => import('./pages/auth/Login'))
const Register             = lazy(() => import('./pages/auth/Register'))
const ForgotPassword       = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword        = lazy(() => import('./pages/auth/ResetPassword'))
const Onboarding           = lazy(() => import('./pages/auth/Onboarding'))
const OnboardingEnseignant = lazy(() => import('./pages/auth/OnboardingEnseignant'))

const Dashboard      = lazy(() => import('./pages/apprenant/Dashboard'))
const CoursDetail    = lazy(() => import('./pages/apprenant/CoursDetail'))
const Session        = lazy(() => import('./pages/apprenant/Session'))
const Profil         = lazy(() => import('./pages/apprenant/Profil'))
const MesEpreuves    = lazy(() => import('./pages/apprenant/MesEpreuves'))
const EpreuveSession = lazy(() => import('./pages/apprenant/EpreuveSession'))

const DashboardProf    = lazy(() => import('./pages/enseignant/DashboardProf'))
const AdminCours         = lazy(() => import('./pages/enseignant/AdminCours'))
const AdminReferentiel   = lazy(() => import('./pages/enseignant/AdminReferentiel'))
const AdminUtilisateurs  = lazy(() => import('./pages/enseignant/AdminUtilisateurs'))
const ProfilEnseignant = lazy(() => import('./pages/enseignant/ProfilEnseignant'))
const AdminExamen      = lazy(() => import('./pages/enseignant/AdminExamen'))
const Corrections      = lazy(() => import('./pages/enseignant/Corrections'))
const CreerCoursLive   = lazy(() => import('./pages/enseignant/CreerCoursLive'))
const CoursLivePilot   = lazy(() => import('./pages/enseignant/CoursLive'))

const SalleAttente    = lazy(() => import('./pages/apprenant/SalleAttente'))
const EleveLive       = lazy(() => import('./pages/apprenant/EleveLive'))
const TutorielAlisha  = lazy(() => import('./pages/apprenant/TutorielAlisha'))
const ProgressionMap  = lazy(() => import('./pages/apprenant/ProgressionMap'))
const DataCollection   = lazy(() => import('./pages/DataCollection'))
const AudioCollection  = lazy(() => import('./pages/AudioCollection'))
const Contribuer       = lazy(() => import('./pages/Contribuer'))
const DatasetPage      = lazy(() => import('./pages/DatasetPage'))
const TrainingPage     = lazy(() => import('./pages/TrainingPage'))
const Chat             = lazy(() => import('./pages/Chat'))
const AlishaDemo       = lazy(() => import('./pages/dev/AlishaDemo'))

const AppLayout = lazy(() => import('./components/layout/AppLayout'))

// ── Écran de chargement léger ─────────────────────────────────────
function PageLoader() {
  const { C } = useTheme()
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: C.bg, gap: 14,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        border: `3px solid ${C.border}`,
        borderTopColor: C.brown,
        animation: 'spin 0.8s linear infinite',
      }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>Chargement…</p>
    </div>
  )
}

// ── Gardes ────────────────────────────────────────────────────────
function PrivateRoute({ children, role }) {
  const { user, token } = useSelector(s => s.auth)
  if (!token || !user) return <Navigate to="/login" replace/>
  if (role && user.role !== role) return <Navigate to="/app" replace/>
  return children
}

function ApprenantRoute({ children }) {
  const { user, token } = useSelector(s => s.auth)
  if (!token || !user) return <Navigate to="/login" replace/>
  if (user.role === 'apprenant' && !user.niveau_label)
    return <Navigate to="/onboarding" replace/>
  return children
}

function EnseignantRoute({ children }) {
  const { user, token } = useSelector(s => s.auth)
  if (!token || !user) return <Navigate to="/login" replace/>
  if (user.role !== 'enseignant' && user.role !== 'super_admin')
    return <Navigate to="/app" replace/>
  const onboardingDone =
    localStorage.getItem(`onboarding_done_${user.id}`) ||
    user.matieres_enseignees?.length > 0 ||
    user.code_classe
  if (user.role === 'enseignant' && !onboardingDone)
    return <Navigate to="/onboarding-enseignant" replace/>
  return children
}

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const { user, token } = useSelector(s => s.auth)

  return (
    <Suspense fallback={<PageLoader/>}>
      <ScrollToTop/>
      <Routes>

        {/* ── Pages publiques ── */}
        <Route path="/dev/alisha" element={<AlishaDemo/>}/>
        <Route path="/"         element={token ? <Navigate to="/app" replace/> : <LandingPage/>}/>
        <Route path="/login"            element={token ? <Navigate to="/app" replace/> : <Login/>}/>
        <Route path="/register"         element={token ? <Navigate to="/app" replace/> : <Register/>}/>
        <Route path="/forgot-password"  element={<ForgotPassword/>}/>
        <Route path="/reset-password"   element={<ResetPassword/>}/>

        {/* ── Onboardings ── */}
        <Route path="/onboarding" element={
          <PrivateRoute><Onboarding/></PrivateRoute>
        }/>
        <Route path="/onboarding-enseignant" element={
          <PrivateRoute role="enseignant"><OnboardingEnseignant/></PrivateRoute>
        }/>

        {/* ── Redirection selon rôle ── */}
        <Route path="/app" element={
          <PrivateRoute>
            {user?.role === 'super_admin'
              ? <Navigate to="/admin"     replace/>
              : user?.role === 'enseignant'
              ? <Navigate to="/prof"      replace/>
              : <Navigate to="/dashboard" replace/>}
          </PrivateRoute>
        }/>

        {/* ── Profil ── */}
        <Route path="/profil" element={
          <PrivateRoute>
            <AppLayout>
              {user?.role === 'enseignant' || user?.role === 'super_admin'
                ? <ProfilEnseignant/>
                : <Profil/>}
            </AppLayout>
          </PrivateRoute>
        }/>

        {/* ── Routes apprenant ── */}
        <Route path="/dashboard" element={
          <ApprenantRoute><AppLayout><Dashboard/></AppLayout></ApprenantRoute>
        }/>
        <Route path="/cours/:uaId" element={
          <ApprenantRoute><AppLayout><CoursDetail/></AppLayout></ApprenantRoute>
        }/>
        <Route path="/session/:uaId" element={
          <ApprenantRoute><Session/></ApprenantRoute>
        }/>
        <Route path="/epreuves" element={
          <ApprenantRoute><AppLayout><MesEpreuves/></AppLayout></ApprenantRoute>
        }/>
        <Route path="/epreuve/:epreuveId" element={
          <ApprenantRoute><EpreuveSession/></ApprenantRoute>
        }/>

        {/* ── Routes enseignant ── */}
        <Route path="/prof" element={
          <EnseignantRoute><AppLayout><DashboardProf/></AppLayout></EnseignantRoute>
        }/>
        <Route path="/prof/examens" element={
          <EnseignantRoute><AppLayout><AdminExamen/></AppLayout></EnseignantRoute>
        }/>
        <Route path="/live/creer" element={
          <EnseignantRoute><CreerCoursLive/></EnseignantRoute>
        }/>
        <Route path="/live/pilot/:sessionId" element={
          <EnseignantRoute><CoursLivePilot/></EnseignantRoute>
        }/>

        {/* ── Routes live apprenant ── */}
        <Route path="/live/rejoindre" element={
          <ApprenantRoute><SalleAttente/></ApprenantRoute>
        }/>
        <Route path="/live/session/:sessionId" element={
          <PrivateRoute><EleveLive/></PrivateRoute>
        }/>
        <Route path="/tutoriel/:uaId" element={
          <ApprenantRoute><TutorielAlisha/></ApprenantRoute>
        }/>
        <Route path="/progression" element={
          <ApprenantRoute><ProgressionMap/></ApprenantRoute>
        }/>

        {/* ── Routes super admin ── */}
        <Route path="/admin" element={
          <PrivateRoute role="super_admin"><AppLayout><AdminCours/></AppLayout></PrivateRoute>
        }/>
        <Route path="/admin/referentiel" element={
          <PrivateRoute role="super_admin"><AppLayout><AdminReferentiel/></AppLayout></PrivateRoute>
        }/>
        <Route path="/admin/utilisateurs" element={
          <PrivateRoute role="super_admin"><AppLayout><AdminUtilisateurs/></AppLayout></PrivateRoute>
        }/>
        <Route path="/admin/dataset" element={
          <PrivateRoute role="super_admin"><AppLayout><DatasetPage/></AppLayout></PrivateRoute>
        }/>
        <Route path="/admin/training" element={
          <PrivateRoute role="super_admin"><AppLayout><TrainingPage/></AppLayout></PrivateRoute>
        }/>

        {/* ── Autres ── */}
        <Route path="/corrections" element={
          <EnseignantRoute><AppLayout><Corrections/></AppLayout></EnseignantRoute>
        }/>
        <Route path="/chat" element={
          <PrivateRoute><AppLayout><Chat/></AppLayout></PrivateRoute>
        }/>
        <Route path="/contribuer" element={
          <PrivateRoute><AppLayout><Contribuer/></AppLayout></PrivateRoute>
        }/>
        <Route path="/collect-emotions" element={
          <PrivateRoute><DataCollection/></PrivateRoute>
        }/>
        <Route path="/collect-audio" element={
          <PrivateRoute><AudioCollection/></PrivateRoute>
        }/>

        <Route path="*" element={<Navigate to="/" replace/>}/>
      </Routes>
    </Suspense>
  )
}
