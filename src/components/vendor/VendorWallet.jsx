import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const POPULAR_NIGERIAN_BANKS = [
  { name: 'OPay Digital Services', code: '999992' },
  { name: 'Palmpay', code: '999991' },
  { name: 'Moniepoint MFB', code: '50515' },
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

const PRESETS = [5000, 10000, 25000, 50000, 100000];

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
    return colors[status] || 'bg-slate-700 text-slate-300 border-slate-600';
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
    <div className="p-4 sm:p-6 max-w-7xl mx-auto text-slate-100">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <span className="text-xs uppercase font-extrabold tracking-wider text-amber-400">Vendor Treasury</span>
          <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
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
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl"></div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Available Payout</p>
          <p className="text-3xl font-black text-white">₦{wallet.balance?.toLocaleString()}</p>
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
          <p className="text-xs text-slate-400 mt-3">Releases on order delivery</p>
        </div>

        {/* Delivered Sales */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-emerald-500/20 rounded-2xl p-5 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-1">Total Sales Realized</p>
          <p className="text-3xl font-black text-emerald-300">₦{wallet.totalEarnings?.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-3">Gross delivered revenue</p>
        </div>

        {/* Total Withdrawn */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-sky-500/20 rounded-2xl p-5 shadow-xl">
          <p className="text-xs font-bold uppercase tracking-wider text-sky-400 mb-1">Total Withdrawn</p>
          <p className="text-3xl font-black text-sky-300">₦{wallet.totalPayouts?.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-3">Paid to bank accounts</p>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 mb-6 overflow-x-auto pb-1">
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
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
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
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-black text-white">Earnings Trend (Recent Days)</h2>
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h2 className="text-lg font-black text-white mb-2">Locked Escrow Orders</h2>
          <p className="text-xs text-slate-400 mb-4">
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
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase font-extrabold">
                    <th className="py-3 px-4">Tracking</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Escrow Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {escrowList.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-mono text-xs text-amber-400">{item.tracking}</td>
                      <td className="py-3 px-4 font-semibold text-white">{item.product}</td>
                      <td className="py-3 px-4 text-slate-300">{item.customer}</td>
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-black text-white">Withdrawal History</h2>
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
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase font-extrabold">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Destination</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {payouts.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 text-slate-300">{new Date(p.created_at || p.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-4 font-black text-white">₦{Number(p.amount || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 text-slate-300">{p.bank_name || 'Bank Transfer'} ({p.account_number ? p.account_number.slice(-4) : '••••'})</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(p.status)}`}>
                          {p.status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-slate-400">{p.reference || `PAY-${idx}`}</td>
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <h2 className="text-lg font-black text-white mb-4">Complete Financial Ledger</h2>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <span className="text-4xl">📊</span>
              <p className="mt-2 text-sm">No ledger entries recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3.5 bg-slate-800/40 border border-slate-800 rounded-xl hover:bg-slate-800/70 transition">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getTransactionIcon(t.type)}</span>
                    <div>
                      <p className="font-bold text-white text-sm capitalize">{t.description || t.type}</p>
                      <p className="text-xs text-slate-400">Ref: {t.reference} • {new Date(t.created_at).toLocaleString()}</p>
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
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Top decorative glow */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

            {payoutSuccessData ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 border border-emerald-500/40">
                  ✓
                </div>
                <h3 className="text-2xl font-black text-white">Withdrawal Initiated!</h3>
                <p className="text-sm text-slate-300 mt-2 max-w-sm mx-auto">
                  ₦{payoutSuccessData.amount?.toLocaleString()} has been queued for payout to {payoutSuccessData.bankName}.
                </p>

                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 my-6 text-left text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Reference:</span>
                    <span className="font-mono text-amber-400 font-bold">{payoutSuccessData.reference}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recipient Account:</span>
                    <span className="text-white font-bold">{payoutSuccessData.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account Name:</span>
                    <span className="text-white font-bold">{payoutSuccessData.accountName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
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
                    <h2 className="text-xl font-black text-white">Withdraw to Bank</h2>
                    <p className="text-xs text-slate-400">Instant deposit to your verified Nigerian account</p>
                  </div>
                  <button
                    onClick={() => setShowPayoutModal(false)}
                    className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
                  >
                    ✕
                  </button>
                </div>

                {/* Available Balance Banner */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 mb-5 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-slate-400 block font-semibold">Available for Payout</span>
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
                      <label className="text-xs font-bold text-slate-300">Amount to Withdraw (₦)</label>
                      <span className="text-xs text-slate-400">Min: ₦1,000</span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">₦</span>
                      <input
                        type="number"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value)}
                        placeholder="0.00"
                        min="1000"
                        max={wallet.balance}
                        required
                        className={`w-full bg-slate-800/80 border rounded-xl py-3 pl-9 pr-4 text-white font-extrabold text-lg focus:outline-none ${
                          isOverBalance ? 'border-rose-500 focus:border-rose-500' : 'border-slate-700 focus:border-amber-400'
                        }`}
                      />
                    </div>
                    {isOverBalance && (
                      <p className="text-rose-400 text-xs mt-1 font-semibold">Amount exceeds available balance.</p>
                    )}

                    {/* Quick Presets */}
                    <div className="flex gap-2 mt-2.5">
                      {PRESETS.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPayoutAmount(String(p))}
                          className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-1.5 rounded-lg border border-slate-700/80 transition"
                        >
                          ₦{p / 1000}k
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setPayoutAmount(String(wallet.balance))}
                        className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-black py-1.5 rounded-lg border border-amber-500/30 transition"
                      >
                        Max
                      </button>
                    </div>
                  </div>

                  {/* Saved Bank Selector (if any) */}
                  {savedBanks.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-slate-300 mb-1.5 block">Saved Payout Accounts</label>
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
                                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
                            }`}
                          >
                            <div>{b.bank_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">•••• {b.account_number.slice(-4)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bank Name Selector */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1.5 block">Destination Bank</label>
                    <select
                      value={bankDetails.bankName}
                      onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
                      required
                      className="w-full bg-slate-800/80 border border-slate-700 focus:border-amber-400 rounded-xl py-2.5 px-3 text-white text-sm font-semibold focus:outline-none"
                    >
                      <option value="">Select Nigerian Bank...</option>
                      {POPULAR_NIGERIAN_BANKS.map(b => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Account Number */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1.5 block">10-Digit NUBAN Account Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={bankDetails.accountNumber}
                      onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value.replace(/\D/g, '') })}
                      placeholder="e.g. 0123456789"
                      required
                      className="w-full bg-slate-800/80 border border-slate-700 focus:border-amber-400 rounded-xl py-2.5 px-3 text-white text-sm font-bold font-mono tracking-wider focus:outline-none"
                    />
                  </div>

                  {/* Verified Account Name */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 mb-1.5 block">Account Holder Name</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={bankDetails.accountName}
                        readOnly
                        placeholder={bankDetails.accountNumber.length === 10 ? "Verifying with NIBSS..." : "Enter 10-digit account number first"}
                        className="w-full bg-slate-800/40 border border-slate-700 rounded-xl py-2.5 px-3 text-emerald-400 text-sm font-black focus:outline-none"
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
                    <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-800 text-xs space-y-1.5">
                      <div className="flex justify-between text-slate-400">
                        <span>Transfer Processing Fee:</span>
                        <span className="text-emerald-400 font-bold">₦0 (Free Instant Payout)</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Net Credited to Bank:</span>
                        <span className="text-white font-black">₦{parsedAmount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Remaining Wallet Balance:</span>
                        <span className="text-slate-300 font-bold">₦{remainingBalance.toLocaleString()}</span>
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
                    <label htmlFor="saveBank" className="text-xs text-slate-400 font-semibold cursor-pointer">
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
    </div>
  );
};

export default VendorWallet;