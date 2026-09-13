import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { 
  Store, Search, CheckCircle, XCircle, Shield, 
  Phone, Mail, MapPin, RefreshCw, Eye, AlertTriangle,
  UserCheck, UserX, Building2
} from 'lucide-react';

const AdminVendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState({ type: '', text: '' });
  const [actionLoading, setActionLoading] = useState(false);

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
        .eq('role', 'vendor')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error.message);
      showToast('error', 'Kuskure wajen loda yan kasuwa: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSuspend = async (vendor) => {
    const nextSuspended = !vendor.suspended;
    const confirmMsg = nextSuspended 
      ? `Shin kana son dakatar da dan kasuwa "${vendor.business_name || vendor.full_name}"?`
      : `Kana son mayar da dan kasuwa "${vendor.business_name || vendor.full_name}" kan aiki?`;

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

      showToast('success', nextSuspended ? 'An dakatar da dan kasuwa cikin nasara' : 'An mayar da dan kasuwa kan aiki cikin nasara');
    } catch (error) {
      showToast('error', 'Kuskure wajen canza matsayi: ' + error.message);
    } finally {
      setActionLoading(false);
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
    return matchesSearch;
  });

  const activeCount = vendors.filter(v => !v.suspended).length;
  const suspendedCount = vendors.filter(v => v.suspended).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
            <Store className="w-4 h-4" />
            <span>Sarrafa Dillalan Kasuwa (Vendor Management)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Yan Kasuwa da Shaguna</h1>
          <p className="text-sm text-slate-500 mt-1">Duba bayanan dukkan masu shaguna a Abu Mafhal, tantance matsayinsu, da sarrafa asusunsu.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchVendors}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
            title="Sake loda yan kasuwa"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── TOAST ALERT ── */}
      {toast.text && (
        <div className={`p-4 rounded-xl text-sm font-semibold border flex items-center justify-between ${
          toast.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{toast.text}</span>
          <button onClick={() => setToast({ type: '', text: '' })} className="text-xs opacity-70 hover:opacity-100 font-bold">×</button>
        </div>
      )}

      {/* ── METRICS SUMMARY ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Jimillar Yan Kasuwa</p>
          <h3 className="text-2xl font-black text-slate-900">{vendors.length}</h3>
          <p className="text-xs text-slate-400 mt-1">Dukkan masu shago da suka yi rijista</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm bg-gradient-to-br from-emerald-50/40 to-white">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1">Masu Aiki (Active)</p>
          <h3 className="text-2xl font-black text-emerald-700">{activeCount}</h3>
          <p className="text-xs text-emerald-600/80 mt-1">Shagunan da ke bude a kasuwa</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-rose-100 shadow-sm bg-gradient-to-br from-rose-50/40 to-white">
          <p className="text-xs font-bold uppercase tracking-wider text-rose-700 mb-1">Wadanda Aka Dakatar</p>
          <h3 className="text-2xl font-black text-rose-700">{suspendedCount}</h3>
          <p className="text-xs text-rose-600/80 mt-1">Asusun da aka rufe</p>
        </div>
      </div>

      {/* ── SEARCH & FILTER CONTROLS ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Nemo ta suna, shago, imel, ko waya..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Duka ({vendors.length})
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                filter === 'active' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setFilter('suspended')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-sm text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-bold text-slate-600">Ana loda bayanan yan kasuwa...</p>
        </div>
      ) : filteredVendors.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
            <Store className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Babu wani dan kasuwa da aka samu</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1">Babu wani mai shago da ya dace da wannan binciken a halin yanzu.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Dan Kasuwa / Shago (Vendor)</th>
                  <th className="py-3.5 px-4">Hanyar Sadarwa (Contact)</th>
                  <th className="py-3.5 px-4">Gari / Jiha (Location)</th>
                  <th className="py-3.5 px-4">Rijista (Joined)</th>
                  <th className="py-3.5 px-4 text-center">Matsayi (Status)</th>
                  <th className="py-3.5 px-5 text-right">Ayyuka (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredVendors.map((vendor) => {
                  const isSuspended = vendor.suspended === true;
                  const initial = (vendor.business_name || vendor.full_name || vendor.email || 'V')[0].toUpperCase();

                  return (
                    <tr key={vendor.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center font-black text-xs text-white shadow-sm flex-shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                              {vendor.business_name || vendor.full_name || 'Babu Sunan Shago'}
                            </p>
                            <p className="text-xs text-slate-400 truncate">
                              {vendor.full_name && vendor.business_name ? vendor.full_name : vendor.email}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-xs text-slate-600">
                        <p className="font-medium text-slate-800">{vendor.phone || vendor.phone_number || 'Babu lamba'}</p>
                        <p className="text-slate-400 truncate max-w-[160px]">{vendor.email}</p>
                      </td>

                      <td className="py-4 px-4 text-xs font-semibold text-slate-600">
                        {vendor.state || vendor.address || 'Kano / Nigeria'}
                      </td>

                      <td className="py-4 px-4 text-xs text-slate-500 font-medium">
                        {vendor.created_at ? new Date(vendor.created_at).toLocaleDateString() : 'Kwanan nan'}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                          isSuspended
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                          {isSuspended ? 'Suspended' : 'Active'}
                        </span>
                      </td>

                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => { setSelectedVendor(vendor); setShowModal(true); }}
                            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            title="Duba Cikakkun Bayanai"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleToggleSuspend(vendor)}
                            disabled={actionLoading}
                            className={`p-2 rounded-xl transition-all ${
                              isSuspended
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-rose-500 hover:bg-rose-50'
                            }`}
                            title={isSuspended ? 'Mayar da Asusu Kan Aiki' : 'Dakatar da Dan Kasuwa'}
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

      {/* ── VENDOR DETAILS MODAL ── */}
      {showModal && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 flex items-center justify-center font-black text-sm text-white shadow-md">
                  {(selectedVendor.business_name || selectedVendor.full_name || 'V')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">
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
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Matsayi (Status)</span>
                  <span className={`inline-flex items-center gap-1 font-bold ${
                    selectedVendor.suspended ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {selectedVendor.suspended ? 'An Dakatar (Suspended)' : 'Yana Aiki (Active)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Matsayin KYC (Tier)</span>
                  <span className="font-bold text-slate-800">Tier {selectedVendor.kyc_tier || '1'} (Verified)</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Kudi a Asusun (Balance)</span>
                  <span className="font-black text-slate-900 text-sm">₦{(selectedVendor.balance || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Ranar Rijista</span>
                  <span className="font-bold text-slate-800">
                    {selectedVendor.created_at ? new Date(selectedVendor.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white">
                  <span className="text-slate-500 font-semibold flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Imel (Email Address):
                  </span>
                  <strong className="text-slate-800 font-mono">{selectedVendor.email}</strong>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white">
                  <span className="text-slate-500 font-semibold flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Lambar Waya (Phone):
                  </span>
                  <strong className="text-slate-800 font-mono">{selectedVendor.phone || selectedVendor.phone_number || 'Babu'}</strong>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white">
                  <span className="text-slate-500 font-semibold flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Jiha / Adireshi (State):
                  </span>
                  <strong className="text-slate-800">{selectedVendor.state || selectedVendor.address || 'Kano, Nigeria'}</strong>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Rufe (Close)
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
                  {selectedVendor.suspended ? 'Mayar da Asusu Kan Aiki' : 'Dakatar da Dan Kasuwa'}
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