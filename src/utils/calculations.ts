import {
  Receipt,
  Participant,
  SplitCalculationResult,
  ParticipantShareBreakdown,
  DiscrepancyDiagnostic,
  CardDeductionRecord,
} from '../types';

export const round2 = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};

export const formatCurrency = (amount: number, currency: string = '$'): string => {
  const rounded = round2(amount);
  const sign = rounded < 0 ? '-' : '';
  const abs = Math.abs(rounded).toFixed(2);
  return `${sign}${currency}${abs}`;
};

/**
 * Calculates raw subtotal of items
 */
export const calculateItemsSubtotal = (items: Receipt['items']): number => {
  return round2(items.reduce((sum, item) => sum + (item.totalPrice || item.unitPrice * item.quantity), 0));
};

/**
 * Calculates taxes, tips, fees, and grand total for a receipt
 */
export const calculateReceiptTotals = (receipt: Receipt) => {
  const subtotal = calculateItemsSubtotal(receipt.items);

  // Discount
  let discountTotal = 0;
  if (receipt.discountPercentage && receipt.discountPercentage > 0) {
    discountTotal = round2((subtotal * receipt.discountPercentage) / 100);
  } else {
    discountTotal = round2(receipt.discount || 0);
  }
  discountTotal = Math.min(discountTotal, subtotal); // cannot exceed subtotal

  const discountedSubtotal = Math.max(0, subtotal - discountTotal);

  // Taxes
  let taxTotal = 0;
  if (receipt.taxMode === 'percentage') {
    taxTotal = round2((discountedSubtotal * (receipt.taxRate || 0)) / 100);
  } else {
    taxTotal = round2(receipt.taxAmount || 0);
  }

  // Fees
  let feesTotal = 0;
  if (receipt.fees && receipt.fees.length > 0) {
    feesTotal = round2(
      receipt.fees.reduce((sum, fee) => {
        if (fee.isPercentage && fee.percentageValue) {
          return sum + round2((discountedSubtotal * fee.percentageValue) / 100);
        }
        return sum + (fee.amount || 0);
      }, 0)
    );
  }

  // Tip
  let tipTotal = 0;
  const tipBasisAmount = receipt.tipBasis === 'post_tax' ? discountedSubtotal + taxTotal : discountedSubtotal;

  if (receipt.tipMode === 'percentage') {
    tipTotal = round2((tipBasisAmount * (receipt.tipRate || 0)) / 100);
  } else {
    tipTotal = round2(receipt.tipAmount || 0);
  }

  const grandTotal = round2(discountedSubtotal + taxTotal + feesTotal + tipTotal);

  return {
    subtotal,
    discountTotal,
    discountedSubtotal,
    taxTotal,
    feesTotal,
    tipTotal,
    grandTotal,
  };
};

/**
 * Accurately splits costs among participants, either proportionally or equally
 */
export const calculateSplit = (
  receipt: Receipt,
  participants: Participant[],
  paidStatusMap: Record<string, boolean> = {},
  paymentMethodMap: Record<string, string> = {}
): SplitCalculationResult => {
  const totals = calculateReceiptTotals(receipt);
  const { subtotal, discountTotal, taxTotal, feesTotal, tipTotal, grandTotal } = totals;

  const numParticipants = participants.length;

  if (numParticipants === 0) {
    return {
      receiptSubtotal: subtotal,
      discountTotal,
      taxTotal,
      tipTotal,
      feesTotal,
      grandTotal,
      participantBreakdowns: [],
      roundingDelta: 0,
      unassignedItemsTotal: subtotal,
      hasUnassignedItems: receipt.items.length > 0,
    };
  }

  // Track items and individual subtotal per participant
  const participantSubtotals: Record<string, number> = {};
  const participantAssignedItems: Record<
    string,
    { itemId: string; itemName: string; itemTotal: number; portionShare: number; assignedAmount: number }[]
  > = {};

  participants.forEach((p) => {
    participantSubtotals[p.id] = 0;
    participantAssignedItems[p.id] = [];
  });

  let unassignedItemsTotal = 0;

  receipt.items.forEach((item) => {
    const itemCost = round2(item.totalPrice || item.unitPrice * item.quantity);
    const validAssignments = item.assignedTo.filter((a) =>
      participants.some((p) => p.id === a.participantId)
    );

    if (validAssignments.length === 0) {
      unassignedItemsTotal = round2(unassignedItemsTotal + itemCost);
      return;
    }

    const totalShares = validAssignments.reduce((acc, a) => acc + (a.shares || 1), 0);

    validAssignments.forEach((assignment) => {
      const shareFraction = totalShares > 0 ? (assignment.shares || 1) / totalShares : 1 / validAssignments.length;
      const assignedAmount = round2(itemCost * shareFraction);

      participantSubtotals[assignment.participantId] = round2(
        (participantSubtotals[assignment.participantId] || 0) + assignedAmount
      );

      participantAssignedItems[assignment.participantId].push({
        itemId: item.id,
        itemName: item.name,
        itemTotal: itemCost,
        portionShare: shareFraction,
        assignedAmount,
      });
    });
  });

  // Calculate sum of participant item subtotals
  const assignedItemsSum = round2(
    Object.values(participantSubtotals).reduce((sum, amt) => sum + amt, 0)
  );

  const breakdowns: ParticipantShareBreakdown[] = participants.map((p) => {
    const pSubtotal = participantSubtotals[p.id] || 0;

    let pDiscount = 0;
    let pTax = 0;
    let pTip = 0;
    let pFees = 0;

    if (receipt.allocationStrategy === 'equal') {
      pDiscount = round2(discountTotal / numParticipants);
      pTax = round2(taxTotal / numParticipants);
      pTip = round2(tipTotal / numParticipants);
      pFees = round2(feesTotal / numParticipants);
    } else {
      // Proportional allocation based on assigned item spending
      const proportion = assignedItemsSum > 0 ? pSubtotal / assignedItemsSum : 1 / numParticipants;
      pDiscount = round2(discountTotal * proportion);
      pTax = round2(taxTotal * proportion);
      pTip = round2(tipTotal * proportion);
      pFees = round2(feesTotal * proportion);
    }

    const baseFinal = round2(Math.max(0, pSubtotal - pDiscount) + pTax + pFees + pTip);

    return {
      participantId: p.id,
      participantName: p.name,
      participantColor: p.color,
      itemsSubtotal: pSubtotal,
      items: participantAssignedItems[p.id] || [],
      discountShare: pDiscount,
      taxShare: pTax,
      tipShare: pTip,
      feesShare: pFees,
      roundingAdjustment: 0,
      finalTotal: baseFinal,
      isPaid: Boolean(paidStatusMap[p.id]),
      paymentMethod: paymentMethodMap[p.id] || 'Cash / Transfer',
    };
  });

  // Rounding Reconciliation:
  // If the sum of participant totals differs from the grand total (e.g. by 1 or 2 cents due to fractional division),
  // identify the rounding delta.
  const rawSum = round2(breakdowns.reduce((sum, b) => sum + b.finalTotal, 0));
  const roundingDelta = round2(grandTotal - (rawSum + unassignedItemsTotal));

  // If there's an unassigned gap or a 1-2 cent penny delta, balance it transparently
  if (Math.abs(roundingDelta) > 0 && Math.abs(roundingDelta) <= 0.05 && breakdowns.length > 0) {
    // Add penny discrepancy to the highest-spending participant so sum matches exactly
    const sorted = [...breakdowns].sort((a, b) => b.itemsSubtotal - a.itemsSubtotal);
    const target = sorted[0];
    const idx = breakdowns.findIndex((b) => b.participantId === target.participantId);
    if (idx !== -1) {
      breakdowns[idx].roundingAdjustment = roundingDelta;
      breakdowns[idx].finalTotal = round2(breakdowns[idx].finalTotal + roundingDelta);
    }
  }

  return {
    receiptSubtotal: subtotal,
    discountTotal,
    taxTotal,
    tipTotal,
    feesTotal,
    grandTotal,
    participantBreakdowns: breakdowns,
    roundingDelta,
    unassignedItemsTotal,
    hasUnassignedItems: unassignedItemsTotal > 0,
  };
};

/**
 * Audits a bank/card deduction against expected receipt total and identifies root cause
 */
export const runRuleBasedDeductionAudit = (
  expectedTotal: number,
  actualDeducted: number,
  receipt: Receipt,
  splitCards?: CardDeductionRecord[]
): {
  discrepancy: number;
  status: 'exact_match' | 'overcharge' | 'undercharge';
  possibleCauses: DiscrepancyDiagnostic[];
} => {
  // If split cards were used, compute actual sum
  let effectiveActual = actualDeducted;
  if (splitCards && splitCards.length > 0) {
    effectiveActual = round2(splitCards.reduce((acc, c) => acc + (c.amount || 0), 0));
  }

  const discrepancy = round2(effectiveActual - expectedTotal);
  const absDiff = Math.abs(discrepancy);

  if (absDiff < 0.005) {
    return {
      discrepancy: 0,
      status: 'exact_match',
      possibleCauses: [
        {
          id: 'exact_match',
          title: 'Exact Balance Confirmed',
          probability: 'high',
          description: 'The deduction charged by the merchant matches the calculated receipt total with 100% precision.',
          suggestedAction: 'No action required. Transaction is verified and reconciled.',
        },
      ],
    };
  }

  const status = discrepancy > 0 ? 'overcharge' : 'undercharge';
  const diagnostics: DiscrepancyDiagnostic[] = [];

  const totals = calculateReceiptTotals(receipt);

  if (discrepancy > 0) {
    // 1. Credit Card Surcharge (typically 2.5%, 3%, 3.5%, 3.99% or $0.30 fixed fee)
    const subtotal = totals.discountedSubtotal;
    const commonSurcharges = [
      { rate: 0.025, label: '2.5% Credit Card Processing Fee' },
      { rate: 0.03, label: '3.0% Credit Card Processing Surcharge' },
      { rate: 0.035, label: '3.5% Payment Processing Fee' },
      { rate: 0.0399, label: '3.99% Non-Cash Adjustment / Card Surcharge' },
    ];

    commonSurcharges.forEach(({ rate, label }) => {
      const estimatedFeeSubtotal = round2(subtotal * rate);
      const estimatedFeeTotal = round2(totals.grandTotal * rate);
      if (Math.abs(discrepancy - estimatedFeeSubtotal) <= 0.05 || Math.abs(discrepancy - estimatedFeeTotal) <= 0.05) {
        diagnostics.push({
          id: `cc_surcharge_${rate}`,
          title: label,
          probability: 'high',
          description: `The variance of $${discrepancy.toFixed(2)} is virtually identical to an unadvertised ${rate * 100}% credit card surcharge added at the terminal.`,
          amountDiff: discrepancy,
          suggestedAction: 'Check the paper receipt or terminal printout for a "Non-Cash Adjustment" or card fee line.',
        });
      }
    });

    // 2. Fixed terminal fee (e.g. $0.30 or $0.50 convenience fee)
    if (Math.abs(discrepancy - 0.3) <= 0.02 || Math.abs(discrepancy - 0.5) <= 0.02 || Math.abs(discrepancy - 1.0) <= 0.02) {
      diagnostics.push({
        id: 'fixed_convenience_fee',
        title: 'Fixed Gateway / Terminal Convenience Fee',
        probability: 'high',
        description: `The discrepancy is exactly $${discrepancy.toFixed(2)}, which is standard for card processing fixed fees or terminal network assessments.`,
        amountDiff: discrepancy,
        suggestedAction: 'Ask the vendor if they levy a flat fee for card transactions below a minimum threshold.',
      });
    }

    // 3. Double Tip / Tip Added Twice
    if (totals.tipTotal > 0 && Math.abs(discrepancy - totals.tipTotal) <= 0.05) {
      diagnostics.push({
        id: 'double_tip',
        title: 'Duplicate Tip Added to Charge',
        probability: 'high',
        description: `The extra amount charged ($${discrepancy.toFixed(2)}) exactly matches your receipt tip ($${totals.tipTotal.toFixed(2)}). The POS system likely added the tip twice or both auto-gratuity and slip tip were charged.`,
        amountDiff: discrepancy,
        suggestedAction: 'Contact the merchant immediately with your receipt copy showing the intended tip. This is a common clerical keying mistake.',
      });
    }

    // 4. Temporary Restaurant Pre-Authorization Hold (typically +20% cushion)
    const expectedPreAuth = round2(totals.discountedSubtotal * 0.2);
    if (Math.abs(discrepancy - expectedPreAuth) <= 1.0) {
      diagnostics.push({
        id: 'preauth_hold',
        title: 'Pending Pre-Authorization Hold (+20%)',
        probability: 'medium',
        description: `Many banks place a temporary authorization hold equal to the bill + 20% to account for pending gratuity. This drops to the exact signed amount once settled (1–3 business days).`,
        amountDiff: discrepancy,
        suggestedAction: 'Check your online banking app. If the transaction says "Pending", wait 48 hours for final settlement before disputing.',
      });
    }

    // 5. Flat $1.00 or $5.00 Pre-Auth Verification Hold
    if (Math.abs(discrepancy - 1.0) < 0.01 || Math.abs(discrepancy - 5.0) < 0.01) {
      diagnostics.push({
        id: 'card_verification_hold',
        title: 'Temporary Card Verification Hold',
        probability: 'medium',
        description: 'Payment processors frequently ping a temporary $1 or $5 hold to verify active card credentials before posting the actual total.',
        amountDiff: discrepancy,
        suggestedAction: 'Monitor the charge status. The temporary verification hold will reverse automatically.',
      });
    }

    // 6. Tip on Post-Tax vs Pre-Tax difference
    if (receipt.tipRate > 0) {
      const preTaxTip = round2((totals.discountedSubtotal * receipt.tipRate) / 100);
      const postTaxTip = round2(((totals.discountedSubtotal + totals.taxTotal) * receipt.tipRate) / 100);
      const tipDifference = round2(postTaxTip - preTaxTip);
      if (Math.abs(discrepancy - tipDifference) <= 0.05) {
        diagnostics.push({
          id: 'tip_post_tax_mismatch',
          title: 'Tip Calculated on Post-Tax Amount',
          probability: 'high',
          description: `The POS terminal calculated the ${receipt.tipRate}% tip on the total including tax rather than the pre-tax subtotal.`,
          amountDiff: discrepancy,
          suggestedAction: 'Many merchants default tips to post-tax totals. Review the merchant check.',
        });
      }
    }

    // 7. Clerical Transposition Error (e.g. $45.21 vs $54.21)
    const expStr = expectedTotal.toFixed(2);
    const actStr = effectiveActual.toFixed(2);
    if (expStr.split('').sort().join('') === actStr.split('').sort().join('')) {
      diagnostics.push({
        id: 'transposition_error',
        title: 'Possible Keypad Digit Transposition',
        probability: 'high',
        description: `The digits in expected ($${expectedTotal.toFixed(2)}) and deducted ($${effectiveActual.toFixed(2)}) match in character composition. The cashier or server likely transposed digits when entering the slip into the terminal.`,
        suggestedAction: 'Request a copy of the merchant terminal slip to verify the handwritten total vs keyed amount.',
      });
    }

    // Default fallback if no specific rule hit
    if (diagnostics.length === 0) {
      diagnostics.push({
        id: 'unknown_overcharge',
        title: 'Unidentified Overcharge / Extra Line Item',
        probability: 'medium',
        description: `Your card was charged $${discrepancy.toFixed(2)} more than the calculated receipt total. This could be a merchant surcharge, an extra item added after closing the check, or an entry error.`,
        amountDiff: discrepancy,
        suggestedAction: 'Compare the line items on your itemized receipt against the merchant copy and request an explanation.',
      });
    }
  } else {
    // Undercharge (discrepancy < 0)
    // 1. Tip not charged / tip left off
    if (totals.tipTotal > 0 && Math.abs(absDiff - totals.tipTotal) <= 0.05) {
      diagnostics.push({
        id: 'tip_omitted',
        title: 'Tip Was Not Processed',
        probability: 'high',
        description: `The merchant charged exactly the subtotal + tax ($${(expectedTotal - totals.tipTotal).toFixed(2)}), omitting your tip of $${totals.tipTotal.toFixed(2)}. This happens when servers forget to enter the handwritten tip before closing out the shift batch.`,
        amountDiff: absDiff,
        suggestedAction: 'The merchant may still adjust the batch within 24-48 hours, or the tip was waived.',
      });
    }

    // 2. Unredeemed item or promotional discount applied
    diagnostics.push({
      id: 'merchant_undercharge',
      title: 'Merchant Courtesy Discount or Voided Item',
      probability: 'medium',
      description: `You were charged $${absDiff.toFixed(2)} less than anticipated. The vendor may have applied a comp, happy hour discount, or voided an item.`,
      amountDiff: absDiff,
      suggestedAction: 'Review the final receipt line items to see if an item was discounted or comped.',
    });
  }

  return {
    discrepancy,
    status,
    possibleCauses: diagnostics,
  };
};
