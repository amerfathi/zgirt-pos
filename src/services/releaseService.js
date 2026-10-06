/**
 * Central Multi-Platform Release Service
 * Handles update detection, minimum supported version enforcement, and release notes
 */
import { APP_VERSION, MINIMUM_SUPPORTED_VERSION, getClientPlatform, compareSemver, getApiBaseUrl } from '../config/appVersion';
import { UPDATE_TYPES } from '../types/contracts';

// Release history is supplied by the authenticated server, never invented offline.
export const OFFICIAL_RELEASES = [];

export async function checkLatestRelease(customPlatform = null) {
  const platform = customPlatform || getClientPlatform();
  const currentVersion = APP_VERSION;

  const baseUrl = getApiBaseUrl();

  try {
    // Attempt remote check first
    const res = await fetch(`${baseUrl}/api/releases/latest?platform=${platform}&current=${currentVersion}`, {
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
  } catch (err) {
    // Network offline or worker unavailable: fallback to embedded official release
  }

  return { platform, currentVersion, latestVersion: currentVersion,
    isUpdateAvailable: false, isRequired: false, updateType: UPDATE_TYPES.NONE,
    unavailable: true, releaseNotes: [] };
}
