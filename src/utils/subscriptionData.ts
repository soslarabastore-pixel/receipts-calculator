import { SubscriptionPlan, UserSubscription } from '../types';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free_tier',
    name: 'Free Basic',
    price: 0,
    period: 'free',
    trialDays: 0,
    features: [
      'Manual itemized receipt calculator',
      'Equal & proportional bill splitting',
      'Up to 3 saved receipts',
      'Standard receipt export (CSV/TXT)',
    ],
  },
  {
    id: 'pro_monthly',
    name: 'Pro Monthly',
    price: 4.99,
    period: 'month',
    trialDays: 14,
    popular: true,
    features: [
      '14-Day Free Trial included (zero charge today)',
      'Unlimited Gemini 3.8 Flash AI receipt scanning',
      'Unlimited Firestore cloud synchronization',
      'Google Search grounded merchant verification',
      'Advanced payment dispute draft generator',
      'Receipt tags, categories & custom filters',
      'Cancel or pause anytime before trial ends',
    ],
  },
  {
    id: 'pro_annual',
    name: 'Pro Annual (Save 33%)',
    price: 39.99,
    period: 'year',
    trialDays: 14,
    features: [
      '14-Day Free Trial included (zero charge today)',
      'Everything in Pro Monthly',
      'Two months free ($3.33/month billed annually)',
      'Multi-currency exchange rate deduction auditor',
      'Priority OCR queue & batch CSV export',
      'Cancel or switch plans anytime',
    ],
  },
];

export const DEFAULT_FREE_SUBSCRIPTION: UserSubscription = {
  userId: 'guest',
  status: 'free',
  planId: 'free_tier',
  trialUsed: false,
  autoRenew: false,
  aiScansUsed: 0,
  maxTrialScans: 10,
};

export const createTrialSubscription = (userId: string, planId: 'pro_monthly' | 'pro_annual'): UserSubscription => {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
  const nextBilling = new Date(trialEnd.getTime());

  return {
    userId,
    status: 'trial',
    planId,
    trialStartDate: now.toISOString(),
    trialEndDate: trialEnd.toISOString(),
    trialUsed: true,
    subscriptionStartDate: trialEnd.toISOString(),
    nextBillingDate: nextBilling.toISOString(),
    autoRenew: true,
    aiScansUsed: 0,
    maxTrialScans: 50,
  };
};

export const createPaidSubscription = (userId: string, planId: 'pro_monthly' | 'pro_annual'): UserSubscription => {
  const now = new Date();
  const nextBilling = new Date(now);
  if (planId === 'pro_annual') {
    nextBilling.setFullYear(nextBilling.getFullYear() + 1);
  } else {
    nextBilling.setMonth(nextBilling.getMonth() + 1);
  }

  return {
    userId,
    status: 'active',
    planId,
    trialUsed: true,
    subscriptionStartDate: now.toISOString(),
    nextBillingDate: nextBilling.toISOString(),
    autoRenew: true,
    aiScansUsed: 0,
    maxTrialScans: 9999,
  };
};
