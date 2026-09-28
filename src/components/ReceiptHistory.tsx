import React, { useState, useMemo } from 'react';
import {
  History,
  Trash2,
  ArrowRight,
  Download,
  Plus,
  FileText,
  Tag,
  Search,
  Filter,
  X,
  CheckCircle2,
} from 'lucide-react';
import { Receipt } from '../types';
import { formatCurrency, calculateReceiptTotals } from '../utils/calculations';

interface ReceiptHistoryProps {
  savedReceipts: Receipt[];
  activeReceiptId: string;
  onSelectReceipt: (receipt: Receipt) => void;
  onDeleteReceipt: (id: string) => void;
  onNewReceipt: () => void;
  onUpdateReceiptTags?: (receiptId: string, tags: string[]) => void;
}

export const ReceiptHistory: React.FC<ReceiptHistoryProps> = ({
  savedReceipts,
  activeReceiptId,
  onSelectReceipt,
  onDeleteReceipt,
  onNewReceipt,
  onUpdateReceiptTags,
}) => {
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract all unique tags present across saved receipts
  const allUniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    savedReceipts.forEach((r) => {
      (r.tags || []).forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [savedReceipts]);

  // Filter receipts by search query and selected tag
  const filteredReceipts = useMemo(() => {
    return savedReceipts.filter((r) => {
      // Tag filter
      if (selectedTag !== 'all') {
        if (!r.tags || !r.tags.includes(selectedTag)) {
          return false;
        }
      }

      // Search text filter (merchant name, notes, item names, tags)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesMerchant = (r.merchant || '').toLowerCase().includes(query);
        const matchesNotes = (r.notes || '').toLowerCase().includes(query);
        const matchesTags = (r.tags || []).some((t) => t.toLowerCase().includes(query));
        const matchesItems = (r.items || []).some((it) => it.name.toLowerCase().includes(query));

        if (!matchesMerchant && !matchesNotes && !matchesTags && !matchesItems) {
          return false;
        }
      }

      return true;
    });
  }, [savedReceipts, selectedTag, searchQuery]);

  const handleExportAll = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(savedReceipts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `splitexact-receipts-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-700" />
              <h2 className="text-sm font-semibold text-slate-900">Saved Receipts & Split Audits</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Access your previous bills, restore split distributions, and organize by categories/tags.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {savedReceipts.length > 0 && (
              <button
                onClick={handleExportAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
            )}

            <button
              onClick={onNewReceipt}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Bill</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="pt-4 pb-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Tag Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none flex-1">
            <span className="text-xs font-semibold text-slate-700 flex items-center gap-1 mr-1 shrink-0">
              <Filter className="w-3 h-3 text-slate-400" />
              <span>Filter:</span>
            </span>

            <button
              onClick={() => setSelectedTag('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
                selectedTag === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Receipts ({savedReceipts.length})
            </button>

            {allUniqueTags.map((tag) => {
              const count = savedReceipts.filter((r) => (r.tags || []).includes(tag)).length;
              const isSelected = selectedTag === tag;

              return (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all shrink-0 ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-2xs font-semibold'
                      : 'bg-indigo-50/80 text-indigo-700 border border-indigo-200/60 hover:bg-indigo-100'
                  }`}
                >
                  <Tag className="w-2.5 h-2.5" />
                  <span>{tag}</span>
                  <span className={`text-[10px] ml-0.5 ${isSelected ? 'text-indigo-200' : 'text-indigo-500'}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by merchant, item or tag..."
              className="w-full text-xs pl-8 pr-7 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Receipts List */}
        {savedReceipts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-700">No saved receipts yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Receipts you create or scan will automatically be saved to your account.
            </p>
            <button
              onClick={onNewReceipt}
              className="mt-4 px-4 py-2 text-xs font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800"
            >
              Start New Receipt
            </button>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="p-10 text-center">
            <Tag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-700">No receipts match your filter</p>
            <p className="text-xs text-slate-500 mt-1">
              Try choosing another tag or clear your search term.
            </p>
            <button
              onClick={() => {
                setSelectedTag('all');
                setSearchQuery('');
              }}
              className="mt-3 px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-slate-700"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 pt-2">
            {filteredReceipts.map((r) => {
              const totals = calculateReceiptTotals(r);
              const isActive = r.id === activeReceiptId;

              return (
                <div
                  key={r.id}
                  className={`p-4 rounded-xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 my-2 border ${
                    isActive
                      ? 'bg-slate-50 border-slate-400/80 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700 mt-0.5 shrink-0">
                      <FileText className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {r.merchant || 'Untitled Receipt'}
                        </h3>
                        {isActive && (
                          <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                            Active Bill
                          </span>
                        )}

                        {/* Tag badges */}
                        {(r.tags || []).map((t) => (
                          <span
                            key={t}
                            onClick={() => setSelectedTag(t)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200/80 cursor-pointer transition-colors"
                          >
                            <Tag className="w-2.5 h-2.5 text-slate-400" />
                            <span>{t}</span>
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>{r.date}</span>
                        <span>·</span>
                        <span>{r.items.length} items</span>
                        <span>·</span>
                        <span className="capitalize">{r.allocationStrategy} split</span>
                        {r.notes && (
                          <>
                            <span>·</span>
                            <span className="truncate max-w-[200px] text-slate-400">{r.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-auto">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block">Grand Total</span>
                      <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                        {formatCurrency(totals.grandTotal, r.currency)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {!isActive && (
                        <button
                          onClick={() => onSelectReceipt(r)}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg shadow-xs transition-colors"
                        >
                          <span>Open</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        onClick={() => onDeleteReceipt(r.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                        title="Delete receipt"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
