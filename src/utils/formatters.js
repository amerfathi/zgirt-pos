import { getSessionUser } from '../services/authSession.js';

export const formatCurrency = (amount, currency = 'د.ل') => {
  const val = Number(amount) || 0;
  return `${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
};

export const formatNumber = (num, decimals = 2) => {
  const val = Number(num) || 0;
  return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};

export const formatWeight = (kg, decimals = 2) => {
  const val = Number(kg) || 0;
  return `${val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} كجم`;
};

export const padInvoiceNumber = (num) => {
  return String(num).padStart(6, '0');
};

const BUSINESS_TIME_ZONE_KEY = 'braka_business_time_zone';
const DEFAULT_TIME_ZONE = 'Asia/Riyadh';
const clockStorageKey = () => `${BUSINESS_TIME_ZONE_KEY}:${encodeURIComponent(getSessionUser()?.tenantId || 'anonymous')}`;

// The business date must follow the company's timezone, not the device's or
// UTC. A single owner-set timezone applies to every branch of a company.
export const dateInTimeZone = (value, timeZone = DEFAULT_TIME_ZONE) => {
  const date = value == null ? new Date() : value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('تاريخ غير صالح');
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date);
  const byType = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
};

export const setBusinessTimeZone = timeZone => {
  if (typeof timeZone !== 'string' || !timeZone.trim()) return;
  dateInTimeZone(new Date(), timeZone.trim());
  try { globalThis.localStorage?.setItem(clockStorageKey(), timeZone.trim()); } catch { /* Ignore storage unavailability. */ }
};

export const getBusinessTimeZone = () => {
  try {
    const stored = globalThis.localStorage?.getItem(clockStorageKey());
    if (stored && stored.trim()) {
      dateInTimeZone(new Date(), stored.trim());
      return stored.trim();
    }
  } catch { /* Fall back to the default timezone. */ }
  return DEFAULT_TIME_ZONE;
};

export const getCurrentDateFormatted = () => dateInTimeZone(new Date(), getBusinessTimeZone());

export const getDateFormattedOffset = (days = 0) =>
  dateInTimeZone(new Date(Date.now() + days * 86400000), getBusinessTimeZone());

export const getCurrentTimeFormatted = () => {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: getBusinessTimeZone(), hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  let hours = Number(parts.find(part => part.type === 'hour').value);
  const minutes = parts.find(part => part.type === 'minute').value;
  const ampm = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  hours = hours ? hours : 12; // 12 instead of 0
  return `${hours}:${minutes} ${ampm}`;
};
