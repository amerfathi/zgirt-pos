const LEGACY_DEFAULT_ADDRESS = 'السوق المركزي للخضار والفواكه';

export function getStoreDisplayAddress(address) {
  const value = typeof address === 'string' ? address.trim() : '';
  return value === LEGACY_DEFAULT_ADDRESS ? '' : value;
}
