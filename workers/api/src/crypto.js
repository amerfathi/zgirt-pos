/**
 * Security and Cryptographic Utilities for ZGIRT
 * Pure WebCrypto SubtleCrypto implementation (Works on Cloudflare Workers, Node, and Browsers)
 */

const encoder = new TextEncoder();

export async function hashPassword(password, saltHex = null) {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  const hashHex = bytesToHex(new Uint8Array(derivedBits));
  const saltStr = bytesToHex(salt);
  return `pbkdf2_sha256$100000$${saltStr}$${hashHex}`;
}

export async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.startsWith('pbkdf2_sha256$')) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 4) return false;
  const saltHex = parts[2];
  const expectedHashHex = parts[3];
  
  const rehashed = await hashPassword(password, saltHex);
  const rehashParts = rehashed.split('$');
  return constantTimeEqual(rehashParts[3], expectedHashHex);
}

export async function sha256(str) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(str));
  return bytesToHex(new Uint8Array(digest));
}

function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
