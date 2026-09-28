import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  DollarSign,
  Percent,
  Calendar,
  Store,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Download,
  Tag,
  X,
} from 'lucide-react';
import { Receipt, ReceiptItem, FeeItem } from '../types';
import { calculateReceiptTotals, formatCurrency, round2 } from '../utils/calculations';
import { validateTerm } from '../utils/moderation';

const PRESET_TAGS = ['Groceries', 'Work Trip', 'Birthday Dinner', 'Dining Out', 'Coffee / Snacks', 'Travel', 'Utilities', 'Household'];

interface ReceiptCalculatorProps {
  receipt: Receipt;
  onChangeReceipt: (updated: Receipt) => void;
  onProceedToSplit: () => void;
  onOpenScanner: () => void;
  onOpenExport?: () => void;
}

export const ReceiptCalculator: React.FC<ReceiptCalculatorProps> = ({
  receipt,
  onChangeReceipt,
  onProceedToSplit,
  onOpenScanner,
  onOpenExport,
}) => {
  const [newFeeName, setNewFeeName] = useState('');
  const [newFeeAmount, setNewFeeAmount] = useState<string>('');
  const [newFeeIsPercent, setNewFeeIsPercent] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);

  const currentTags = receipt.tags || [];

  const handleAddTag = (tagToAdd: string) => {
    const trimmed = tagToAdd.trim();
    if (!trimmed) return;
    if (currentTags.includes(trimmed)) {
      setTagError('This tag is already added.');
      return;
    }

    const check = validateTerm(trimmed, 'Tag');
    if (!check.isValid) {
      setTagError(check.reason || 'This term cannot be used.');
      return;
    }

    setTagError(null);
    onChangeReceipt({ ...receipt, tags: [...currentTags, trimmed] });
    setCustomTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTagError(null);
    onChangeReceipt({ ...receipt, tags: currentTags.filter((t) => t !== tagToRemove) });
  };

  const totals = calculateReceiptTotals(receipt);

  // Line items actions
  const handleItemChange = (index: number, field: keyof ReceiptItem, value: any) => {
    const updatedItems = [...receipt.items];
    const currentItem = { ...updatedItems[index], [field]: value };

    if (field === 'quantity' || field === 'unitPrice') {
      const q = field === 'quantity' ? Number(value) || 0 : currentItem.quantity;
      const u = field === 'unitPrice' ? Number(value) || 0 : currentItem.unitPrice;
      currentItem.totalPrice = round2(q * u);
    } else if (field === 'totalPrice') {
      const t = Number(value) || 0;
      const q = currentItem.quantity || 1;
      currentItem.unitPrice = round2(t / q);
    }

    updatedItems[index] = currentItem;
    onChangeReceipt({ ...receipt, items: updatedItems });
  };

  const handleAddItem = () => {
    const newItem: ReceiptItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      category: 'General',
      assignedTo: [],
    };
    onChangeReceipt({ ...receipt, items: [...receipt.items, newItem] });
  };

  const handleDeleteItem = (index: number) => {
    const updated = receipt.items.filter((_, i) => i !== index);
    onChangeReceipt({ ...receipt, items: updated });
  };

  // Fees actions
  const handleAddFee = () => {
    if (!newFeeName.trim() || !newFeeAmount) return;
    const num = parseFloat(newFeeAmount);
    if (isNaN(num)) return;

    const newFee: FeeItem = {
      id: `fee-${Date.now()}`,
      name: newFeeName.trim(),
      amount: newFeeIsPercent ? 0 : num,
      isPercentage: newFeeIsPercent,
      percentageValue: newFeeIsPercent ? num : undefined,
    };

    onChangeReceipt({ ...receipt, fees: [...receipt.fees, newFee] });
    setNewFeeName('');
    setNewFeeAmount('');
  };

  const handleRemoveFee = (id: string) => {
    onChangeReceipt({ ...receipt, fees: receipt.fees.filter((f) => f.id !== id) });
  };

  // Pre-tax vs post-tax tip difference comparison
  const preTaxTip = round2((totals.discountedSubtotal * (receipt.tipRate || 0)) / 100);
  const postTaxTip = round2(((totals.discountedSubtotal + totals.taxTotal) * (receipt.tipRate || 0)) / 100);
  const tipBasisDelta = round2(postTaxTip - preTaxTip);

  return (
    <div className="space-y-6">
      {/* Top Section: Merchant info and quick stats */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            {/* Merchant */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Merchant / Store
              </label>
              <div className="relative">
                <Store className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={receipt.merchant}
                  onChange={(e) => onChangeReceipt({ ...receipt, merchant: e.target.value })}
                  placeholder="e.g. Bistro Central"
                  className="w-full text-xs font-medium pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt Date
              </label>
              <div className="relative">
                <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="date"
                  value={receipt.date}
                  onChange={(e) => onChangeReceipt({ ...receipt, date: e.target.value })}
                  className="w-full text-xs font-medium pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                />
              </div>
            </div>

            {/* Currency */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Currency
              </label>
              <select
                value={receipt.currency}
                onChange={(e) => onChangeReceipt({ ...receipt, currency: e.target.value })}
                className="w-full text-xs font-medium px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
              >
                <option value="$">$ (USD / CAD / AUD)</option>
                <option value="€">€ (EUR)</option>
                <option value="£">£ (GBP)</option>
                <option value="¥">¥ (JPY / CNY)</option>
                <option value="₹">₹ (INR)</option>
                <option value="CHF">CHF (Swiss Franc)</option>
                <option value="R$">R$ (BRL)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onOpenExport && (
              <button
                onClick={onOpenExport}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 rounded-lg transition-colors border border-slate-200 shadow-2xs"
                title="Export receipt summary as CSV or text"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Export</span>
              </button>
            )}

            <button
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>AI Scan / Autofill</span>
            </button>
          </div>
        </div>

        {/* Tags management bar */}
        <div className="pt-3 pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-1.5 flex-1">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1 mr-1">
              <Tag className="w-3 h-3 text-slate-500" />
              <span>Tags:</span>
            </span>

            {currentTags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
              >
                <span>{tag}</span>
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-indigo-900 transition-colors p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {currentTags.length === 0 && (
              <span className="text-xs text-slate-400 italic">No tags added yet (e.g. Groceries, Work Trip)</span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick preset dropdown/buttons */}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) handleAddTag(e.target.value);
              }}
              className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
            >
              <option value="" disabled>+ Add Common Tag...</option>
              {PRESET_TAGS.filter((pt) => !currentTags.includes(pt)).map((pt) => (
                <option key={pt} value={pt}>{pt}</option>
              ))}
            </select>

            <div className="flex items-center gap-1">
              <input
                type="text"
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTag(customTagInput)}
                placeholder="Custom tag..."
                className="text-xs px-2 py-1 border border-slate-200 rounded-lg w-28 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
              />
              <button
                onClick={() => handleAddTag(customTagInput)}
                className="px-2 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Validation warning for reserved/prohibited terms */}
        {tagError && (
          <div className="pt-2 pb-1 text-xs text-rose-600 flex items-center gap-1.5 font-medium animate-in fade-in duration-100">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{tagError}</span>
          </div>
        )}

        {/* Live Top Summary Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-4 text-xs">
          <div>
            <span className="text-slate-500 block">Subtotal</span>
            <span className="font-mono tabular-nums font-semibold text-slate-900 text-sm">
              {formatCurrency(totals.subtotal, receipt.currency)}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block">Discounts</span>
            <span className="font-mono tabular-nums font-medium text-emerald-600 text-sm">
              -{formatCurrency(totals.discountTotal, receipt.currency)}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block">Tax</span>
            <span className="font-mono tabular-nums font-medium text-slate-800 text-sm">
              {formatCurrency(totals.taxTotal, receipt.currency)}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block">Fees</span>
            <span className="font-mono tabular-nums font-medium text-slate-800 text-sm">
              {formatCurrency(totals.feesTotal, receipt.currency)}
            </span>
          </div>

          <div>
            <span className="text-slate-500 block">Tip</span>
            <span className="font-mono tabular-nums font-medium text-slate-800 text-sm">
              {formatCurrency(totals.tipTotal, receipt.currency)}
            </span>
          </div>

          <div className="border-l border-slate-200 pl-3">
            <span className="text-slate-500 block font-semibold text-slate-900">Grand Total</span>
            <span className="font-mono tabular-nums font-bold text-slate-900 text-base">
              {formatCurrency(totals.grandTotal, receipt.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Itemized Lines Section */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Receipt Line Items</h2>
            <span className="text-xs text-slate-500 font-mono">
              ({receipt.items.length} {receipt.items.length === 1 ? 'item' : 'items'})
            </span>
          </div>
          <button
            onClick={handleAddItem}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Item</span>
          </button>
        </div>

        {receipt.items.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-700">No items on this receipt yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Add individual dishes, groceries, or goods to calculate totals and split them among participants.
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={handleAddItem}
                className="px-3.5 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Add First Item
              </button>
              <button
                onClick={onOpenScanner}
                className="px-3.5 py-1.5 text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200"
              >
                Scan Receipt Photo
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center">#</th>
                  <th className="py-2.5 px-4 min-w-[200px]">Item Description</th>
                  <th className="py-2.5 px-3 w-28">Category</th>
                  <th className="py-2.5 px-3 w-20 text-center">Qty</th>
                  <th className="py-2.5 px-3 w-24 text-right">Unit Price</th>
                  <th className="py-2.5 px-4 w-28 text-right font-semibold">Total Price</th>
                  <th className="py-2.5 px-3 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipt.items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="py-2 px-4 text-center font-mono text-slate-400">
                      {index + 1}
                    </td>

                    <td className="py-2 px-4">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        placeholder="e.g. Pasta Primavera"
                        className="w-full font-medium text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-900 focus:outline-none py-1"
                      />
                    </td>

                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={item.category || ''}
                        onChange={(e) => handleItemChange(index, 'category', e.target.value)}
                        placeholder="Food / Drink"
                        className="w-full text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-900 focus:outline-none py-1"
                      />
                    </td>

                    <td className="py-2 px-3 text-center">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                        className="w-16 font-mono tabular-nums text-center bg-slate-50 border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-900"
                      />
                    </td>

                    <td className="py-2 px-3 text-right">
                      <div className="relative inline-block w-20">
                        <span className="absolute left-1.5 top-1 text-slate-400 font-mono text-xs">
                          {receipt.currency}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unitPrice || ''}
                          onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                          className="w-full font-mono tabular-nums text-right bg-slate-50 border border-slate-200 rounded pl-4 pr-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-slate-900"
                        />
                      </div>
                    </td>

                    <td className="py-2 px-4 text-right">
                      <div className="relative inline-block w-24">
                        <span className="absolute left-2 top-1 text-slate-400 font-mono text-xs">
                          {receipt.currency}
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.totalPrice || ''}
                          onChange={(e) => handleItemChange(index, 'totalPrice', e.target.value)}
                          className="w-full font-mono tabular-nums font-semibold text-right bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-900 focus:outline-none py-1 pl-4 pr-1"
                        />
                      </div>
                    </td>

                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDeleteItem(index)}
                        className="p-1 text-slate-300 hover:text-rose-600 rounded transition-colors"
                        title="Delete item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleAddItem}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add another line</span>
          </button>
          <div className="text-xs text-slate-600">
            Items Subtotal:{' '}
            <span className="font-mono tabular-nums font-bold text-slate-900">
              {formatCurrency(totals.subtotal, receipt.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* Adjustments: Discounts, Tax, Surcharges/Fees, Tip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Box 1: Discounts & Taxes */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
            Discounts & Taxes
          </h3>

          {/* Discount */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Discount / Promo</label>
              <div className="flex items-center p-0.5 bg-slate-100 rounded text-xs">
                <button
                  onClick={() => onChangeReceipt({ ...receipt, discountPercentage: 0 })}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    receipt.discountPercentage === 0 ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                  }`}
                >
                  Fixed {receipt.currency}
                </button>
                <button
                  onClick={() => onChangeReceipt({ ...receipt, discount: 0, discountPercentage: 10 })}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    receipt.discountPercentage > 0 ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                  }`}
                >
                  Percent %
                </button>
              </div>
            </div>

            {receipt.discountPercentage > 0 ? (
              <div className="relative">
                <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={receipt.discountPercentage || ''}
                  onChange={(e) =>
                    onChangeReceipt({ ...receipt, discountPercentage: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="e.g. 15%"
                  className="w-full text-xs font-mono tabular-nums px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            ) : (
              <div className="relative">
                <span className="text-slate-400 font-mono text-xs absolute left-3 top-2">
                  {receipt.currency}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={receipt.discount || ''}
                  onChange={(e) =>
                    onChangeReceipt({ ...receipt, discount: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                  className="w-full text-xs font-mono tabular-nums pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            )}
          </div>

          {/* Tax */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Sales Tax / VAT</label>
              <div className="flex items-center p-0.5 bg-slate-100 rounded text-xs">
                <button
                  onClick={() => onChangeReceipt({ ...receipt, taxMode: 'percentage' })}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    receipt.taxMode === 'percentage' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                  }`}
                >
                  Rate %
                </button>
                <button
                  onClick={() => onChangeReceipt({ ...receipt, taxMode: 'fixed' })}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                    receipt.taxMode === 'fixed' ? 'bg-white shadow-xs text-slate-900' : 'text-slate-500'
                  }`}
                >
                  Fixed Amount
                </button>
              </div>
            </div>

            {receipt.taxMode === 'percentage' ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={receipt.taxRate || ''}
                    onChange={(e) =>
                      onChangeReceipt({ ...receipt, taxRate: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="e.g. 8.875"
                    className="w-full text-xs font-mono tabular-nums px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                  />
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
                  = {formatCurrency(totals.taxTotal, receipt.currency)}
                </div>
              </div>
            ) : (
              <div className="relative">
                <span className="text-slate-400 font-mono text-xs absolute left-3 top-2">
                  {receipt.currency}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={receipt.taxAmount || ''}
                  onChange={(e) =>
                    onChangeReceipt({ ...receipt, taxAmount: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                  className="w-full text-xs font-mono tabular-nums pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            )}
          </div>
        </div>

        {/* Box 2: Tip & Fees */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 border-b border-slate-100 pb-2">
            Gratuity & Surcharges
          </h3>

          {/* Tip Configuration */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Tip / Gratuity</label>
              {receipt.tipMode === 'percentage' && (
                <button
                  onClick={() =>
                    onChangeReceipt({
                      ...receipt,
                      tipBasis: receipt.tipBasis === 'pre_tax' ? 'post_tax' : 'pre_tax',
                    })
                  }
                  className="text-[11px] text-slate-500 hover:text-slate-900 underline flex items-center gap-1"
                  title="Toggle whether tip is calculated on pre-tax or post-tax subtotal"
                >
                  <span>Basis: {receipt.tipBasis === 'pre_tax' ? 'Pre-Tax' : 'Post-Tax'}</span>
                  {tipBasisDelta !== 0 && (
                    <span className="text-indigo-600 font-mono">
                      (Δ {formatCurrency(tipBasisDelta, receipt.currency)})
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Quick tip percentage buttons */}
            <div className="grid grid-cols-5 gap-1.5 mb-2">
              {[0, 15, 18, 20, 25].map((pct) => (
                <button
                  key={pct}
                  onClick={() =>
                    onChangeReceipt({
                      ...receipt,
                      tipMode: 'percentage',
                      tipRate: pct,
                    })
                  }
                  className={`py-1 text-xs font-mono font-medium rounded border transition-colors ${
                    receipt.tipMode === 'percentage' && receipt.tipRate === pct
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="text-slate-400 font-mono text-xs absolute left-3 top-2">
                  {receipt.tipMode === 'fixed' ? receipt.currency : '%'}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={
                    receipt.tipMode === 'percentage'
                      ? receipt.tipRate || ''
                      : receipt.tipAmount || ''
                  }
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    if (receipt.tipMode === 'percentage') {
                      onChangeReceipt({ ...receipt, tipRate: val });
                    } else {
                      onChangeReceipt({ ...receipt, tipAmount: val });
                    }
                  }}
                  placeholder={receipt.tipMode === 'percentage' ? 'Custom %' : 'Custom $'}
                  className="w-full text-xs font-mono tabular-nums pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <button
                onClick={() =>
                  onChangeReceipt({
                    ...receipt,
                    tipMode: receipt.tipMode === 'percentage' ? 'fixed' : 'percentage',
                  })
                }
                className="px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
              >
                Switch to {receipt.tipMode === 'percentage' ? receipt.currency : '%'}
              </button>

              <div className="text-xs font-mono tabular-nums font-semibold text-slate-900 shrink-0">
                = {formatCurrency(totals.tipTotal, receipt.currency)}
              </div>
            </div>
          </div>

          {/* Surcharges & Extra Fees */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Service Charges, CC Surcharges & Fees
            </label>

            {receipt.fees.length > 0 && (
              <div className="space-y-1.5 mb-2.5">
                {receipt.fees.map((fee) => (
                  <div
                    key={fee.id}
                    className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                  >
                    <div className="flex items-center gap-1.5 text-slate-800">
                      <span>{fee.name}</span>
                      {fee.isPercentage && (
                        <span className="text-slate-400 font-mono">({fee.percentageValue}%)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums font-semibold text-slate-900">
                        {fee.isPercentage && fee.percentageValue
                          ? formatCurrency(
                              round2((totals.discountedSubtotal * fee.percentageValue) / 100),
                              receipt.currency
                            )
                          : formatCurrency(fee.amount, receipt.currency)}
                      </span>
                      <button
                        onClick={() => handleRemoveFee(fee.id)}
                        className="text-slate-400 hover:text-rose-600 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Fee row */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newFeeName}
                onChange={(e) => setNewFeeName(e.target.value)}
                placeholder="Fee name (e.g. 3% Card Fee)"
                className="flex-1 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <div className="w-24 relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newFeeAmount}
                  onChange={(e) => setNewFeeAmount(e.target.value)}
                  placeholder={newFeeIsPercent ? '3.0' : '2.00'}
                  className="w-full text-xs font-mono tabular-nums px-2 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <button
                type="button"
                onClick={() => setNewFeeIsPercent(!newFeeIsPercent)}
                className={`px-2 py-1.5 text-xs font-mono rounded border transition-colors ${
                  newFeeIsPercent ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}
                title="Toggle percentage or fixed amount"
              >
                {newFeeIsPercent ? '%' : receipt.currency}
              </button>
              <button
                onClick={handleAddFee}
                className="px-2.5 py-1.5 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 shadow-xs"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Action Card & Receipt Math Check */}
      <div className="bg-slate-900 text-white rounded-xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold tracking-tight">Receipt Totals Verified</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Subtotal: {formatCurrency(totals.subtotal, receipt.currency)} + Tax:{' '}
            {formatCurrency(totals.taxTotal, receipt.currency)} + Tip:{' '}
            {formatCurrency(totals.tipTotal, receipt.currency)} + Fees:{' '}
            {formatCurrency(totals.feesTotal, receipt.currency)} - Discount:{' '}
            {formatCurrency(totals.discountTotal, receipt.currency)}
          </p>
        </div>

        <div className="flex items-center gap-4 self-end md:self-auto">
          <div className="text-right">
            <span className="text-xs text-slate-400 block">Total Due</span>
            <span className="text-2xl font-bold font-mono tabular-nums tracking-tight">
              {formatCurrency(totals.grandTotal, receipt.currency)}
            </span>
          </div>

          <button
            onClick={onProceedToSplit}
            className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 rounded-lg transition-colors shadow-xs"
          >
            <span>Split Among People</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
