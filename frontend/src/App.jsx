import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

import LandingPage   from './pages/LandingPage'
import Login         from './pages/auth/Login'
import Onboarding    from './pages/auth/Onboarding'
import Dashboard     from './pages/apprenant/Dashboard'
import CoursDetail   from './pages/apprenant/CoursDetail'
import Session       from './pages/apprenant/Session'
import DashboardProf from './pages/enseignant/DashboardProf'
import AdminCours    from './pages/enseignant/AdminCours'
import AppLayout     from './components/layout/AppLayout'
import Profil from './pages/apprenant/Profil'

function PrivateRoute({ children, role }) {
  const { user, token } = useSelector(s => s.auth)
  if (!token || !user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return children
}

function ApprenantRoute({ children }) {
  const { user, token } = useSelector(s => s.auth)
  if (!token || !user) return <Navigate to="/login" replace />
  if (!user.niveau) return <Navigate to="/onboarding" replace />
  return children
}

export default function App() {
  const { user, token } = useSelector(s => s.auth)

  return (
    <Routes>
      {/* Page publique */}
      <Route path="/"        element={token ? <Navigate to="/app" replace/> : <LandingPage />}/>
      <Route path="/login"   element={token ? <Navigate to="/app" replace/> : <Login />}/>

      {/* Onboarding */}
      <Route path="/onboarding" element={
        <PrivateRoute><Onboarding /></PrivateRoute>
      }/>

      {/* Redirection selon rôle */}
      <Route path="/app" element={
        <PrivateRoute>
          {user?.role === 'enseignant' || user?.role === 'super_admin'
            ? <Navigate to="/prof" replace />
            : <Navigate to="/dashboard" replace />}
        </PrivateRoute>
      }/>

      <Route path="/profil" element={
  <ApprenantRoute>
    <AppLayout><Profil /></AppLayout>
  </ApprenantRoute>
}/>

      {/* Routes apprenant avec sidebar */}
      <Route path="/dashboard" element={
        <ApprenantRoute>
          <AppLayout><Dashboard /></AppLayout>
        </ApprenantRoute>
      }/>
      <Route path="/cours/:uaId" element={
        <ApprenantRoute>
          <AppLayout><CoursDetail /></AppLayout>
        </ApprenantRoute>
      }/>
      <Route path="/session/:uaId" element={
        <ApprenantRoute><Session /></ApprenantRoute>
      }/>

      {/* Routes enseignant */}
      <Route path="/prof" element={
        <PrivateRoute role="enseignant">
          <AppLayout><DashboardProf /></AppLayout>
        </PrivateRoute>
      }/>
      <Route path="/admin" element={
  <PrivateRoute role="super_admin">
    <AppLayout><AdminCours /></AppLayout>
  </PrivateRoute>
}/>

      <Route path="*" element={<Navigate to="/" replace />}/>
    </Routes>
  )
}