export async function hashCashDeviceProof(secret, proof) {
  if (typeof secret !== 'string' || secret.length < 32 || !/^[a-f0-9]{64}$/.test(proof || ''))
    throw new Error('Invalid cash device proof');
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${secret}:${proof}`));
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
