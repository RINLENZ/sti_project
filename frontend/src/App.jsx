import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

import Login         from './pages/auth/Login'
import Onboarding    from './pages/auth/Onboarding'
import Dashboard     from './pages/apprenant/Dashboard'
import CoursDetail   from './pages/apprenant/CoursDetail'
import Session       from './pages/apprenant/Session'
import DashboardProf from './pages/enseignant/DashboardProf'
import AdminCours    from './pages/enseignant/AdminCours'
import AppLayout     from './components/layout/AppLayout'

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
  const { user } = useSelector(s => s.auth)

  return (
    <Routes>
      <Route path="/login"      element={<Login />} />
      <Route path="/onboarding" element={<PrivateRoute><Onboarding /></PrivateRoute>}/>

      <Route path="/" element={
        <PrivateRoute>
          {user?.role === 'enseignant' || user?.role === 'super_admin'
            ? <Navigate to="/prof" replace />
            : <Navigate to="/dashboard" replace />}
        </PrivateRoute>
      }/>

      {/* Routes avec sidebar */}
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
      <Route path="/prof" element={
        <PrivateRoute role="enseignant">
          <AppLayout><DashboardProf /></AppLayout>
        </PrivateRoute>
      }/>
      <Route path="/admin" element={
        <PrivateRoute>
          <AppLayout><AdminCours /></AppLayout>
        </PrivateRoute>
      }/>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}