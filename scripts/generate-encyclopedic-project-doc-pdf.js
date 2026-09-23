import fs from "fs";
import path from "path";
import { execSync } from "child_process";

import { getPart01 } from "./doc_parts/01_intro_and_arch.js";
import { getPart02 } from "./doc_parts/02_persona_journeys.js";
import { getPart03 } from "./doc_parts/03_module_deep_dive.js";
import { getPart04 } from "./doc_parts/04_data_and_apis.js";
import { getPart05 } from "./doc_parts/05_business_and_roadmap.js";

// ============================================================================
// STYLES & PRINT CONFIGURATION
// ============================================================================
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800;850&family=JetBrains+Mono:wght@400;500;600&display=swap');

  :root {
    --primary: #0f172a;
    --primary-light: #1e293b;
    --accent: #0284c7;
    --cyan: #0891b2;
    --emerald: #059669;
    --amber: #d97706;
    --rose: #e11d48;
    --violet: #7c3aed;
    --slate-50: #f8fafc;
    --slate-100: #f1f5f9;
    --slate-200: #e2e8f0;
    --slate-300: #cbd5e1;
    --slate-400: #94a3b8;
    --slate-600: #475569;
    --slate-700: #334155;
    --slate-800: #1e293b;
    --slate-900: #0f172a;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    color: var(--slate-800);
    background: #ffffff;
    line-height: 1.52;
    font-size: 12px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  @page {
    size: A4 portrait;
    margin: 15mm 13mm 15mm 13mm;
    @top-right {
      content: "Travels Pro • Master Engineering & Business Specification";
      font-size: 8pt;
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: #94a3b8;
      font-weight: 600;
    }
    @bottom-center {
      content: "Page " counter(page) " of " counter(pages);
      font-size: 8pt;
      font-family: 'Plus Jakarta Sans', sans-serif;
      color: #94a3b8;
      font-weight: 600;
    }
  }

  .page-break { page-break-after: always; break-after: page; }
  .avoid-break { page-break-inside: avoid; break-inside: avoid; }

  /* COVER */
  .cover {
    min-height: 92vh;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 20px 10px;
    border-bottom: 3px solid var(--accent);
  }

  .cover-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
    padding: 6px 16px;
    border-radius: 9999px;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .cover-title {
    font-size: 35px;
    font-weight: 850;
    color: var(--slate-900);
    line-height: 1.15;
    letter-spacing: -0.03em;
    margin: 18px 0 12px 0;
  }

  .cover-title span {
    background: linear-gradient(135deg, #0284c7 0%, #0891b2 50%, #059669 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .cover-subtitle {
    font-size: 15px;
    color: var(--slate-600);
    max-width: 720px;
    line-height: 1.55;
    font-weight: 500;
  }

  .meta-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 28px;
    background: var(--slate-50);
    border: 1px solid var(--slate-200);
    padding: 16px;
    border-radius: 12px;
  }

  .meta-item p:first-child {
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--slate-400);
  }

  .meta-item p:last-child {
    font-size: 12.5px;
    font-weight: 750;
    color: var(--slate-900);
    margin-top: 3px;
  }

  /* HEADINGS */
  h1 {
    font-size: 21px;
    font-weight: 800;
    color: var(--slate-900);
    letter-spacing: -0.02em;
    margin: 16px 0 10px 0;
    padding-bottom: 5px;
    border-bottom: 2px solid var(--slate-200);
    display: flex;
    align-items: center;
    gap: 10px;
  }

  h1 .sec-num {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--primary);
    color: white;
    width: 25px;
    height: 25px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 800;
  }

  h2 {
    font-size: 15px;
    font-weight: 750;
    color: var(--slate-900);
    margin: 16px 0 6px 0;
    letter-spacing: -0.01em;
  }

  h3 {
    font-size: 13px;
    font-weight: 700;
    color: var(--slate-800);
    margin: 10px 0 4px 0;
  }

  p { margin-bottom: 8px; color: var(--slate-700); text-align: justify; }
  strong { font-weight: 700; color: var(--slate-900); }

  /* TABLES */
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 10px 0 14px 0;
    font-size: 10.5px;
    background: white;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--slate-200);
  }

  th {
    background: var(--slate-100);
    color: var(--slate-800);
    font-weight: 750;
    text-align: left;
    padding: 6px 8px;
    border-bottom: 1px solid var(--slate-200);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--slate-100);
    color: var(--slate-700);
    vertical-align: top;
  }

  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #fafbfd; }

  /* CARDS & GRIDS */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 10px 0; }
  .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0; }
  .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 10px 0; }

  .card {
    background: white;
    border: 1px solid var(--slate-200);
    border-radius: 10px;
    padding: 10px 12px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.02);
  }

  .card-title {
    font-size: 11.5px;
    font-weight: 800;
    color: var(--slate-900);
    margin-bottom: 4px;
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .card p { font-size: 10.5px; color: var(--slate-600); margin-bottom: 0; text-align: left; }

  /* CALLOUTS */
  .callout {
    border-radius: 8px;
    padding: 10px 12px;
    margin: 10px 0;
    border-left: 4px solid;
    font-size: 11px;
  }

  .callout-info { background: #ecfeff; border-color: var(--cyan); color: #155e75; }
  .callout-success { background: #ecfdf5; border-color: var(--emerald); color: #065f46; }
  .callout-warning { background: #fffbeb; border-color: var(--amber); color: #92400e; }
  .callout-danger { background: #fff1f2; border-color: var(--rose); color: #9f1239; }

  /* PILLS */
  .pill {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 9999px;
    font-size: 8.5px;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .pill-cyan { background: #ecfeff; color: #0891b2; }
  .pill-emerald { background: #ecfdf5; color: #059669; }
  .pill-amber { background: #fffbeb; color: #d97706; }
  .pill-rose { background: #fff1f2; color: #e11d48; }
  .pill-violet { background: #f5f3ff; color: #7c3aed; }
  .pill-slate { background: #f1f5f9; color: #475569; }

  /* MONO & CODE */
  code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9.5px;
    background: var(--slate-100);
    color: #0f172a;
    padding: 1px 3px;
    border-radius: 3px;
    border: 1px solid var(--slate-200);
  }

  pre {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9.5px;
    background: var(--slate-900);
    color: #e2e8f0;
    padding: 8px 10px;
    border-radius: 8px;
    margin: 8px 0;
    overflow-x: auto;
    line-height: 1.35;
  }

  /* DIAGRAMS */
  .diagram-container {
    background: #f8fafc;
    border: 1px solid var(--slate-200);
    border-radius: 10px;
    padding: 12px;
    margin: 10px 0;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .diagram-caption {
    font-size: 9.5px;
    font-weight: 750;
    color: var(--slate-500);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 6px;
  }

  ul, ol { margin: 4px 0 8px 14px; color: var(--slate-700); font-size: 11.5px; }
  li { margin-bottom: 3px; }
`;

// ============================================================================
// SVG BUILDERS
// ============================================================================

function svgTopology() {
  return `
  <svg viewBox="0 0 880 430" width="100%" height="310" xmlns="http://www.w3.org/2000/svg" style="font-family:'Plus Jakarta Sans',sans-serif;">
    <defs>
      <filter id="sd" x="-5%" y="-5%" width="110%" height="110%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.08"/></filter>
      <marker id="m1" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#0284c7"/></marker>
    </defs>
    <!-- LAYER 1: CLIENT -->
    <rect x="15" y="20" width="225" height="390" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="4 4"/>
    <text x="30" y="44" font-size="11" font-weight="800" fill="#64748b" letter-spacing="1">1. PRESENTATION LAYER</text>
    <g filter="url(#sd)">
      <rect x="30" y="65" width="195" height="70" rx="10" fill="white" stroke="#e2e8f0"/>
      <rect x="38" y="75" width="5" height="50" rx="2.5" fill="#0284c7"/>
      <text x="52" y="90" font-size="12" font-weight="800" fill="#0f172a">Traveler Web App</text>
      <text x="52" y="106" font-size="10" fill="#64748b">Port 3000 • Next.js 16 App</text>
      <text x="52" y="120" font-size="9" font-weight="600" fill="#0284c7">Tailwind • Framer Motion</text>
    </g>
    <g filter="url(#sd)">
      <rect x="30" y="150" width="195" height="70" rx="10" fill="white" stroke="#e2e8f0"/>
      <rect x="38" y="160" width="5" height="50" rx="2.5" fill="#059669"/>
      <text x="52" y="175" font-size="12" font-weight="800" fill="#0f172a">Host Studio & Desk</text>
      <text x="52" y="191" font-size="10" fill="#64748b">/host • 6-Step Verification</text>
      <text x="52" y="205" font-size="9" font-weight="600" fill="#059669">HostPage & HostSection UI</text>
    </g>
    <g filter="url(#sd)">
      <rect x="30" y="235" width="195" height="70" rx="10" fill="white" stroke="#e2e8f0"/>
      <rect x="38" y="245" width="5" height="50" rx="2.5" fill="#7c3aed"/>
      <text x="52" y="260" font-size="12" font-weight="800" fill="#0f172a">Admin Control Tower</text>
      <text x="52" y="276" font-size="10" fill="#64748b">/admin • KYC & Policy CMS</text>
      <text x="52" y="290" font-size="9" font-weight="600" fill="#7c3aed">Disputes • Payout Batches</text>
    </g>
    <g filter="url(#sd)">
      <rect x="30" y="320" width="195" height="70" rx="10" fill="white" stroke="#e2e8f0"/>
      <rect x="38" y="330" width="5" height="50" rx="2.5" fill="#0891b2"/>
      <text x="52" y="345" font-size="12" font-weight="800" fill="#0f172a">Reverse Proxy / Edge</text>
      <text x="52" y="361" font-size="10" fill="#64748b">Turbopack Middleware</text>
      <text x="52" y="375" font-size="9" font-weight="600" fill="#0891b2">Port 3000 -> 4000 Route Bridge</text>
    </g>

    <line x1="240" y1="215" x2="285" y2="215" stroke="#0284c7" stroke-width="2.5" marker-end="url(#m1)" stroke-dasharray="6 4"/>

    <!-- LAYER 2: API & GATEWAY -->
    <rect x="285" y="20" width="295" height="390" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="4 4"/>
    <text x="300" y="44" font-size="11" font-weight="800" fill="#64748b" letter-spacing="1">2. API & LOGIC LAYER (PORT 4000)</text>
    <g filter="url(#sd)">
      <rect x="300" y="65" width="265" height="95" rx="10" fill="white" stroke="#e2e8f0"/>
      <text x="315" y="85" font-size="12" font-weight="800" fill="#0f172a">Authentication & Identity Core</text>
      <text x="315" y="103" font-size="10" fill="#475569">• Google OAuth 2.0 & Token Rotation</text>
      <text x="315" y="119" font-size="10" fill="#475569">• 3-Device Max Limit (FIFO Auto-Eviction)</text>
      <text x="315" y="135" font-size="10" fill="#475569">• Enterprise SAML 2.0 / OIDC & AES Vault</text>
      <text x="315" y="151" font-size="9.5" font-weight="600" fill="#0284c7">Double-Submit CSRF & Origin Guard</text>
    </g>
    <g filter="url(#sd)">
      <rect x="300" y="175" width="265" height="115" rx="10" fill="white" stroke="#e2e8f0"/>
      <text x="315" y="195" font-size="12" font-weight="800" fill="#0f172a">Commerce & Booking Operations</text>
      <text x="315" y="213" font-size="10" fill="#475569">• 62 Dynamic API Endpoints</text>
      <text x="315" y="229" font-size="10" fill="#475569">• Multi-Vertical Supply (Tours, Acts, Fleet)</text>
      <text x="315" y="245" font-size="10" fill="#475569">• 15-Minute Inventory Hold (BookingIntent)</text>
      <text x="315" y="261" font-size="10" fill="#475569">• Razorpay Order Creation & Webhook Rec</text>
      <text x="315" y="277" font-size="9.5" font-weight="600" fill="#059669">Escrow Hold & Automated Refund Engine</text>
    </g>
    <g filter="url(#sd)">
      <rect x="300" y="305" width="265" height="90" rx="10" fill="white" stroke="#e2e8f0"/>
      <text x="315" y="325" font-size="12" font-weight="800" fill="#0f172a">Compliance & Real-Time Engine</text>
      <text x="315" y="343" font-size="10" fill="#475569">• DPDP Act 2023 Clickwrap & Consent Logs</text>
      <text x="315" y="359" font-size="10" fill="#475569">• 6-Step Host KYC & AES-GCM Encrypted Vault</text>
      <text x="315" y="375" font-size="10" fill="#475569">• Socket.IO Real-time Trip Circle Rooms</text>
      <text x="315" y="389" font-size="9.5" font-weight="600" fill="#7c3aed">Pre/Post Vehicle Custody Inspection</text>
    </g>

    <line x1="580" y1="215" x2="625" y2="215" stroke="#059669" stroke-width="2.5" marker-end="url(#m1)" stroke-dasharray="6 4"/>

    <!-- LAYER 3: PERSISTENCE & SERVICES -->
    <rect x="625" y="20" width="240" height="390" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-dasharray="4 4"/>
    <text x="640" y="44" font-size="11" font-weight="800" fill="#64748b" letter-spacing="1">3. DATA & SERVICES</text>
    <g filter="url(#sd)">
      <rect x="640" y="65" width="210" height="95" rx="10" fill="white" stroke="#e2e8f0"/>
      <rect x="648" y="75" width="5" height="75" rx="2.5" fill="#059669"/>
      <text x="662" y="88" font-size="12" font-weight="800" fill="#0f172a">Neon PostgreSQL</text>
      <text x="662" y="105" font-size="10" fill="#475569">• Prisma ORM v7 Engine</text>
      <text x="662" y="121" font-size="10" fill="#475569">• 69 Models • 46 Enums</text>
      <text x="662" y="137" font-size="10" fill="#475569">• 28 Applied Migrations</text>
      <text x="662" y="151" font-size="9" font-weight="600" fill="#059669">ACID Transactions & Pooling</text>
    </g>
    <g filter="url(#sd)">
      <rect x="640" y="175" width="210" height="75" rx="10" fill="white" stroke="#e2e8f0"/>
      <rect x="648" y="185" width="5" height="55" rx="2.5" fill="#e11d48"/>
      <text x="662" y="198" font-size="12" font-weight="800" fill="#0f172a">Redis & BullMQ</text>
      <text x="662" y="215" font-size="10" fill="#475569">• In-Memory Rate Limiting</text>
      <text x="662" y="231" font-size="10" fill="#475569">• Booking Expiry Schedulers</text>
      <text x="662" y="245" font-size="9" font-weight="600" fill="#e11d48">Async Job Processing</text>
    </g>
    <g filter="url(#sd)">
      <rect x="640" y="265" width="210" height="130" rx="10" fill="white" stroke="#e2e8f0"/>
      <rect x="648" y="275" width="5" height="110" rx="2.5" fill="#d97706"/>
      <text x="662" y="288" font-size="12" font-weight="800" fill="#0f172a">External Cloud APIs</text>
      <text x="662" y="306" font-size="10" fill="#475569">• Razorpay Payments & Escrow</text>
      <text x="662" y="322" font-size="10" fill="#475569">• Cloudinary Multi-Asset CDN</text>
      <text x="662" y="338" font-size="10" fill="#475569">• Brevo SMTP Email Relay</text>
      <text x="662" y="354" font-size="10" fill="#475569">• Google OAuth 2.0 Auth API</text>
      <text x="662" y="370" font-size="10" fill="#475569">• Enterprise SAML 2.0 IdPs</text>
      <text x="662" y="386" font-size="9" font-weight="600" fill="#d97706">OpenAI Assistant API</text>
    </g>
  </svg>
  `;
}

function svgUiFlow() {
  return `
  <svg viewBox="0 0 880 220" width="100%" height="190" xmlns="http://www.w3.org/2000/svg" style="font-family:'Plus Jakarta Sans',sans-serif;">
    <defs>
      <marker id="m2" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#0284c7"/></marker>
    </defs>
    <!-- ROW 1: USER -->
    <rect x="15" y="15" width="120" height="45" rx="8" fill="#e0f2fe" stroke="#0284c7"/>
    <text x="75" y="35" font-size="11" font-weight="800" fill="#0369a1" text-anchor="middle">TRAVELER</text>
    <text x="75" y="48" font-size="9" fill="#0369a1" text-anchor="middle">Catalog & Search</text>

    <line x1="135" y1="37" x2="165" y2="37" stroke="#0284c7" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="165" y="15" width="125" height="45" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="227" y="34" font-size="10.5" font-weight="700" fill="#0f172a" text-anchor="middle">Product Details</text>
    <text x="227" y="47" font-size="9" fill="#64748b" text-anchor="middle">Tour/Act/Rental</text>

    <line x1="290" y1="37" x2="320" y2="37" stroke="#0284c7" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="320" y="15" width="130" height="45" rx="8" fill="#ecfeff" stroke="#a5f3fc"/>
    <text x="385" y="34" font-size="10.5" font-weight="700" fill="#0e7490" text-anchor="middle">15m Intent Lock</text>
    <text x="385" y="47" font-size="9" fill="#0e7490" text-anchor="middle">Inventory Reserved</text>

    <line x1="450" y1="37" x2="480" y2="37" stroke="#0284c7" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="480" y="15" width="125" height="45" rx="8" fill="#fffbeb" stroke="#fde68a"/>
    <text x="542" y="34" font-size="10.5" font-weight="700" fill="#92400e" text-anchor="middle">Clickwrap Consent</text>
    <text x="542" y="47" font-size="9" fill="#92400e" text-anchor="middle">Safety & Refund Policy</text>

    <line x1="605" y1="37" x2="635" y2="37" stroke="#0284c7" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="635" y="15" width="115" height="45" rx="8" fill="#ecfdf5" stroke="#a7f3d0"/>
    <text x="692" y="34" font-size="10.5" font-weight="700" fill="#065f46" text-anchor="middle">Razorpay PG</text>
    <text x="692" y="47" font-size="9" fill="#065f46" text-anchor="middle">HMAC Verified</text>

    <line x1="750" y1="37" x2="775" y2="37" stroke="#0284c7" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="775" y="15" width="90" height="45" rx="8" fill="#f5f3ff" stroke="#ddd6fe"/>
    <text x="820" y="34" font-size="10.5" font-weight="800" fill="#5b21b6" text-anchor="middle">Trip Circle</text>
    <text x="820" y="47" font-size="9" fill="#5b21b6" text-anchor="middle">Realtime Chat</text>

    <!-- ROW 2: HOST -->
    <rect x="15" y="85" width="120" height="45" rx="8" fill="#ecfdf5" stroke="#059669"/>
    <text x="75" y="105" font-size="11" font-weight="800" fill="#065f46" text-anchor="middle">HOST</text>
    <text x="75" y="118" font-size="9" fill="#065f46" text-anchor="middle">Studio Onboarding</text>

    <line x1="135" y1="107" x2="165" y2="107" stroke="#059669" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="165" y="85" width="125" height="45" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="227" y="104" font-size="10.5" font-weight="700" fill="#0f172a" text-anchor="middle">6-Step KYC</text>
    <text x="227" y="117" font-size="9" fill="#64748b" text-anchor="middle">Gov ID + Liveness</text>

    <line x1="290" y1="107" x2="320" y2="107" stroke="#059669" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="320" y="85" width="130" height="45" rx="8" fill="#ecfeff" stroke="#a5f3fc"/>
    <text x="385" y="104" font-size="10.5" font-weight="700" fill="#0e7490" text-anchor="middle">AES-GCM Vault</text>
    <text x="385" y="117" font-size="9" fill="#0e7490" text-anchor="middle">Bank Account Enc</text>

    <line x1="450" y1="107" x2="480" y2="107" stroke="#059669" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="480" y="85" width="125" height="45" rx="8" fill="#fffbeb" stroke="#fde68a"/>
    <text x="542" y="104" font-size="10.5" font-weight="700" fill="#92400e" text-anchor="middle">Safety Accord</text>
    <text x="542" y="117" font-size="9" fill="#92400e" text-anchor="middle">Host Agreement</text>

    <line x1="605" y1="107" x2="635" y2="107" stroke="#059669" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="635" y="85" width="115" height="45" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="692" y="104" font-size="10.5" font-weight="700" fill="#0f172a" text-anchor="middle">Supply Studios</text>
    <text x="692" y="117" font-size="9" fill="#64748b" text-anchor="middle">Tours/Acts/Fleet</text>

    <line x1="750" y1="107" x2="775" y2="107" stroke="#059669" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="775" y="85" width="90" height="45" rx="8" fill="#ecfdf5" stroke="#a7f3d0"/>
    <text x="820" y="104" font-size="10.5" font-weight="800" fill="#065f46" text-anchor="middle">Payout Desk</text>
    <text x="820" y="117" font-size="9" fill="#065f46" text-anchor="middle">Net Earnings</text>

    <!-- ROW 3: ADMIN -->
    <rect x="15" y="155" width="120" height="45" rx="8" fill="#f5f3ff" stroke="#7c3aed"/>
    <text x="75" y="175" font-size="11" font-weight="800" fill="#5b21b6" text-anchor="middle">ADMIN</text>
    <text x="75" y="188" font-size="9" fill="#5b21b6" text-anchor="middle">Governance Desk</text>

    <line x1="135" y1="177" x2="165" y2="177" stroke="#7c3aed" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="165" y="155" width="125" height="45" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="227" y="174" font-size="10.5" font-weight="700" fill="#0f172a" text-anchor="middle">KYC Adjudication</text>
    <text x="227" y="187" font-size="9" fill="#64748b" text-anchor="middle">Inspect ID & Selfie</text>

    <line x1="290" y1="177" x2="320" y2="177" stroke="#7c3aed" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="320" y="155" width="130" height="45" rx="8" fill="#ecfeff" stroke="#a5f3fc"/>
    <text x="385" y="174" font-size="10.5" font-weight="700" fill="#0e7490" text-anchor="middle">Listing Moderation</text>
    <text x="385" y="187" font-size="9" fill="#0e7490" text-anchor="middle">Approve/Reject</text>

    <line x1="450" y1="177" x2="480" y2="177" stroke="#7c3aed" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="480" y="155" width="125" height="45" rx="8" fill="#fffbeb" stroke="#fde68a"/>
    <text x="542" y="174" font-size="10.5" font-weight="700" fill="#92400e" text-anchor="middle">Policy Version CMS</text>
    <text x="542" y="187" font-size="9" fill="#92400e" text-anchor="middle">Force Re-consent</text>

    <line x1="605" y1="177" x2="635" y2="177" stroke="#7c3aed" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="635" y="155" width="115" height="45" rx="8" fill="#f8fafc" stroke="#cbd5e1"/>
    <text x="692" y="174" font-size="10.5" font-weight="700" fill="#0f172a" text-anchor="middle">Rental Disputes</text>
    <text x="692" y="187" font-size="9" fill="#64748b" text-anchor="middle">Evidence Review</text>

    <line x1="750" y1="177" x2="775" y2="177" stroke="#7c3aed" stroke-width="2" marker-end="url(#m2)"/>

    <rect x="775" y="155" width="90" height="45" rx="8" fill="#ecfdf5" stroke="#a7f3d0"/>
    <text x="820" y="174" font-size="10.5" font-weight="800" fill="#065f46" text-anchor="middle">Payout Runs</text>
    <text x="820" y="187" font-size="9" fill="#065f46" text-anchor="middle">Automated Batches</text>
  </svg>
  `;
}

function svgHostKyc() {
  return `
  <svg viewBox="0 0 880 180" width="100%" height="160" xmlns="http://www.w3.org/2000/svg" style="font-family:'Plus Jakarta Sans',sans-serif;">
    <defs>
      <marker id="m3" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#059669"/></marker>
    </defs>
    <!-- STEP 1-2 -->
    <rect x="15" y="30" width="180" height="110" rx="12" fill="white" stroke="#e2e8f0" stroke-width="1.5"/>
    <rect x="15" y="30" width="180" height="28" rx="12" fill="#f1f5f9"/>
    <text x="25" y="48" font-size="11" font-weight="800" fill="#334155">1. IDENTITY & GOV ID</text>
    <text x="25" y="76" font-size="10.5" fill="#475569">• Legal name, DOB (≥18)</text>
    <text x="25" y="94" font-size="10.5" fill="#475569">• Aadhaar, PAN, Passport, DL</text>
    <text x="25" y="112" font-size="10.5" fill="#475569">• Front & Back Image Proofs</text>

    <line x1="195" y1="85" x2="230" y2="85" stroke="#059669" stroke-width="2" marker-end="url(#m3)"/>

    <!-- STEP 3-4 -->
    <rect x="230" y="30" width="180" height="110" rx="12" fill="white" stroke="#e2e8f0" stroke-width="1.5"/>
    <rect x="230" y="30" width="180" height="28" rx="12" fill="#ecfdf5"/>
    <text x="240" y="48" font-size="11" font-weight="800" fill="#065f46">2. LIVENESS & ADDRESS</text>
    <text x="240" y="76" font-size="10.5" fill="#475569">• Biometric Selfie with ID</text>
    <text x="240" y="94" font-size="10.5" fill="#475569">• Operational Address</text>
    <text x="240" y="112" font-size="10.5" fill="#475569">• GSTIN / Business PAN</text>

    <line x1="410" y1="85" x2="445" y2="85" stroke="#059669" stroke-width="2" marker-end="url(#m3)"/>

    <!-- STEP 5 -->
    <rect x="445" y="30" width="190" height="110" rx="12" fill="white" stroke="#e2e8f0" stroke-width="1.5"/>
    <rect x="445" y="30" width="190" height="28" rx="12" fill="#ecfeff"/>
    <text x="455" y="48" font-size="11" font-weight="800" fill="#0e7490">3. AES-GCM BANK VAULT</text>
    <text x="455" y="76" font-size="10.5" fill="#475569">• Bank Acc & IFSC code</text>
    <text x="455" y="94" font-size="10.5" fill="#0e7490" font-weight="700">• AES-256-GCM Encryption</text>
    <text x="455" y="112" font-size="10.5" fill="#475569">• Masked View: •••• 5678</text>

    <line x1="635" y1="85" x2="670" y2="85" stroke="#059669" stroke-width="2" marker-end="url(#m3)"/>

    <!-- STEP 6 & ADJUDICATION -->
    <rect x="670" y="30" width="195" height="110" rx="12" fill="white" stroke="#e2e8f0" stroke-width="1.5"/>
    <rect x="670" y="30" width="195" height="28" rx="12" fill="#fdf4ff"/>
    <text x="680" y="48" font-size="11" font-weight="800" fill="#701a75">4. ADMIN ADJUDICATION</text>
    <text x="680" y="76" font-size="10.5" fill="#475569">• Host Safety Agreement</text>
    <text x="680" y="94" font-size="10.5" fill="#475569">• Admin Desk Review</text>
    <text x="680" y="112" font-size="10.5" fill="#059669" font-weight="700">• Role Promoted to HOST</text>
  </svg>
  `;
}

function svgCustody() {
  return `
  <svg viewBox="0 0 880 180" width="100%" height="160" xmlns="http://www.w3.org/2000/svg" style="font-family:'Plus Jakarta Sans',sans-serif;">
    <defs>
      <marker id="m4" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#0891b2"/></marker>
    </defs>
    <!-- STAGE 1: PRE TRIP -->
    <rect x="20" y="30" width="240" height="120" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
    <text x="35" y="55" font-size="12" font-weight="800" fill="#0f172a">PRE-TRIP CUSTODY (PICKUP)</text>
    <text x="35" y="80" font-size="11" fill="#475569">• Host logs starting Odometer & Fuel</text>
    <text x="35" y="98" font-size="11" fill="#475569">• 4-angle exterior & interior photos</text>
    <text x="35" y="116" font-size="11" fill="#475569">• Driving license & DL validation</text>
    <text x="35" y="134" font-size="10.5" font-weight="700" fill="#0284c7">Traveler reviews & countersigns</text>

    <line x1="260" y1="90" x2="315" y2="90" stroke="#0891b2" stroke-width="2.5" marker-end="url(#m4)"/>

    <!-- STAGE 2: ACTIVE TRIP -->
    <rect x="315" y="30" width="230" height="120" rx="12" fill="#ecfeff" stroke="#a5f3fc" stroke-width="1.5"/>
    <text x="330" y="55" font-size="12" font-weight="800" fill="#0e7490">ACTIVE TRIP & GPS TRACKING</text>
    <text x="330" y="80" font-size="11" fill="#155e75">• Statutory insurance coverage active</text>
    <text x="330" y="98" font-size="11" fill="#155e75">• 24/7 Roadside breakdown support</text>
    <text x="330" y="116" font-size="11" fill="#155e75">• Emergency Incident Reporting API</text>
    <text x="330" y="134" font-size="10.5" font-weight="700" fill="#0891b2">Full legal custody with traveler</text>

    <line x1="545" y1="90" x2="600" y2="90" stroke="#0891b2" stroke-width="2.5" marker-end="url(#m4)"/>

    <!-- STAGE 3: POST TRIP -->
    <rect x="600" y="30" width="260" height="120" rx="12" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
    <text x="615" y="55" font-size="12" font-weight="800" fill="#0f172a">POST-TRIP CUSTODY (RETURN)</text>
    <text x="615" y="80" font-size="11" fill="#475569">• Host logs return Odometer & Fuel</text>
    <text x="615" y="98" font-size="11" fill="#475569">• Return condition inspection photos</text>
    <text x="615" y="116" font-size="11" fill="#059669" font-weight="700">No damage: Security deposit released</text>
    <text x="615" y="134" font-size="10.5" fill="#e11d48">Dispute: Escalated to Admin arbitration</text>
  </svg>
  `;
}

function svgErDomain() {
  return `
  <svg viewBox="0 0 880 240" width="100%" height="200" xmlns="http://www.w3.org/2000/svg" style="font-family:'Plus Jakarta Sans',sans-serif;">
    <!-- DOMAIN 1: AUTH -->
    <rect x="15" y="20" width="155" height="200" rx="10" fill="#f8fafc" stroke="#0284c7" stroke-width="1.5"/>
    <rect x="15" y="20" width="155" height="26" rx="10" fill="#e0f2fe"/>
    <text x="25" y="37" font-size="10.5" font-weight="800" fill="#0369a1">AUTH & SSO DOMAIN</text>
    <text x="25" y="65" font-size="10" fill="#0f172a" font-weight="700">• User</text>
    <text x="25" y="82" font-size="10" fill="#0f172a" font-weight="700">• UserProfile</text>
    <text x="25" y="99" font-size="10" fill="#0f172a" font-weight="700">• Session</text>
    <text x="25" y="116" font-size="10" fill="#0f172a" font-weight="700">• RefreshToken</text>
    <text x="25" y="133" font-size="10" fill="#0f172a" font-weight="700">• UserDevice (Max 3)</text>
    <text x="25" y="150" font-size="10" fill="#0f172a" font-weight="700">• Organization</text>
    <text x="25" y="167" font-size="10" fill="#0f172a" font-weight="700">• SsoConfiguration</text>
    <text x="25" y="184" font-size="10" fill="#0f172a" font-weight="700">• SecurityEvent</text>

    <!-- DOMAIN 2: COMPLIANCE -->
    <rect x="185" y="20" width="160" height="200" rx="10" fill="#f8fafc" stroke="#059669" stroke-width="1.5"/>
    <rect x="185" y="20" width="160" height="26" rx="10" fill="#ecfdf5"/>
    <text x="195" y="37" font-size="10.5" font-weight="800" fill="#065f46">COMPLIANCE & TRUST</text>
    <text x="195" y="65" font-size="10" fill="#0f172a" font-weight="700">• Policy (5 Standard)</text>
    <text x="195" y="82" font-size="10" fill="#0f172a" font-weight="700">• PolicyConsent (Audit)</text>
    <text x="195" y="99" font-size="10" fill="#0f172a" font-weight="700">• Host</text>
    <text x="195" y="116" font-size="10" fill="#0f172a" font-weight="700">• KycApplication (AES)</text>
    <text x="195" y="133" font-size="10" fill="#0f172a" font-weight="700">• AuditLog</text>
    <text x="195" y="150" font-size="10" fill="#0f172a" font-weight="700">• Incident</text>
    <text x="195" y="167" font-size="10" fill="#0f172a" font-weight="700">• IncidentEvent</text>
    <text x="195" y="184" font-size="10" fill="#0f172a" font-weight="700">• TravelerReport</text>

    <!-- DOMAIN 3: CATALOG -->
    <rect x="360" y="20" width="160" height="200" rx="10" fill="#f8fafc" stroke="#d97706" stroke-width="1.5"/>
    <rect x="360" y="20" width="160" height="26" rx="10" fill="#fffbeb"/>
    <text x="370" y="37" font-size="10.5" font-weight="800" fill="#92400e">INVENTORY & SUPPLY</text>
    <text x="370" y="65" font-size="10" fill="#0f172a" font-weight="700">• Tour</text>
    <text x="370" y="82" font-size="10" fill="#0f172a" font-weight="700">• TourItineraryDay</text>
    <text x="370" y="99" font-size="10" fill="#0f172a" font-weight="700">• Activity</text>
    <text x="370" y="116" font-size="10" fill="#0f172a" font-weight="700">• ActivitySlot (Capacity)</text>
    <text x="370" y="133" font-size="10" fill="#0f172a" font-weight="700">• Rental (Fleet units)</text>
    <text x="370" y="150" font-size="10" fill="#0f172a" font-weight="700">• RentalDetails</text>
    <text x="370" y="167" font-size="10" fill="#0f172a" font-weight="700">• Review</text>
    <text x="370" y="184" font-size="10" fill="#0f172a" font-weight="700">• WishlistItem</text>

    <!-- DOMAIN 4: TRANSACTIONS -->
    <rect x="535" y="20" width="165" height="200" rx="10" fill="#f8fafc" stroke="#0891b2" stroke-width="1.5"/>
    <rect x="535" y="20" width="165" height="26" rx="10" fill="#ecfeff"/>
    <text x="545" y="37" font-size="10.5" font-weight="800" fill="#0e7490">TRANSACTIONS & PG</text>
    <text x="545" y="65" font-size="10" fill="#0f172a" font-weight="700">• TourBooking</text>
    <text x="545" y="82" font-size="10" fill="#0f172a" font-weight="700">• ActivityBooking</text>
    <text x="545" y="99" font-size="10" fill="#0f172a" font-weight="700">• RentalBooking</text>
    <text x="545" y="116" font-size="10" fill="#0f172a" font-weight="700">• Payment (Razorpay)</text>
    <text x="545" y="133" font-size="10" fill="#0f172a" font-weight="700">• Payout (Host net)</text>
    <text x="545" y="150" font-size="10" fill="#0f172a" font-weight="700">• Refund (Escrow return)</text>
    <text x="545" y="167" font-size="10" fill="#0f172a" font-weight="700">• Coupon & CouponRedempt</text>
    <text x="545" y="184" font-size="10" fill="#0f172a" font-weight="700">• BookingTimeline</text>

    <!-- DOMAIN 5: OPERATIONS -->
    <rect x="715" y="20" width="150" height="200" rx="10" fill="#f8fafc" stroke="#7c3aed" stroke-width="1.5"/>
    <rect x="715" y="20" width="150" height="26" rx="10" fill="#f5f3ff"/>
    <text x="725" y="37" font-size="10.5" font-weight="800" fill="#5b21b6">CUSTODY & CHAT</text>
    <text x="725" y="65" font-size="10" fill="#0f172a" font-weight="700">• RentalInspection</text>
    <text x="725" y="82" font-size="10" fill="#0f172a" font-weight="700">• TourChatRoom</text>
    <text x="725" y="99" font-size="10" fill="#0f172a" font-weight="700">• TourMessage</text>
    <text x="725" y="116" font-size="10" fill="#0f172a" font-weight="700">• TourParticipant</text>
    <text x="725" y="133" font-size="10" fill="#0f172a" font-weight="700">• TourWaitlist</text>
    <text x="725" y="150" font-size="10" fill="#0f172a" font-weight="700">• NotificationDelivery</text>
    <text x="725" y="167" font-size="10" fill="#0f172a" font-weight="700">• Post & PostComment</text>
    <text x="725" y="184" font-size="10" fill="#0f172a" font-weight="700">• ModerationLog</text>
  </svg>
  `;
}

function svgUnitEconomics() {
  return `
  <svg viewBox="0 0 880 160" width="100%" height="140" xmlns="http://www.w3.org/2000/svg" style="font-family:'Plus Jakarta Sans',sans-serif;">
    <rect x="15" y="20" width="850" height="120" rx="12" fill="#0f172a"/>
    <text x="35" y="44" font-size="12" font-weight="800" fill="#38bdf8" letter-spacing="1">WATERFALL FINANCIAL LEDGER (SAMPLE ₹10,000 TOUR BOOKING)</text>
    <rect x="35" y="60" width="590" height="32" rx="6" fill="#10b981"/>
    <text x="45" y="80" font-size="11" font-weight="800" fill="white">Host Net Payout: ₹8,800 (88.0%)</text>
    <rect x="630" y="60" width="140" height="32" rx="6" fill="#0284c7"/>
    <text x="640" y="80" font-size="11" font-weight="800" fill="white">Platform Take: ₹1,000 (10%)</text>
    <rect x="775" y="60" width="90" height="32" rx="6" fill="#f59e0b"/>
    <text x="782" y="80" font-size="11" font-weight="800" fill="white">PG Fee: ₹200 (2%)</text>
    <text x="35" y="115" font-size="10" fill="#94a3b8">• 12% Base Tour Take Rate • Razorpay Gateway 2.0% • Net Contribution Margin: 9.7% • 14-Day Escrow Float Period</text>
  </svg>
  `;
}

// ============================================================================
// MAIN GENERATOR EXECUTION
// ============================================================================

async function main() {
  console.log(
    "==================================================================",
  );
  console.log("🚀 COMPILING ENCYCLOPEDIC MASTER TRAVELS PRO DOCUMENTATION PDF");
  console.log(
    "==================================================================",
  );

  const tempHtmlPath = path.resolve(
    "scratch/travels_pro_encyclopedic_documentation.html",
  );
  const rootPdfPath = path.resolve(
    "../Travels_Pro_Complete_Project_Documentation.pdf",
  );
  const publicPdfPath = path.resolve(
    "../Travels_frontend/public/docs/Travels_Pro_Complete_Project_Documentation.pdf",
  );

  console.log("\n[1/4] Generating all 5 volumes and 12 chapters...");
  const part1 = getPart01(svgTopology());
  const part2 = getPart02(svgUiFlow(), svgHostKyc(), svgCustody());
  const part3 = getPart03();
  const part4 = getPart04(svgErDomain());
  const part5 = getPart05(svgUnitEconomics());

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Travels Pro - Master System Specification & Technical Blueprint</title>
  <style>${STYLES}</style>
</head>
<body>
  ${part1}
  ${part2}
  ${part3}
  ${part4}
  ${part5}
</body>
</html>`;

  fs.writeFileSync(tempHtmlPath, fullHtml, "utf8");
  console.log(
    `✓ Master HTML written to ${tempHtmlPath} (${(fullHtml.length / 1024).toFixed(1)} KB)`,
  );

  console.log(
    "\n[2/4] Executing Microsoft Edge Headless engine for vector PDF compilation...",
  );
  const edgeExe =
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
  const cmd = `"${edgeExe}" --headless --disable-gpu --run-all-compositor-stages-before-draw --no-pdf-header-footer --print-to-pdf="${rootPdfPath}" "file://${tempHtmlPath}"`;
  console.log(`Running: ${cmd}`);
  execSync(cmd, { stdio: "inherit" });

  console.log("\n[3/4] Mirroring master PDF to web public assets...");
  fs.copyFileSync(rootPdfPath, publicPdfPath);

  const stats = fs.statSync(rootPdfPath);
  console.log(
    `✓ Master PDF at root: ${rootPdfPath} (${(stats.size / 1024).toFixed(1)} KB)`,
  );
  console.log(`✓ Master PDF at public web assets: ${publicPdfPath}`);

  console.log("\n[4/4] Verifying final page count...");
  const buf = fs.readFileSync(rootPdfPath);
  const matches = buf.toString("binary").match(/\/Type\s*\/Page\b/g);
  console.log(
    `✓ Final Verified PDF Page Count: ${matches ? matches.length : "unknown"} pages`,
  );

  console.log(
    "\n==================================================================",
  );
  console.log("🎉 MASTER ENCYCLOPEDIC PROJECT DOCUMENTATION PDF GENERATED!");
  console.log(
    "==================================================================",
  );
}

main().catch((err) => {
  console.error("FATAL ERROR generating master documentation PDF:", err);
  process.exit(1);
});
