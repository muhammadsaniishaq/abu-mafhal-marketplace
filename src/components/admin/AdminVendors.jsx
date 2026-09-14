import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { 
  Store, Search, CheckCircle, XCircle, Shield, 
  Phone, Mail, MapPin, RefreshCw, Eye, AlertTriangle,
  UserCheck, UserX, Building2, Star, Edit, Save, Camera, X
} from 'lucide-react';

const AdminVendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editModalVendor, setEditModalVendor] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [toast, setToast] = useState({ type: '', text: '' });
  const [actionLoading, setActionLoading] = useState(false);

  // Edit Store form state
  const [editForm, setEditForm] = useState({
    business_name: '',
    category: '',
    about: '',
    cover_image: '',
    avatar_url: '',
    phone: '',
    address: '',
    is_recommended: false
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 4000);
  };

  const fetchVendors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Filter vendor profiles safely in JS
      const vendorList = (data || []).filter(p => p.role === 'vendor' || p.role === 'seller' || !!p.business_name);
      setVendors(vendorList);
    } catch (error) {
      console.error('Error fetching vendors:', error.message);
      showToast('error', 'Error loading vendors: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSuspend = async (vendor) => {
    const nextSuspended = !vendor.suspended;
    const confirmMsg = nextSuspended 
      ? `Are you sure you want to suspend vendor "${vendor.business_name || vendor.full_name}"?`
      : `Restore active status for vendor "${vendor.business_name || vendor.full_name}"?`;

    if (!window.confirm(confirmMsg)) return;

    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          suspended: nextSuspended,
          updated_at: new Date().toISOString()
        })
        .eq('id', vendor.id);

      if (error) throw error;

      setVendors(prev => prev.map(v => v.id === vendor.id ? { ...v, suspended: nextSuspended } : v));
      if (selectedVendor?.id === vendor.id) {
        setSelectedVendor(prev => ({ ...prev, suspended: nextSuspended }));
      }

      showToast('success', nextSuspended ? 'Vendor account suspended successfully.' : 'Vendor account restored to active.');
    } catch (error) {
      showToast('error', 'Failed to update status: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRecommend = async (vendor, e) => {
    if (e) e.stopPropagation();
    const nextRec = !vendor.is_recommended;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          is_recommended: nextRec,
          updated_at: new Date().toISOString()
        })
        .eq('id', vendor.id);

      if (error) throw error;

      setVendors(prev => prev.map(v => v.id === vendor.id ? { ...v, is_recommended: nextRec } : v));
      showToast('success', nextRec ? `Marked "${vendor.business_name || vendor.full_name}" as Recommended Vendor!` : `Removed recommendation from "${vendor.business_name || vendor.full_name}".`);
    } catch (err) {
      showToast('error', 'Failed to toggle recommendation: ' + err.message);
    }
  };

  const openEditModal = (vendor) => {
    let parsedAddr = {};
    if (vendor.address && vendor.address.startsWith('{')) {
      try { parsedAddr = JSON.parse(vendor.address); } catch (_) {}
    }

    setEditForm({
      business_name: vendor.business_name || vendor.full_name || '',
      category: vendor.business_category || parsedAddr.category || 'General Merchant',
      about: vendor.about || parsedAddr.about || '',
      cover_image: vendor.cover_image || parsedAddr.cover_image || '',
      avatar_url: vendor.avatar_url || '',
      phone: vendor.phone || vendor.phone_number || '',
      address: parsedAddr.address || vendor.address || vendor.state || '',
      is_recommended: vendor.is_recommended !== undefined ? !!vendor.is_recommended : (parsedAddr.is_recommended || false)
    });
    setEditModalVendor(vendor);
  };

  const handleSaveVendorStore = async (e) => {
    if (e) e.preventDefault();
    if (!editModalVendor) return;

    setSavingEdit(true);
    try {
      const addrPayload = JSON.stringify({
        address: editForm.address,
        about: editForm.about,
        cover_image: editForm.cover_image,
        category: editForm.category,
        business_name: editForm.business_name,
        is_recommended: editForm.is_recommended
      });

      const updates = {
        business_name: editForm.business_name,
        business_category: editForm.category,
        about: editForm.about,
        cover_image: editForm.cover_image,
        avatar_url: editForm.avatar_url,
        phone: editForm.phone,
        address: addrPayload,
        is_recommended: editForm.is_recommended,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', editModalVendor.id);

      if (error) throw error;

      setVendors(prev => prev.map(v => v.id === editModalVendor.id ? { ...v, ...updates } : v));
      showToast('success', `Updated store profile for "${editForm.business_name}"!`);
      setEditModalVendor(null);
    } catch (err) {
      showToast('error', 'Failed to save store profile: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const filteredVendors = vendors.filter(vendor => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (vendor.business_name || '').toLowerCase().includes(term) ||
      (vendor.full_name || '').toLowerCase().includes(term) ||
      (vendor.email || '').toLowerCase().includes(term) ||
      (vendor.phone || '').toLowerCase().includes(term) ||
      (vendor.state || '').toLowerCase().includes(term);

    const isSuspended = vendor.suspended === true;
    if (filter === 'active') return matchesSearch && !isSuspended;
    if (filter === 'suspended') return matchesSearch && isSuspended;
    if (filter === 'recommended') return matchesSearch && !!vendor.is_recommended;
    return matchesSearch;
  });

  const activeCount = vendors.filter(v => !v.suspended).length;
  const suspendedCount = vendors.filter(v => v.suspended).length;
  const recommendedCount = vendors.filter(v => !!v.is_recommended).length;

  return (
    <div className="space-y-6 animate-fadeIn max-w-7xl mx-auto pb-12">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-600 uppercase tracking-wider mb-1">
            <Store className="w-4 h-4" />
            <span>Marketplace Merchant Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0A192F] tracking-tight">Merchant Stores & Vendors</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">Manage verified merchant profiles, customize branding covers, recommend stores, and supervise accounts.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchVendors}
            className="p-3 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all shadow-sm"
            title="Reload vendors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── TOAST ALERT ── */}
      {toast.text && (
        <div className={`p-4 rounded-2xl text-xs font-bold border flex items-center justify-between ${
          toast.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{toast.text}</span>
          <button onClick={() => setToast({ type: '', text: '' })} className="text-xs opacity-70 hover:opacity-100 font-bold">✕</button>
        </div>
      )}

      {/* ── METRICS SUMMARY ── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Total Merchants</p>
          <h3 className="text-2xl font-black text-slate-900">{vendors.length}</h3>
          <p className="text-[11px] text-slate-400 mt-1">Registered sellers & stores</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-amber-100 shadow-sm bg-gradient-to-br from-amber-50/40 to-white">
          <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 mb-1">Recommended</p>
          <h3 className="text-2xl font-black text-amber-700">{recommendedCount}</h3>
          <p className="text-[11px] text-amber-600/80 mt-1">Featured on Stores page</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-emerald-100 shadow-sm bg-gradient-to-br from-emerald-50/40 to-white">
          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-1">Active Stores</p>
          <h3 className="text-2xl font-black text-emerald-700">{activeCount}</h3>
          <p className="text-[11px] text-emerald-600/80 mt-1">Live in marketplace</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-rose-100 shadow-sm bg-gradient-to-br from-rose-50/40 to-white">
          <p className="text-[10px] font-black uppercase tracking-wider text-rose-700 mb-1">Suspended</p>
          <h3 className="text-2xl font-black text-rose-700">{suspendedCount}</h3>
          <p className="text-[11px] text-rose-600/80 mt-1">Closed or restricted accounts</p>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-100 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, store, email, phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 text-slate-800 placeholder-slate-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <div className="flex p-1 bg-slate-100 rounded-2xl w-full sm:w-auto">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              All ({vendors.length})
            </button>
            <button
              onClick={() => setFilter('recommended')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                filter === 'recommended' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              ⭐ Recommended ({recommendedCount})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                filter === 'active' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilter('suspended')}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                filter === 'suspended' ? 'bg-white text-rose-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Suspended ({suspendedCount})
            </button>
          </div>
        </div>
      </div>

      {/* ── VENDORS LIST ── */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs font-bold text-slate-600">Loading verified merchant stores...</p>
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-100 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-900">No merchant stores found</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1">No registered store matching this query was found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-5">Merchant Store / Brand</th>
                  <th className="py-4 px-4">Contact & WhatsApp</th>
                  <th className="py-4 px-4">Location</th>
                  <th className="py-4 px-4 text-center">Recommendation</th>
                  <th className="py-4 px-4 text-center">Status</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredVendors.map((vendor) => {
                  const isSuspended = vendor.suspended === true;
                  const isRec = !!vendor.is_recommended;
                  const initial = (vendor.business_name || vendor.full_name || vendor.email || 'V')[0].toUpperCase();

                  return (
                    <tr key={vendor.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-600 to-navy-900 flex items-center justify-center font-black text-sm text-white shadow-sm flex-shrink-0 overflow-hidden">
                            {vendor.avatar_url ? (
                              <img src={vendor.avatar_url} alt="Logo" className="w-full h-full object-contain p-1 bg-white" />
                            ) : initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 group-hover:text-sky-600 transition-colors truncate">
                              {vendor.business_name || vendor.full_name || 'Registered Store'}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {vendor.business_category || 'Merchant'} • {vendor.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-slate-600">
                        <p className="font-bold text-slate-800">{vendor.phone || vendor.phone_number || 'No phone'}</p>
                        <p className="text-slate-400 truncate max-w-[160px]">{vendor.email}</p>
                      </td>

                      <td className="py-4 px-4 font-semibold text-slate-600">
                        {vendor.state || vendor.address || 'Nigeria'}
                      </td>

                      {/* Recommend Toggle */}
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={(e) => handleToggleRecommend(vendor, e)}
                          className={`px-3 py-1.5 rounded-xl font-black text-[10px] tracking-wider uppercase transition-all shadow-sm flex items-center gap-1 mx-auto ${
                            isRec 
                              ? 'bg-amber-500 text-white shadow-amber-500/20' 
                              : 'bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-700'
                          }`}
                        >
                          <Star className={`w-3 h-3 ${isRec ? 'fill-white' : ''}`} />
                          <span>{isRec ? 'Recommended' : 'Recommend'}</span>
                        </button>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold ${
                          isSuspended
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Store Button */}
                          <button
                            onClick={() => openEditModal(vendor)}
                            className="p-2 rounded-xl text-sky-600 hover:bg-sky-50 transition-all font-bold text-xs flex items-center gap-1"
                            title="Edit Store Profile (Cover, Name, Bio)"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          {/* View Info */}
                          <button
                            onClick={() => { setSelectedVendor(vendor); setShowModal(true); }}
                            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          {/* Suspend Toggle */}
                          <button
                            onClick={() => handleToggleSuspend(vendor)}
                            disabled={actionLoading}
                            className={`p-2 rounded-xl transition-all ${
                              isSuspended
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-rose-500 hover:bg-rose-50'
                            }`}
                            title={isSuspended ? 'Restore Account' : 'Suspend Account'}
                          >
                            {isSuspended ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
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

      {/* ── EDIT STORE PROFILE MODAL ── */}
      {editModalVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Edit Merchant Store Profile</h3>
                  <p className="text-xs text-slate-400">Update cover image, store name, category and bio</p>
                </div>
              </div>
              <button
                onClick={() => setEditModalVendor(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveVendorStore} className="space-y-4 text-xs">
              {/* Cover Banner URL */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Cover Banner Image URL</label>
                <input
                  type="text"
                  value={editForm.cover_image}
                  onChange={e => setEditForm({ ...editForm, cover_image: e.target.value })}
                  placeholder="https://images.unsplash.com/... or image link"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs focus:ring-2 focus:ring-sky-500/20"
                />
                {editForm.cover_image && (
                  <div className="h-24 w-full rounded-xl overflow-hidden mt-2 border border-slate-100">
                    <img src={editForm.cover_image} alt="Cover Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              {/* Logo URL */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Store Logo / Avatar URL</label>
                <input
                  type="text"
                  value={editForm.avatar_url}
                  onChange={e => setEditForm({ ...editForm, avatar_url: e.target.value })}
                  placeholder="Direct image URL for store logo..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              {/* Store Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Store / Business Name *</label>
                <input
                  type="text"
                  value={editForm.business_name}
                  onChange={e => setEditForm({ ...editForm, business_name: e.target.value })}
                  placeholder="e.g. Sani Tech & Gadgets"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs font-bold focus:ring-2 focus:ring-sky-500/20"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Store Category</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                  placeholder="e.g. Electronics & Smart Devices"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">WhatsApp / Phone Number</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="2349021486162"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">Location / Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="City, State"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-2.5 text-xs focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              {/* About Bio */}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">About Store (Bio & Warranty)</label>
                <textarea
                  rows={3}
                  value={editForm.about}
                  onChange={e => setEditForm({ ...editForm, about: e.target.value })}
                  placeholder="About the store..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              {/* Recommend Checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="recToggle"
                  checked={editForm.is_recommended}
                  onChange={e => setEditForm({ ...editForm, is_recommended: e.target.checked })}
                  className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400"
                />
                <label htmlFor="recToggle" className="font-bold text-slate-800 cursor-pointer">
                  Feature as ⭐ Recommended Vendor
                </label>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalVendor(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2.5 rounded-xl bg-[#0A192F] hover:bg-sky-700 text-white font-black shadow-md flex items-center gap-2"
                >
                  {savingEdit ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Store Profile</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VENDOR DETAILS MODAL ── */}
      {showModal && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-700 flex items-center justify-center font-black text-sm text-white shadow-md">
                  {(selectedVendor.business_name || selectedVendor.full_name || 'V')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 leading-tight">
                    {selectedVendor.business_name || selectedVendor.full_name}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedVendor.id?.slice(0, 12)}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Status</span>
                  <span className={`inline-flex items-center gap-1 font-bold ${
                    selectedVendor.suspended ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {selectedVendor.suspended ? 'Suspended' : 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Recommended</span>
                  <span className="font-bold text-amber-600">
                    {selectedVendor.is_recommended ? '⭐ Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-white">
                  <span className="text-slate-500 font-semibold flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address:
                  </span>
                  <strong className="text-slate-800 font-mono">{selectedVendor.email}</strong>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-white">
                  <span className="text-slate-500 font-semibold flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> WhatsApp / Phone:
                  </span>
                  <strong className="text-slate-800 font-mono">{selectedVendor.phone || selectedVendor.phone_number || 'N/A'}</strong>
                </div>

                <div className="flex items-center justify-between p-3 rounded-2xl border border-slate-100 bg-white">
                  <span className="text-slate-500 font-semibold flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Location:
                  </span>
                  <strong className="text-slate-800">{selectedVendor.state || selectedVendor.address || 'Nigeria'}</strong>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleSuspend(selectedVendor)}
                  disabled={actionLoading}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md ${
                    selectedVendor.suspended
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  }`}
                >
                  {selectedVendor.suspended ? 'Restore Account' : 'Suspend Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVendors;