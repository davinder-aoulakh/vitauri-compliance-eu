// AES-GCM encryption/decryption for backup files using Web Crypto API (PBKDF2 key derivation)

const ITERATIONS = 100000;
const SALT_LEN = 16;
const IV_LEN = 12;

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptBackup(jsonString, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const encoded = new TextEncoder().encode(jsonString);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);

  const toBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  return JSON.stringify({
    _encrypted: true,
    _v: 1,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(ciphertext)
  });
}

export async function decryptBackup(encryptedString, password) {
  const { salt, iv, data } = JSON.parse(encryptedString);
  const fromBase64 = (b64) => Uint8Array.from(atob(b64), c => c.charCodeAt(0));

  const key = await deriveKey(password, fromBase64(salt));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    key,
    fromBase64(data)
  );
  return new TextDecoder().decode(decrypted);
}

export function isEncryptedBackup(jsonString) {
  try {
    const obj = JSON.parse(jsonString);
    return obj._encrypted === true;
  } catch {
    return false;
  }
}