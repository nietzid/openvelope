import { useEffect, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '../primitives/Button'
import { getSmtpSettings, updateSmtpSettings } from '../../services/settings'
import type { SmtpSettingsResponse, SmtpSettingsRequest } from '../../types'

const AUTH_OPTIONS = [
  { value: 'plain', label: 'PLAIN' },
  { value: 'login', label: 'LOGIN' },
  { value: 'none', label: 'None (no auth)' },
]

export default function SmtpSettings() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [enabled, setEnabled] = useState(false)
  const [host, setHost] = useState('')
  const [port, setPort] = useState(587)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authMethod, setAuthMethod] = useState('plain')

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data: SmtpSettingsResponse = await getSmtpSettings()
      setEnabled(data.enabled)
      setHost(data.relay_host)
      setPort(data.relay_port || 587)
      setUsername(data.relay_username)
      setPassword(data.relay_password)
      setAuthMethod(data.relay_auth || 'plain')
    } catch {
      setError('Failed to load SMTP settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const req: SmtpSettingsRequest = {
        relay_host: host.trim(),
        relay_port: port,
        relay_username: username.trim(),
        relay_password: password,
        relay_auth: authMethod,
        enabled,
      }
      await updateSmtpSettings(req)
      toast.success('SMTP relay settings saved')
    } catch {
      toast.error('Failed to save SMTP settings')
    } finally {
      setSaving(false)
    }
  }, [host, port, username, password, authMethod, enabled])

  if (loading) {
    return (
      <div className="p-[var(--space-6)] space-y-[var(--space-4)]">
        <div className="h-6 w-48 rounded bg-[var(--color-surface)] animate-pulse" />
        <div className="space-y-[var(--space-3)]">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded bg-[var(--color-surface)] animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-[var(--space-6)] flex flex-col items-center justify-center gap-[var(--space-4)] min-h-[200px]">
        <p className="text-sm text-[var(--color-error)]">{error}</p>
        <Button variant="secondary" size="sm" onClick={fetchSettings}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="p-[var(--space-6)]">
      {/* Header */}
      <div className="mb-[var(--space-6)]">
        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">SMTP Relay</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
          Configure a custom SMTP relay server for outgoing mail
        </p>
      </div>

      <div className="space-y-[var(--space-5)] max-w-lg">
        {/* Enable toggle */}
        <label className="flex items-center gap-[var(--space-3)] cursor-pointer min-h-[44px]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
          />
          <span className="text-sm font-medium text-[var(--color-text-primary)]">
            Enable SMTP relay
          </span>
        </label>

        {/* Host */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label
            htmlFor="smtp-host"
            className="text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Host
          </label>
          <input
            id="smtp-host"
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="smtp.example.com"
            disabled={!enabled}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Port */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label
            htmlFor="smtp-port"
            className="text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Port
          </label>
          <input
            id="smtp-port"
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            placeholder="587"
            disabled={!enabled}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Username */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label
            htmlFor="smtp-username"
            className="text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Username
          </label>
          <input
            id="smtp-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="user@example.com"
            disabled={!enabled}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Password */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label
            htmlFor="smtp-password"
            className="text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Password
          </label>
          <input
            id="smtp-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            disabled={!enabled}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Auth method */}
        <div className="flex flex-col gap-[var(--space-1)]">
          <label
            htmlFor="smtp-auth"
            className="text-sm font-medium text-[var(--color-text-secondary)]"
          >
            Authentication method
          </label>
          <select
            id="smtp-auth"
            value={authMethod}
            onChange={(e) => setAuthMethod(e.target.value)}
            disabled={!enabled}
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-sm text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {AUTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Save button */}
        <div className="pt-[var(--space-2)]">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            loading={saving}
          >
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  )
}
