import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

import Login         from './pages/auth/Login'
import Onboarding    from './pages/auth/Onboarding'
import Dashboard     from './pages/apprenant/Dashboard'
import CoursDetail   from './pages/apprenant/CoursDetail'
import Session       from './pages/apprenant/Session'
import DashboardProf from './pages/enseignant/DashboardProf'

// Route protégée — redirige vers /login si non connecté
function PrivateRoute({ children, role }) {
  const { user, token } = useSelector(s => s.auth)
  if (!token || !user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return children
}

// Route apprenant — redirige vers onboarding si niveau non choisi
function ApprenantRoute({ children }) {
  const { user, token } = useSelector(s => s.auth)
  if (!token || !user) return <Navigate to="/login" replace />
  if (!user.niveau) return <Navigate to="/onboarding" replace />
  return children
}

export default function App() {
  const { user } = useSelector(s => s.auth)

  return (
    <Routes>
      {/* Pages publiques */}
      <Route path="/login" element={<Login />} />

      {/* Onboarding — connecté mais niveau pas encore choisi */}
      <Route path="/onboarding" element={
        <PrivateRoute><Onboarding /></PrivateRoute>
      }/>

      {/* Redirection racine selon le rôle */}
      <Route path="/" element={
        <PrivateRoute>
          {user?.role === 'enseignant'
            ? <Navigate to="/prof" replace />
            : <Navigate to="/dashboard" replace />}
        </PrivateRoute>
      }/>

      {/* Routes apprenant */}
      <Route path="/dashboard" element={
        <ApprenantRoute><Dashboard /></ApprenantRoute>
      }/>
      <Route path="/cours/:uaId" element={
        <ApprenantRoute><CoursDetail /></ApprenantRoute>
      }/>
      <Route path="/session/:uaId" element={
        <ApprenantRoute><Session /></ApprenantRoute>
      }/>

      {/* Routes enseignant */}
      <Route path="/prof" element={
        <PrivateRoute role="enseignant"><DashboardProf /></PrivateRoute>
      }/>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}