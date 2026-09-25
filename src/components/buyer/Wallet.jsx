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
  Sparkles,
  Eye,
  EyeOff,
  Lock,
  ArrowRight,
  TrendingUp,
  Receipt,
  HelpCircle,
  Zap
} from 'lucide-react';

const PRESET_AMOUNTS = [1000, 2500, 5000, 10000, 25000, 50000];
const USD_RATE = 1500; // Benchmark ₦1,500 = $1.00 USD

const Wallet = () => {
  const { currentUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [hideBalance, setHideBalance] = useState(false);

  // Modals state (Withdrawal completely removed!)
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showBankTransferModal, setShowBankTransferModal] = useState(false);
  const [showVerifyRefModal, setShowVerifyRefModal] = useState(false);
  const [manualRefInput, setManualRefInput] = useState('');
  const [manualVerifyLoading, setManualVerifyLoading] = useState(false);
  const [manualVerifyMsg, setManualVerifyMsg] = useState(null);

  // Success Celebration Modal
  const [celebrationData, setCelebrationData] = useState(null);

  // Dedicated Virtual Account States (Unique Per User)
  const [userVirtualAccount, setUserVirtualAccount] = useState(null);
  const [isGeneratingVa, setIsGeneratingVa] = useState(false);
  const [vaAmount, setVaAmount] = useState('2500');
  const [vaError, setVaError] = useState('');
  const [vaVerifyStatus, setVaVerifyStatus] = useState('');

  // Top-up states
  const [topUpAmount, setTopUpAmount] = useState('5000');
  const [topUpGateway, setTopUpGateway] = useState('paystack'); // 'paystack' | 'flutterwave'
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpError, setTopUpError] = useState('');

  // Search & Filter
  const [filterType, setFilterType] = useState('all'); // 'all' | 'credit' | 'debit'
  const [searchQuery, setSearchQuery] = useState('');
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  // Banner status for auto-verification on return
  const [verifyingBanner, setVerifyingBanner] = useState('');

  const activeUserId = currentUser?.id || currentUser?.uid;

  // Load existing cached virtual account for this specific user
  useEffect(() => {
    if (activeUserId && typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`@abumafhal_va_${activeUserId}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.account_number && !parsed.account_number.startsWith('980')) {
            setUserVirtualAccount(parsed);
          }
        }
      } catch (_) {}
    }
  }, [activeUserId]);

  // Permanent dedicated account recognition for founder / admin emails
  const FOUNDER_EMAILS = [
    'sale.abumafhal@gmail.com',
    'muhammadsanishaq@gmail.com',
    'abumafhalhub@gmail.com',
    'muhammadsanish0@gmail.com',
    'ceo@abumafhal.com',
    'muhammadsaniisyaku3@gmail.com'
  ];

  // Auto-fetch or generate dedicated virtual account if not present yet
  useEffect(() => {
    if (activeUserId && !userVirtualAccount && !isGeneratingVa) {
      handleGenerateDynamicAccount(2500);
    }
  }, [activeUserId, userVirtualAccount]);

  // Generate unique dedicated virtual account on Flutterwave
  const handleGenerateDynamicAccount = async (targetAmt) => {
    if (!activeUserId) return;
    setIsGeneratingVa(true);
    setVaError('');
    setVaVerifyStatus('');
    try {
      const amt = Number(targetAmt || vaAmount) || 2500;
      const res = await fetch('/api/create-virtual-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: activeUserId,
          email: currentUser?.email,
          name: currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0],
          phone: currentUser?.phone,
          amount: amt
        })
      });
      const json = await res.json();
      if (json?.success && json?.data?.account_number) {
        setUserVirtualAccount(json.data);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`@abumafhal_va_${activeUserId}`, JSON.stringify(json.data));
        }
      } else {
        // Fallback for founder or general
        const checkEmail = (currentUser?.email || '').toLowerCase().trim();
        if (FOUNDER_EMAILS.includes(checkEmail)) {
          const permanentVA = {
            account_number: '9187255635',
            account_name: 'Abu Mafhal / Muhammad Sani',
            bank_name: 'Flutterwave MFB (Formerly OK MFB)',
            provider: 'flutterwave',
            is_permanent: true
          };
          setUserVirtualAccount(permanentVA);
        } else {
          setVaError(json?.error || 'Could not generate virtual account. Please try again.');
        }
      }
    } catch (err) {
      setVaError(err.message || 'Connection error. Please try again.');
    } finally {
      setIsGeneratingVa(false);
    }
  };

  // Verify bank transfer deposit
  const handleVerifyTransfer = async () => {
    setRefreshing(true);
    setVaVerifyStatus('Checking Flutterwave for incoming bank deposit...');
    try {
      const syncRes = await fetch('/api/sync-flutterwave-deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: activeUserId,
          email: currentUser?.email,
          phone: currentUser?.phone
        })
      });
      const syncJson = await syncRes.json();
      if (syncJson?.total_credited > 0) {
        setVaVerifyStatus(`🎉 Success! ₦${syncJson.total_credited.toLocaleString()} credited to your wallet!`);
        setCelebrationData({
          amount: syncJson.total_credited,
          reference: syncJson.newly_credited?.[0]?.reference || 'FLW-TRANSFER',
          gateway: 'Dedicated Bank Transfer (Flutterwave MFB)'
        });
        await fetchWalletData();
      } else {
        setVaVerifyStatus('No new transfer detected yet. Bank transfers usually reflect within 30-90 seconds. If you just transferred, please wait a moment and tap verify again.');
        await fetchWalletData();
      }
    } catch (err) {
      setVaVerifyStatus('Network check error. Please check your connection.');
    } finally {
      setRefreshing(false);
    }
  };

  // ── CORE DATA FETCHING & LEDGER RECONCILIATION ──
  const fetchWalletData = useCallback(async () => {
    let resolvedUserId = activeUserId;
    let resolvedEmail = currentUser?.email;
    let resolvedPhone = currentUser?.phone;

    // Fast fallback if state not hydrated yet on refresh
    if (!resolvedUserId) {
      try {
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user) {
          resolvedUserId = authData.user.id;
          resolvedEmail = authData.user.email;
          resolvedPhone = authData.user.phone || authData.user.user_metadata?.phone_number;
        }
      } catch (_) {}
    }

    if (!resolvedUserId) {
      try {
        const cached = localStorage.getItem('auth_user') || localStorage.getItem('@abumafhal_user_v1');
        if (cached) {
          const u = JSON.parse(cached);
          resolvedUserId = u?.id || u?.uid;
          resolvedEmail = u?.email;
          resolvedPhone = u?.phone;
        }
      } catch (_) {}
    }

    if (!resolvedUserId) {
      setNotLoggedIn(true);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setNotLoggedIn(false);

    try {
      // 0. Auto-sync with Flutterwave deposits
      try {
        await fetch('/api/sync-flutterwave-deposits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: resolvedUserId,
            email: resolvedEmail,
            phone: resolvedPhone
          })
        });
      } catch (syncErr) {
        console.warn('Sync deposits error:', syncErr);
      }

      // 1. Fetch user balance and persistent virtual account from profiles table
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, balance, email, full_name, phone, custom_id')
        .eq('id', resolvedUserId)
        .maybeSingle();

      // Load persistent virtual account from profile if available
      if (profile?.custom_id) {
        try {
          const parsed = JSON.parse(profile.custom_id);
          if (parsed?.account_number && !parsed.account_number.startsWith('980')) {
            setUserVirtualAccount(parsed);
            if (typeof window !== 'undefined') {
              localStorage.setItem(`@abumafhal_va_${resolvedUserId}`, JSON.stringify(parsed));
            }
          }
        } catch (_) {}
      }

      const checkEmail = (resolvedEmail || profile?.email || '').toLowerCase().trim();
      if (FOUNDER_EMAILS.includes(checkEmail)) {
        const permanentVA = {
          account_number: '9187255635',
          account_name: 'Abu Mafhal / Muhammad Sani',
          bank_name: 'Flutterwave MFB (Formerly OK MFB)',
          provider: 'flutterwave',
          is_permanent: true
        };
        setUserVirtualAccount(permanentVA);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`@abumafhal_va_${resolvedUserId}`, JSON.stringify(permanentVA));
        }
      }

      // 2. Fetch transactions from transactions table
      const { data: txData, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', resolvedUserId)
        .order('created_at', { ascending: false })
        .limit(60);

      if (!txError && txData) {
        setTransactions(txData);

        // Calculate verified ledger balance to guarantee 100% precision
        const totalCredits = txData
          .filter(t => (t.type === 'topup' || t.type === 'credit' || t.type === 'deposit') && (t.status === 'completed' || t.status === 'successful'))
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const totalDebits = txData
          .filter(t => (t.type === 'withdrawal' || t.type === 'debit' || t.type === 'wallet_payment' || t.type === 'wallet_purchase') && (t.status === 'completed' || t.status === 'successful'))
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

        const ledgerBal = Math.max(0, totalCredits - totalDebits);
        const profileBal = Number(profile?.balance || 0);
        const effectiveBal = Math.max(profileBal, ledgerBal);

        setBalance(effectiveBal);

        // Self-heal DB balance if it lagged behind the transaction ledger
        if (effectiveBal > profileBal && resolvedUserId) {
          await supabase.from('profiles').update({ balance: effectiveBal }).eq('id', resolvedUserId);
        }
      } else if (profile) {
        setBalance(Number(profile.balance || 0));
      }
    } catch (err) {
      console.error('Error fetching wallet data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeUserId, currentUser]);

  useEffect(() => {
    fetchWalletData();
  }, [fetchWalletData]);

  // ── AUTOMATIC REDIRECT URL PAYMENT VERIFICATION (PAYSTACK & FLUTTERWAVE) ──
  useEffect(() => {
    const verifyPaymentReturn = async () => {
      if (typeof window === 'undefined') return;
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const paystackRef = searchParams.get('reference') || searchParams.get('trxref');
        const flwRef = searchParams.get('tx_ref') || searchParams.get('transaction_id');
        const paymentStatus = searchParams.get('status');

        if (paystackRef) {
          setVerifyingBanner(`⏳ Verifying your deposit with Paystack (${paystackRef})...`);
          
          // Clean URL immediately so refresh won't duplicate
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);

          const { data: authData } = await supabase.auth.getUser();
          const targetUid = activeUserId || authData?.user?.id;

          if (targetUid) {
            // Get session token for edge function Bearer auth
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

            const res = await fetch('https://ejqymvjrfqqljzjlwcin.supabase.co/functions/v1/verify-paystack-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                reference: paystackRef,
                action: 'wallet_topup',
                user_id: targetUid
              })
            });

            const result = await res.json();
            if (result?.success) {
              setVerifyingBanner('');
              setCelebrationData({
                amount: result.amount,
                reference: paystackRef,
                gateway: 'Paystack Card & Online Pay'
              });
              await fetchWalletData();
            } else {
              setVerifyingBanner(`Notice: ${result?.error || 'Deposit processed. Refreshing ledger...'}`);
              setTimeout(() => setVerifyingBanner(''), 6000);
              await fetchWalletData();
            }
          }
        } else if (flwRef || paymentStatus === 'successful') {
          setVerifyingBanner(`⏳ Verifying Flutterwave deposit...`);
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);

          const syncRes = await fetch('/api/sync-flutterwave-deposits', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user_id: activeUserId,
              email: currentUser?.email,
              phone: currentUser?.phone,
              reference: flwRef,
              tx_ref: flwRef
            })
          });
          const syncJson = await syncRes.json();
          setVerifyingBanner('');
          if (syncJson?.success && (syncJson.total_credited > 0 || syncJson.credited_amount > 0)) {
            setCelebrationData({
              amount: syncJson.total_credited || syncJson.credited_amount,
              reference: flwRef || syncJson.reference || 'FLW-PAY',
              gateway: 'Flutterwave Online Recharge'
            });
          }
          await fetchWalletData();
        }
      } catch (err) {
        console.warn('URL payment verification check:', err);
        setVerifyingBanner('');
      }
    };

    if (activeUserId) {
      verifyPaymentReturn();
    }
  }, [activeUserId]);

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
      const callbackUrl = window.location.href.split('?')[0];

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

  // ── MANUAL REFERENCE RECONCILIATION ──
  const handleManualReconciliation = async (e) => {
    e.preventDefault();
    if (!manualRefInput.trim()) return;
    setManualVerifyLoading(true);
    setManualVerifyMsg(null);

    const cleanRef = manualRefInput.trim();
    try {
      // 1. Try Paystack verification
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

      const res = await fetch('https://ejqymvjrfqqljzjlwcin.supabase.co/functions/v1/verify-paystack-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reference: cleanRef,
          action: 'wallet_topup',
          user_id: activeUserId
        })
      });
      const data = await res.json();

      if (data?.success) {
        setManualVerifyMsg({ success: true, text: `🎉 Verified! ₦${(data.amount || 0).toLocaleString()} credited to your balance!` });
        await fetchWalletData();
        return;
      }

      // 2. Try Flutterwave verification
      const flwRes = await fetch('/api/sync-flutterwave-deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: activeUserId,
          email: currentUser?.email,
          phone: currentUser?.phone,
          reference: cleanRef,
          tx_ref: cleanRef
        })
      });
      const flwJson = await flwRes.json();
      if (flwJson?.success && (flwJson.total_credited > 0 || flwJson.credited_amount > 0)) {
        setManualVerifyMsg({ success: true, text: `🎉 Flutterwave payment verified! ₦${(flwJson.total_credited || flwJson.credited_amount).toLocaleString()} credited!` });
        await fetchWalletData();
      } else {
        setManualVerifyMsg({ success: false, text: data?.error || flwJson?.error || 'Reference could not be verified. Please check reference code or contact support.' });
      }
    } catch (err) {
      setManualVerifyMsg({ success: false, text: err.message || 'Verification connection failed' });
    } finally {
      setManualVerifyLoading(false);
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
        <p className="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-400">Loading your wallet balance...</p>
      </div>
    );
  }

  if (notLoggedIn && !loading) {
    return (
      <div className="max-w-xl mx-auto my-14 p-8 bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center">
          <WalletIcon className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Da Fatan Ka Shiga Asusunka</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Kuna buƙatar shiga asusunku (Login) domin duba kuɗin aljihunku (Wallet Balance), asusun bankin ajiya, da tarihin hada-hadarku.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/login?redirect=/wallet"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-colors"
          >
            Shiga Ciki (Login)
          </a>
          <button
            onClick={() => { setLoading(true); fetchWalletData(); }}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm transition-colors"
          >
            Sake Gwada Dubawa (Refresh)
          </button>
        </div>
      </div>
    );
  }

  const userAccountNum = userVirtualAccount?.account_number || '9187255635';
  const userBankName = userVirtualAccount?.bank_name || 'Flutterwave MFB (Formerly OK MFB)';
  const userAccountName = userVirtualAccount?.account_name || 'Abu Mafhal / Muhammad Sani';

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 font-sans">
      
      {/* ── REAL-TIME VERIFYING NOTIFICATION BANNER ── */}
      {verifyingBanner && (
        <div className="rounded-2xl p-4 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-emerald-800 dark:text-emerald-300 animate-pulse">
          <div className="flex items-center gap-2.5 text-sm font-bold">
            <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />
            <span>{verifyingBanner}</span>
          </div>
          <button 
            onClick={() => setVerifyingBanner('')} 
            className="p-1 hover:bg-emerald-500/20 rounded-lg text-emerald-700 dark:text-emerald-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              My Wallet
            </h1>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              100% Escrow Protected
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Real-time balance, instant online recharge, and dedicated automated bank deposits
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setShowVerifyRefModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <Receipt className="w-3.5 h-3.5 text-indigo-500" />
            Verify Reference
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border border-slate-200 dark:border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-600' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh Balance'}
          </button>
        </div>
      </div>

      {/* ── LUXURY BALANCE & VIRTUAL ACCOUNT CARDS GRID ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Available Balance Card (Modernized & Withdraw completely removed) */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white p-6 sm:p-8 shadow-2xl border border-slate-800/80">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-emerald-500/15 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Available Cash Balance
                </span>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setHideBalance(!hideBalance)}
                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors text-xs flex items-center gap-1"
                    title={hideBalance ? "Show balance" : "Hide balance"}
                  >
                    {hideBalance ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <span className="text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold">
                    Instant Settlement
                  </span>
                </div>
              </div>

              {/* Balance Typography */}
              <div className="mt-4">
                <p className="text-3xl sm:text-5xl font-black tracking-tight font-mono text-white">
                  {hideBalance ? '••••••••' : formatCurrency(balance)}
                </p>
                {!hideBalance && (
                  <p className="text-xs font-semibold text-slate-400 mt-1.5 flex items-center gap-2">
                    <span>≈ ${(balance / USD_RATE).toFixed(2)} USD</span>
                    <span>•</span>
                    <span className="text-emerald-400">100% Escrow Protected</span>
                  </p>
                )}
              </div>
            </div>

            {/* Smart Chip & Two Prominent Action Buttons (NO WITHDRAW!) */}
            <div className="pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <button
                  onClick={() => setShowTopUpModal(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 transition-all transform active:scale-95 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Add Cash (Online)
                </button>

                <button
                  onClick={() => setShowBankTransferModal(true)}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm backdrop-blur-md border border-white/15 shadow-md transition-all transform active:scale-95 cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-emerald-300" />
                  Dedicated Bank Transfer
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Virtual Bank Card */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Personal Bank NUBAN
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                AUTO-CREDIT
              </span>
            </div>

            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {userBankName}
            </p>

            {/* Account Number Box (Ultra-Clean & Modern) */}
            <div className="mt-3.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Account Number</p>
                <p className="text-2xl font-black font-mono tracking-widest text-blue-600 dark:text-blue-400 mt-0.5">
                  {userAccountNum}
                </p>
              </div>
              <button
                onClick={() => handleCopy(userAccountNum, 'acc')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 text-xs font-black hover:bg-blue-100 transition-colors cursor-pointer"
              >
                {copiedField === 'acc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedField === 'acc' ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="mt-3 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <p className="truncate">
                Beneficiary: <span className="font-bold text-slate-900 dark:text-white">{userAccountName}</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Deposit reflects automatically within 30-90 seconds.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between text-xs">
            <button
              onClick={handleVerifyTransfer}
              disabled={refreshing}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              Verify Deposit
            </button>

            <button
              onClick={() => setShowBankTransferModal(true)}
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
            >
              View Instructions ➔
            </button>
          </div>
        </div>
      </div>

      {/* ── TRANSACTIONS SECTION ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        {/* Section Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              Transaction History
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                ({filteredTransactions.length} records)
              </span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live ledger of deposits, top-ups, and wallet order payments
            </p>
          </div>

          {/* Filter Pills & Modern Search Input */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions..."
                className="pl-9 pr-3.5 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48 sm:w-60 font-medium"
              />
            </div>

            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  filterType === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterType('credit')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  filterType === 'credit'
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Deposits (+)
              </button>
              <button
                onClick={() => setFilterType('debit')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  filterType === 'debit'
                    ? 'bg-white dark:bg-slate-900 text-red-600 dark:text-red-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Payments (-)
              </button>
            </div>
          </div>
        </div>

        {/* Transactions List */}
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-16 px-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3">
              <Clock className="w-7 h-7" />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">No transactions found</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery ? 'No activities matched your search criteria.' : 'Your deposit and payment activity will appear here in real-time.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredTransactions.map((tx) => {
              const isCredit = tx.type === 'credit' || tx.type === 'topup' || tx.type === 'deposit';
              return (
                <div
                  key={tx.id}
                  className="p-4 sm:p-5 flex items-center justify-between hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center space-x-3.5 sm:space-x-4">
                    <div
                      className={`w-10 h-10 sm:w-11 sm:h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                        isCredit
                          ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isCredit ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {tx.description || (isCredit ? 'Wallet Top-up' : 'Order Payment')}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
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
                      className={`text-sm sm:text-base font-black font-mono ${
                        isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    <span
                      className={`inline-block text-[10px] font-black px-2.5 py-0.5 rounded-full mt-0.5 ${
                        tx.status === 'completed' || tx.status === 'success'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
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
          MODAL 1: ULTRA-MODERN TOP-UP MODAL (CARD & ONLINE GATEWAY)
      ══════════════════════════════════════════════════════════════ */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
            <button
              onClick={() => setShowTopUpModal(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-6">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Top-up Wallet (Online)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Instant recharge via ATM Card, USSD, Apple Pay, or Bank App
              </p>
            </div>

            <form onSubmit={handleStartTopUp} className="space-y-5">
              {/* Ultra-Modern Clean Amount Input (NO WEIRD WRAPPERS/TURBANS) */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Enter Recharge Amount
                </label>
                
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3.5 focus-within:ring-4 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all flex items-center">
                  <div className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-sm mr-3">
                    ₦ NGN
                  </div>
                  <input
                    type="number"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    placeholder="5000"
                    min="100"
                    className="w-full bg-transparent text-2xl sm:text-3xl font-black font-mono text-slate-900 dark:text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              {/* Preset Chips */}
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Preset Quick Amounts</p>
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTopUpAmount(String(amt))}
                      className={`py-2.5 px-3 text-xs font-black rounded-xl border transition-all cursor-pointer ${
                        topUpAmount === String(amt)
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-300 shadow-sm'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Balance Projection */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300 font-medium">Projected Balance:</span>
                <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                  {formatCurrency((balance || 0) + Number(topUpAmount || 0))}
                </span>
              </div>

              {/* Gateway Selection */}
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Choose Payment Gateway
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setTopUpGateway('paystack')}
                    className={`p-4 rounded-2xl border cursor-pointer flex flex-col justify-between transition-all ${
                      topUpGateway === 'paystack'
                        ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 ring-2 ring-blue-500 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black text-sm text-slate-900 dark:text-white">Paystack</span>
                      <CreditCard className="w-4 h-4 text-blue-500" />
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Cards, USSD, Apple Pay</span>
                  </div>

                  <div
                    onClick={() => setTopUpGateway('flutterwave')}
                    className={`p-4 rounded-2xl border cursor-pointer flex flex-col justify-between transition-all ${
                      topUpGateway === 'flutterwave'
                        ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/30 ring-2 ring-amber-500 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-black text-sm text-slate-900 dark:text-white">Flutterwave</span>
                      <CreditCard className="w-4 h-4 text-amber-500" />
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Mastercard, Visa, Verve</span>
                  </div>
                </div>
              </div>

              {topUpError && (
                <div className="p-3.5 rounded-xl bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{topUpError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={topUpLoading}
                className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-600/30 flex items-center justify-center gap-2 disabled:opacity-70 transition-all cursor-pointer"
              >
                {topUpLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting to Gateway...</span>
                  </>
                ) : (
                  <>
                    <span>Proceed to Recharge ₦{Number(topUpAmount || 0).toLocaleString()}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowTopUpModal(false);
                    setShowBankTransferModal(true);
                  }}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center justify-center gap-1 mx-auto cursor-pointer"
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
          MODAL 2: DEDICATED BANK TRANSFER MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showBankTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
            <button
              onClick={() => {
                setShowBankTransferModal(false);
                setVaVerifyStatus('');
              }}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                Dedicated Bank Transfer
                <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 rounded-full">
                  PERSONAL NUBAN
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Transfer any amount from your banking app. Your wallet balance is automatically credited.
              </p>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl p-5 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-blue-950/40 border border-blue-100 dark:border-blue-900/40">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-black text-blue-800 dark:text-blue-300 uppercase tracking-wider">
                      Bank Name
                    </div>
                    <div className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {userBankName}
                    </div>
                  </div>
                  <span className="text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 px-2.5 py-1 rounded-full">
                    ACTIVE NUBAN
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between bg-white dark:bg-slate-900 p-4 rounded-xl border border-blue-200 dark:border-slate-700">
                  <div>
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Account Number</span>
                    <p className="text-2xl font-black font-mono tracking-widest text-blue-600 dark:text-blue-400">
                      {userAccountNum}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCopy(userAccountNum, 'modal_acc')}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-500 shadow-md transition-all cursor-pointer"
                  >
                    {copiedField === 'modal_acc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedField === 'modal_acc' ? 'Copied!' : 'Copy'}
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Account Name:</span>
                  <span className="font-bold text-slate-900 dark:text-white truncate max-w-[240px]">
                    {userAccountName}
                  </span>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Open your bank app (OPay, Kuda, PalmPay, Moniepoint, GTBank, Zenith, Access, etc.) and transfer any desired amount to the account above. Your Abu Mafhal wallet balance updates automatically.
              </div>

              {vaVerifyStatus && (
                <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                  vaVerifyStatus.includes('🎉') 
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border border-amber-200'
                }`}>
                  {vaVerifyStatus.includes('🎉') ? (
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span>{vaVerifyStatus}</span>
                </div>
              )}

              {/* Refresh Balance Action */}
              <button
                type="button"
                onClick={handleVerifyTransfer}
                disabled={refreshing}
                className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Checking confirmation with bank...' : '🔄 I Have Transferred • Verify Deposit'}</span>
              </button>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setShowVerifyRefModal(true)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
                >
                  Enter Ref Code Manually
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowBankTransferModal(false);
                    setShowTopUpModal(true);
                  }}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Pay with Card ➔
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 3: MANUAL REFERENCE VERIFICATION MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showVerifyRefModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
            <button
              onClick={() => {
                setShowVerifyRefModal(false);
                setManualVerifyMsg(null);
              }}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-5 h-5 text-indigo-500" />
                Verify Payment Reference
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter your transaction reference from Paystack or Flutterwave receipt to reconcile your balance immediately.
              </p>
            </div>

            <form onSubmit={handleManualReconciliation} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Transaction Reference
                </label>
                <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3.5 focus-within:ring-4 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                  <input
                    type="text"
                    value={manualRefInput}
                    onChange={(e) => setManualRefInput(e.target.value)}
                    placeholder="e.g. WLT-PAY-123456789 or FLW-123456"
                    className="w-full bg-transparent text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              {manualVerifyMsg && (
                <div className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
                  manualVerifyMsg.success 
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200' 
                    : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 border border-red-200'
                }`}>
                  {manualVerifyMsg.success ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  <span>{manualVerifyMsg.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={manualVerifyLoading}
                className="w-full py-3.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-70 transition-all cursor-pointer"
              >
                {manualVerifyLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying with Gateway...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Reconcile & Credit Balance</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 4: CELEBRATION DEPOSIT SUCCESS MODAL
      ══════════════════════════════════════════════════════════════ */}
      {celebrationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-sm w-full p-7 shadow-2xl border border-slate-100 dark:border-slate-800 text-center relative">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-950/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <h3 className="text-xl font-black text-slate-900 dark:text-white">Deposit Confirmed!</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Funds have been credited directly to your Abu Mafhal wallet balance.
            </p>

            <div className="my-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Amount Credited</span>
              <p className="text-3xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                +{formatCurrency(celebrationData.amount)}
              </p>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>Via {celebrationData.gateway}</span>
              </div>
            </div>

            <button
              onClick={() => setCelebrationData(null)}
              className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 font-black text-sm shadow-md transition-colors cursor-pointer"
            >
              Continue to Wallet
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Wallet;