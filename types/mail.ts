export type AuthMailType = "signup" | "login" | "reset" | "email_change" | "email_change_notice";

export interface AuthMailInput {
  to: string;
  name?: string | null;
  type: AuthMailType;
  actionUrl?: string;
}

export type AuthMailContent = {
  subject: string;
  preview: string;
  greeting: string;
  heading: string;
  body: string;
  note: string;
  ctaLabel: string;
  text: string;
};
