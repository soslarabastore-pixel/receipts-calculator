import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Sparkles, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Receipt, ReceiptItem } from '../types';
import { SAMPLE_RECEIPTS } from '../utils/sampleData';

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onReceiptParsed: (scannedData: Partial<Receipt>) => void;
  isTrialActive?: boolean;
  onOpenSubscription?: () => void;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onReceiptParsed,
  isTrialActive,
  onOpenSubscription,
}) => {
  const [mode, setMode] = useState<'upload' | 'text' | 'samples'>('upload');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('image/jpeg');
  const [textInput, setTextInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (PNG, JPG, WebP).');
      return;
    }

    setErrorMessage(null);
    setMimeType(file.type);

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
  };

  const handleScan = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const payload: any = {};
      if (mode === 'upload') {
        if (!imageBase64) {
          setErrorMessage('Please select or drag an image first.');
          setIsLoading(false);
          return;
        }
        payload.imageBase64 = imageBase64;
        payload.mimeType = mimeType;
      } else if (mode === 'text') {
        if (!textInput.trim()) {
          setErrorMessage('Please paste or type the receipt text.');
          setIsLoading(false);
          return;
        }
        payload.textInput = textInput;
      }

      const response = await fetch('/api/receipt/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData?.details || resData?.error || 'Failed to scan receipt');
      }

      const raw = resData.data;

      // Transform into Receipt structure
      const items: ReceiptItem[] = (raw.items || []).map((it: any, index: number) => ({
        id: `item-${Date.now()}-${index}`,
        name: it.name || `Item ${index + 1}`,
        quantity: Number(it.quantity) || 1,
        unitPrice: Number(it.unitPrice) || Number(it.totalPrice) || 0,
        totalPrice: Number(it.totalPrice) || (Number(it.unitPrice) || 0) * (Number(it.quantity) || 1),
        category: it.category || 'General',
        assignedTo: [], // user can assign to participants
      }));

      const fees = (raw.fees || []).map((f: any, idx: number) => ({
        id: `fee-${Date.now()}-${idx}`,
        name: f.name || 'Service Fee',
        amount: Number(f.amount) || 0,
        isPercentage: false,
      }));

      const partialReceipt: Partial<Receipt> = {
        merchant: raw.merchant || 'Scanned Merchant',
        date: raw.date || new Date().toISOString().split('T')[0],
        currency: raw.currency || '$',
        tags: raw.category ? [raw.category] : ['Dining Out'],
        items,
        discount: Number(raw.discount) || 0,
        taxMode: raw.taxRate ? 'percentage' : 'fixed',
        taxRate: Number(raw.taxRate) || 0,
        taxAmount: Number(raw.tax) || 0,
        tipMode: 'fixed',
        tipAmount: Number(raw.tip) || 0,
        fees,
        notes: raw.notes || `Scanned receipt from ${raw.merchant || 'vendor'}`,
      };

      onReceiptParsed(partialReceipt);
      onClose();
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Error occurred while contacting OCR engine.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectSample = (sample: (typeof SAMPLE_RECEIPTS)[0]) => {
    onReceiptParsed(sample.receipt);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Scan & Import Receipt</h2>
              <p className="text-xs text-slate-500">Extract line items, taxes, fees, and tips via Gemini 3.8 Flash</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="px-6 pt-3 pb-2 space-y-2">
          {onOpenSubscription && (
            <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/70 border border-indigo-200/60 text-xs">
              <span className="text-indigo-900 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Unlimited AI OCR receipt scans included with 14-Day Free Trial.</span>
              </span>
              <button
                onClick={() => {
                  onClose();
                  onOpenSubscription();
                }}
                className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline shrink-0"
              >
                {isTrialActive ? 'Manage Trial' : 'Try 14 Days Free'}
              </button>
            </div>
          )}

          <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => {
                setMode('upload');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-all text-center ${
                mode === 'upload' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Upload Photo
            </button>
            <button
              onClick={() => {
                setMode('text');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-all text-center ${
                mode === 'text' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paste Receipt Text
            </button>
            <button
              onClick={() => {
                setMode('samples');
                setErrorMessage(null);
              }}
              className={`flex-1 py-1.5 rounded-md transition-all text-center ${
                mode === 'samples' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Preset Samples
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to analyze receipt</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {mode === 'upload' && (
            <div className="space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-indigo-50/20"
                >
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-600 mb-3">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">Click to upload or drag receipt image here</p>
                  <p className="text-xs text-slate-500 mt-1">Supports JPG, PNG, WebP up to 10MB</p>
                </div>
              ) : (
                <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-900 max-h-72 flex items-center justify-center group">
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className="max-h-72 w-auto object-contain"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white text-slate-900 text-xs font-medium rounded-lg shadow-sm hover:bg-slate-100"
                    >
                      Change Photo
                    </button>
                    <button
                      onClick={() => {
                        setImagePreview(null);
                        setImageBase64(null);
                      }}
                      className="px-3 py-1.5 bg-rose-600 text-white text-xs font-medium rounded-lg shadow-sm hover:bg-rose-700"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-500 text-center">
                AI extracts item descriptions, individual quantities, taxes, tips, and fees automatically.
              </p>
            </div>
          )}

          {mode === 'text' && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-700">
                Paste receipt text, email order confirmation, or terminal breakdown:
              </label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={8}
                placeholder="Example:&#10;Trattoria Roma&#10;1x Bruschetta $12.00&#10;2x Gnocchi Pesto $44.00&#10;1x Sparkling Water $7.00&#10;Subtotal: $63.00&#10;Tax (8.875%): $5.59&#10;Tip: $12.00&#10;Total: $80.59"
                className="w-full text-xs font-mono p-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-800"
              />
            </div>
          )}

          {mode === 'samples' && (
            <div className="space-y-2.5">
              <p className="text-xs text-slate-600">
                Choose a pre-configured scenario to test splitting and payment deduction audits instantly:
              </p>
              <div className="grid gap-2.5">
                {SAMPLE_RECEIPTS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectSample(s)}
                    className="p-3.5 border border-slate-200 hover:border-slate-400 rounded-lg text-left transition-colors bg-white hover:bg-slate-50 flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {s.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.subtitle}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {mode !== 'samples' && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleScan}
              disabled={isLoading || (mode === 'upload' && !imageBase64) || (mode === 'text' && !textInput.trim())}
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 disabled:cursor-not-allowed rounded-lg shadow-xs transition-colors"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Analyzing Receipt...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-indigo-300" />
                  <span>Extract Receipt Data</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
