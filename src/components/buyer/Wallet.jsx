// src/components/buyer/Wallet.jsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { formatCurrency } from '../../utils/helpers';
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
  X, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
  Zap,
  ArrowRight
} from 'lucide-react';

// Blocked dummy accounts
const BLOCKED_ACCOUNTS = new Set(['9187255635', '9282617835', '0000000000', '1111111111']);
const isValidVirtualAccount = (acc) => {
  if (!acc) return false;
  const s = String(acc).trim();
  if (s.length < 10) return false;
  if (BLOCKED_ACCOUNTS.has(s)) return false;
  if (/^(\d)\1{9,}$/.test(s)) return false;
  if (s.startsWith('980')) return false;
  return true;
};

const GATEWAYS = [
  {
    id: 'bank_transfer',
    name: 'Dedicated Bank Transfer',
    subtitle: 'Direct NUBAN Transfer · Instant Auto-Credit',
    badge: '0% FEE · INSTANT',
    badgeColor: '#059669',
    badgeBg: '#ECFDF5',
    icon: Building2,
    iconColor: '#059669',
    iconBg: '#ECFDF5',
  },
  {
    id: 'paystack',
    name: 'Paystack Checkout',
    subtitle: 'Cards · USSD · Bank Transfer · Apple Pay',
    badge: 'AUTO-VERIFY',
    badgeColor: '#0284C7',
    badgeBg: '#F0F9FF',
    icon: CreditCard,
    iconColor: '#0284C7',
    iconBg: '#F0F9FF',
  },
  {
    id: 'flutterwave',
    name: 'Flutterwave Africa',
    subtitle: 'Cards · Direct Bank · Mobile Money',
    badge: 'PAN-AFRICA',
    badgeColor: '#D97706',
    badgeBg: '#FFFBEB',
    icon: Zap,
    iconColor: '#D97706',
    iconBg: '#FFFBEB',
  },
  {
    id: 'nowpayments',
    name: 'NOWPayments Crypto',
    subtitle: 'USDT · BTC · ETH · SOL · BNB',
    badge: 'WEB3 CRYPTO',
    badgeColor: '#8B5CF6',
    badgeBg: '#F5F3FF',
    icon: WalletIcon,
    iconColor: '#8B5CF6',
    iconBg: '#F5F3FF',
  }
];

export const Wallet = () => {
  const { currentUser } = useAuth();
  const activeUserId = currentUser?.id || currentUser?.uid;

  // Local state
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hideBalance, setHideBalance] = useState(false);
  const [copied, setCopied] = useState(false);

  // Dedicated Virtual Account
  const [virtualAcc, setVirtualAcc] = useState(null);
  const [bvnInput, setBvnInput] = useState('');
  const [bvnLegalName, setBvnLegalName] = useState('');
  const [bvnPhone, setBvnPhone] = useState('');
  const [bvnVerifying, setBvnVerifying] = useState(false);
  const [vaError, setVaError] = useState('');
  const [showBvnForm, setShowBvnForm] = useState(false);

  // Modals & Actions
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpGateway, setTopUpGateway] = useState('bank_transfer');
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState('');

  // Celebration & Sync State
  const [celebrationData, setCelebrationData] = useState(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'credit' | 'debit'

  // Resolve user ID with fallbacks
  const resolveUid = useCallback(async () => {
    if (activeUserId) return activeUserId;
    try {
      const { data } = await supabase.auth.getUser();
      if (data?.user?.id) return data.user.id;
    } catch (_) {}
    try {
      const cached = localStorage.getItem('auth_user') || localStorage.getItem('@abumafhal_user_v1');
      if (cached) {
        const u = JSON.parse(cached);
        if (u?.id || u?.uid) return u.id || u.uid;
      }
    } catch (_) {}
    return null;
  }, [activeUserId]);

  // Copy helper
  const handleCopy = (text) => {
    if (!text) return;
    try {
      if (navigator?.clipboard) {
        navigator.clipboard.writeText(text);
      }
    } catch (_) {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fetch Authoritative Wallet Data
  const fetchWalletData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const uid = await resolveUid();
      if (!uid) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // 1. Instant Cache Hydration to guarantee balance never drops to zero on refresh
      try {
        const cached = localStorage.getItem(`@amf_web_wallet_${uid}`);
        if (cached) {
          const c = JSON.parse(cached);
          if (c?.balance !== undefined) setBalance(c.balance);
          if (Array.isArray(c?.transactions)) setTransactions(c.transactions);
          if (c?.virtualAcc) setVirtualAcc(c.virtualAcc);
        }
      } catch (_) {}

      // 2. Fetch authoritative profile and transactions
      const [pRes, txRes] = await Promise.allSettled([
        supabase.from('profiles')
          .select('id, balance, email, full_name, phone, custom_id')
          .eq('id', uid)
          .maybeSingle(),
        supabase.from('transactions')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      const profile = pRes.status === 'fulfilled' ? pRes.value?.data : null;
      const txData = txRes.status === 'fulfilled' && Array.isArray(txRes.value?.data) ? txRes.value.data : [];

      if (profile) {
        const profileBal = Number(profile.balance || 0);

        // Reconcile with verified ledger balance
        const totalCredits = txData
          .filter(t => (t.type === 'topup' || t.type === 'credit' || t.type === 'deposit') && (t.status === 'completed' || t.status === 'successful'))
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const totalDebits = txData
          .filter(t => (t.type === 'withdrawal' || t.type === 'debit' || t.type === 'wallet_payment' || t.type === 'wallet_purchase') && (t.status === 'completed' || t.status === 'successful'))
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const ledgerBal = Math.max(0, totalCredits - totalDebits);
        const finalBal = Math.max(profileBal, ledgerBal);

        setBalance(finalBal);
        setTransactions(txData);

        // Parse dedicated virtual account
        let parsedVa = null;
        if (profile.custom_id) {
          try {
            const raw = typeof profile.custom_id === 'string' ? JSON.parse(profile.custom_id) : profile.custom_id;
            if (raw?.account_number && isValidVirtualAccount(raw.account_number)) {
              parsedVa = raw;
              setVirtualAcc(raw);
            } else {
              setVirtualAcc(null);
            }
          } catch (_) {
            setVirtualAcc(null);
          }
        } else {
          setVirtualAcc(null);
        }

        // Save persistent cache
        localStorage.setItem(`@amf_web_wallet_${uid}`, JSON.stringify({
          balance: finalBal,
          transactions: txData,
          virtualAcc: parsedVa,
          timestamp: Date.now()
        }));

        // Self-heal DB if needed
        if (finalBal > profileBal) {
          await supabase.from('profiles').update({ balance: finalBal }).eq('id', uid);
        }
      }
    } catch (err) {
      console.warn('[Wallet] Fetch notice:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [resolveUid]);

  // Initial load
  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  // Check & Sync Bank Deposits
  const handleBankSync = async () => {
    setRefreshing(true);
    setSyncStatusMsg('Checking Flutterwave for incoming bank deposit...');
    try {
      const uid = await resolveUid();
      const res = await fetch('/api/sync-flutterwave-deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: uid,
          email: currentUser?.email,
          phone: currentUser?.phone
        })
      });

      const json = await res.json();
      if (json?.success && json?.total_credited > 0) {
        setCelebrationData({
          amount: json.total_credited,
          reference: json.newly_credited?.[0]?.reference || `FLW-${Date.now()}`,
          gateway: 'Dedicated Bank Transfer (Flutterwave MFB)'
        });
        setSyncStatusMsg(`🎉 ₦${json.total_credited.toLocaleString()} credited successfully!`);
        await fetchWalletData(true);
      } else {
        setSyncStatusMsg('Babu sabon transfer da ya shigo a yanzu. Idan yanzu ka tura kudin, da fatan a jira dakika 30-60 kafin banki ya kammala aikawa.');
        await fetchWalletData(true);
        setTimeout(() => setSyncStatusMsg(''), 6000);
      }
    } catch (e) {
      setSyncStatusMsg('Network check error. Please check your connection.');
      setTimeout(() => setSyncStatusMsg(''), 4000);
    } finally {
      setRefreshing(false);
    }
  };

  // Verify BVN & Generate Dedicated Account
  const handleVerifyBvnAndGenerate = async (e) => {
    if (e) e.preventDefault();
    const cleanBvn = String(bvnInput || '').trim().replace(/[^0-9]/g, '');
    if (cleanBvn.length !== 11 || /^(\d)\1{10}$/.test(cleanBvn)) {
      setVaError('Da fatan a shigar da ingantacciyar lambar BVN mai lamba 11 daidai.');
      return;
    }

    const nameToUse = (bvnLegalName.trim() || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || '').trim();
    if (!nameToUse) {
      setVaError('Da fatan a sanya cikakken sunanka kamar yadda yake a jikin BVN.');
      return;
    }

    setBvnVerifying(true);
    setVaError('');

    try {
      const uid = await resolveUid();
      const email = currentUser?.email || `wallet_${String(uid || 'usr').substring(0, 6)}@abumafhal.com`;
      const phone = bvnPhone.trim() || currentUser?.phone || currentUser?.user_metadata?.phone_number || '';

      const res = await fetch('/api/create-virtual-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: uid,
          email,
          name: nameToUse,
          phone,
          bvn: cleanBvn,
          force_refresh: true
        })
      });

      const json = await res.json();
      if (json?.success && json?.data?.account_number && isValidVirtualAccount(json.data.account_number)) {
        setVirtualAcc(json.data);
        setShowBvnForm(false);
        if (uid) {
          localStorage.setItem(`@amf_va_${uid}`, JSON.stringify(json.data));
          await supabase.from('profiles').update({ custom_id: JSON.stringify(json.data) }).eq('id', uid);
        }
        setSyncStatusMsg(`🎉 An kafa asusunka na din-din-din a ${json.data.bank_name}!`);
        await fetchWalletData(true);
      } else {
        setVaError(json?.error || 'Verification failed. Please check your BVN and legal name.');
      }
    } catch (err) {
      setVaError(err.message || 'Error communicating with verification service');
    } finally {
      setBvnVerifying(false);
    }
  };

  // Initiate Online Top-Up
  const handleTopUpSubmit = async (e) => {
    if (e) e.preventDefault();
    if (topUpGateway === 'bank_transfer') {
      setShowTopUpModal(false);
      return;
    }

    const amt = Number(String(topUpAmount || '').replace(/[^0-9.]/g, ''));
    if (!amt || amt < 100) {
      setTopUpError('Minimum top-up amount is ₦100');
      return;
    }

    setTopUpLoading(true);
    setTopUpError('');

    try {
      const uid = await resolveUid();
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway: topUpGateway,
          amount: amt,
          email: currentUser?.email || 'customer@abumafhal.com',
          phone: currentUser?.phone || '',
          name: currentUser?.user_metadata?.full_name || 'Abu Mafhal User',
          metadata: {
            action: 'wallet_topup',
            user_id: uid,
            credited_ngn: amt
          }
        })
      });

      const json = await res.json();
      const link = json?.checkoutUrl || json?.data?.authorization_url || json?.data?.invoice_url;
      if (!link) throw new Error(json?.error || 'Could not generate payment link.');

      window.location.href = link;
    } catch (err) {
      setTopUpError(err.message || 'Payment initiation failed. Please try another channel.');
    } finally {
      setTopUpLoading(false);
    }
  };

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    if (filterType === 'credit') {
      return transactions.filter(t => t.type === 'topup' || t.type === 'credit' || t.type === 'deposit');
    }
    if (filterType === 'debit') {
      return transactions.filter(t => t.type === 'withdrawal' || t.type === 'debit' || t.type === 'wallet_payment' || t.type === 'wallet_purchase');
    }
    return transactions;
  }, [transactions, filterType]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 font-sans">
      
      {/* ── Status Notification Banner ── */}
      {syncStatusMsg && (
        <div className="mb-6 rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-3 text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm font-bold shadow-sm transition-all">
          <div className="flex items-center gap-2.5">
            <RefreshCw className={`w-4 h-4 text-emerald-600 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{syncStatusMsg}</span>
          </div>
          <button 
            onClick={() => setSyncStatusMsg('')} 
            className="p-1 hover:bg-emerald-200/50 dark:hover:bg-emerald-800/50 rounded-lg text-emerald-700 dark:text-emerald-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Top Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            My Wallet
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Verified Escrow Ledger · Instant NUBAN Deposit
          </p>
        </div>

        <button
          onClick={handleBankSync}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-black rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition-colors border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-600 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Checking...' : 'Check & Sync Deposits'}</span>
        </button>
      </div>

      {/* ── Main Cards Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        
        {/* 1. Hero Balance Card (3 cols) */}
        <div className="lg:col-span-3 rounded-3xl bg-gradient-to-br from-[#071324] via-[#0F274B] to-[#1E3E6E] text-white p-6 sm:p-7 shadow-xl border border-slate-800 flex flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <WalletIcon className="w-3.5 h-3.5 text-emerald-400" />
                Available Balance
              </span>
              <button
                onClick={() => setHideBalance(!hideBalance)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
                title={hideBalance ? "Show balance" : "Hide balance"}
              >
                {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="my-5">
              <p className="text-3xl sm:text-5xl font-black tracking-tight font-mono text-white">
                {hideBalance ? '••••••••' : formatCurrency(balance)}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  <ShieldCheck className="w-3 h-3" />
                  100% Escrow Protected
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  Zero Transfer Fees
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-2 grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowTopUpModal(true)}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Add Money
            </button>

            <button
              onClick={handleBankSync}
              disabled={refreshing}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs sm:text-sm border border-white/15 backdrop-blur-sm transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
              Sync Deposit
            </button>
          </div>
        </div>

        {/* 2. Permanent Dedicated NUBAN Card (2 cols) */}
        <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Permanent NUBAN
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                DEDICATED
              </span>
            </div>

            {isValidVirtualAccount(virtualAcc?.account_number) ? (
              <div className="space-y-3">
                <div className="rounded-2xl p-4 bg-gradient-to-br from-slate-900 to-slate-950 text-white shadow-md border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-black tracking-wide text-emerald-400 uppercase">
                      {virtualAcc.bank_name || 'Flutterwave MFB'}
                    </p>
                    <span className="text-[9px] font-bold text-slate-400">INSTANT</span>
                  </div>

                  <p className="text-2xl font-black font-mono tracking-widest text-white mt-1">
                    {String(virtualAcc.account_number).replace(/(\d{4})(\d{3})(\d{3})/, '$1  $2  $3')}
                  </p>

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/80">
                    <div className="truncate pr-2">
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Account Name</p>
                      <p className="text-xs font-bold text-slate-200 truncate">
                        {virtualAcc.account_name || currentUser?.user_metadata?.full_name || 'Verified Member'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleCopy(virtualAcc.account_number)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  💡 Transfer from any bank (OPay, Kuda, PalmPay, GTBank, Zenith, Access). Your wallet credits automatically in 30–60 seconds.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Per CBN regulations, BVN verification is required once to generate your dedicated Wema / Flutterwave account with automatic instant crediting.
                </p>

                {vaError && (
                  <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 flex items-center gap-2 text-red-600 dark:text-red-400 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{vaError}</span>
                  </div>
                )}

                <button
                  onClick={() => setShowBvnForm(!showBvnForm)}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{showBvnForm ? 'Hide Form' : 'Verify BVN & Generate Account'}</span>
                </button>

                {showBvnForm && (
                  <form onSubmit={handleVerifyBvnAndGenerate} className="mt-3 space-y-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                        Legal Full Name (as on BVN)
                      </label>
                      <input
                        type="text"
                        required
                        value={bvnLegalName}
                        onChange={(e) => setBvnLegalName(e.target.value)}
                        placeholder="Registered legal full name"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center">
                        <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                          11-Digit BVN
                        </label>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Dial *565*0#</span>
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={11}
                        value={bvnInput}
                        onChange={(e) => setBvnInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="11-digit BVN"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                        Phone Number
                      </label>
                      <input
                        type="text"
                        value={bvnPhone}
                        onChange={(e) => setBvnPhone(e.target.value)}
                        placeholder={currentUser?.phone || '08012345678'}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={bvnVerifying || bvnInput.length !== 11}
                      className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {bvnVerifying ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying BVN...</span>
                        </>
                      ) : (
                        <span>Verify & Issue Account</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Transaction History ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden mb-12">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">
              Recent Transactions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live ledger of deposits and purchases
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 self-start sm:self-auto">
            {['all', 'credit', 'debit'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                className={`px-3 py-1.5 text-xs font-black rounded-lg transition-colors cursor-pointer ${
                  filterType === tab
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                {tab === 'all' ? 'All' : tab === 'credit' ? 'Deposits (+)' : 'Debits (-)'}
              </button>
            ))}
          </div>
        </div>

        {filteredTransactions.length > 0 ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTransactions.map((tx) => {
              const isCredit = tx.type === 'topup' || tx.type === 'credit' || tx.type === 'deposit';
              return (
                <div key={tx.id} className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isCredit ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600' : 'bg-red-50 dark:bg-red-950/60 text-red-600'
                    }`}>
                      {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {tx.description || (isCredit ? 'Bank Deposit' : 'Payment')}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : 'Recent'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-sm font-black font-mono ${isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
                      {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    <span className="inline-block mt-0.5 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {tx.status || 'completed'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <Clock className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No transactions recorded yet</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Your deposits and payment receipts will show here automatically.
            </p>
          </div>
        )}
      </div>

      {/* ── Add Money Modal (Bottom Sheet / Modal) ── */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 relative">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Add Cash to Wallet
              </h3>
              <button
                onClick={() => setShowTopUpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTopUpSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-1">
                  Amount to Fund (₦)
                </label>
                <input
                  type="text"
                  required
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="₦0.00"
                  className="w-full px-4 py-3 text-xl font-black font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />

                <div className="flex flex-wrap gap-2 mt-2.5">
                  {[1000, 2000, 5000, 10000, 20000].map(v => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setTopUpAmount(String(v))}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      +{formatCurrency(v)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase mb-2">
                  Select Gateway Channel
                </label>
                <div className="space-y-2">
                  {GATEWAYS.map(gw => {
                    const IconComp = gw.icon;
                    const isSelected = topUpGateway === gw.id;
                    return (
                      <div
                        key={gw.id}
                        onClick={() => setTopUpGateway(gw.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected 
                            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20' 
                            : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 bg-white dark:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: gw.iconBg }}>
                            <IconComp className="w-5 h-5" style={{ color: gw.iconColor }} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 dark:text-white">{gw.name}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400">{gw.subtitle}</p>
                          </div>
                        </div>

                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {topUpError && (
                <p className="text-xs font-bold text-red-600 dark:text-red-400">{topUpError}</p>
              )}

              <button
                type="submit"
                disabled={topUpLoading}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {topUpLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting Gateway...</span>
                  </>
                ) : (
                  <span>
                    {topUpGateway === 'bank_transfer'
                      ? 'View Dedicated NUBAN'
                      : `Pay ${topUpAmount ? formatCurrency(Number(topUpAmount)) : ''}`}
                  </span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Celebration Modal for incoming deposits ── */}
      {celebrationData && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              Deposit Credited!
            </h3>
            <p className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 my-2">
              {formatCurrency(celebrationData.amount)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Funds have been securely added to your Abu Mafhal wallet balance.
            </p>
            <button
              onClick={() => setCelebrationData(null)}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Wallet;