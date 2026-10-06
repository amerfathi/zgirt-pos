// The public half of the ECDSA P-256 key pair whose private half lives only in
// the server secret `OFFLINE_GRANT_PRIVATE_JWK`. This pin is the production
// trust root for offline cashier grants: a client must never accept a public
// key from a request, an envelope, or an untrusted API response.
export const OFFLINE_GRANT_PUBLIC_JWK = {
  kty: 'EC',
  crv: 'P-256',
  x: 'Mjd8Y6Ksdxmw6tuxFlWTwyEulbIGGBtZZtQv4RhKk1w',
  y: 'DO0iG7YqdwQd84HXHpONrMye1Yih_pw3MrStdkRgi_Y'
};
