import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY = 'openvelope-draft'
const DEBOUNCE_MS = 2000

export interface DraftData {
  to: string
  subject: string
  body: string
  mode: 'new' | 'reply' | 'forward' | null
  savedAt: number
}

/**
 * Reads the saved draft from localStorage, returning null if none exists
 * or if the data is malformed.
 */
function readDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as DraftData
    // Basic shape validation
    if (typeof parsed.to !== 'string' || typeof parsed.subject !== 'string' || typeof parsed.body !== 'string') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/**
 * Writes draft data to localStorage.
 */
function writeDraft(data: DraftData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function hasDraftContent(to: string, subject: string, body: string): boolean {
  const textBody = body
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()

  return Boolean(to.trim() || subject.trim() || textBody)
}

/**
 * Removes the draft from localStorage.
 */
function removeDraft(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Silently ignore
  }
}

/**
 * Hook that provides draft auto-save functionality for the compose dialog.
 *
 * - Debounces saves by 2 seconds after the last edit.
 * - Persists to localStorage under the `openvelope-draft` key.
 * - On mount, checks for an existing draft and exposes it for restore.
 */
export function useDraftAutoSave(composeOpen: boolean, mode: 'new' | 'reply' | 'forward' | null) {
  const [hasDraft, setHasDraft] = useState(false)
  const [draftData, setDraftData] = useState<DraftData | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check for existing draft when compose opens
  useEffect(() => {
    if (composeOpen) {
      const existing = readDraft()
      if (existing) {
        setHasDraft(true)
        setDraftData(existing)
      } else {
        setHasDraft(false)
        setDraftData(null)
      }
    }
  }, [composeOpen])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  /**
   * Trigger a debounced save. Call this whenever to/subject/body changes.
   */
  const saveDraft = useCallback((to: string, subject: string, body: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      if (hasDraftContent(to, subject, body)) {
        writeDraft({
          to,
          subject,
          body,
          mode,
          savedAt: Date.now(),
        })
      }
    }, DEBOUNCE_MS)
  }, [mode])

  /**
   * Save immediately, bypassing debounce. Used when the compose dialog closes.
   */
  const saveDraftNow = useCallback((to: string, subject: string, body: string): boolean => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }

    if (!hasDraftContent(to, subject, body)) {
      return false
    }

    const nextDraft = {
      to,
      subject,
      body,
      mode,
      savedAt: Date.now(),
    }
    writeDraft(nextDraft)
    setHasDraft(true)
    setDraftData(nextDraft)
    return true
  }, [mode])

  /**
   * Immediately clear the saved draft (called on send success or explicit close).
   */
  const clearDraft = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    removeDraft()
    setHasDraft(false)
    setDraftData(null)
  }, [])

  /**
   * Returns the draft data for restoring form fields, then hides the banner.
   */
  const restoreDraft = useCallback((): DraftData | null => {
    const data = draftData
    setHasDraft(false)
    setDraftData(null)
    return data
  }, [draftData])

  return { hasDraft, draftData, saveDraft, saveDraftNow, clearDraft, restoreDraft }
}
