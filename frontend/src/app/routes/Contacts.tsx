import { useState, useEffect, useCallback } from 'react'
import { Button } from '../../components/primitives/Button'
import { Dialog } from '../../components/primitives/Dialog'
import { Skeleton } from '../../components/primitives/Skeleton'
import {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
} from '../../services/contacts'
import type { Contact, ContactGroup } from '../../types'
import { staggerDelay } from '../../lib/motion'
import { useReducedMotion } from '../../hooks/useReducedMotion'

const emptyForm: Partial<Contact> = {
  display_name: '',
  first_name: '',
  last_name: '',
  email_addr: '',
  phone: '',
  company: '',
  notes: '',
}

type Tab = 'contacts' | 'groups'

export default function Contacts() {
  const [activeTab, setActiveTab] = useState<Tab>('contacts')
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Contact>>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Groups state
  const [groups, setGroups] = useState<ContactGroup[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)
  const [groupsError, setGroupsError] = useState<string | null>(null)
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [groupName, setGroupName] = useState('')
  const [groupMemberIds, setGroupMemberIds] = useState<number[]>([])
  const [groupSaving, setGroupSaving] = useState(false)
  const [groupFormError, setGroupFormError] = useState<string | null>(null)
  const [deleteGroupId, setDeleteGroupId] = useState<number | null>(null)
  const [deletingGroup, setDeletingGroup] = useState(false)

  const reducedMotion = useReducedMotion()

  // Fetch contacts
  const fetchContacts = useCallback(async (q?: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await listContacts({ q: q || undefined })
      setContacts(data.contacts ?? data)
    } catch {
      setError('Failed to load contacts. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch groups
  const fetchGroups = useCallback(async () => {
    setGroupsLoading(true)
    setGroupsError(null)
    try {
      const data = await listGroups()
      setGroups(data)
    } catch {
      setGroupsError('Failed to load groups. Please try again.')
    } finally {
      setGroupsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContacts()
    fetchGroups()
  }, [fetchContacts, fetchGroups])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchContacts(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, fetchContacts])

  // Open add dialog
  const handleAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
    setDialogOpen(true)
  }

  // Open edit dialog
  const handleEdit = (contact: Contact) => {
    setEditingId(contact.id)
    setForm({
      display_name: contact.display_name,
      first_name: contact.first_name,
      last_name: contact.last_name,
      email_addr: contact.email_addr,
      phone: contact.phone,
      company: contact.company,
      notes: contact.notes,
    })
    setFormError(null)
    setDialogOpen(true)
  }

  // Save contact (create or update)
  const handleSave = async () => {
    if (!form.display_name?.trim()) {
      setFormError('Display name is required')
      return
    }
    if (!form.email_addr?.trim()) {
      setFormError('Email address is required')
      return
    }

    setSaving(true)
    setFormError(null)
    try {
      if (editingId !== null) {
        await updateContact(editingId, form)
      } else {
        await createContact(form)
      }
      setDialogOpen(false)
      fetchContacts(search)
    } catch {
      setFormError('Failed to save contact. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Delete contact
  const handleDelete = async () => {
    if (deleteId === null) return
    setDeleting(true)
    try {
      await deleteContact(deleteId)
      setDeleteId(null)
      fetchContacts(search)
    } catch {
      // keep dialog open on error
    } finally {
      setDeleting(false)
    }
  }

  // Form field change helper
  const updateField = (field: keyof Contact, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // --- Group handlers ---
  const handleAddGroup = () => {
    setEditingGroupId(null)
    setGroupName('')
    setGroupMemberIds([])
    setGroupFormError(null)
    setGroupDialogOpen(true)
  }

  const handleEditGroup = (group: ContactGroup) => {
    setEditingGroupId(group.id)
    setGroupName(group.name)
    setGroupMemberIds(group.members?.map((m) => m.id) ?? [])
    setGroupFormError(null)
    setGroupDialogOpen(true)
  }

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      setGroupFormError('Group name is required')
      return
    }

    setGroupSaving(true)
    setGroupFormError(null)
    try {
      if (editingGroupId !== null) {
        await updateGroup(editingGroupId, { name: groupName, member_ids: groupMemberIds })
      } else {
        await createGroup(groupName, groupMemberIds)
      }
      setGroupDialogOpen(false)
      fetchGroups()
    } catch {
      setGroupFormError('Failed to save group. Please try again.')
    } finally {
      setGroupSaving(false)
    }
  }

  const handleDeleteGroup = async () => {
    if (deleteGroupId === null) return
    setDeletingGroup(true)
    try {
      await deleteGroup(deleteGroupId)
      setDeleteGroupId(null)
      fetchGroups()
    } catch {
      // keep dialog open on error
    } finally {
      setDeletingGroup(false)
    }
  }

  const toggleMember = (contactId: number) => {
    setGroupMemberIds((prev) =>
      prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]
    )
  }

  return (
    <div className="flex h-full flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">
          Contacts
        </h1>
        {activeTab === 'contacts' ? (
          <Button variant="primary" size="sm" onClick={handleAdd}>
            Add Contact
          </Button>
        ) : (
          <Button variant="primary" size="sm" onClick={handleAddGroup}>
            Add Group
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] px-6">
        <button
          type="button"
          onClick={() => setActiveTab('contacts')}
          className={[
            'px-4 py-2.5 text-sm font-medium transition-[color,border-color] duration-[150ms] ease-out',
            'border-b-2 -mb-px',
            activeTab === 'contacts'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
          ].join(' ')}
        >
          Contacts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('groups')}
          className={[
            'px-4 py-2.5 text-sm font-medium transition-[color,border-color] duration-[150ms] ease-out',
            'border-b-2 -mb-px',
            activeTab === 'groups'
              ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
              : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
          ].join(' ')}
        >
          Groups
        </button>
      </div>

      {activeTab === 'contacts' ? (
        <>
          {/* Search bar */}
          <div className="px-6 py-3">
            <input
              type="text"
              placeholder="Search contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={[
                'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
                'bg-[var(--color-surface)] px-4 py-2.5 text-sm',
                'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]',
                'transition-[border-color] duration-[150ms] ease-out',
                'focus:border-[var(--color-accent)] focus:outline-none',
              ].join(' ')}
            />
          </div>

          {/* Contacts Content */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {loading ? (
              <div className="space-y-3 pt-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                    <Skeleton className="h-5 flex-1" />
                    <Skeleton className="h-5 flex-1" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{error}</p>
                <Button variant="secondary" size="sm" onClick={() => fetchContacts(search)}>
                  Retry
                </Button>
              </div>
            ) : contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <svg
                  className="mb-4 h-12 w-12 text-[var(--color-text-secondary)] opacity-40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <p className="text-sm text-[var(--color-text-secondary)]">No contacts yet</p>
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                    <th className="pb-3 pt-2 font-medium">Display Name</th>
                    <th className="pb-3 pt-2 font-medium">Email</th>
                    <th className="pb-3 pt-2 font-medium">Phone</th>
                    <th className="pb-3 pt-2 font-medium">Company</th>
                    <th className="pb-3 pt-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact, index) => {
                    const delay = reducedMotion ? 0 : staggerDelay(index, 20)
                    return (
                      <tr
                        key={contact.id}
                        className="border-b border-[var(--color-border)] transition-[background-color] duration-[150ms] ease-out hover:bg-[var(--color-surface-elevated)]"
                        style={
                          reducedMotion
                            ? undefined
                            : {
                                opacity: 0,
                                animation: `contact-row-in 200ms cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards`,
                              }
                        }
                      >
                        <td className="py-3 pr-4 font-medium text-[var(--color-text-primary)]">
                          {contact.display_name || '—'}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {contact.email_addr || '—'}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {contact.phone || '—'}
                        </td>
                        <td className="py-3 pr-4 text-[var(--color-text-secondary)]">
                          {contact.company || '—'}
                        </td>
                        <td className="py-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(contact)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-[background-color] duration-[150ms] ease-out hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                              aria-label={`Edit ${contact.display_name}`}
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteId(contact.id)}
                              className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-[background-color,color] duration-[150ms] ease-out hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                              aria-label={`Delete ${contact.display_name}`}
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        /* Groups Tab Content */
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {groupsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-24" />
                </div>
              ))}
            </div>
          ) : groupsError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="mb-4 text-sm text-[var(--color-text-secondary)]">{groupsError}</p>
              <Button variant="secondary" size="sm" onClick={fetchGroups}>
                Retry
              </Button>
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <svg
                className="mb-4 h-12 w-12 text-[var(--color-text-secondary)] opacity-40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <p className="text-sm text-[var(--color-text-secondary)]">No groups yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group, index) => {
                const delay = reducedMotion ? 0 : staggerDelay(index, 20)
                return (
                  <div
                    key={group.id}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-[background-color] duration-[150ms] ease-out hover:bg-[var(--color-surface-elevated)]"
                    style={
                      reducedMotion
                        ? undefined
                        : {
                            opacity: 0,
                            animation: `contact-row-in 200ms cubic-bezier(0.16,1,0.3,1) ${delay}ms forwards`,
                          }
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[var(--color-text-primary)]">{group.name}</p>
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {group.members?.length ?? 0} {(group.members?.length ?? 0) === 1 ? 'member' : 'members'}
                        </p>
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditGroup(group)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-[background-color] duration-[150ms] ease-out hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                        aria-label={`Edit ${group.name}`}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteGroupId(group.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] transition-[background-color,color] duration-[150ms] ease-out hover:bg-red-500/10 hover:text-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2"
                        aria-label={`Delete ${group.name}`}
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Contact Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingId !== null ? 'Edit Contact' : 'Add Contact'}
      >
        <div className="space-y-4">
          {formError && (
            <p className="rounded-[var(--radius-md)] bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {formError}
            </p>
          )}

          <div>
            <label htmlFor="contact-display-name" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              id="contact-display-name"
              type="text"
              value={form.display_name ?? ''}
              onChange={(e) => updateField('display_name', e.target.value)}
              className={[
                'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
                'bg-[var(--color-surface)] px-3 py-2.5 text-sm',
                'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]',
                'transition-[border-color] duration-[150ms] ease-out',
                'focus:border-[var(--color-accent)] focus:outline-none',
              ].join(' ')}
              placeholder="John Doe"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="contact-first-name" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                First Name
              </label>
              <input
                id="contact-first-name"
                type="text"
                value={form.first_name ?? ''}
                onChange={(e) => updateField('first_name', e.target.value)}
                className={[
                  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
                  'bg-[var(--color-surface)] px-3 py-2.5 text-sm',
                  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]',
                  'transition-[border-color] duration-[150ms] ease-out',
                  'focus:border-[var(--color-accent)] focus:outline-none',
                ].join(' ')}
                placeholder="John"
              />
            </div>
            <div>
              <label htmlFor="contact-last-name" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                Last Name
              </label>
              <input
                id="contact-last-name"
                type="text"
                value={form.last_name ?? ''}
                onChange={(e) => updateField('last_name', e.target.value)}
                className={[
                  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
                  'bg-[var(--color-surface)] px-3 py-2.5 text-sm',
                  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]',
                  'transition-[border-color] duration-[150ms] ease-out',
                  'focus:border-[var(--color-accent)] focus:outline-none',
                ].join(' ')}
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label htmlFor="contact-email" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              id="contact-email"
              type="email"
              value={form.email_addr ?? ''}
              onChange={(e) => updateField('email_addr', e.target.value)}
              className={[
                'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
                'bg-[var(--color-surface)] px-3 py-2.5 text-sm',
                'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]',
                'transition-[border-color] duration-[150ms] ease-out',
                'focus:border-[var(--color-accent)] focus:outline-none',
              ].join(' ')}
              placeholder="john@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="contact-phone" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                Phone
              </label>
              <input
                id="contact-phone"
                type="tel"
                value={form.phone ?? ''}
                onChange={(e) => updateField('phone', e.target.value)}
                className={[
                  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
                  'bg-[var(--color-surface)] px-3 py-2.5 text-sm',
                  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]',
                  'transition-[border-color] duration-[150ms] ease-out',
                  'focus:border-[var(--color-accent)] focus:outline-none',
                ].join(' ')}
                placeholder="+1 (555) 123-4567"
              />
            </div>
            <div>
              <label htmlFor="contact-company" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
                Company
              </label>
              <input
                id="contact-company"
                type="text"
                value={form.company ?? ''}
                onChange={(e) => updateField('company', e.target.value)}
                className={[
                  'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
                  'bg-[var(--color-surface)] px-3 py-2.5 text-sm',
                  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]',
                  'transition-[border-color] duration-[150ms] ease-out',
                  'focus:border-[var(--color-accent)] focus:outline-none',
                ].join(' ')}
                placeholder="Acme Inc."
              />
            </div>
          </div>

          <div>
            <label htmlFor="contact-notes" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Notes
            </label>
            <textarea
              id="contact-notes"
              value={form.notes ?? ''}
              onChange={(e) => updateField('notes', e.target.value)}
              rows={3}
              className={[
                'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
                'bg-[var(--color-surface)] px-3 py-2.5 text-sm',
                'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]',
                'transition-[border-color] duration-[150ms] ease-out',
                'focus:border-[var(--color-accent)] focus:outline-none resize-none',
              ].join(' ')}
              placeholder="Any notes about this contact..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
              {editingId !== null ? 'Save Changes' : 'Add Contact'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Contact Confirmation Dialog */}
      <Dialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Delete Contact"
      >
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          Are you sure you want to delete this contact? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={deleting}
            onClick={handleDelete}
            className="bg-red-500 hover:bg-red-600"
          >
            Delete
          </Button>
        </div>
      </Dialog>

      {/* Add/Edit Group Dialog */}
      <Dialog
        open={groupDialogOpen}
        onClose={() => setGroupDialogOpen(false)}
        title={editingGroupId !== null ? 'Edit Group' : 'Create Group'}
      >
        <div className="space-y-4">
          {groupFormError && (
            <p className="rounded-[var(--radius-md)] bg-red-500/10 px-3 py-2 text-sm text-red-500">
              {groupFormError}
            </p>
          )}

          <div>
            <label htmlFor="group-name" className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Group Name <span className="text-red-500">*</span>
            </label>
            <input
              id="group-name"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className={[
                'w-full rounded-[var(--radius-md)] border border-[var(--color-border)]',
                'bg-[var(--color-surface)] px-3 py-2.5 text-sm',
                'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-secondary)]',
                'transition-[border-color] duration-[150ms] ease-out',
                'focus:border-[var(--color-accent)] focus:outline-none',
              ].join(' ')}
              placeholder="e.g. Work Team"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-[var(--color-text-primary)]">
              Members
            </label>
            {contacts.length === 0 ? (
              <p className="text-sm text-[var(--color-text-secondary)]">
                No contacts available. Add contacts first.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                {contacts.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 transition-[background-color] duration-[150ms] ease-out hover:bg-[var(--color-surface-elevated)]"
                  >
                    <input
                      type="checkbox"
                      checked={groupMemberIds.includes(contact.id)}
                      onChange={() => toggleMember(contact.id)}
                      className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                    />
                    <span className="text-sm text-[var(--color-text-primary)]">
                      {contact.display_name}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {contact.email_addr}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {groupMemberIds.length > 0 && (
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {groupMemberIds.length} {groupMemberIds.length === 1 ? 'member' : 'members'} selected
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setGroupDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={groupSaving} onClick={handleSaveGroup}>
              {editingGroupId !== null ? 'Save Changes' : 'Create Group'}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Delete Group Confirmation Dialog */}
      <Dialog
        open={deleteGroupId !== null}
        onClose={() => setDeleteGroupId(null)}
        title="Delete Group"
      >
        <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
          Are you sure you want to delete this group? The contacts in the group will not be deleted.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleteGroupId(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={deletingGroup}
            onClick={handleDeleteGroup}
            className="bg-red-500 hover:bg-red-600"
          >
            Delete
          </Button>
        </div>
      </Dialog>

      {/* Row entrance animation */}
      <style>{`
        @keyframes contact-row-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
