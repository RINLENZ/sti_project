import { Routes, Route, Navigate } from 'react-router-dom'
import { useSelector } from 'react-redux'

import Login        from './pages/auth/Login'
import Dashboard    from './pages/apprenant/Dashboard'
import CoursDetail  from './pages/apprenant/CoursDetail'
import Session      from './pages/apprenant/Session'
import DashboardProf from './pages/enseignant/DashboardProf'

// Protège les routes — redirige vers /login si non connecté
function PrivateRoute({ children, role }) {
  const { user, token } = useSelector(s => s.auth)
  if (!token || !user) return <Navigate to="/login" replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return children
}

export default function App() {
  const { user } = useSelector(s => s.auth)

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Routes apprenant */}
      <Route path="/" element={
        <PrivateRoute>
          {user?.role === 'enseignant'
            ? <Navigate to="/prof" replace />
            : <Navigate to="/dashboard" replace />}
        </PrivateRoute>
      }/>

      <Route path="/dashboard" element={
        <PrivateRoute role="apprenant"><Dashboard /></PrivateRoute>
      }/>
      <Route path="/cours/:uaId" element={
        <PrivateRoute role="apprenant"><CoursDetail /></PrivateRoute>
      }/>
      <Route path="/session/:uaId" element={
        <PrivateRoute role="apprenant"><Session /></PrivateRoute>
      }/>

      {/* Route enseignant */}
      <Route path="/prof" element={
        <PrivateRoute role="enseignant"><DashboardProf /></PrivateRoute>
      }/>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}