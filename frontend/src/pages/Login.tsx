import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../services/auth'
import { useAuthStore } from '../stores/authStore'

function Login() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return

    setError(null)
    setLoading(true)

    try {
      const response = await login(email, password)
      setAuth(response.access_token, response.email)
      navigate('/mailbox', { replace: true })
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : 'Invalid email or password'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Brand / showcase panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-10">
        <div className="relative w-full max-w-xl aspect-[3/4] overflow-hidden rounded-lg">
          {/* Decorative gradient mimicking flowing fibers */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(135deg, #e6ebf2 0%, #c7d2dd 35%, #8fa3b3 60%, #4d6675 100%)',
            }}
          />
          <div
            className="absolute inset-0 opacity-70 mix-blend-screen"
            style={{
              background:
                'radial-gradient(120% 80% at 70% 40%, rgba(56,189,248,0.55) 0%, rgba(56,189,248,0) 45%), radial-gradient(90% 60% at 30% 70%, rgba(37,99,235,0.45) 0%, rgba(37,99,235,0) 50%)',
            }}
          />
          {/* Overlay copy */}
          <div className="absolute inset-0 flex flex-col justify-end p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.05em] text-primary-strong/90">
              Corporate Modernism
            </p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight text-inverse-surface">
              Streamlined workflows.
              <br />
              Zero friction.
            </h2>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col bg-white lg:w-1/2">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-primary-strong text-on-primary">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M4 6h16M4 12l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="text-base font-semibold text-on-surface">Webmail</span>
          </div>
          <button
            type="button"
            aria-label="Help"
            className="text-on-surface-variant transition-colors hover:text-on-surface"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <path d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.7.3-1.1.9-1.1 1.7v.3" strokeLinecap="round" />
              <circle cx="11.8" cy="16.5" r="0.6" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </header>

        {/* Centered form */}
        <div className="flex flex-1 items-center justify-center px-6 py-8 md:px-10">
          <div className="w-full max-w-[400px]">
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-on-surface">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-on-surface-variant">
              Sign in to your Webmail account.
            </p>

            <form onSubmit={handleSubmit} noValidate className="mt-8">
              <div className="mb-4">
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-medium text-on-surface"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  autoComplete="email"
                  placeholder="name@company.com"
                  className="w-full rounded bg-surface-container-low px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary-strong/40 focus:ring-offset-0 border border-transparent focus:border-primary-strong"
                />
              </div>

              <div className="mb-6">
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="block text-xs font-medium text-on-surface">
                    Password
                  </label>
                  <a
                    href="#"
                    className="text-xs font-medium text-primary-strong hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full rounded bg-surface-container-low px-3 py-2.5 text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none transition focus:bg-white focus:ring-2 focus:ring-primary-strong/40 focus:ring-offset-0 border border-transparent focus:border-primary-strong"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded bg-primary-strong py-2.5 text-sm font-semibold text-on-primary transition-colors hover:bg-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  'Signing in...'
                ) : (
                  <>
                    Sign In
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>

              {error && (
                <p role="alert" className="mt-4 text-center text-sm text-error">
                  {error}
                </p>
              )}

              <p className="mt-6 text-center text-sm text-on-surface-variant">
                Don't have an account?{' '}
                <a href="#" className="font-medium text-primary-strong hover:underline">
                  Request access
                </a>
              </p>
            </form>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-4 border-t border-outline-variant px-6 py-5 md:px-10">
          <p className="text-xs text-on-surface-variant">
            © 2024 Webmail Systems. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs font-medium text-on-surface">
            <a href="#" className="hover:underline">
              Privacy Policy
            </a>
            <a href="#" className="hover:underline">
              Terms of Service
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default Login
