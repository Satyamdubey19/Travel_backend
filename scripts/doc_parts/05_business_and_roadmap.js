export function getPart05(svgUnitEconomics) {
  return `
  <div class="page-break"></div>

  <!-- CHAPTER 09: BUSINESS MODEL & UNIT ECONOMICS -->
  <h1><span class="sec-num">09</span> Business Model, Commercial Monetization & Financial Unit Economics</h1>

  <p>
    Travels Pro operates as a capital-efficient, high-margin multi-sided marketplace charging variable take-rate commissions on completed customer transactions, augmented by listing promotion fees, traveler protection add-ons, and B2B corporate offsite packages.
  </p>

  <div class="diagram-container">
    ${svgUnitEconomics}
    <div class="diagram-caption">Figure 9.1: Waterfall Financial Ledger for a Standard ₹10,000 Group Tour Booking</div>
  </div>

  <h2>9.1 Multi-Vertical Monetization Structure</h2>
  <table>
    <thead><tr><th style="width: 25%;">Commerce Vertical</th><th style="width: 15%;">Take Rate (%)</th><th style="width: 20%;">Average Order Value</th><th style="width: 40%;">Value Justification & Host Economics</th></tr></thead>
    <tbody>
      <tr>
        <td><strong>Group Expeditions & Tours</strong></td>
        <td><strong>12.0%</strong></td>
        <td>₹12,500 / traveler</td>
        <td>High basket size, multi-day operations. Hosts benefit from centralized marketing, group chat coordination, and fraud-free payment collection.</td>
      </tr>
      <tr>
        <td><strong>Hyperlocal Activities</strong></td>
        <td><strong>15.0%</strong></td>
        <td>₹2,800 / participant</td>
        <td>High-frequency booking velocity, shorter booking windows. Platform provides dynamic calendar slot management and automated check-ins.</td>
      </tr>
      <tr>
        <td><strong>Vehicle Rentals & Fleet</strong></td>
        <td><strong>18.0%</strong></td>
        <td>₹7,500 / rental</td>
        <td>Higher take rate justified by the two-stage digital custody inspection system and damage dispute arbitration shielding host assets.</td>
      </tr>
    </tbody>
  </table>

  <h2>9.2 Waterfall Financial Unit Economics Comparison</h2>
  <table>
    <thead>
      <tr>
        <th>Financial Metric</th>
        <th>Sample Tour (₹10,000)</th>
        <th>Extended Expedition (₹25,000)</th>
        <th>Corporate Offsite (₹50,000)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Gross Merchandise Value (GMV)</strong></td>
        <td>₹10,000</td>
        <td>₹25,000</td>
        <td>₹50,000</td>
      </tr>
      <tr>
        <td><strong>Platform Take Rate</strong></td>
        <td>12.0% (₹1,200)</td>
        <td>12.0% (₹3,000)</td>
        <td>14.0% (₹7,000 with B2B SLA)</td>
      </tr>
      <tr>
        <td><strong>Payment Gateway Processing (2.0%)</strong></td>
        <td>(₹200)</td>
        <td>(₹500)</td>
        <td>(₹1,000)</td>
      </tr>
      <tr>
        <td><strong>SMS & Email Notification Unit Cost</strong></td>
        <td>(₹12)</td>
        <td>(₹18)</td>
        <td>(₹35)</td>
      </tr>
      <tr>
        <td><strong>Server & DB Infrastructure Allocation</strong></td>
        <td>(₹25)</td>
        <td>(₹45)</td>
        <td>(₹85)</td>
      </tr>
      <tr>
        <td><strong>Net Platform Contribution Margin</strong></td>
        <td><strong>₹963 (9.63%)</strong></td>
        <td><strong>₹2,437 (9.75%)</strong></td>
        <td><strong>₹5,880 (11.76%)</strong></td>
      </tr>
      <tr>
        <td><strong>Estimated Blended CAC</strong></td>
        <td>₹380</td>
        <td>₹650</td>
        <td>₹1,200</td>
      </tr>
      <tr>
        <td><strong>First-Order Payback Multiple</strong></td>
        <td><strong>2.53x</strong></td>
        <td><strong>3.75x</strong></td>
        <td><strong>4.90x</strong></td>
      </tr>
    </tbody>
  </table>

  <h2>9.3 Ancillary Revenue Streams & Float Yield</h2>
  <ul>
    <li><strong>Host Listing Promotion Subscriptions:</strong> Hosts can boost listing visibility to the top of search rankings and the homepage carousel via tiered monthly subscriptions (₹1,999/mo Silver, ₹4,999/mo Gold).</li>
    <li><strong>Traveler Flexible Cancellation Guarantee:</strong> An optional 4% cart add-on allowing 100% no-questions-asked refunds up to 12 hours prior to departure, underwritten into a high-margin platform insurance reserve.</li>
    <li><strong>Escrow Float Yield:</strong> Pre-payments collected 15&ndash;45 days in advance sit in interest-bearing treasury escrow accounts, generating 4.5%&ndash;6.0% annualized float yield.</li>
    <li><strong>B2B Corporate Retreat Packages:</strong> Tailored corporate packages bundled with GST-compliant corporate invoices, dedicated account managers, and priority vehicle fleets (commanding an average 14% net take rate).</li>
  </ul>

  <h2>9.4 Market Sizing: TAM / SAM / SOM Analysis</h2>
  <div class="grid-3">
    <div class="card">
      <div class="card-title">TAM: $32 Billion</div>
      <p>Total Indian experiential travel, leisure tourism, and car rental market projected by 2028 (growing at 16.4% CAGR).</p>
    </div>
    <div class="card">
      <div class="card-title">SAM: $5.8 Billion</div>
      <p>Tech-enabled domestic millennial and Gen-Z group adventure tours, weekend activity bookings, and self-drive car rentals.</p>
    </div>
    <div class="card">
      <div class="card-title">SOM: $87 Million</div>
      <p>Capturing 1.5% market share within 36 months, representing $87M GMV (~$11.3M Net Platform Revenue).</p>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- CHAPTER 10: PRODUCT ROADMAP -->
  <h1><span class="sec-num">10</span> Product Roadmap: Current Scope vs. Future Horizons</h1>

  <div class="grid-2">
    <div class="card" style="border-left: 4px solid var(--emerald);">
      <div class="card-title" style="color:var(--emerald);">PHASE 1: CURRENT PRODUCTION BASELINE (100% COMPLETED)</div>
      <p>✓ <strong>Multi-Vertical Supply Engine:</strong> Fully verified Group Tours, Hyperlocal Activities, and Car Rentals.</p>
      <p>✓ <strong>DPDP Act 2023 Consent:</strong> 5 standard policies with voluntary clickwrap checkboxes across signup, login, and all checkout pages.</p>
      <p>✓ <strong>6-Step Host KYC:</strong> Government ID regex checks, live camera selfie, and AES-256-GCM encrypted bank account storage.</p>
      <p>✓ <strong>Modern Host Studio UI:</strong> Rebuilt <code>/host/activities</code> and <code>/host/rentals</code> using unified <code>HostPage</code> and <code>HostSection</code>.</p>
      <p>✓ <strong>Full Automated Verification:</strong> 212 / 212 tests passed across Unit, Policy, OAuth, and Security test suites.</p>
      <p>✓ <strong>Zero-Error Production Builds:</strong> Next.js compiled all 47 frontend routes and 62 backend APIs with Turbopack in code 0.</p>
    </div>

    <div class="card" style="border-left: 4px solid var(--accent);">
      <div class="card-title" style="color:var(--accent);">PHASE 2: NEAR-TERM HORIZONS (Q4 2026 - Q1 2027)</div>
      <p>• <strong>Native iOS & Android Mobile Apps:</strong> React Native / Expo application with push notifications for instant trip circle alerts.</p>
      <p>• <strong>WhatsApp Business API:</strong> Automated itinerary delivery, booking confirmations, and host emergency broadcasts.</p>
      <p>• <strong>Instant UPI Payouts via RazorpayX:</strong> Real-time automated bank settlements directly to host accounts within 10 minutes of trip completion.</p>
      <p>• <strong>Multi-Language Localization:</strong> Hindi, Tamil, Telugu, and Spanish localization support across customer-facing search and booking wizards.</p>
    </div>
  </div>

  <div class="card" style="border-left: 4px solid var(--violet); margin-top: 14px;">
    <div class="card-title" style="color:var(--violet);">PHASE 3: LONG-TERM EXPANSION (2027+)</div>
    <p>• <strong>IoT Vehicle Telematics Integration:</strong> Keyless smartphone unlock and automated fuel/odometer synchronization via OBD-II Bluetooth devices, eliminating manual inspection errors.</p>
    <p>• <strong>AI-Powered Itinerary Co-Pilot:</strong> Multi-modal travel planning assistant generating customized multi-day travel itineraries based on traveler preferences, weather forecasts, and dynamic budget constraints.</p>
    <p>• <strong>Cross-Border Currency & Escrow:</strong> International traveler booking with multi-currency conversion (USD, EUR, GBP) and Stripe Global Treasury payouts.</p>
  </div>

  <div class="page-break"></div>

  <!-- CHAPTER 11: RETROSPECTIVE & WHAT TO MAKE AGAIN -->
  <h1><span class="sec-num">11</span> Retrospective & "What to Make Again" (Scaling Guidance)</h1>

  <p>
    A critical engineering reflection on architectural trade-offs, lessons learned, and precise guidance on how to re-architect or refactor modules when scaling 10x from current production.
  </p>

  <h2>11.1 Engineering Retrospective: Key Architectural Reflections</h2>
  <div class="grid-2">
    <div class="card">
      <div class="card-title">1. Monolith vs Decoupled Microservices</div>
      <p><strong>Reflection:</strong> Combining frontend and backend in adjacent Next.js folders allowed rapid development and shared types. However, at scale (&gt;100k DAU), long-lived WebSocket connections (Trip Circles) and heavy background jobs (PDF generation, email relay) compete with API threads.</p>
      <p><strong>Guidance:</strong> Decouple the Socket.IO server into a dedicated lightweight Node.js/Go cluster on AWS ECS or Fly.io using Redis Pub/Sub for horizontal scaling.</p>
    </div>
    <div class="card">
      <div class="card-title">2. Database Connection Pooling & Read Replicas</div>
      <p><strong>Reflection:</strong> Neon serverless PostgreSQL handles schema migrations and auto-scaling well, but rapid spike traffic during promotional tour releases causes connection pool pressure.</p>
      <p><strong>Guidance:</strong> Implement PgBouncer transaction-mode pooling and split read queries (catalog search, public reviews) to Neon read replicas, reserving primary write nodes for financial transactions.</p>
    </div>
  </div>

  <div class="grid-2">
    <div class="card">
      <div class="card-title">3. Inventory Concurrency & Distributed Locks</div>
      <p><strong>Reflection:</strong> Current <code>BookingIntent</code> holds inventory via database timestamps. Under millisecond-level race conditions for the last slot on a high-demand tour, database row locking incurs overhead.</p>
      <p><strong>Guidance:</strong> Use Redis <code>Redlock</code> distributed locks with a 15-minute TTL. Once a user initiates checkout, atomically decrement available inventory in Redis before confirming in PostgreSQL.</p>
    </div>
    <div class="card">
      <div class="card-title">4. Event-Driven Architecture with BullMQ</div>
      <p><strong>Reflection:</strong> Several webhook handlers and notification delivery triggers execute synchronously within the HTTP request cycle.</p>
      <p><strong>Guidance:</strong> Shift all non-blocking operations (Brevo emails, audit logging, SMS notifications) into decoupled BullMQ job queues, ensuring API response times remain under 50ms.</p>
    </div>
  </div>

  <h2>11.2 Engineering Refactoring Priority Matrix</h2>
  <table>
    <thead><tr><th>Subsystem</th><th>Current Architecture</th><th>Target High-Scale Architecture</th><th>Priority</th></tr></thead>
    <tbody>
      <tr>
        <td><strong>WebSockets & Chat</strong></td>
        <td>In-process Socket.IO server</td>
        <td>Standalone Go/Node cluster with Redis Pub/Sub adapter</td>
        <td><span class="pill pill-amber">High Priority</span></td>
      </tr>
      <tr>
        <td><strong>Database Scaling</strong></td>
        <td>Direct Prisma ORM connection</td>
        <td>Read/Write splitting with read replicas & PgBouncer pooling</td>
        <td><span class="pill pill-amber">High Priority</span></td>
      </tr>
      <tr>
        <td><strong>Inventory Locking</strong></td>
        <td>DB-level <code>BookingIntent</code> rows</td>
        <td>Redis Redlock distributed atomic reservation counters</td>
        <td><span class="pill pill-emerald">Medium Priority</span></td>
      </tr>
      <tr>
        <td><strong>Vehicle Inspection</strong></td>
        <td>Manual photo upload & text readings</td>
        <td>OCR-based odometer recognition & AI scratch detection</td>
        <td><span class="pill pill-violet">Future Phase</span></td>
      </tr>
      <tr>
        <td><strong>Mobile App Shell</strong></td>
        <td>Responsive Next.js PWA</td>
        <td>Native iOS / Android apps via React Native & Expo</td>
        <td><span class="pill pill-cyan">Immediate</span></td>
      </tr>
    </tbody>
  </table>

  <div class="page-break"></div>

  <!-- CHAPTER 12: PRODUCTION VERIFICATION APPENDIX -->
  <h1><span class="sec-num">12</span> Production Verification & Test Evidence Appendix</h1>

  <p>
    The platform has undergone full automated test verification across 4 distinct test suites covering unit logic, DPDP Act clickwrap consent, Google OAuth authentication, and security hardening.
  </p>

  <h2>12.1 Automated Test Execution Summary (212 / 212 Passing Tests)</h2>
  <table>
    <thead><tr><th style="width: 25%;">Test Suite</th><th style="width: 15%;">Passing Tests</th><th style="width: 20%;">Execution Duration</th><th style="width: 40%;">Core Verified Invariants</th></tr></thead>
    <tbody>
      <tr>
        <td><strong>Backend Unit Suite</strong><br/><code>npm test</code></td>
        <td><strong>108 / 108</strong></td>
        <td>49.4s</td>
        <td>Pricing calculation, inventory decrement, exclusive return dates, Trip Circle authorization, SSO AES-256-GCM vault.</td>
      </tr>
      <tr>
        <td><strong>Policy & KYC Suite</strong><br/><code>test-policy-and-kyc-suite.ts</code></td>
        <td><strong>44 / 44</strong></td>
        <td>28.2s</td>
        <td>5 active policies, signup clickwrap, login force re-consent, 6-step KYC, bank AES-256-GCM encryption, admin audit trail.</td>
      </tr>
      <tr>
        <td><strong>Google OAuth Suite</strong><br/><code>test-oauth-full-suite.ts</code></td>
        <td><strong>40 / 40</strong></td>
        <td>18.5s</td>
        <td>CSRF tokens, OAuth 307 handoffs, user auto-provisioning, refresh token rotation, FIFO device auto-eviction (max 3).</td>
      </tr>
      <tr>
        <td><strong>Security Hardening Suite</strong><br/><code>test-security-hardening.ts</code></td>
        <td><strong>20 / 20</strong></td>
        <td>6.8s</td>
        <td>Alg:none token rejection, secret tampering defense, untrusted origin mutation blocking, rate limiting, security headers.</td>
      </tr>
      <tr>
        <td><strong>TOTAL VERIFIED</strong></td>
        <td><strong>212 / 212 (100%)</strong></td>
        <td><strong>102.9s</strong></td>
        <td><strong>Zero regressions across all platform verticals and governance portals.</strong></td>
      </tr>
    </tbody>
  </table>

  <h2>12.2 Production Build & Static Compilation Report</h2>
  <ul>
    <li><strong><code>Travels_frontend</code>:</strong> <code>next build</code> compiled all <strong>47 routes</strong> cleanly with Turbopack in 57 seconds with <strong>Code 0</strong>.</li>
    <li><strong><code>Travels_backend</code>:</strong> <code>next build</code> compiled all <strong>62 API routes</strong> cleanly with Turbopack in 16.8 seconds with <strong>Code 0</strong>.</li>
    <li><strong>TypeScript Compiler:</strong> <code>npx tsc --noEmit</code> exited with <strong>0 errors</strong> on both frontend and backend.</li>
    <li><strong>Live HTTP Route Verification:</strong> 40/40 tested endpoints returning <strong>200 OK</strong>.</li>
  </ul>

  <!-- SIGN OFF BOX -->
  <div style="margin-top: 36px; padding: 20px; border-radius: 12px; background: var(--slate-900); color: white; text-align: center;">
    <h3 style="color: white; margin-bottom: 6px;">Travels Pro System Blueprint: Production Verified & Certified</h3>
    <p style="color: #94a3b8; font-size: 11px; margin-bottom: 0;">
      All 212 automated tests passed (100%). 47 frontend routes & 62 backend APIs compiling clean with zero errors. System certified ready for enterprise commercial deployment.
    </p>
  </div>
  `;
}
