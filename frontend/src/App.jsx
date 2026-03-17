// App.jsx - Root with routing and auth guard

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage   from './pages/AuthPage'
import Dashboard  from './pages/Dashboard'
import Spinner    from './components/Spinner'

// Protected route wrapper
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-mesh flex items-center justify-center"><Spinner size="lg" /></div>
  return user ? children : <Navigate to="/login" replace />
}

// Public route — redirect to dashboard if already logged in
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return <div className="min-h-screen bg-mesh flex items-center justify-center"><Spinner size="lg" /></div>
  return !user ? children : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="noise-overlay" />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={
            <PublicRoute><AuthPage mode="login" /></PublicRoute>
          } />
          <Route path="/register" element={
            <PublicRoute><AuthPage mode="register" /></PublicRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
