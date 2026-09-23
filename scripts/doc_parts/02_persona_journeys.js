export function getPart02(svgUiFlow, svgHostKyc, svgCustody) {
  return `
  <div class="page-break"></div>

  <!-- CHAPTER 03: TRAVELER PERSONA JOURNEY -->
  <h1><span class="sec-num">03</span> Traveler Persona Journey: 14 Screen Profiles & State Machines</h1>

  <p>
    The traveler lifecycle is designed for zero-friction discovery, dynamic search filtering, instant inventory hold locking, statutory clickwrap compliance, and real-time social trip coordination. Below is the exhaustive breakdown of all 14 screens and their client/server state machines.
  </p>

  <div class="diagram-container">
    ${svgUiFlow}
    <div class="diagram-caption">Figure 3.1: Persona Journey Flowchart Across Traveler, Host & Admin Lifecycles</div>
  </div>

  <h2>3.1 Exhaustive Catalog of Traveler Profile Screens (Screens 1 to 14)</h2>

  <!-- SCREEN 1 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 1: Marketplace Discovery Portal (<code>/</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Discovery & Landing Phase</span>
    </div>
    <p><strong>Primary Function:</strong> Omnichannel travel discovery hub presenting curated multi-modal travel options (Tours, Activities, Vehicle Rentals) tailored to the traveler's detected location and search preferences.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Hero Global Search Bar</strong></td>
          <td>Traveler inputs destination keyword (e.g. "Manali", "Goa"), selects vertical tab, and picks target date ranges.</td>
          <td>Debounces query by 300ms, hits <code>/api/location/gps</code> for geocoding, queries PostgreSQL full-text search indexes on <code>city</code>, <code>title</code>, and <code>tags</code>.</td>
        </tr>
        <tr>
          <td><strong>Vertical Category Switcher</strong></td>
          <td>Interactive toggle switching between "Group Tours", "Hyperlocal Activities", and "Car & Bike Rentals".</td>
          <td>Client router pushes state without full reload; triggers prefetching of respective catalog datasets.</td>
        </tr>
        <tr>
          <td><strong>Trending Destinations Carousel</strong></td>
          <td>High-res destination cards with live starting prices, active tour counts, and traveler review badges.</td>
          <td>Redis-cached aggregation of top-booked destinations over the trailing 30 days (cache TTL: 1 hour).</td>
        </tr>
        <tr>
          <td><strong>Verified Host Spotlight</strong></td>
          <td>Displays top-rated hosts with verified KYC badges, total completed expeditions, and average ratings.</td>
          <td>Queries <code>Host</code> joined with <code>UserProfile</code> where <code>isVerified: true</code> and <code>averageRating &ge; 4.8</code>.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 2 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 2: Universal Search & Catalog Grid (<code>/tours</code>, <code>/activities</code>, <code>/car-rental</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Exploration & Filtering Phase</span>
    </div>
    <p><strong>Primary Function:</strong> High-performance faceted catalog supporting multi-criteria filtering, price sorting, interactive maps, and real-time availability badges.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Faceted Filter Sidebar</strong></td>
          <td>Sliders for Price Range (₹500 - ₹50,000), Duration (1-14 days), Difficulty (Easy, Moderate, Extreme), and Group Size.</td>
          <td>Generates dynamic Prisma <code>where</code> clauses with compound indexes: <code>[city, category, status]</code> and <code>[price]</code>.</td>
        </tr>
        <tr>
          <td><strong>Interactive Map Pin View</strong></td>
          <td>Map view plotting meeting coordinates and tour starting points with interactive price hover cards.</td>
          <td>Executes spatial bounding-box query returning geo-coordinates within traveler viewport.</td>
        </tr>
        <tr>
          <td><strong>Sort Order Dropdown</strong></td>
          <td>Options: "Most Popular", "Price: Low to High", "Price: High to Low", "Highest Rated", "Upcoming Departures".</td>
          <td>Applies SQL <code>ORDER BY</code> on indexed columns: <code>averageRating DESC</code>, <code>price ASC</code>, or <code>createdAt DESC</code>.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 3 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 3: Tour Detail & Itinerary Matrix (<code>/tours/[slug]</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Evaluation & Consideration Phase</span>
    </div>
    <p><strong>Primary Function:</strong> Comprehensive multi-day itinerary presentation with day-by-day activities, meal inclusions, accommodation tiers, safety guidelines, and live departure batch selector.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Day-by-Day Accordion</strong></td>
          <td>Collapsible cards for each expedition day showing morning/afternoon/evening schedule, elevation gains, and meals.</td>
          <td>Hydrates <code>TourItineraryDay</code> sorted by <code>dayNumber ASC</code>; includes photo galleries and coordinate markers.</td>
        </tr>
        <tr>
          <td><strong>Departure Batch Calendar</strong></td>
          <td>Interactive calendar displaying specific departure dates, total capacity, and remaining available seats.</td>
          <td>Fetches <code>TourBatch</code> where <code>startDate &gt; now()</code> and <code>status = OPEN</code>, calculating real-time remaining capacity.</td>
        </tr>
        <tr>
          <td><strong>Host Trust & Credential Card</strong></td>
          <td>Host avatar, badge verification level, response time, completed tours counter, and traveler bio.</td>
          <td>Loads host profile from <code>Host</code>, <code>UserProfile</code>, and aggregated rating counts.</td>
        </tr>
        <tr>
          <td><strong>Inclusions / Exclusions Matrix</strong></td>
          <td>Checkmark list of covered costs (Guide, Gear, Meals, Permits) vs excluded costs (Personal expenses, Insurance).</td>
          <td>Stored as PostgreSQL text arrays <code>included String[]</code> and <code>excluded String[]</code>.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 4 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 4: Tour Checkout & Traveler Roster (<code>/tours/[slug]/checkout</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Reservation & Booking Intent Phase</span>
    </div>
    <p><strong>Primary Function:</strong> Traveler roster data entry, emergency contact collection, 15-minute inventory hold locking, and statutory clickwrap consent.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>15-Minute Countdown Lock</strong></td>
          <td>Visual countdown banner: "Inventory held for 14:59. Complete checkout to secure your seats."</td>
          <td>Backend creates <code>BookingIntent</code> with <code>expiresAt = now() + 15m</code>, decrementing <code>availableSlots</code>.</td>
        </tr>
        <tr>
          <td><strong>Traveler Roster Form</strong></td>
          <td>Input rows for each traveler: Full Legal Name, Age, Gender, Dietary Restrictions, Government ID number.</td>
          <td>Validated via Zod schema; staged for creation of <code>TourTraveler</code> records upon payment confirmation.</td>
        </tr>
        <tr>
          <td><strong>Emergency Contact Input</strong></td>
          <td>Mandatory name, relationship, and 10-digit mobile number for off-grid safety protocols.</td>
          <td>Stored on <code>TourBooking.emergencyContact</code>; accessible to verified tour guides 24 hours prior to departure.</td>
        </tr>
        <tr>
          <td><strong>Statutory Clickwrap Modal</strong></td>
          <td>Unchecked checkboxes for <code>TRAVELER_SAFETY_POLICY</code> and <code>CANCELLATION_POLICY</code> with inline view modals.</td>
          <td>Checkout button remains strictly disabled. Checking boxes prepares payload for <code>PolicyConsent</code> audit logging.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 5 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 5: Hyperlocal Activity Slot Selection (<code>/activities/[slug]</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Single-Day Activity Booking Phase</span>
    </div>
    <p><strong>Primary Function:</strong> Slot-based reservation interface for single-day adventures, workshops, and sports with real-time session capacity counters.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Date & Time Slot Grid</strong></td>
          <td>Horizontal date carousel with vertical time-slot pills (e.g. "09:00 AM", "01:30 PM", "04:00 PM") showing available spots.</td>
          <td>Queries <code>ActivitySlot</code> for selected date, returning <code>startTime</code>, <code>availableSlots</code>, and <code>price</code>.</td>
        </tr>
        <tr>
          <td><strong>Participant Counter & Add-ons</strong></td>
          <td>Counter incrementing guest count with live price calculation and optional rental gear add-ons (e.g. wetsuit, helmet).</td>
          <td>Validates party size against <code>groupSizeMax</code>; calculates subtotal, taxes, and service fees in real time.</td>
        </tr>
        <tr>
          <td><strong>Instructor & Gear Disclosures</strong></td>
          <td>Safety equipment certification details, certified instructor credentials, and minimum age/fitness prerequisites.</td>
          <td>Loads activity safety metadata and generates prerequisite waiver acknowledgment prompt.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 6 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 6: Vehicle Rental Custody Terms & License Upload (<code>/car-rental/[slug]</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Fleet Mobility Reservation Phase</span>
    </div>
    <p><strong>Primary Function:</strong> Self-drive vehicle reservation interface enforcing statutory driving license verification, security deposit calculation, and fuel policy selection.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Pickup & Return Time Selector</strong></td>
          <td>Date and hour picker for vehicle collection and drop-off, with location pickup hub selection.</td>
          <td>Calculates rental duration in 24-hour blocks; verifies vehicle availability against existing <code>RentalBooking</code> records.</td>
        </tr>
        <tr>
          <td><strong>Driving License Uploader</strong></td>
          <td>Front and back photo upload of valid Indian/International Driving License with OCR validation.</td>
          <td>Scans binary magic-bytes, uploads to encrypted storage, and stages for host pre-handover verification.</td>
        </tr>
        <tr>
          <td><strong>Security Deposit Breakdown</strong></td>
          <td>Itemized breakdown showing Rental Base Rate, Refundable Security Deposit (₹3,000 - ₹10,000), and Insurance Add-on.</td>
          <td>Creates separate ledger hold for security deposit to enable frictionless post-trip release upon clean inspection.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 7 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 7: Traveler Wishlist & Saved Collections (<code>/wishlist</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Personalization & Bookmarking Phase</span>
    </div>
    <p><strong>Primary Function:</strong> Saved trip organizer allowing travelers to bookmark tours, activities, and rentals, organize them into folders, and track price changes.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Heart Icon Instant Toggle</strong></td>
          <td>One-click bookmarking on any listing card across catalog and detail views with micro-animation.</td>
          <td>Executes optimistic UI update; dispatches <code>POST /api/wishlist</code> upserting into <code>WishlistItem</code>.</td>
        </tr>
        <tr>
          <td><strong>Categorized Folders</strong></td>
          <td>Custom folders (e.g. "Summer Trek 2027", "Goa Weekend") for grouping saved listings.</td>
          <td>Relational foreign key query linking <code>WishlistItem</code> records by user and folder category.</td>
        </tr>
        <tr>
          <td><strong>Price Drop Alerts Badge</strong></td>
          <td>Visual badge indicating listings where host has discounted departure batch prices since bookmarking.</td>
          <td>Compares listing <code>price</code> against <code>originalPrice</code> stored in database.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 8 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 8: Trips & Orders Drawer / Management (<code>/my-bookings</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Post-Booking Operations Phase</span>
    </div>
    <p><strong>Primary Function:</strong> Central dashboard managing all confirmed, active, completed, and cancelled reservations across Tours, Activities, and Rentals.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Tabbed Status Filter</strong></td>
          <td>Tabs for "Upcoming", "Active / In-Progress", "Completed", and "Cancelled / Refunded".</td>
          <td>Executes polymorphic queries across <code>TourBooking</code>, <code>ActivityBooking</code>, and <code>RentalBooking</code> sorted by date.</td>
        </tr>
        <tr>
          <td><strong>Digital Voucher & QR Code</strong></td>
          <td>Modal displaying booking confirmation voucher, QR code for host scan check-in, and PDF download button.</td>
          <td>Generates cryptographically signed QR code containing <code>bookingCode</code> and encrypted traveler hash.</td>
        </tr>
        <tr>
          <td><strong>Cancellation & Refund Trigger</strong></td>
          <td>Tiered cancellation button displaying real-time refundable amount based on cancellation policy rules.</td>
          <td>Executes cancellation policy calculation; initiates automated refund via <code>Razorpay.refunds</code> and logs to <code>Refund</code>.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 9 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 9: Traveler Profile & Identity Settings (<code>/profile</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Identity & Preference Governance</span>
    </div>
    <p><strong>Primary Function:</strong> Traveler biographical data management, verified phone credentials, emergency contact synchronization, and DPDP Act consent history.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Avatar & Bio Editor</strong></td>
          <td>Photo upload with client-side cropping and short biographical description editor.</td>
          <td>Scans image magic-bytes, optimizes via Cloudinary, and updates <code>UserProfile.avatarUrl</code>.</td>
        </tr>
        <tr>
          <td><strong>Phone OTP Verification</strong></td>
          <td>Input for 10-digit Indian mobile number with 6-digit OTP verification flow.</td>
          <td>Generates cryptographic OTP, dispatches via SMS gateway, and sets <code>isPhoneVerified: true</code> upon confirmation.</td>
        </tr>
        <tr>
          <td><strong>DPDP Act Consent History Table</strong></td>
          <td>Read-only audit table showing exact dates, versions, and IP addresses when traveler consented to legal policies.</td>
          <td>Queries <code>PolicyConsent</code> filtered by <code>userId</code>, displaying policy title, version, and consented timestamp.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 10 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 10: Active Devices & Session Management (<code>/settings/devices</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Account Security Governance</span>
    </div>
    <p><strong>Primary Function:</strong> Multi-device session manager enforcing the 3-device maximum concurrent limit with remote revocation capabilities and FIFO eviction transparency.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Active Devices List</strong></td>
          <td>Cards for each active device showing device model, browser, IP address, approximate city, and "Current Device" badge.</td>
          <td>Queries <code>UserDevice</code> joined with <code>Session</code> filtered by <code>userId</code> and <code>status = ACTIVE</code> (maximum 3 records).</td>
        </tr>
        <tr>
          <td><strong>Remote "Revoke Session" Button</strong></td>
          <td>Clicking terminates session on a remote device with immediate effect.</td>
          <td>Revokes refresh token in Redis and sets <code>UserDevice.status = REVOKED</code>. Remote client receives HTTP 401 on next request.</td>
        </tr>
        <tr>
          <td><strong>FIFO Eviction Banner</strong></td>
          <td>Informational banner: "Travels Pro permits up to 3 concurrent devices. Logging in on a 4th device automatically evicts your oldest session."</td>
          <td>Educational security UI minimizing user confusion when older tablets or secondary browsers are automatically logged out.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 11 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 11: Multi-Dimensional Review & Rating Submission (<code>/reviews/submit</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Reputation & Quality Loop</span>
    </div>
    <p><strong>Primary Function:</strong> Post-trip feedback portal capturing verified reviews across 4 distinct quality dimensions with anti-review-bombing protection.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>4-Dimension Rating Sliders</strong></td>
          <td>Independent 5-star ratings for: (1) Accuracy of Description, (2) Cleanliness & Safety, (3) Host Communication, (4) Value for Money.</td>
          <td>Validates scores between 1.0 and 5.0; calculates weighted composite rating persisted to <code>Review</code>.</td>
        </tr>
        <tr>
          <td><strong>Trip Photo Uploader</strong></td>
          <td>Traveler attaches up to 6 authentic trip photos taken during the expedition.</td>
          <td>Uploads to CDN with EXIF verification ensuring photos were captured during the actual booking timeframe.</td>
        </tr>
        <tr>
          <td><strong>Verified Traveler Gate</strong></td>
          <td>Form is accessible only if traveler has completed the booking (<code>status = COMPLETED</code>).</td>
          <td>Backend verifies booking completion in PostgreSQL before accepting review submission; prevents fraudulent review generation.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 12 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 12: Private Trip Circles Real-Time Chat (<code>/tours/[slug]/chat</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Social Group Coordination Phase</span>
    </div>
    <p><strong>Primary Function:</strong> Private, end-to-end authenticated group chat room connecting confirmed tour travelers and their certified host via WebSockets.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Real-Time Chat Feed</strong></td>
          <td>Instant messaging feed with typing indicators, message read receipts, and member role badges ("Host", "Traveler").</td>
          <td>Socket.IO client binds to <code>tour-\${tourId}</code>; messages are broadcast to connected sockets and written to <code>TourMessage</code>.</td>
        </tr>
        <tr>
          <td><strong>Host Announcement Banner</strong></td>
          <td>Pinned banner at top of chat for host broadcast updates (e.g. "Departure time moved to 06:30 AM due to weather").</td>
          <td>Restricted mutation: only users with <code>role = HOST</code> can publish pinned announcements. Dispatches push notifications.</td>
        </tr>
        <tr>
          <td><strong>Message Flagging & Reporting</strong></td>
          <td>Contextual menu on any message allowing travelers to report harassment or policy violations.</td>
          <td>Creates <code>TourMessageReport</code> and automatically notifies admin moderation team for immediate review.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 13 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 13: Dispute & Refund Mediation Modal (<code>/disputes/new</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Resolution & Claims Phase</span>
    </div>
    <p><strong>Primary Function:</strong> Dispute initiation workbench allowing travelers to challenge host claims, report service non-delivery, or appeal security deposit withholdings.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Dispute Category Selector</strong></td>
          <td>Options: "Host No-Show", "Safety Violation", "Unfair Damage Claim", "Misrepresented Amenities", "Emergency Medical Cancellation".</td>
          <td>Maps to <code>IncidentCategory</code> enum; attaches case priority based on severity.</td>
        </tr>
        <tr>
          <td><strong>Evidence Uploader</strong></td>
          <td>Multi-file uploader for GPS timestamps, photos, medical certificates, or police FIR reports.</td>
          <td>Persists encrypted documents to secure evidence storage; logs to <code>IncidentEvent</code>.</td>
        </tr>
        <tr>
          <td><strong>Escrow Automatic Freeze</strong></td>
          <td>Notice confirming: "Host payout for this booking has been automatically frozen pending admin review."</td>
          <td>Backend sets <code>Booking.isPayoutFrozen = true</code>, halting automated T+2 bank payout transfers until resolution.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SCREEN 14 -->
  <div class="card avoid-break" style="margin-bottom: 14px;">
    <div class="card-title" style="display: flex; justify-content: space-between;">
      <span>Screen 14: Emergency Safety Center & SOS Broadcast (<code>/safety/sos</code>)</span>
      <span style="font-size: 10px; color: var(--accent);">Emergency Operations Phase</span>
    </div>
    <p><strong>Primary Function:</strong> Critical safety interface providing one-tap emergency SOS broadcast, emergency contact dispatch, and direct link to local authorities.</p>
    <table>
      <thead><tr><th style="width: 25%;">UI Component / Widget</th><th style="width: 40%;">User Interaction & Behavior</th><th style="width: 35%;">Server & Database Execution</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>One-Tap SOS Trigger Button</strong></td>
          <td>Prominent high-contrast red button with 3-second hold confirmation to prevent accidental activation.</td>
          <td>Captures current high-accuracy GPS coordinates, dispatches automated SMS to emergency contacts, and creates P0 <code>Incident</code>.</td>
        </tr>
        <tr>
          <td><strong>Emergency Hotline Directory</strong></td>
          <td>Direct dial buttons for Police (112), Ambulance (108), Tourist Helpline (1363), and Travels Pro 24x7 Safety Desk.</td>
          <td>Native <code>tel:</code> protocol handler triggering immediate telephony dialer on mobile devices.</td>
        </tr>
        <tr>
          <td><strong>Live Location Share Link</strong></td>
          <td>Generates temporary, token-authenticated live tracking URL shareable via WhatsApp or SMS.</td>
          <td>Streams real-time GPS telemetry to Redis geospatial key with 24-hour expiration TTL.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="page-break"></div>

  <!-- CHAPTER 04: HOST PERSONA JOURNEY -->
  <h1><span class="sec-num">04</span> Host Persona Journey: 10 Screens, 6-Step KYC & Supply Studios</h1>

  <p>
    The host lifecycle provides rigorous identity vetting, statutory tax compliance, comprehensive listing authoring studios, two-stage vehicle custody inspections, and automated escrow payouts.
  </p>

  <div class="diagram-container">
    ${svgHostKyc}
    <div class="diagram-caption">Figure 4.1: 6-Step Host Onboarding, Biometric Verification & Adjudication Pipeline</div>
  </div>

  <h2>4.1 The 6-Step Host Identity & Banking Verification Wizard (<code>/host/kyc</code>)</h2>
  <p>
    To ensure traveler safety and prevent fraudulent operators, every host must complete a mandatory 6-stage verification dossier before their account can be promoted to <code>HOST</code> or publish listings.
  </p>

  <table>
    <thead><tr><th style="width: 15%;">KYC Step</th><th style="width: 25%;">Host Input Requirements</th><th style="width: 35%;">Validation & Encryption Mechanics</th><th style="width: 25%;">Database Persistence</th></tr></thead>
    <tbody>
      <tr>
        <td><strong>Step 1: Legal Entity</strong></td>
        <td>Select <code>INDIVIDUAL</code> or <code>REGISTERED_BUSINESS</code>, Legal Full Name, Date of Birth, Business Trading Name.</td>
        <td>Asserts age &ge; 18 years from DOB; ensures legal entity matches future tax filings and banking records.</td>
        <td><code>Host.hostType</code>, <code>Host.businessName</code></td>
      </tr>
      <tr>
        <td><strong>Step 2: Tax Registration</strong></td>
        <td>Permanent Account Number (PAN) and optional Goods and Services Tax Identification Number (GSTIN).</td>
        <td>Validates PAN format via regex (<code>^[A-Z]{5}[0-9]{4}[A-Z]{1}$</code>); validates 15-character GSTIN structure.</td>
        <td><code>Host.panNumber</code>, <code>Host.gstNumber</code></td>
      </tr>
      <tr>
        <td><strong>Step 3: Identity Document</strong></td>
        <td>Document Type (Aadhaar, Passport, Voter ID) and clear high-resolution front and back image uploads.</td>
        <td>Scans binary magic-bytes (preventing disguised malware); stores images in encrypted private bucket.</td>
        <td><code>KycApplication.idType</code>, <code>idFrontUrl</code>, <code>idBackUrl</code></td>
      </tr>
      <tr>
        <td><strong>Step 4: Liveness Selfie</strong></td>
        <td>Live webcam / smartphone capture of host holding their government ID card next to their face.</td>
        <td>Performs facial symmetry and liveness check; verifies ID document visible in photo matches Step 3 upload.</td>
        <td><code>KycApplication.selfieUrl</code></td>
      </tr>
      <tr>
        <td><strong>Step 5: Encrypted Bank</strong></td>
        <td>Bank Account Number, Confirm Account Number, Account Holder Name, Bank Name, and 11-character IFSC Code.</td>
        <td>Validates IFSC format; encrypts account number in memory via AES-256-GCM (<code>\${iv}:\${ciphertext}:\${authTag}</code>).</td>
        <td><code>KycApplication.bankAccountEnc</code>, <code>bankIfsc</code></td>
      </tr>
      <tr>
        <td><strong>Step 6: Statutory Clickwrap</strong></td>
        <td>Mandatory unchecked checkboxes for <code>HOST_SAFETY_AGREEMENT</code> and <code>TERMS_OF_SERVICE</code>.</td>
        <td>Requires explicit affirmative consent; logs immutable IP, user-agent, and policy version record.</td>
        <td><code>PolicyConsent</code> (context: <code>HOST_KYC</code>)</td>
      </tr>
    </tbody>
  </table>

  <h2>4.2 Host Operational Studios & Management Screens (Screens 1 to 10)</h2>

  <!-- HOST SCREEN 1 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Host Screen 1: Gateway & Fee Calculator (<code>/host</code>)</div>
    <p>Onboarding landing page explaining platform reach, commission structure (12% Tours, 15% Activities, 18% Rentals), revenue calculator, and host type selector.</p>
  </div>

  <!-- HOST SCREEN 2 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Host Screen 2: 6-Stage Identity & Banking KYC (<code>/host/kyc</code>)</div>
    <p>Interactive multi-step wizard collecting legal identity, encrypted tax IDs, liveness selfie, and AES-256-GCM bank account credentials with progress indicator.</p>
  </div>

  <!-- HOST SCREEN 3 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Host Screen 3: Host Mission Control Dashboard (<code>/host/dashboard</code>)</div>
    <p>Real-time analytics dashboard displaying Gross Merchandise Value (GMV), 30-day net earnings, active guest roster, listing performance metrics, and pending booking alerts.</p>
  </div>

  <!-- HOST SCREEN 4 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Host Screen 4: Tour Studio (7-Step Wizard) (<code>/host/tours/create</code>)</div>
    <p>Comprehensive authoring studio: (1) General Info, (2) Day-by-Day Itinerary Builder, (3) Inclusions & Exclusions, (4) Departure Batches & Quotas, (5) Tiered Pricing, (6) Safety Gear & Disclosures, (7) Policy Confirmation. Listings are submitted to Admin Moderation Studio with <code>PENDING_REVIEW</code> status.</p>
  </div>

  <!-- HOST SCREEN 5 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Host Screen 5: Hyperlocal Activity Slot Studio (<code>/host/activities/manage</code>)</div>
    <p>Calendar management interface for single-day experiences allowing hosts to generate recurring daily time slots, set max capacity limits, configure instant booking toggles, and issue weather advisories.</p>
  </div>

  <!-- HOST SCREEN 6 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Host Screen 6: Vehicle Fleet Inventory Manager (<code>/host/rentals/fleet</code>)</div>
    <p>Automotive fleet inventory system tracking vehicle make, model, year, transmission, statutory Registration Certificate (RC), Pollution Under Control (PUC) certificate, and commercial insurance expiry dates.</p>
  </div>

  <!-- HOST SCREEN 7 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Host Screen 7: Two-Stage Digital Custody Inspection Studio (<code>/host/rentals/[id]/custody</code>)</div>
    <p>Mobile-optimized vehicle custody inspection tool. Eliminates security deposit disputes via two-stage photographic verification:</p>
    <div class="diagram-container" style="margin: 10px 0;">
      ${svgCustody}
      <div class="diagram-caption">Figure 4.2: Two-Stage Vehicle Custody Handover & Inspection Architecture</div>
    </div>
    <table>
      <thead><tr><th style="width: 20%;">Inspection Stage</th><th style="width: 40%;">Host Operational Checklist</th><th style="width: 40%;">Traveler Verification & Legal Effect</th></tr></thead>
      <tbody>
        <tr>
          <td><strong>Stage 1: Pickup Handover</strong></td>
          <td>Host inputs starting odometer reading, fuel level (e.g. 100%), and captures 4 mandatory timestamped photos (Front, Rear, Left, Right).</td>
          <td>Traveler physically inspects vehicle, reviews photos on mobile screen, and enters digital PIN/signature to accept custody. Transitions booking to <code>ACTIVE</code>.</td>
        </tr>
        <tr>
          <td><strong>Stage 2: Return Handover</strong></td>
          <td>Host inspects returned vehicle, logs return odometer, checks fuel level, and photographs vehicle condition.</td>
          <td>If readings match terms and no damage is logged, security deposit is auto-released. If damage is detected, evidence is escalated to Admin Dispute Desk.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- HOST SCREEN 8 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Host Screen 8: Booking Adjudication Queue (<code>/host/bookings</code>)</div>
    <p>Real-time booking inbox displaying incoming reservation requests, guest verification status, special requests, and one-click Accept/Reject buttons with automated traveler SMS notifications.</p>
  </div>

  <!-- HOST SCREEN 9 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Host Screen 9: Earnings & Automated Payout Ledger (<code>/host/payouts</code>)</div>
    <p>Itemized financial ledger breaking down Gross Booking Value, Platform Commission (12-18%), GST Deductions (18%), and Net Settled Payouts. Integrates Razorpay Route for automated T+2 bank transfers upon tour completion.</p>
  </div>

  <!-- HOST SCREEN 10 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Host Screen 10: Review Moderation & Dispute Console (<code>/host/reviews</code>)</div>
    <p>Reputation management console allowing hosts to read traveler reviews, post professional public responses, and appeal fraudulent reviews to the admin moderation team.</p>
  </div>

  <div class="page-break"></div>

  <!-- CHAPTER 05: ADMIN PERSONA JOURNEY -->
  <h1><span class="sec-num">05</span> Admin Persona Journey: 9 Screens, Governance & Safety Desk</h1>

  <p>
    The administrator persona enforces platform safety, regulatory compliance, content authenticity, financial integrity, and emergency incident dispatch. Privileged admin actions are protected by Step-Up Multi-Factor Authentication.
  </p>

  <h2>5.1 Exhaustive Catalog of Admin Mission Control Screens (Screens 1 to 9)</h2>

  <!-- ADMIN SCREEN 1 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Admin Screen 1: Executive Mission Control (<code>/admin</code>)</div>
    <p>High-level platform executive overview showing real-time Gross Merchandise Value (GMV), net platform commission revenue, active user counts, live trip circles, and a geographical safety incident heatmap.</p>
  </div>

  <!-- ADMIN SCREEN 2 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Admin Screen 2: Step-Up Multi-Factor Authentication (<code>/admin/auth/step-up</code>)</div>
    <p>Time-based One-Time Password (TOTP) / Biometric re-authentication barrier required before an administrator can approve host KYC, access decrypted bank numbers, or authorize financial refunds.</p>
  </div>

  <!-- ADMIN SCREEN 3 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Admin Screen 3: Host KYC Adjudication Dossier (<code>/admin/kyc/[id]</code>)</div>
    <p>Side-by-side inspection console: displays government ID uploads with high-resolution pan-and-zoom, live selfie comparison, automated PAN format verification, and decrypted AES-256-GCM bank details. Includes one-click "Approve & Promote to HOST" or "Reject with Stated Reason" buttons.</p>
  </div>

  <!-- ADMIN SCREEN 4 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Admin Screen 4: Listing Moderation & Quality Studio (<code>/admin/listings</code>)</div>
    <p>Review pipeline for newly submitted Tours, Activities, and Rentals. Administrators audit itinerary descriptions, verify photo authenticity against copyright infringements, detect price gouging, and toggle listing status (<code>APPROVED</code>, <code>REVISION_REQUESTED</code>, <code>ARCHIVED</code>).</p>
  </div>

  <!-- ADMIN SCREEN 5 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Admin Screen 5: Legal Policy CMS & Versioning (<code>/admin/policies</code>)</div>
    <p>Dynamic Markdown/WYSIWYG editor managing the 5 platform policies. When an admin increments a policy version (e.g. v1.0 &rarr; v1.1), the system automatically invalidates previous user consents and triggers the blocking <code>PolicyConsentModal</code> upon next login.</p>
  </div>

  <!-- ADMIN SCREEN 6 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Admin Screen 6: Financial Reconciliation & Escrow Ledger (<code>/admin/financials</code>)</div>
    <p>Comprehensive treasury dashboard tracking total funds held in Razorpay Escrow, pending T+2 host payout batches, automated GST liability calculations, and disputed transaction holds.</p>
  </div>

  <!-- ADMIN SCREEN 7 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Admin Screen 7: Safety Incidents & Emergency SOS Desk (<code>/admin/incidents</code>)</div>
    <p>Priority triage desk categorizing incidents by severity: P0 (Critical / Medical / Police), P1 (Vehicle Breakdown / Guide Misconduct), P2 (Booking Dispute). Displays live GPS telemetry, traveler emergency contacts, and incident timeline logger.</p>
  </div>

  <!-- ADMIN SCREEN 8 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Admin Screen 8: Dispute & Damage Mediation Workbench (<code>/admin/disputes</code>)</div>
    <p>Dual-pane evidence workbench displaying host pre/post-trip custody photos against traveler testimonies. Allows admins to authorize partial refunds, release security deposits, or order full traveler reimbursements.</p>
  </div>

  <!-- ADMIN SCREEN 9 -->
  <div class="card avoid-break" style="margin-bottom: 12px;">
    <div class="card-title">Admin Screen 9: System Audit Log & B2B SSO Provisioning (<code>/admin/audit-sso</code>)</div>
    <p>Tamper-evident audit log streaming all administrative actions with actor ID, timestamp, IP address, and JSON diffs. Manages B2B corporate SSO configurations (SAML 2.0 / OIDC) and enterprise domain whitelists.</p>
  </div>
  `;
}
