// Lossless base36 encoding of the immutable UUID: never truncate it. All print,
// report and search surfaces share this reference, including existing UUID IDs.
export function displayInvoiceNumber(invoice) {
  const number = Number(invoice?.invoiceNumber);
  const uuid=String(invoice?.id || '').match(/(?:^|-)([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i)?.[1];
  if (uuid && Number.isSafeInteger(number) && number > 0)
    return `${String(number).padStart(6,'0')}-${BigInt(`0x${uuid.replaceAll('-','')}`).toString(36).toUpperCase().padStart(25,'0')}`;
  if (Number.isSafeInteger(number) && number > 0) return String(number).padStart(6,'0');
  return String(invoice?.id || '');
}
