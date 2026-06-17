import * as argon2 from 'argon2';
import * as crypto from 'crypto';

// ── Argon2id config (OWASP ASVS V2.4) ──────────────────────────────────────
// memoryCost: 64 MB, timeCost: 3 iterations, parallelism: 4 threads
const ARGON2_CONFIG: argon2.Options & { raw?: false } = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

// ── AES-256-GCM config ───────────────────────────────────────────────────────
const CIPHER = 'aes-256-gcm';
const IV_LEN = 16; // 128-bit IV
const TAG_LEN = 16; // 128-bit auth tag
const SEPARATOR = ':';

// ── Password hashing (Argon2id) ─────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_CONFIG);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password, { type: argon2.argon2id });
  } catch {
    return false;
  }
}

// ── Token hashing (SHA-256, fast lookup) ────────────────────────────────────

export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ── Secure random token generation ──────────────────────────────────────────

/** Returns a cryptographically secure hex string of `bytes` random bytes. */
export function generateSecureToken(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Generates N random backup codes (8 uppercase hex chars each). */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
}

// ── AES-256-GCM field encryption (MFA secrets, PII) ─────────────────────────
// Key must be provided as a 64-char hex string (= 32 bytes).
// Ciphertext format: <iv_hex>:<authTag_hex>:<ciphertext_hex>

export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)');

  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(CIPHER, key, iv) as crypto.CipherGCM;
  cipher.setAAD(Buffer.from('clarbit-v1'));

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(SEPARATOR);
}

export function decrypt(ciphertext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 32) throw new Error('ENCRYPTION_KEY must be 32 bytes (64 hex chars)');

  const parts = ciphertext.split(SEPARATOR);
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const [ivHex, tagHex, encHex] = parts;

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encHex, 'hex');

  if (iv.length !== IV_LEN || authTag.length !== TAG_LEN) {
    throw new Error('Malformed ciphertext');
  }

  const decipher = crypto.createDecipheriv(CIPHER, key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from('clarbit-v1'));

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
