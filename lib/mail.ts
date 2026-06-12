import { resend } from "@/lib/resend";
import type { AuthMailContent, AuthMailInput } from "@/types/mail";

const appName = "GetHotels";
const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const fromEmail =
  process.env.RESEND_FROM_EMAIL ??
  process.env.EMAIL_FROM ??
  "GetHotels <onboarding@resend.dev>";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAuthMailContent({ name, type, actionUrl }: AuthMailInput): AuthMailContent {
  const safeName = escapeHtml(name?.trim() || "there");
  const plainName = name?.trim() || "there";

  if (type === "signup") {
    return {
      subject: `Welcome to ${appName}`,
      preview: "Your GetHotels account is ready. Start planning your next stay.",
      greeting: `Hello ${safeName},`,
      heading: "Welcome to GetHotels",
      body: "Your account has been created successfully. You can now discover curated stays, tours, activities, rentals, and save your favorites in one place.",
      note: "We are glad to have you here. Your next trip now has a calmer place to begin.",
      ctaLabel: "Verify and explore",
      text: `Hello ${plainName}, your GetHotels account is ready. Verify and explore: ${actionUrl ?? appUrl}`,
    };
  }

  if (type === "reset") {
    return {
      subject: "Reset your GetHotels password",
      preview: "Use this secure link to reset your GetHotels password.",
      greeting: `Hello ${safeName},`,
      heading: "Reset your password",
      body: "We received a request to reset the password for your GetHotels account. Use the secure button below to choose a new password.",
      note: "If this was not you, you can safely ignore this email. Your password will not change unless you use the link.",
      ctaLabel: "Reset password",
      text: `Hello ${plainName}, reset your GetHotels password here: ${actionUrl ?? appUrl}`,
    };
  }

  return {
    subject: "New login to your GetHotels account",
    preview: "A new login was detected on your GetHotels account.",
    greeting: `Hello ${safeName},`,
    heading: "New login detected",
    body: "Your GetHotels account was just signed in. If this was you, everything is fine and no action is needed.",
    note: "If you do not recognize this activity, reset your password right away and review your account details.",
    ctaLabel: "Open account",
    text: `Hello ${plainName}, your GetHotels account was just signed in. Open your account: ${actionUrl ?? appUrl}`,
  };
}

function buildAuthEmailHtml(content: AuthMailContent, actionUrl?: string) {
  const safeAppUrl = escapeHtml(appUrl);
  const safeActionUrl = actionUrl ? escapeHtml(actionUrl) : safeAppUrl;

  return `
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0">
      ${content.preview}
    </div>
    <div style="margin:0;background:#f4f7fb;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto">
        <tr>
          <td style="padding:0 0 18px;text-align:center">
            <div style="display:inline-block;height:48px;width:48px;border-radius:16px;background:#0f172a;color:#ffffff;font-size:18px;font-weight:800;line-height:48px;text-align:center;box-shadow:0 18px 35px rgba(15,23,42,0.18)">
              GH
            </div>
            <div style="margin-top:10px;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#64748b">
              ${appName}
            </div>
          </td>
        </tr>
        <tr>
          <td style="overflow:hidden;border:1px solid #dbe3ef;border-radius:24px;background:#ffffff;box-shadow:0 24px 70px rgba(15,23,42,0.08)">
            <div style="background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 58%,#38bdf8 100%);padding:34px 32px;color:#ffffff">
              <div style="display:inline-block;border-radius:999px;background:rgba(255,255,255,0.16);padding:7px 12px;font-size:12px;font-weight:700">
                Secure GetHotels update
              </div>
              <h1 style="margin:18px 0 0;font-size:32px;line-height:1.15;font-weight:800;letter-spacing:-0.02em">
                ${content.heading}
              </h1>
            </div>

            <div style="padding:32px">
              <p style="margin:0 0 14px;font-size:18px;line-height:1.6;font-weight:700;color:#0f172a">
                ${content.greeting}
              </p>
              <p style="margin:0;font-size:16px;line-height:1.7;color:#475569">
                ${content.body}
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:26px 0">
                <tr>
                  <td style="border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;padding:18px">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="font-size:13px;font-weight:800;color:#334155">What you can do next</td>
                      </tr>
                      <tr>
                        <td style="padding-top:12px">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                            <tr>
                              <td style="width:33.33%;padding-right:8px;font-size:13px;line-height:1.5;color:#64748b">
                                <strong style="display:block;color:#0f172a">Find stays</strong>
                                Hotels and resorts
                              </td>
                              <td style="width:33.33%;padding:0 8px;font-size:13px;line-height:1.5;color:#64748b">
                                <strong style="display:block;color:#0f172a">Plan trips</strong>
                                Tours and activities
                              </td>
                              <td style="width:33.33%;padding-left:8px;font-size:13px;line-height:1.5;color:#64748b">
                                <strong style="display:block;color:#0f172a">Save favorites</strong>
                                Wishlist shortlist
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="margin:28px 0">
                <a href="${safeActionUrl}" style="display:inline-block;border-radius:14px;background:#0f172a;color:#ffffff;padding:14px 22px;font-size:15px;font-weight:800;text-decoration:none;box-shadow:0 12px 24px rgba(15,23,42,0.16)">
                  ${content.ctaLabel}
                </a>
              </div>

              <p style="margin:0;border-left:3px solid #38bdf8;padding-left:14px;font-size:14px;line-height:1.7;color:#64748b">
                ${content.note}
              </p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 8px 0;text-align:center;font-size:12px;line-height:1.6;color:#94a3b8">
            Sent by ${appName}. Visit <a href="${safeAppUrl}" style="color:#475569;text-decoration:none;font-weight:700">${safeAppUrl}</a>
          </td>
        </tr>
      </table>
    </div>
  `;
}

type BookingConfirmationRoom = {
  roomName: string;
  quantity: number;
  nights: number;
  pricePerNight: unknown;
  total: unknown;
};

type BookingConfirmationInput = {
  to: string;
  guestName: string;
  bookingCode: string;
  hotelName: string;
  city?: string | null;
  checkIn: Date | string;
  checkOut: Date | string;
  totalAmount: unknown;
  currency?: string;
  rooms: BookingConfirmationRoom[];
  bookingUrl?: string;
};

function formatMoney(value: unknown, currency = "INR") {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatStayDate(value: Date | string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function buildBookingConfirmationHtml(input: BookingConfirmationInput) {
  const safeAppUrl = escapeHtml(appUrl);
  const bookingUrl = escapeHtml(input.bookingUrl ?? `${appUrl}/profile`);
  const guestName = escapeHtml(input.guestName.trim() || "there");
  const hotelName = escapeHtml(input.hotelName);
  const city = input.city ? escapeHtml(input.city) : "";
  const bookingCode = escapeHtml(input.bookingCode);
  const currency = input.currency ?? "INR";
  const roomRows = input.rooms.map((room) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e2e8f0">
        <strong style="display:block;color:#0f172a">${escapeHtml(room.roomName)}</strong>
        <span style="font-size:12px;color:#64748b">${room.quantity} room(s) · ${room.nights} night(s)</span>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right;color:#0f172a;font-weight:700">
        ${formatMoney(room.total, currency)}
      </td>
    </tr>
  `).join("");

  return `
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0">
      Your GetHotels booking hold is confirmed.
    </div>
    <div style="margin:0;background:#f4f7fb;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto">
        <tr>
          <td style="padding:0 0 18px;text-align:center">
            <div style="display:inline-block;height:48px;width:48px;border-radius:16px;background:#0f172a;color:#ffffff;font-size:18px;font-weight:800;line-height:48px;text-align:center">GH</div>
            <div style="margin-top:10px;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#64748b">${appName}</div>
          </td>
        </tr>
        <tr>
          <td style="overflow:hidden;border:1px solid #dbe3ef;border-radius:24px;background:#ffffff;box-shadow:0 24px 70px rgba(15,23,42,0.08)">
            <div style="background:linear-gradient(135deg,#0f172a 0%,#166534 58%,#22c55e 100%);padding:34px 32px;color:#ffffff">
              <div style="display:inline-block;border-radius:999px;background:rgba(255,255,255,0.16);padding:7px 12px;font-size:12px;font-weight:700">Booking confirmation</div>
              <h1 style="margin:18px 0 0;font-size:30px;line-height:1.15;font-weight:800">Your stay is reserved</h1>
              <p style="margin:10px 0 0;color:rgba(255,255,255,0.82);font-size:15px">Booking code ${bookingCode}</p>
            </div>
            <div style="padding:32px">
              <p style="margin:0 0 14px;font-size:18px;line-height:1.6;font-weight:700;color:#0f172a">Hello ${guestName},</p>
              <p style="margin:0;font-size:15px;line-height:1.7;color:#475569">We created your booking hold for <strong>${hotelName}</strong>${city ? ` in ${city}` : ""}. Please complete payment before the hold expires to confirm the stay.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-radius:18px;background:#f8fafc;border:1px solid #e2e8f0;padding:18px">
                <tr>
                  <td style="font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.12em">Check-in</td>
                  <td style="font-size:12px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:0.12em;text-align:right">Check-out</td>
                </tr>
                <tr>
                  <td style="padding-top:6px;font-size:16px;font-weight:800;color:#0f172a">${formatStayDate(input.checkIn)}</td>
                  <td style="padding-top:6px;font-size:16px;font-weight:800;color:#0f172a;text-align:right">${formatStayDate(input.checkOut)}</td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px">
                ${roomRows}
                <tr>
                  <td style="padding:16px 0 0;font-size:16px;font-weight:800;color:#0f172a">Total</td>
                  <td style="padding:16px 0 0;text-align:right;font-size:20px;font-weight:900;color:#0f172a">${formatMoney(input.totalAmount, currency)}</td>
                </tr>
              </table>

              <a href="${bookingUrl}" style="display:inline-block;border-radius:14px;background:#0f172a;color:#ffffff;padding:14px 22px;font-size:15px;font-weight:800;text-decoration:none">View booking</a>
              <p style="margin:22px 0 0;border-left:3px solid #22c55e;padding-left:14px;font-size:13px;line-height:1.7;color:#64748b">This email confirms that your room inventory is temporarily reserved. Payment confirmation will finalize the booking.</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 8px 0;text-align:center;font-size:12px;line-height:1.6;color:#94a3b8">
            Sent by ${appName}. Visit <a href="${safeAppUrl}" style="color:#475569;text-decoration:none;font-weight:700">${safeAppUrl}</a>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export async function sendAuthEmail(input: AuthMailInput) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not set. Skipping auth email.");
    return;
  }

  const content = getAuthMailContent(input);

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: content.subject,
    text: content.text,
    html: buildAuthEmailHtml(content, input.actionUrl),
  });
}

export async function sendBookingConfirmationEmail(input: BookingConfirmationInput) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("RESEND_API_KEY is not set. Skipping booking confirmation email.");
    return;
  }

  await resend.emails.send({
    from: fromEmail,
    to: input.to,
    subject: `Booking ${input.bookingCode} at ${input.hotelName}`,
    text: `Hello ${input.guestName || "there"}, your booking hold ${input.bookingCode} at ${input.hotelName} is created for ${formatStayDate(input.checkIn)} to ${formatStayDate(input.checkOut)}. Total: ${formatMoney(input.totalAmount, input.currency ?? "INR")}.`,
    html: buildBookingConfirmationHtml(input),
  });
}

export async function sendVerificationEmail(email: string, token: string, name?: string | null) {
  const verifyUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  await sendAuthEmail({
    to: email,
    name,
    type: "signup",
    actionUrl: verifyUrl,
  });
}
