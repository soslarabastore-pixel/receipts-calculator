export interface Participant {
  id: string;
  name: string;
  color: string;
  avatarInitials: string;
}

export interface ItemAssignment {
  participantId: string;
  shares: number; // e.g., 1 for equal, or 2 for double portion
}

export interface ReceiptItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  category?: string;
  assignedTo: ItemAssignment[]; // who shares this item
}

export interface FeeItem {
  id: string;
  name: string;
  amount: number;
  isPercentage: boolean;
  percentageValue?: number;
}

export type TaxMode = 'percentage' | 'fixed';
export type TipMode = 'percentage' | 'fixed';
export type TipBasis = 'pre_tax' | 'post_tax';
export type AllocationStrategy = 'proportional' | 'equal';

export interface Receipt {
  id: string;
  merchant: string;
  date: string;
  currency: string;
  tags?: string[]; // e.g., 'Groceries', 'Work Trip', 'Birthday Dinner'
  items: ReceiptItem[];
  subtotalOverride?: number; // if manual
  discount: number; // fixed discount amount
  discountPercentage: number; // percentage discount if used
  taxRate: number; // in percent e.g. 8.875
  taxAmount: number; // computed or explicit
  taxMode: TaxMode;
  tipRate: number; // in percent e.g. 18
  tipAmount: number; // computed or explicit
  tipMode: TipMode;
  tipBasis: TipBasis;
  fees: FeeItem[];
  notes?: string;
  allocationStrategy: AllocationStrategy;
}

export interface ParticipantShareBreakdown {
  participantId: string;
  participantName: string;
  participantColor: string;
  itemsSubtotal: number;
  items: {
    itemId: string;
    itemName: string;
    itemTotal: number;
    portionShare: number; // e.g. 0.5 if half
    assignedAmount: number;
  }[];
  discountShare: number;
  taxShare: number;
  tipShare: number;
  feesShare: number;
  roundingAdjustment: number;
  finalTotal: number;
  isPaid: boolean;
  paymentMethod?: string;
}

export interface SplitCalculationResult {
  receiptSubtotal: number;
  discountTotal: number;
  taxTotal: number;
  tipTotal: number;
  feesTotal: number;
  grandTotal: number;
  participantBreakdowns: ParticipantShareBreakdown[];
  roundingDelta: number; // difference in cents if any
  unassignedItemsTotal: number;
  hasUnassignedItems: boolean;
}

export type PaymentType = 'single_card' | 'split_cards' | 'debit' | 'mobile_pay' | 'cash';

export interface CardDeductionRecord {
  id: string;
  cardLabel: string; // e.g. "Alex Visa", "Jordan Amex"
  amount: number;
  payerId?: string;
  status: 'pending' | 'settled';
}

export interface DeductionAudit {
  id: string;
  receiptId: string;
  paymentType: PaymentType;
  expectedTotal: number;
  actualDeducted: number;
  splitCards?: CardDeductionRecord[];
  statementDescriptor?: string;
  discrepancy: number; // actual - expected
  status: 'exact_match' | 'overcharge' | 'undercharge';
  possibleCauses: DiscrepancyDiagnostic[];
  aiAnalysis?: {
    likelyReason: string;
    secondaryFactors: string[];
    recommendedAction: string;
    disputeTemplate: string;
    isLikelyTemporaryHold: boolean;
  };
  auditDate: string;
}

export interface DiscrepancyDiagnostic {
  id: string;
  title: string;
  probability: 'high' | 'medium' | 'low';
  description: string;
  amountDiff?: number;
  suggestedAction: string;
}

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'free';
export type PlanTier = 'free_tier' | 'pro_monthly' | 'pro_annual';

export interface UserSubscription {
  userId: string;
  status: SubscriptionStatus;
  planId: PlanTier;
  trialStartDate?: string;
  trialEndDate?: string;
  trialUsed: boolean;
  subscriptionStartDate?: string;
  nextBillingDate?: string;
  autoRenew: boolean;
  aiScansUsed: number;
  maxTrialScans: number;
}

export interface SubscriptionPlan {
  id: PlanTier;
  name: string;
  price: number;
  period: 'month' | 'year' | 'free';
  trialDays: number;
  features: string[];
  popular?: boolean;
}
