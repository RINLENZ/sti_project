import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { useEffect } from 'react'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

import LandingPage          from './pages/LandingPage'
import Login                from './pages/auth/Login'
import Register             from './pages/auth/Register'
import Onboarding           from './pages/auth/Onboarding'
import OnboardingEnseignant from './pages/auth/OnboardingEnseignant'

import Dashboard      from './pages/apprenant/Dashboard'
import CoursDetail    from './pages/apprenant/CoursDetail'
import Session        from './pages/apprenant/Session'
import Profil         from './pages/apprenant/Profil'
import MesEpreuves    from './pages/apprenant/MesEpreuves'
import EpreuveSession from './pages/apprenant/EpreuveSession'

import DashboardProf      from './pages/enseignant/DashboardProf'
import AdminCours         from './pages/enseignant/AdminCours'
import AdminReferentiel   from './pages/enseignant/AdminReferentiel'
import ProfilEnseignant   from './pages/enseignant/ProfilEnseignant'
import AdminExamen        from './pages/enseignant/AdminExamen'
import Corrections        from './pages/enseignant/Corrections'
import DataCollection   from './pages/DataCollection'
import AudioCollection  from './pages/AudioCollection'
import Contribuer       from './pages/Contribuer'

import AppLayout from './components/layout/AppLayout'

// ── Garde générique : authentifié + rôle optionnel ────────────────
function PrivateRoute({ children, role }) {
  const { user, token } = useSelector(s => s.auth)
  if (!token || !user) return <Navigate to="/login" replace/>
  if (role && user.role !== role) return <Navigate to="/app" replace/>
  return children
}

// ── Garde apprenant : authentifié + onboarding complété ───────────
function ApprenantRoute({ children }) {
  const { user, token } = useSelector(s => s.auth)
  if (!token || !user) return <Navigate to="/login" replace/>
  // Redirige vers l'onboarding seulement les apprenants sans niveau
  if (user.role === 'apprenant' && !user.niveau_label)
    return <Navigate to="/onboarding" replace/>
  return children
}

// ── Garde enseignant : authentifié + onboarding enseignant ────────
function EnseignantRoute({ children }) {
  const { user, token } = useSelector(s => s.auth)
  if (!token || !user) return <Navigate to="/login" replace/>
  if (user.role !== 'enseignant' && user.role !== 'super_admin')
    return <Navigate to="/app" replace/>
  // Vérifie onboarding via localStorage + champ retourné par l'API
  const onboardingDone = 
    localStorage.getItem(`onboarding_done_${user.id}`) ||
    user.matieres?.length > 0 ||  // si l'API retourne les matières
    user.code_classe                // ou le code classe
  if (user.role === 'enseignant' && !onboardingDone)
    return <Navigate to="/onboarding-enseignant" replace/>
  return children
}

export default function App() {
  const { user, token } = useSelector(s => s.auth)

  return (
    <>
    <ScrollToTop />
    <Routes>

      {/* ── Pages publiques ── */}
      <Route path="/"        element={token ? <Navigate to="/app" replace/> : <LandingPage/>}/>
      <Route path="/login"   element={token ? <Navigate to="/app" replace/> : <Login/>}/>
      <Route path="/register"element={token ? <Navigate to="/app" replace/> : <Register/>}/>

      {/* ── Onboardings ── */}
      <Route path="/onboarding" element={
        <PrivateRoute><Onboarding/></PrivateRoute>
      }/>
      <Route path="/onboarding-enseignant" element={
        <PrivateRoute role="enseignant"><OnboardingEnseignant/></PrivateRoute>
      }/>

      {/* ── Redirection intelligente selon rôle ── */}
      <Route path="/app" element={
        <PrivateRoute>
          {user?.role === 'super_admin'
            ? <Navigate to="/admin"     replace/>
            : user?.role === 'enseignant'
            ? <Navigate to="/prof"      replace/>
            : <Navigate to="/dashboard" replace/>}
        </PrivateRoute>
      }/>

      {/* ── Profil : apprenant ou enseignant selon le rôle ── */}
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
        <ApprenantRoute>
          <AppLayout><Dashboard/></AppLayout>
        </ApprenantRoute>
      }/>
      <Route path="/cours/:uaId" element={
        <ApprenantRoute>
          <AppLayout><CoursDetail/></AppLayout>
        </ApprenantRoute>
      }/>
      <Route path="/session/:uaId" element={
        <ApprenantRoute><Session/></ApprenantRoute>
      }/>
      <Route path="/epreuves" element={
        <ApprenantRoute>
          <AppLayout><MesEpreuves/></AppLayout>
        </ApprenantRoute>
      }/>
      <Route path="/epreuve/:epreuveId" element={
        <ApprenantRoute><EpreuveSession/></ApprenantRoute>
      }/>

      {/* ── Routes enseignant ── */}
      <Route path="/prof" element={
        <EnseignantRoute>
          <AppLayout><DashboardProf/></AppLayout>
        </EnseignantRoute>
      }/>
      <Route path="/prof/examens" element={
        <EnseignantRoute>
          <AppLayout><AdminExamen/></AppLayout>
        </EnseignantRoute>
      }/>

      {/* ── Routes super admin ── */}
      <Route path="/admin" element={
        <PrivateRoute role="super_admin">
          <AppLayout><AdminCours/></AppLayout>
        </PrivateRoute>
      }/>
      <Route path="/admin/referentiel" element={
        <PrivateRoute role="super_admin">
          <AppLayout><AdminReferentiel/></AppLayout>
        </PrivateRoute>
      }/>

      <Route path="/corrections" element={
        <EnseignantRoute>
          <AppLayout><Corrections/></AppLayout>
        </EnseignantRoute>
      }/>

      {/* ── Contribution données ML (tous les utilisateurs) ── */}
      <Route path="/contribuer" element={
        <PrivateRoute>
          <AppLayout><Contribuer/></AppLayout>
        </PrivateRoute>
      }/>
      <Route path="/collect-emotions" element={
        <PrivateRoute>
          <DataCollection/>
        </PrivateRoute>
      }/>
      <Route path="/collect-audio" element={
        <PrivateRoute>
          <AudioCollection/>
        </PrivateRoute>
      }/>

      {/* ── Fallback ── */}
      <Route path="*" element={<Navigate to="/" replace/>}/>

    </Routes>
    </>
  )
}