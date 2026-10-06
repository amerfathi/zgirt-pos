const cents = value => {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) throw new Error('قيمة مالية غير صالحة في المصالحة');
  return Math.round(amount * 100);
};
const money = value => value / 100;
const sum = (rows, selector) => rows.reduce((total, row) => total + selector(row), 0);

export function buildAccountingSnapshot(data, liquidity) {
  const invoices = (data.invoices || []).filter(row => row.status !== 'voided');
  const invoiceById = new Map(invoices.map(row => [row.id, row]));
  const sales = sum(invoices, row => cents(row.finalTotal));
  const salesReturns = sum(data.salesReturns || [], row => cents(row.totalRefundAmount));
  const purchases = sum(data.purchases || [], row => cents(row.totalCost));
  const purchaseReturns = sum(data.purchaseReturns || [], row => cents(row.totalRefundAmount));
  const grossCogs = sum(invoices, invoice => sum(invoice.items || [], item =>
    cents(Number(item.netWeight ?? item.grossWeight ?? 0) * Number(item.costPerKg || 0))));
  const returnedCogs = sum(data.salesReturns || [], returned => {
    if (returned.inventoryAction !== 'restock') return 0;
    const invoice = invoiceById.get(returned.invoiceId);
    return sum(returned.items || [], item => {
      const source = invoice?.items?.[item.sourceLineIndex] || invoice?.items?.find(line =>
        item.productId ? line.productId === item.productId : line.name === item.name);
      return cents(Number(item.returnedWeight || 0) * Number(source?.costPerKg || 0));
    });
  });
  const operatingExpenses = sum((data.expenses || []).filter(row => !row.isSupplierPayment), row => cents(row.amount));
  const damageLoss = sum(data.damagedItems || [], row => cents(row.totalLoss));
  const payroll = sum((data.workerTransactions || []).filter(row => row.type === 'salary_payment'), row => cents(row.amount));
  const workerAdvances = sum(data.workers || [], row => cents(row.currentAdvance));
  const inventoryQuantityHundredths = sum(data.products || [], row => Math.round(Number(row.currentStockKg || 0) * 100));
  const inventoryValue = sum(data.products || [], row => cents(Number(row.currentStockKg || 0) * Number(row.costPerKg || 0)));
  const receivables = sum(data.customers || [], row => Math.max(0, cents(row.balance)));
  const supplierPayables = sum(data.suppliers || [], row => Math.max(0, cents(row.balance)));
  const partnerCapital = sum(data.partners || [], row => cents(row.initialCapital));
  const partnerDrawings = sum(data.partnerDrawings || [], row => cents(row.amount));
  const partnerDistributions = sum(data.profitDistributions || [], row =>
    sum(row.shares || [], share => cents(share.netPayout)));
  const netSales = sales - salesReturns;
  const netCogs = grossCogs - returnedCogs;
  const grossProfit = netSales - netCogs;
  const netProfit = grossProfit - operatingExpenses - damageLoss;
  return {
    cash: liquidity.cashBalance, bank: liquidity.bankBalance,
    customerReceivables: money(receivables), supplierPayables: money(supplierPayables),
    inventoryQuantityKg: inventoryQuantityHundredths / 100, inventoryValue: money(inventoryValue),
    sales: money(sales), salesReturns: money(salesReturns), netSales: money(netSales),
    purchases: money(purchases), purchaseReturns: money(purchaseReturns), netPurchases: money(purchases - purchaseReturns),
    cogs: money(netCogs), grossProfit: money(grossProfit),
    operatingExpenses: money(operatingExpenses), damageLoss: money(damageLoss), netProfit: money(netProfit),
    payroll: money(payroll), workerAdvances: money(workerAdvances),
    partnerCapital: money(partnerCapital), partnerDrawings: money(partnerDrawings),
    partnerDistributions: money(partnerDistributions),
    partnerNetEquity: money(partnerCapital + partnerDistributions - partnerDrawings)
  };
}
