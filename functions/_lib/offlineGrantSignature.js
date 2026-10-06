// Server-only helper. The private JWK must come from a Cloudflare secret,
// never a bundled client asset or checked-in source file.
export async function issueSignedOfflineGrant(privateJwk, claims) {
  if (privateJwk?.kty !== 'EC' || privateJwk?.crv !== 'P-256' || !privateJwk.d ||
      !claims || typeof claims !== 'object' || Array.isArray(claims))
    throw new Error('Offline grant signing configuration is unavailable');
  const key=await crypto.subtle.importKey('jwk',privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const body=structuredClone(claims);
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,
    new TextEncoder().encode(JSON.stringify(body)));
  const encoded=btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  return {claims:body,signature:encoded};
}
