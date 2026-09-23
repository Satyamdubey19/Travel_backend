import { prisma } from "../lib/prisma";
import type { PolicyType } from "@prisma/client";

const defaultPolicies: Array<{
  type: PolicyType;
  title: string;
  version: string;
  summary: string;
  content: string;
}> = [
  {
    type: "TERMS_OF_SERVICE",
    title: "Platform Terms of Service",
    version: "1.0",
    summary:
      "Governs use of the Travels Pro platform, user obligations, marketplace intermediary role under the Indian Information Technology Act, bookings, payments, and dispute resolution.",
    content: `# Travels Pro Terms of Service (Version 1.0)
*Effective Date: April 1, 2026*

## 1. Introduction & Acceptance
Welcome to Travels Pro ("Platform", "we", "us", or "our"). By registering an account, accessing, or using our marketplace platform, you ("User", "Traveler", or "Host") enter into a legally binding agreement governed by these Terms of Service, our Privacy Policy, and any supplemental terms applicable to specific services.

If you do not agree to these Terms, you must not access or use the Platform.

## 2. Platform Intermediary Role
Travels Pro operates as an online technology intermediary providing a marketplace connecting travelers with independent third-party hosts offering tours, local activities, accommodations, and vehicle rentals. 
Travels Pro is not an owner, operator, provider, or agent of the travel services, experiences, or vehicles listed by hosts, unless explicitly stated otherwise. Each host is an independent contractor solely responsible for the fulfillment, safety, and quality of their offerings.

## 3. Eligibility & User Accounts
- You must be at least 18 years old to create an account or make a booking.
- You agree to provide true, accurate, current, and complete information during registration and keep your account details updated.
- You are solely responsible for maintaining the confidentiality of your login credentials and for all activities that occur under your account.
- Sharing accounts or unauthorized access to other accounts is strictly prohibited.

## 4. Bookings, Pricing & Payments
- All reservations made through the Platform are contracts directly between the Traveler and the Host.
- Prices are displayed in Indian Rupees (INR) or applicable local currency and include applicable platform fees, government taxes (GST), and service charges.
- Payment processing is facilitated via authorized RBI-licensed payment gateways (e.g., Razorpay). By initiating a transaction, you authorize payment of the total amount.
- Payouts to hosts are processed following verified completion of the booking, subject to host KYC verification and deduction of applicable platform commissions and statutory withholding taxes (TDS).

## 5. User Conduct & Prohibited Activities
You agree not to:
- Violate any applicable local, state, national, or international laws or regulations.
- Post fraudulent, deceptive, defamatory, obscene, or infringing content.
- Circumvent the Platform's booking and payment systems to avoid fees.
- Harass, intimidate, discriminate against, or harm any host, traveler, or community member.
- Use automated systems, bots, or scrapers to extract data without express written permission.

## 6. Intellectual Property
All content, trademarks, platform logos, designs, algorithms, and source code are the exclusive intellectual property of Travels Pro and its licensors. You are granted a limited, revocable, non-exclusive license to use the Platform solely for personal, non-commercial travel planning.

## 7. Limitation of Liability
To the maximum extent permitted by applicable law, Travels Pro shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, personal injury, property damage, or distress arising out of your use of the Platform or services provided by third-party hosts.

## 8. Governing Law & Dispute Resolution
These Terms are governed by and construed in accordance with the laws of the Republic of India. Any disputes arising hereunder shall be subject to the exclusive jurisdiction of the competent courts in New Delhi, India.

## 9. Modifications & Notice
We reserve the right to modify these Terms at any time. When material changes are made, we will publish the updated version, update the "Effective Date", and prompt you for re-consent upon your next login or transaction.`,
  },
  {
    type: "PRIVACY_POLICY",
    title: "Privacy & Personal Data Protection Policy",
    version: "1.0",
    summary:
      "Complies with India Digital Personal Data Protection (DPDP) Act 2023. Outlines personal identity, location, payment, and KYC document handling with AES-256-GCM encryption and data principal rights.",
    content: `# Privacy & Personal Data Protection Policy (Version 1.0)
*Effective Date: April 1, 2026*

## 1. Statutory Commitment
Travels Pro is committed to safeguarding your personal data in accordance with the **Digital Personal Data Protection Act, 2023 (DPDP Act 2023)** and the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.

## 2. Data We Collect
We collect personal data that you provide directly to us or that is automatically generated during platform use:
- **Identity & Contact Data**: Full legal name, date of birth, nationality, email address, phone number, and profile photographs.
- **Host KYC & Verification Data**: Government identity documents (Aadhaar, Passport, PAN, Driving License), live facial selfies with ID, residential address proofs, business licenses (GSTIN), and bank account details / cancelled cheques.
- **Transactional & Payment Data**: Booking history, transaction amounts, payment references (we do not store complete credit/debit card numbers; tokenization is handled by RBI-compliant payment aggregators).
- **Technical & Device Data**: IP addresses, browser types, operating systems, device identifiers, login timestamps, and session security telemetry.
- **Location Data**: Precise or approximate geolocation when searching nearby tours, activities, or rentals (only with explicit device permissions).

## 3. Legal Basis & Purpose of Processing
We process your personal data solely for specified, lawful purposes with your verifiable consent:
- Enabling account authentication, multi-factor security, and fraud prevention.
- Facilitating reservations, host communications, and transaction execution.
- Conducting mandatory Host KYC identity verification to guarantee community safety.
- Complying with statutory reporting, tax (GST / TDS), and law enforcement obligations.

## 4. Encryption & Security Vaulting
- Sensitive identity numbers (Aadhaar, PAN) and banking account numbers are encrypted at rest using industry-standard **AES-256-GCM** authenticated encryption with hardware security key derivation.
- KYC documents are vaulted with short-lived, signed access tokens restricted strictly to authorized compliance officers.
- Passwords are salted and hashed using bcrypt with adaptive cost parameters (cost factor 12).

## 5. Data Principal Rights
Under the DPDP Act 2023, you possess explicit rights regarding your personal data:
- **Right to Access**: Request a summary of personal data processed by Travels Pro.
- **Right to Correction & Erasure**: Request correction of inaccurate data or deletion of data no longer required for statutory purposes.
- **Right of Grievance Redressal**: File complaints with our designated Data Protection Officer (DPO).
- **Right to Nominate**: Nominate an individual to exercise data rights in the event of incapacity.

To exercise any of these rights, contact our Data Protection Team at \`privacy@travelspro.com\`.

## 6. Data Retention & Deletion
We retain personal data only for as long as necessary to fulfill the purposes for which it was collected, or as mandated by statutory financial and tax recordkeeping laws (typically 7 years for financial records). Upon account deletion, PII is irrevocably purged or anonymized, subject to regulatory preservation holds.`,
  },
  {
    type: "HOST_SAFETY_AGREEMENT",
    title: "Host Safety Agreement & Code of Conduct",
    version: "1.0",
    summary:
      "Mandatory standards for hosts providing tours, experiences, and rentals. Requires emergency preparedness, valid licensing, anti-discrimination, accurate listing descriptions, and immediate incident reporting.",
    content: `# Host Safety Agreement & Code of Conduct (Version 1.0)
*Effective Date: April 1, 2026*

## 1. Core Commitment to Safety
As a verified Host on Travels Pro, you are the cornerstone of guest trust. By offering tours, activities, or vehicle rentals, you agree to maintain the highest standards of safety, professionalism, and community respect.

## 2. Emergency Preparedness & Safety Equipment
- **First Aid**: All hosts conducting physical outdoor tours or activities must maintain a fully stocked, non-expired First Aid kit on site or in transit.
- **Safety Gear**: Hosts must provide certified, well-maintained safety equipment (helmets, life jackets, harnesses, communication radios) appropriate to the activity.
- **Emergency Protocols**: Hosts must possess clear evacuation procedures and maintain active local emergency contacts (police, medical, forest department).

## 3. Vehicle & Equipment Maintenance Standards (Rentals)
For hosts offering vehicle rentals (cars, bikes, scooters):
- Vehicles must possess valid registration (RC), active third-party commercial insurance, and Pollution Under Control (PUC) certificates.
- Complete pre-trip and post-trip digital custody inspections documenting fuel level, odometer, and existing cosmetic damage.
- Regular maintenance schedules (brakes, tires, steering, fluid levels) must be logged and verified.

## 4. Accurate Listings & Honest Pricing
- Listing photographs, descriptions, itineraries, and inclusions must faithfully reflect the actual experience provided.
- Hidden fees, unannounced surcharges, or on-site cash demands are strictly prohibited and grounds for immediate termination.

## 5. Anti-Discrimination & Harassment Zero-Tolerance
- You must welcome travelers regardless of race, ethnicity, nationality, religion, gender identity, sexual orientation, disability, or marital status.
- Physical, verbal, sexual harassment, intimidation, or invasive surveillance (e.g. concealed cameras in private spaces) results in immediate permanent ban, forfeiture of pending payouts, and criminal reporting.

## 6. Incident Reporting
Any accident, injury, medical emergency, or security incident occurring during a booking must be reported to the Travels Pro Safety Operations Center within 2 hours of stabilization.`,
  },
  {
    type: "TRAVELER_SAFETY_POLICY",
    title: "Traveler Safety & Community Guidelines",
    version: "1.0",
    summary:
      "Guidelines for travelers participating in tours, activities, and vehicle rentals. Enforces respect for host property, adherence to safety briefings, local environmental guidelines, and emergency reporting.",
    content: `# Traveler Safety & Community Guidelines (Version 1.0)
*Effective Date: April 1, 2026*

## 1. Respectful & Safe Travel
Travels Pro connects travelers with passionate local hosts. Every traveler agrees to treat hosts, fellow participants, guides, and local host communities with dignity and respect.

## 2. Adherence to Safety Instructions
- Travelers must strictly heed instructions provided by guides and instructors during high-altitude treks, water sports, wildlife safaris, and adventure activities.
- Do not stray from marked trails, enter restricted wilderness zones, or engage in reckless behavior that endangers yourself or others.

## 3. Substance & Alcohol Restrictions
- Operating rental vehicles or participating in high-risk physical activities under the influence of alcohol, narcotics, or non-prescribed intoxicating substances is strictly prohibited.
- Hosts reserve the right to deny participation to any traveler exhibiting intoxication, with no refund entitlement.

## 4. Vehicle Care & Traffic Compliance (Rentals)
When renting a vehicle through Travels Pro:
- You must hold a valid, unexpired Driving License appropriate for the vehicle category.
- You agree to abide by all motor vehicle regulations, speed limits, and helmet/seatbelt laws.
- Any traffic fines, toll violations, or vehicle damage incurred during the rental custody period are the sole financial responsibility of the renter.

## 5. Environmental & Cultural Sensitivity
- Practice "Leave No Trace" principles: do not litter, disturb wildlife, or remove natural/archaeological artifacts.
- Respect local customs, dress codes, and photography guidelines at religious or tribal heritage sites.`,
  },
  {
    type: "CANCELLATION_POLICY",
    title: "Standard Cancellation & Refund Policy",
    version: "1.0",
    summary:
      "Transparent cancellation tiers, refund timelines, force majeure weather exemptions, and dispute resolution guidelines for all tours, activities, and vehicle rentals.",
    content: `# Standard Cancellation & Refund Policy (Version 1.0)
*Effective Date: April 1, 2026*

## 1. Cancellation Tiers for Travelers
Unless a customized tier is explicitly declared on the specific listing page, the standard platform cancellation schedule applies:
- **Flexible Tier (Cancellation > 48 hours prior to start)**: 100% refund of the total booking price, minus nominal payment gateway processing charges.
- **Standard Tier (Cancellation between 24 and 48 hours prior to start)**: 50% refund of the booking amount.
- **Late Cancellation (Cancellation < 24 hours prior to start or No-Show)**: Non-refundable. The host receives full scheduled payout to compensate for reserved capacity.

## 2. Host-Initiated Cancellations
If a Host cancels a confirmed reservation:
- The Traveler receives an immediate **100% full refund** including all fees.
- The Host may incur penalty points, listing rank demotion, and cancellation administration fees unless the cancellation was due to verified force majeure.

## 3. Weather Emergencies & Force Majeure
Full refunds or fee-free rescheduling are provided in events of:
- Government-declared travel bans, road closures, or curfew.
- Severe weather warnings (landslides, flash floods, cyclones, extreme blizzards) officially issued by the India Meteorological Department (IMD) or local disaster management authorities making the activity hazardous.

## 4. Refund Processing Timelines
- Approved refunds are credited back to the original payment method within 5 to 7 business days, in compliance with banking settlement cycles.
- For queries or disputes, submit a ticket via \`support@travelspro.com\` or the in-app Resolution Center.`,
  },
];

async function main() {
  console.log("Seeding standard production policies...");

  for (const policy of defaultPolicies) {
    const existing = await prisma.policy.findFirst({
      where: { type: policy.type, version: policy.version },
    });

    if (!existing) {
      await prisma.policy.create({
        data: {
          type: policy.type,
          title: policy.title,
          version: policy.version,
          summary: policy.summary,
          content: policy.content,
          isActive: true,
          effectiveDate: new Date(),
        },
      });
      console.log(`  ✓ Created ${policy.type} (v${policy.version})`);
    } else {
      console.log(`  - Already exists: ${policy.type} (v${policy.version})`);
    }
  }

  console.log("Standard policies seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

