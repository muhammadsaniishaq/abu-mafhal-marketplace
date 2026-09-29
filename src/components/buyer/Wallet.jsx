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
  Zap,
  ChevronRight,
  Receipt,
  Calendar,
  Hash,
  Sparkles,
  Wifi
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
    badgeColor: '#D4AF37',
    badgeBg: 'rgba(212, 175, 55, 0.15)',
    icon: Building2,
    iconColor: '#D4AF37',
  },
  {
    id: 'paystack',
    name: 'Paystack Checkout',
    subtitle: 'Cards · USSD · Bank Transfer · Apple Pay',
    badge: 'AUTO-VERIFY',
    badgeColor: '#38BDF8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    icon: CreditCard,
    iconColor: '#38BDF8',
  },
  {
    id: 'flutterwave',
    name: 'Flutterwave Africa',
    subtitle: 'Cards · Direct Bank · Mobile Money',
    badge: 'PAN-AFRICA',
    badgeColor: '#F59E0B',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    icon: Zap,
    iconColor: '#F59E0B',
  },
  {
    id: 'nowpayments',
    name: 'NOWPayments Crypto',
    subtitle: 'USDT (TRC20) · BTC · ETH · SOL · BNB',
    badge: 'WEB3 CRYPTO',
    badgeColor: '#A855F7',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    icon: WalletIcon,
    iconColor: '#A855F7',
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
  const [modalCopied, setModalCopied] = useState(false);

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

  // Selected Transaction for Full Receipt Details Modal
  const [selectedTx, setSelectedTx] = useState(null);

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
  const handleCopy = (text, isModal = false) => {
    if (!text) return;
    try {
      if (navigator?.clipboard) {
        navigator.clipboard.writeText(text);
      }
    } catch (_) {}
    if (isModal) {
      setModalCopied(true);
      setTimeout(() => setModalCopied(false), 2000);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
          .limit(60)
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

  // Check & Sync Bank Deposits (Strictly Idempotent)
  const handleBankSync = async () => {
    setRefreshing(true);
    setSyncStatusMsg('Tabbatarwa tare da binciken canjin kudi daga Flutterwave...');
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
        setSyncStatusMsg(`🎉 ₦${json.total_credited.toLocaleString()} an sanya su cikin asusunka cikin nasara!`);
        await fetchWalletData(true);
      } else {
        setSyncStatusMsg('Babu sabon transfer da ya shigo a yanzu. Idan yanzu ka tura kudin, da fatan a jira dakika 30-60 kafin banki ya kammala aikawa.');
        await fetchWalletData(true);
        setTimeout(() => setSyncStatusMsg(''), 7000);
      }
    } catch (e) {
      setSyncStatusMsg('An samu matsalar sadarwa. Da fatan a sake gwadawa.');
      setTimeout(() => setSyncStatusMsg(''), 5000);
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 font-sans">
      
      {/* ── Status Notification Banner (Navy & Gold Frosted) ── */}
      {syncStatusMsg && (
        <div className="mb-6 rounded-2xl p-4 bg-[#0A192F]/90 backdrop-blur-md border border-[#D4AF37]/40 flex items-center justify-between gap-3 text-white text-xs sm:text-sm font-semibold shadow-lg shadow-[#071324]/50 transition-all animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <RefreshCw className={`w-4 h-4 text-[#D4AF37] ${refreshing ? 'animate-spin' : ''}`} />
            <span className="text-[#FDE68A]">{syncStatusMsg}</span>
          </div>
          <button 
            onClick={() => setSyncStatusMsg('')} 
            className="p-1 hover:bg-[#D4AF37]/20 rounded-lg text-[#D4AF37] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Luxury Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              My Wallet
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
              <Sparkles className="w-3 h-3 text-[#D4AF37]" />
              VIP ESCROW
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Verified Escrow Ledger · Instant NUBAN Deposit
          </p>
        </div>

        <button
          onClick={handleBankSync}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black rounded-xl bg-gradient-to-r from-[#0A192F] to-[#122A4E] hover:from-[#0E223D] hover:to-[#173562] text-[#D4AF37] border border-[#D4AF37]/40 transition-all cursor-pointer shadow-md hover:shadow-[#D4AF37]/10 active:scale-95 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Binciken Deposit...' : 'Check & Sync Deposits'}</span>
        </button>
      </div>

      {/* ── Main Cards Grid (Navy & Gold Theme) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-8">
        
        {/* 1. Hero Balance Card (3 cols) */}
        <div className="lg:col-span-3 rounded-3xl bg-gradient-to-br from-[#071324] via-[#0A192F] to-[#122A4E] text-white p-6 sm:p-8 shadow-2xl border border-[#D4AF37]/30 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle gold ambient glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#D4AF37]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#38BDF8]/10 rounded-full blur-3xl pointer-events-none -ml-10 -mb-10" />

          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-widest text-[#D4AF37] flex items-center gap-2">
                <WalletIcon className="w-4 h-4 text-[#D4AF37]" />
                Available Balance
              </span>
              <button
                onClick={() => setHideBalance(!hideBalance)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-[#D4AF37] transition-colors border border-[#D4AF37]/20"
                title={hideBalance ? "Nuna kudi" : "Boye kudi"}
              >
                {hideBalance ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="my-6">
              <p className="text-3xl sm:text-5xl font-black tracking-tight font-mono text-white">
                {hideBalance ? '••••••••' : formatCurrency(balance)}
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#D4AF37] bg-[#D4AF37]/10 px-3 py-1 rounded-full border border-[#D4AF37]/30">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#D4AF37]" />
                  100% Escrow Protected
                </span>
                <span className="text-[11px] font-semibold text-slate-300">
                  Zero Transfer Fees
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-2 grid grid-cols-2 gap-3.5">
            <button
              onClick={() => setShowTopUpModal(true)}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F59E0B] to-[#D4AF37] hover:brightness-110 text-[#071324] font-black text-xs sm:text-sm shadow-lg shadow-[#D4AF37]/25 transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-[#071324]" />
              <span>Add Money</span>
            </button>

            <button
              onClick={handleBankSync}
              disabled={refreshing}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#0A192F]/80 hover:bg-[#122A4E] text-[#D4AF37] font-bold text-xs sm:text-sm border border-[#D4AF37]/40 backdrop-blur-sm transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#D4AF37] ${refreshing ? 'animate-spin' : ''}`} />
              <span>Sync Deposit</span>
            </button>
          </div>
        </div>

        {/* 2. Permanent Dedicated NUBAN Card (2 cols) */}
        <div className="lg:col-span-2 rounded-3xl bg-[#0A192F] p-6 shadow-xl border border-[#D4AF37]/30 flex flex-col justify-between text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-black uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-[#D4AF37]" />
                Permanent NUBAN
              </span>
              <span className="text-[10px] bg-[#D4AF37]/15 text-[#D4AF37] px-2.5 py-0.5 rounded-full font-bold border border-[#D4AF37]/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-[#D4AF37]" />
                VERIFIED DEDICATED
              </span>
            </div>

            {isValidVirtualAccount(virtualAcc?.account_number) ? (
              <div className="space-y-4">
                {/* Luxury Navy & Gold ATM Card */}
                <div className="rounded-2xl p-5 bg-gradient-to-br from-[#081426] via-[#0E223D] to-[#163156] border border-[#D4AF37]/40 shadow-xl relative overflow-hidden">
                  {/* EMV Chip and Bank Info */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-7 rounded bg-gradient-to-br from-[#D4AF37] to-[#B38728] border border-[#FDE68A]/60 flex items-center justify-center shadow-sm">
                        <div className="w-6 h-4 border border-[#071324]/40 rounded-sm grid grid-cols-2 gap-0.5 p-0.5">
                          <div className="bg-[#071324]/20 rounded-xs" />
                          <div className="bg-[#071324]/20 rounded-xs" />
                          <div className="bg-[#071324]/20 rounded-xs" />
                          <div className="bg-[#071324]/20 rounded-xs" />
                        </div>
                      </div>
                      <Wifi className="w-4 h-4 text-[#D4AF37] rotate-90" />
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-black tracking-wide text-[#D4AF37] uppercase">
                        {virtualAcc.bank_name || 'Flutterwave MFB'}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400">0% FEE · INSTANT AUTO-CREDIT</p>
                    </div>
                  </div>

                  {/* Formatted Account Number */}
                  <div className="my-3">
                    <p className="text-2xl font-black font-mono tracking-widest text-white">
                      {String(virtualAcc.account_number).replace(/(\d{4})(\d{3})(\d{3})/, '$1  $2  $3')}
                    </p>
                  </div>

                  {/* Account Name and Copy Button */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#D4AF37]/20">
                    <div className="truncate pr-3">
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Account Holder</p>
                      <p className="text-xs font-black text-slate-100 truncate">
                        {virtualAcc.account_name || currentUser?.user_metadata?.full_name || 'Verified Member'}
                      </p>
                    </div>

                    <button
                      onClick={() => handleCopy(virtualAcc.account_number, false)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#F59E0B] text-[#071324] font-black text-xs transition-colors cursor-pointer shadow-sm active:scale-95"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'An Kwafa' : 'Kwafa'}</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] text-slate-300 leading-relaxed">
                  💡 Tura kudi daga kowane banki (OPay, Kuda, PalmPay, GTBank, Zenith, Access). Kudinka zai shiga asusunka kai tsaye cikin dakika 30–60.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Bisa ka'idar CBN, ana bukatar lambar BVN sau daya kacal don samar maka da asusun banki na musamman mai shigar da kudi kai-tsaye ba tare da bata lokaci ba.
                </p>

                {vaError && (
                  <div className="p-2.5 rounded-xl bg-red-950/60 border border-red-500/50 flex items-center gap-2 text-red-300 text-xs">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
                    <span>{vaError}</span>
                  </div>
                )}

                <button
                  onClick={() => setShowBvnForm(!showBvnForm)}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#D4AF37] hover:bg-[#F59E0B] text-[#071324] font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{showBvnForm ? 'Boye Fom' : 'Tabbatar da BVN & Samu Asusu'}</span>
                </button>

                {showBvnForm && (
                  <form onSubmit={handleVerifyBvnAndGenerate} className="mt-3 space-y-2.5 p-3 rounded-2xl bg-[#071324]/80 border border-[#D4AF37]/30">
                    <div>
                      <label className="block text-[10px] font-bold text-[#D4AF37] uppercase mb-1">
                        Cikakken Suna Kamar Yadda Yake a BVN
                      </label>
                      <input
                        type="text"
                        required
                        value={bvnLegalName}
                        onChange={(e) => setBvnLegalName(e.target.value)}
                        placeholder="Sunanka na shari'a"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[#D4AF37]/30 bg-[#0A192F] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[10px] font-bold text-[#D4AF37] uppercase">
                          Lambar BVN (Lamba 11)
                        </label>
                        <span className="text-[10px] text-[#FDE68A] font-bold">Danna *565*0#</span>
                      </div>
                      <input
                        type="text"
                        required
                        maxLength={11}
                        value={bvnInput}
                        onChange={(e) => setBvnInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="11-digit BVN"
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[#D4AF37]/30 bg-[#0A192F] text-white font-mono tracking-widest placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-[#D4AF37] uppercase mb-1">
                        Lambar Waya
                      </label>
                      <input
                        type="text"
                        value={bvnPhone}
                        onChange={(e) => setBvnPhone(e.target.value)}
                        placeholder={currentUser?.phone || '08012345678'}
                        className="w-full px-3 py-2 text-xs rounded-lg border border-[#D4AF37]/30 bg-[#0A192F] text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={bvnVerifying || bvnInput.length !== 11}
                      className="w-full py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#F59E0B] text-[#071324] font-black text-xs shadow disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                    >
                      {bvnVerifying ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Ana Tabbatarwa...</span>
                        </>
                      ) : (
                        <span>Tabbatar da BVN & Samu Asusu</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Transaction History (Navy & Gold VIP Style) ── */}
      <div className="bg-[#0A192F] rounded-3xl shadow-xl border border-[#D4AF37]/30 overflow-hidden mb-12">
        <div className="p-5 sm:p-6 border-b border-[#D4AF37]/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
              <Receipt className="w-4 h-4 text-[#D4AF37]" />
              Recent Transactions
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Danna kowace ma'amala don ganin cikakken bayani da risiti (receipt)
            </p>
          </div>

          <div className="inline-flex rounded-xl bg-[#071324] p-1 border border-[#D4AF37]/30 self-start sm:self-auto">
            {['all', 'credit', 'debit'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                className={`px-3.5 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer ${
                  filterType === tab
                    ? 'bg-[#D4AF37] text-[#071324] shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab === 'all' ? 'Duka' : tab === 'credit' ? 'Deposits (+)' : 'Debits (-)'}
              </button>
            ))}
          </div>
        </div>

        {filteredTransactions.length > 0 ? (
          <div className="divide-y divide-[#D4AF37]/10">
            {filteredTransactions.map((tx) => {
              const isCredit = tx.type === 'topup' || tx.type === 'credit' || tx.type === 'deposit';
              return (
                <div 
                  key={tx.id} 
                  onClick={() => setSelectedTx(tx)}
                  className="p-4 sm:p-5 flex items-center justify-between hover:bg-[#122A4E]/50 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-3.5 min-w-0 pr-3">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      isCredit ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}>
                      {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-white truncate group-hover:text-[#D4AF37] transition-colors">
                        {tx.description || (isCredit ? 'Bank Deposit' : 'Marketplace Payment')}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) : 'Recent'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className={`text-sm sm:text-base font-black font-mono ${isCredit ? 'text-[#D4AF37]' : 'text-slate-100'}`}>
                        {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                      </p>
                      <span className={`inline-block mt-0.5 text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                        tx.status === 'completed' || tx.status === 'successful'
                          ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      }`}>
                        {tx.status || 'completed'}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-[#D4AF37] group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#071324] flex items-center justify-center text-slate-500 mb-3 border border-[#D4AF37]/20">
              <Clock className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <p className="text-sm font-bold text-slate-200">Babu ma'amala da aka yi a yanzu</p>
            <p className="text-xs text-slate-400 mt-1">
              Kowane deposit ko siyan kaya zai bayyana a nan tare da cikakken risiti.
            </p>
          </div>
        )}
      </div>

      {/* ── FULL TRANSACTION DETAILS / RECEIPT MODAL (Navy & Gold) ── */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 bg-[#071324]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0A192F] rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-[#D4AF37]/40 relative text-white">
            {/* Close Button */}
            <button
              onClick={() => setSelectedTx(null)}
              className="absolute top-5 right-5 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Receipt Header */}
            <div className="text-center pt-2 pb-5 border-b border-[#D4AF37]/20">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-3">
                {selectedTx.type === 'topup' || selectedTx.type === 'credit' || selectedTx.type === 'deposit' ? (
                  <CheckCircle2 className="w-8 h-8 text-[#D4AF37]" />
                ) : (
                  <Receipt className="w-8 h-8 text-[#D4AF37]" />
                )}
              </div>
              <h3 className="text-xl font-black text-white">
                Transaction Receipt
              </h3>
              <p className="text-xs text-[#D4AF37] font-semibold mt-0.5">
                Cikakken Bayanin Ma'amala
              </p>

              <p className={`text-3xl sm:text-4xl font-black font-mono mt-3 ${
                (selectedTx.type === 'topup' || selectedTx.type === 'credit' || selectedTx.type === 'deposit')
                  ? 'text-[#D4AF37]'
                  : 'text-white'
              }`}>
                {(selectedTx.type === 'topup' || selectedTx.type === 'credit' || selectedTx.type === 'deposit') ? '+' : '-'}
                {formatCurrency(selectedTx.amount || 0)}
              </p>

              <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
                <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
                <span>{(selectedTx.status || 'COMPLETED').toUpperCase()}</span>
              </div>
            </div>

            {/* Receipt Detail Rows */}
            <div className="py-5 space-y-3.5 text-xs sm:text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-[#D4AF37]" />
                  Reference ID
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-[#D4AF37] text-xs">
                    {selectedTx.reference || selectedTx.id || 'N/A'}
                  </span>
                  <button
                    onClick={() => handleCopy(selectedTx.reference || selectedTx.id, true)}
                    className="p-1 rounded bg-[#071324] hover:bg-[#122A4E] text-[#D4AF37] border border-[#D4AF37]/30 transition-colors"
                    title="Kwafi Reference"
                  >
                    {modalCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Transaction Type</span>
                <span className="font-bold text-white">
                  {selectedTx.type === 'topup' || selectedTx.type === 'deposit' || selectedTx.type === 'credit'
                    ? 'Dedicated Bank Deposit'
                    : selectedTx.type === 'wallet_payment'
                    ? 'Marketplace Order Payment'
                    : selectedTx.type === 'pss_down_payment'
                    ? 'Pay Small Small Down Payment'
                    : selectedTx.type || 'Transfer'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Payment Channel</span>
                <span className="font-bold text-[#FDE68A]">
                  {selectedTx.reference?.startsWith('FLW')
                    ? 'Flutterwave MFB Transfer'
                    : selectedTx.reference?.startsWith('ORD')
                    ? 'Abu Mafhal Escrow Checkout'
                    : 'Instant Electronic Transfer'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#D4AF37]" />
                  Date & Time
                </span>
                <span className="font-bold text-slate-200">
                  {selectedTx.created_at ? new Date(selectedTx.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A'}
                </span>
              </div>

              <div className="pt-2 border-t border-[#D4AF37]/15">
                <p className="text-slate-400 text-xs mb-1">Narration / Description</p>
                <p className="text-xs text-slate-200 bg-[#071324] p-3 rounded-xl border border-[#D4AF37]/20 leading-relaxed">
                  {selectedTx.description || 'Verified Abu Mafhal Marketplace transaction.'}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Balance Impact</span>
                <span className={`font-bold font-mono ${
                  (selectedTx.type === 'topup' || selectedTx.type === 'credit' || selectedTx.type === 'deposit')
                    ? 'text-[#D4AF37]'
                    : 'text-red-400'
                }`}>
                  {(selectedTx.type === 'topup' || selectedTx.type === 'credit' || selectedTx.type === 'deposit')
                    ? `+${formatCurrency(selectedTx.amount)} (Added to Balance)`
                    : `-${formatCurrency(selectedTx.amount)} (Deducted from Balance)`}
                </span>
              </div>
            </div>

            {/* Done Action */}
            <div className="pt-3 border-t border-[#D4AF37]/20">
              <button
                onClick={() => setSelectedTx(null)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F59E0B] to-[#D4AF37] text-[#071324] font-black text-sm shadow-lg shadow-[#D4AF37]/20 transition-all cursor-pointer active:scale-95"
              >
                Kammala (Done)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Money Modal (Bottom Sheet / Modal in Navy & Gold) ── */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 bg-[#071324]/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0A192F] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-[#D4AF37]/40 relative text-white">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-[#D4AF37]" />
                Add Cash to Wallet
              </h3>
              <button
                onClick={() => setShowTopUpModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTopUpSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#D4AF37] uppercase mb-1">
                  Amount to Fund (₦)
                </label>
                <input
                  type="text"
                  required
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="₦0.00"
                  className="w-full px-4 py-3 text-xl font-black font-mono rounded-xl border border-[#D4AF37]/40 bg-[#071324] text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                />

                <div className="flex flex-wrap gap-2 mt-2.5">
                  {[1000, 2000, 5000, 10000, 20000].map(v => (
                    <button
                      type="button"
                      key={v}
                      onClick={() => setTopUpAmount(String(v))}
                      className="px-2.5 py-1 text-xs font-bold rounded-lg bg-[#122A4E] hover:bg-[#193A6C] text-[#D4AF37] border border-[#D4AF37]/30 transition-colors"
                    >
                      +{formatCurrency(v)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#D4AF37] uppercase mb-2">
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
                            ? 'border-[#D4AF37] bg-[#122A4E]' 
                            : 'border-[#D4AF37]/20 hover:border-[#D4AF37]/40 bg-[#071324]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#D4AF37]/15">
                            <IconComp className="w-5 h-5 text-[#D4AF37]" />
                          </div>
                          <div>
                            <p className="text-xs font-black text-white">{gw.name}</p>
                            <p className="text-[10px] text-slate-400">{gw.subtitle}</p>
                          </div>
                        </div>

                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                          isSelected ? 'border-[#D4AF37] bg-[#D4AF37]' : 'border-slate-500'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#071324]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {topUpError && (
                <p className="text-xs font-bold text-red-400">{topUpError}</p>
              )}

              <button
                type="submit"
                disabled={topUpLoading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F59E0B] to-[#D4AF37] text-[#071324] font-black text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
              >
                {topUpLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#071324]" />
                    <span>Connecting Gateway...</span>
                  </>
                ) : (
                  <span>
                    {topUpGateway === 'bank_transfer'
                      ? 'Duba Dedicated NUBAN'
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
        <div className="fixed inset-0 z-50 bg-[#071324]/85 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0A192F] rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl border border-[#D4AF37]/40 text-white">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37] mb-4">
              <CheckCircle2 className="w-8 h-8 text-[#D4AF37]" />
            </div>
            <h3 className="text-xl font-black text-white">
              An Sanya Deposit!
            </h3>
            <p className="text-3xl font-black font-mono text-[#D4AF37] my-2">
              {formatCurrency(celebrationData.amount)}
            </p>
            <p className="text-xs text-slate-300 mb-6">
              Kudinka sun shiga asusunka na Abu Mafhal cikin nasara ba tare da ko sisi da aka cire ba.
            </p>
            <button
              onClick={() => setCelebrationData(null)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#D4AF37] via-[#F59E0B] to-[#D4AF37] text-[#071324] font-black text-sm shadow transition-all cursor-pointer active:scale-95"
            >
              Kammala
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default Wallet;