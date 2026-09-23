import path from "path";
import { generateAllModelsHtml } from "./schema_parser.js";
import { generateAllApisHtml } from "./api_catalog_parser.js";

import fs from "fs";

export function getPart04(svgErDomain) {
  let schemaPath = path.resolve("prisma/schema.prisma");
  if (!fs.existsSync(schemaPath)) {
    schemaPath = path.resolve("Travels_backend/prisma/schema.prisma");
  }
  let apiDir = path.resolve("app/api");
  if (!fs.existsSync(apiDir)) {
    apiDir = path.resolve("Travels_backend/app/api");
  }

  const modelsHtml = generateAllModelsHtml(schemaPath);
  const apisHtml = generateAllApisHtml(apiDir);

  return `
  <div class="page-break"></div>

  <!-- CHAPTER 07: DATABASE DATA DICTIONARY -->
  <h1><span class="sec-num">07</span> Exhaustive Database Data Dictionary (All 70 Models & 46 Enums)</h1>

  <p>
    The PostgreSQL database schema consists of <strong>70 Prisma models</strong> and <strong>46 strict PostgreSQL enums</strong> spanning 1,249 validated relational fields. The schema is normalized to 3NF/BCNF across seven operational domain clusters, incorporating compound B-Tree indexes, foreign key cascades, and column-level encryption.
  </p>

  <div class="diagram-container">
    ${svgErDomain}
    <div class="diagram-caption">Figure 7.1: Architectural Relational Domain Map Across the 70 PostgreSQL Entities</div>
  </div>

  <div class="callout callout-info" style="margin-top: 14px;">
    <strong>Cryptographic & Storage Invariants:</strong>
    <ul style="margin-left: 18px; margin-top: 4px;">
      <li><strong>AES-256-GCM Cryptographic Vault:</strong> Fields suffixed with <code>Enc</code> (such as <code>bankAccountEnc</code> in <code>KycApplication</code> and SSO secrets in <code>SsoConfiguration</code>) are encrypted using AES-256-GCM with unique 96-bit initialization vectors and 128-bit authentication tags. Plaintext values are never written to disk or database logs.</li>
      <li><strong>Zero Mock / Strict Constraints:</strong> All financial amounts are stored as <code>Decimal(10, 2)</code> to prevent floating-point rounding errors. All identity timestamps use UTC <code>DateTime</code>.</li>
      <li><strong>Idempotency Keys:</strong> All commercial transaction tables (<code>TourBooking</code>, <code>ActivityBooking</code>, <code>RentalBooking</code>) enforce a unique <code>idempotencyKey</code> constraint to guarantee zero double-charging under network retries.</li>
    </ul>
  </div>

  ${modelsHtml}

  <div class="page-break"></div>

  <!-- CHAPTER 08: REST API SPECIFICATION -->
  <h1><span class="sec-num">08</span> Exhaustive REST API Endpoints Catalog (119 Endpoints & 152 Operations)</h1>

  <p>
    The Travels Pro backend exposes <strong>119 modular REST endpoints</strong> supporting <strong>152 HTTP operations</strong> (<code>GET</code>, <code>POST</code>, <code>PUT</code>, <code>PATCH</code>, <code>DELETE</code>). All mutation endpoints enforce strict Origin/CSRF validation, input sanitization via Zod schemas, distributed rate limiting via Redis, and role-based access control (RBAC).
  </p>

  <div class="callout callout-warning">
    <strong>API Security Standards & Error Contract:</strong>
    <ul style="margin-left: 18px; margin-top: 4px;">
      <li><strong>Standard Success Response:</strong> <code>{ "success": true, "data": { ... }, "meta": { "timestamp": "...", "requestId": "..." } }</code></li>
      <li><strong>Standard Error Response:</strong> <code>{ "success": false, "error": { "code": "STRING_ENUM", "message": "Human readable description", "details": [ ... ] } }</code></li>
      <li><strong>HTTP Status Codes:</strong> <code>200 OK</code>, <code>201 Created</code>, <code>400 Bad Request</code>, <code>401 Unauthorized</code>, <code>403 Forbidden</code>, <code>404 Not Found</code>, <code>409 Conflict</code>, <code>422 Unprocessable</code>, <code>429 Rate Limited</code>, <code>500 Internal Error</code>.</li>
      <li><strong>Session Cookie Invariant:</strong> Cookie <code>travels_session</code> is delivered with <code>HttpOnly</code>, <code>Secure</code>, <code>SameSite=Lax</code>, and path <code>/</code>. Bearer tokens are supported for mobile clients.</li>
    </ul>
  </div>

  ${apisHtml}
  `;
}
