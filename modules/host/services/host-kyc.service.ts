import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  decryptSensitiveField,
  encryptSensitiveField,
  maskIdentityNumber,
} from "@/lib/field-encryption";

const assetId = z
  .string()
  .trim()
  .min(3)
  .max(300)
  .regex(
    /^(?![./])(?!.*\.\.)[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/,
    "Invalid uploaded document reference"
  );

export const hostKycSchema = z
  .object({
    hostType: z.enum(["INDIVIDUAL", "REGISTERED_BUSINESS"]).optional().default("INDIVIDUAL"),
    firstName: z.string().trim().min(2).max(80),
    lastName: z.string().trim().min(1).max(80),
    dateOfBirth: z.coerce.date(),
    nationality: z.string().trim().min(2).max(80),
    idType: z.enum(["aadhaar", "pan", "passport", "driver_license", "voter_id"]),
    idNumber: z.string().trim().min(4).max(40),
    idFrontImage: assetId,
    idBackImage: assetId.optional().or(z.literal("")),
    selfieImage: assetId.optional().or(z.literal("")),
    // Address fields
    streetAddress: z.string().trim().max(200).optional().or(z.literal("")),
    city: z.string().trim().max(80).optional().or(z.literal("")),
    state: z.string().trim().max(80).optional().or(z.literal("")),
    postalCode: z.string().trim().max(20).optional().or(z.literal("")),
    country: z.string().trim().max(80).optional().default("India"),
    addressProofType: z.string().trim().max(50).optional().or(z.literal("")),
    addressProof: assetId.optional().or(z.literal("")),
    // Business fields
    businessName: z.string().trim().max(160).optional().or(z.literal("")),
    gstin: z.string().trim().max(30).optional().or(z.literal("")),
    businessPan: z.string().trim().max(20).optional().or(z.literal("")),
    businessLicense: assetId.optional().or(z.literal("")),
    // Bank & Payout fields
    bankAccountName: z.string().trim().max(120).optional().or(z.literal("")),
    bankAccountNumber: z.string().trim().min(6).max(30).optional().or(z.literal("")),
    bankIfsc: z.string().trim().max(20).optional().or(z.literal("")),
    bankName: z.string().trim().max(100).optional().or(z.literal("")),
    cancelledChequeImage: assetId.optional().or(z.literal("")),
    // Emergency & Safety fields
    emergencyContactName: z.string().trim().max(100).optional().or(z.literal("")),
    emergencyContactPhone: z.string().trim().max(30).optional().or(z.literal("")),
    emergencyContactRelation: z.string().trim().max(50).optional().or(z.literal("")),
    safetyCertImage: assetId.optional().or(z.literal("")),
    agreedToHostSafetyPolicy: z.boolean().optional().default(true),
    consentGiven: z
      .boolean()
      .refine((val) => val === true, "Explicit consent under India DPDP Act 2023 is required to process identity verification")
      .refine(
        (val) => val === true,
        "Explicit consent under India DPDP Act 2023 is required to process identity verification"
      )
      .optional()
      .default(true),
  })
  .strict()
  .superRefine((value, context) => {
    const age = (Date.now() - value.dateOfBirth.getTime()) / 31_556_952_000;
    if (age < 18 || age > 100) {
      context.addIssue({
        code: "custom",
        path: ["dateOfBirth"],
        message: "Host must be between 18 and 100 years old",
      });
    }
    if (
      value.idType === "aadhaar" &&
      !/^\d{12}$/.test(value.idNumber.replace(/\s/g, ""))
    ) {
      context.addIssue({
        code: "custom",
        path: ["idNumber"],
        message: "Aadhaar number must contain 12 digits",
      });
    }
    if (
      value.idType === "pan" &&
      !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(value.idNumber.trim())
    ) {
      context.addIssue({
        code: "custom",
        path: ["idNumber"],
        message: "PAN must follow standard 10-character alphanumeric format (e.g. ABCDE1234F)",
      });
    }
  });

function maskBankAccount(acc: string | null | undefined): string | null {
  if (!acc) return null;
  const clean = acc.trim();
  if (clean.length <= 4) return clean;
  return `•••• •••• ${clean.slice(-4)}`;
}

export async function getLatestHostKyc(hostId: string) {
  const application = await prisma.kycApplication.findFirst({
    where: { hostId },
    orderBy: { createdAt: "desc" },
  });
  if (!application) return null;

  let maskedBankNumber: string | null = null;
  if (application.bankAccountNumber) {
    try {
      const decrypted = decryptSensitiveField(application.bankAccountNumber);
      maskedBankNumber = maskBankAccount(decrypted);
    } catch {
      maskedBankNumber = "•••• ••••";
    }
  }

  return {
    id: application.id,
    status: application.status,
    hostType: application.hostType,
    firstName: application.firstName,
    lastName: application.lastName,
    dateOfBirth: application.dateOfBirth?.toISOString() ?? null,
    nationality: application.nationality,
    idType: application.idType,
    maskedIdNumber: maskIdentityNumber(
      decryptSensitiveField(application.idNumber)
    ),
    idFrontUrl: application.idFrontUrl,
    idBackUrl: application.idBackUrl,
    selfieUrl: application.selfieUrl,
    streetAddress: application.streetAddress,
    city: application.city,
    state: application.state,
    postalCode: application.postalCode,
    country: application.country,
    addressProofType: application.addressProofType,
    addressProofUrl: application.addressProofUrl,
    businessName: application.businessName,
    gstin: application.gstin,
    businessPan: application.businessPan,
    businessDocUrl: application.businessDocUrl,
    bankAccountName: application.bankAccountName,
    maskedBankAccountNumber: maskedBankNumber,
    bankIfsc: application.bankIfsc,
    bankName: application.bankName,
    cancelledChequeUrl: application.cancelledChequeUrl,
    emergencyContactName: application.emergencyContactName,
    emergencyContactPhone: application.emergencyContactPhone,
    emergencyContactRelation: application.emergencyContactRelation,
    safetyCertUrl: application.safetyCertUrl,
    agreedToHostSafetyPolicy: application.agreedToHostSafetyPolicy,
    submittedAt: application.submittedAt.toISOString(),
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    rejectionReason: application.rejectionReason,
    resubmissionAllowed: application.resubmissionAllowed,
  };
}

export async function submitHostKyc(hostId: string, raw: unknown) {
  const input = hostKycSchema.parse(raw);
  const host = await prisma.host.findUnique({
    where: { id: hostId },
    select: { id: true, userId: true },
  });
  if (!host) {
    throw Object.assign(new Error("Host profile not found"), { statusCode: 404 });
  }

  const latest = await prisma.kycApplication.findFirst({
    where: { hostId },
    orderBy: { createdAt: "desc" },
  });

  if (latest?.status === "PENDING") {
    throw Object.assign(
      new Error("A KYC application is already under review"),
      { statusCode: 409 }
    );
  }
  if (latest?.status === "APPROVED") {
    throw Object.assign(new Error("KYC is already approved"), {
      statusCode: 409,
    });
  }
  if (latest?.status === "REJECTED" && !latest.resubmissionAllowed) {
    throw Object.assign(new Error("KYC resubmission requires admin approval"), {
      statusCode: 403,
    });
  }

  return prisma.$transaction(async (tx) => {
    const encryptedBankNumber = input.bankAccountNumber
      ? encryptSensitiveField(input.bankAccountNumber)
      : null;

    const application = await tx.kycApplication.create({
      data: {
        hostId,
        hostType: input.hostType || "INDIVIDUAL",
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth: input.dateOfBirth,
        nationality: input.nationality,
        idType: input.idType,
        idNumber: encryptSensitiveField(input.idNumber),
        idFrontUrl: input.idFrontImage,
        idBackUrl: input.idBackImage || null,
        selfieUrl: input.selfieImage || null,
        streetAddress: input.streetAddress || null,
        city: input.city || null,
        state: input.state || null,
        postalCode: input.postalCode || null,
        country: input.country || "India",
        addressProofType: input.addressProofType || null,
        addressProofUrl: input.addressProof || null,
        businessName: input.businessName || null,
        gstin: input.gstin || null,
        businessPan: input.businessPan || null,
        businessDocUrl: input.businessLicense || null,
        bankAccountName: input.bankAccountName || null,
        bankAccountNumber: encryptedBankNumber,
        bankIfsc: input.bankIfsc || null,
        bankName: input.bankName || null,
        cancelledChequeUrl: input.cancelledChequeImage || null,
        emergencyContactName: input.emergencyContactName || null,
        emergencyContactPhone: input.emergencyContactPhone || null,
        emergencyContactRelation: input.emergencyContactRelation || null,
        safetyCertUrl: input.safetyCertImage || null,
        agreedToHostSafetyPolicy: Boolean(input.agreedToHostSafetyPolicy),
        safetyPolicyAgreedAt: new Date(),
        status: "PENDING",
        reviewNotes: `DPDP Act 2023 voluntary identity & host safety verification consent recorded at ${new Date().toISOString()}`,
      },
    });

    await tx.host.update({
      where: { id: hostId },
      data: { kycStatus: "PENDING", isApproved: false, isVerified: false },
    });

    // Automatically record HOST_SAFETY_AGREEMENT consent if active policy exists
    const activeSafetyPolicy = await tx.policy.findFirst({
      where: { type: "HOST_SAFETY_AGREEMENT", isActive: true },
    });
    if (activeSafetyPolicy) {
      await tx.policyConsent.create({
        data: {
          userId: host.userId,
          policyId: activeSafetyPolicy.id,
          policyType: "HOST_SAFETY_AGREEMENT",
          policyVersion: activeSafetyPolicy.version,
          context: "HOST_KYC",
        },
      });
    }

    return {
      id: application.id,
      status: application.status,
      submittedAt: application.submittedAt.toISOString(),
    };
  });
}
