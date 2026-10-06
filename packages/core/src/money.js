/**
 * Money Utility for ZGIRT: Pure Integer Cents Representation
 * Prevents floating point inaccuracies (e.g. 0.1 + 0.2 !== 0.3)
 */

export function toCents(amount) {
  if (amount === null || amount === undefined) return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(amount);
  if (isNaN(num)) throw new Error(`Invalid monetary amount: ${amount}`);
  return Math.round(num * 100);
}

export function fromCents(cents) {
  if (cents === null || cents === undefined) return 0;
  return Number((cents / 100).toFixed(2));
}

export function formatCurrency(cents, currency = 'SAR') {
  const value = fromCents(cents);
  return `${value.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export function addCents(...values) {
  return values.reduce((sum, v) => sum + (Number(v) || 0), 0);
}

export function subtractCents(a, b) {
  return (Number(a) || 0) - (Number(b) || 0);
}
