import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import { 
  Users, Search, UserPlus, Shield, CheckCircle, 
  XCircle, Mail, Phone, Calendar, RefreshCw, Eye,
  Trash2, UserCheck, UserX, ChevronDown, Wallet,
  Download, MessageCircle, AlertTriangle, ShieldCheck,
  Star, DollarSign, Filter, MoreVertical, Sparkles,
  ArrowUpRight, ArrowDownRight, Tag, Copy, Check,
  Send, SlidersHorizontal, CheckSquare, Square
} from 'lucide-react';

const ROLES = {
  admin: { label: 'Admin', color: 'text-purple-800 bg-purple-50 border-purple-200' },
  vendor: { label: 'Vendor', color: 'text-orange-800 bg-orange-50 border-orange-200' },
  driver: { label: 'Driver', color: 'text-sky-800 bg-sky-50 border-sky-200' },
  buyer: { label: 'Customer', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
  customer: { label: 'Customer', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' }
};

const TIERS = [
  { min: 1000000, label: 'VIP', color: 'text-purple-800 bg-purple-50 border-purple-200' },
  { min: 250000, label: 'Gold', color: 'text-amber-800 bg-amber-50 border-amber-200' },
  { min: 50000, label: 'Silver', color: 'text-slate-800 bg-slate-100 border-slate-200' },
  { min: 0, label: 'Basic', color: 'text-amber-900 bg-amber-50 border-amber-200' }
];

const getTier = (spend = 0) => TIERS.find(t => spend >= t.min) || TIERS[3];

const formatNaira = (amount) => {
  if (!amount || isNaN(amount)) return '₦0';
  const num = Number(amount);
  if (num >= 1e6) return `₦${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `₦${(num / 1e3).toLocaleString('en-US', { maximumFractionDigits: 1 })}K`;
  return `₦${num.toLocaleString('en-US')}`;
};

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [wallets, setWallets] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState({ type: '', text: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [viewDensity, setViewDensity] = useState('compact'); // 'compact' | 'comfortable'
  const [copiedText, setCopiedText] = useState('');

  // Modals & Panels
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');

  // WhatsApp template modal
  const [whatsappModal, setWhatsappModal] = useState({ open: false, user: null, message: '' });

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // New user form state
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'customer'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 4000);
  };

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(''), 2000);
    showToast('success', `${label} copied to clipboard!`);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const [profilesRes, walletsRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('wallets').select('user_id, balance, pending_balance')
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const walletMap = {};
      (walletsRes.data || []).forEach(w => {
        walletMap[w.user_id] = w;
      });
      setWallets(walletMap);

      const mappedUsers = (profilesRes.data || []).map(u => ({
        ...u,
        wallet: walletMap[u.id] || null,
        tier: getTier(u.total_spend || 0)
      }));

      setUsers(mappedUsers);
    } catch (error) {
      console.error('Error fetching users:', error.message);
      showToast('error', 'Failed to load user database: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) {
      showToast('error', 'Please fill in all required fields.');
      return;
    }

    if (newUser.password.length < 6) {
      showToast('error', 'Password must be at least 6 characters long.');
      return;
    }

    setActionLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            full_name: newUser.name,
            role: newUser.role
          }
        }
      });

      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          full_name: newUser.name,
          email: newUser.email,
          phone: newUser.phone,
          role: newUser.role,
          created_at: new Date().toISOString()
        });

      if (profileError) throw profileError;

      showToast('success', 'User account created successfully!');
      setShowCreateModal(false);
      setNewUser({ name: '', email: '', password: '', phone: '', role: 'customer' });
      fetchUsers();
    } catch (error) {
      showToast('error', 'Account registration failed: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          role: newRole,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
      if (selectedUser?.id === userId) {
        setSelectedUser(prev => ({ ...prev, role: newRole }));
      }
      showToast('success', `Role changed to ${newRole.toUpperCase()}`);
    } catch (error) {
      showToast('error', 'Role update failed: ' + error.message);
    }
  };

  const handleToggleSuspend = async (user) => {
    const nextSuspended = !user.suspended && !user.is_banned;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          suspended: nextSuspended,
          is_banned: nextSuspended,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, suspended: nextSuspended, is_banned: nextSuspended } : u));
      if (selectedUser?.id === user.id) {
        setSelectedUser(prev => ({ ...prev, suspended: nextSuspended, is_banned: nextSuspended }));
      }
      showToast('success', nextSuspended ? 'Account suspended.' : 'Account restored.');
    } catch (error) {
      showToast('error', 'Suspension update failed: ' + error.message);
    }
  };

  const handleToggleVerify = async (user) => {
    const nextVerified = !user.is_verified;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_verified: nextVerified,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_verified: nextVerified } : u));
      if (selectedUser?.id === user.id) {
        setSelectedUser(prev => ({ ...prev, is_verified: nextVerified }));
      }
      showToast('success', nextVerified ? 'KYC verified.' : 'KYC unverified.');
    } catch (error) {
      showToast('error', 'Verification toggle failed: ' + error.message);
    }
  };

  // Instant Quick Credit (+₦1,000 / +₦5,000) directly from row
  const handleQuickCredit = async (user, amt = 1000) => {
    try {
      const current = user?.wallet?.balance || 0;
      const nextBal = current + amt;
      if (!user?.wallet) {
        await supabase.from('wallets').insert({ user_id: user.id, balance: amt, pending_balance: 0 });
      } else {
        await supabase.from('wallets').update({ balance: nextBal }).eq('user_id', user.id);
      }
      try {
        await supabase.from('wallet_transactions').insert({
          user_id: user.id,
          amount: amt,
          type: 'admin_credit',
          description: `Admin Quick Credit +₦${amt.toLocaleString()}`,
          status: 'completed'
        });
      } catch (e) {}

      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, wallet: { ...u.wallet, balance: nextBal } } : u));
      showToast('success', `Credited +${formatNaira(amt)} to ${user.full_name || 'user'}!`);
    } catch (err) {
      showToast('error', 'Quick credit failed: ' + err.message);
    }
  };

  const handleAdjustWallet = async (type) => {
    const amt = parseFloat(walletAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('error', 'Please enter a valid amount.');
      return;
    }

    try {
      const current = selectedUser?.wallet?.balance || 0;
      const nextBal = type === 'credit' ? current + amt : Math.max(0, current - amt);

      if (!selectedUser?.wallet) {
        await supabase.from('wallets').insert({
          user_id: selectedUser.id,
          balance: type === 'credit' ? amt : 0,
          pending_balance: 0
        });
      } else {
        await supabase.from('wallets').update({ balance: nextBal }).eq('user_id', selectedUser.id);
      }

      try {
        await supabase.from('wallet_transactions').insert({
          user_id: selectedUser.id,
          amount: amt,
          type: type === 'credit' ? 'admin_credit' : 'admin_debit',
          description: walletReason.trim() || `Admin manual ${type}`,
          status: 'completed'
        });
      } catch (e) {}

      showToast('success', `Wallet ${type === 'credit' ? 'credited' : 'debited'} with ${formatNaira(amt)}.`);
      setShowWalletModal(false);
      setWalletAmount('');
      setWalletReason('');
      fetchUsers();
    } catch (error) {
      showToast('error', 'Wallet adjustment error: ' + error.message);
    }
  };

  // Bulk Operations
  const handleBulkCredit = async (amt = 1000) => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Credit ${formatNaira(amt)} to all ${selectedIds.length} selected accounts?`)) return;
    setActionLoading(true);
    try {
      for (const id of selectedIds) {
        const u = users.find(x => x.id === id);
        const cur = u?.wallet?.balance || 0;
        await supabase.from('wallets').upsert({ user_id: id, balance: cur + amt });
      }
      showToast('success', `Bulk credited ${formatNaira(amt)} to ${selectedIds.length} users!`);
      setSelectedIds([]);
      fetchUsers();
    } catch (err) {
      showToast('error', 'Bulk credit failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkVerify = async () => {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    try {
      await supabase.from('profiles').update({ is_verified: true }).in('id', selectedIds);
      showToast('success', `Verified KYC for ${selectedIds.length} users!`);
      setSelectedIds([]);
      fetchUsers();
    } catch (err) {
      showToast('error', 'Bulk verify failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkSuspend = async (suspend = true) => {
    if (selectedIds.length === 0) return;
    setActionLoading(true);
    try {
      await supabase.from('profiles').update({ suspended: suspend, is_banned: suspend }).in('id', selectedIds);
      showToast('success', `${suspend ? 'Suspended' : 'Restored'} ${selectedIds.length} accounts!`);
      setSelectedIds([]);
      fetchUsers();
    } catch (err) {
      showToast('error', 'Bulk status update failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`PERMANENT ACTION: Delete user "${user.full_name || user.email}" permanently?`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (error) throw error;
      setUsers(prev => prev.filter(u => u.id !== user.id));
      if (selectedUser?.id === user.id) setShowDetailModal(false);
      showToast('success', 'User permanently deleted.');
    } catch (error) {
      showToast('error', 'Failed to delete user: ' + error.message);
    }
  };

  const exportCSV = () => {
    const targetUsers = selectedIds.length > 0 ? users.filter(u => selectedIds.includes(u.id)) : filteredUsers;
    const headers = ['Full Name', 'Email', 'Phone', 'Role', 'Wallet Balance', 'KYC Verified', 'Suspended', 'Joined'];
    const rows = targetUsers.map(u => [
      `"${u.full_name || ''}"`,
      `"${u.email || ''}"`,
      `"${u.phone || ''}"`,
      `"${u.role || 'customer'}"`,
      u.wallet?.balance || 0,
      u.is_verified ? 'Yes' : 'No',
      u.suspended || u.is_banned ? 'Yes' : 'No',
      `"${new Date(u.created_at).toLocaleDateString()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `marketplace_users_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        (user.full_name || '').toLowerCase().includes(term) ||
        (user.email || '').toLowerCase().includes(term) ||
        (user.phone || '').toLowerCase().includes(term) ||
        (user.role || '').toLowerCase().includes(term);

      if (!matchesSearch) return false;

      if (filter === 'all') return true;
      if (filter === 'vendor') return user.role === 'vendor';
      if (filter === 'driver') return user.role === 'driver';
      if (filter === 'admin') return user.role === 'admin';
      if (filter === 'customer') return !user.role || user.role === 'buyer' || user.role === 'customer';
      if (filter === 'verified') return user.is_verified === true;
      if (filter === 'suspended') return user.suspended === true || user.is_banned === true;
      if (filter === 'wallet') return (user.wallet?.balance || 0) > 0;
      return true;
    });
  }, [users, searchTerm, filter]);

  // Key performance statistics
  const totalBalance = useMemo(() => users.reduce((acc, u) => acc + (u.wallet?.balance || 0), 0), [users]);
  const customersCount = useMemo(() => users.filter(u => !u.role || u.role === 'buyer' || u.role === 'customer').length, [users]);
  const vendorsCount = useMemo(() => users.filter(u => u.role === 'vendor').length, [users]);
  const driversCount = useMemo(() => users.filter(u => u.role === 'driver').length, [users]);
  const adminsCount = useMemo(() => users.filter(u => u.role === 'admin').length, [users]);
  const verifiedCount = useMemo(() => users.filter(u => u.is_verified).length, [users]);
  const suspendedCount = useMemo(() => users.filter(u => u.suspended || u.is_banned).length, [users]);

  const allFilteredSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedIds.includes(u.id));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsers.map(u => u.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  // WhatsApp templates generator
  const getWhatsAppTemplates = (u) => {
    const name = u?.full_name || 'Valued Customer';
    return [
      {
        title: 'Welcome & Onboarding',
        msg: `Hello ${name}, welcome to Abu Mafhal Marketplace! Your account is active and you can now browse, shop, and manage orders with verified fast delivery. Let us know if you need assistance!`
      },
      {
        title: 'KYC Verification Approved',
        msg: `Congratulations ${name}! Your KYC identification documents on Abu Mafhal Marketplace have been successfully reviewed and verified. Your account limits are now unlocked.`
      },
      {
        title: 'Wallet Credit Confirmation',
        msg: `Hello ${name}, your marketplace wallet float has just been successfully credited. You can verify your live balance anytime in your account dashboard.`
      },
      {
        title: 'Support Follow-up',
        msg: `Hello ${name}, our administrative desk is reaching out regarding your account activity on Abu Mafhal Marketplace. How can our customer experience team support you today?`
      }
    ];
  };

  return (
    <div className="space-y-3.5 text-slate-800 animate-fadeIn p-1 sm:p-2.5 rounded-2xl bg-[#F5F2EB]/50">
      {/* ── SLEEK COMPACT HEADER ── */}
      <div className="bg-white px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border border-[#E6E0D5] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-[10.5px] font-bold tracking-wider uppercase mb-1">
              <Users className="w-3.5 h-3.5 text-amber-700" />
              <span>Admin Directory & Permissions</span>
            </div>
            <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-snug">
              User Management Console
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Manage permissions, balances, KYC verifications, and direct WhatsApp alerts.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Density toggle */}
            <button
              onClick={() => setViewDensity(prev => prev === 'compact' ? 'comfortable' : 'compact')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-[#E6E0D5] text-slate-700 text-xs font-bold transition-all"
              title="Toggle View Density"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>{viewDensity === 'compact' ? 'Dense' : 'Normal'}</span>
            </button>

            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-50 hover:bg-stone-100 border border-[#E6E0D5] text-slate-700 text-xs font-bold transition-all"
              title="Export as CSV"
            >
              <Download className="w-3.5 h-3.5 text-amber-700" />
              <span>Export</span>
            </button>

            <button
              onClick={fetchUsers}
              className="p-2 rounded-xl bg-stone-50 hover:bg-stone-100 border border-[#E6E0D5] text-slate-700 transition-all"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-700' : ''}`} />
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-xs transition-all"
            >
              <UserPlus className="w-3.5 h-3.5 text-amber-400" />
              <span>Add User</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── TOAST ALERT ── */}
      {toast.text && (
        <div className={`p-2.5 rounded-xl text-xs font-semibold border flex items-center justify-between shadow-xs transition-all ${
          toast.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{toast.text}</span>
          <button onClick={() => setToast({ type: '', text: '' })} className="text-[10px] opacity-70 hover:opacity-100 font-bold px-1.5 py-0.5">✕</button>
        </div>
      )}

      {/* ── COMPACT KPI METRICS TILES ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-[#E6E0D5] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Users</span>
            <div className="text-lg font-black text-slate-900 leading-tight">{users.length}</div>
            <span className="text-[10px] text-slate-500 font-medium">{customersCount} Shoppers · {adminsCount} Admins</span>
          </div>
          <Users className="w-4 h-4 text-slate-700" />
        </div>

        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-orange-200/70 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 block">Merchants</span>
            <div className="text-lg font-black text-slate-900 leading-tight">{vendorsCount}</div>
            <span className="text-[10px] text-slate-500 font-medium">{driversCount} Logistics Couriers</span>
          </div>
          <Star className="w-4 h-4 text-orange-600" />
        </div>

        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-emerald-200/70 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block">Float Balance</span>
            <div className="text-lg font-black text-emerald-700 leading-tight">{formatNaira(totalBalance)}</div>
            <span className="text-[10px] text-slate-500 font-medium">{verifiedCount} KYC Verified</span>
          </div>
          <Wallet className="w-4 h-4 text-emerald-600" />
        </div>

        <div className="bg-white px-3.5 py-2.5 rounded-xl border border-sky-200/70 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 block">Account Health</span>
            <div className="text-lg font-black text-sky-800 leading-tight">{verifiedCount} / {users.length}</div>
            <span className="text-[10px] text-rose-600 font-bold">{suspendedCount} Suspended</span>
          </div>
          <ShieldCheck className="w-4 h-4 text-sky-600" />
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-white p-2.5 rounded-xl border border-[#E6E0D5] shadow-xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-amber-700 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, phone, email…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-7 py-1.5 bg-[#F5F2EB]/60 border border-[#E6E0D5] rounded-xl text-xs focus:outline-none focus:border-amber-600 transition-all text-slate-900 placeholder-slate-400 font-medium"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700">✕</button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-0.5 sm:pb-0 scrollbar-none">
          {[
            { id: 'all', label: `All (${users.length})` },
            { id: 'customer', label: `Customers (${customersCount})` },
            { id: 'vendor', label: `Vendors (${vendorsCount})` },
            { id: 'driver', label: `Drivers (${driversCount})` },
            { id: 'admin', label: `Admins (${adminsCount})` },
            { id: 'verified', label: `KYC (${verifiedCount})` },
            { id: 'wallet', label: 'Funded' },
            { id: 'suspended', label: `Suspended (${suspendedCount})` },
          ].map(p => {
            const active = filter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setFilter(p.id)}
                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all whitespace-nowrap border ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 font-black'
                    : 'bg-[#F5F2EB]/70 text-slate-700 border-[#E6E0D5] hover:bg-stone-100 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── FLOATING BULK ACTIONS TOOLBAR ── */}
      {selectedIds.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900 text-white shadow-lg animate-fadeIn border border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black bg-amber-500 text-slate-950 px-2 py-0.5 rounded-md">
              {selectedIds.length}
            </span>
            <span className="text-xs font-bold text-slate-200">accounts selected</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleBulkCredit(1000)}
              disabled={actionLoading}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black transition-all"
            >
              +₦1K Credit
            </button>
            <button
              onClick={() => handleBulkCredit(5000)}
              disabled={actionLoading}
              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black transition-all"
            >
              +₦5K Credit
            </button>
            <button
              onClick={handleBulkVerify}
              disabled={actionLoading}
              className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition-all"
            >
              Verify KYC
            </button>
            <button
              onClick={() => handleBulkSuspend(true)}
              disabled={actionLoading}
              className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold transition-all"
            >
              Suspend
            </button>
            <button
              onClick={() => handleBulkSuspend(false)}
              disabled={actionLoading}
              className="px-2.5 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold transition-all"
            >
              Restore
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1 rounded-lg text-slate-400 hover:text-white text-[11px] font-bold"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* ── USER TABLE (HIGH-DENSITY & COMPACT) ── */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center bg-white rounded-2xl border border-[#E6E0D5] text-center">
          <div className="w-8 h-8 border-3 border-slate-900 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-xs font-bold text-slate-600">Loading user accounts…</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center bg-white rounded-2xl border border-[#E6E0D5] text-center">
          <Users className="w-8 h-8 text-slate-400 mb-2" />
          <h3 className="text-sm font-black text-slate-900">No accounts match criteria</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-0.5">Try adjusting your search terms or filter selection.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-[#E6E0D5] shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-stone-200 bg-[#FAF8F5] text-[10.5px] font-black uppercase tracking-wider text-slate-600">
                  <th className="py-2.5 px-3 w-8 text-center">
                    <button onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-900">
                      {allFilteredSelected ? (
                        <CheckSquare className="w-4 h-4 text-amber-600" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">User Profile</th>
                  <th className="py-2.5 px-2.5">Contact</th>
                  <th className="py-2.5 px-2.5">Role</th>
                  <th className="py-2.5 px-2.5">Wallet Balance</th>
                  <th className="py-2.5 px-2.5 text-center">Status & KYC</th>
                  <th className="py-2.5 px-2.5">Registered</th>
                  <th className="py-2.5 px-3 text-right">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs">
                {filteredUsers.map((user) => {
                  const isSelected = selectedIds.includes(user.id);
                  const isSuspended = user.suspended === true || user.is_banned === true;
                  const roleConfig = ROLES[user.role] || ROLES.customer;
                  const initial = (user.full_name || user.email || 'U')[0].toUpperCase();
                  const bal = user.wallet?.balance || 0;
                  const isCompact = viewDensity === 'compact';

                  return (
                    <tr 
                      key={user.id} 
                      className={`hover:bg-amber-50/20 transition-colors group ${
                        isSelected ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-2 px-3 text-center">
                        <button onClick={() => toggleSelectOne(user.id)} className="text-slate-500 hover:text-slate-900">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-300" />
                          )}
                        </button>
                      </td>

                      {/* User Profile */}
                      <td className={isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3'}>
                        <div className="flex items-center gap-2.5">
                          <div className={`rounded-lg bg-[#F5F2EB] border border-[#E6E0D5] flex items-center justify-center font-black text-slate-800 shadow-2xs flex-shrink-0 ${
                            isCompact ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-xs'
                          }`}>
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-bold text-slate-900 group-hover:text-amber-800 transition-colors truncate text-xs">
                                {user.full_name || 'Anonymous User'}
                              </p>
                              {user.is_verified && (
                                <CheckCircle className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" title="KYC Verified" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 truncate">
                              <span className="truncate">{user.email || 'No email'}</span>
                              {user.email && (
                                <button
                                  onClick={() => copyToClipboard(user.email, 'Email')}
                                  className="text-slate-400 hover:text-slate-700 p-0.5"
                                  title="Copy email"
                                >
                                  {copiedText === user.email ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-1.5 px-2.5 text-[11px] font-medium text-slate-700 whitespace-nowrap">
                        {user.phone ? (
                          <div className="flex items-center gap-1">
                            <span>{user.phone}</span>
                            <button
                              onClick={() => copyToClipboard(user.phone, 'Phone')}
                              className="text-slate-400 hover:text-slate-700 p-0.5"
                              title="Copy phone"
                            >
                              {copiedText === user.phone ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Role Selector */}
                      <td className="py-1.5 px-2.5">
                        <select
                          value={user.role || 'customer'}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                          className={`text-[10.5px] font-black uppercase px-2 py-0.5 rounded-md border cursor-pointer outline-none transition-all ${roleConfig.color}`}
                        >
                          <option value="customer">Customer</option>
                          <option value="vendor">Vendor</option>
                          <option value="driver">Driver</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>

                      {/* Wallet Balance + Quick +₦1K Pill */}
                      <td className="py-1.5 px-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono text-xs font-black ${bal > 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {formatNaira(bal)}
                          </span>
                          {/* 1-Click Quick Credit Feature */}
                          <button
                            onClick={() => handleQuickCredit(user, 1000)}
                            className="px-1.5 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[9.5px] font-black transition-all"
                            title="Instant 1-Click +₦1,000 Credit"
                          >
                            +1K
                          </button>
                        </div>
                      </td>

                      {/* Status & KYC Quick Toggles */}
                      <td className="py-1.5 px-2.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleToggleSuspend(user)}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                              isSuspended
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                            title="Click to toggle suspension"
                          >
                            {isSuspended ? 'Suspended' : 'Active'}
                          </button>
                          <button
                            onClick={() => handleToggleVerify(user)}
                            className={`p-1 rounded-md border transition-all ${
                              user.is_verified
                                ? 'bg-sky-50 text-sky-700 border-sky-200'
                                : 'bg-stone-50 text-slate-400 border-stone-200'
                            }`}
                            title={user.is_verified ? 'KYC Verified (click to revoke)' : 'Unverified (click to verify)'}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Registered Date */}
                      <td className="py-1.5 px-2.5 text-[10.5px] text-slate-500 font-medium whitespace-nowrap">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : 'Recent'}
                      </td>

                      {/* Actions */}
                      <td className="py-1.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Instant WhatsApp Template Launcher */}
                          {user.phone ? (
                            <button
                              onClick={() => {
                                const templates = getWhatsAppTemplates(user);
                                setWhatsappModal({ open: true, user, message: templates[0].msg });
                              }}
                              className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all border border-transparent hover:border-emerald-200"
                              title="Send WhatsApp Business Template"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          ) : null}

                          {/* Inspect Modal */}
                          <button
                            onClick={() => { setSelectedUser(user); setShowDetailModal(true); }}
                            className="p-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-stone-100 transition-all"
                            title="View Full Profile"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Custom Amount Wallet Adjust Modal */}
                          <button
                            onClick={() => { setSelectedUser(user); setShowWalletModal(true); }}
                            className="p-1 rounded-lg text-amber-700 hover:bg-amber-50 transition-all"
                            title="Credit / Debit Wallet"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            title="Delete Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── WHATSAPP TEMPLATES LAUNCHER MODAL (KILLER FEATURE) ── */}
      {whatsappModal.open && whatsappModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-xl border border-[#E6E0D5] relative">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">WhatsApp Notification Hub</h3>
                  <p className="text-[11px] text-slate-500 font-medium">To: {whatsappModal.user.full_name || 'User'} ({whatsappModal.user.phone})</p>
                </div>
              </div>
              <button
                onClick={() => setWhatsappModal({ open: false, user: null, message: '' })}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-stone-100 transition-all text-xs"
              >
                ✕
              </button>
            </div>

            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Select Message Template:</p>
            <div className="space-y-1.5 mb-3.5">
              {getWhatsAppTemplates(whatsappModal.user).map((tmpl, idx) => (
                <button
                  key={idx}
                  onClick={() => setWhatsappModal(prev => ({ ...prev, message: tmpl.msg }))}
                  className={`w-full text-left p-2 rounded-xl border text-xs transition-all ${
                    whatsappModal.message === tmpl.msg
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold'
                      : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-slate-700'
                  }`}
                >
                  <span className="block font-black text-[11px] uppercase tracking-wider text-emerald-800">{tmpl.title}</span>
                  <span className="line-clamp-2 text-[10.5px] opacity-80 mt-0.5">{tmpl.msg}</span>
                </button>
              ))}
            </div>

            <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              Customized Message Content:
            </label>
            <textarea
              value={whatsappModal.message}
              onChange={(e) => setWhatsappModal(prev => ({ ...prev, message: e.target.value }))}
              rows={3}
              className="w-full p-2.5 bg-[#F5F2EB]/50 border border-[#E6E0D5] rounded-xl text-xs focus:outline-none focus:border-emerald-600 text-slate-900 font-medium mb-3.5"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setWhatsappModal({ open: false, user: null, message: '' })}
                className="px-3.5 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-slate-600 hover:bg-stone-50"
              >
                Cancel
              </button>
              <a
                href={`https://wa.me/${whatsappModal.user.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(whatsappModal.message)}`}
                target="_blank"
                rel="noreferrer"
                onClick={() => setWhatsappModal({ open: false, user: null, message: '' })}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black transition-all shadow-xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Launch WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE USER MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-xl border border-[#E6E0D5] relative">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Add Account</h3>
                <p className="text-[11px] text-slate-500">Register customer, vendor, driver or admin.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-stone-100 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sani Muhammad"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F5F2EB]/50 border border-[#E6E0D5] rounded-xl text-xs focus:outline-none focus:border-amber-600 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="user@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F5F2EB]/50 border border-[#E6E0D5] rounded-xl text-xs focus:outline-none focus:border-amber-600 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Min 6 chars"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F5F2EB]/50 border border-[#E6E0D5] rounded-xl text-xs focus:outline-none focus:border-amber-600 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  placeholder="08012345678"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F5F2EB]/50 border border-[#E6E0D5] rounded-xl text-xs focus:outline-none focus:border-amber-600 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-3 py-2 bg-[#F5F2EB]/50 border border-[#E6E0D5] rounded-xl text-xs focus:outline-none focus:border-amber-600 text-slate-900 font-bold"
                >
                  <option value="customer">Customer (Shopper)</option>
                  <option value="vendor">Vendor (Store Merchant)</option>
                  <option value="driver">Driver (Logistics Courier)</option>
                  <option value="admin">Admin (System Access)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-slate-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Saving…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── WALLET CREDIT/DEBIT MODAL WITH PRESET QUICK PICKS ── */}
      {showWalletModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-sm rounded-2xl p-5 shadow-xl border border-[#E6E0D5] relative">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-3">
              <div className="flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-700" />
                <h3 className="text-sm font-black text-slate-900">Wallet Adjustment</h3>
              </div>
              <button
                onClick={() => setShowWalletModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-stone-100 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="mb-3 p-2.5 rounded-xl bg-[#F5F2EB]/60 border border-[#E6E0D5]">
              <span className="text-[10.5px] text-slate-500 font-bold block">Account: {selectedUser.full_name || selectedUser.email}</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-slate-600">Current Balance:</span>
                <span className="text-base font-black text-emerald-800 font-mono">
                  {formatNaira(selectedUser.wallet?.balance || 0)}
                </span>
              </div>
            </div>

            {/* Quick Amount Presets */}
            <div className="grid grid-cols-4 gap-1.5 mb-3">
              {['1000', '5000', '10000', '50000'].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setWalletAmount(val)}
                  className={`py-1 rounded-lg text-[11px] font-bold border transition-all ${
                    walletAmount === val
                      ? 'bg-amber-100 border-amber-400 text-amber-900'
                      : 'bg-stone-50 border-stone-200 text-slate-700 hover:bg-stone-100'
                  }`}
                >
                  +{formatNaira(val)}
                </button>
              ))}
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Amount in Naira (₦)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F2EB]/50 border border-[#E6E0D5] rounded-xl text-sm focus:outline-none focus:border-amber-600 text-slate-900 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Reason / Memo
                </label>
                <input
                  type="text"
                  placeholder="e.g. Manual refund, promotion"
                  value={walletReason}
                  onChange={(e) => setWalletReason(e.target.value)}
                  className="w-full px-3 py-2 bg-[#F5F2EB]/50 border border-[#E6E0D5] rounded-xl text-xs focus:outline-none focus:border-amber-600 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowWalletModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-slate-600 hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustWallet('debit')}
                  className="px-3.5 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-all"
                >
                  Debit
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustWallet('credit')}
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs"
                >
                  Credit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── USER DETAILS DRAWER / MODAL ── */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl p-5 shadow-xl border border-[#E6E0D5] relative">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-[#F5F2EB] border border-[#E6E0D5] flex items-center justify-center font-black text-sm text-slate-800 shadow-2xs">
                  {(selectedUser.full_name || selectedUser.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">
                    {selectedUser.full_name || 'Anonymous User'}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">ID: {selectedUser.id}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-stone-100 text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-[#F5F2EB]/60 border border-[#E6E0D5] text-xs">
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider block mb-0.5">Role</span>
                  <span className="font-bold capitalize text-slate-900">{selectedUser.role || 'customer'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider block mb-0.5">Status</span>
                  <span className={`inline-flex items-center gap-1 font-bold ${
                    selectedUser.suspended || selectedUser.is_banned ? 'text-rose-600' : 'text-emerald-700'
                  }`}>
                    {selectedUser.suspended || selectedUser.is_banned ? 'Suspended' : 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider block mb-0.5">Wallet Float</span>
                  <span className="font-black text-emerald-800 font-mono">{formatNaira(selectedUser.wallet?.balance || 0)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider block mb-0.5">KYC Verified</span>
                  <span className={`font-bold ${selectedUser.is_verified ? 'text-sky-700' : 'text-slate-500'}`}>
                    {selectedUser.is_verified ? 'Verified Citizen' : 'Unverified'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl border border-stone-200 bg-white">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-700" /> Email:
                  </span>
                  <strong className="text-slate-800 font-mono text-[11px]">{selectedUser.email || 'N/A'}</strong>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl border border-stone-200 bg-white">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-amber-700" /> Phone:
                  </span>
                  <strong className="text-slate-800 font-mono text-[11px]">{selectedUser.phone || 'N/A'}</strong>
                </div>

                {selectedUser.phone && (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        const templates = getWhatsAppTemplates(selectedUser);
                        setWhatsappModal({ open: true, user: selectedUser, message: templates[0].msg });
                      }}
                      className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                      <span>WhatsApp Notification</span>
                    </button>
                    <a
                      href={`tel:${selectedUser.phone}`}
                      className="flex-1 py-2 px-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-800 hover:bg-sky-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Phone className="w-3.5 h-3.5 text-sky-700" />
                      <span>Direct Call</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleVerify(selectedUser)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    selectedUser.is_verified
                      ? 'border-stone-200 text-slate-600 hover:bg-stone-50'
                      : 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
                  }`}
                >
                  {selectedUser.is_verified ? 'Revoke KYC' : 'Verify KYC'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSuspend(selectedUser)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-2xs ${
                      selectedUser.suspended || selectedUser.is_banned
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    {selectedUser.suspended || selectedUser.is_banned ? 'Restore' : 'Suspend'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDetailModal(false)}
                    className="px-3.5 py-1.5 rounded-xl border border-stone-200 text-xs font-bold text-slate-600 hover:bg-stone-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;