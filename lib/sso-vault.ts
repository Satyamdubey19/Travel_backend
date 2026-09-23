import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits auth tag

function getMasterKey(): Buffer {
  const secret = process.env.SSO_ENCRYPTION_KEY || process.env.JWT_SECRET || "travels_pro_sso_default_secret_key_change_in_prod";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts sensitive SSO credentials (e.g. IdP clientSecret, private keys) using AES-256-GCM.
 * Output format: "hex(iv):hex(authTag):hex(ciphertext)"
 */
export function encryptSsoSecret(plaintext: string): string {
  if (!plaintext) return "";
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv);
  
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

/**
 * Decrypts AES-256-GCM encrypted credentials.
 * Fails closed with an error if tampered with or corrupted.
 */
export function decryptSsoSecret(encryptedBlob: string): string {
  if (!encryptedBlob) return "";
  const parts = encryptedBlob.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted payload format: expected iv:authTag:ciphertext");
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(tagHex, "hex");
  if (authTag.length !== TAG_LENGTH) {
    throw new Error("Invalid auth tag length: expected 16 bytes");
  }
  const ciphertext = Buffer.from(cipherHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

