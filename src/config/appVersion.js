/**
 * Central Version & Platform Detection
 * Semantic Versioning: MAJOR.MINOR.PATCH
 */

export const APP_VERSION = '2.6.14';
export const APP_BUILD_NUMBER = 26140;
export const APP_RELEASE_DATE = '2026-10-04';
export const MINIMUM_SUPPORTED_VERSION = '2.2.0';

export function getClientPlatform() {
  if (typeof window === 'undefined') return 'web';

  // 1. Electron Desktop Window
  if (window.electronAPI?.isElectron || window.navigator.userAgent.includes('Electron')) {
    return 'windows';
  }

  // 2. Capacitor Mobile (Android / iOS Native App)
  if (window.Capacitor?.isNativePlatform?.() || window.location.protocol === 'capacitor:') {
    const p = window.Capacitor?.getPlatform ? window.Capacitor.getPlatform() : (window.Capacitor?.platform || 'android');
    return p === 'ios' ? 'ios' : 'android';
  }

  // 3. Web App (Mobile Browser or Desktop Browser - continuously updated)
  return 'web';
}

export function compareSemver(v1, v2) {
  // Returns:
  //  1 if v1 > v2
  // -1 if v1 < v2
  //  0 if v1 === v2
  const p1 = (v1 || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);
  const p2 = (v2 || '0.0.0').split('.').map(n => parseInt(n, 10) || 0);

  for (let i = 0; i < 3; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Authoritative API Base URL Resolver
 * Resolves Cloudflare Edge endpoint across Web, Electron Desktop (file://), and Android Capacitor (localhost).
 */
export function getApiBaseUrl() {
  const configured = import.meta.env?.VITE_API_BASE_URL;
  if (configured) {
    const url = new URL(configured);
    if (url.username || url.password || url.search || url.hash ||
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
      throw new Error('Invalid API origin configuration');
    }
    return url.origin;
  }
  if (typeof window !== 'undefined') {
    const native = window.electronAPI?.isElectron || window.Capacitor?.isNativePlatform?.() || window.location?.protocol === 'capacitor:';
    if (!native && /^https?:/.test(window.location?.origin || '')) return window.location.origin;
  }
  // Packaged native clients have no HTTP backend at their local asset origin.
  return 'https://zgirt-pos-web-app.pages.dev';
}

