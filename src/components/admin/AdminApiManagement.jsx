import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Key, RefreshCw, CheckCircle2, XCircle, Trash2, Shield,
  AlertCircle, Eye, EyeOff, Clock, User, Activity,
  ShieldCheck, ShieldX, Lock, Unlock, Search, Filter,
  Copy, Check, ChevronDown, Terminal
} from 'lucide-react';

const ADMIN_API_URL = '/api/v1/admin-api-keys';

export default function AdminApiManagement() {
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({});
  const [accessRequests, setAccessRequests] = useState([]);
  const [issuedKeys, setIssuedKeys] = useState([]);
  const [activeTab, setActiveTab] = useState('requests'); // 'requests' | 'keys'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);
  const [revealedKeys, setRevealedKeys] = useState({});
  const [copiedKey, setCopiedKey] = useState(null);
  const [reasonModal, setReasonModal] = useState(null); // { vendor_id, action }
  const [reasonText, setReasonText] = useState('');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const getAuthHeader = useCallback(() => {
    const token = currentUser?.access_token || currentUser?.token || currentUser?.session?.access_token || '';
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [currentUser]);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(ADMIN_API_URL, {
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() }
      });
      const json = await res.json();
      if (json.status === 'success') {
        setAccessRequests(json.access_requests || []);
        setIssuedKeys(json.issued_keys || []);
        setStats(json.stats || {});
      } else {
        showToast(json.message || 'Failed to load API management data.', 'error');
      }
    } catch (e) {
      showToast('Network error fetching data.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [getAuthHeader]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (vendor_id, action) => {
    if (action === 'reject') {
      setReasonModal({ vendor_id, action });
      return;
    }
    await executeAction(vendor_id, action, '');
  };

  const executeAction = async (vendor_id, action, reason) => {
    setActionLoading(`${vendor_id}_${action}`);
    try {
      const res = await fetch(ADMIN_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ vendor_id, action, reason })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast(json.message);
        await fetchData(true);
      } else {
        showToast(json.message || 'Action failed.', 'error');
      }
    } catch (e) {
      showToast('Network error.', 'error');
    } finally {
      setActionLoading(null);
      setReasonModal(null);
      setReasonText('');
    }
  };

  const handleDeleteKey = async (key) => {
    if (!window.confirm(`Permanently revoke API key "${key.key_name || key.api_key?.substring(0, 20)}..."? This cannot be undone.`)) return;
    setActionLoading(`del_${key.id || key.api_key}`);
    try {
      const res = await fetch(ADMIN_API_URL, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
        body: JSON.stringify({ key_id: key.id, api_key: key.api_key })
      });
      const json = await res.json();
      if (json.status === 'success') {
        showToast('API Key permanently revoked.');
        await fetchData(true);
      } else {
        showToast(json.message || 'Failed to revoke key.', 'error');
      }
    } catch (e) {
      showToast('Network error.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const filteredRequests = accessRequests.filter(r => {
    const matchSearch = !searchTerm ||
      r.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.vendor_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.vendor_id?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const filteredKeys = issuedKeys.filter(k => {
    const vendorName = k.profiles?.business_name || k.profiles?.full_name || k.vendor_name || '';
    return !searchTerm ||
      vendorName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.key_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      k.api_key?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const statusBadge = (status) => {
    const map = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    };
    return `px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${map[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-[#00BFA5] animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading API Management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl text-xs font-bold shadow-xl flex items-center gap-2.5 transition-all ${
          toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.type === 'error' ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Reason Modal */}
      {reasonModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <ShieldX className="w-5 h-5 text-rose-500" />
              <h3 className="font-bold text-[#0A192F] text-sm">Reject API Access Request</h3>
            </div>
            <p className="text-xs text-slate-500">
              Provide a reason for rejection. This will be shown to the vendor.
            </p>
            <textarea
              value={reasonText}
              onChange={e => setReasonText(e.target.value)}
              placeholder="e.g. Store profile incomplete. Please verify your business details first."
              rows={3}
              className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-rose-400 resize-none"
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setReasonModal(null); setReasonText(''); }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => executeAction(reasonModal.vendor_id, reasonModal.action, reasonText)}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition-all disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-white border border-slate-200 shadow-sm p-6 lg:p-8">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0A192F]/3 via-transparent to-[#00BFA5]/5 pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0A192F]/5 border border-[#0A192F]/15 text-[#0A192F] text-xs font-bold tracking-wide uppercase">
              <Shield className="w-3.5 h-3.5 text-[#00BFA5]" />
              Admin Control
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-[#0A192F]">API Keys Management</h1>
            <p className="text-xs text-slate-500 max-w-xl">
              Review and approve vendor API access requests, manage issued keys, and enforce platform API governance.
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="px-5 py-2.5 rounded-2xl bg-[#0A192F] hover:bg-[#112240] text-white text-xs font-bold flex items-center gap-2 shadow-md cursor-pointer transition-all disabled:opacity-50 self-start lg:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Requests', value: stats.total_requests || 0, color: 'text-[#0A192F]', bg: 'bg-slate-50' },
          { label: 'Pending Review', value: stats.pending || 0, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Approved Access', value: stats.approved || 0, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Rejected', value: stats.rejected || 0, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Total Keys', value: stats.total_keys || 0, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Active Keys', value: stats.active_keys || 0, color: 'text-[#00BFA5]', bg: 'bg-teal-50' },
        ].map(s => (
          <div key={s.label} className={`p-4 rounded-2xl ${s.bg} border border-slate-200 flex flex-col`}>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide block">{s.label}</span>
            <span className={`text-2xl font-extrabold mt-1 ${s.color}`}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Tab + Search */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'requests' ? 'bg-[#0A192F] text-white shadow-sm' : 'text-slate-600 hover:text-[#0A192F]'}`}
          >
            <Clock className="w-3.5 h-3.5" />
            Access Requests
            {stats.pending > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {stats.pending}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('keys')}
            className={`px-4 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${activeTab === 'keys' ? 'bg-[#0A192F] text-white shadow-sm' : 'text-slate-600 hover:text-[#0A192F]'}`}
          >
            <Key className="w-3.5 h-3.5" />
            Issued API Keys
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-300 text-slate-700 text-[10px] font-bold">
              {stats.active_keys || 0}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search vendor, key..."
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#00BFA5] w-48"
            />
          </div>
          {activeTab === 'requests' && (
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#00BFA5] cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          )}
        </div>
      </div>

      {/* Access Requests Tab */}
      {activeTab === 'requests' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center border border-amber-200">
                <Lock className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0A192F]">Vendor API Access Requests</h2>
                <p className="text-[11px] text-slate-500">Approve or reject each vendor's Developer API access.</p>
              </div>
            </div>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Clock className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-400">No access requests found</p>
              <p className="text-xs text-slate-400">Vendor API access requests will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRequests.map(req => (
                <div key={req.id || req.vendor_id} className="p-5 hover:bg-slate-50/50 transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Vendor Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center border border-slate-200 shrink-0">
                        {req.vendor?.avatar_url ? (
                          <img src={req.vendor.avatar_url} alt="" className="w-full h-full rounded-xl object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#0A192F]">
                          {req.vendor?.business_name || req.vendor?.full_name || req.vendor_name || 'Unknown Vendor'}
                        </p>
                        <p className="text-xs text-slate-500">{req.vendor?.email || req.vendor_email || '—'}</p>
                        {req.note && (
                          <p className="text-xs text-slate-600 mt-1 italic bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 mt-1.5">
                            "{req.note}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Status + Dates + Actions */}
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className={statusBadge(req.status)}>{req.status}</span>
                        <p className="text-[10px] text-slate-400 mt-1">
                          Requested: {new Date(req.requested_at).toLocaleDateString()}
                        </p>
                        {req.reviewed_at && (
                          <p className="text-[10px] text-slate-400">
                            Reviewed: {new Date(req.reviewed_at).toLocaleDateString()}
                          </p>
                        )}
                        {req.admin_note && (
                          <p className="text-[10px] text-rose-500 mt-0.5 max-w-[200px] text-right">
                            Note: {req.admin_note}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {req.status !== 'approved' && (
                          <button
                            onClick={() => handleAction(req.vendor_id, 'approve')}
                            disabled={actionLoading === `${req.vendor_id}_approve`}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                          >
                            {actionLoading === `${req.vendor_id}_approve` ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            Approve
                          </button>
                        )}
                        {req.status !== 'rejected' && (
                          <button
                            onClick={() => handleAction(req.vendor_id, 'reject')}
                            disabled={actionLoading === `${req.vendor_id}_reject`}
                            className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                          >
                            {actionLoading === `${req.vendor_id}_reject` ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            Reject
                          </button>
                        )}
                        {req.status === 'approved' && (
                          <button
                            onClick={() => handleAction(req.vendor_id, 'revoke_all')}
                            disabled={actionLoading === `${req.vendor_id}_revoke_all`}
                            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                          >
                            {actionLoading === `${req.vendor_id}_revoke_all` ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Lock className="w-3.5 h-3.5" />
                            )}
                            Revoke All Keys
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Issued Keys Tab */}
      {activeTab === 'keys' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-200">
                <Key className="w-4 h-4 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0A192F]">All Issued API Keys</h2>
                <p className="text-[11px] text-slate-500">
                  View and permanently revoke any vendor's individual keys.
                </p>
              </div>
            </div>
          </div>

          {filteredKeys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <Key className="w-10 h-10 text-slate-300" />
              <p className="text-sm font-semibold text-slate-400">No API keys issued yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredKeys.map(key => {
                const isTest = key.key_type === 'test' || key.api_key?.includes('_test_');
                const isRevealed = revealedKeys[key.id || key.api_key];
                const displayedKey = isRevealed ? key.api_key : `${key.api_key?.substring(0, 20)}••••••••••••••`;
                const vendorName = key.profiles?.business_name || key.profiles?.full_name || key.vendor_name || 'Unknown';
                const isActive = key.is_active !== false;

                return (
                  <div key={key.id || key.api_key} className={`p-5 hover:bg-slate-50/50 transition-all ${!isActive ? 'opacity-60' : ''}`}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs text-[#0A192F]">
                            {key.key_name || (isTest ? 'Sandbox Test Key' : 'Production Key')}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isTest ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                            {isTest ? 'TEST' : 'LIVE'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                            {isActive ? 'ACTIVE' : 'REVOKED'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-600 font-medium">{vendorName}</span>
                          {key.profiles?.email && (
                            <span className="text-[11px] text-slate-400">({key.profiles.email})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono bg-slate-100 px-2 py-1 rounded-lg border border-slate-200 text-slate-700 select-all">
                            {displayedKey}
                          </code>
                          <button
                            onClick={() => setRevealedKeys(prev => ({ ...prev, [key.id || key.api_key]: !prev[key.id || key.api_key] }))}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                          >
                            {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => copyToClipboard(key.api_key, key.id || key.api_key)}
                            className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                          >
                            {copiedKey === (key.id || key.api_key) ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 shrink-0">
                        <div className="text-right text-[11px] text-slate-500 space-y-0.5">
                          <p><span className="font-semibold">Calls:</span> {key.total_requests || 0}</p>
                          <p><span className="font-semibold">Created:</span> {new Date(key.created_at || Date.now()).toLocaleDateString()}</p>
                          {key.last_used_at && (
                            <p><span className="font-semibold">Last used:</span> {new Date(key.last_used_at).toLocaleDateString()}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteKey(key)}
                          disabled={actionLoading === `del_${key.id || key.api_key}`}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 hover:text-rose-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all disabled:opacity-50"
                        >
                          {actionLoading === `del_${key.id || key.api_key}` ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Revoke Key
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Policy Info */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <ShieldCheck className="w-4 h-4 text-[#00BFA5]" />
          <h3 className="text-sm font-bold text-[#0A192F]">API Access Control Policy</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="font-bold text-[#0A192F] mb-1">Step 1 — Vendor Requests</p>
            <p>Vendor clicks "Request API Access" in their Developer API portal. A request lands here for admin review.</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="font-bold text-[#0A192F] mb-1">Step 2 — Admin Reviews</p>
            <p>Admin approves or rejects with optional reason. Approved vendors can immediately generate Live and Test keys.</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <p className="font-bold text-[#0A192F] mb-1">Step 3 — Ongoing Governance</p>
            <p>Admin can revoke individual keys or all keys for a vendor at any time. Revoking blocks all API calls instantly.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
