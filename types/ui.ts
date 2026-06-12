import type { ButtonHTMLAttributes, ComponentProps, HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";
import type { Checkbox as CheckboxPrimitive } from "radix-ui";

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "error" | "success" | "warning" | "info";
  children: ReactNode;
}

export interface BackLinkProps {
  href: string;
  label: string;
  className?: string;
}

export interface CheckboxProps
  extends ComponentProps<typeof CheckboxPrimitive.Root> {
  label?: ReactNode;
}

export type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
};

export interface EmptyStateProps {
  icon?: ReactNode;
  emoji?: string;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
}

export interface FilterTabsProps<T extends string> {
  tabs: T[];
  active: T;
  onChange: (tab: T) => void;
  formatLabel?: (tab: T) => string;
  className?: string;
}

export interface FormLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export interface PhotoUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
}

export interface SectionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export interface SocialAuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  label: string;
}

export interface SpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
  fullPage?: boolean;
  minimal?: boolean;
}

export type StatCardColor = "blue" | "green" | "yellow" | "red" | "purple" | "orange" | "indigo";

export interface StatCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  color?: StatCardColor;
  href?: string;
  highlight?: boolean;
  change?: string;
  variant?: "admin" | "host";
}

export type StatusVariant = "success" | "warning" | "error" | "info" | "default";

export interface StatusBadgeProps {
  status: string;
  colorMap?: Record<string, StatusVariant>;
  className?: string;
}

export interface ToggleSwitchProps {
  enabled: boolean;
  onChange: () => void;
}
