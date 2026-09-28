import { Receipt, Participant, SplitCalculationResult } from '../types';
import { calculateReceiptTotals, calculateSplit, formatCurrency } from './calculations';

/**
 * Escapes fields for CSV compliance
 */
const escapeCsv = (val: string | number): string => {
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Generates an itemized, highly structured CSV including receipt overview,
 * line items, fee breakdown, and per-person owed totals.
 */
export const generateReceiptCsv = (
  receipt: Receipt,
  participants: Participant[],
  splitResult: SplitCalculationResult
): string => {
  const totals = calculateReceiptTotals(receipt);
  const rows: string[][] = [];

  // Header / Metadata
  rows.push(['SplitExact - Receipt & Payment Breakdown Report']);
  rows.push(['Merchant', receipt.merchant || 'N/A']);
  rows.push(['Date', receipt.date || 'N/A']);
  rows.push(['Currency', receipt.currency]);
  if (receipt.tags && receipt.tags.length > 0) {
    rows.push(['Tags', receipt.tags.join(', ')]);
  }
  rows.push(['Allocation Strategy', receipt.allocationStrategy === 'proportional' ? 'Proportional to Food Spend' : 'Split Equally']);
  rows.push([]);

  // Section 1: Overall Receipt Financial Summary
  rows.push(['RECEIPT TOTALS SUMMARY']);
  rows.push(['Description', 'Amount']);
  rows.push(['Items Subtotal', totals.subtotal.toFixed(2)]);
  if (totals.discountTotal > 0) {
    rows.push(['Discounts Applied', `-${totals.discountTotal.toFixed(2)}`]);
    rows.push(['Discounted Subtotal', totals.discountedSubtotal.toFixed(2)]);
  }
  rows.push(['Tax', totals.taxTotal.toFixed(2)]);
  if (totals.feesTotal > 0) {
    rows.push(['Fees & Surcharges', totals.feesTotal.toFixed(2)]);
  }
  rows.push(['Tip / Gratuity', totals.tipTotal.toFixed(2)]);
  rows.push(['Grand Total Due', totals.grandTotal.toFixed(2)]);
  rows.push([]);

  // Section 2: Itemized Line Items
  rows.push(['ITEMIZED RECEIPT ITEMS']);
  rows.push(['#', 'Item Description', 'Category', 'Quantity', 'Unit Price', 'Total Price', 'Assigned To']);
  receipt.items.forEach((item, idx) => {
    const assignedNames = item.assignedTo
      .map((a) => {
        const p = participants.find((part) => part.id === a.participantId);
        return p ? p.name : 'Unknown';
      })
      .join(', ') || 'Unassigned';

    rows.push([
      String(idx + 1),
      item.name || 'Untitled Item',
      item.category || 'General',
      String(item.quantity),
      item.unitPrice.toFixed(2),
      item.totalPrice.toFixed(2),
      assignedNames,
    ]);
  });
  rows.push([]);

  // Section 3: Individual Person Breakdown
  rows.push(['INDIVIDUAL PAYMENT BREAKDOWNS']);
  rows.push([
    'Participant',
    'Items Subtotal',
    'Discount Share',
    'Tax Share',
    'Tip Share',
    'Fees Share',
    'Rounding Adj',
    'Total Owed',
    'Status',
    'Assigned Dishes',
  ]);

  splitResult.participantBreakdowns.forEach((p) => {
    const dishesList = p.items
      .map((it) => `${it.itemName} (${it.portionShare === 1 ? 'Solo' : `1/${Math.round(1 / it.portionShare)}`}: ${receipt.currency}${it.assignedAmount.toFixed(2)})`)
      .join('; ');

    rows.push([
      p.participantName,
      p.itemsSubtotal.toFixed(2),
      p.discountShare > 0 ? `-${p.discountShare.toFixed(2)}` : '0.00',
      p.taxShare.toFixed(2),
      p.tipShare.toFixed(2),
      p.feesShare.toFixed(2),
      p.roundingAdjustment.toFixed(2),
      p.finalTotal.toFixed(2),
      p.isPaid ? 'Paid' : 'Unpaid',
      dishesList || 'None',
    ]);
  });

  return rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
};

/**
 * Generates a clean, beautifully formatted plain text report suitable for sharing in WhatsApp, Slack, or Email
 */
export const generateReceiptTextReport = (
  receipt: Receipt,
  participants: Participant[],
  splitResult: SplitCalculationResult
): string => {
  const totals = calculateReceiptTotals(receipt);
  const divider = '==================================================';
  const subDivider = '--------------------------------------------------';

  const lines: string[] = [];

  lines.push(divider);
  lines.push(`🧾 RECEIPT & COST SPLIT REPORT - SPLITEXACT`);
  lines.push(divider);
  lines.push(`Merchant:     ${receipt.merchant || 'Store / Restaurant'}`);
  lines.push(`Date:         ${receipt.date || new Date().toISOString().split('T')[0]}`);
  lines.push(`Strategy:     ${receipt.allocationStrategy === 'proportional' ? 'Proportional to items ordered' : 'Split equally'}`);
  if (receipt.notes) {
    lines.push(`Notes:        ${receipt.notes}`);
  }
  lines.push('');

  lines.push(`FINANCIAL SUMMARY`);
  lines.push(subDivider);
  lines.push(`Items Subtotal:       ${formatCurrency(totals.subtotal, receipt.currency)}`);
  if (totals.discountTotal > 0) {
    lines.push(`Discount:            -${formatCurrency(totals.discountTotal, receipt.currency)}`);
  }
  lines.push(`Sales Tax:            ${formatCurrency(totals.taxTotal, receipt.currency)}`);
  if (totals.feesTotal > 0) {
    lines.push(`Surcharges / Fees:    ${formatCurrency(totals.feesTotal, receipt.currency)}`);
  }
  lines.push(`Tip / Gratuity:       ${formatCurrency(totals.tipTotal, receipt.currency)}`);
  lines.push(`--------------------------------------------------`);
  lines.push(`GRAND TOTAL DUE:      ${formatCurrency(totals.grandTotal, receipt.currency)}`);
  lines.push('');

  lines.push(`ITEMIZED DISHES / GOODS (${receipt.items.length})`);
  lines.push(subDivider);
  receipt.items.forEach((it, idx) => {
    const assignedNames = it.assignedTo
      .map((a) => {
        const p = participants.find((part) => part.id === a.participantId);
        return p ? p.name : 'Unknown';
      })
      .join(', ') || 'Unassigned';

    lines.push(
      `${String(idx + 1).padStart(2, ' ')}. ${it.name || 'Item'} (x${it.quantity}) - ${formatCurrency(it.totalPrice, receipt.currency)} [${assignedNames}]`
    );
  });
  lines.push('');

  lines.push(`INDIVIDUAL SPLIT BREAKDOWNS (${splitResult.participantBreakdowns.length} people)`);
  lines.push(divider);

  splitResult.participantBreakdowns.forEach((p) => {
    lines.push(`👤 ${p.participantName.toUpperCase()}`);
    lines.push(`   Status:       ${p.isPaid ? 'PAID' : 'PENDING PAYMENT'}`);
    lines.push(`   Dishes:       ${formatCurrency(p.itemsSubtotal, receipt.currency)}`);
    if (p.discountShare > 0) {
      lines.push(`   Discount:    -${formatCurrency(p.discountShare, receipt.currency)}`);
    }
    lines.push(`   Tax Share:    ${formatCurrency(p.taxShare, receipt.currency)}`);
    lines.push(`   Tip Share:    ${formatCurrency(p.tipShare, receipt.currency)}`);
    if (p.feesShare > 0) {
      lines.push(`   Fees Share:   ${formatCurrency(p.feesShare, receipt.currency)}`);
    }
    if (p.roundingAdjustment !== 0) {
      lines.push(`   Penny Adj:    ${p.roundingAdjustment > 0 ? '+' : ''}${formatCurrency(p.roundingAdjustment, receipt.currency)}`);
    }
    lines.push(`   -----------------------------------------------`);
    lines.push(`   TOTAL OWED:   ${formatCurrency(p.finalTotal, receipt.currency)}`);

    if (p.items.length > 0) {
      lines.push(`   Items Consumed:`);
      p.items.forEach((item) => {
        lines.push(
          `     • ${item.itemName} (${item.portionShare === 1 ? 'Solo' : `1/${Math.round(1 / item.portionShare)} share`}) = ${formatCurrency(item.assignedAmount, receipt.currency)}`
        );
      });
    }
    lines.push('');
  });

  lines.push(divider);
  lines.push(`Reconciled with SplitExact - Zero Penny Discrepancy`);
  lines.push(divider);

  return lines.join('\n');
};

/**
 * Triggers browser download of text/csv file
 */
export const downloadFile = (content: string, filename: string, mimeType: string) => {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
