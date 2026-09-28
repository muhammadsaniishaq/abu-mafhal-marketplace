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

const USD_RATE = 1500; // Benchmark ₦1,500 = $1.00 USD

const GATEWAYS = [
  {
    id: 'paystack',
    name: 'Paystack Checkout',
    subtitle: 'Debit/Credit Cards · USSD · Bank Transfer · Apple Pay',
    badge: 'AUTO-VERIFY',
    badgeColor: '#0284C7',
    badgeBg: '#F0F9FF',
    badgeBorder: '#BAE6FD',
    color: '#0284C7',
    speed: 'Instant (10-30s)',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSzFzmpCa0Tav9NttiYF10t9wftJPQ0XYPBkA&s',
    channels: ['Debit Card', 'USSD', 'Bank', 'Apple Pay']
  },
  {
    id: 'flutterwave',
    name: 'Flutterwave Africa',
    subtitle: 'Cards · Direct Bank · Mobile Money · Pan-Africa',
    badge: 'PAN-AFRICA',
    badgeColor: '#D97706',
    badgeBg: '#FFFBEB',
    badgeBorder: '#FDE68A',
    color: '#D97706',
    speed: 'Instant (15-45s)',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-W6MLvD_saE20EDSZzVPspKqcKxZ89rW8uw&s',
    channels: ['Mastercard', 'Visa', 'Mobile Money', 'Bank']
  },
  {
    id: 'nowpayments',
    name: 'NOWPayments Crypto',
    subtitle: 'USDT · BTC · ETH · SOL · BNB · 150+ Cryptos',
    badge: 'WEB3 CRYPTO',
    badgeColor: '#2563EB',
    badgeBg: '#EFF6FF',
    badgeBorder: '#BFDBFE',
    color: '#2563EB',
    isCrypto: true,
    speed: '1-3 Confirmations',
    logo: 'https://cdn.brandfetch.io/id_rL36n5a/w/400/h/400/logo.png',
    channels: ['USDT (TRC20)', 'Bitcoin', 'Ethereum', 'Solana', 'BNB']
  },
  {
    id: 'bank_transfer',
    name: 'Dedicated Bank Account',
    subtitle: 'Permanent Personal NUBAN · Paystack / Wema Verified',
    badge: '0% FEE · NUBAN',
    badgeColor: '#059669',
    badgeBg: '#ECFDF5',
    badgeBorder: '#A7F3D0',
    color: '#059669',
    speed: 'Auto-Credit in 30-60s',
    logo: 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',
    channels: ['OPay', 'Kuda', 'PalmPay', 'GTBank', 'Zenith', 'Access']
  }
];

const Wallet = () => {
  const { currentUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  const [hideBalance, setHideBalance] = useState(false);

  // Modals state
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
  const [vaError, setVaError] = useState('');
  const [vaVerifyStatus, setVaVerifyStatus] = useState('');

  // BVN & Dedicated Virtual Account Activation (Paystack Verified)
  const [bvnInput, setBvnInput] = useState('');
  const [bvnLegalName, setBvnLegalName] = useState('');
  const [bvnPhone, setBvnPhone] = useState('');
  const [bvnVerifying, setBvnVerifying] = useState(false);
  const [showBvnForm, setShowBvnForm] = useState(false);

  // Top-up states (No mock amounts)
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpAmountUsd, setTopUpAmountUsd] = useState('');
  const [topUpGateway, setTopUpGateway] = useState('paystack');
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

  // Auto-fetch dedicated virtual account if exists in DB or generate
  useEffect(() => {
    if (activeUserId && !userVirtualAccount && !isGeneratingVa) {
      handleFetchExistingAccount();
    }
  }, [activeUserId, userVirtualAccount]);

  const handleFetchExistingAccount = async () => {
    if (!activeUserId) return;
    setIsGeneratingVa(true);
    setVaError('');
    try {
      const res = await fetch('/api/create-virtual-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: activeUserId,
          email: currentUser?.email,
          name: currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0],
          phone: currentUser?.phone
        })
      });
      const json = await res.json();
      if (json?.success && json?.data?.account_number && !json.data.account_number.startsWith('980')) {
        setUserVirtualAccount(json.data);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`@abumafhal_va_${activeUserId}`, JSON.stringify(json.data));
        }
      }
    } catch (err) {
      console.log('Account fetch notice:', err.message);
    } finally {
      setIsGeneratingVa(false);
    }
  };

  // Paystack BVN Verification and Dedicated Account Generation
  const handleVerifyBvnAndGenerateAccount = async (e) => {
    if (e) e.preventDefault();
    const cleanBvn = String(bvnInput || '').trim().replace(/[^0-9]/g, '');
    if (cleanBvn.length !== 11) {
      setVaError('Please enter your valid 11-digit Bank Verification Number.');
      return;
    }
    const nameToUse = (bvnLegalName.trim() || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || '').trim();
    if (!nameToUse) {
      setVaError('Please enter your full legal name as registered on your BVN.');
      return;
    }

    setBvnVerifying(true);
    setVaError('');
    try {
      const email = currentUser?.email || `wallet_${activeUserId.substring(0, 6)}@abumafhal.com`;
      const phone = bvnPhone.trim() || currentUser?.phone || currentUser?.user_metadata?.phone_number || '';

      const res = await fetch('/api/create-virtual-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: activeUserId,
          email,
          name: nameToUse,
          phone,
          bvn: cleanBvn,
          force_refresh: true
        })
      });

      const json = await res.json();
      if (json?.success && json?.data?.account_number) {
        setUserVirtualAccount(json.data);
        setShowBvnForm(false);
        if (typeof window !== 'undefined') {
          localStorage.setItem(`@abumafhal_va_${activeUserId}`, JSON.stringify(json.data));
        }
        setVaVerifyStatus(`🎉 Permanent Paystack-verified dedicated account activated at ${json.data.bank_name}!`);
      } else {
        setVaError(json?.error || 'Verification failed. Please verify your BVN and name.');
      }
    } catch (err) {
      setVaError(err.message || 'Error communicating with verification service');
    } finally {
      setBvnVerifying(false);
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

  // ── INITIATE ONLINE TOP-UP (PAYSTACK / FLUTTERWAVE / NOWPAYMENTS / DVA) ──
  const handleStartTopUp = async (e) => {
    e.preventDefault();
    setTopUpError('');

    if (topUpGateway === 'bank_transfer') {
      if (userVirtualAccount?.account_number && !userVirtualAccount.account_number.startsWith('980')) {
        setShowTopUpModal(false);
        setShowBankTransferModal(true);
      } else {
        setShowTopUpModal(false);
        setShowBvnForm(true);
      }
      return;
    }

    let amt = 0;
    if (topUpGateway === 'nowpayments') {
      const usd = parseFloat(String(topUpAmountUsd || '').replace(/[^0-9.]/g, ''));
      if (isNaN(usd) || usd < 2) {
        setTopUpError('Minimum top-up for crypto is $2.00 USD');
        return;
      }
      amt = Math.round(usd * USD_RATE);
    } else {
      amt = Number(String(topUpAmount || '').replace(/[^0-9.]/g, ''));
      if (isNaN(amt) || amt < 100) {
        setTopUpError('Please enter a valid amount of at least ₦100');
        return;
      }
    }

    setTopUpLoading(true);
    try {
      const ref = `WLT-${topUpGateway.toUpperCase().slice(0, 3)}-${Date.now()}`;
      const userEmail = currentUser?.email || `wallet_${activeUserId.substring(0, 6)}@abumafhal.com`;
      const callbackUrl = window.location.href.split('?')[0];

      if (topUpGateway === 'nowpayments') {
        const res = await supabase.functions.invoke('nowpayments-initiate', {
          body: {
            amount: parseFloat(topUpAmountUsd),
            currency: 'usd',
            email: userEmail,
            reference: ref,
            metadata: { action: 'wallet_topup', user_id: activeUserId, credited_ngn: amt }
          }
        });
        const payUrl = res?.data?.invoice_url || res?.data?.payment_url;
        if (payUrl) {
          window.location.href = payUrl;
          return;
        }
        throw new Error(res?.data?.message || res?.error?.message || 'Failed to initialize NOWPayments');
      } else if (topUpGateway === 'flutterwave') {
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
      } else {
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
        <h2 className="text-2xl font-black text-slate-900 dark:text-white">Please Sign In to Access Your Wallet</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          You need to be signed in to your Abu Mafhal account to view your balance, dedicated virtual bank accounts, and transaction records.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/login?redirect=/wallet"
            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition-colors"
          >
            Sign In / Register
          </a>
          <button
            onClick={() => { setLoading(true); fetchWalletData(); }}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-sm transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }

  const userAccountNum = userVirtualAccount?.account_number;
  const userBankName = userVirtualAccount?.bank_name;
  const userAccountName = userVirtualAccount?.account_name;

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
        {/* Available Balance Card */}
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

            {/* Smart Action Buttons */}
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
                  onClick={() => {
                    if (userAccountNum) {
                      setShowBankTransferModal(true);
                    } else {
                      setShowBvnForm(true);
                    }
                  }}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm backdrop-blur-md border border-white/15 shadow-md transition-all transform active:scale-95 cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-emerald-300" />
                  Dedicated Bank Transfer
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Virtual Bank Card (Paystack Verified) */}
        <div className="rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-xl border border-slate-100 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                Personal Bank NUBAN
              </span>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                PAYSTACK VERIFIED
              </span>
            </div>

            {userAccountNum && !userAccountNum.startsWith('980') ? (
              <>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {userBankName || 'Wema Bank (ALAT) / Dedicated NUBAN'}
                </p>

                {/* Account Number Box */}
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
                    Beneficiary: <span className="font-bold text-slate-900 dark:text-white">{userAccountName || currentUser?.user_metadata?.full_name || 'Verified Member'}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    0% Deposit Fee · Funds credit automatically within 30 seconds.
                  </p>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Activate Dedicated Bank Account
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Verify your BVN to instantly generate a permanent Nigerian bank account in your name with 0% deposit fees and automatic wallet credit.
                </p>

                <button
                  onClick={() => setShowBvnForm(!showBvnForm)}
                  className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{showBvnForm ? 'Hide BVN Form' : 'Verify BVN & Activate NUBAN'}</span>
                </button>

                {showBvnForm && (
                  <form onSubmit={handleVerifyBvnAndGenerateAccount} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                        11-Digit BVN
                      </label>
                      <input
                        type="text"
                        maxLength={11}
                        value={bvnInput}
                        onChange={(e) => setBvnInput(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="11-digit BVN"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">Dial *565*0# on registered SIM to check BVN</p>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase">
                        Full Legal Name (as on BVN)
                      </label>
                      <input
                        type="text"
                        value={bvnLegalName}
                        onChange={(e) => setBvnLegalName(e.target.value)}
                        placeholder="Legal full name"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
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
                        placeholder="Phone number"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {vaError && (
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold">{vaError}</p>
                    )}

                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                      <Lock className="w-3 h-3" />
                      <span>256-Bit SSL Encrypted · Paystack Identity Verification</span>
                    </div>

                    <button
                      type="submit"
                      disabled={bvnVerifying || bvnInput.length !== 11}
                      className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {bvnVerifying ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying with Paystack...</span>
                        </>
                      ) : (
                        <span>Verify with Paystack & Issue Account</span>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
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
              onClick={() => {
                if (userAccountNum) {
                  setShowBankTransferModal(true);
                } else {
                  setShowBvnForm(true);
                }
              }}
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
            >
              {userAccountNum ? 'View Instructions ➔' : 'Activate Account ➔'}
            </button>
          </div>
        </div>
      </div>

      {/* ── OFFICIAL PAYMENT GATEWAYS SHOWCASE ── */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              Supported Payment & Top-Up Gateways
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Zero hidden fees, instant auto-recharge, and bank-grade encryption
            </p>
          </div>
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 self-start sm:self-auto">
            4 Live Payment Channels
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {GATEWAYS.map((gw) => (
            <div
              key={gw.id}
              onClick={() => {
                setTopUpGateway(gw.id);
                if (gw.id === 'bank_transfer') {
                  if (userAccountNum) {
                    setShowBankTransferModal(true);
                  } else {
                    setShowBvnForm(true);
                  }
                } else {
                  setShowTopUpModal(true);
                }
              }}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer bg-slate-50/50 dark:bg-slate-850/50 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <img
                    src={gw.logo}
                    alt={gw.name}
                    className="w-9 h-9 rounded-xl object-contain bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 shadow-sm"
                  />
                  <span
                    style={{ color: gw.badgeColor, backgroundColor: gw.badgeBg, borderColor: gw.badgeBorder }}
                    className="text-[9px] font-black px-2 py-0.5 rounded-full border"
                  >
                    {gw.badge}
                  </span>
                </div>

                <h4 className="text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  {gw.name}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {gw.subtitle}
                </p>

                <div className="flex flex-wrap gap-1 mt-3">
                  {gw.channels.slice(0, 3).map((ch, idx) => (
                    <span
                      key={idx}
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{gw.speed}</span>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Pay Now ➔
                </span>
              </div>
            </div>
          ))}
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
          MODAL 1: ULTRA-MODERN TOP-UP MODAL (ALL 4 GATEWAYS WITH LOGOS)
      ══════════════════════════════════════════════════════════════ */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
            <button
              onClick={() => setShowTopUpModal(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="mb-5">
              <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>Top Up Wallet</span>
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  INSTANT
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Choose your preferred payment method to fund your Abu Mafhal wallet balance.
              </p>
            </div>

            {/* Gateway Selection Grid */}
            <div className="space-y-2.5 mb-5">
              <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Select Payment Gateway
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {GATEWAYS.map((gw) => {
                  const isSelected = topUpGateway === gw.id;
                  return (
                    <div
                      key={gw.id}
                      onClick={() => setTopUpGateway(gw.id)}
                      className={`p-3.5 rounded-2xl border cursor-pointer flex flex-col justify-between transition-all relative ${
                        isSelected
                          ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-2 ring-emerald-500 shadow-md'
                          : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={gw.logo}
                            alt={gw.name}
                            className="w-8 h-8 rounded-xl object-contain bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0"
                          />
                          <div>
                            <span className="font-black text-xs text-slate-900 dark:text-white block leading-tight">
                              {gw.name}
                            </span>
                            <span
                              style={{ color: gw.badgeColor, backgroundColor: gw.badgeBg, borderColor: gw.badgeBorder }}
                              className="inline-block text-[9px] font-black px-1.5 py-0.2 rounded border mt-0.5"
                            >
                              {gw.badge}
                            </span>
                          </div>
                        </div>

                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                          isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 dark:border-slate-600'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                        {gw.subtitle}
                      </p>

                      <div className="flex flex-wrap gap-1">
                        {gw.channels.slice(0, 3).map((ch, idx) => (
                          <span
                            key={idx}
                            className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gateway Specific Input & Action */}
            {topUpGateway === 'bank_transfer' ? (
              <div className="space-y-4">
                {userAccountNum && !userAccountNum.startsWith('980') ? (
                  <div className="rounded-2xl p-4 bg-gradient-to-br from-slate-900 to-slate-950 text-white border border-slate-800 shadow-lg">
                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                        {userBankName || 'WEMA BANK (ALAT)'}
                      </span>
                      <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/40">
                        PAYSTACK VERIFIED
                      </span>
                    </div>

                    <p className="text-[10px] text-slate-400 uppercase font-mono">Dedicated NUBAN Account</p>
                    <div className="flex items-center justify-between mt-1 mb-3">
                      <p className="text-2xl font-black font-mono tracking-widest text-emerald-400">
                        {userAccountNum}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleCopy(userAccountNum, 'topup_dva')}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 border border-white/20 transition-all cursor-pointer"
                      >
                        {copiedField === 'topup_dva' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedField === 'topup_dva' ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-slate-300">
                      <span>Beneficiary: <strong className="text-white">{userAccountName || 'Verified Member'}</strong></span>
                      <span className="text-[10px] text-emerald-400 font-bold">Auto-Credit in 30-60s</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs">
                    <p className="font-bold text-blue-900 dark:text-blue-300 mb-1">
                      Dedicated Account Not Yet Activated
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                      Verify your 11-digit BVN once with Paystack to generate your permanent personal NUBAN account.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowTopUpModal(false);
                        setShowBvnForm(true);
                      }}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Verify BVN to Activate Dedicated Account</span>
                    </button>
                  </div>
                )}

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                  💡 Transfer any amount from any Nigerian bank (OPay, Kuda, PalmPay, GTBank, Zenith, Access). Your wallet credits automatically with 0% fees.
                </div>

                <button
                  type="button"
                  onClick={handleVerifyTransfer}
                  disabled={refreshing}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>{refreshing ? 'Checking bank transfer...' : 'I Have Transferred • Verify Deposit'}</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleStartTopUp} className="space-y-4">
                {topUpGateway === 'nowpayments' ? (
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Enter Amount in USD ($)
                    </label>
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3.5 focus-within:ring-4 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all flex items-center">
                      <div className="px-3 py-1.5 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 font-black text-sm mr-3">
                        $ USD
                      </div>
                      <input
                        type="number"
                        step="any"
                        min="2"
                        value={topUpAmountUsd}
                        onChange={(e) => setTopUpAmountUsd(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-transparent text-2xl font-black font-mono text-slate-900 dark:text-white focus:outline-none"
                        required
                      />
                    </div>

                    {topUpAmountUsd && !isNaN(parseFloat(topUpAmountUsd)) && (
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-2">
                        ≈ ₦{Math.round(parseFloat(topUpAmountUsd) * USD_RATE).toLocaleString()} NGN credited to wallet (@ ₦{USD_RATE}/$)
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {['USDT (TRC20)', 'Bitcoin (BTC)', 'Ethereum (ETH)', 'Solana (SOL)', 'BNB'].map((c, i) => (
                        <span key={i} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Enter Recharge Amount (NGN)
                    </label>
                    
                    <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 p-3.5 focus-within:ring-4 focus-within:ring-emerald-500/20 focus-within:border-emerald-500 transition-all flex items-center">
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-black text-sm mr-3">
                        ₦ NGN
                      </div>
                      <input
                        type="number"
                        value={topUpAmount}
                        onChange={(e) => setTopUpAmount(e.target.value)}
                        placeholder="0.00"
                        min="100"
                        className="w-full bg-transparent text-2xl font-black font-mono text-slate-900 dark:text-white focus:outline-none"
                        required
                      />
                    </div>

                    {topUpAmount && Number(topUpAmount) > 0 && (
                      <div className="mt-2.5 p-3 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-300 font-medium">Projected Balance:</span>
                        <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatCurrency((balance || 0) + Number(topUpAmount || 0))}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {topUpError && (
                  <div className="p-3.5 rounded-xl bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{topUpError}</span>
                  </div>
                )}

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
                      <span>
                        {topUpGateway === 'nowpayments'
                          ? `Pay $${topUpAmountUsd || '0'} USD via Crypto`
                          : `Recharge ₦${Number(topUpAmount || 0).toLocaleString()} via ${topUpGateway === 'flutterwave' ? 'Flutterwave' : 'Paystack'}`}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL 2: DEDICATED BANK TRANSFER MODAL (PAYSTACK / NUBAN)
      ══════════════════════════════════════════════════════════════ */}
      {showBankTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl border border-slate-100 dark:border-slate-800 relative">
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
                Transfer any amount from any Nigerian bank app. Your wallet balance is automatically credited.
              </p>
            </div>

            {userAccountNum && !userAccountNum.startsWith('980') ? (
              <div className="space-y-4">
                <div className="rounded-2xl p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white border border-slate-800 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                        Bank Name
                      </div>
                      <div className="text-base font-bold text-white mt-0.5">
                        {userBankName || 'Wema Bank (ALAT)'}
                      </div>
                    </div>
                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-full border border-emerald-500/40">
                      PAYSTACK VERIFIED
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between bg-white/10 dark:bg-slate-800/80 p-4 rounded-xl border border-white/10">
                    <div>
                      <span className="text-[10px] uppercase font-mono text-slate-400 tracking-wider">Account Number</span>
                      <p className="text-2xl font-black font-mono tracking-widest text-emerald-400">
                        {userAccountNum}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(userAccountNum, 'modal_acc')}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-500 shadow-md transition-all cursor-pointer"
                    >
                      {copiedField === 'modal_acc' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedField === 'modal_acc' ? 'Copied!' : 'Copy'}
                    </button>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs">
                    <span className="text-slate-400">Account Name:</span>
                    <span className="font-bold text-white truncate max-w-[240px]">
                      {userAccountName || currentUser?.user_metadata?.full_name || 'Verified Member'}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Open your bank app (OPay, Kuda, PalmPay, Moniepoint, GTBank, Zenith, Access, etc.) and transfer any desired amount to the account above. Your Abu Mafhal wallet balance updates automatically in 30–60 seconds with 0% fees.
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

                <button
                  type="button"
                  onClick={handleVerifyTransfer}
                  disabled={refreshing}
                  className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>{refreshing ? 'Checking confirmation with bank...' : '🔄 I Have Transferred • Verify Deposit'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <div className="flex items-center gap-2 font-bold text-blue-900 dark:text-blue-300 mb-1">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Paystack BVN Verification Required</span>
                  </div>
                  Per CBN regulations, BVN verification is required once to generate your dedicated personal bank account for instant automated funding.
                </div>

                {vaError && (
                  <div className="p-3 rounded-xl bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{vaError}</span>
                  </div>
                )}

                <form onSubmit={handleVerifyBvnAndGenerateAccount} className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">
                        11-Digit BVN
                      </label>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">Dial *565*0# to check</span>
                    </div>
                    <input
                      type="text"
                      maxLength={11}
                      value={bvnInput}
                      onChange={(e) => setBvnInput(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="11-digit BVN"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Full Legal Name (as registered on BVN)
                    </label>
                    <input
                      type="text"
                      value={bvnLegalName}
                      onChange={(e) => setBvnLegalName(e.target.value)}
                      placeholder="Legal full name"
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={bvnPhone}
                      onChange={(e) => setBvnPhone(e.target.value)}
                      placeholder={currentUser?.phone || '08012345678'}
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                    <Lock className="w-3.5 h-3.5" />
                    <span>256-Bit SSL Encrypted · Verified directly with NIBSS & Paystack</span>
                  </div>

                  <button
                    type="submit"
                    disabled={bvnVerifying}
                    className="w-full py-3.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70"
                  >
                    {bvnVerifying ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Verifying BVN with Paystack...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Verify BVN & Generate Account</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
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
                Pay with Card / Crypto ➔
              </button>
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
                    placeholder="Transaction reference or session ID"
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