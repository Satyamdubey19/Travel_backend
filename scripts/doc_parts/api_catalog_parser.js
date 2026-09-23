import fs from "fs";
import path from "path";

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

const CATEGORY_MAP = [
  {
    title:
      "8.1 Authentication, Enterprise SSO & Session Governance (17 Endpoints)",
    prefix: [
      "/api/auth",
      "/api/forgot-password",
      "/api/reset-password",
      "/api/verify",
    ],
    description:
      "Endpoints governing credentials, OAuth callbacks, sliding refresh rotation, 3-device FIFO limits, and SAML 2.0 / OIDC enterprise federation.",
  },
  {
    title:
      "8.2 Statutory Policies, DPDP Act 2023 & Clickwrap Consent (3 Endpoints)",
    prefix: ["/api/policies"],
    description:
      "Endpoints serving active legal documents, verifying user clickwrap version compliance, and persisting immutable DPDP Act 2023 consent records.",
  },
  {
    title: "8.3 Host Onboarding, 6-Stage KYC & Supply Operations (6 Endpoints)",
    prefix: ["/api/host"],
    description:
      "Supply-side endpoints managing host legal identity onboarding, AES-GCM encrypted bank account collection, and host reservation management.",
  },
  {
    title: "8.4 Group Tours, Itineraries & Departure Batches (24 Endpoints)",
    prefix: ["/api/tour", "/api/tour-bookings"],
    description:
      "Multi-day guided expedition endpoints handling batch departure slots, traveler rosters, real-time waitlists, and cancellation capacity replenishment.",
  },
  {
    title: "8.5 Hyperlocal Activities & Slot Scheduling (9 Endpoints)",
    prefix: ["/api/activity", "/api/activity-bookings"],
    description:
      "Single-day experience endpoints managing recurring daily time slots, capacity counter locking, and instructor allocations.",
  },
  {
    title: "8.6 Vehicle Fleet Rentals & Custody Inspection (10 Endpoints)",
    prefix: ["/api/rental", "/api/rental-bookings"],
    description:
      "Self-drive and chauffeur rental endpoints enforcing statutory RC verification, security deposits, and two-stage photographic handover inspections.",
  },
  {
    title:
      "8.7 Payment Processing, Razorpay Webhooks & Financial Escrow (8 Endpoints)",
    prefix: ["/api/webhooks", "/api/my-bookings"],
    description:
      "Transaction orchestration endpoints managing Razorpay orders, HMAC-SHA256 signature verification, idempotent webhook processing, and escrow holds.",
  },
  {
    title:
      "8.8 Administrative Governance, Quality Moderation & Audit (28 Endpoints)",
    prefix: ["/api/admin"],
    description:
      "Privileged administrator endpoints for KYC adjudication, listing content moderation, policy CMS updates, financial payouts, and dispute mediation.",
  },
  {
    title:
      "8.9 Community, Safety Incidents, Location & Telemetry (14 Endpoints)",
    prefix: [
      "/api/location",
      "/api/incidents",
      "/api/notifications",
      "/api/wishlist",
      "/api/community",
      "/api/health",
      "/api/cron",
      "/api/docs",
      "/api/openapi",
      "/api/ai",
      "/api/upload",
    ],
    description:
      "Platform auxiliary services managing GPS proximity tracking, emergency SOS broadcasts, push notifications, wishlists, and health telemetry.",
  },
];

export function generateAllApisHtml(apiDir) {
  function getRouteInfo(dir, base = "") {
    let routes = [];
    if (!fs.existsSync(dir)) return routes;
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const full = path.join(dir, item);
      if (fs.statSync(full).isDirectory()) {
        routes = routes.concat(getRouteInfo(full, path.join(base, item)));
      } else if (item.startsWith("route.")) {
        const fileContent = fs.readFileSync(full, "utf8");
        const methods = [];
        ["GET", "POST", "PUT", "PATCH", "DELETE"].forEach((m) => {
          if (
            new RegExp("export\\s+async\\s+function\\s+" + m + "\\b").test(
              fileContent,
            ) ||
            new RegExp("export\\s+function\\s+" + m + "\\b").test(fileContent)
          ) {
            methods.push(m);
          }
        });
        routes.push({
          path: "/api/" + base.replace(/\\/g, "/"),
          methods: methods.length > 0 ? methods : ["GET"],
          hasAuth:
            fileContent.includes("requireUser") ||
            fileContent.includes("requireHost") ||
            fileContent.includes("requireAdmin") ||
            fileContent.includes("getServerSession") ||
            fileContent.includes("verifyJwt"),
          hasAdmin:
            fileContent.includes("requireAdmin") || base.includes("admin"),
          hasHost: fileContent.includes("requireHost") || base.includes("host"),
          content: fileContent,
        });
      }
    }
    return routes;
  }

  const allRoutes = getRouteInfo(apiDir);
  allRoutes.sort((a, b) => a.path.localeCompare(b.path));

  let html = "";

  for (const cat of CATEGORY_MAP) {
    const matched = allRoutes.filter((r) =>
      cat.prefix.some((p) => r.path.startsWith(p)),
    );
    if (matched.length === 0) continue;

    html += `\n<div class="page-break"></div>\n`;
    html += `<h2>${escapeHtml(cat.title)}</h2>\n`;
    html += `<p style="margin-bottom: 14px;">${escapeHtml(cat.description)}</p>\n`;

    html += `
    <table>
      <thead>
        <tr>
          <th style="width: 12%;">Method</th>
          <th style="width: 30%;">Endpoint Route</th>
          <th style="width: 18%;">Auth Required</th>
          <th style="width: 40%;">Payload / Query & Functional Purpose</th>
        </tr>
      </thead>
      <tbody>
    `;

    for (const route of matched) {
      let authBadge = `<span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold;">Public</span>`;
      if (route.hasAdmin) {
        authBadge = `<span style="background: #ffe4e6; color: #be123c; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold;">ADMIN (Role)</span>`;
      } else if (route.hasHost) {
        authBadge = `<span style="background: #fef3c7; color: #b45309; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold;">HOST (Verified)</span>`;
      } else if (route.hasAuth) {
        authBadge = `<span style="background: #dcfce7; color: #15803d; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold;">TRAVELER (JWT)</span>`;
      }

      for (const method of route.methods) {
        let methodColor = "#0284c7";
        if (method === "POST") methodColor = "#059669";
        else if (method === "DELETE") methodColor = "#e11d48";
        else if (method === "PATCH" || method === "PUT")
          methodColor = "#d97706";

        // Derive functional purpose
        let purpose = "Fetches resources and executes business logic.";
        if (route.path.includes("login"))
          purpose =
            "Authenticates user credentials, sets secure HttpOnly cookie, and issues 15-min JWT access token.";
        else if (route.path.includes("register"))
          purpose =
            "Registers user, hashes password via bcrypt cost 12, and creates initial UserProfile.";
        else if (route.path.includes("refresh"))
          purpose =
            "Rotates refresh token and issues fresh JWT access token; revokes family if reused.";
        else if (route.path.includes("devices"))
          purpose =
            "Lists active user devices or terminates a specific device session via FIFO eviction.";
        else if (route.path.includes("sso"))
          purpose =
            "Handles SAML 2.0 / OIDC corporate identity provider federation and assertion resolution.";
        else if (route.path.includes("policies/consent"))
          purpose =
            "Persists voluntary DPDP Act 2023 clickwrap consent with IP and user-agent metadata.";
        else if (route.path.includes("kyc"))
          purpose =
            "Manages 6-stage host identity dossier, encrypted Aadhaar/PAN, and AES-256-GCM bank details.";
        else if (route.path.includes("batches"))
          purpose =
            "Queries or configures discrete tour departure dates and real-time seat inventory.";
        else if (route.path.includes("slots"))
          purpose =
            "Creates or queries recurring activity time slots with capacity counters.";
        else if (route.path.includes("inspections"))
          purpose =
            "Records Stage 1 (Pickup) or Stage 2 (Return) vehicle odometer, fuel level, and 360° photos.";
        else if (route.path.includes("payment/order"))
          purpose =
            "Generates cryptographically signed Razorpay Order ID for escrow payment checkout.";
        else if (route.path.includes("payment/verify"))
          purpose =
            "Validates Razorpay HMAC-SHA256 signature, confirms booking, and holds funds in escrow.";
        else if (route.path.includes("webhooks/razorpay"))
          purpose =
            "Idempotently processes payment.captured and refund.processed webhook callbacks.";
        else if (route.path.includes("admin/listings"))
          purpose =
            "Adjudicates submitted tours/activities/rentals: approve, request revision, or archive.";
        else if (route.path.includes("admin/policies"))
          purpose =
            "Publishes new policy version (v1.0 -> v1.1), triggering blocking re-consent prompts.";
        else if (route.path.includes("gps"))
          purpose =
            "Records location coordinate telemetry with consent verification for proximity discovery.";
        else if (route.path.includes("sos") || route.path.includes("incidents"))
          purpose =
            "Dispatches emergency incident telemetry to safety response desk and emergency contacts.";

        html += `
          <tr>
            <td><strong style="color: ${methodColor}; font-family: 'JetBrains Mono', monospace;">${escapeHtml(method)}</strong></td>
            <td><code style="font-size: 10px;">${escapeHtml(route.path)}</code></td>
            <td>${authBadge}</td>
            <td><span style="font-size: 10.5px;">${purpose}</span></td>
          </tr>
        `;
      }
    }

    html += `
      </tbody>
    </table>
    `;
  }

  return html;
}
