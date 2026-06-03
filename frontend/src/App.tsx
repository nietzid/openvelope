import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Mailbox from './pages/Mailbox'
import { ProtectedRoute } from './components/ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  )
}

export default App
