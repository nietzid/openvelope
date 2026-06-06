import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const Login = lazy(() => import('./routes/Login'))
const Mailbox = lazy(() => import('./routes/Mailbox'))

/** Route guard — redirects to /login if no auth token */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((s) => s.accessToken)
  if (!accessToken) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

/** Minimal loading fallback shown while route chunks load */
function RouteFallback() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-bg">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-accent" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<Navigate to="/mailbox" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/mailbox"
            element={
              <ProtectedRoute>
                <Mailbox />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
