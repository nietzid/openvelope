import { useState, useEffect, useRef, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../services/auth";
import { useAuthStore } from "../../stores/authStore";
import splashImage from "../../assets/login_splash.jpg";

/** Login timeout in milliseconds */
const LOGIN_TIMEOUT_MS = 30_000;

/**
 * Login route — two-panel "Efficient Professional" layout with a brand
 * showcase panel, entrance/exit animation, error shake, loading state,
 * and a 30s timeout.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
export default function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [exiting, setExiting] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // If already authenticated, redirect to mailbox
  useEffect(() => {
    if (accessToken) {
      navigate("/mailbox", { replace: true });
    }
  }, [accessToken, navigate]);

  // Trigger entrance animation on mount
  useEffect(() => {
    // Use rAF to allow initial CSS state to apply before transitioning
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Clean up abort controller on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setShake(false);
    setLoading(true);

    // Create abort controller for timeout
    const controller = new AbortController();
    abortRef.current = controller;

    const timeout = setTimeout(() => {
      controller.abort();
    }, LOGIN_TIMEOUT_MS);

    try {
      const response = await login(email, password);

      clearTimeout(timeout);

      // Store auth
      setAuth(response.access_token, response.email);

      // Exit animation before navigating
      setExiting(true);
      setTimeout(() => {
        navigate("/mailbox", { replace: true });
      }, 200);
    } catch (err) {
      clearTimeout(timeout);

      let message: string;
      if (controller.signal.aborted) {
        message = "Server is unreachable. Please try again later.";
      } else {
        message =
          err instanceof Error && err.message
            ? err.message
            : "Invalid email or password";
      }

      setError(message);
      setShake(true);
      setLoading(false);

      // Remove shake after animation completes
      setTimeout(() => setShake(false), 300);
    }
  }

  // Clear error when user modifies input
  function handleInputChange(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      if (error) setError(null);
    };
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Brand / showcase panel */}
      <div className="relative hidden items-center justify-center overflow-hidden bg-[#eef1fb] p-10 lg:flex lg:w-1/2">
        {/* Faint oversized "W" watermark peeking from behind the image */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex select-none items-center justify-center text-[34rem] font-bold leading-none text-[#e0e5f5]"
        >
          W
        </span>

        <div className="relative aspect-[3/4] w-full max-w-xl overflow-hidden rounded-lg shadow-[0_8px_24px_rgba(40,48,68,0.12)]">
          {/* Splash artwork */}
          <img
            src={splashImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Subtle scrim to keep overlay copy legible */}
          <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-white/55 to-transparent" />
          {/* Overlay copy — sits on a fixed light image, so colors are literal */}
          <div className="absolute inset-0 flex flex-col justify-end p-8">
            <h2 className="mt-2 text-3xl font-semibold leading-tight text-[#283044]">
              Streamlined workflows.
              <br />
              Zero friction.
            </h2>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex w-full flex-col bg-surface-elevated lg:w-1/2">
        {/* Centered form */}
        <div className="flex flex-1 items-center justify-center px-6 py-8 md:px-10">
          <div
            className="w-full max-w-[400px]"
            style={{
              opacity: exiting ? 0 : mounted ? 1 : 0,
              transform: exiting
                ? "translateY(0)"
                : mounted
                  ? "translateY(0)"
                  : "translateY(8px)",
              transition: exiting
                ? "opacity 200ms ease-out"
                : "opacity 350ms cubic-bezier(0.16, 1, 0.3, 1), transform 350ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <h1 className="text-3xl font-semibold tracking-[-0.02em] text-text-primary">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Sign in to your Openvelope account.
            </p>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="mt-8"
              style={{
                transform: shake ? undefined : "translateX(0)",
                animation: shake ? "shake 300ms ease-out" : undefined,
              }}
            >
              <div className="mb-4">
                <label
                  htmlFor="login-email"
                  className="mb-1.5 block text-xs font-medium text-text-primary"
                >
                  Email address
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
                  placeholder="name@company.com"
                  className="w-full rounded border border-transparent bg-surface px-3 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/60 focus:border-accent focus:bg-surface-elevated focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
                />
              </div>

              <div className="mb-6">
                <div className="mb-1.5 flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-text-primary"
                  >
                    Password
                  </label>
                  <a
                    href="#"
                    className="text-xs font-medium text-accent hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={handleInputChange(setPassword)}
                  required
                  autoComplete="current-password"
                  disabled={loading}
                  placeholder="••••••••"
                  className="w-full rounded border border-transparent bg-surface px-3 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-secondary/60 focus:border-accent focus:bg-surface-elevated focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded bg-accent py-2.5 text-sm font-semibold text-white transition-[transform,background-color] duration-[150ms] ease-out hover:bg-accent-hover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  "Signing in…"
                ) : (
                  <>
                    Sign In
                    <svg
                      viewBox="0 0 24 24"
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path
                        d="M5 12h14M13 6l6 6-6 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </>
                )}
              </button>

              {error && (
                <p role="alert" className="mt-4 text-center text-sm text-error">
                  {error}
                </p>
              )}

              <p className="mt-6 text-center text-sm text-text-secondary">
                Don't have an account?{" "}
                <a href="#" className="font-medium text-accent hover:underline">
                  Request access
                </a>
              </p>
            </form>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-4 border-t border-border px-6 py-5 md:px-10">
          <p className="text-xs text-text-secondary">© 2026 Openvelope.</p>
          <div className="flex gap-4 text-xs font-medium text-text-primary">
            <a href="#" className="hover:underline">
              Privacy Policy
            </a>
            <a href="#" className="hover:underline">
              Terms of Service
            </a>
          </div>
        </footer>
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
  );
}
