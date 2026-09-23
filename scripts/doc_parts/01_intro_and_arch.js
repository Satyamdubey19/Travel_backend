export function getPart01(svgTopology) {
  return `
  <!-- COVER PAGE -->
  <div class="cover">
    <div>
      <div class="cover-badge">
        <span>●</span> Official System Specification • Production Baseline v2.4
      </div>
      <h1 class="cover-title">
        Travels Pro: <span>Enterprise Travel & Multi-Modal Mobility OS</span>
      </h1>
      <p class="cover-subtitle">
        Exhaustive technical handbook, domain architecture, module mechanics, logical & UI flows, complete data dictionary, legal compliance framework, financial unit economics, and engineering roadmap.
      </p>
    </div>

    <div>
      <div class="meta-grid">
        <div class="meta-item">
          <p>Document Classification</p>
          <p>Master Technical Blueprint</p>
        </div>
        <div class="meta-item">
          <p>Regulatory Compliance</p>
          <p>DPDP Act 2023 • IT Act 2000</p>
        </div>
        <div class="meta-item">
          <p>Engineering Core</p>
          <p>Next.js 16 • Turbopack • Prisma 7</p>
        </div>
        <div class="meta-item">
          <p>Relational Scale</p>
          <p>70 Models • 46 Enums • 28 Migrations</p>
        </div>
        <div class="meta-item">
          <p>Automated Verification</p>
          <p>212 / 212 Tests Passed (100%)</p>
        </div>
        <div class="meta-item">
          <p>Production Endpoints</p>
          <p>47 UI Routes • 119 API Endpoints (152 Operations)</p>
        </div>
      </div>

      <div style="margin-top: 24px; font-size: 10px; color: var(--slate-400); display: flex; justify-content: space-between;">
        <span>Antigravity Engineering Task Force</span>
        <span>Generated: September 2026</span>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- EXECUTIVE TABLE OF CONTENTS -->
  <h1><span class="sec-num">00</span> Master Document Index & Table of Contents</h1>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">Volume I: Foundations & Personas</div>
      <p>• <strong>Chapter 01:</strong> Executive Overview, Problem Analysis & Statutory DPDP Act 2023</p>
      <p>• <strong>Chapter 02:</strong> Enterprise Distributed System Topology & Security Architecture</p>
      <p>• <strong>Chapter 03:</strong> Traveler Persona Journey: 14 Detailed Screens & Checkout Flows</p>
      <p>• <strong>Chapter 04:</strong> Host Persona Journey: 10 Screens, 6-Step KYC, Studios & Custody Handover</p>
      <p>• <strong>Chapter 05:</strong> Admin Persona Journey: 9 Screens, Moderation, Policy CMS & Disputes</p>
      <p>• <strong>Chapter 06:</strong> Core Subsystems Deep Dive: The 10 Modules (What, When, How)</p>
    </div>
    <div class="card">
      <div class="card-title">Volume II: Technical Specifications & Business</div>
      <p>• <strong>Chapter 07:</strong> Exhaustive Database Data Dictionary (All 70 Prisma Models & 46 Enums)</p>
      <p>• <strong>Chapter 08:</strong> Complete REST API Endpoints Catalog (119 Endpoints & 152 Operations)</p>
      <p>• <strong>Chapter 09:</strong> Business Model, Commercial Monetization & Financial Unit Economics</p>
      <p>• <strong>Chapter 10:</strong> Current Scope vs Future Scope Roadmap (Phases 1, 2, 3)</p>
      <p>• <strong>Chapter 11:</strong> Engineering Retrospective & "What to Make Again" Guidance</p>
      <p>• <strong>Chapter 12:</strong> Production Verification & Test Evidence Appendix (212/212 Tests)</p>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- CHAPTER 01: EXECUTIVE OVERVIEW -->
  <h1><span class="sec-num">01</span> Executive Overview, Problem Analysis & Statutory Governance</h1>

  <div class="callout callout-info">
    <strong>Executive Statement:</strong> Travels Pro transforms fragmented, informal experiential travel into a verified, secure, and multi-modal digital marketplace. By integrating <strong>Group Tours</strong>, <strong>Hyperlocal Activities</strong>, and <strong>Self-Drive Car Rentals</strong> under a unified zero-trust identity and escrow umbrella, it creates institutional trust for both travelers and supply operators.
  </div>

  <h2>1.1 Market Opportunity & Core Industry Deficiencies</h2>
  <p>
    Experiential travel and localized adventure tourism in India and Southeast Asia represent an explosive, rapidly expanding market sector. However, the sector is plagued by systemic operational vulnerabilities that inhibit consumer confidence and host scalability:
  </p>

  <table>
    <thead>
      <tr>
        <th style="width: 22%;">Failure Vector</th>
        <th style="width: 38%;">Traditional Market Pitfalls</th>
        <th style="width: 40%;">Travels Pro Engineered Architecture</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Host Legitimacy & Trust</strong></td>
        <td>Unverified operators advertising on Instagram/WhatsApp without legal registration, emergency medical training, or valid vehicle commercial permits.</td>
        <td><strong>6-Stage Verified KYC:</strong> Mandatory legal identity verification, government ID proof validation (Aadhaar/PAN regex), live biometric selfie with ID matching, and <code>HOST_SAFETY_AGREEMENT</code> compliance.</td>
      </tr>
      <tr>
        <td><strong>Data Privacy & PII Leakage</strong></td>
        <td>Sensitive identity proofs (Aadhaar cards, passports) exchanged over unencrypted messaging apps without retention or disposal controls.</td>
        <td><strong>AES-256-GCM Vault:</strong> Zero plain-text storage of bank accounts or tax IDs. Stored with initialization vectors and tamper-evident authentication tags.</td>
      </tr>
      <tr>
        <td><strong>Vehicle Custody Friction</strong></td>
        <td>Undocumented pre-existing scratches and vehicle defects trigger arbitrary security deposit forfeiture and acrimonious disputes upon return.</td>
        <td><strong>Two-Stage Digital Custody:</strong> Odometer, fuel level, and 4-angle exterior/interior photos cryptographically logged and countersigned at pickup and return.</td>
      </tr>
      <tr>
        <td><strong>Financial Escrow & Refunds</strong></td>
        <td>Operators demand 100% upfront UPI bank transfers. In cases of cancellation or substandard delivery, travelers have zero recourse.</td>
        <td><strong>Milestone Escrow Clearing:</strong> Customer payments are held in escrow and released to host accounts only post-trip completion. Transparent tiered refund rules.</td>
      </tr>
      <tr>
        <td><strong>Community & Coordination</strong></td>
        <td>Tour groups communicate in chaotic public WhatsApp groups with zero privacy protection, exposing traveler phone numbers to harassment.</td>
        <td><strong>Trip Circles:</strong> Authenticated, private Socket.IO chat rooms scoped strictly to confirmed booking codes with real-time moderation and SOS broadcasting.</td>
      </tr>
    </tbody>
  </table>

  <h2>1.2 Statutory Legal Baseline: India DPDP Act 2023 Compliance</h2>
  <p>
    Travels Pro was engineered from the ground up to comply with the <strong>Digital Personal Data Protection Act, 2023 (DPDP Act 2023)</strong> and the <strong>Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011</strong>. Key compliance tenets include:
  </p>
  <ul>
    <li><strong>Unbundled Explicit Clickwrap Consent:</strong> Pre-checked checkboxes are strictly prohibited across all signup, login, and checkout forms. Users must voluntarily click distinct checkboxes for Terms of Service, Privacy Policy, and Safety Guidelines.</li>
    <li><strong>Tamper-Evident Consent Logging:</strong> Every consent event is persisted into an immutable <code>PolicyConsent</code> record capturing <code>userId</code>, <code>policyId</code>, <code>policyVersion</code>, <code>ipAddress</code>, <code>userAgent</code>, and <code>context</code> (e.g. <code>SIGNUP</code>, <code>HOST_KYC</code>, <code>BOOKING</code>).</li>
    <li><strong>Dynamic Force Re-Consent Engine:</strong> When administrators publish an updated policy version (e.g. v1.0 &rarr; v1.1), the authentication gateway intercepts subsequent login requests, sets <code>reconsentRequired: true</code>, and mounts a blocking <code>PolicyConsentModal</code> that prevents application navigation until consent is granted.</li>
    <li><strong>Data Principal Rights & Erasure:</strong> Implements self-service data export and account erasure endpoints adhering to statutory 30-day fulfillment windows.</li>
  </ul>

  <h2>1.3 The Five Standard Platform Policies</h2>
  <table>
    <thead>
      <tr>
        <th style="width: 25%;">Policy Type</th>
        <th style="width: 35%;">Title</th>
        <th style="width: 40%;">Key Statutory Clauses & Enforcements</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong><code>TERMS_OF_SERVICE</code></strong></td>
        <td>Terms of Service & User Agreement</td>
        <td>Marketplace intermediary protections under Section 79 of IT Act 2000, binding digital contracts, payment escrow terms, and dispute arbitration under Arbitration and Conciliation Act, 1996.</td>
      </tr>
      <tr>
        <td><strong><code>PRIVACY_POLICY</code></strong></td>
        <td>Privacy Policy & Data Protection</td>
        <td>Purpose specification, lawful processing grounds under DPDP Act 2023, cookie usage, data retention schedules, and grievance redressal officer contact disclosures.</td>
      </tr>
      <tr>
        <td><strong><code>HOST_SAFETY_AGREEMENT</code></strong></td>
        <td>Host Safety Agreement & Code of Conduct</td>
        <td>Mandatory statutory permits, pre-trip vehicle roadworthiness inspections, emergency first aid kit maintenance, certified guide requirements, and zero tolerance for harassment.</td>
      </tr>
      <tr>
        <td><strong><code>TRAVELER_SAFETY_POLICY</code></strong></td>
        <td>Traveler Safety Guidelines</td>
        <td>Fitness declarations, compliance with certified host safety directives, substance and alcohol prohibitions during high-risk activities, and Leave No Trace environmental guidelines.</td>
      </tr>
      <tr>
        <td><strong><code>CANCELLATION_POLICY</code></strong></td>
        <td>Standard Cancellation & Refund Policy</td>
        <td>Unambiguous tiered refund boundaries (&gt;48h: 100%, 24-48h: 50%, &lt;24h: non-refundable), host cancellation penalties, and force majeure weather exemptions.</td>
      </tr>
    </tbody>
  </table>

  <div class="page-break"></div>

  <!-- CHAPTER 02: SYSTEM ARCHITECTURE -->
  <h1><span class="sec-num">02</span> Enterprise System Architecture & Cloud Infrastructure</h1>

  <p>
    Travels Pro operates as a decoupled, multi-tier system combining an optimized Next.js 16 frontend shell, a high-throughput REST API gateway, a serverless PostgreSQL database with connection pooling, in-memory Redis acceleration, and an event-driven Socket.IO messaging cluster.
  </p>

  <div class="diagram-container">
    ${svgTopology}
    <div class="diagram-caption">Figure 2.1: Travels Pro Enterprise Distributed System Topology & Infrastructure Map</div>
  </div>

  <h2>2.1 Component Deep-Dive & Architectural Roles</h2>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">1. Presentation Shell (Port 3000)</div>
      <p>Built with <strong>Next.js 16 App Router</strong>, React 19, and Turbopack. Renders 47 production routes utilizing Server-Side Rendering (SSR) for SEO-sensitive discovery pages and Client-Side Hydration (CSR) for rich stateful dashboards. Employs <code>HostUI</code> design tokens, Framer Motion transitions, and Radix UI primitives.</p>
    </div>
    <div class="card">
      <div class="card-title">2. Headless API Gateway (Port 4000)</div>
      <p>Hosts 119 modular REST endpoints (152 HTTP operations) built on the Node.js server runtime. Implements strict Zod schema validation, origin verification, double-submit CSRF prevention, rate limiting, and centralized error handling with sanitization to prevent stack trace leakage.</p>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">3. Persistence Layer (Neon PostgreSQL)</div>
      <p>Utilizes <strong>PostgreSQL 16</strong> hosted on Neon Serverless, managed via <strong>Prisma ORM 7</strong> with 28 applied sequential migrations. Employs PgBouncer transaction-mode connection pooling to handle high-concurrency bursts across 70 relational models and 46 strict enums.</p>
    </div>
    <div class="card">
      <div class="card-title">4. Real-Time & Asynchronous Layer</div>
      <p>Socket.IO cluster handling sub-50ms message propagation for Trip Circles, authenticated via session cookies. <strong>Redis & BullMQ</strong> workers manage 15-minute booking hold expirations, notification email relays, and webhook event processing.</p>
    </div>
  </div>

  <h2>2.2 Cryptographic Security Vault & Authentication Engine</h2>
  <ul>
    <li><strong>AES-256-GCM Vault:</strong> All sensitive host financial records (bank account numbers) and identity credentials are encrypted at rest using AES-256-GCM. Ciphertext strings are stored in the format <code>\${iv}:\${ciphertext}:\${authTag}</code>. Tampering with either the tag or ciphertext throws an immediate cryptographic authentication error.</li>
    <li><strong>JWT HS256 with Device ID Binding:</strong> Issues short-lived access tokens (15-minute TTL) and rotating refresh tokens (7-day TTL) stored in secure, HttpOnly, SameSite=Lax cookies. Each token embeds a unique <code>deviceId</code> fingerprint.</li>
    <li><strong>FIFO Device Eviction Algorithm:</strong> Accounts are limited to a maximum of 3 concurrent active devices. Upon a 4th login, the oldest device record in <code>UserDevice</code> is automatically marked as <code>EVICTED</code>, terminating older sessions without blocking users with disruptive 409 errors.</li>
    <li><strong>Mutation Origin & CSRF Guard:</strong> Mutating HTTP methods (<code>POST</code>, <code>PUT</code>, <code>PATCH</code>, <code>DELETE</code>) validate incoming <code>Origin</code> and <code>Referer</code> headers against trusted whitelist domains and enforce cryptographic double-submit cookies.</li>
  </ul>
  `;
}
