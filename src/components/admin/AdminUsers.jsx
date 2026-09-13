import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { 
  Users, Search, UserPlus, Shield, CheckCircle, 
  XCircle, Mail, Phone, Calendar, RefreshCw, Eye,
  Trash2, UserCheck, UserX, ChevronDown
} from 'lucide-react';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState({ type: '', text: '' });
  const [actionLoading, setActionLoading] = useState(false);

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
    setTimeout(() => setToast({ type: '', text: '' }), 4000);
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error.message);
      showToast('error', 'Kuskure wajen loda masu amfani: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email || !newUser.password) {
      showToast('error', 'Da fatan a cika dukkan filayen da ake bukata');
      return;
    }

    if (newUser.password.length < 6) {
      showToast('error', 'Dole kalmar sirri ta kai a kalla haruffa 6');
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

      showToast('success', 'An kirkiri sabon mai amfani cikin nasara!');
      setShowCreateModal(false);
      setNewUser({ name: '', email: '', password: '', phone: '', role: 'buyer' });
      fetchUsers();
    } catch (error) {
      showToast('error', 'An samu matsala wajen kirkirar mai amfani: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    if (!window.confirm(`Shin kana son canza matsayin wannan mai amfani zuwa "${newRole}"?`)) return;

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
      showToast('success', `An canza matsayin mai amfani zuwa ${newRole}`);
    } catch (error) {
      showToast('error', 'Kuskure wajen canza matsayi: ' + error.message);
    }
  };

  const handleToggleSuspend = async (user) => {
    const nextSuspended = !user.suspended;
    const confirmMsg = nextSuspended 
      ? `Shin kana son dakatar da asusun "${user.full_name || user.email}"?`
      : `Kana son mayar da asusun "${user.full_name || user.email}" kan aiki?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          suspended: nextSuspended,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, suspended: nextSuspended } : u));
      if (selectedUser?.id === user.id) {
        setSelectedUser(prev => ({ ...prev, suspended: nextSuspended }));
      }
      showToast('success', nextSuspended ? 'An dakatar da asusu cikin nasara' : 'An mayar da asusu kan aiki');
    } catch (error) {
      showToast('error', 'Kuskure wajen canza matsayin asusu: ' + error.message);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Shin kana da tabbacin goge asusun "${user.full_name || user.email}" gaba daya?`)) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id);

      if (error) throw error;
      setUsers(prev => prev.filter(u => u.id !== user.id));
      if (selectedUser?.id === user.id) setShowModal(false);
      showToast('success', 'An goge asusun mai amfani cikin nasara');
    } catch (error) {
      showToast('error', 'Kuskure wajen goge asusu: ' + error.message);
    }
  };

  const filteredUsers = users.filter(user => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = 
      (user.full_name || '').toLowerCase().includes(term) ||
      (user.email || '').toLowerCase().includes(term) ||
      (user.phone || '').toLowerCase().includes(term);

    const matchesRole = filter === 'all' || user.role === filter;
    return matchesSearch && matchesRole;
  });

  const buyersCount = users.filter(u => u.role !== 'vendor' && u.role !== 'admin').length;
  const vendorsCount = users.filter(u => u.role === 'vendor').length;
  const adminsCount = users.filter(u => u.role === 'admin').length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-cyan-600 uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            <span>Sarrafa Masu Amfani (User Management)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Masu Sayayya da Asusun Kasuwa</h1>
          <p className="text-sm text-slate-500 mt-1">Duba bayanan dukkan asusun da suka yi rajista, canza matsayinsu, ko dakatar da asusun da ya saba ka'ida.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
            title="Sake loda asusu"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-cyan-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <UserPlus className="w-4 h-4" />
            <span>Kirkiri Sabon Mai Amfani</span>
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Jimillar Asusun</p>
          <h3 className="text-2xl font-black text-slate-900">{users.length}</h3>
          <p className="text-xs text-slate-400 mt-1">Dukkan masu rajista</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-cyan-100 shadow-sm bg-gradient-to-br from-cyan-50/40 to-white">
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-700 mb-1">Masu Sayayya (Buyers)</p>
          <h3 className="text-2xl font-black text-cyan-700">{buyersCount}</h3>
          <p className="text-xs text-cyan-600/80 mt-1">Abokan ciniki</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-sm bg-gradient-to-br from-blue-50/40 to-white">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1">Yan Kasuwa (Vendors)</p>
          <h3 className="text-2xl font-black text-blue-700">{vendorsCount}</h3>
          <p className="text-xs text-blue-600/80 mt-1">Masu shago</p>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-purple-100 shadow-sm bg-gradient-to-br from-purple-50/40 to-white">
          <p className="text-xs font-bold uppercase tracking-wider text-purple-700 mb-1">Gwamnonin Kasuwa (Admin)</p>
          <h3 className="text-2xl font-black text-purple-700">{adminsCount}</h3>
          <p className="text-xs text-purple-600/80 mt-1">Masu kula da tsari</p>
        </div>
      </div>

      {/* ── SEARCH & ROLE FILTER CONTROLS ── */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Nemo ta suna, imel, ko lambar waya..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 transition-all text-slate-800 placeholder-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex p-1 bg-slate-100 rounded-xl w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Duka ({users.length})
            </button>
            <button
              onClick={() => setFilter('buyer')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filter === 'buyer' ? 'bg-white text-cyan-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Buyers ({buyersCount})
            </button>
            <button
              onClick={() => setFilter('vendor')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filter === 'vendor' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Vendors ({vendorsCount})
            </button>
            <button
              onClick={() => setFilter('admin')}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                filter === 'admin' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Admins ({adminsCount})
            </button>
          </div>
        </div>
      </div>

      {/* ── USERS TABLE ── */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-sm text-center">
          <div className="w-10 h-10 border-4 border-cyan-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-bold text-slate-600">Ana loda bayanan masu amfani...</p>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-4">
            <Users className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Babu wani asusu da aka samu</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1">Babu wani mai amfani da ya dace da wannan binciken a halin yanzu.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Mai Amfani (User Profile)</th>
                  <th className="py-3.5 px-4">Lambar Waya (Phone)</th>
                  <th className="py-3.5 px-4">Matsayi (Role)</th>
                  <th className="py-3.5 px-4">Rijista (Joined)</th>
                  <th className="py-3.5 px-4 text-center">Matsayi (Status)</th>
                  <th className="py-3.5 px-5 text-right">Ayyuka (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredUsers.map((user) => {
                  const isSuspended = user.suspended === true;
                  const isVendor = user.role === 'vendor';
                  const isAdmin = user.role === 'admin';
                  const initial = (user.full_name || user.email || 'U')[0].toUpperCase();

                  return (
                    <tr key={user.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-sm flex-shrink-0 ${
                            isVendor 
                              ? 'bg-gradient-to-tr from-blue-600 to-indigo-700' 
                              : isAdmin 
                                ? 'bg-gradient-to-tr from-purple-600 to-violet-700'
                                : 'bg-gradient-to-tr from-slate-600 to-slate-700'
                          }`}>
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 group-hover:text-cyan-600 transition-colors truncate">
                              {user.full_name || 'Mai Sayayya'}
                            </p>
                            <p className="text-xs text-slate-400 truncate">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-4 text-xs font-medium text-slate-700">
                        {user.phone || user.phone_number || 'Babu lamba'}
                      </td>

                      <td className="py-4 px-4">
                        <select
                          value={user.role || 'buyer'}
                          onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border cursor-pointer outline-none transition-all ${
                            isVendor 
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : isAdmin 
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                          }`}
                        >
                          <option value="buyer">Buyer</option>
                          <option value="vendor">Vendor</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>

                      <td className="py-4 px-4 text-xs text-slate-500 font-medium">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'Kwanan nan'}
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
                            onClick={() => { setSelectedUser(user); setShowModal(true); }}
                            className="p-2 rounded-xl text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 transition-all"
                            title="Duba Cikakkun Bayanai"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => handleToggleSuspend(user)}
                            className={`p-2 rounded-xl transition-all ${
                              isSuspended
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-rose-500 hover:bg-rose-50'
                            }`}
                            title={isSuspended ? 'Mayar da Asusu Kan Aiki' : 'Dakatar da Asusu'}
                          >
                            {isSuspended ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                          </button>

                          <button
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            title="Goge Asusu"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-black text-slate-900">Kirkiri Sabon Mai Amfani</h3>
                <p className="text-xs text-slate-500">Cika bayanan asusun sabon abokin ciniki ko mai shago.</p>
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
                  Cikakken Suna (Full Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misali: Sani Ibrahim"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Imel (Email Address) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="misali: user@example.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kalmar Sirri (Password) *
                </label>
                <input
                  type="password"
                  required
                  placeholder="A kalla haruffa 6"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Lambar Waya (Phone)
                </label>
                <input
                  type="tel"
                  placeholder="08012345678"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Matsayin Asusu (Account Role)
                </label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-600 font-bold"
                >
                  <option value="buyer">Buyer (Mai Sayayya)</option>
                  <option value="vendor">Vendor (Dan Kasuwa / Mai Shago)</option>
                  <option value="admin">Admin (Gwamnan Kasuwa)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Soke (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-bold shadow-lg shadow-cyan-600/20 transition-all disabled:opacity-50"
                >
                  {actionLoading ? 'Ana kirkira...' : 'Kirkiri Asusu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── USER DETAILS MODAL ── */}
      {showModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-700 flex items-center justify-center font-black text-sm text-white shadow-md">
                  {(selectedUser.full_name || selectedUser.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">
                    {selectedUser.full_name || 'Babu Suna'}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">ID: {selectedUser.id?.slice(0, 12)}</p>
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
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Matsayi (Role)</span>
                  <span className="font-bold capitalize text-slate-900">{selectedUser.role || 'buyer'}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Matsayin Asusu (Status)</span>
                  <span className={`inline-flex items-center gap-1 font-bold ${
                    selectedUser.suspended ? 'text-rose-600' : 'text-emerald-600'
                  }`}>
                    {selectedUser.suspended ? 'An Dakatar' : 'Yana Aiki'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Asusun Kudade (Balance)</span>
                  <span className="font-black text-slate-900 text-sm">₦{(selectedUser.balance || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Ranar Rijista</span>
                  <span className="font-bold text-slate-800">
                    {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white">
                  <span className="text-slate-500 font-semibold flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Imel (Email):
                  </span>
                  <strong className="text-slate-800 font-mono">{selectedUser.email}</strong>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-white">
                  <span className="text-slate-500 font-semibold flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Waya (Phone):
                  </span>
                  <strong className="text-slate-800 font-mono">{selectedUser.phone || selectedUser.phone_number || 'Babu'}</strong>
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
                  onClick={() => handleToggleSuspend(selectedUser)}
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-md ${
                    selectedUser.suspended
                      ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                      : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                  }`}
                >
                  {selectedUser.suspended ? 'Mayar da Asusu Kan Aiki' : 'Dakatar da Mai Amfani'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;