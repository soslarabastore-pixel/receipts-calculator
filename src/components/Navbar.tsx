import React from 'react';
import { Receipt as ReceiptIcon, Users, ShieldAlert, Sparkles, Plus, History, Download, LogIn, LogOut, CloudCheck, User as UserIcon, Zap, Clock } from 'lucide-react';
import { User } from '../firebase';
import { UserSubscription } from '../types';

interface NavbarProps {
  activeTab: 'calculator' | 'splitter' | 'auditor' | 'history';
  setActiveTab: (tab: 'calculator' | 'splitter' | 'auditor' | 'history') => void;
  onOpenScanner: () => void;
  onOpenExport: () => void;
  onOpenSubscription: () => void;
  onNewReceipt: () => void;
  merchantName: string;
  grandTotal: number;
  currency: string;
  savedCount: number;
  currentUser: User | null;
  subscription: UserSubscription;
  onSignIn: () => void;
  onSignOut: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onOpenScanner,
  onOpenExport,
  onOpenSubscription,
  onNewReceipt,
  merchantName,
  grandTotal,
  currency,
  savedCount,
  currentUser,
  subscription,
  onSignIn,
  onSignOut,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Zone 1: Single text element wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setActiveTab('calculator')}
              className="flex items-center gap-2.5 text-left focus:outline-none"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-sm tracking-tight shadow-xs">
                S=
              </div>
              <span className="text-lg font-bold tracking-tight text-slate-900">
                SplitExact
              </span>
            </button>
          </div>

          {/* Zone 2: Navigation Links / Segmented Tabs */}
          <nav className="flex items-center p-1 bg-slate-100 rounded-lg text-sm font-medium">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all whitespace-nowrap text-xs sm:text-sm ${
                activeTab === 'calculator'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ReceiptIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
              <span>Receipt Items</span>
            </button>

            <button
              onClick={() => setActiveTab('splitter')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all whitespace-nowrap text-xs sm:text-sm ${
                activeTab === 'splitter'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
              <span>Cost Splitter</span>
            </button>

            <button
              onClick={() => setActiveTab('auditor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all whitespace-nowrap text-xs sm:text-sm ${
                activeTab === 'auditor'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
              <span>Deduction Reconciler</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all whitespace-nowrap text-xs sm:text-sm ${
                activeTab === 'history'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-500" />
              <span>Saved ({savedCount})</span>
            </button>
          </nav>

          {/* Zone 3: Primary Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Trial / Subscription Badge */}
            <button
              onClick={onOpenSubscription}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                subscription.status === 'trial'
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 shadow-2xs'
                  : subscription.status === 'active'
                  ? 'bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-100 shadow-2xs'
                  : 'bg-indigo-50 text-indigo-900 border-indigo-200 hover:bg-indigo-100 shadow-2xs'
              }`}
              title="Manage one-time free trial and next subscription plan"
            >
              {subscription.status === 'trial' ? (
                <>
                  <Clock className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                  <span className="hidden sm:inline">14-Day Trial</span>
                  <span className="text-[10px] bg-amber-200/80 px-1 py-0.2 rounded font-mono font-bold">
                    Pro
                  </span>
                </>
              ) : subscription.status === 'active' ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600" />
                  <span className="hidden sm:inline">Pro Active</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Try 14 Days Free</span>
                  <span className="sm:hidden">Trial</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenExport}
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors whitespace-nowrap shadow-2xs"
              title="Export Receipt Summary & Breakdown as CSV or Text"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <button
              onClick={onOpenScanner}
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
              title="Upload receipt photo or paste receipt text"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden sm:inline">Scan Receipt</span>
              <span className="sm:hidden">Scan</span>
            </button>

            <button
              onClick={onNewReceipt}
              className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Bill</span>
            </button>

            {/* Authentication & Cloud Sync */}
            <div className="border-l border-slate-200 pl-2 ml-1 flex items-center">
              {currentUser ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-xs text-slate-700">
                    {currentUser.photoURL ? (
                      <img
                        src={currentUser.photoURL}
                        alt={currentUser.displayName || 'User'}
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                        {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <span className="hidden lg:inline font-medium truncate max-w-[100px]">
                      {currentUser.displayName?.split(' ')[0] || 'Account'}
                    </span>
                  </div>

                  <button
                    onClick={onSignOut}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                    title="Sign out of Firebase"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onSignIn}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg transition-colors"
                  title="Sign in with Google to sync receipts across devices"
                >
                  <LogIn className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="hidden sm:inline">Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
