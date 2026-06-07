import { Toaster as Sonner } from "sonner"
import type { ToasterProps } from "sonner"

export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group toast group-[.toaster]:bg-[var(--color-surface-elevated)] group-[.toaster]:text-[var(--color-text-primary)] group-[.toaster]:border-[var(--color-border)] group-[.toaster]:shadow-[var(--shadow-md)]",
          description: "group-[.toast]:text-[var(--color-text-secondary)]",
          actionButton: "group-[.toast]:bg-[var(--color-accent)] group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-[var(--color-surface)] group-[.toast]:text-[var(--color-text-secondary)]",
        },
      }}
      {...props}
    />
  )
}
