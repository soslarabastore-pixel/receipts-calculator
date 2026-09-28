import React, { useState } from 'react';
import {
  X,
  Check,
  Sparkles,
  ShieldCheck,
  Calendar,
  CreditCard,
  Zap,
  ArrowRight,
  AlertCircle,
  Clock,
  RotateCcw,
  ShieldAlert,
  FileLock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { UserSubscription, SubscriptionPlan, PlanTier } from '../types';
import { SUBSCRIPTION_PLANS } from '../utils/subscriptionData';
import { User } from '../firebase';
import { RESERVED_TERMS, PROHIBITED_TERMS } from '../utils/moderation';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: UserSubscription;
  currentUser: User | null;
  onStartTrial: (planId: 'pro_monthly' | 'pro_annual') => Promise<void>;
  onUpgradeToSubscription: (planId: 'pro_monthly' | 'pro_annual') => Promise<void>;
  onCancelAutoRenew: () => Promise<void>;
  onSignIn: () => void;
}

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  subscription,
  currentUser,
  onStartTrial,
  onUpgradeToSubscription,
  onCancelAutoRenew,
  onSignIn,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<'pro_monthly' | 'pro_annual'>('pro_monthly');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [showProhibitedTerms, setShowProhibitedTerms] = useState(false);

  if (!isOpen) return null;

  const isTrialActive = subscription.status === 'trial';
  const isActivePaid = subscription.status === 'active';
  const hasUsedTrial = subscription.trialUsed;

  const getDaysRemainingInTrial = () => {
    if (!subscription.trialEndDate) return 0;
    const end = new Date(subscription.trialEndDate).getTime();
    const now = Date.now();
    const diff = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const daysRemaining = getDaysRemainingInTrial();

  const handleAction = async () => {
    if (!currentUser) {
      onSignIn();
      return;
    }

    setIsProcessing(true);
    setSuccessNotice(null);

    try {
      if (!hasUsedTrial && subscription.status !== 'trial') {
        // Start 14-day free trial
        await onStartTrial(selectedPlanId);
        setSuccessNotice(`Your 14-day free trial has started! Next subscription billing will occur on the trial end date.`);
      } else {
        // Direct subscription activation or plan switch
        await onUpgradeToSubscription(selectedPlanId);
        setSuccessNotice(`Your ${selectedPlanId === 'pro_annual' ? 'Pro Annual' : 'Pro Monthly'} subscription is now active!`);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleAutoRenew = async () => {
    setIsProcessing(true);
    try {
      await onCancelAutoRenew();
      setSuccessNotice('Auto-renewal settings updated successfully.');
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-400 text-slate-950 font-bold">
              <Zap className="w-5 h-5 fill-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">SplitExact Pro Subscription</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  14-Day Free Trial
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Start with a zero-risk 14-day trial, then seamlessly transition to your next active plan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Status Banner (If Trial or Active) */}
        {isTrialActive && (
          <div className="px-6 py-3.5 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold text-amber-950">One-Time Trial Active:</span>{' '}
                <span className="text-amber-800">
                  <strong>{daysRemaining} days remaining</strong> (Ends{' '}
                  {subscription.trialEndDate ? new Date(subscription.trialEndDate).toLocaleDateString() : 'soon'}).
                </span>
                <span className="block text-[11px] text-amber-700 mt-0.5">
                  Next recurring plan: <strong>{subscription.planId === 'pro_annual' ? 'Pro Annual ($39.99/yr)' : 'Pro Monthly ($4.99/mo)'}</strong> billed after trial.
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleAutoRenew}
              disabled={isProcessing}
              className="text-xs font-semibold px-2.5 py-1 bg-white hover:bg-amber-100 border border-amber-300 rounded text-amber-900 transition-colors shrink-0"
            >
              {subscription.autoRenew ? 'Cancel Auto-Renew' : 'Enable Auto-Renew'}
            </button>
          </div>
        )}

        {isActivePaid && (
          <div className="px-6 py-3.5 bg-emerald-50 border-b border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold text-emerald-950">Pro Subscription Active</span>
                <span className="block text-[11px] text-emerald-800 mt-0.5">
                  Next billing date: <strong>{subscription.nextBillingDate ? new Date(subscription.nextBillingDate).toLocaleDateString() : 'N/A'}</strong>.
                </span>
              </div>
            </div>

            <button
              onClick={handleToggleAutoRenew}
              disabled={isProcessing}
              className="text-xs font-semibold px-2.5 py-1 bg-white hover:bg-emerald-100 border border-emerald-300 rounded text-emerald-900 transition-colors shrink-0"
            >
              {subscription.autoRenew ? 'Turn Off Auto-Renew' : 'Turn On Auto-Renew'}
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-5">
          {successNotice && (
            <div className="flex items-start gap-2.5 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
              <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Plan Updated</p>
                <p>{successNotice}</p>
              </div>
            </div>
          )}

          {/* Trial Explanation Timeline */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              How the One-Time Trial & Next Subscription Works:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <span className="font-mono text-[10px] font-bold text-indigo-600 uppercase block">Step 1 · Today</span>
                <p className="font-semibold text-slate-900">Start 14-Day Free Trial</p>
                <p className="text-[11px] text-slate-500">
                  Instant full access to all Pro features. Zero charge today.
                </p>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <span className="font-mono text-[10px] font-bold text-amber-600 uppercase block">Step 2 · Day 12</span>
                <p className="font-semibold text-slate-900">Reminder Notice</p>
                <p className="text-[11px] text-slate-500">
                  Reminder email before trial expires. Cancel anytime with one click.
                </p>
              </div>

              <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-1">
                <span className="font-mono text-[10px] font-bold text-emerald-600 uppercase block">Step 3 · Day 15</span>
                <p className="font-semibold text-slate-900">Next Subscription</p>
                <p className="text-[11px] text-slate-500">
                  Transitions automatically to your chosen recurring plan.
                </p>
              </div>
            </div>
          </div>

          {/* Pricing Tier Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {SUBSCRIPTION_PLANS.filter((p) => p.period !== 'free').map((plan) => {
              const isSelected = selectedPlanId === plan.id;

              return (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlanId(plan.id as any)}
                  className={`p-5 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/30 shadow-md ring-1 ring-indigo-600'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white shadow-xs">
                      MOST POPULAR
                    </span>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-bold text-slate-900">{plan.name}</h4>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </div>
                    </div>

                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-black font-mono tracking-tight text-slate-900">
                        ${plan.price}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        /{plan.period}
                      </span>
                    </div>

                    <div className="mt-1 text-xs text-indigo-700 font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      <span>14 days free, then ${plan.price}/{plan.period}</span>
                    </div>

                    {/* Features list */}
                    <div className="mt-4 pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                      {plan.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!currentUser && (
            <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Sign in with Google to associate your one-time trial and sync receipt data.</span>
              </div>
              <button
                onClick={onSignIn}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shrink-0 transition-colors"
              >
                Sign In
              </button>
            </div>
          )}

          {/* Reserved and Prohibited Terms Compliance Policy Panel */}
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50 text-xs">
            <button
              onClick={() => setShowProhibitedTerms(!showProhibitedTerms)}
              className="w-full flex items-center justify-between p-3.5 text-left text-slate-800 hover:bg-slate-100 transition-colors font-medium"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-slate-600" />
                <span className="font-semibold text-slate-900">
                  Reserved & Prohibited Terms Policy
                </span>
                <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-mono">
                  Financial Integrity
                </span>
              </div>
              {showProhibitedTerms ? (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              )}
            </button>

            {showProhibitedTerms && (
              <div className="p-4 border-t border-slate-200 bg-white space-y-3 animate-in fade-in duration-150">
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  To protect payment security, prevent chargeback abuse, and avoid misleading billing records, SplitExact enforces restrictions on user-generated receipt tags, custom billing notes, and participant identifiers:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <FileLock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Reserved System Terms:</span>
                    </span>
                    <p className="text-slate-500 text-[10px]">
                      Protected identifiers reserved exclusively for official billing audit protocols:
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {RESERVED_TERMS.map((term) => (
                        <span
                          key={term}
                          className="px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-700 font-mono text-[10px]"
                        >
                          {term}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-rose-50/60 border border-rose-200 space-y-1.5">
                    <span className="font-bold text-rose-900 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <span>Prohibited Terms:</span>
                    </span>
                    <p className="text-rose-700/80 text-[10px]">
                      Strictly disallowed phrases relating to payment fraud, sensitive card data (CVV/PIN/SSN), or fake transactions:
                    </p>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {PROHIBITED_TERMS.slice(0, 10).map((term) => (
                        <span
                          key={term}
                          className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-mono text-[10px]"
                        >
                          {term}
                        </span>
                      ))}
                      <span className="text-[10px] text-rose-500 italic self-center">
                        + carding, exploit, counterfeit
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="text-[11px] text-slate-500">
            {isTrialActive
              ? `Trial active · Next billing: ${selectedPlanId === 'pro_annual' ? '$39.99/year' : '$4.99/month'}`
              : hasUsedTrial
              ? `Next billing: ${selectedPlanId === 'pro_annual' ? '$39.99/year' : '$4.99/month'}`
              : `14-Day One-Time Trial ($0.00 today) · Next: ${selectedPlanId === 'pro_annual' ? '$39.99/year' : '$4.99/month'}`}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Close
            </button>

            <button
              onClick={handleAction}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              <span>
                {!currentUser
                  ? 'Sign in to Start Trial'
                  : isTrialActive
                  ? `Switch Next Plan to ${selectedPlanId === 'pro_annual' ? 'Annual' : 'Monthly'}`
                  : hasUsedTrial
                  ? `Subscribe to ${selectedPlanId === 'pro_annual' ? 'Annual ($39.99/yr)' : 'Monthly ($4.99/mo)'}`
                  : 'Start 14-Day Free Trial'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
