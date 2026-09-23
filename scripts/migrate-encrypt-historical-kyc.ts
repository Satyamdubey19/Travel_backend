/**
 * Historical Plaintext KYC Number Encryption Migration Script
 * Scans KycApplication records and re-encrypts any plaintext identity numbers
 * into the standard AES-256-GCM format (enc:v1:iv:tag:ciphertext).
 * 
 * Usage:
 *   npx tsx scripts/migrate-encrypt-historical-kyc.ts [--dry-run]
 */

import { prisma } from "@/lib/prisma";
import { encryptSensitiveField } from "@/lib/field-encryption";

async function main() {
  const isDryRun = process.argv.includes("--dry-run");

  console.log("================================================================================");
  console.log(`[KYC Encryption Migration] Starting scan ${isDryRun ? "(DRY RUN MODE)" : "(LIVE UPDATE)"}`);
  console.log("================================================================================");

  const applications = await prisma.kycApplication.findMany({
    select: { id: true, hostId: true, idNumber: true, idType: true, submittedAt: true },
    orderBy: { submittedAt: "asc" },
  });

  console.log(`Total KYC Applications found in database: ${applications.length}`);

  const plaintextRecords = applications.filter((app) => !app.idNumber.startsWith("enc:v1:"));

  console.log(`Unencrypted/Plaintext records found: ${plaintextRecords.length}`);

  if (plaintextRecords.length === 0) {
    console.log("✓ All KYC identity records are already securely encrypted with AES-256-GCM.");
    await prisma.$disconnect();
    return;
  }

  let updatedCount = 0;

  for (const record of plaintextRecords) {
    console.log(`Processing KYC record ID: ${record.id} (Type: ${record.idType}, Submitted: ${record.submittedAt.toISOString()})`);

    const encrypted = encryptSensitiveField(record.idNumber);

    if (!isDryRun) {
      await prisma.kycApplication.update({
        where: { id: record.id },
        data: { idNumber: encrypted },
      });
      updatedCount++;
    } else {
      console.log(`  [DRY RUN] Would encrypt plaintext string of length ${record.idNumber.length} -> ${encrypted.slice(0, 20)}...`);
    }
  }

  console.log("================================================================================");
  if (isDryRun) {
    console.log(`[DRY RUN COMPLETE] ${plaintextRecords.length} records require encryption.`);
    console.log("To execute live migration, run: npx tsx scripts/migrate-encrypt-historical-kyc.ts");
  } else {
    console.log(`[MIGRATION COMPLETE] Successfully encrypted ${updatedCount} KYC records.`);
    console.log("All historical KYC numbers are now protected with AES-256-GCM authenticated encryption.");
  }
  console.log("================================================================================");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[Migration Failed]", err);
  process.exit(1);
});

