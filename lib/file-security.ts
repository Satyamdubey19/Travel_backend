/**
 * File Security & Content Scanning Engine
 * Enforces binary magic-byte detection and malicious payload scanning
 * to ensure that browser-declared MIME types cannot bypass security controls.
 */

export interface DetectedFileType {
  mime: string;
  ext: string;
}

export interface ScanResult {
  safe: boolean;
  reason?: string;
}

/**
 * Detects the real MIME type of a file based on its binary magic bytes.
 */
export function detectFileTypeFromMagicBytes(buffer: Buffer): DetectedFileType | null {
  if (!buffer || buffer.length < 4) return null;

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: "image/png", ext: "png" };
  }

  // 3. GIF: 47 49 46 38 (37|39) 61
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return { mime: "image/gif", ext: "gif" };
  }

  // 4. WebP: RIFF ... WEBP (Bytes 0-3: "RIFF", Bytes 8-11: "WEBP")
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }

  // 5. PDF: 25 50 44 46 (%PDF-)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { mime: "application/pdf", ext: "pdf" };
  }

  return null;
}

/**
 * Scans the binary content for embedded malware signatures, script injection, and PDF exploit primitives.
 */
export function scanFileForMaliciousContent(buffer: Buffer, detectedMime: string): ScanResult {
  if (!buffer || buffer.length === 0) {
    return { safe: false, reason: "Empty file content" };
  }

  // Check for executable signatures
  // Windows MZ header (4D 5A)
  if (buffer.length >= 2 && buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return { safe: false, reason: "Embedded Windows executable binary detected (MZ header)" };
  }

  // Linux ELF header (7F 45 4C 46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    return { safe: false, reason: "Embedded Linux ELF binary detected" };
  }

  const sampleSize = Math.min(buffer.length, 512 * 1024); // Inspect first 512KB
  const rawText = buffer.subarray(0, sampleSize).toString("latin1");

  // Script injection check across all image and document formats
  const suspiciousScriptPatterns = [
    /<script\b/i,
    /<svg\b[^>]*\bon[a-z]+\s*=/i,
    /javascript:/i,
    /vbscript:/i,
    /data:text\/html/i,
    /document\.cookie/i,
    /window\.location/i,
  ];

  for (const pattern of suspiciousScriptPatterns) {
    if (pattern.test(rawText)) {
      return { safe: false, reason: "Cross-site scripting (XSS) or embedded script payload detected" };
    }
  }

  // PDF-specific exploit checks
  if (detectedMime === "application/pdf") {
    const dangerousPdfTags = [
      /\/Launch\b/i,          // Executes external processes
      /\/JavaScript\b/i,      // PDF JavaScript engine trigger
      /\/JS\b/i,              // Embedded JS stream
      /\/EmbeddedFiles\b/i,   // Embedded executable files inside PDF
      /\/SubmitForm\b/i,      // Data exfiltration action
      /\/ImportData\b/i,      // Form data injection
    ];

    for (const tag of dangerousPdfTags) {
      if (tag.test(rawText)) {
        return {
          safe: false,
          reason: `Dangerous PDF action dictionary detected (${tag.source.replace(/[\/\\]/g, "")})`,
        };
      }
    }
  }

  return { safe: true };
}

/**
 * Validates an uploaded file's binary content against a set of permitted MIME types.
 */
export function validateUploadedFileSafety(
  buffer: Buffer,
  declaredMimeType: string,
  allowedMimeTypes: Set<string>
): { valid: true; detectedType: DetectedFileType } | { valid: false; error: string; statusCode: number } {
  const detected = detectFileTypeFromMagicBytes(buffer);

  if (!detected) {
    return {
      valid: false,
      error: "Unable to verify file type from binary header. Corrupted or unsupported file.",
      statusCode: 400,
    };
  }

  if (!allowedMimeTypes.has(detected.mime)) {
    return {
      valid: false,
      error: `File format ${detected.mime} is not permitted for this operation.`,
      statusCode: 400,
    };
  }

  // MIME type spoofing check: declared type vs actual detected binary type
  const normalizedDeclared = declaredMimeType.toLowerCase().trim();
  const normalizedDetected = detected.mime.toLowerCase().trim();

  // Allow jpeg/jpg equivalence
  const isJpegMatch =
    (normalizedDeclared === "image/jpeg" || normalizedDeclared === "image/jpg") &&
    (normalizedDetected === "image/jpeg" || normalizedDetected === "image/jpg");

  if (normalizedDeclared !== normalizedDetected && !isJpegMatch) {
    return {
      valid: false,
      error: `MIME type mismatch: declared '${declaredMimeType}' but file binary is '${detected.mime}'.`,
      statusCode: 400,
    };
  }

  // Content & Malware Scan
  const scan = scanFileForMaliciousContent(buffer, detected.mime);
  if (!scan.safe) {
    return {
      valid: false,
      error: `File upload blocked: ${scan.reason}`,
      statusCode: 400,
    };
  }

  return { valid: true, detectedType: detected };
}
