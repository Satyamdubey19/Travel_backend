import fs from "fs";
import path from "path";

export function parsePrismaSchema(schemaPath) {
  const content = fs.readFileSync(schemaPath, "utf8");
  const lines = content.split("\n");
  let currentModel = null;
  let currentEnum = null;
  const models = {};
  const enums = {};

  for (let line of lines) {
    line = line.trim();
    if (line.startsWith("//") || !line) continue;

    if (line.startsWith("model ")) {
      currentModel = line.split(/\s+/)[1];
      models[currentModel] = { fields: [], indexes: [] };
      continue;
    }
    if (line.startsWith("enum ")) {
      currentEnum = line.split(/\s+/)[1];
      enums[currentEnum] = [];
      continue;
    }
    if (line.startsWith("}")) {
      currentModel = null;
      currentEnum = null;
      continue;
    }
    if (currentModel) {
      if (line.startsWith("@@")) {
        models[currentModel].indexes.push(line);
      } else {
        const parts = line.split(/\s+/);
        const name = parts[0];
        const type = parts[1];
        const attrs = parts.slice(2).join(" ");
        models[currentModel].fields.push({ name, type, attrs });
      }
    }
    if (currentEnum) {
      enums[currentEnum].push(line);
    }
  }
  return { models, enums };
}

const DOMAIN_MAP = {
  User: "Domain 1: Identity, Auth & Enterprise SSO",
  UserProfile: "Domain 1: Identity, Auth & Enterprise SSO",
  UserDevice: "Domain 1: Identity, Auth & Enterprise SSO",
  Session: "Domain 1: Identity, Auth & Enterprise SSO",
  RefreshToken: "Domain 1: Identity, Auth & Enterprise SSO",
  OtpVerification: "Domain 1: Identity, Auth & Enterprise SSO",
  PasswordResetToken: "Domain 1: Identity, Auth & Enterprise SSO",
  LoginAttempt: "Domain 1: Identity, Auth & Enterprise SSO",
  EmailChangeRequest: "Domain 1: Identity, Auth & Enterprise SSO",
  SecurityEvent: "Domain 1: Identity, Auth & Enterprise SSO",
  Organization: "Domain 1: Identity, Auth & Enterprise SSO",
  SsoConfiguration: "Domain 1: Identity, Auth & Enterprise SSO",
  OrganizationMember: "Domain 1: Identity, Auth & Enterprise SSO",
  SsoAuditLog: "Domain 1: Identity, Auth & Enterprise SSO",
  AdminProfile: "Domain 1: Identity, Auth & Enterprise SSO",
  UserTravelPreference: "Domain 1: Identity, Auth & Enterprise SSO",
  UserBlock: "Domain 1: Identity, Auth & Enterprise SSO",

  Policy: "Domain 2: Statutory Compliance & Trust",
  PolicyConsent: "Domain 2: Statutory Compliance & Trust",
  Host: "Domain 2: Statutory Compliance & Trust",
  KycApplication: "Domain 2: Statutory Compliance & Trust",
  AuditLog: "Domain 2: Statutory Compliance & Trust",
  ModerationLog: "Domain 2: Statutory Compliance & Trust",
  TravelerReport: "Domain 2: Statutory Compliance & Trust",

  Tour: "Domain 3: Multi-Day Guided Tours & Itineraries",
  TourItineraryDay: "Domain 3: Multi-Day Guided Tours & Itineraries",
  TourBooking: "Domain 3: Multi-Day Guided Tours & Itineraries",
  TourTraveler: "Domain 3: Multi-Day Guided Tours & Itineraries",
  TourParticipant: "Domain 3: Multi-Day Guided Tours & Itineraries",
  TourJoinRequest: "Domain 3: Multi-Day Guided Tours & Itineraries",
  TourWaitlist: "Domain 3: Multi-Day Guided Tours & Itineraries",
  WaitlistQueue: "Domain 3: Multi-Day Guided Tours & Itineraries",
  TourCancellation: "Domain 3: Multi-Day Guided Tours & Itineraries",
  TourChatRoom: "Domain 3: Multi-Day Guided Tours & Itineraries",
  TourMessage: "Domain 3: Multi-Day Guided Tours & Itineraries",
  TourMessageSeen: "Domain 3: Multi-Day Guided Tours & Itineraries",
  TourMessageReport: "Domain 3: Multi-Day Guided Tours & Itineraries",
  Refund: "Domain 3: Multi-Day Guided Tours & Itineraries",
  Booking: "Domain 3: Multi-Day Guided Tours & Itineraries",
  BookingTimeline: "Domain 3: Multi-Day Guided Tours & Itineraries",

  Activity: "Domain 4: Hyperlocal Activities & Slot Scheduling",
  ActivitySlot: "Domain 4: Hyperlocal Activities & Slot Scheduling",
  ActivityBooking: "Domain 4: Hyperlocal Activities & Slot Scheduling",
  ActivityBookingGuest: "Domain 4: Hyperlocal Activities & Slot Scheduling",
  ActivityBookingTimeline: "Domain 4: Hyperlocal Activities & Slot Scheduling",
  ActivityPayment: "Domain 4: Hyperlocal Activities & Slot Scheduling",
  ActivityRefund: "Domain 4: Hyperlocal Activities & Slot Scheduling",

  Rental: "Domain 5: Vehicle Fleet Rentals & Custody Inspections",
  RentalDetails: "Domain 5: Vehicle Fleet Rentals & Custody Inspections",
  RentalBooking: "Domain 5: Vehicle Fleet Rentals & Custody Inspections",
  RentalInspection: "Domain 5: Vehicle Fleet Rentals & Custody Inspections",
  RentalBookingTimeline:
    "Domain 5: Vehicle Fleet Rentals & Custody Inspections",
  RentalPayment: "Domain 5: Vehicle Fleet Rentals & Custody Inspections",
  RentalRefund: "Domain 5: Vehicle Fleet Rentals & Custody Inspections",

  Payment: "Domain 6: Financial Ledgers, Escrow & Coupons",
  PaymentWebhookEvent: "Domain 6: Financial Ledgers, Escrow & Coupons",
  Payout: "Domain 6: Financial Ledgers, Escrow & Coupons",
  Coupon: "Domain 6: Financial Ledgers, Escrow & Coupons",
  CouponRedemption: "Domain 6: Financial Ledgers, Escrow & Coupons",
  Amenity: "Domain 6: Financial Ledgers, Escrow & Coupons",

  Review: "Domain 7: Community, Reviews, Social & Safety",
  Post: "Domain 7: Community, Reviews, Social & Safety",
  PostComment: "Domain 7: Community, Reviews, Social & Safety",
  PostLike: "Domain 7: Community, Reviews, Social & Safety",
  WishlistItem: "Domain 7: Community, Reviews, Social & Safety",
  Notification: "Domain 7: Community, Reviews, Social & Safety",
  NotificationDelivery: "Domain 7: Community, Reviews, Social & Safety",
  Incident: "Domain 7: Community, Reviews, Social & Safety",
  IncidentEvent: "Domain 7: Community, Reviews, Social & Safety",
};

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function generateAllModelsHtml(schemaPath) {
  const { models, enums } = parsePrismaSchema(schemaPath);

  // Group models by domain
  const domains = {};
  for (const [modelName, modelData] of Object.entries(models)) {
    const domain =
      DOMAIN_MAP[modelName] || "Domain 8: Auxiliary & Platform Utilities";
    if (!domains[domain]) domains[domain] = [];
    domains[domain].push({ name: modelName, ...modelData });
  }

  let html = "";

  let domainCounter = 1;
  for (const [domainName, modelList] of Object.entries(domains)) {
    html += `\n<div class="page-break"></div>\n`;
    html += `<h2>7.${domainCounter} ${escapeHtml(domainName)} (${modelList.length} Relational Models)</h2>\n`;
    html += `<p>This domain encompasses ${modelList.length} relational entities enforcing data integrity, foreign key cascades, and business constraints.</p>\n`;

    for (const model of modelList) {
      html += `
      <div class="avoid-break" style="margin-bottom: 20px;">
        <h3 style="margin-top: 14px; margin-bottom: 6px; font-size: 13px; color: var(--accent); display: flex; align-items: center; justify-content: space-between;">
          <span>Model: <code>${escapeHtml(model.name)}</code></span>
          <span style="font-size: 10px; font-weight: normal; color: var(--slate-400);">${model.fields.length} Attributes • ${model.indexes.length} Indexes</span>
        </h3>
        <table>
          <thead>
            <tr>
              <th style="width: 22%;">Field Name</th>
              <th style="width: 18%;">Data Type</th>
              <th style="width: 35%;">Constraints / Relations / Attributes</th>
              <th style="width: 25%;">Domain Purpose</th>
            </tr>
          </thead>
          <tbody>
      `;

      for (const field of model.fields) {
        let purpose = "Core entity attribute";
        if (field.attrs.includes("@id")) purpose = "Primary Key identifier";
        else if (field.attrs.includes("@unique")) purpose = "Unique constraint";
        else if (field.attrs.includes("@relation"))
          purpose = "Foreign key relationship";
        else if (field.name.endsWith("At"))
          purpose = "Timestamp lifecycle marker";
        else if (field.name.startsWith("is") || field.name.startsWith("has"))
          purpose = "Boolean state toggle";
        else if (field.name.includes("Enc"))
          purpose = "AES-256-GCM encrypted field";
        else if (field.name.includes("price") || field.name.includes("Amount"))
          purpose = "Monetary currency value (INR)";
        else if (field.name.includes("status") || field.name.includes("Status"))
          purpose = "State machine lifecycle enum";

        html += `
            <tr>
              <td><strong><code>${escapeHtml(field.name)}</code></strong></td>
              <td><code>${escapeHtml(field.type)}</code></td>
              <td><span style="font-size: 10px; color: var(--slate-600);">${escapeHtml(field.attrs || "—")}</span></td>
              <td><span style="font-size: 10.5px;">${purpose}</span></td>
            </tr>
        `;
      }

      html += `
          </tbody>
        </table>
      `;

      if (model.indexes.length > 0) {
        html += `
        <div style="font-size: 10px; color: var(--slate-600); background: var(--slate-100); padding: 6px 12px; border-radius: 4px; margin-top: -8px; margin-bottom: 12px; font-family: 'JetBrains Mono', monospace;">
          <strong>Indexes & Constraints:</strong> ${model.indexes.map((idx) => escapeHtml(idx)).join(" | ")}
        </div>
        `;
      }

      html += `</div>\n`;
    }

    domainCounter++;
  }

  // ENUMS SECTION
  html += `\n<div class="page-break"></div>\n`;
  html += `<h2>7.${domainCounter} Complete Catalog of Strict Platform Enums (All 46 Enums)</h2>\n`;
  html += `<p>PostgreSQL strict enums govern lifecycle states, user roles, policy categories, inspection stages, and severity tiers, preventing invalid state mutations across the application layer.</p>\n`;

  html += `<div class="grid-2">\n`;
  for (const [enumName, enumValues] of Object.entries(enums)) {
    html += `
    <div class="card avoid-break" style="margin-bottom: 12px;">
      <div class="card-title" style="font-size: 12px; color: var(--slate-900); display: flex; justify-content: space-between;">
        <span>Enum: <code>${escapeHtml(enumName)}</code></span>
        <span style="font-size: 10px; color: var(--accent); font-weight: normal;">${enumValues.length} States</span>
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px;">
        ${enumValues.map((v) => `<span style="display: inline-block; background: var(--slate-100); border: 1px solid var(--slate-200); padding: 2px 6px; border-radius: 4px; font-size: 9.5px; font-family: 'JetBrains Mono', monospace; color: var(--slate-700);">${escapeHtml(v)}</span>`).join("")}
      </div>
    </div>
    `;
  }
  html += `</div>\n`;

  return html;
}
