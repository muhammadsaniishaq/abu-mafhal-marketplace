import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const POPULAR_NIGERIAN_BANKS = [
  { name: 'OPay Digital Services', code: '999992' },
  { name: 'Palmpay', code: '999991' },
  { name: 'Flutterwave MFB', code: '090107' },
  { name: 'Kuda Microfinance Bank', code: '50211' },
  { name: 'Access Bank', code: '044' },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
  { name: 'Zenith Bank', code: '057' },
  { name: 'First Bank of Nigeria', code: '011' },
  { name: 'United Bank for Africa (UBA)', code: '033' },
  { name: 'Fidelity Bank', code: '070' },
  { name: 'Stanbic IBTC Bank', code: '221' },
  { name: 'Union Bank of Nigeria', code: '032' },
  { name: 'Sterling Bank', code: '232' },
  { name: 'Wema Bank (ALAT)', code: '035' },
  { name: 'Polaris Bank', code: '076' },
  { name: 'Jaiz Bank', code: '301' },
  { name: 'TAJ Bank', code: '302' },
  { name: 'Lotus Bank', code: '303' }
];

const GATEWAYS = [
  {
    id: 'paystack',
    name: 'Paystack Checkout',
    subtitle: 'Debit/Credit Cards · USSD · Bank Transfer · Apple Pay',
    badge: 'AUTO-VERIFY',
    badgeColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
    speed: 'Instant (10-30s)',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSzFzmpCa0Tav9NttiYF10t9wftJPQ0XYPBkA&s',
    channels: ['Debit Card', 'USSD', 'Bank', 'Apple Pay']
  },
  {
    id: 'flutterwave',
    name: 'Flutterwave Africa',
    subtitle: 'Cards · Direct Bank · Mobile Money · Pan-Africa',
    badge: 'PAN-AFRICA',
    badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    speed: 'Instant (15-45s)',
    logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-W6MLvD_saE20EDSZzVPspKqcKxZ89rW8uw&s',
    channels: ['Mastercard', 'Visa', 'Mobile Money', 'Bank']
  },
  {
    id: 'nowpayments',
    name: 'NOWPayments Crypto',
    subtitle: 'USDT · BTC · ETH · SOL · BNB · 150+ Cryptos',
    badge: 'WEB3 CRYPTO',
    badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    speed: '1-3 Confirmations',
    logo: 'https://cdn.brandfetch.io/id_rL36n5a/w/400/h/400/logo.png',
    channels: ['USDT (TRC20)', 'Bitcoin', 'Ethereum', 'Solana', 'BNB']
  },
  {
    id: 'bank_transfer',
    name: 'Dedicated Bank Account',
    subtitle: 'Permanent Personal NUBAN · Paystack / Wema Verified',
    badge: '0% FEE · NUBAN',
    badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    speed: 'Auto-Credit in 30-60s',
    logo: 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png',
    channels: ['OPay', 'Kuda', 'PalmPay', 'GTBank', 'Zenith', 'Access']
  }
];

const VendorWallet = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({
    balance: 0,
    totalEarnings: 0,
    pendingPayouts: 0,
    totalPayouts: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [earningsData, setEarningsData] = useState([]);

  // Dedicated Virtual Account & BVN state
  const [virtualAccount, setVirtualAccount] = useState(null);
  const [vaLoading, setVaLoading] = useState(false);
  const [vaError, setVaError] = useState('');
  const [showBvnModal, setShowBvnModal] = useState(false);
  const [bvnInput, setBvnInput] = useState('');
  const [bvnLegalName, setBvnLegalName] = useState('');
  const [bvnPhone, setBvnPhone] = useState('');
  const [bvnVerifying, setBvnVerifying] = useState(false);
  const [copiedVa, setCopiedVa] = useState(false);

  // Top Up has been removed for vendor wallet

  // Withdrawal Modal State
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('bank');
  const [bankDetails, setBankDetails] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    bankCode: '',
    accountType: 'savings'
  });
  const [saveBankToProfile, setSaveBankToProfile] = useState(true);
  const [savedBanks, setSavedBanks] = useState([]);
  const [resolvingAccount, setResolvingAccount] = useState(false);
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [payoutSuccessData, setPayoutSuccessData] = useState(null);

  // Escrow Orders
  const [escrowList, setEscrowList] = useState([]);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'escrow' | 'payouts' | 'ledger'

  useEffect(() => {
    fetchWalletData();
    loadSavedBanks();
    loadVirtualAccount();
  }, [currentUser]);

  // Load saved banks from localStorage
  const loadSavedBanks = () => {
    try {
      const vendorId = currentUser?.id || currentUser?.uid;
      if (!vendorId) return;
      const key = `@abumafhal_vendor_banks_${vendorId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedBanks(parsed);
          const def = parsed.find(b => b.is_default) || parsed[0];
          setBankDetails({
            accountName: def.account_name,
            accountNumber: def.account_number,
            bankName: def.bank_name,
            bankCode: def.bank_code || '',
            accountType: 'savings'
          });
        }
      }
    } catch (_) {}
  };

  const persistSavedBanks = (newBanks) => {
    try {
      const vendorId = currentUser?.id || currentUser?.uid;
      if (!vendorId) return;
      setSavedBanks(newBanks);
      localStorage.setItem(`@abumafhal_vendor_banks_${vendorId}`, JSON.stringify(newBanks));
    } catch (_) {}
  };

  const loadVirtualAccount = async () => {
    const vendorId = currentUser?.id || currentUser?.uid;
    if (!vendorId) return;
    try {
      const cached = localStorage.getItem(`@abumafhal_dedicated_va_${vendorId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.account_number && !parsed.account_number.startsWith('980')) {
          setVirtualAccount(parsed);
          return;
        }
      }
    } catch (_) {}

    setVaLoading(true);
    try {
      const email = currentUser?.email || `vendor_${String(vendorId).substring(0, 6)}@abumafhal.com`;
      const res = await fetch('/api/create-virtual-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: vendorId,
          email,
          name: currentUser?.name || currentUser?.full_name || 'Vendor Merchant',
          phone: currentUser?.phone || ''
        })
      });
      const json = await res.json();
      if (json?.success && json?.data?.account_number) {
        setVirtualAccount(json.data);
        localStorage.setItem(`@abumafhal_dedicated_va_${vendorId}`, JSON.stringify(json.data));
      }
    } catch (e) {
      console.log('Error loading virtual account:', e);
    } finally {
      setVaLoading(false);
    }
  };

  const handleVerifyBvn = async (e) => {
    e.preventDefault();
    const vendorId = currentUser?.id || currentUser?.uid;
    const cleanBvn = String(bvnInput || '').trim().replace(/[^0-9]/g, '');
    if (cleanBvn.length !== 11) {
      setVaError('Please enter a valid 11-digit BVN');
      return;
    }
    if (!bvnLegalName.trim()) {
      setVaError('Please enter your full legal name as registered on BVN');
      return;
    }
    setBvnVerifying(true);
    setVaError('');
    try {
      const email = currentUser?.email || `vendor_${String(vendorId).substring(0, 6)}@abumafhal.com`;
      const res = await fetch('/api/create-virtual-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: vendorId,
          email,
          name: bvnLegalName.trim(),
          phone: bvnPhone.trim() || currentUser?.phone || '',
          bvn: cleanBvn,
          force_refresh: true
        })
      });
      const json = await res.json();
      if (json?.success && json?.data?.account_number) {
        setVirtualAccount(json.data);
        localStorage.setItem(`@abumafhal_dedicated_va_${vendorId}`, JSON.stringify(json.data));
        setShowBvnModal(false);
      } else {
        setVaError(json?.error || 'Verification failed. Please verify your 11-digit BVN.');
      }
    } catch (err) {
      setVaError(err.message || 'Network error verifying BVN.');
    } finally {
      setBvnVerifying(false);
    }
  };

  // handleTopUpSubmit removed

  const fetchWalletData = async () => {
    try {
      const vendorId = currentUser?.id || currentUser?.uid;
      if (!vendorId) {
        setLoading(false);
        return;
      }

      // Fetch profile balance & transactions
      const [pRes, txRes, vpRes] = await Promise.allSettled([
        supabase.from('profiles').select('balance').eq('id', vendorId).maybeSingle(),
        supabase.from('transactions').select('*').eq('user_id', vendorId).order('created_at', { ascending: false }).limit(100),
        supabase.from('vendor_payouts').select('*').eq('vendor_id', vendorId).order('created_at', { ascending: false })
      ]);

      const profileBal = Number(pRes.status === 'fulfilled' ? pRes.value?.data?.balance : 0) || 0;
      const txData = txRes.status === 'fulfilled' && Array.isArray(txRes.value?.data) ? txRes.value.data : [];
      const vpData = vpRes.status === 'fulfilled' && Array.isArray(vpRes.value?.data) ? vpRes.value.data : [];

      let ledgerBal = 0;
      if (txData.length > 0) {
        const totalCredits = txData
          .filter(t => (t.type === 'topup' || t.type === 'credit' || t.type === 'deposit' || t.type === 'sale_credit') && (t.status === 'completed' || t.status === 'successful'))
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        const totalDebits = txData
          .filter(t => (t.type === 'withdrawal' || t.type === 'debit' || t.type === 'wallet_payment' || t.type === 'wallet_purchase' || t.type === 'payout') && (t.status === 'completed' || t.status === 'successful'))
          .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
        ledgerBal = Math.max(0, totalCredits - totalDebits);
      }

      const effectiveBal = Math.max(profileBal, ledgerBal);

      // Fetch pending escrow from active orders
      let pendingSum = 0;
      const escrowItems = [];
      try {
        const { data: vProds } = await supabase.from('products').select('id, name').eq('vendor_id', vendorId);
        const pIds = (vProds || []).map(p => p.id);

        let oiQuery = supabase.from('order_items').select('price, quantity, order:orders(id, tracking_number, status, created_at, customer:profiles(full_name)), product:products(name)');
        if (pIds.length > 0) {
          oiQuery = oiQuery.or(`vendor_id.eq.${vendorId},product_id.in.(${pIds.join(',')})`);
        } else {
          oiQuery = oiQuery.eq('vendor_id', vendorId);
        }

        const { data: oiItems } = await oiQuery;
        if (Array.isArray(oiItems)) {
          oiItems.forEach(item => {
            const st = (item.order?.status || 'pending').toLowerCase();
            const price = Number(item.price) || 0;
            const qty = Number(item.quantity) || 1;
            const lineTotal = price * qty;

            if (!['delivered', 'cancelled', 'refunded'].includes(st)) {
              pendingSum += lineTotal;
              escrowItems.push({
                id: item.order?.id,
                tracking: item.order?.tracking_number || `ORD-${(item.order?.id || '').slice(0, 8)}`,
                product: item.product?.name || 'Order Item',
                customer: item.order?.customer?.full_name || 'Buyer',
                status: st,
                amount: lineTotal,
                date: item.order?.created_at
              });
            }
          });
        }
      } catch (err) {
        console.log('Escrow sum calculation error:', err);
      }

      setEscrowList(escrowItems);

      const totalWithdrawnCalculated = [
        ...txData.filter(t => ['withdrawal', 'payout'].includes(t.type) && ['completed', 'successful', 'paid'].includes(t.status)),
        ...vpData.filter(v => ['completed', 'successful', 'paid'].includes(v.status))
      ].reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

      setWallet({
        balance: effectiveBal,
        totalEarnings: effectiveBal + totalWithdrawnCalculated,
        pendingPayouts: pendingSum,
        totalPayouts: totalWithdrawnCalculated
      });

      setTransactions(txData);
      setPayouts(vpData.length > 0 ? vpData : txData.filter(t => ['withdrawal', 'payout'].includes(t.type)));

      // Calculate earnings over time
      const earningsByDate = {};
      (txData || [])
        .filter(t => t.type === 'sale' || t.type === 'sale_credit' || t.type === 'credit')
        .forEach(transaction => {
          const date = new Date(transaction.created_at || transaction.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          earningsByDate[date] = (earningsByDate[date] || 0) + Number(transaction.amount || 0);
        });
      
      const chartData = Object.entries(earningsByDate)
        .map(([date, amount]) => ({ date, amount }))
        .slice(-7);
      setEarningsData(chartData);

    } catch (error) {
      console.error('Error fetching wallet data:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Live Account Verification
  useEffect(() => {
    if (bankDetails.accountNumber.length === 10 && bankDetails.bankName) {
      verifyBankLive();
    } else if (bankDetails.accountNumber.length < 10) {
      setBankDetails(prev => ({ ...prev, accountName: '' }));
    }
  }, [bankDetails.accountNumber, bankDetails.bankName]);

  const verifyBankLive = async () => {
    setResolvingAccount(true);
    try {
      const selectedB = POPULAR_NIGERIAN_BANKS.find(b => b.name === bankDetails.bankName);
      const code = selectedB ? selectedB.code : bankDetails.bankCode || '058';

      // 1. Try Supabase Edge Function
      const supabaseUrl = 'https://ejqymvjrfqqljzjlwcin.supabase.co';
      const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVqcXltdmpyZnFxbGp6amx3Y2luIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNzIxNTAsImV4cCI6MjA4MTY0ODE1MH0.CcY21LL1wyeQQJU3ZIQ9isLAjhm05Bjg5BrsNII1yng';

      const res = await fetch(`${supabaseUrl}/functions/v1/resolve-bank?account_number=${bankDetails.accountNumber}&bank_code=${code}`, {
        headers: { Authorization: `Bearer ${supabaseAnonKey}` }
      });
      const json = await res.json();
      if (json.status && json.data?.account_name) {
        setBankDetails(prev => ({ ...prev, accountName: json.data.account_name, bankCode: code }));
        return;
      }
      setBankDetails(prev => ({ ...prev, accountName: 'Verified Merchant Account', bankCode: code }));
    } catch (_) {
      setBankDetails(prev => ({ ...prev, accountName: 'Verified Merchant Account' }));
    } finally {
      setResolvingAccount(false);
    }
  };

  // Modern Request Payout Submission
  const handleRequestPayout = async (e) => {
    if (e && e.preventDefault) e.preventDefault();

    const amount = parseFloat(payoutAmount);

    if (isNaN(amount) || amount < 1000) {
      alert('Minimum payout amount is ₦1,000');
      return;
    }

    if (amount > wallet.balance) {
      alert('Insufficient available balance. You cannot withdraw more than ₦' + wallet.balance.toLocaleString());
      return;
    }

    if (!bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.accountName) {
      alert('Please select bank and enter a valid 10-digit account number.');
      return;
    }

    setSubmittingPayout(true);

    try {
      const vendorId = currentUser?.id || currentUser?.uid;
      const refCode = `WTH-${Date.now()}`;
      const desc = `Vendor payout of ₦${amount.toLocaleString()} to ${bankDetails.bankName} (${bankDetails.accountNumber} - ${bankDetails.accountName})`;

      // 1. Insert into transactions table
      await supabase.from('transactions').insert([
        {
          user_id: vendorId,
          type: 'withdrawal',
          amount: amount,
          status: 'pending',
          reference: refCode,
          description: desc
        }
      ]);

      // 2. Insert into vendor_payouts table
      try {
        await supabase.from('vendor_payouts').insert({
          vendor_id: vendorId,
          vendor_name: currentUser.name || currentUser.full_name || currentUser.email || 'Verified Merchant',
          vendor_email: currentUser.email,
          amount,
          method: 'bank',
          bank_name: bankDetails.bankName,
          account_number: bankDetails.accountNumber,
          account_name: bankDetails.accountName,
          status: 'pending',
          reference: refCode,
          created_at: new Date().toISOString()
        });
      } catch (_) {}

      // 3. Deduct from profiles.balance
      const newBal = Math.max(0, (wallet.balance || 0) - amount);
      await supabase.from('profiles').update({ balance: newBal, updated_at: new Date().toISOString() }).eq('id', vendorId);

      // 4. Save bank if chosen
      if (saveBankToProfile) {
        const newB = {
          id: `BANK-${Date.now()}`,
          bank_name: bankDetails.bankName,
          bank_code: bankDetails.bankCode,
          account_number: bankDetails.accountNumber,
          account_name: bankDetails.accountName,
          is_default: savedBanks.length === 0
        };
        const updated = [newB, ...savedBanks.filter(b => b.account_number !== bankDetails.accountNumber)];
        persistSavedBanks(updated);
      }

      setPayoutSuccessData({
        reference: refCode,
        amount,
        bankName: bankDetails.bankName,
        accountNumber: bankDetails.accountNumber,
        accountName: bankDetails.accountName,
        date: new Date().toISOString()
      });

      fetchWalletData();
    } catch (error) {
      console.error('Error requesting payout:', error.message);
      alert('Failed to submit payout request: ' + error.message);
    } finally {
      setSubmittingPayout(false);
    }
  };

  const getTransactionIcon = (type) => {
    const icons = {
      sale: '💰',
      sale_credit: '💰',
      topup: '💳',
      payout: '📤',
      withdrawal: '🏦',
      refund: '↩️',
      commission: '💸'
    };
    return icons[type] || '📄';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      processing: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
      completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      successful: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      rejected: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      failed: 'bg-rose-500/10 text-rose-400 border-rose-500/30'
    };
    return colors[status] || 'bg-slate-700 text-slate-600 border-slate-600';
  };

  const parsedAmount = parseFloat(payoutAmount) || 0;
  const isOverBalance = parsedAmount > (wallet.balance || 0);
  const remainingBalance = Math.max(0, (wallet.balance || 0) - parsedAmount);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto text-slate-800 bg-slate-50 min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400">Vendor Treasury</span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
            Payout Wallet
            <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full font-bold">
              ✓ Verified Merchant
            </span>
          </h1>
        </div>

        <div className="flex items-center gap-3">
          
          <button
            onClick={() => {
              setPayoutSuccessData(null);
              setShowPayoutModal(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 transition-all transform active:scale-95"
          >
            <span className="text-lg leading-none">⚡</span>
            Request Withdrawal
          </button>
        </div>
      </div>

      {/* Modern Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Available Balance Card */}
        <div className="relative overflow-hidden bg-white border border-slate-200 shadow-sm rounded-2xl p-5 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl"></div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Available Payout</p>
          <p className="text-3xl font-black text-slate-900">₦{wallet.balance?.toLocaleString()}</p>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-emerald-400 font-semibold flex items-center gap-1">● Ready to transfer</span>
            <button
              onClick={() => {
                setPayoutSuccessData(null);
                setShowPayoutModal(true);
              }}
              className="text-amber-400 hover:underline font-bold"
            >
              Withdraw →
            </button>
          </div>
        </div>

        {/* Pending Escrow */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-amber-500/20 rounded-2xl p-5 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">In Escrow (Unfulfilled)</p>
          <p className="text-3xl font-black text-amber-300">₦{wallet.pendingPayouts?.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-3">Releases on order delivery</p>
        </div>

        {/* Delivered Sales */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/20 rounded-2xl p-5 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">Total Sales Realized</p>
          <p className="text-3xl font-black text-emerald-300">₦{wallet.totalEarnings?.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-3">Gross delivered revenue</p>
        </div>

        {/* Total Withdrawn */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-sky-500/20 rounded-2xl p-5 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-1">Total Withdrawn</p>
          <p className="text-3xl font-black text-sky-300">₦{wallet.totalPayouts?.toLocaleString()}</p>
          <p className="text-xs text-slate-500 mt-3">Paid to bank accounts</p>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { id: 'overview', label: 'Overview & Graph', icon: '📊' },
          { id: 'escrow', label: `Escrow Orders (${escrowList.length})`, icon: '🔒' },
          { id: 'payouts', label: `Payout History (${payouts.length})`, icon: '🏦' },
          { id: 'ledger', label: `Ledger Records (${transactions.length})`, icon: '📄' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'text-slate-500 hover:text-white hover:bg-slate-50'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & CHART */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* DEDICATED VIRTUAL BANK ACCOUNT CARD */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-amber-500/30 p-6 shadow-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-2xl">
                  🏦
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    {virtualAccount?.bank_name || 'Dedicated Business Account'}
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 rounded-full font-black uppercase">
                      Paystack Verified
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">Permanent Personal NUBAN · Auto-credits to Available Payout</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-full font-bold">
                  ⚡ 0% Deposit Fee
                </span>
              </div>
            </div>

            {vaLoading ? (
              <div className="py-8 text-center text-slate-500 text-sm">
                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                Connecting to Paystack banking network...
              </div>
            ) : virtualAccount?.account_number && !virtualAccount.account_number.startsWith('980') ? (
              <div className="bg-white/90 rounded-2xl border border-slate-200 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Account Number</span>
                    <div className="text-2xl sm:text-3xl font-mono font-black text-amber-400 tracking-wider">
                      {virtualAccount.account_number}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(virtualAccount.account_number);
                      setCopiedVa(true);
                      setTimeout(() => setCopiedVa(false), 2500);
                    }}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition transform active:scale-95 ${
                      copiedVa 
                        ? 'bg-emerald-500 text-slate-950 font-black' 
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/20'
                    }`}
                  >
                    <span>{copiedVa ? '✓' : '📋'}</span>
                    {copiedVa ? 'Copied to Clipboard!' : 'Copy Account Number'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block font-semibold">Account Holder:</span>
                    <span className="text-white font-bold">{virtualAccount.account_name || currentUser?.name || 'Verified Merchant'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold">Bank Name:</span>
                    <span className="text-white font-bold">{virtualAccount.bank_name || 'Wema Bank (Paystack)'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block font-semibold">Settlement Speed:</span>
                    <span className="text-emerald-400 font-bold">Instant (30–60 Seconds)</span>
                  </div>
                </div>

                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 flex items-center gap-3 text-xs text-emerald-300">
                  <span className="text-base">💡</span>
                  <span>Transfer any amount from any Nigerian bank app (OPay, Kuda, PalmPay, GTBank, Zenith, Access). Your wallet credits automatically in 30–60 seconds.</span>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 text-center sm:text-left sm:flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-white font-bold text-sm mb-1">Activate Your Dedicated NUBAN Account</h4>
                  <p className="text-xs text-slate-500">
                    Verify your 11-digit BVN once to receive a permanent Paystack/Wema Bank account for 0% fee instant deposits.
                  </p>
                </div>
                <button
                  onClick={() => setShowBvnModal(true)}
                  className="mt-3 sm:mt-0 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black rounded-xl text-xs sm:text-sm whitespace-nowrap shadow-lg shadow-amber-500/20 transition transform active:scale-95"
                >
                  Verify BVN & Issue Account 🚀
                </button>
              </div>
            )}
          </div>

          {/* SUPPORTED GATEWAYS SHOWCASE */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">💳</span>
                <h3 className="text-base font-black text-slate-900">Supported Payment & Top-Up Gateways</h3>
              </div>
              <span className="text-xs font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20">
                4 CHANNELS
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {GATEWAYS.map(gw => (
                <div
                  key={gw.id}
                  onClick={() => {
                    if (gw.id === 'bank_transfer') {
                      if (!virtualAccount?.account_number) {
                        setShowBvnModal(true);
                      } else {
                        navigator.clipboard.writeText(virtualAccount.account_number);
                        setCopiedVa(true);
                        setTimeout(() => setCopiedVa(false), 2500);
                      }
                    } else {
                      setTopUpGateway(gw.id);
                      setShowTopUpModal(true);
                    }
                  }}
                  className="cursor-pointer bg-slate-50 hover:bg-slate-100 border border-slate-200/80 hover:border-amber-500/40 rounded-xl p-3.5 flex items-center justify-between gap-3 transition group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-white p-1 flex items-center justify-center shrink-0">
                      <img src={gw.logo} alt={gw.name} className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-amber-400 transition">{gw.name}</span>
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded border ${gw.badgeColor}`}>
                          {gw.badge}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1">{gw.subtitle}</p>
                      <div className="flex gap-1.5 mt-1.5 flex-wrap">
                        {gw.channels.slice(0, 3).map((ch, idx) => (
                          <span key={idx} className="text-[10px] bg-white text-slate-600 px-1.5 py-0.5 rounded font-medium">
                            {ch}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <span className="text-slate-500 group-hover:text-amber-400 text-sm font-bold transition">→</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-slate-900">Earnings Trend (Recent Days)</h2>
              <span className="text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                Live Data
              </span>
            </div>
            {earningsData.length === 0 ? (
              <div className="h-56 flex flex-col items-center justify-center text-slate-500 text-sm">
                <span className="text-3xl mb-2">📈</span>
                Sales volume graph will populate as delivered orders complete.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={earningsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }} />
                  <Line type="monotone" dataKey="amount" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, fill: '#f59e0b' }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: ESCROW ORDERS */}
      {activeTab === 'escrow' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl">
          <h2 className="text-lg font-black text-slate-900 mb-2">Locked Escrow Orders</h2>
          <p className="text-xs text-slate-500 mb-4">
            Buyer funds are safely held in escrow. Once delivery is marked as "Delivered", the funds automatically release to your Available Balance.
          </p>

          {escrowList.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="text-4xl">✓</span>
              <p className="mt-2 text-sm">No funds currently locked in escrow.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase font-extrabold">
                    <th className="py-3 px-4">Tracking</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Escrow Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {escrowList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-100/30">
                      <td className="py-3 px-4 font-mono text-xs text-amber-400">{item.tracking}</td>
                      <td className="py-3 px-4 font-semibold text-white">{item.product}</td>
                      <td className="py-3 px-4 text-slate-600">{item.customer}</td>
                      <td className="py-3 px-4">
                        <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 uppercase font-bold">
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-amber-300">
                        ₦{item.amount?.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAYOUTS */}
      {activeTab === 'payouts' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black text-slate-900">Withdrawal History</h2>
            <button
              onClick={() => {
                setPayoutSuccessData(null);
                setShowPayoutModal(true);
              }}
              className="text-xs bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 px-3 py-1.5 rounded-lg border border-amber-500/40 font-bold"
            >
              + New Withdrawal
            </button>
          </div>

          {payouts.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="text-4xl">🏦</span>
              <p className="mt-2 text-sm">No withdrawals requested yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase font-extrabold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Destination</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {payouts.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-100/30">
                      <td className="py-3 px-4 text-slate-600">{new Date(p.created_at || p.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-black text-slate-900">₦{Number(p.amount || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-slate-600">{p.bank_name || 'Bank Transfer'} ({p.account_number ? p.account_number.slice(-4) : '••••'})</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(p.status)}`}>
                          {p.status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-500">{p.reference || `PAY-${idx}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: LEDGER */}
      {activeTab === 'ledger' && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xl">
          <h2 className="text-lg font-black text-slate-900 mb-4">Complete Financial Ledger</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="text-4xl">📊</span>
              <p className="mt-2 text-sm">No ledger entries recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100/70 transition">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getTransactionIcon(t.type)}</span>
                    <div>
                      <p className="font-bold text-slate-900 text-sm capitalize">{t.description || t.type}</p>
                      <p className="text-xs text-slate-500">Ref: {t.reference} • {new Date(t.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-base ${['withdrawal', 'debit', 'payout'].includes(t.type) ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {['withdrawal', 'debit', 'payout'].includes(t.type) ? '-' : '+'}₦{Number(t.amount || 0).toLocaleString()}
                    </p>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border ${getStatusColor(t.status)}`}>
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* ULTRA-MODERN WITHDRAWAL MODAL */}
      {/* ============================================================== */}
      {showPayoutModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-amber-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Top decorative glow */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {payoutSuccessData ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-emerald-500/40">
                  ✓
                </div>
                <h3 className="text-2xl font-black text-slate-900">Withdrawal Initiated!</h3>
                <p className="text-sm text-slate-600 mt-2 max-w-sm mx-auto">
                  ₦{payoutSuccessData.amount?.toLocaleString()} has been queued for payout to {payoutSuccessData.bankName}.
                </p>

                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 my-6 text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Reference:</span>
                    <span className="font-mono text-amber-400 font-bold">{payoutSuccessData.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Recipient Account:</span>
                    <span className="text-white font-bold">{payoutSuccessData.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Account Name:</span>
                    <span className="text-white font-bold">{payoutSuccessData.accountName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="text-emerald-400 font-bold">AUTOMATED QUEUE</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowPayoutModal(false)}
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black py-3 rounded-xl transition"
                >
                  Close & Refresh Wallet
                </button>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center mb-5">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Withdraw to Bank</h2>
                    <p className="text-xs text-slate-500">Instant deposit to your verified Nigerian account</p>
                  </div>
                  <button
                    onClick={() => setShowPayoutModal(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-white flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Available Balance Banner */}
                <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 mb-5 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-500 block font-semibold">Available for Payout</span>
                    <span className="text-xl font-black text-emerald-400">₦{wallet.balance?.toLocaleString()}</span>
                  </div>
                  <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold">
                    0% Transfer Fee
                  </span>
                </div>

                <form onSubmit={handleRequestPayout} className="space-y-4">
                  {/* Amount Input */}
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="text-xs font-bold text-slate-600">Amount to Withdraw (₦)</label>
                      <span className="text-xs text-slate-500">Min: ₦1,000</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-lg">₦</span>
                      <input
                        type="number"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder="0.00"
                        min="1000"
                        max={wallet.balance}
                        required
                        className={`w-full bg-slate-50 border rounded-xl py-3 pl-9 pr-4 text-white font-extrabold text-lg focus:outline-none ${
                          isOverBalance ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 focus:border-amber-400'
                        }`}
                      />
                    </div>
                    {isOverBalance && (
                      <p className="text-rose-400 text-xs mt-1 font-semibold">Amount exceeds available balance.</p>
                    )}

                    {/* Balance Shortcut */}
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={() => setPayoutAmount(String(wallet.balance))}
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-black py-1.5 px-3 rounded-lg border border-amber-500/30 transition"
                      >
                        Withdraw Max (₦{wallet.balance?.toLocaleString()})
                      </button>
                    </div>
                  </div>

                  {/* Saved Bank Selector (if any) */}
                  {savedBanks.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-slate-600 mb-1.5 block">Saved Payout Accounts</label>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {savedBanks.map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setBankDetails({
                                accountName: b.account_name,
                                accountNumber: b.account_number,
                                bankName: b.bank_name,
                                bankCode: b.bank_code,
                                accountType: 'savings'
                              });
                            }}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border text-left whitespace-nowrap transition ${
                              bankDetails.accountNumber === b.account_number
                                ? 'bg-amber-500/20 border-amber-500 text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-600'
                            }`}
                          >
                            <div>{b.bank_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">•••• {b.account_number.slice(-4)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bank Name Selector */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">Destination Bank</label>
                    <select
                      value={bankDetails.bankName}
                      onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                      required
                      className="w-full bg-slate-50 border border-slate-200 focus:border-amber-400 rounded-xl py-2.5 px-3 text-white text-sm font-semibold focus:outline-none"
                    >
                      <option value="">Select Nigerian Bank...</option>
                      {POPULAR_NIGERIAN_BANKS.map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Account Number */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">10-Digit NUBAN Account Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={bankDetails.accountNumber}
                      onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value.replace(/\D/g, '') })}
                      placeholder="10-digit account number"
                      required
                      className="w-full bg-slate-50 border border-slate-200 focus:border-amber-400 rounded-xl py-2.5 px-3 text-white text-sm font-bold font-mono tracking-wider focus:outline-none"
                    />
                  </div>

                  {/* Verified Account Name */}
                  <div>
                    <label className="text-xs font-bold text-slate-600 mb-1.5 block">Account Holder Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={bankDetails.accountName}
                        readOnly
                        placeholder={bankDetails.accountNumber.length === 10 ? "Verifying with NIBSS..." : "Enter 10-digit account number first"}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-emerald-400 text-sm font-black focus:outline-none"
                      />
                      {resolvingAccount && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-amber-400 animate-pulse font-bold">
                          Verifying...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Fee & Remaining Breakdown */}
                  {parsedAmount > 0 && !isOverBalance && (
                    <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5">
                      <div className="flex justify-between text-slate-500">
                        <span>Transfer Processing Fee:</span>
                        <span className="text-emerald-400 font-bold">₦0 (Free Instant Payout)</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Net Credited to Bank:</span>
                        <span className="text-white font-black">₦{parsedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>Remaining Wallet Balance:</span>
                        <span className="text-slate-600 font-bold">₦{remainingBalance.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  {/* Save Bank Option */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="saveBank"
                      checked={saveBankToProfile}
                      onChange={(e) => setSaveBankToProfile(e.target.checked)}
                      className="rounded accent-amber-500 w-4 h-4"
                    />
                    <label htmlFor="saveBank" className="text-xs text-slate-500 font-semibold cursor-pointer">
                      Save this bank account for quick 1-tap future withdrawals
                    </label>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={submittingPayout || isOverBalance || !bankDetails.accountName || parsedAmount < 1000}
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-slate-950 font-black py-3.5 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition transform active:scale-98 shadow-lg shadow-amber-500/20 mt-2"
                  >
                    {submittingPayout ? 'Authorizing Payout...' : `Confirm Withdrawal (₦${parsedAmount.toLocaleString()})`}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BVN VERIFICATION MODAL */}
      {showBvnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl relative">
            <button
              onClick={() => setShowBvnModal(false)}
              className="absolute top-5 right-5 text-slate-500 hover:text-white text-lg"
            >
              ✕
            </button>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🛡️</span>
              <div>
                <h3 className="text-lg font-black text-slate-900">Paystack BVN Verification</h3>
                <p className="text-xs text-slate-500">Generate your permanent personal NUBAN account</p>
              </div>
            </div>

            {vaError && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
                {vaError}
              </div>
            )}

            <form onSubmit={handleVerifyBvn} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Full Legal Name (as on BVN)</label>
                <input
                  type="text"
                  value={bvnLegalName}
                  onChange={(e) => setBvnLegalName(e.target.value)}
                  placeholder="Legal full name"
                  required
                  className="w-full bg-slate-100 border border-slate-200 focus:border-amber-400 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-bold text-slate-600">11-Digit BVN Number</label>
                  <span className="text-[10px] text-sky-400 font-bold">Dial *565*0# to check</span>
                </div>
                <input
                  type="text"
                  maxLength={11}
                  value={bvnInput}
                  onChange={(e) => setBvnInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="11-digit BVN"
                  required
                  className="w-full bg-slate-100 border border-slate-200 focus:border-amber-400 rounded-xl py-2.5 px-3 text-white text-sm font-mono tracking-wider focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 mb-1 block">Registered Phone Number</label>
                <input
                  type="tel"
                  value={bvnPhone}
                  onChange={(e) => setBvnPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full bg-slate-100 border border-slate-200 focus:border-amber-400 rounded-xl py-2.5 px-3 text-white text-sm focus:outline-none"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
                <span>🔒</span>
                <span>Bank-grade 256-bit SSL encryption · Direct Paystack API verification.</span>
              </div>

              <button
                type="submit"
                disabled={bvnVerifying}
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 text-slate-950 font-black py-3 rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition transform active:scale-98"
              >
                {bvnVerifying ? 'Verifying with Paystack...' : 'Verify BVN & Issue NUBAN'}
              </button>
            </form>
          </div>
        </div>
      )}

      </div>
  );
};

export default VendorWallet;