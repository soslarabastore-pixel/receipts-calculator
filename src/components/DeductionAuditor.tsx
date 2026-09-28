import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  Sparkles,
  Loader2,
  Copy,
  CheckCheck,
  CreditCard,
  Plus,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Receipt, CardDeductionRecord, DiscrepancyDiagnostic } from '../types';
import {
  calculateReceiptTotals,
  formatCurrency,
  round2,
  runRuleBasedDeductionAudit,
} from '../utils/calculations';
import { validateTerm } from '../utils/moderation';

interface DeductionAuditorProps {
  receipt: Receipt;
  onSaveAuditLog?: (auditData: any) => void;
}

export const DeductionAuditor: React.FC<DeductionAuditorProps> = ({
  receipt,
  onSaveAuditLog,
}) => {
  const totals = calculateReceiptTotals(receipt);

  // Inputs
  const [expectedAmount, setExpectedAmount] = useState<number>(totals.grandTotal);
  const [actualDeducted, setActualDeducted] = useState<string>(totals.grandTotal.toString());
  const [paymentType, setPaymentType] = useState<'single_card' | 'split_cards'>('single_card');
  const [cardStatus, setCardStatus] = useState<'pending' | 'settled'>('pending');
  const [descriptor, setDescriptor] = useState<string>('');
  const [descriptorError, setDescriptorError] = useState<string | null>(null);

  // Split cards state
  const [splitCards, setSplitCards] = useState<CardDeductionRecord[]>([
    { id: 'c-1', cardLabel: 'Card 1 (Main Payer)', amount: totals.grandTotal, status: 'pending' },
  ]);

  // AI Analysis state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{
    likelyReason: string;
    secondaryFactors?: string[];
    recommendedAction: string;
    disputeTemplate: string;
    isLikelyTemporaryHold: boolean;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [copiedDispute, setCopiedDispute] = useState(false);
  const [showFaq, setShowFaq] = useState(false);

  // Google Search Grounding state
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    summary: string;
    sources: { title: string; uri: string }[];
  } | null>(null);

  const handleRunSearchGrounding = async () => {
    setSearchLoading(true);
    try {
      const res = await fetch('/api/merchant/search-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantName: receipt.merchant,
          descriptor,
          queryTopic: 'credit card fee surcharge billing statement descriptor policy',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSearchResult({
          summary: data.summary,
          sources: data.sources || [],
        });
      }
    } catch (e) {
      console.error('Failed to run search grounding:', e);
    } finally {
      setSearchLoading(false);
    }
  };

  // Update expected amount when receipt changes
  useEffect(() => {
    setExpectedAmount(totals.grandTotal);
  }, [totals.grandTotal]);

  const numActual = paymentType === 'single_card'
    ? parseFloat(actualDeducted) || 0
    : round2(splitCards.reduce((acc, c) => acc + (c.amount || 0), 0));

  const ruleAudit = runRuleBasedDeductionAudit(
    expectedAmount,
    numActual,
    receipt,
    paymentType === 'split_cards' ? splitCards : undefined
  );

  const discrepancy = ruleAudit.discrepancy;
  const isExactMatch = Math.abs(discrepancy) < 0.005;

  // Split cards handlers
  const handleAddSplitCard = () => {
    const newCard: CardDeductionRecord = {
      id: `c-${Date.now()}`,
      cardLabel: `Card ${splitCards.length + 1}`,
      amount: 0,
      status: 'pending',
    };
    setSplitCards([...splitCards, newCard]);
  };

  const handleUpdateSplitCard = (id: string, field: keyof CardDeductionRecord, value: any) => {
    setSplitCards(
      splitCards.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const handleRemoveSplitCard = (id: string) => {
    if (splitCards.length <= 1) return;
    setSplitCards(splitCards.filter((c) => c.id !== id));
  };

  // Run AI deep diagnostic
  const handleRunAiAudit = async () => {
    setAiLoading(true);
    setAiError(null);

    try {
      const payload = {
        expectedTotal: expectedAmount,
        actualDeducted: numActual,
        currency: receipt.currency,
        merchantName: receipt.merchant,
        paymentMethod: paymentType === 'single_card' ? 'Credit/Debit Card' : 'Multiple Split Cards',
        statementDescriptor: descriptor || undefined,
        taxAmount: totals.taxTotal,
        tipAmount: totals.tipTotal,
        fees: receipt.fees,
        discrepancyType: ruleAudit.possibleCauses[0]?.title || 'General variance',
      };

      const res = await fetch('/api/reconcile/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data?.details || data?.error || 'AI audit request failed');
      }

      setAiResult(data.analysis);
      if (onSaveAuditLog) {
        onSaveAuditLog({
          receiptId: receipt.id,
          expectedAmount,
          actualDeducted: numActual,
          discrepancy,
          analysis: data.analysis,
          date: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      console.error(err);
      setAiError(err.message || 'Unable to generate AI analysis.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopyDispute = () => {
    if (!aiResult?.disputeTemplate) return;
    navigator.clipboard.writeText(aiResult.disputeTemplate);
    setCopiedDispute(true);
    setTimeout(() => setCopiedDispute(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Purpose & Reconciler Introduction */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">
                Payment Deduction Reconciler & Auditor
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Cross-check the actual charge debited from your card or bank account against the
              calculated receipt total to catch surprise card surcharges, duplicate tips, post-tax tip
              errors, or temporary authorization holds.
            </p>
          </div>

          <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs font-medium self-start md:self-auto">
            <button
              onClick={() => setPaymentType('single_card')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                paymentType === 'single_card'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Single Card / App
            </button>
            <button
              onClick={() => setPaymentType('split_cards')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                paymentType === 'split_cards'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Split Across Cards
            </button>
          </div>
        </div>

        {/* Audit Inputs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          {/* Expected Receipt Total */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Expected Total (from Receipt & Slip)
            </label>
            <div className="relative">
              <span className="text-slate-400 font-mono text-xs absolute left-3 top-2.5">
                {receipt.currency}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={expectedAmount || ''}
                onChange={(e) => setExpectedAmount(parseFloat(e.target.value) || 0)}
                className="w-full text-xs font-mono tabular-nums pl-7 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
              />
            </div>
            <span className="text-[11px] text-slate-400 block mt-1">
              Auto-filled from Receipt Grand Total ({receipt.merchant || 'Merchant'})
            </span>
          </div>

          {/* Actual Deducted Amount */}
          {paymentType === 'single_card' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Actual Bank / Card Charge
              </label>
              <div className="relative">
                <span className="text-slate-400 font-mono text-xs absolute left-3 top-2.5">
                  {receipt.currency}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={actualDeducted}
                  onChange={(e) => setActualDeducted(e.target.value)}
                  placeholder="0.00"
                  className="w-full text-xs font-mono tabular-nums pl-7 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                Check your mobile banking app or SMS alert
              </span>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Charged across {splitCards.length} Cards
              </label>
              <div className="text-base font-bold font-mono tabular-nums py-1.5 text-slate-900">
                {formatCurrency(numActual, receipt.currency)}
              </div>
              <span className="text-[11px] text-slate-400 block mt-1">
                Sum of all individual card authorization amounts
              </span>
            </div>
          )}

          {/* Transaction Metadata */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Transaction Status
            </label>
            <div className="flex items-center gap-2">
              <select
                value={cardStatus}
                onChange={(e) => setCardStatus(e.target.value as any)}
                className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
              >
                <option value="pending">Pending (Pre-Authorization)</option>
                <option value="settled">Settled / Posted (Final Charge)</option>
              </select>

              <input
                type="text"
                value={descriptor}
                onChange={(e) => {
                  const val = e.target.value;
                  setDescriptor(val);
                  if (val.trim()) {
                    const check = validateTerm(val, 'Billing descriptor');
                    if (!check.isValid) {
                      setDescriptorError(check.reason || 'Invalid descriptor');
                    } else {
                      setDescriptorError(null);
                    }
                  } else {
                    setDescriptorError(null);
                  }
                }}
                placeholder="Descriptor (optional)"
                className="flex-1 text-xs px-2.5 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
              />
            </div>
            {descriptorError ? (
              <span className="text-[11px] text-rose-600 font-medium block mt-1">
                {descriptorError}
              </span>
            ) : (
              <span className="text-[11px] text-slate-400 block mt-1">
                {cardStatus === 'pending'
                  ? 'Pending holds often include temporary cushions that drop'
                  : 'Settled charges are permanently billed to your statement'}
              </span>
            )}
          </div>
        </div>

        {/* If Split Cards mode: list each card */}
        {paymentType === 'split_cards' && (
          <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Split Card Swipes:</span>
              <button
                onClick={handleAddSplitCard}
                className="flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Another Card Swipe</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {splitCards.map((card, idx) => (
                <div
                  key={card.id}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <input
                      type="text"
                      value={card.cardLabel}
                      onChange={(e) => handleUpdateSplitCard(card.id, 'cardLabel', e.target.value)}
                      className="text-xs font-medium text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-900 focus:outline-none w-3/4"
                    />
                    {splitCards.length > 1 && (
                      <button
                        onClick={() => handleRemoveSplitCard(card.id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="relative">
                    <span className="text-slate-400 font-mono text-xs absolute left-2.5 top-2">
                      {receipt.currency}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={card.amount || ''}
                      onChange={(e) =>
                        handleUpdateSplitCard(card.id, 'amount', parseFloat(e.target.value) || 0)
                      }
                      placeholder="0.00"
                      className="w-full text-xs font-mono tabular-nums pl-6 pr-2 py-1.5 bg-white border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Discrepancy Status Card */}
      <div
        className={`border rounded-xl p-5 shadow-xs transition-all ${
          isExactMatch
            ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
            : discrepancy > 0
            ? 'bg-amber-50/60 border-amber-200 text-amber-950'
            : 'bg-blue-50/60 border-blue-200 text-blue-950'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                isExactMatch
                  ? 'bg-emerald-100 text-emerald-700'
                  : discrepancy > 0
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {isExactMatch ? (
                <ShieldCheck className="w-6 h-6" />
              ) : (
                <ShieldAlert className="w-6 h-6" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-bold tracking-wider">
                  {isExactMatch
                    ? 'Payment Reconciled'
                    : discrepancy > 0
                    ? 'Discrepancy Detected: Overcharge'
                    : 'Discrepancy Detected: Undercharge'}
                </span>
                <span className="text-xs opacity-75">·</span>
                <span className="text-xs font-mono font-semibold">
                  {isExactMatch
                    ? 'Balanced ($0.00 difference)'
                    : `${discrepancy > 0 ? '+' : ''}${formatCurrency(discrepancy, receipt.currency)}`}
                </span>
              </div>

              <h3 className="text-base font-semibold mt-0.5">
                {isExactMatch
                  ? 'Deduction amount matches calculated receipt total with 100% precision.'
                  : discrepancy > 0
                  ? `You were charged ${formatCurrency(discrepancy, receipt.currency)} more than your receipt total.`
                  : `You were charged ${formatCurrency(Math.abs(discrepancy), receipt.currency)} less than your receipt total.`}
              </h3>

              <p className="text-xs opacity-85 mt-1">
                Expected: <strong>{formatCurrency(expectedAmount, receipt.currency)}</strong> · Deducted:{' '}
                <strong>{formatCurrency(numActual, receipt.currency)}</strong>
              </p>
            </div>
          </div>

          {!isExactMatch && (
            <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto">
              <button
                onClick={handleRunSearchGrounding}
                disabled={searchLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors"
                title="Use Google Search data to verify merchant surcharge policies and bank descriptors"
              >
                {searchLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
                    <span>Searching Web...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Search Merchant Data</span>
                  </>
                )}
              </button>

              <button
                onClick={handleRunAiAudit}
                disabled={aiLoading}
                className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Auditing with AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Diagnose & Draft Dispute</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Google Search Grounding Merchant Policy Card */}
      {searchResult && (
        <div className="bg-white border border-indigo-200 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-2.5">
            <div className="flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                Google Search Grounding: {receipt.merchant || 'Merchant'} Insights
              </h3>
            </div>
            <span className="text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-medium">
              Real-time Web Grounded
            </span>
          </div>

          <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
            {searchResult.summary}
          </p>

          {searchResult.sources.length > 0 && (
            <div className="pt-1">
              <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                Verified Web Sources:
              </span>
              <div className="flex flex-wrap gap-2">
                {searchResult.sources.map((src, idx) => (
                  <a
                    key={idx}
                    href={src.uri}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors"
                  >
                    <span>{src.title || 'Source'}</span>
                    <ExternalLink className="w-2.5 h-2.5 text-slate-400" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rule-Based Diagnostics Grid */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Diagnostic Audit Analysis ({ruleAudit.possibleCauses.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated financial pattern matching against known card processing and terminal behaviors.
            </p>
          </div>
          <button
            onClick={() => setShowFaq(!showFaq)}
            className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium"
          >
            <span>Common Deductions Guide</span>
            {showFaq ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Collapsible FAQ Guide */}
        {showFaq && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2.5 text-slate-700">
            <h4 className="font-semibold text-slate-900">Why does a card charge often differ from the bill?</h4>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-600 leading-relaxed">
              <li>
                <strong>Pending Authorization Hold:</strong> Restaurants, bars, and hotels often authorize an additional 20% hold to cover pending gratuity. This is not the final charge and settles in 1–3 business days.
              </li>
              <li>
                <strong>Non-Cash Adjustment / Card Surcharge:</strong> Many vendors quietly tack on a 2.5%–4% processing surcharge for credit cards.
              </li>
              <li>
                <strong>Tip Entered Twice or Auto-Gratuity:</strong> If the venue already included an 18% gratuity on the check and you also filled out the tip line on the slip, both may have been charged.
              </li>
              <li>
                <strong>Tip Calculated on Post-Tax:</strong> Calculating an 18% or 20% tip on the post-tax total rather than pre-tax creates an unexpected few-dollar variance.
              </li>
              <li>
                <strong>Foreign Exchange or Currency Markups:</strong> If traveling, foreign transaction fees (1%–3%) or dynamic currency conversion spreads cause instant discrepancies.
              </li>
            </ul>
          </div>
        )}

        {/* Causes list */}
        <div className="space-y-3">
          {ruleAudit.possibleCauses.map((cause) => (
            <div
              key={cause.id}
              className="p-4 border border-slate-200 rounded-lg hover:border-slate-300 transition-colors bg-white space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cause.probability === 'high' ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                  />
                  <h4 className="text-xs font-semibold text-slate-900">{cause.title}</h4>
                </div>
                <span className="text-[11px] text-slate-400 uppercase font-mono">
                  {cause.probability} probability
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">{cause.description}</p>

              <div className="pt-1 flex items-start gap-1.5 text-xs text-slate-800">
                <span className="font-semibold text-slate-900 shrink-0">Action:</span>
                <span className="text-slate-600">{cause.suggestedAction}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Deep Analysis & Dispute Letter Section */}
      {aiResult && (
        <div className="bg-white border border-indigo-200 rounded-xl p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-900">
                AI Deep Diagnostic & Dispute Resolution
              </h3>
            </div>
            <span className="text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-medium">
              Powered by Gemini 3.8 Flash
            </span>
          </div>

          <div className="space-y-3">
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Primary Assessment:
              </span>
              <p className="text-xs text-slate-800 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">
                {aiResult.likelyReason}
              </p>
            </div>

            {aiResult.secondaryFactors && aiResult.secondaryFactors.length > 0 && (
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-1">
                  Contributing Factors:
                </span>
                <ul className="list-disc pl-5 text-xs text-slate-600 space-y-1">
                  {aiResult.secondaryFactors.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                Recommended Action:
              </span>
              <p className="text-xs text-slate-700">{aiResult.recommendedAction}</p>
            </div>

            {/* Dispute Email / Message Template */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-900">
                  Ready-to-Send Dispute Inquiry Template:
                </span>
                <button
                  onClick={handleCopyDispute}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
                >
                  {copiedDispute ? (
                    <>
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Template</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                readOnly
                value={aiResult.disputeTemplate}
                rows={6}
                className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                You can copy and send this note directly to the merchant management or paste into your bank's transaction inquiry window.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
