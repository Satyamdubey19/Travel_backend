import type { ReactNode } from "react"

export type HostTone = "cyan" | "emerald" | "amber" | "violet" | "rose" | "slate"

export interface HostPageProps {
  children: ReactNode
  title?: string
  eyebrow?: string
  description?: string
  actions?: ReactNode
}

export interface HostSectionProps extends HostPageProps {
  className?: string
}

export interface HostStatCardProps {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
  tone?: HostTone
}

export interface HostEmptyStateProps {
  icon?: ReactNode
  title: string
  description: string
}

export interface HostPillProps {
  children: ReactNode
  tone?: Exclude<HostTone, "violet">
}
