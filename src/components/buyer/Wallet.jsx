// src/components/buyer/Wallet.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { formatCurrency, formatDateTime } from '../../utils/helpers';
import { 
  Wallet as WalletIcon, 
  ArrowUpRight, 
  ArrowDownLeft, 
  PlusCircle, 
  Building2, 
  Copy, 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  CreditCard, 
  ExternalLink, 
  X, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Search,
  Sparkles
} from 'lucide-react';

const DEDICATED_ACCOUNT = {
  bankName: 'Flutterwave MFB',
  accountNumber: '9187255635',
  accountName: 'Abu Mafhal Valued'
};

const NIGERIAN_BANKS = [
  'OPay',
  'PalmPay',
  'Kuda Bank',
  'Moniepoint MFB',
  'GTBank (Guaranty Trust)',
  'Zenith Bank',
  'Access Bank',
  'First Bank of Nigeria',
  'United Bank for Africa (UBA)',
  'Fidelity Bank',
  'Stanbic IBTC Bank',
  'Wema Bank / ALAT'
];

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 25000, 50000];

const Wallet = () => {
  const { currentUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // Modals state (All clean, dedicated separate popups)
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showBankTransferModal, setShowBankTransferModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);

  // Top-up states
  const [topUpAmount, setTopUpAmount] = useState('5000');
  const [topUpGateway, setTopUpGateway] = useState('paystack'); // 'paystack' | 'flutterwave'
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState('');

  // Withdraw states
  const [withdrawBank, setWithdrawBank] = useState('OPay');
  const [withdrawAccountNum, setWithdrawAccountNum] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState('');

  // Search & Filter
  const [filterType, setFilterType] = useState('all'); // 'all' | 'credit' | 'debit'
  const [searchQuery, setSearchQuery] = useState('');

  const activeUserId = currentUser?.id || currentUser?.uid;

  const fetchWalletData = useCallback(async () => {
    if (!activeUserId) {
      setLoading(false);
      return;
    }
    try {
      // 1. Fetch user balance from profiles table (source of truth)
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id, balance, email, full_name, phone')
        .eq('id', activeUserId)
        .maybeSingle();

      if (!profileErr && profile) {
        setBalance(Number(profile.balance || 0));
      }

      // 2. Fetch transactions from transactions table
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', activeUserId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!txError && txData) {
        setTransactions(txData);
      }
    } catch (err) {
      console.error('Error fetching wallet data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  // Copy to clipboard helper
  const handleCopy = (text, fieldName) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Refresh balance button
  const handleManualRefresh = async () => {
    setRefreshing(true);
    await fetchWalletData();
  };

  // ── INITIATE ONLINE TOP-UP (PAYSTACK / FLUTTERWAVE) ──
  const handleStartTopUp = async (e) => {
    e.preventDefault();
    setTopUpError('');
    const amt = Number(topUpAmount);

    if (isNaN(amt) || amt < 100) {
      setTopUpError('Please enter a valid amount of at least ₦100');
      return;
    }

    setTopUpLoading(true);
    try {
      const ref = `WLT-${topUpGateway.toUpperCase().slice(0, 3)}-${Date.now()}`;
      const userEmail = currentUser?.email || `wallet_${activeUserId.substring(0, 6)}@abumafhal.com`;
      const callbackUrl = window.location.href;

      if (topUpGateway === 'paystack') {
        const res = await supabase.functions.invoke('initiate-paystack-payment', {
          body: {
            amount: amt,
            email: userEmail,
            reference: ref,
            callback_url: callbackUrl,
            metadata: {
              action: 'wallet_topup',
              user_id: activeUserId
            }
          }
        });

        const authUrl = res?.data?.authorization_url || res?.data?.data?.authorization_url;
        if (authUrl) {
          window.location.href = authUrl;
          return;
        }
        throw new Error(res?.data?.message || res?.error?.message || 'Failed to initialize Paystack');
      } else {
        const res = await supabase.functions.invoke('flutterwave-initiate', {
          body: {
            amount: amt,
            email: userEmail,
            reference: ref,
            tx_ref: ref,
            callback_url: callbackUrl,
            name: currentUser?.user_metadata?.full_name || 'Mafhal Member'
          }
        });

        const link = res?.data?.link || res?.data?.data?.link;
        if (link) {
          window.location.href = link;
          return;
        }
        throw new Error(res?.data?.message || res?.error?.message || 'Failed to initialize Flutterwave');
      }
    } catch (err) {
      console.error('Top-up initiation error:', err);
      setTopUpError(err.message || 'Unable to connect to payment gateway. Please try direct bank transfer.');
    } finally {
      setTopUpLoading(false);
    }
  };

  // ── INITIATE WITHDRAWAL ──
  const handleStartWithdraw = async (e) => {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess('');

    const amt = Number(withdrawAmount);
    if (isNaN(amt) || amt < 500) {
      setWithdrawError('Minimum withdrawal amount is ₦500');
      return;
    }
    if (amt > balance) {
      setWithdrawError(`Insufficient balance. Your available balance is ${formatCurrency(balance)}`);
      return;
    }
    if (!withdrawAccountNum || withdrawAccountNum.length !== 10) {
      setWithdrawError('Please enter a valid 10-digit Nigerian NUBAN account number');
      return;
    }

    setWithdrawLoading(true);
    try {
      const newBal = balance - amt;
      const ref = `WTH-${Date.now()}`;

      // Update profiles balance
      const { error: balErr } = await supabase
        .from('profiles')
        .update({ balance: newBal })
        .eq('id', activeUserId);

      if (balErr) throw balErr;

      // Insert transaction record
      const { error: txErr } = await supabase
        .from('transactions')
        .insert({
          user_id: activeUserId,
          type: 'withdrawal',
          amount: amt,
          status: 'pending',
          reference: ref,
          description: `Withdrawal of ${formatCurrency(amt)} to ${withdrawBank} (${withdrawAccountNum})`
        });

      if (txErr) console.warn('Transaction record warning:', txErr);

      setBalance(newBal);
      setWithdrawSuccess(`Withdrawal request of ${formatCurrency(amt)} received! Funds will reflect in your ${withdrawBank} account shortly.`);
      setWithdrawAmount('');
      setWithdrawAccountNum('');
      fetchWalletData();
    } catch (err) {
      console.error('Withdrawal error:', err);
      setWithdrawError(err.message || 'Failed to submit withdrawal request. Please try again.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => {
    const isCredit = tx.type === 'credit' || tx.type === 'topup' || tx.type === 'deposit';
    if (filterType === 'credit' && !isCredit) return false;
    if (filterType === 'debit' && isCredit) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      const ref = (tx.reference || '').toLowerCase();
      const amtStr = String(tx.amount || '');
      return desc.includes(q) || ref.includes(q) || amtStr.includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] p-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-emerald-100 border-t-emerald-600 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <WalletIcon className="w-6 h-6 text-emerald-600" />
          </div>
        </div>
        <p className="mt-4 text-sm font-medium text-gray-500 dark:text-gray-400">Loading your wallet balance...</p>
      </div>
    );
  }

  const narrationRef = `AMF-${(activeUserId || 'USR').slice(0, 6).toUpperCase()}`;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
            My Wallet
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              <ShieldCheck className="w-3 h-3 mr-1" />
              100% Escrow Protected
            </span>
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Real-time balance, instant deposits, transfers, and cashouts
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="inline-flex items-center self-start sm:self-auto gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Balance'}
        </button>
      </div>

      {/* ── LUXURY BALANCE & VIRTUAL ACCOUNT CARDS GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Balance Card */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white p-6 sm:p-8 shadow-xl border border-slate-700/60">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none"></div>
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Available Cash Balance
                </span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-medium">
                  Instant Settlement
                </span>
              </div>
              <p className="text-3xl sm:text-5xl font-black mt-3 tracking-tight font-mono">
                {formatCurrency(balance)}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => setShowTopUpModal(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                Add Cash (Online)
              </button>

              <button
                onClick={() => setShowBankTransferModal(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm backdrop-blur-sm border border-white/15 transition-all transform active:scale-95"
              >
                <Building2 className="w-4 h-4 text-emerald-300" />
                Bank Transfer
              </button>

              <button
                onClick={() => setShowWithdrawModal(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm backdrop-blur-sm border border-white/15 transition-all transform active:scale-95"
              >
                <ArrowUpRight className="w-4 h-4 text-amber-400" />
                Withdraw Cash
              </button>
            </div>
          </div>
        </div>

        {/* Dedicated Virtual Bank Card */}
        <div className="rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-md border border-gray-100 dark:border-gray-700 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Dedicated Bank NUBAN
              </span>
              <span className="text-[10px] bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 px-2 py-0.5 rounded font-bold border border-green-200 dark:border-green-800">
                LIVE AUTO-CREDIT
              </span>
            </div>

            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              {DEDICATED_ACCOUNT.bankName}
            </p>

            {/* Account Number Box */}
            <div className="mt-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Account Number</p>
                <p className="text-xl font-black font-mono tracking-widest text-blue-600 dark:text-blue-400">
                  {DEDICATED_ACCOUNT.accountNumber}
                </p>
              </div>
              <button
                onClick={() => handleCopy(DEDICATED_ACCOUNT.accountNumber, 'acc')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs font-bold hover:bg-blue-100 transition-colors"
              >
                {copiedField === 'acc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedField === 'acc' ? 'Copied' : 'Copy'}
              </button>
            </div>

            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2">
              Name: <span className="font-semibold text-gray-900 dark:text-white">{DEDICATED_ACCOUNT.accountName}</span>
            </p>
          </div>

          <div className="pt-4 border-t border-gray-100 dark:border-gray-700 mt-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
              Transfer from OPay, PalmPay, Kuda, or your bank app. Your balance credits automatically.
            </p>
          </div>
        </div>
      </div>

      {/* ── TRANSACTIONS SECTION ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        {/* Section Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Transaction History
              <span className="text-xs font-normal text-gray-500 dark:text-gray-400">
                ({filteredTransactions.length} records)
              </span>
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Complete ledger of deposits, transfers, and wallet deductions
            </p>
          </div>

          {/* Filter Pills & Search Input */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions..."
                className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44 sm:w-56"
              />
            </div>

            <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-900 p-0.5 border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  filterType === 'all'
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('credit')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  filterType === 'credit'
                    ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                Deposits
              </button>
              <button
                onClick={() => setFilterType('debit')}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                  filterType === 'debit'
                    ? 'bg-white dark:bg-gray-800 text-red-600 dark:text-red-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900'
                }`}
              >
                Debits
              </button>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center text-gray-400 mb-3">
              <Clock className="w-7 h-7" />
            </div>
            <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">No transactions found</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
              {searchQuery ? 'No activities matched your search criteria.' : 'Your deposit and payment activity will appear here in real-time.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/60">
            {filteredTransactions.map((tx) => {
              const isCredit = tx.type === 'credit' || tx.type === 'topup' || tx.type === 'deposit';
              return (
                <div
                  key={tx.id}
                  className="p-4 sm:p-5 flex items-center justify-between hover:bg-gray-50/70 dark:hover:bg-gray-900/30 transition-colors"
                >
                  <div className="flex items-center space-x-3.5 sm:space-x-4">
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isCredit
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                        {tx.description || (isCredit ? 'Wallet Top-up' : 'Wallet Withdrawal')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatDateTime(tx.created_at || tx.createdAt)}</span>
                        {tx.reference && (
                          <>
                            <span>•</span>
                            <span className="font-mono text-[11px] truncate max-w-[120px] sm:max-w-[200px]">
                              {tx.reference}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 pl-3">
                    <p
                      className={`text-sm sm:text-base font-extrabold font-mono ${
                        isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    <span
                      className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${
                        tx.status === 'completed' || tx.status === 'success'
                          ? 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300'
                          : tx.status === 'pending'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      }`}
                    >
                      {tx.status || 'completed'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODAL 1: DEDICATED TOP-UP MODAL (CARD & ONLINE GATEWAY)
      ══════════════════════════════════════════════════════════════ */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 relative">
            <button
              onClick={() => setShowTopUpModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Top-up Wallet (Online)</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Instant wallet recharge via Debit Card, USSD, or Bank App
              </p>
            </div>

            <form onSubmit={handleStartTopUp} className="space-y-5">
              {/* Amount Input */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Enter Amount in Naira (₦)
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <span className="text-gray-500 font-bold text-lg">₦</span>
                  </div>
                  <input
                    type="number"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="5000"
                    min="100"
                    className="block w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-bold text-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Preset Chips */}
              <div>
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Preset Amounts</p>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(String(amt))}
                      className={`py-2 px-3 text-xs font-bold rounded-lg border transition-colors ${
                        topUpAmount === String(amt)
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-300 dark:border-gray-700'
                      }`}
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Gateway Selection */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
                  Choose Payment Gateway
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setTopUpGateway('paystack')}
                    className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                      topUpGateway === 'paystack'
                        ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 ring-2 ring-blue-500'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-gray-900 dark:text-white">Paystack</span>
                      <CreditCard className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">Cards, USSD, Apple Pay</span>
                  </div>

                  <div
                    onClick={() => setTopUpGateway('flutterwave')}
                    className={`p-3.5 rounded-xl border cursor-pointer flex flex-col justify-between transition-all ${
                      topUpGateway === 'flutterwave'
                        ? 'border-amber-500 bg-amber-50/50 dark:bg-amber-950/30 ring-2 ring-amber-500'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-gray-900 dark:text-white">Flutterwave</span>
                      <CreditCard className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">Mastercard, Visa, Verve</span>
                  </div>
                </div>
              </div>

              {topUpError && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{topUpError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={topUpLoading}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-70 transition-all"
              >
                {topUpLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting to Gateway...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Recharge ₦{Number(topUpAmount || 0).toLocaleString()}</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {/* Clean Switch to Bank Transfer Modal */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowTopUpModal(false);
                    setShowBankTransferModal(true);
                  }}
                  className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-center gap-1 mx-auto"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  Prefer direct transfer from your bank app? Click here ➔
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 2: DEDICATED BANK TRANSFER MODAL (VIRTUAL NUBAN)
      ══════════════════════════════════════════════════════════════ */}
      {showBankTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 relative">
            <button
              onClick={() => setShowBankTransferModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
                Dedicated Bank Transfer
                <span className="text-[10px] font-bold bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 px-2 py-0.5 rounded-full">
                  LIVE NUBAN
                </span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Your permanent virtual account. Transfer any amount anytime.
              </p>
            </div>

            <div className="space-y-4">
              {/* Account Details Box */}
              <div className="rounded-xl p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-blue-950/40 border border-blue-100 dark:border-blue-900/40">
                <div className="text-xs font-semibold text-blue-800 dark:text-blue-300 uppercase">
                  Bank Name
                </div>
                <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                  {DEDICATED_ACCOUNT.bankName}
                </div>

                <div className="mt-4 flex items-center justify-between bg-white dark:bg-gray-900 p-3.5 rounded-lg border border-blue-200 dark:border-gray-700">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-gray-400">Account Number</span>
                    <p className="text-2xl font-black font-mono tracking-widest text-blue-600 dark:text-blue-400">
                      {DEDICATED_ACCOUNT.accountNumber}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(DEDICATED_ACCOUNT.accountNumber, 'modal_acc')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 shadow-sm"
                  >
                    {copiedField === 'modal_acc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedField === 'modal_acc' ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Account Name:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{DEDICATED_ACCOUNT.accountName}</span>
                </div>

                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">Narration / Ref:</span>
                  <span className="font-mono font-bold text-gray-900 dark:text-white">{narrationRef}</span>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700/60 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Open your banking app (OPay, Kuda, PalmPay, Moniepoint, GTBank, Zenith, Access, etc.) and transfer any amount to the account above. Your Abu Mafhal wallet balance will be credited automatically.
              </div>

              {/* Refresh Balance Action */}
              <button
                type="button"
                onClick={async () => {
                  setRefreshing(true);
                  await fetchWalletData();
                  alert(`Balance Refreshed! Current balance: ${formatCurrency(balance)}`);
                }}
                disabled={refreshing}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Checking confirmation...' : '🔄 I Have Transferred • Refresh Balance'}</span>
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBankTransferModal(false);
                    setShowTopUpModal(true);
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Want to pay with ATM Debit Card instead? Click here ➔
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 3: WITHDRAWAL / CASHOUT MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 dark:border-gray-700 relative">
            <button
              onClick={() => setShowWithdrawModal(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white">Withdraw to Bank</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Cashout funds directly to your verified Nigerian bank account
              </p>
            </div>

            <form onSubmit={handleStartWithdraw} className="space-y-4">
              {/* Select Bank */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  Select Destination Bank
                </label>
                <select
                  value={withdrawBank}
                  onChange={(e) => setWithdrawBank(e.target.value)}
                  className="block w-full py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {NIGERIAN_BANKS.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>

              {/* 10-digit NUBAN */}
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-1.5">
                  10-Digit Account Number
                </label>
                <input
                  type="text"
                  maxLength={10}
                  value={withdrawAccountNum}
                  onChange={(e) => setWithdrawAccountNum(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0123456789"
                  className="block w-full py-2.5 px-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-base font-bold focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  required
                />
              </div>

              {/* Amount to Withdraw */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Amount to Cashout (₦)
                  </label>
                  <span className="text-xs text-gray-500">
                    Max: <span className="font-bold text-emerald-600">{formatCurrency(balance)}</span>
                  </span>
                </div>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 font-bold">₦</span>
                  </div>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="1000"
                    min="500"
                    max={balance}
                    className="block w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white font-bold text-base focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              {withdrawError && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{withdrawError}</span>
                </div>
              )}

              {withdrawSuccess && (
                <div className="p-3 rounded-lg bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{withdrawSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={withdrawLoading || balance <= 0}
                className="w-full py-3.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg shadow-amber-600/30 flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              >
                {withdrawLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Processing Cashout...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Cashout of {withdrawAmount ? formatCurrency(Number(withdrawAmount)) : 'Funds'}</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;