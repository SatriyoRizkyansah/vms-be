import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomInt,
  randomBytes,
} from 'node:crypto';

export interface EncryptedValue {
  ciphertext: string;
  iv: string;
  auth_tag: string;
}

interface StoredEncryptedValue {
  pin_ciphertext: string;
  pin_iv: string;
  pin_auth_tag: string;
}

export function encryptCredential(value: string): EncryptedValue {
  const key = getCredentialKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('hex'),
    auth_tag: cipher.getAuthTag().toString('hex'),
  };
}

export function decryptCredential(
  value: EncryptedValue | StoredEncryptedValue,
) {
  const ciphertext =
    'ciphertext' in value ? value.ciphertext : value.pin_ciphertext;
  const iv = 'iv' in value ? value.iv : value.pin_iv;
  const authTag = 'auth_tag' in value ? value.auth_tag : value.pin_auth_tag;
  const decipher = createDecipheriv(
    'aes-256-gcm',
    getCredentialKey(),
    Buffer.from(iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

export function generatePin(length: number) {
  if (length < 6 || length > 7)
    throw new Error('PIN length must be 6 or 7 digits');
  const minimum = 10 ** (length - 1);
  return String(randomInt(minimum, 10 ** length));
}

function getCredentialKey() {
  const encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (encryptionKey) {
    if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
      throw new Error('CREDENTIAL_ENCRYPTION_KEY must be a 32-byte hex value');
    }
    return Buffer.from(encryptionKey, 'hex');
  }

  const legacySecret = process.env.SECRET_KEY;
  const production = [process.env.APP_ENV, process.env.NODE_ENV]
    .filter(Boolean)
    .some((value) => ['prod', 'production'].includes(value!.toLowerCase()));
  const minLength = production ? 32 : 16;
  if (!legacySecret || Buffer.byteLength(legacySecret) < minLength) {
    throw new Error(
      `CREDENTIAL_ENCRYPTION_KEY or SECRET_KEY with at least ${minLength} bytes is required`,
    );
  }
  return createHash('sha256')
    .update(`vms-credential-at-rest:v1:${legacySecret}`)
    .digest();
}
