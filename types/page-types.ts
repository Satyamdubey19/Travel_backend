export type SettingsTab = "profile" | "bookings" | "account" | "preferences" | "notifications" | "privacy" | "danger"
export type ProfileSidebarTab = SettingsTab
export type UserProfile = Record<string, unknown>
export type NotificationSettings = Record<string, boolean>
export type PrivacySettings = Record<string, boolean>
