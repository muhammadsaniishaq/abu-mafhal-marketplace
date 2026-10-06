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
  admin: { label: 'Admin', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  vendor: { label: 'Vendor', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  driver: { label: 'Driver', color: 'text-sky-700 bg-sky-50 border-sky-200' },
  buyer: { label: 'Customer', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  customer: { label: 'Customer', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
};

const TIERS = [
  { min: 1000000, label: 'Diamond VIP', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { min: 250000, label: 'Gold Tier', color: 'text-amber-800 bg-amber-50 border-amber-200' },
  { min: 50000, label: 'Silver Tier', color: 'text-slate-700 bg-slate-100 border-slate-200' },
  { min: 0, label: 'Bronze Tier', color: 'text-amber-900 bg-amber-50 border-amber-200' }
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
    role: 'customer'
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
      setNewUser({ name: '', email: '', password: '', phone: '', role: 'customer' });
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
      showToast('success', `User role successfully updated to ${newRole.toUpperCase()}`);
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
    <div className="space-y-6 text-slate-800 animate-fadeIn">
      {/* ── PRISTINE LUXURY LIGHT HEADER ── */}
      <div className="relative overflow-hidden bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black tracking-widest uppercase mb-2">
              <Users className="w-3.5 h-3.5 text-amber-600" />
              <span>User Directory & Permissions</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Platform User Management
            </h1>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl font-medium">
              Monitor active shoppers, accredited store vendors, logistics drivers, and privileged system administrators.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
              title="Export as CSV"
            >
              <Download className="w-4 h-4 text-amber-600" />
              <span>Export CSV</span>
            </button>

            <button
              onClick={fetchUsers}
              className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-all hover:scale-[1.05]"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-amber-600' : ''}`} />
            </button>

            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <UserPlus className="w-4 h-4 text-amber-400" />
              <span>Create User</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── TOAST ALERT ── */}
      {toast.text && (
        <div className={`p-4 rounded-2xl text-sm font-semibold border flex items-center justify-between shadow-sm transition-all ${
          toast.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{toast.text}</span>
          <button onClick={() => setToast({ type: '', text: '' })} className="text-xs opacity-70 hover:opacity-100 font-bold px-2 py-1">✕</button>
        </div>
      )}

      {/* ── KPI METRICS CARDS (LIGHT THEME) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Total Accounts</span>
            <Users className="w-4 h-4 text-slate-700" />
          </div>
          <h3 className="text-2xl font-black text-slate-900">{users.length}</h3>
          <p className="text-xs text-slate-500 mt-1">{customersCount} Customers · {adminsCount} Admins</p>
        </div>

        {/* Vendors */}
        <div className="bg-white p-5 rounded-2xl border border-orange-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-orange-50/30 to-white">
          <div className="flex items-center justify-between text-orange-700 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Active Vendors</span>
            <Star className="w-4 h-4 text-orange-600" />
          </div>
          <h3 className="text-2xl font-black text-slate-900">{vendorsCount}</h3>
          <p className="text-xs text-slate-500 mt-1">Accredited Store Merchants</p>
        </div>

        {/* Logistics Drivers */}
        <div className="bg-white p-5 rounded-2xl border border-sky-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-sky-50/30 to-white">
          <div className="flex items-center justify-between text-sky-700 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Fleet Drivers</span>
            <ShieldCheck className="w-4 h-4 text-sky-600" />
          </div>
          <h3 className="text-2xl font-black text-slate-900">{driversCount}</h3>
          <p className="text-xs text-slate-500 mt-1">Fulfillment Couriers</p>
        </div>

        {/* Total Wallet Liquidity */}
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm relative overflow-hidden bg-gradient-to-br from-emerald-50/30 to-white">
          <div className="flex items-center justify-between text-emerald-700 mb-2">
            <span className="text-[11px] font-black uppercase tracking-wider">Platform Liquidity</span>
            <Wallet className="w-4 h-4 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-black text-emerald-700">{formatNaira(totalBalance)}</h3>
          <p className="text-xs text-slate-500 mt-1">{verifiedCount} KYC Verified Accounts</p>
        </div>
      </div>

      {/* ── SEARCH & FILTER BAR ── */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full lg:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search name, email, phone, role…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-slate-400 transition-all text-slate-900 placeholder-slate-400 font-medium"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-700">✕</button>
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
                    ? 'bg-slate-900 text-white border-slate-900 font-black shadow-sm'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
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
        <div className="p-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-sm text-center">
          <div className="w-10 h-10 border-4 border-slate-900 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-bold text-slate-600">Synchronizing user accounts…</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-20 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900">No accounts found</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">Try clearing your search query or switching the active category filter.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-5">User Profile</th>
                  <th className="py-4 px-4">Contact Phone</th>
                  <th className="py-4 px-4">Permission Role</th>
                  <th className="py-4 px-4">Wallet Balance</th>
                  <th className="py-4 px-4 text-center">KYC & Status</th>
                  <th className="py-4 px-4">Registered</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredUsers.map((user) => {
                  const isSuspended = user.suspended === true || user.is_banned === true;
                  const roleConfig = ROLES[user.role] || ROLES.customer;
                  const initial = (user.full_name || user.email || 'U')[0].toUpperCase();
                  const bal = user.wallet?.balance || 0;

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors group">
                      {/* User Profile */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-sm text-slate-800 shadow-sm flex-shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors truncate">
                                {user.full_name || 'Anonymous User'}
                              </p>
                              {user.is_verified && (
                                <CheckCircle className="w-3.5 h-3.5 text-sky-600 flex-shrink-0" title="KYC Verified" />
                              )}
                            </div>
                            <p className="text-xs text-slate-400 truncate">{user.email || 'No email'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="py-4 px-4 text-xs font-medium text-slate-700">
                        {user.phone || 'Not provided'}
                      </td>

                      {/* Role Selector */}
                      <td className="py-4 px-4">
                        <select
                          value={user.role || 'customer'}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                          className={`text-xs font-black uppercase px-2.5 py-1 rounded-lg border cursor-pointer outline-none transition-all ${roleConfig.color}`}
                        >
                          <option value="customer">Customer</option>
                          <option value="vendor">Vendor</option>
                          <option value="driver">Driver</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>

                      {/* Wallet Balance */}
                      <td className="py-4 px-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono text-xs font-bold">
                          <Wallet className="w-3 h-3 text-emerald-600" />
                          <span>{formatNaira(bal)}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          isSuspended
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>

                      {/* Registered Date */}
                      <td className="py-4 px-4 text-xs text-slate-500 font-medium">
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
                              className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                              title="Chat on WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          )}

                          {/* Inspect Modal */}
                          <button
                            onClick={() => { setSelectedUser(user); setShowDetailModal(true); }}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                            title="Inspect Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Adjust Wallet */}
                          <button
                            onClick={() => { setSelectedUser(user); setShowWalletModal(true); }}
                            className="p-2 rounded-xl text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                            title="Credit / Debit Wallet"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>

                          {/* Toggle Suspend */}
                          <button
                            onClick={() => handleToggleSuspend(user)}
                            className={`p-2 rounded-xl transition-all ${
                              isSuspended
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-rose-500 hover:bg-rose-50'
                            }`}
                            title={isSuspended ? 'Restore User' : 'Suspend Account'}
                          >
                            {isSuspended ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-black text-slate-900">Create Platform Account</h3>
                <p className="text-xs text-slate-500">Register a new client, store merchant, or admin.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Legal Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Aliko Dangote"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="user@marketplace.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="08012345678"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-900 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  System Role
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-900 font-bold"
                >
                  <option value="customer">Customer (Shopper)</option>
                  <option value="vendor">Vendor (Merchant Store)</option>
                  <option value="driver">Driver (Fulfillment Courier)</option>
                  <option value="admin">Admin (Full Control)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider shadow-md transition-all disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-black text-slate-900">Adjust Wallet Balance</h3>
              </div>
              <button
                onClick={() => setShowWalletModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-xs text-slate-500">Target Account:</p>
              <p className="text-sm font-bold text-slate-900">{selectedUser.full_name || selectedUser.email}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">Current Balance:</span>
                <span className="text-base font-black text-emerald-700 font-mono">
                  {formatNaira(selectedUser.wallet?.balance || 0)}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Amount in Naira (₦)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={walletAmount}
                  onChange={(e) => setWalletAmount(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Transaction Reason / Memo
                </label>
                <input
                  type="text"
                  placeholder="e.g. Loyalty bonus, manual refund"
                  value={walletReason}
                  onChange={(e) => setWalletReason(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-300 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowWalletModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustWallet('debit')}
                  className="px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-bold transition-all"
                >
                  Debit Funds
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustWallet('credit')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-base text-slate-800 shadow-sm">
                  {(selectedUser.full_name || selectedUser.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">
                    {selectedUser.full_name || 'Anonymous User'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedUser.id}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wider block mb-1">System Role</span>
                  <span className="font-bold capitalize text-slate-900">{selectedUser.role || 'customer'}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wider block mb-1">Status</span>
                  <span className={`inline-flex items-center gap-1 font-bold ${
                    selectedUser.suspended || selectedUser.is_banned ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {selectedUser.suspended || selectedUser.is_banned ? 'Suspended' : 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wider block mb-1">Wallet Float</span>
                  <span className="font-black text-emerald-700 text-sm font-mono">{formatNaira(selectedUser.wallet?.balance || 0)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold uppercase tracking-wider block mb-1">KYC Verification</span>
                  <span className={`font-bold ${selectedUser.is_verified ? 'text-sky-600' : 'text-slate-400'}`}>
                    {selectedUser.is_verified ? 'Verified Citizen' : 'Unverified'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white">
                  <span className="text-slate-500 font-semibold flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address:
                  </span>
                  <strong className="text-slate-800 font-mono">{selectedUser.email || 'N/A'}</strong>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white">
                  <span className="text-slate-500 font-semibold flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Telephone:
                  </span>
                  <strong className="text-slate-800 font-mono">{selectedUser.phone || 'N/A'}</strong>
                </div>

                {selectedUser.phone && (
                  <div className="flex gap-2 pt-1">
                    <a
                      href={`https://wa.me/${selectedUser.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span>WhatsApp Chat</span>
                    </a>
                    <a
                      href={`tel:${selectedUser.phone}`}
                      className="flex-1 py-2.5 px-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-700 hover:bg-sky-100 text-xs font-bold flex items-center justify-center gap-2 transition-all"
                    >
                      <Phone className="w-4 h-4 text-sky-600" />
                      <span>Direct Phone Call</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleToggleVerify(selectedUser)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                    selectedUser.is_verified
                      ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      : 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
                  }`}
                >
                  {selectedUser.is_verified ? 'Revoke KYC' : 'Verify KYC'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleSuspend(selectedUser)}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
                      selectedUser.suspended || selectedUser.is_banned
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'
                    }`}
                  >
                    {selectedUser.suspended || selectedUser.is_banned ? 'Restore User' : 'Suspend User'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDetailModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
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