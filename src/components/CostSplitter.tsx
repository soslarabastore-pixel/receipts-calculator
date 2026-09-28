import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  Check,
  Copy,
  CheckCheck,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldAlert,
  Share2,
  Download,
} from 'lucide-react';
import { Receipt, Participant, ReceiptItem, ItemAssignment } from '../types';
import { calculateSplit, formatCurrency, round2 } from '../utils/calculations';
import { validateTerm } from '../utils/moderation';

interface CostSplitterProps {
  receipt: Receipt;
  onChangeReceipt: (updated: Receipt) => void;
  participants: Participant[];
  onChangeParticipants: (updated: Participant[]) => void;
  onProceedToAuditor: () => void;
  onOpenExport?: () => void;
}

const PALETTE = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DB2777', '#0891B2', '#4F46E5', '#EA580C'];

export const CostSplitter: React.FC<CostSplitterProps> = ({
  receipt,
  onChangeReceipt,
  participants,
  onChangeParticipants,
  onProceedToAuditor,
  onOpenExport,
}) => {
  const [newPersonName, setNewPersonName] = useState('');
  const [participantError, setParticipantError] = useState<string | null>(null);
  const [paidStatusMap, setPaidStatusMap] = useState<Record<string, boolean>>({});
  const [paymentMethodMap, setPaymentMethodMap] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const splitResult = calculateSplit(receipt, participants, paidStatusMap, paymentMethodMap);

  // Participant management
  const handleAddParticipant = () => {
    if (!newPersonName.trim()) return;
    const name = newPersonName.trim();

    // Check duplicate
    if (participants.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      setParticipantError(`"${name}" is already in the split list.`);
      return;
    }

    // Validate reserved/prohibited terms
    const check = validateTerm(name, 'Participant name');
    if (!check.isValid) {
      setParticipantError(check.reason || 'This name cannot be used.');
      return;
    }

    setParticipantError(null);
    const initials = name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();

    const color = PALETTE[participants.length % PALETTE.length];

    const newPerson: Participant = {
      id: `p-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      name,
      color,
      avatarInitials: initials || name.substring(0, 2).toUpperCase(),
    };

    onChangeParticipants([...participants, newPerson]);
    setNewPersonName('');
  };

  const handleRemoveParticipant = (id: string) => {
    const updatedParticipants = participants.filter((p) => p.id !== id);
    // Remove their assignment from receipt items
    const updatedItems = receipt.items.map((item) => ({
      ...item,
      assignedTo: item.assignedTo.filter((a) => a.participantId !== id),
    }));
    onChangeParticipants(updatedParticipants);
    onChangeReceipt({ ...receipt, items: updatedItems });
  };

  // Item assignment toggle
  const handleToggleAssignment = (itemId: string, participantId: string) => {
    const updatedItems = receipt.items.map((item) => {
      if (item.id !== itemId) return item;

      const isAlreadyAssigned = item.assignedTo.some((a) => a.participantId === participantId);
      let newAssignments: ItemAssignment[];

      if (isAlreadyAssigned) {
        newAssignments = item.assignedTo.filter((a) => a.participantId !== participantId);
      } else {
        newAssignments = [...item.assignedTo, { participantId, shares: 1 }];
      }

      return { ...item, assignedTo: newAssignments };
    });

    onChangeReceipt({ ...receipt, items: updatedItems });
  };

  const handleAssignItemToAll = (itemId: string) => {
    const updatedItems = receipt.items.map((item) => {
      if (item.id !== itemId) return item;
      const allAssigned = participants.map((p) => ({ participantId: p.id, shares: 1 }));
      return { ...item, assignedTo: allAssigned };
    });
    onChangeReceipt({ ...receipt, items: updatedItems });
  };

  const handleAssignAllItemsToEveryone = () => {
    const updatedItems = receipt.items.map((item) => ({
      ...item,
      assignedTo: participants.map((p) => ({ participantId: p.id, shares: 1 })),
    }));
    onChangeReceipt({ ...receipt, items: updatedItems });
  };

  const handleClearAllAssignments = () => {
    const updatedItems = receipt.items.map((item) => ({
      ...item,
      assignedTo: [],
    }));
    onChangeReceipt({ ...receipt, items: updatedItems });
  };

  // Copy individual breakdown
  const handleCopyBreakdown = (breakdown: (typeof splitResult.participantBreakdowns)[0]) => {
    const lines = [
      `🧾 Bill Split from ${receipt.merchant || 'Dinner'}:`,
      `Participant: ${breakdown.participantName}`,
      `Items: ${formatCurrency(breakdown.itemsSubtotal, receipt.currency)}`,
      ...breakdown.items.map(
        (it) => `  · ${it.itemName} (${it.portionShare === 1 ? 'Solo' : `Shared 1/${Math.round(1 / it.portionShare)}`}): ${formatCurrency(it.assignedAmount, receipt.currency)}`
      ),
      breakdown.discountShare > 0 ? `Discount: -${formatCurrency(breakdown.discountShare, receipt.currency)}` : null,
      `Tax: ${formatCurrency(breakdown.taxShare, receipt.currency)}`,
      `Tip: ${formatCurrency(breakdown.tipShare, receipt.currency)}`,
      breakdown.feesShare > 0 ? `Fees: ${formatCurrency(breakdown.feesShare, receipt.currency)}` : null,
      `------------------------`,
      `TOTAL OWED: ${formatCurrency(breakdown.finalTotal, receipt.currency)}`,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedId(breakdown.participantId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllBreakdowns = () => {
    const header = [
      `🧾 Full Bill Breakdown - ${receipt.merchant || 'Event'}`,
      `Date: ${receipt.date}`,
      `Grand Total: ${formatCurrency(splitResult.grandTotal, receipt.currency)}`,
      `========================`,
    ];

    const people = splitResult.participantBreakdowns.map((b) => {
      return `${b.participantName}: ${formatCurrency(b.finalTotal, receipt.currency)} (Items: ${formatCurrency(b.itemsSubtotal, receipt.currency)} + Tax/Tip/Fees: ${formatCurrency(b.taxShare + b.tipShare + b.feesShare - b.discountShare, receipt.currency)})`;
    });

    const fullText = [...header, ...people].join('\n');
    navigator.clipboard.writeText(fullText);
    setCopiedId('all');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Participant Management Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">People Splitting ({participants.length})</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Add everyone who is sharing this bill, then tap their names on each item below.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddParticipant()}
              placeholder="Friend's Name"
              className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 w-44 bg-white"
            />
            <button
              onClick={handleAddParticipant}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Person</span>
            </button>
          </div>
        </div>

        {/* Prohibited / Reserved Name Warning */}
        {participantError && (
          <div className="pt-2 pb-1 text-xs text-rose-600 flex items-center gap-1.5 font-medium animate-in fade-in duration-100">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{participantError}</span>
          </div>
        )}

        {/* Participant list */}
        <div className="flex flex-wrap items-center gap-2 pt-3">
          {participants.map((person) => (
            <div
              key={person.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
            >
              <div
                className="w-5 h-5 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0"
                style={{ backgroundColor: person.color }}
              >
                {person.avatarInitials}
              </div>
              <span className="font-medium text-slate-800">{person.name}</span>
              <button
                onClick={() => handleRemoveParticipant(person.id)}
                className="text-slate-400 hover:text-rose-600 p-0.5 ml-1 transition-colors"
                title={`Remove ${person.name}`}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {participants.length === 0 && (
            <p className="text-xs text-slate-400 italic">No people added yet. Add at least 1 person.</p>
          )}
        </div>

        {/* Splitting Strategy Selector */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700">Tax, Tip & Fee Distribution:</span>
            <div className="flex items-center p-0.5 bg-slate-100 rounded">
              <button
                onClick={() => onChangeReceipt({ ...receipt, allocationStrategy: 'proportional' })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  receipt.allocationStrategy === 'proportional'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600'
                }`}
                title="Fair standard: each person pays tax and tip in proportion to the cost of dishes they ate"
              >
                Proportional to Food Spend (Fair)
              </button>
              <button
                onClick={() => onChangeReceipt({ ...receipt, allocationStrategy: 'equal' })}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  receipt.allocationStrategy === 'equal'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600'
                }`}
                title="Split tax, tip and fees equally across all people"
              >
                Split Tax & Tip Equally
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAssignAllItemsToEveryone}
              className="text-xs text-slate-600 hover:text-slate-900 underline"
            >
              Split all items equally
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={handleClearAllAssignments}
              className="text-xs text-slate-600 hover:text-slate-900 underline"
            >
              Clear assignments
            </button>
          </div>
        </div>
      </div>

      {/* Item Assignment Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Assign Items to People</h2>
            {splitResult.hasUnassignedItems && (
              <span className="flex items-center gap-1 text-xs text-amber-700 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {formatCurrency(splitResult.unassignedItemsTotal, receipt.currency)} unassigned
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">
            Click person buttons to share a dish
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {receipt.items.map((item, index) => {
            const assignedCount = item.assignedTo.length;
            const itemTotal = item.totalPrice || item.unitPrice * item.quantity;
            const shareCost = assignedCount > 0 ? round2(itemTotal / assignedCount) : 0;

            return (
              <div
                key={item.id}
                className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                {/* Item Info */}
                <div className="min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-slate-400">#{index + 1}</span>
                    <span className="text-xs font-semibold text-slate-900">{item.name || 'Untitled Item'}</span>
                    {item.quantity > 1 && (
                      <span className="text-xs font-mono text-slate-500">×{item.quantity}</span>
                    )}
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-500 mt-0.5">
                    {formatCurrency(itemTotal, receipt.currency)}
                    {assignedCount > 0 && (
                      <span className="text-slate-400 font-sans ml-2">
                        · {formatCurrency(shareCost, receipt.currency)} each ({assignedCount}{' '}
                        {assignedCount === 1 ? 'person' : 'people'})
                      </span>
                    )}
                  </div>
                </div>

                {/* Assignment Buttons */}
                <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-start md:justify-end">
                  {participants.map((person) => {
                    const isAssigned = item.assignedTo.some((a) => a.participantId === person.id);

                    return (
                      <button
                        key={person.id}
                        onClick={() => handleToggleAssignment(item.id, person.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                          isAssigned
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <div
                          className="w-3.5 h-3.5 rounded-full text-[9px] font-bold text-white flex items-center justify-center shrink-0"
                          style={{ backgroundColor: person.color }}
                        >
                          {person.avatarInitials}
                        </div>
                        <span>{person.name.split(' ')[0]}</span>
                        {isAssigned && <Check className="w-3 h-3 text-emerald-400 shrink-0" />}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => handleAssignItemToAll(item.id)}
                    className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-900 rounded border border-dashed border-slate-200 hover:border-slate-400 transition-colors ml-1"
                    title="Split among all participants"
                  >
                    Everyone
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Individual Breakdown Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Summary per Person</h2>
            <span className="text-xs text-slate-500">
              (Exact mathematical distribution down to the penny)
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenExport && (
              <button
                onClick={onOpenExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-xs"
                title="Download as CSV spreadsheet or text report"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Export CSV / Report</span>
              </button>
            )}

            <button
              onClick={handleCopyAllBreakdowns}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors shadow-xs"
            >
              {copiedId === 'all' ? (
                <>
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">Copied All!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                  <span>Copy All Totals</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {splitResult.participantBreakdowns.map((p) => {
            const isCopied = copiedId === p.participantId;

            return (
              <div
                key={p.participantId}
                className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between relative group hover:border-slate-300 transition-colors"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full text-xs font-bold text-white flex items-center justify-center shadow-xs"
                        style={{ backgroundColor: p.participantColor }}
                      >
                        {p.participantName.substring(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-slate-900 truncate max-w-[120px]">
                        {p.participantName}
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopyBreakdown(p)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                      title="Copy individual itemized breakdown"
                    >
                      {isCopied ? (
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  {/* Final Total Owed */}
                  <div className="py-3">
                    <span className="text-xs text-slate-500 block">Total Owed</span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-slate-900">
                      {formatCurrency(p.finalTotal, receipt.currency)}
                    </span>
                  </div>

                  {/* Itemized math */}
                  <div className="space-y-1 text-xs pt-1 border-t border-slate-100 text-slate-600">
                    <div className="flex justify-between">
                      <span>Dishes Subtotal:</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {formatCurrency(p.itemsSubtotal, receipt.currency)}
                      </span>
                    </div>

                    {p.discountShare > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Discount share:</span>
                        <span className="font-mono tabular-nums">
                          -{formatCurrency(p.discountShare, receipt.currency)}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span>Tax share:</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {formatCurrency(p.taxShare, receipt.currency)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span>Tip share:</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {formatCurrency(p.tipShare, receipt.currency)}
                      </span>
                    </div>

                    {p.feesShare > 0 && (
                      <div className="flex justify-between">
                        <span>Fees share:</span>
                        <span className="font-mono tabular-nums text-slate-900">
                          {formatCurrency(p.feesShare, receipt.currency)}
                        </span>
                      </div>
                    )}

                    {p.roundingAdjustment !== 0 && (
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Penny adjustment:</span>
                        <span className="font-mono tabular-nums">
                          {p.roundingAdjustment > 0 ? '+' : ''}
                          {formatCurrency(p.roundingAdjustment, receipt.currency)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Assigned items list */}
                  <div className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <span className="font-medium text-slate-700 block mb-1">
                      Ordered ({p.items.length}):
                    </span>
                    <div className="max-h-24 overflow-y-auto space-y-0.5 pr-1">
                      {p.items.map((it) => (
                        <div key={it.itemId} className="flex justify-between truncate">
                          <span className="truncate pr-1">
                            {it.itemName}{' '}
                            {it.portionShare < 1 && (
                              <span className="text-slate-400">
                                (1/{Math.round(1 / it.portionShare)})
                              </span>
                            )}
                          </span>
                          <span className="font-mono tabular-nums shrink-0">
                            {formatCurrency(it.assignedAmount, receipt.currency)}
                          </span>
                        </div>
                      ))}
                      {p.items.length === 0 && (
                        <span className="italic text-slate-400">No items assigned yet</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Paid Status Toggle */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() =>
                      setPaidStatusMap((prev) => ({
                        ...prev,
                        [p.participantId]: !prev[p.participantId],
                      }))
                    }
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                      p.isPaid
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {p.isPaid ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Paid</span>
                      </>
                    ) : (
                      <span>Mark Paid</span>
                    )}
                  </button>

                  <select
                    value={p.paymentMethod || 'Cash'}
                    onChange={(e) =>
                      setPaymentMethodMap((prev) => ({
                        ...prev,
                        [p.participantId]: e.target.value,
                      }))
                    }
                    className="text-[11px] text-slate-500 bg-transparent border-0 focus:ring-0 p-0 cursor-pointer"
                  >
                    <option value="Cash / Transfer">Cash / Venmo</option>
                    <option value="Card Swipe">Card</option>
                    <option value="Apple Pay">Apple Pay</option>
                    <option value="Zelle">Zelle</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Verification footer & link to Deduction Reconciler */}
      <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono">
              Sum Balanced: {formatCurrency(splitResult.grandTotal, receipt.currency)}
            </span>
            <span className="text-xs text-slate-400">
              Receipt Grand Total:{' '}
              <strong className="text-white font-mono">
                {formatCurrency(splitResult.grandTotal, receipt.currency)}
              </strong>
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Did you or your friends pay via credit card, mobile pay, or split cards? Verify that the amount
            deducted from the bank statement or card transaction is 100% accurate.
          </p>
        </div>

        <button
          onClick={onProceedToAuditor}
          className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shadow-xs shrink-0 self-start md:self-auto"
        >
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>Check Bank Deduction</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
