import { formatCurrency, formatWeight } from './formatters';
import { displayInvoiceNumber } from '../services/invoiceIdentity';
import { getStoreDisplayAddress } from './storeDisplay';

export const generateWhatsAppInvoiceMessage = (invoice, settings) => {
  const line = '━━━━━━━━━━━━━━━━━━━━━━';
  
  let msg = `*${settings.shopName || 'براكه'}*\n`;
  const address = getStoreDisplayAddress(settings.address);
  if (address) msg += `📍 ${address}\n`;
  if (settings.phone) msg += `📞 هاتف: ${settings.phone}\n`;
  msg += `${line}\n`;
  msg += `📄 *فاتورة مبيعات رقم:* #${displayInvoiceNumber(invoice)}\n`;
  msg += `📅 التاريخ: ${invoice.date} - ${invoice.time}\n`;
  msg += `👤 العميل: *${invoice.customerName}*\n`;
  msg += `💳 طريقة الدفع: ${invoice.saleType === 'cash' ? 'نقدي 💵' : 'آجل (على الحساب) 📝'}\n`;
  msg += `${line}\n`;
  msg += `📦 *تفاصيل الأصناف:*\n\n`;

  invoice.items.forEach((item, idx) => {
    msg += `${idx + 1}. *${item.name}* (${item.packageCount} ${item.unit})\n`;
    msg += `   • وزن قائم: ${item.grossWeight} كجم\n`;
    if (item.totalTareWeight > 0) {
      msg += `   • خصم عبوات: -${item.totalTareWeight} كجم (${item.packageCount}×${item.tarePerUnit})\n`;
    }
    msg += `   • صافي: *${item.netWeight} كجم* × ${item.pricePerKg} ${settings.currency}\n`;
    msg += `   • إجمالي: *${item.total.toFixed(2)} ${settings.currency}*\n\n`;
  });

  msg += `${line}\n`;
  msg += `📊 *الملخص الحسابي:*\n`;
  msg += `• إجمالي العبوات: ${invoice.totalPackages} عبوة\n`;
  msg += `• إجمالي الوزن القائم: ${formatWeight(invoice.totalGrossWeight)}\n`;
  msg += `• إجمالي الوزن الصافي: ${formatWeight(invoice.totalNetWeight)}\n`;
  msg += `• المجموع: *${invoice.subtotal.toFixed(2)} ${settings.currency}*\n`;
  
  if (invoice.discountAmount > 0) {
    msg += `• الخصم: -${invoice.discountAmount.toFixed(2)} ${settings.currency}\n`;
  }
  
  msg += `💰 *المطلوب سداده: ${invoice.finalTotal.toFixed(2)} ${settings.currency}*\n`;
  msg += `💵 المدفوع: ${invoice.paidAmount.toFixed(2)} ${settings.currency}\n`;
  
  if (invoice.changeAmount > 0) {
    msg += `🪙 باقي للعميل: ${invoice.changeAmount.toFixed(2)} ${settings.currency}\n`;
  } else if (invoice.remainingDebt > 0) {
    msg += `⚠️ المتبقي على الحساب (دين): *${invoice.remainingDebt.toFixed(2)} ${settings.currency}*\n`;
  }
  
  if (invoice.notes) {
    msg += `\n📝 ملاحظة: ${invoice.notes}\n`;
  }
  
  msg += `\n✨ ${settings.invoiceNote || 'شكراً لتعاملكم معنا'}`;
  
  return msg;
};

export const openWhatsAppInvoice = (invoice, settings) => {
  const text = generateWhatsAppInvoiceMessage(invoice, settings);
  const cleanPhone = (invoice.customerPhone || '').replace(/[^0-9]/g, '');
  
  let url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  if (cleanPhone.length >= 8) {
    // If phone starts with 0 and it's local, or has country code
    let formattedPhone = cleanPhone;
    if (cleanPhone.startsWith('0')) {
      // Default to Libya +218 if 09x or Egypt +20 if 01x, or keep international
      if (cleanPhone.startsWith('09')) formattedPhone = '218' + cleanPhone.slice(1);
      else if (cleanPhone.startsWith('01')) formattedPhone = '20' + cleanPhone.slice(1);
      else if (cleanPhone.startsWith('05')) formattedPhone = '966' + cleanPhone.slice(1);
    }
    url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;
  }
  
  window.open(url, '_blank');
};
