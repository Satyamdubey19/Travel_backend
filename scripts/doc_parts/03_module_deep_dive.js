export function getPart03() {
  return `
  <div class="page-break"></div>

  <!-- CHAPTER 06: CORE MODULE SPECIFICATIONS -->
  <h1><span class="sec-num">06</span> Core Subsystems Technical Deep Dive (What, When, How & Schemas)</h1>

  <p>
    This chapter provides an exhaustive technical specification of the <strong>10 core operational subsystems</strong> powering Travels Pro. Each module is documented across its architectural responsibility, trigger lifecycles, execution algorithms, request/response JSON schemas, state machines, concurrency controls, and failure recovery modes.
  </p>

  <!-- MODULE 1 -->
  <div class="card avoid-break" style="margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: var(--accent); font-size: 15px;">6.1 Module 1: Zero-Trust Authentication, Session & FIFO Device Eviction</h2>
    <table>
      <thead><tr><th style="width: 20%;">Dimension</th><th>Engineering Specification</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>WHAT</strong></td>
          <td>Enterprise identity gateway managing credential authentication (bcrypt cost 12), NextAuth Google OAuth 2.0 handoffs, short-lived JWT access tokens, rotating refresh tokens, and strict 3-device maximum concurrent session governance.</td>
        </tr>
        <tr>
          <td><strong>WHEN</strong></td>
          <td>Triggered during user login (<code>/api/auth/login</code>), registration (<code>/api/auth/register</code>), Google OAuth callback (<code>/api/auth/google-login</code>), token refresh (<code>/api/auth/refresh</code>), and device management (<code>/api/auth/devices</code>).</td>
        </tr>
        <tr>
          <td><strong>HOW (Step-by-Step)</strong></td>
          <td>
            1. <strong>Credential Verification:</strong> Validates email format and asserts password &ge; 12 characters. Compares incoming password against <code>passwordHash</code> via constant-time bcrypt algorithm.<br/>
            2. <strong>FIFO Device Auto-Eviction:</strong> Queries <code>UserDevice</code> for existing active records. If active device count equals 3, the oldest device record (lowest <code>lastActiveAt</code>) is marked <code>status = EVICTED</code>, its corresponding refresh token is revoked in Redis/PostgreSQL, and the new device is inserted.<br/>
            3. <strong>Cryptographic Token Issuance:</strong> Generates a 15-minute HS256 JWT access token embedding <code>userId</code>, <code>role</code>, <code>email</code>, <code>sessionId</code>, and <code>deviceId</code>. Generates a cryptographically random 256-bit refresh token (7-day TTL) stored in secure, HttpOnly, SameSite=Lax cookie.<br/>
            4. <strong>Security Defense:</strong> Alg:none and asymmetric key confusion attacks are blocked by strict algorithm enforcement. Replay of revoked refresh tokens immediately invalidates the entire token family.
          </td>
        </tr>
        <tr>
          <td><strong>INPUT PAYLOAD (Request)</strong></td>
          <td>
            <pre><code>{
  "email": "traveler@example.com",     // string, email format
  "password": "Password123!@#",        // string, min 12 chars
  "deviceId": "web-chrome-mac-893f",   // string, unique client fingerprint
  "userAgent": "Mozilla/5.0 ...",      // string, browser user-agent
  "ipAddress": "103.21.124.55"         // string, IPv4/IPv6 client IP
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>OUTPUT PAYLOAD (Response)</strong></td>
          <td>
            <pre><code>{
  "success": true,
  "data": {
    "user": { "id": "usr_99f2a", "email": "traveler@example.com", "name": "Aarav Sharma", "role": "USER" },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "expiresIn": 900,
    "activeDevices": 3,
    "evictedDeviceId": "web-safari-ios-112a" // null if under 3 devices
  }
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>STATE MACHINE</strong></td>
          <td><code>ACTIVE</code> &rarr; <code>EXPIRED</code> (TTL elapsed) | <code>ACTIVE</code> &rarr; <code>EVICTED</code> (4th device login) | <code>ACTIVE</code> &rarr; <code>REVOKED</code> (manual user logout or security breach).</td>
        </tr>
        <tr>
          <td><strong>CONCURRENCY CONTROLS</strong></td>
          <td>Concurrent logins across multiple tabs serialize on a row-level lock (<code>SELECT ... FOR UPDATE</code>) on <code>UserDevice</code> within a PostgreSQL transaction to prevent race-condition bypass of the 3-device limit.</td>
        </tr>
        <tr>
          <td><strong>FAILURE & FALLBACK</strong></td>
          <td>If Redis session cache is unreachable, authentication falls back gracefully to direct PostgreSQL database verification.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- MODULE 2 -->
  <div class="card avoid-break" style="margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: var(--accent); font-size: 15px;">6.2 Module 2: Enterprise SSO & SAML 2.0 / OIDC Identity Federation</h2>
    <table>
      <thead><tr><th style="width: 20%;">Dimension</th><th>Engineering Specification</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>WHAT</strong></td>
          <td>B2B identity federation subsystem enabling corporate enterprise accounts to authenticate employees through Okta, Microsoft Entra ID (Azure AD), Google Workspace, or Ping Identity.</td>
        </tr>
        <tr>
          <td><strong>WHEN</strong></td>
          <td>Initiated when an enterprise user accesses <code>/api/auth/sso/authorize</code> or returns via IdP callback to <code>/api/auth/sso/callback</code>.</td>
        </tr>
        <tr>
          <td><strong>HOW (Step-by-Step)</strong></td>
          <td>
            1. <strong>Domain Discovery:</strong> Resolves enterprise tenant from email domain (e.g. <code>@deloitte.com</code>) by querying <code>Organization.domain</code>.<br/>
            2. <strong>AuthnRequest Generation:</strong> Formulates Deflated, Base64-encoded XML SAML 2.0 AuthnRequest with HMAC-signed tamper-evident <code>RelayState</code>.<br/>
            3. <strong>Assertion Consumer Service (ACS):</strong> Parses signed SAML XML assertion, validates X.509 certificate signatures against stored IdP public keys, verifies <code>NotBefore</code> and <code>NotOnOrAfter</code> timestamps.<br/>
            4. <strong>Automated JIT Provisioning:</strong> Just-In-Time provisions user in PostgreSQL, assigns corporate travel policy roles, and maps enterprise cost-center metadata.
          </td>
        </tr>
        <tr>
          <td><strong>INPUT PAYLOAD (Request)</strong></td>
          <td>
            <pre><code>{
  "SAMLResponse": "PHNhbWxwOlJlc3BvbnNlIHhtbG5z...", // Base64 encoded XML
  "RelayState": "hmac_signed_state_nonce_99182a"       // Tamper-evident CSRF state
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>OUTPUT PAYLOAD (Response)</strong></td>
          <td>
            <pre><code>{
  "success": true,
  "data": {
    "user": { "id": "usr_sso_881", "email": "employee@corp.com", "role": "USER" },
    "orgId": "org_deloitte_india",
    "sessionToken": "sso_sess_9912a441"
  }
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>CONCURRENCY CONTROLS</strong></td>
          <td>JIT user provisioning utilizes PostgreSQL <code>ON CONFLICT (email) DO UPDATE</code> to eliminate duplicate user creation during parallel SSO callbacks.</td>
        </tr>
        <tr>
          <td><strong>FAILURE & FALLBACK</strong></td>
          <td>Expired SAML assertions return HTTP 401 <code>SSO_ASSERTION_EXPIRED</code> with an automated redirect back to the enterprise IdP sign-in gateway.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- MODULE 3 -->
  <div class="card avoid-break" style="margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: var(--accent); font-size: 15px;">6.3 Module 3: Statutory DPDP Act 2023 Clickwrap & Legal Policy CMS</h2>
    <table>
      <thead><tr><th style="width: 20%;">Dimension</th><th>Engineering Specification</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>WHAT</strong></td>
          <td>Regulatory legal consent engine enforcing explicit, voluntary clickwrap confirmations complying with India's Digital Personal Data Protection Act, 2023. Manages versioned policies and blocking re-consent prompts.</td>
        </tr>
        <tr>
          <td><strong>WHEN</strong></td>
          <td>Executes on user signup, host KYC onboarding, booking checkout, and upon administrative publishing of revised policy versions.</td>
        </tr>
        <tr>
          <td><strong>HOW (Step-by-Step)</strong></td>
          <td>
            1. <strong>Voluntary Clickwrap Enforcement:</strong> Pre-checked consent boxes are strictly prohibited by code. Checkboxes render unchecked.<br/>
            2. <strong>Immutable Audit Recording:</strong> When a user consents, <code>/api/policies/consent</code> writes an immutable record to <code>PolicyConsent</code> with fields: <code>userId</code>, <code>policyId</code>, <code>version</code>, <code>ipAddress</code>, <code>userAgent</code>, and <code>context</code> (<code>SIGNUP</code>, <code>HOST_KYC</code>, <code>BOOKING</code>).<br/>
            3. <strong>Dynamic Version Bumping:</strong> When an administrator edits policy text in <code>/admin/policies</code> and increments version (e.g. v1.0 &rarr; v1.1), subsequent login requests detect missing v1.1 consent, return <code>reconsentRequired: true</code>, and activate the blocking <code>PolicyConsentModal</code>.
          </td>
        </tr>
        <tr>
          <td><strong>INPUT PAYLOAD (Request)</strong></td>
          <td>
            <pre><code>{
  "policyId": "pol_traveler_safety_v1",
  "version": "1.1",
  "context": "BOOKING",
  "consented": true
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>OUTPUT PAYLOAD (Response)</strong></td>
          <td>
            <pre><code>{
  "success": true,
  "data": {
    "consentId": "cns_991823a",
    "policyType": "TRAVELER_SAFETY_POLICY",
    "version": "1.1",
    "consentedAt": "2026-09-23T20:45:00.000Z"
  }
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>CONCURRENCY CONTROLS</strong></td>
          <td>Compound database index on <code>[userId, policyId, version]</code> with unique constraint prevents duplicate consent records under rapid multi-clicks.</td>
        </tr>
        <tr>
          <td><strong>FAILURE & FALLBACK</strong></td>
          <td>Direct API mutations executed without active consent are intercepted by server middleware and aborted with HTTP 403 <code>POLICY_RECONSENT_REQUIRED</code>.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- MODULE 4 -->
  <div class="card avoid-break" style="margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: var(--accent); font-size: 15px;">6.4 Module 4: 6-Stage Host KYC & Encrypted PII/Bank Vault</h2>
    <table>
      <thead><tr><th style="width: 20%;">Dimension</th><th>Engineering Specification</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>WHAT</strong></td>
          <td>Host vetting engine verifying legal identity, date of birth, PAN/GSTIN, live biometric selfie holding ID, and AES-256-GCM encrypted bank account storage.</td>
        </tr>
        <tr>
          <td><strong>WHEN</strong></td>
          <td>Invoked during host application submission (<code>/api/host/kyc</code>) and administrative KYC adjudication (<code>/api/admin/kyc/[id]</code>).</td>
        </tr>
        <tr>
          <td><strong>HOW (Step-by-Step)</strong></td>
          <td>
            1. <strong>Statutory Input Sanitization:</strong> Verifies applicant is &ge; 18 years old. Validates PAN regex (<code>^[A-Z]{5}[0-9]{4}[A-Z]{1}$</code>) and Aadhaar 12-digit format.<br/>
            2. <strong>Binary Magic-Byte File Scanning:</strong> Inspects uploaded image bytes to verify legitimate JPEG/PNG signatures, preventing executable code injection.<br/>
            3. <strong>AES-256-GCM Bank Encryption:</strong> Host bank account numbers are encrypted in memory using AES-256-GCM prior to database insertion. Stored as <code>\${iv}:\${ciphertext}:\${authTag}</code>. Database queries return only masked strings (<code>•••• •••• 5678</code>).<br/>
            4. <strong>Admin Adjudication:</strong> Admin adjudicators review credentials in a dual-pane console. Approving application automatically sets <code>Host.isVerified = true</code> and promotes user role from <code>USER</code> to <code>HOST</code>.
          </td>
        </tr>
        <tr>
          <td><strong>INPUT PAYLOAD (Request)</strong></td>
          <td>
            <pre><code>{
  "hostType": "INDIVIDUAL",
  "panNumber": "ABCDE1234F",
  "idType": "AADHAAR",
  "idFrontUrl": "https://cdn.travelspro.com/kyc/front_9918.jpg",
  "selfieUrl": "https://cdn.travelspro.com/kyc/selfie_9918.jpg",
  "bankAccountNumber": "91823746192837",
  "bankIfsc": "HDFC0001234",
  "bankName": "HDFC Bank Ltd"
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>OUTPUT PAYLOAD (Response)</strong></td>
          <td>
            <pre><code>{
  "success": true,
  "data": {
    "kycId": "kyc_88192a",
    "status": "PENDING_REVIEW",
    "bankAccountMasked": "•••• •••• 2837",
    "submittedAt": "2026-09-23T20:50:00.000Z"
  }
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>STATE MACHINE</strong></td>
          <td><code>DRAFT</code> &rarr; <code>PENDING_REVIEW</code> &rarr; <code>APPROVED</code> (Promoted to HOST) | <code>REJECTED</code> (Reason provided, host resubmits) | <code>SUSPENDED</code>.</td>
        </tr>
        <tr>
          <td><strong>CONCURRENCY CONTROLS</strong></td>
          <td>Host KYC table maintains a unique constraint on <code>userId</code> to ensure a user cannot have multiple simultaneous pending dossiers.</td>
        </tr>
        <tr>
          <td><strong>FAILURE & FALLBACK</strong></td>
          <td>Cryptographic verification tag failures throw structured <code>CryptoIntegrityError</code>; plain-text credentials are never written to error logs.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- MODULE 5 -->
  <div class="card avoid-break" style="margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: var(--accent); font-size: 15px;">6.5 Module 5: Multi-Day Group Tours & Departure Batch Scheduling Engine</h2>
    <table>
      <thead><tr><th style="width: 20%;">Dimension</th><th>Engineering Specification</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>WHAT</strong></td>
          <td>Expedition scheduling system managing multi-day itineraries, discrete departure batches, seat capacity quotas, waitlist queues, and automated seat replenishment.</td>
        </tr>
        <tr>
          <td><strong>WHEN</strong></td>
          <td>Executes during tour authoring in Host Studio, catalog search, booking checkout, and cancellation workflows.</td>
        </tr>
        <tr>
          <td><strong>HOW (Step-by-Step)</strong></td>
          <td>
            1. <strong>Itinerary Modeling:</strong> Persists day-by-day activities to <code>TourItineraryDay</code> linked to parent <code>Tour</code>.<br/>
            2. <strong>Batch Scheduling:</strong> Hosts define departure batches (<code>TourBatch</code>) with independent <code>totalSlots</code> and <code>availableSlots</code>.<br/>
            3. <strong>Reservation Locking:</strong> Checkout creates an atomic <code>BookingIntent</code> lock, decrementing <code>availableSlots</code> for 15 minutes.<br/>
            4. <strong>Automated Waitlist Escalation:</strong> When a batch reaches 0 available slots, travelers can join <code>WaitlistQueue</code>. If a confirmed booking is cancelled, the first waitlisted user receives an exclusive 2-hour reservation window via SMS/Email.
          </td>
        </tr>
        <tr>
          <td><strong>INPUT PAYLOAD (Request)</strong></td>
          <td>
            <pre><code>{
  "tourId": "tur_himalayan_trek_99",
  "batchId": "btc_oct_15_2026",
  "guestCount": 2,
  "travelers": [
    { "name": "Aarav Sharma", "age": 28, "gender": "MALE", "idNumber": "AADHAAR_9918" },
    { "name": "Priya Patel", "age": 26, "gender": "FEMALE", "idNumber": "AADHAAR_9919" }
  ],
  "emergencyContact": { "name": "Vikram Sharma", "phone": "9876543210" }
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>OUTPUT PAYLOAD (Response)</strong></td>
          <td>
            <pre><code>{
  "success": true,
  "data": {
    "bookingCode": "TRV-TOUR-8819",
    "status": "PENDING",
    "totalAmount": 24999.00,
    "currency": "INR",
    "lockExpiresAt": "2026-09-23T21:10:00.000Z"
  }
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>STATE MACHINE</strong></td>
          <td><code>PENDING</code> (15m intent) &rarr; <code>CONFIRMED</code> (payment success) &rarr; <code>COMPLETED</code> (tour ended) | <code>CANCELLED</code> (refund processed).</td>
        </tr>
        <tr>
          <td><strong>CONCURRENCY CONTROLS</strong></td>
          <td>Slot decrements execute inside a PostgreSQL transaction using <code>UPDATE "TourBatch" SET "availableSlots" = "availableSlots" - $1 WHERE id = $2 AND "availableSlots" >= $1</code>, preventing overbooking.</td>
        </tr>
        <tr>
          <td><strong>FAILURE & FALLBACK</strong></td>
          <td>If payment fails or expires, a scheduled BullMQ worker automatically replenishes available slots back to the batch.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- MODULE 6 -->
  <div class="card avoid-break" style="margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: var(--accent); font-size: 15px;">6.6 Module 6: Hyperlocal Activities & Slot Scheduling Engine</h2>
    <table>
      <thead><tr><th style="width: 20%;">Dimension</th><th>Engineering Specification</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>WHAT</strong></td>
          <td>Hyperlocal experience scheduling system managing recurring daily time slots (e.g. Scuba, Paragliding, Cooking Classes), participant quotas, and instant booking confirmations.</td>
        </tr>
        <tr>
          <td><strong>WHEN</strong></td>
          <td>Operates during host activity authoring, slot calendar generation, traveler checkout, and weather advisory alerts.</td>
        </tr>
        <tr>
          <td><strong>HOW (Step-by-Step)</strong></td>
          <td>
            1. <strong>Slot Recurrence Generator:</strong> Generates daily time-slot templates (<code>ActivitySlot</code>) with defined <code>startTime</code>, <code>endTime</code>, and <code>capacity</code>.<br/>
            2. <strong>Atomic Capacity Locking:</strong> Checkout decrements <code>availableSlots</code> atomically.<br/>
            3. <strong>Weather Emergency Halts:</strong> In case of adverse weather (e.g. high winds for paragliding), host can issue an emergency halt flag, triggering automatic 100% refund calculations for affected slot holders.
          </td>
        </tr>
        <tr>
          <td><strong>INPUT PAYLOAD (Request)</strong></td>
          <td>
            <pre><code>{
  "activityId": "act_scuba_goa_11",
  "slotId": "slt_morning_0900",
  "guestCount": 3,
  "date": "2026-10-10"
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>OUTPUT PAYLOAD (Response)</strong></td>
          <td>
            <pre><code>{
  "success": true,
  "data": {
    "bookingCode": "TRV-ACT-1192",
    "status": "CONFIRMED",
    "subtotal": 7500.00,
    "taxes": 1350.00,
    "totalAmount": 8850.00
  }
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>CONCURRENCY CONTROLS</strong></td>
          <td>Row-level lock on <code>ActivitySlot</code> enforces capacity boundaries without phantom reads.</td>
        </tr>
        <tr>
          <td><strong>FAILURE & FALLBACK</strong></td>
          <td>Host cancellations immediately credit the traveler's original payment method via Razorpay Refunds API without cancellation penalties.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- MODULE 7 -->
  <div class="card avoid-break" style="margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: var(--accent); font-size: 15px;">6.7 Module 7: Car & Bike Rentals & Two-Stage Custody Handover</h2>
    <table>
      <thead><tr><th style="width: 20%;">Dimension</th><th>Engineering Specification</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>WHAT</strong></td>
          <td>Fleet mobility operations engine enforcing statutory Registration Certificate (RC) validation, refundable security deposits, and a two-stage photographic custody handover system.</td>
        </tr>
        <tr>
          <td><strong>WHEN</strong></td>
          <td>Stage 1 executes at physical vehicle collection (Pickup); Stage 2 executes at physical vehicle return (Drop-off).</td>
        </tr>
        <tr>
          <td><strong>HOW (Step-by-Step)</strong></td>
          <td>
            1. <strong>Pre-Trip Handover (Stage 1):</strong> Host logs starting odometer reading and fuel level percentage, capturing 4 mandatory photos (Front, Rear, Left, Right). Traveler verifies on smartphone and enters digital PIN/signature to accept custody. Transitions booking to <code>ACTIVE</code>.<br/>
            2. <strong>Post-Trip Handover (Stage 2):</strong> Host logs return odometer, checks fuel level, and captures return condition photos.<br/>
            3. <strong>Deposit Settlement:</strong> If readings match agreed terms and no damage is logged, the security deposit is automatically refunded. If damage is reported, the case escalates to the Admin Dispute Desk with cryptographic timestamps.
          </td>
        </tr>
        <tr>
          <td><strong>INPUT PAYLOAD (Request)</strong></td>
          <td>
            <pre><code>{
  "bookingId": "rnt_bk_99182",
  "stage": "PICKUP",
  "odometerReading": 45210,
  "fuelPercentage": 100,
  "photoUrls": [
    "https://cdn.travelspro.com/custody/front_9918.jpg",
    "https://cdn.travelspro.com/custody/rear_9918.jpg",
    "https://cdn.travelspro.com/custody/left_9918.jpg",
    "https://cdn.travelspro.com/custody/right_9918.jpg"
  ],
  "travelerSignaturePin": "8921"
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>OUTPUT PAYLOAD (Response)</strong></td>
          <td>
            <pre><code>{
  "success": true,
  "data": {
    "inspectionId": "ins_pickup_8819",
    "bookingStatus": "ACTIVE",
    "custodyAcceptedAt": "2026-09-23T21:00:00.000Z"
  }
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>STATE MACHINE</strong></td>
          <td><code>CONFIRMED</code> &rarr; <code>ACTIVE</code> (Pickup inspection signed) &rarr; <code>RETURN_INSPECTED</code> &rarr; <code>COMPLETED</code> (Deposit released) | <code>DISPUTED</code> (Damage claim).</td>
        </tr>
        <tr>
          <td><strong>CONCURRENCY CONTROLS</strong></td>
          <td>PostgreSQL unique constraint on <code>[bookingId, stage]</code> guarantees that an inspection stage cannot be recorded multiple times.</td>
        </tr>
        <tr>
          <td><strong>FAILURE & FALLBACK</strong></td>
          <td>Failure of host to record Stage 1 pickup photos legally bars host from claiming pre-existing scratches or damage upon return.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- MODULE 8 -->
  <div class="card avoid-break" style="margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: var(--accent); font-size: 15px;">6.8 Module 8: Booking Intent, Inventory Lock & Razorpay Payment Escrow</h2>
    <table>
      <thead><tr><th style="width: 20%;">Dimension</th><th>Engineering Specification</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>WHAT</strong></td>
          <td>Transaction orchestrator managing 15-minute temporary inventory locks, Razorpay payment order creation, HMAC-SHA256 signature verification, and automated escrow holdings.</td>
        </tr>
        <tr>
          <td><strong>WHEN</strong></td>
          <td>Active during checkout initiation, payment completion, and asynchronous Razorpay webhook delivery.</td>
        </tr>
        <tr>
          <td><strong>HOW (Step-by-Step)</strong></td>
          <td>
            1. <strong>Order Generation:</strong> Generates Razorpay Order ID via API with amount in paise (1 INR = 100 paise), attaching <code>bookingCode</code> as receipt.<br/>
            2. <strong>HMAC Signature Verification:</strong> Computes <code>crypto.createHmac('sha256', secret).update(order_id + '|' + payment_id).digest('hex')</code> and asserts exact match against incoming client signature.<br/>
            3. <strong>Idempotent Webhook Processing:</strong> Webhook processor verifies <code>X-Razorpay-Signature</code>, logs payload to <code>PaymentWebhookEvent</code>, and transitions booking status to <code>CONFIRMED</code> within a database transaction.
          </td>
        </tr>
        <tr>
          <td><strong>INPUT PAYLOAD (Request)</strong></td>
          <td>
            <pre><code>{
  "razorpay_order_id": "order_EKfMR192837",
  "razorpay_payment_id": "pay_29384710293",
  "razorpay_signature": "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d...",
  "idempotencyKey": "idem_88192a_99182"
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>OUTPUT PAYLOAD (Response)</strong></td>
          <td>
            <pre><code>{
  "success": true,
  "data": {
    "paymentId": "pay_internal_9918",
    "bookingStatus": "CONFIRMED",
    "amountPaid": 24999.00,
    "escrowStatus": "HELD"
  }
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>CONCURRENCY CONTROLS</strong></td>
          <td>Unique index on <code>idempotencyKey</code> prevents double-capture or duplicate booking creation under flaky mobile network retries.</td>
        </tr>
        <tr>
          <td><strong>FAILURE & FALLBACK</strong></td>
          <td>Payment authorization failures immediately rollback the <code>BookingIntent</code>, restoring inventory to the public catalog.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- MODULE 9 -->
  <div class="card avoid-break" style="margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: var(--accent); font-size: 15px;">6.9 Module 9: Trip Circles Real-Time WebSocket Communication</h2>
    <table>
      <thead><tr><th style="width: 20%;">Dimension</th><th>Engineering Specification</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>WHAT</strong></td>
          <td>Private, authenticated WebSocket chat cluster allowing confirmed tour participants and their verified host to coordinate logistics, share itineraries, and broadcast announcements.</td>
        </tr>
        <tr>
          <td><strong>WHEN</strong></td>
          <td>Active continuously from booking confirmation through post-trip completion.</td>
        </tr>
        <tr>
          <td><strong>HOW (Step-by-Step)</strong></td>
          <td>
            1. <strong>Cookie-Based WebSocket Auth:</strong> Socket.IO handshake validates <code>travels_session</code> JWT cookie; rejects unauthorized connections.<br/>
            2. <strong>Dynamic Room Membership:</strong> Validates user has a confirmed booking for the target tour; joins socket to room <code>tour-\${tourId}</code>.<br/>
            3. <strong>Message Delivery & Persistence:</strong> Broadcasts messages to active room sockets and asynchronously writes to <code>TourMessage</code> with delivery timestamps.<br/>
            4. <strong>Moderation & Reporting:</strong> Travelers can report abusive messages, triggering automated admin notification and shadowban flags.
          </td>
        </tr>
        <tr>
          <td><strong>INPUT PAYLOAD (Socket Event: send_message)</strong></td>
          <td>
            <pre><code>{
  "tourId": "tur_himalayan_trek_99",
  "content": "What is the recommended footwear for Day 3?",
  "type": "TEXT" // TEXT | IMAGE | ANNOUNCEMENT
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>OUTPUT PAYLOAD (Socket Event: new_message)</strong></td>
          <td>
            <pre><code>{
  "messageId": "msg_88192a",
  "tourId": "tur_himalayan_trek_99",
  "sender": { "id": "usr_99", "name": "Aarav Sharma", "role": "USER" },
  "content": "What is the recommended footwear for Day 3?",
  "timestamp": "2026-09-23T21:05:00.000Z"
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>CONCURRENCY CONTROLS</strong></td>
          <td>Redis Pub/Sub adapter coordinates WebSocket messaging across multi-instance serverless deployments without cross-server message drops.</td>
        </tr>
        <tr>
          <td><strong>FAILURE & FALLBACK</strong></td>
          <td>If WebSocket connection drops, client automatically falls back to long-polling and syncs missed messages via <code>/api/tour/[id]/chat</code>.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- MODULE 10 -->
  <div class="card avoid-break" style="margin-bottom: 20px;">
    <h2 style="margin-top: 0; color: var(--accent); font-size: 15px;">6.10 Module 10: Safety Incidents, SOS Telemetry & Governance</h2>
    <table>
      <thead><tr><th style="width: 20%;">Dimension</th><th>Engineering Specification</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>WHAT</strong></td>
          <td>Emergency safety dispatch engine managing one-tap SOS alerts, emergency contact SMS broadcasts, GPS telemetry tracking, and administrative dispute mediation.</td>
        </tr>
        <tr>
          <td><strong>WHEN</strong></td>
          <td>Triggered when a traveler activates SOS (<code>/safety/sos</code>), reports an incident (<code>/api/incidents</code>), or disputes a rental damage charge.</td>
        </tr>
        <tr>
          <td><strong>HOW (Step-by-Step)</strong></td>
          <td>
            1. <strong>SOS Dispatch:</strong> Captures high-accuracy GPS coordinates, dispatches automated SMS via Twilio/Brevo to emergency contacts, and creates a P0 Critical <code>Incident</code> in PostgreSQL.<br/>
            2. <strong>Admin Mission Control Alert:</strong> Real-time WebSocket triggers audio alarm and modal popup on active admin dashboards.<br/>
            3. <strong>Dispute Resolution Ledger:</strong> For financial disputes, admins inspect pre/post inspection photos, authorize partial or full refunds, and log immutable decisions to <code>AuditLog</code>.
          </td>
        </tr>
        <tr>
          <td><strong>INPUT PAYLOAD (Request: SOS Alert)</strong></td>
          <td>
            <pre><code>{
  "bookingId": "tur_bk_88192",
  "latitude": 32.2396,
  "longitude": 77.1887,
  "accuracy": 4.5,
  "description": "Medical emergency on Rohtang pass trek"
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>OUTPUT PAYLOAD (Response)</strong></td>
          <td>
            <pre><code>{
  "success": true,
  "data": {
    "incidentId": "inc_p0_88192a",
    "severity": "CRITICAL_P0",
    "dispatchedHotlines": ["112", "108"],
    "contactsNotifiedCount": 2,
    "status": "DISPATCHED"
  }
}</code></pre>
          </td>
        </tr>
        <tr>
          <td><strong>STATE MACHINE</strong></td>
          <td><code>REPORTED</code> &rarr; <code>DISPATCHED</code> &rarr; <code>UNDER_INVESTIGATION</code> &rarr; <code>RESOLVED</code> &rarr; <code>CLOSED</code>.</td>
        </tr>
        <tr>
          <td><strong>CONCURRENCY CONTROLS</strong></td>
          <td>Database write idempotency ensures that frantic multiple taps on the emergency SOS button update the existing incident location rather than generating duplicate dispatch tickets.</td>
        </tr>
        <tr>
          <td><strong>FAILURE & FALLBACK</strong></td>
          <td>If SMS gateway experiences latency, system automatically triggers automated phone call fallback to registered emergency contacts.</td>
        </tr>
      </tbody>
    </table>
  </div>
  `;
}
