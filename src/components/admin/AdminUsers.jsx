import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import { 
  Users, Search, UserPlus, Shield, CheckCircle, 
  XCircle, Mail, Phone, Calendar, RefreshCw, Eye,
  Trash2, UserCheck, UserX, ChevronDown, Wallet,
  Download, MessageCircle, AlertTriangle, ShieldCheck,
  Star, DollarSign, Filter, MoreVertical, Sparkles,
  ArrowUpRight, ArrowDownRight, Tag
} from 'lucide-react';

const ROLES = {
  admin: { label: 'Admin', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' },
  vendor: { label: 'Vendor', color: 'text-amber-400 bg-amber-500/10 border-amber-500/30' },
  driver: { label: 'Driver', color: 'text-sky-400 bg-sky-500/10 border-sky-500/30' },
  buyer: { label: 'Customer', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  customer: { label: 'Customer', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' }
};

const TIERS = [
  { min: 1000000, label: 'Diamond VIP', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { min: 250000, label: 'Gold Tier', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { min: 50000, label: 'Silver Tier', color: 'text-slate-300 bg-slate-500/10 border-slate-500/20' },
  { min: 0, label: 'Bronze Tier', color: 'text-amber-600 bg-amber-600/10 border-amber-600/20' }
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

  // Modals & Panels
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState([]);

  // New user form state
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'buyer'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 4500);
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
      setNewUser({ name: '', email: '', password: '', phone: '', role: 'buyer' });
      fetchUsers();
    } catch (error) {
      showToast('error', 'Account registration failed: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    if (!window.confirm(`Are you sure you want to change this user's role to "${newRole.toUpperCase()}"?`)) return;

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
      showToast('success', `User role successfully upgraded to ${newRole.toUpperCase()}`);
    } catch (error) {
      showToast('error', 'Role update failed: ' + error.message);
    }
  };

  const handleToggleSuspend = async (user) => {
    const nextSuspended = !user.suspended && !user.is_banned;
    const confirmMsg = nextSuspended 
      ? `Are you sure you want to suspend access for "${user.full_name || user.email}"?`
      : `Restore active marketplace access for "${user.full_name || user.email}"?`;

    if (!window.confirm(confirmMsg)) return;

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
      showToast('success', nextSuspended ? 'Account suspended successfully.' : 'Account access restored.');
    } catch (error) {
      showToast('error', 'Could not update account suspension: ' + error.message);
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
      showToast('success', nextVerified ? 'User KYC verified.' : 'KYC verification revoked.');
    } catch (error) {
      showToast('error', 'Verification toggle failed: ' + error.message);
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

      // Record transaction log if available
      try {
        await supabase.from('wallet_transactions').insert({
          user_id: selectedUser.id,
          amount: amt,
          type: type === 'credit' ? 'admin_credit' : 'admin_debit',
          description: walletReason.trim() || `Admin manual ${type}`,
          status: 'completed'
        });
      } catch (e) {}

      showToast('success', `Wallet successfully ${type === 'credit' ? 'credited' : 'debited'} with ${formatNaira(amt)}.`);
      setShowWalletModal(false);
      setWalletAmount('');
      setWalletReason('');
      fetchUsers();
    } catch (error) {
      showToast('error', 'Wallet adjustment error: ' + error.message);
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
      showToast('success', 'User permanently deleted from system.');
    } catch (error) {
      showToast('error', 'Failed to delete user: ' + error.message);
    }
  };

  const exportCSV = () => {
    const headers = ['Full Name', 'Email', 'Phone', 'Role', 'Wallet Balance', 'KYC Verified', 'Suspended', 'Joined'];
    const rows = filteredUsers.map(u => [
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

  return (
    <div className="space-y-6 text-slate-100 animate-fadeIn">
      {/* ── LUXURY HEADER ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#071422] via-[#0B1B2F] to-[#071422] p-6 sm:p-8 rounded-3xl border border-[#D9A73A]/25 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-[#D9A73A]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D9A73A]/10 border border-[#D9A73A]/30 text-[#D9A73A] text-xs font-black tracking-widest uppercase mb-2">
              <Users className="w-3.5 h-3.5" />
              <span>User Directory & Permissions</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              Platform User Management
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Monitor active shoppers, accredited store vendors, logistics drivers, and privileged system administrators.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Export as CSV"
            >
              <Download className="w-4 h-4 text-[#D9A73A]" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={fetchUsers}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 transition-all hover:scale-[1.05]"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#D9A73A]' : ''}`} />
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#D9A73A] to-[#B8860B] hover:from-[#E5B548] hover:to-[#C9961B] text-[#071422] font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-[#D9A73A]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create User</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── TOAST ALERT ── */}
      {toast.text && (
        <div className={`p-4 rounded-2xl text-sm font-semibold border flex items-center justify-between shadow-xl transition-all ${
          toast.type === 'success' 
            ? 'bg-emerald-950/80 text-emerald-200 border-emerald-500/40 backdrop-blur-md' 
            : 'bg-rose-950/80 text-rose-200 border-rose-500/40 backdrop-blur-md'
        }`}>
          <span>{toast.text}</span>
          <button onClick={() => setToast({ type: '', text: '' })} className="text-xs opacity-70 hover:opacity-100 font-bold px-2 py-1">✕</button>
        </div>
      )}

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-[#0B1B2F] p-5 rounded-2xl border border-[#D9A73A]/20 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Total Accounts</span>
            <Users className="w-4 h-4 text-[#D9A73A]" />
          </div>
          <h3 className="text-2xl font-black text-white">{users.length}</h3>
          <p className="text-xs text-slate-400 mt-1">{customersCount} Customers · {adminsCount} Admins</p>
        </div>

        {/* Vendors */}
        <div className="bg-[#0B1B2F] p-5 rounded-2xl border border-amber-500/20 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Active Vendors</span>
            <Star className="w-4 h-4 text-amber-400" />
          </div>
          <h3 className="text-2xl font-black text-white">{vendorsCount}</h3>
          <p className="text-xs text-slate-400 mt-1">Accredited Store Merchants</p>
        </div>

        {/* Logistics Drivers */}
        <div className="bg-[#0B1B2F] p-5 rounded-2xl border border-sky-500/20 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-sky-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Fleet Drivers</span>
            <ShieldCheck className="w-4 h-4 text-sky-400" />
          </div>
          <h3 className="text-2xl font-black text-white">{driversCount}</h3>
          <p className="text-xs text-slate-400 mt-1">Fulfillment Couriers</p>
        </div>

        {/* Total Wallet Liquidity */}
        <div className="bg-[#0B1B2F] p-5 rounded-2xl border border-emerald-500/20 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Platform Liquidity</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <h3 className="text-2xl font-black text-emerald-400">{formatNaira(totalBalance)}</h3>
          <p className="text-xs text-slate-400 mt-1">{verifiedCount} KYC Verified Accounts</p>
        </div>
      </div>

      {/* ── SEARCH & FILTER BAR ── */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-[#0B1B2F] p-4 rounded-2xl border border-[#D9A73A]/20 shadow-md">
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-[#D9A73A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or role…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-[#D9A73A] transition-all text-white placeholder-slate-500 font-medium"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white">✕</button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
          {[
            { id: 'all', label: `All (${users.length})` },
            { id: 'customer', label: `Customers (${customersCount})` },
            { id: 'vendor', label: `Vendors (${vendorsCount})` },
            { id: 'driver', label: `Drivers (${driversCount})` },
            { id: 'admin', label: `Admins (${adminsCount})` },
            { id: 'verified', label: `Verified (${verifiedCount})` },
            { id: 'wallet', label: 'Has Balance' },
            { id: 'suspended', label: `Suspended (${suspendedCount})` },
          ].map(p => {
            const active = filter === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setFilter(p.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                  active
                    ? 'bg-[#D9A73A] text-[#071422] border-[#D9A73A] font-black shadow-md'
                    : 'bg-white/5 text-slate-300 border-white/5 hover:bg-white/10 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── USER TABLE ── */}
      {loading ? (
        <div className="p-20 flex flex-col items-center justify-center bg-[#0B1B2F] rounded-3xl border border-[#D9A73A]/20 shadow-xl text-center">
          <div className="w-10 h-10 border-4 border-[#D9A73A] border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-300">Synchronizing user accounts…</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-20 flex flex-col items-center justify-center bg-[#0B1B2F] rounded-3xl border border-[#D9A73A]/20 shadow-xl text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 text-[#D9A73A] flex items-center justify-center mb-4 border border-white/10">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-white">No accounts found</h3>
          <p className="text-xs text-slate-400 max-w-sm mt-1">Try clearing your search query or switching the active category filter.</p>
        </div>
      ) : (
        <div className="bg-[#0B1B2F] rounded-3xl border border-[#D9A73A]/20 shadow-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-black/20 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-5">User Profile</th>
                  <th className="py-4 px-4">Contact Phone</th>
                  <th className="py-4 px-4">Permission Role</th>
                  <th className="py-4 px-4">Wallet Balance</th>
                  <th className="py-4 px-4 text-center">KYC & Status</th>
                  <th className="py-4 px-4">Registered</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredUsers.map((user) => {
                  const isSuspended = user.suspended === true || user.is_banned === true;
                  const roleConfig = ROLES[user.role] || ROLES.customer;
                  const initial = (user.full_name || user.email || 'U')[0].toUpperCase();
                  const bal = user.wallet?.balance || 0;

                  return (
                    <tr key={user.id} className="hover:bg-white/[0.03] transition-colors group">
                      {/* User Profile */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0F243E] to-[#16365C] border border-[#D9A73A]/30 flex items-center justify-center font-black text-sm text-[#D9A73A] shadow-md flex-shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-white group-hover:text-[#D9A73A] transition-colors truncate">
                                {user.full_name || 'Anonymous User'}
                              </p>
                              {user.is_verified && (
                                <CheckCircle className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" title="KYC Verified" />
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate">{user.email || 'No email'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-4 px-4 text-xs font-medium text-slate-300">
                        {user.phone || 'Not provided'}
                      </td>

                      {/* Role Selector */}
                      <td className="py-4 px-4">
                        <select
                          value={user.role || 'customer'}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                          className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg border cursor-pointer outline-none transition-all ${roleConfig.color} bg-black/40`}
                        >
                          <option value="customer" className="bg-[#071422] text-white">Customer</option>
                          <option value="vendor" className="bg-[#071422] text-white">Vendor</option>
                          <option value="driver" className="bg-[#071422] text-white">Driver</option>
                          <option value="admin" className="bg-[#071422] text-white">Admin</option>
                        </select>
                      </td>

                      {/* Wallet Balance */}
                      <td className="py-4 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono text-xs font-bold">
                          <Wallet className="w-3 h-3 text-emerald-400" />
                          <span>{formatNaira(bal)}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isSuspended
                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-rose-400' : 'bg-emerald-400'}`} />
                          {isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>

                      {/* Registered Date */}
                      <td className="py-4 px-4 text-xs text-slate-400 font-medium">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Recent'}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* WhatsApp Launcher */}
                          {user.phone && (
                            <a
                              href={`https://wa.me/${user.phone.replace(/[^0-9]/g, '')}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                              title="Chat on WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}

                          {/* Inspect Modal */}
                          <button
                            onClick={() => { setSelectedUser(user); setShowDetailModal(true); }}
                            className="p-2 rounded-xl text-slate-400 hover:text-[#D9A73A] hover:bg-[#D9A73A]/10 transition-all"
                            title="Inspect Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Adjust Wallet */}
                          <button
                            onClick={() => { setSelectedUser(user); setShowWalletModal(true); }}
                            className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all"
                            title="Credit / Debit Wallet"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>

                          {/* Toggle Suspend */}
                          <button
                            onClick={() => handleToggleSuspend(user)}
                            className={`p-2 rounded-xl transition-all ${
                              isSuspended
                                ? 'text-emerald-400 hover:bg-emerald-500/10'
                                : 'text-rose-400 hover:bg-rose-500/10'
                            }`}
                            title={isSuspended ? 'Restore User' : 'Suspend Account'}
                          >
                            {isSuspended ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
                            title="Delete User"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* ── CREATE USER MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B1B2F] w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#D9A73A]/30 relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div>
                <h3 className="text-lg font-black text-white">Create Platform Account</h3>
                <p className="text-xs text-slate-400">Register a new client, store merchant, or admin.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aliko Dangote"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#D9A73A] text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="user@marketplace.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#D9A73A] text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#D9A73A] text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="08012345678"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#D9A73A] text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  System Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#D9A73A] text-white font-bold"
                >
                  <option value="customer" className="bg-[#071422]">Customer (Shopper)</option>
                  <option value="vendor" className="bg-[#071422]">Vendor (Merchant Store)</option>
                  <option value="driver" className="bg-[#071422]">Driver (Fulfillment Courier)</option>
                  <option value="admin" className="bg-[#071422]">Admin (Full Control)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-slate-400 hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-[#D9A73A] hover:bg-[#E5B548] text-[#071422] text-xs font-black uppercase tracking-wider shadow-lg shadow-[#D9A73A]/20 transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Creating…' : 'Register Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── WALLET CREDIT/DEBIT MODAL ── */}
      {showWalletModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B1B2F] w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#D9A73A]/30 relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-[#D9A73A]" />
                <h3 className="text-lg font-black text-white">Adjust Wallet Balance</h3>
              </div>
              <button
                onClick={() => setShowWalletModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-4 rounded-2xl bg-black/30 border border-white/5">
              <p className="text-xs text-slate-400">Target Account:</p>
              <p className="text-sm font-bold text-white">{selectedUser.full_name || selectedUser.email}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-400">Current Balance:</span>
                <span className="text-base font-black text-emerald-400 font-mono">
                  {formatNaira(selectedUser.wallet?.balance || 0)}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Amount in Naira (₦)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#D9A73A] text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Transaction Reason / Memo
                </label>
                <input
                  type="text"
                  placeholder="e.g. Loyalty bonus, manual refund"
                  value={walletReason}
                  onChange={(e) => setWalletReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-[#D9A73A] text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowWalletModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-xs font-bold text-slate-400 hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustWallet('debit')}
                  className="px-4 py-2.5 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30 text-xs font-bold transition-all"
                >
                  Debit Funds
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustWallet('credit')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30 text-xs font-bold transition-all"
                >
                  Credit Funds
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── USER DETAILS DRAWER / MODAL ── */}
      {showDetailModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#0B1B2F] w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#D9A73A]/30 relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0F243E] to-[#16365C] border border-[#D9A73A]/40 flex items-center justify-center font-black text-base text-[#D9A73A] shadow-lg">
                  {(selectedUser.full_name || selectedUser.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-black text-white leading-tight">
                    {selectedUser.full_name || 'Anonymous User'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedUser.id}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-4 bg-black/30 rounded-2xl border border-white/5 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">System Role</span>
                  <span className="font-bold capitalize text-white">{selectedUser.role || 'customer'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Status</span>
                  <span className={`inline-flex items-center gap-1 font-bold ${
                    selectedUser.suspended || selectedUser.is_banned ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {selectedUser.suspended || selectedUser.is_banned ? 'Suspended' : 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Wallet Float</span>
                  <span className="font-black text-emerald-400 text-sm font-mono">{formatNaira(selectedUser.wallet?.balance || 0)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">KYC Verification</span>
                  <span className={`font-bold ${selectedUser.is_verified ? 'text-sky-400' : 'text-slate-400'}`}>
                    {selectedUser.is_verified ? 'Verified Citizen' : 'Unverified'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-black/20">
                  <span className="text-slate-400 font-semibold flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-[#D9A73A]" /> Email Address:
                  </span>
                  <strong className="text-white font-mono">{selectedUser.email || 'N/A'}</strong>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-black/20">
                  <span className="text-slate-400 font-semibold flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-[#D9A73A]" /> Telephone:
                  </span>
                  <strong className="text-white font-mono">{selectedUser.phone || 'N/A'}</strong>
                </div>

                {selectedUser.phone && (
                  <div className="flex gap-2 pt-1">
                    <a
                      href={`https://wa.me/${selectedUser.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp Chat</span>
                    </a>
                    <a
                      href={`tel:${selectedUser.phone}`}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 hover:bg-sky-500/20 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Direct Phone Call</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleVerify(selectedUser)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                    selectedUser.is_verified
                      ? 'border-slate-500/30 text-slate-300 hover:bg-white/5'
                      : 'border-sky-500/40 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20'
                  }`}
                >
                  {selectedUser.is_verified ? 'Revoke KYC' : 'Verify KYC'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSuspend(selectedUser)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md ${
                      selectedUser.suspended || selectedUser.is_banned
                        ? 'bg-emerald-500 hover:bg-emerald-600 text-[#071422]'
                        : 'bg-rose-500/20 border border-rose-500/40 text-rose-300 hover:bg-rose-500/30'
                    }`}
                  >
                    {selectedUser.suspended || selectedUser.is_banned ? 'Restore User' : 'Suspend User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 rounded-xl border border-white/10 text-xs font-bold text-slate-400 hover:bg-white/5 transition-all"
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