import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { ReceiptCalculator } from './components/ReceiptCalculator';
import { CostSplitter } from './components/CostSplitter';
import { DeductionAuditor } from './components/DeductionAuditor';
import { ReceiptHistory } from './components/ReceiptHistory';
import { ReceiptScannerModal } from './components/ReceiptScannerModal';
import { ExportModal } from './components/ExportModal';
import { SubscriptionModal } from './components/SubscriptionModal';
import { Receipt, Participant, UserSubscription } from './types';
import { SAMPLE_RECEIPTS, DEFAULT_PARTICIPANTS } from './utils/sampleData';
import { calculateReceiptTotals, calculateSplit } from './utils/calculations';
import {
  DEFAULT_FREE_SUBSCRIPTION,
  createTrialSubscription,
  createPaidSubscription,
} from './utils/subscriptionData';
import {
  auth,
  db,
  signInWithGoogle,
  signOutUser,
  onAuthStateChanged,
  testFirestoreConnection,
  User,
} from './firebase';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

const STORAGE_KEY_RECEIPTS = 'splitexact_saved_receipts_v1';
const STORAGE_KEY_ACTIVE_ID = 'splitexact_active_id_v1';
const STORAGE_KEY_PARTICIPANTS = 'splitexact_participants_v1';
const STORAGE_KEY_SUBSCRIPTION = 'splitexact_subscription_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<'calculator' | 'splitter' | 'auditor' | 'history'>('calculator');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // User subscription state (One-time trial & next subscription)
  const [subscription, setSubscription] = useState<UserSubscription>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SUBSCRIPTION);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_FREE_SUBSCRIPTION;
  });

  // Initialize Firebase connection test & auth listener
  useEffect(() => {
    testFirestoreConnection();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  // Initialize participants
  const [participants, setParticipants] = useState<Participant[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PARTICIPANTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_PARTICIPANTS;
  });

  // Initialize receipts list
  const [savedReceipts, setSavedReceipts] = useState<Receipt[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECEIPTS);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error(e);
    }
    return [SAMPLE_RECEIPTS[0].receipt, SAMPLE_RECEIPTS[1].receipt];
  });

  // Active receipt state
  const [receipt, setReceipt] = useState<Receipt>(() => {
    try {
      const activeId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
      const found = savedReceipts.find((r) => r.id === activeId);
      if (found) return found;
    } catch (e) {
      console.error(e);
    }
    return SAMPLE_RECEIPTS[0].receipt;
  });

  // Sync to localStorage and Firestore if user is authenticated
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PARTICIPANTS, JSON.stringify(participants));
    } catch (e) {
      console.error(e);
    }
  }, [participants]);

  // Sync saved receipts and subscription when logged in via Firestore
  useEffect(() => {
    if (!currentUser) return;

    // 1. Receipts snapshot
    const receiptsRef = collection(db, 'users', currentUser.uid, 'receipts');
    const unsubReceipts = onSnapshot(receiptsRef, (snapshot) => {
      if (!snapshot.empty) {
        const cloudReceipts: Receipt[] = snapshot.docs.map((docSnap) => docSnap.data() as Receipt);
        setSavedReceipts(cloudReceipts);
      }
    });

    // 2. Subscription snapshot
    const subDocRef = doc(db, 'users', currentUser.uid, 'subscription', 'current');
    const unsubSub = onSnapshot(subDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const cloudSub = docSnap.data() as UserSubscription;
        setSubscription(cloudSub);
        localStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(cloudSub));
      }
    });

    return () => {
      unsubReceipts();
      unsubSub();
    };
  }, [currentUser]);

  // Subscription management handlers
  const handleStartTrial = async (planId: 'pro_monthly' | 'pro_annual') => {
    if (!currentUser) return;
    const newSub = createTrialSubscription(currentUser.uid, planId);
    setSubscription(newSub);
    localStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(newSub));

    const subDocRef = doc(db, 'users', currentUser.uid, 'subscription', 'current');
    await setDoc(subDocRef, newSub, { merge: true });
  };

  const handleUpgradeToSubscription = async (planId: 'pro_monthly' | 'pro_annual') => {
    if (!currentUser) return;
    const newSub = createPaidSubscription(currentUser.uid, planId);
    setSubscription(newSub);
    localStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(newSub));

    const subDocRef = doc(db, 'users', currentUser.uid, 'subscription', 'current');
    await setDoc(subDocRef, newSub, { merge: true });
  };

  const handleCancelAutoRenew = async () => {
    if (!currentUser) return;
    const updatedSub = { ...subscription, autoRenew: !subscription.autoRenew };
    setSubscription(updatedSub);
    localStorage.setItem(STORAGE_KEY_SUBSCRIPTION, JSON.stringify(updatedSub));

    const subDocRef = doc(db, 'users', currentUser.uid, 'subscription', 'current');
    await setDoc(subDocRef, updatedSub, { merge: true });
  };

  useEffect(() => {
    try {
      // Update in savedReceipts list
      setSavedReceipts((prev) => {
        const index = prev.findIndex((r) => r.id === receipt.id);
        let updated: Receipt[];
        if (index >= 0) {
          updated = [...prev];
          updated[index] = receipt;
        } else {
          updated = [receipt, ...prev];
        }
        localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(updated));
        return updated;
      });
      localStorage.setItem(STORAGE_KEY_ACTIVE_ID, receipt.id);

      // Also persist to Firestore if signed in
      if (currentUser && receipt.id) {
        const receiptDocRef = doc(db, 'users', currentUser.uid, 'receipts', receipt.id);
        setDoc(receiptDocRef, { ...receipt, userId: currentUser.uid, updatedAt: new Date().toISOString() }, { merge: true }).catch((err) => {
          console.warn('Could not sync receipt to Firestore:', err);
        });
      }
    } catch (e) {
      console.error(e);
    }
  }, [receipt, currentUser]);

  const handleNewReceipt = () => {
    const newReceipt: Receipt = {
      id: `receipt-${Date.now()}`,
      merchant: 'New Receipt',
      date: new Date().toISOString().split('T')[0],
      currency: '$',
      tags: ['Dining Out'],
      items: [
        {
          id: `item-${Date.now()}-1`,
          name: '',
          quantity: 1,
          unitPrice: 0,
          totalPrice: 0,
          category: 'General',
          assignedTo: [],
        },
      ],
      discount: 0,
      discountPercentage: 0,
      taxMode: 'percentage',
      taxRate: 8.875,
      taxAmount: 0,
      tipMode: 'percentage',
      tipRate: 18,
      tipAmount: 0,
      tipBasis: 'pre_tax',
      fees: [],
      notes: '',
      allocationStrategy: 'proportional',
    };

    setReceipt(newReceipt);
    setActiveTab('calculator');
  };

  const handleReceiptParsed = (scannedData: Partial<Receipt>) => {
    const merged: Receipt = {
      ...receipt,
      id: `receipt-${Date.now()}`,
      merchant: scannedData.merchant || receipt.merchant,
      date: scannedData.date || receipt.date,
      currency: scannedData.currency || receipt.currency,
      items: scannedData.items && scannedData.items.length > 0 ? scannedData.items : receipt.items,
      discount: scannedData.discount ?? receipt.discount,
      discountPercentage: scannedData.discountPercentage ?? receipt.discountPercentage,
      taxMode: scannedData.taxMode ?? receipt.taxMode,
      taxRate: scannedData.taxRate ?? receipt.taxRate,
      taxAmount: scannedData.taxAmount ?? receipt.taxAmount,
      tipMode: scannedData.tipMode ?? receipt.tipMode,
      tipRate: scannedData.tipRate ?? receipt.tipRate,
      tipAmount: scannedData.tipAmount ?? receipt.tipAmount,
      fees: scannedData.fees ?? receipt.fees,
      notes: scannedData.notes || receipt.notes,
    };

    setReceipt(merged);
    setActiveTab('calculator');
  };

  const handleDeleteReceipt = (id: string) => {
    const filtered = savedReceipts.filter((r) => r.id !== id);
    setSavedReceipts(filtered);
    try {
      localStorage.setItem(STORAGE_KEY_RECEIPTS, JSON.stringify(filtered));
    } catch (e) {
      console.error(e);
    }

    if (currentUser) {
      const docRef = doc(db, 'users', currentUser.uid, 'receipts', id);
      deleteDoc(docRef).catch((err) => console.warn('Could not delete from Firestore:', err));
    }

    if (receipt.id === id) {
      if (filtered.length > 0) {
        setReceipt(filtered[0]);
      } else {
        handleNewReceipt();
      }
    }
  };

  const totals = calculateReceiptTotals(receipt);
  const splitResult = calculateSplit(receipt, participants);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScanner={() => setIsScannerOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
        onNewReceipt={handleNewReceipt}
        merchantName={receipt.merchant}
        grandTotal={totals.grandTotal}
        currency={receipt.currency}
        savedCount={savedReceipts.length}
        currentUser={currentUser}
        subscription={subscription}
        onSignIn={signInWithGoogle}
        onSignOut={signOutUser}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'calculator' && (
          <ReceiptCalculator
            receipt={receipt}
            onChangeReceipt={setReceipt}
            onProceedToSplit={() => setActiveTab('splitter')}
            onOpenScanner={() => setIsScannerOpen(true)}
            onOpenExport={() => setIsExportOpen(true)}
          />
        )}

        {activeTab === 'splitter' && (
          <CostSplitter
            receipt={receipt}
            onChangeReceipt={setReceipt}
            participants={participants}
            onChangeParticipants={setParticipants}
            onProceedToAuditor={() => setActiveTab('auditor')}
            onOpenExport={() => setIsExportOpen(true)}
          />
        )}

        {activeTab === 'auditor' && (
          <DeductionAuditor
            receipt={receipt}
            onSaveAuditLog={(auditLog) => {
              console.log('Saved audit log', auditLog);
            }}
          />
        )}

        {activeTab === 'history' && (
          <ReceiptHistory
            savedReceipts={savedReceipts}
            activeReceiptId={receipt.id}
            onSelectReceipt={(r) => {
              setReceipt(r);
              setActiveTab('calculator');
            }}
            onDeleteReceipt={handleDeleteReceipt}
            onNewReceipt={handleNewReceipt}
            onUpdateReceiptTags={(receiptId, newTags) => {
              if (receipt.id === receiptId) {
                setReceipt({ ...receipt, tags: newTags });
              }
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SplitExact · Exact Receipt Totals, Proportional Cost Splitting & Payment Audit</span>
          <div className="flex items-center gap-3">
            <span>Zero Penny-Drop Discrepancy</span>
            <span>·</span>
            <span>Bank Surcharge & Tip Verification</span>
          </div>
        </div>
      </footer>

      {/* OCR & AI Scanner Modal */}
      <ReceiptScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onReceiptParsed={handleReceiptParsed}
        isTrialActive={subscription.status === 'trial'}
        onOpenSubscription={() => setIsSubscriptionOpen(true)}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        receipt={receipt}
        participants={participants}
        splitResult={splitResult}
      />

      {/* Subscription Modal (One-Time Trial & Next Subscription) */}
      <SubscriptionModal
        isOpen={isSubscriptionOpen}
        onClose={() => setIsSubscriptionOpen(false)}
        subscription={subscription}
        currentUser={currentUser}
        onStartTrial={handleStartTrial}
        onUpgradeToSubscription={handleUpgradeToSubscription}
        onCancelAutoRenew={handleCancelAutoRenew}
        onSignIn={signInWithGoogle}
      />
    </div>
  );
}
