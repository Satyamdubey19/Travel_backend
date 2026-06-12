export type AuthMailType = "signup" | "login" | "reset";

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
