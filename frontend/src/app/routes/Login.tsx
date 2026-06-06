import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../../services/auth'
import { useAuthStore } from '../../stores/authStore'

/** Login timeout in milliseconds */
const LOGIN_TIMEOUT_MS = 30_000

/**
 * Login route — centered form with entrance animation,
 * error shake, loading state, and 30s timeout.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export default function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const accessToken = useAuthStore((s) => s.accessToken)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [exiting, setExiting] = useState(false)

  const abortRef = useRef<AbortController | null>(null)

  // If already authenticated, redirect to mailbox
  useEffect(() => {
    if (accessToken) {
      navigate('/mailbox', { replace: true })
    }
  }, [accessToken, navigate])

  // Trigger entrance animation on mount
  useEffect(() => {
    // Use rAF to allow initial CSS state to apply before transitioning
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return

    setError(null)
    setShake(false)
    setLoading(true)

    // Create abort controller for timeout
    const controller = new AbortController()
    abortRef.current = controller

    const timeout = setTimeout(() => {
      controller.abort()
    }, LOGIN_TIMEOUT_MS)

    try {
      const response = await login(email, password)

      clearTimeout(timeout)

      // Store auth
      setAuth(response.access_token, response.email)

      // Exit animation before navigating
      setExiting(true)
      setTimeout(() => {
        navigate('/mailbox', { replace: true })
      }, 200)
    } catch (err) {
      clearTimeout(timeout)

      let message: string
      if (controller.signal.aborted) {
        message = 'Server is unreachable. Please try again later.'
      } else {
        message =
          err instanceof Error && err.message
            ? err.message
            : 'Invalid email or password'
      }

      setError(message)
      setShake(true)
      setLoading(false)

      // Remove shake after animation completes
      setTimeout(() => setShake(false), 300)
    }
  }

  // Clear error when user modifies input
  function handleInputChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value)
      if (error) setError(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-bg to-surface">
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface-elevated p-8 shadow-md"
        style={{
          opacity: exiting ? 0 : mounted ? 1 : 0,
          transform: exiting
            ? 'translateY(0)'
            : mounted
              ? 'translateY(0)'
              : 'translateY(8px)',
          transition: exiting
            ? 'opacity 200ms ease-out'
            : 'opacity 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 350ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <h1 className="mb-6 text-center text-2xl font-bold text-text-primary">
          Webmail
        </h1>

        <form
          onSubmit={handleSubmit}
          noValidate
          style={{
            transform: shake ? undefined : 'translateX(0)',
            animation: shake ? 'shake 300ms ease-out' : undefined,
          }}
        >
          <div className="mb-4">
            <label
              htmlFor="login-email"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={handleInputChange(setEmail)}
              required
              autoFocus
              autoComplete="email"
              disabled={loading}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
            />
          </div>

          <div className="mb-4">
            <label
              htmlFor="login-password"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={handleInputChange(setPassword)}
              required
              autoComplete="current-password"
              disabled={loading}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-text-primary placeholder:text-text-secondary focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-[transform,background-color] duration-[150ms] ease-out hover:bg-accent-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {error && (
            <p
              role="alert"
              className="mt-4 text-center text-sm text-error"
            >
              {error}
            </p>
          )}
        </form>
      </div>

      {/* Shake keyframe — injected once */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}
