import { NextRequest, NextResponse } from "next/server";
import cloudinary from "@/lib/cloudinary";
import { requireUser } from "@/utils/user-auth";
import { requireHost, requireHostApplicant } from "@/utils/host-auth";
import { prisma } from "@/lib/prisma";
import { validateUploadedFileSafety } from "@/lib/file-security";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_KYC_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function errorStatus(error: unknown) {
  if (typeof error === "object" && error && "statusCode" in error) {
    return Number((error as { statusCode?: number }).statusCode) || 500;
  }
  return 500;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const missingConfig = [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ].filter((key) => !process.env[key]);

    if (missingConfig.length > 0) {
      return NextResponse.json(
        {
          error:
            process.env.NODE_ENV === "production"
              ? "Document storage is unavailable"
              : `Missing Cloudinary config: ${missingConfig.join(", ")}`,
        },
        { status: 500 },
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const requestedPurpose = formData.get("purpose");
    const purpose =
      requestedPurpose === "kyc"
        ? "kyc"
        : requestedPurpose === "rental_inspection"
          ? "rental_inspection"
          : "general";
    if (!(file instanceof File))
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 },
      );
    }
    const allowedTypes =
      purpose === "kyc" ? ALLOWED_KYC_TYPES : ALLOWED_IMAGE_TYPES;
    if (!allowedTypes.has(file.type)) {
      return NextResponse.json(
        {
          error:
            purpose === "kyc"
              ? "Use JPG, PNG, WebP, or PDF"
              : "Unsupported image type",
        },
        { status: 400 },
      );
    }
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Enforce binary magic-byte verification, MIME spoofing prevention, and content scanning
    const safetyCheck = validateUploadedFileSafety(buffer, file.type, allowedTypes);
    if (!safetyCheck.valid) {
      return NextResponse.json(
        { error: safetyCheck.error },
        { status: safetyCheck.statusCode },
      );
    }

    const b64 = buffer.toString("base64");
    const dataUri = `data:${safetyCheck.detectedType.mime};base64,${b64}`;

    const host =
      purpose === "kyc"
        ? (await requireHostApplicant()).host
        : purpose === "rental_inspection"
          ? (await requireHost()).host
          : null;
    const rentalBookingId =
      purpose === "rental_inspection"
        ? String(formData.get("bookingId") ?? "")
        : null;
    if (purpose === "rental_inspection") {
      if (!rentalBookingId)
        return NextResponse.json(
          { error: "Rental booking is required" },
          { status: 400 },
        );
      const ownedBooking = await prisma.rentalBooking.findFirst({
        where: { id: rentalBookingId, hostId: host!.id },
        select: { id: true },
      });
      if (!ownedBooking)
        return NextResponse.json(
          { error: "Rental booking not found" },
          { status: 404 },
        );
    }
    const privateUpload = purpose === "kyc" || purpose === "rental_inspection";
    const result = await cloudinary.uploader.upload(dataUri, {
      folder:
        purpose === "kyc"
          ? `travels-pro/kyc/${host?.id}`
          : purpose === "rental_inspection"
            ? `travels-pro/rental-inspections/${host?.id}/${rentalBookingId}`
            : `travels-pro/uploads/${user.id}`,
      resource_type: "auto",
      type: privateUpload ? "authenticated" : "upload",
    });

    const assetId = result.format
      ? `${result.public_id}.${result.format}`
      : result.public_id;
    return NextResponse.json(
      privateUpload ? { assetId } : { url: result.secure_url },
    );
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const status = errorStatus(error);
    const message =
      status < 500 && error instanceof Error
        ? error.message
        : "Upload failed. Please try again.";
    return NextResponse.json({ error: message }, { status });
  }
}
