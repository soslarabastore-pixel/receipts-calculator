import React, { useState } from 'react';
import { X, Download, FileSpreadsheet, FileText, Check, Copy } from 'lucide-react';
import { Receipt, Participant, SplitCalculationResult } from '../types';
import {
  generateReceiptCsv,
  generateReceiptTextReport,
  downloadFile,
} from '../utils/exportReports';
import { formatCurrency } from '../utils/calculations';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: Receipt;
  participants: Participant[];
  splitResult: SplitCalculationResult;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  receipt,
  participants,
  splitResult,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'text'>('csv');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const sanitizeFilename = (name: string) => {
    return (name || 'receipt').toLowerCase().replace(/[^a-z0-9_-]/gi, '_');
  };

  const baseFilename = `splitexact_${sanitizeFilename(receipt.merchant)}_${receipt.date || 'report'}`;

  const csvContent = generateReceiptCsv(receipt, participants, splitResult);
  const textContent = generateReceiptTextReport(receipt, participants, splitResult);

  const handleDownload = () => {
    if (selectedFormat === 'csv') {
      downloadFile(csvContent, `${baseFilename}.csv`, 'text/csv');
    } else {
      downloadFile(textContent, `${baseFilename}.txt`, 'text/plain');
    }
  };

  const handleCopyText = () => {
    const textToCopy = selectedFormat === 'csv' ? csvContent : textContent;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Export Receipt & Split Summary</h2>
              <p className="text-xs text-slate-500">
                Download a comprehensive CSV for spreadsheets or plain text summary for messaging
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Format Selector */}
        <div className="px-6 pt-4 pb-2">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSelectedFormat('csv')}
              className={`p-3 rounded-lg border text-left flex items-start gap-3 transition-all ${
                selectedFormat === 'csv'
                  ? 'border-slate-900 bg-slate-50/80 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`p-2 rounded-md ${selectedFormat === 'csv' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <FileSpreadsheet className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">CSV Spreadsheet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Compatible with Microsoft Excel, Google Sheets, Apple Numbers, and Notion.
                </p>
              </div>
            </button>

            <button
              onClick={() => setSelectedFormat('text')}
              className={`p-3 rounded-lg border text-left flex items-start gap-3 transition-all ${
                selectedFormat === 'text'
                  ? 'border-slate-900 bg-slate-50/80 shadow-xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className={`p-2 rounded-md ${selectedFormat === 'text' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">Text Summary (.txt)</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Clean ASCII formatting ready to paste into WhatsApp, Slack, iMessage, or email.
                </p>
              </div>
            </button>
          </div>
        </div>

        {/* Live Preview Area */}
        <div className="px-6 py-3 flex-1 overflow-y-auto space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Preview ({selectedFormat.toUpperCase()}):</span>
            <span className="text-[11px] text-slate-400">
              Total {formatCurrency(splitResult.grandTotal, receipt.currency)} across {splitResult.participantBreakdowns.length} people
            </span>
          </div>

          <div className="relative rounded-lg border border-slate-200 bg-slate-900 text-slate-200 p-3.5 max-h-64 overflow-y-auto font-mono text-[11px] leading-relaxed select-all">
            <pre className="whitespace-pre-wrap font-mono">
              {selectedFormat === 'csv' ? csvContent : textContent}
            </pre>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={handleCopyText}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors shadow-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700 font-semibold">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Contents</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download {selectedFormat.toUpperCase()} File</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
