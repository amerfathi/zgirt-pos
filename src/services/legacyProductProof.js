// Read-only proof from complete bounded tenant history. Never guess ownership
// from the requesting cashier or move a source shared by multiple branches.
export function proveLegacyProduct(history, parentId, productId) {
  const parent=history.find(event=>event.id===parentId);
  if (parent?.entityType!=='invoice' || parent.action!=='create' || !parent.branchId || !parent.tenantId ||
      !Number.isSafeInteger(parent.sequence) || parent.sequence<1 ||
      !parent.payload?.items?.some(item=>item.productId===productId)) return null;
  const sources=history.filter(event=>event.entityType==='product' && event.entityId===productId);
  const originals=sources.filter(event=>event.action==='create');
  if (originals.length!==1) return null;
  const source=originals[0];
  if (source.tenantId!==parent.tenantId || !Number.isSafeInteger(source.sequence) || source.sequence<1 ||
      source.action!=='create' || source.branchId || source.payload?.branchId ||
      source.payload?.id!==productId || source.sequence>=parent.sequence) return null;
  if(sources.some(event=>event!==source&&(!['update'].includes(event.action)||event.tenantId!==parent.tenantId||
    event.branchId!==parent.branchId||event.payload?.branchId&&event.payload.branchId!==parent.branchId||
    !Number.isSafeInteger(event.sequence)||event.sequence<=source.sequence)))return null;
  const branches=new Set();
  for (const event of history) {
    const payload=event.payload || {};
    const references=payload.productId===productId || payload.sourceProductId===productId ||
      payload.destinationProductId===productId || payload.items?.some(item=>item.productId===productId);
    if (!references) continue;
    if (!event.branchId || payload.fromBranchId || payload.toBranchId) return null;
    branches.add(event.branchId);
  }
  if (branches.size!==1 || !branches.has(parent.branchId)) return null;
  if (Object.keys(source.payload.branchStock || {}).some(id=>id!==parent.branchId)) return null;
  return { protocol:'legacy-product-reference-v1', parent, source, branchId:parent.branchId };
}
