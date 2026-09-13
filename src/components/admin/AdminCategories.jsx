import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { 
  Layers, Plus, Search, Edit2, Trash2, CheckCircle, 
  XCircle, Image as ImageIcon, ArrowUpDown, RefreshCw, Eye
} from 'lucide-react';

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const [form, setForm] = useState({
    name: '',
    slug: '',
    icon: '',
    image_url: '',
    display_order: 0,
    is_active: true
  });

  useEffect(() => {
    fetchCategories();
  }, []);

  const showToast = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      showToast('error', 'Kuskure wajen loda rukunai: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setForm({
      name: '',
      slug: '',
      icon: 'Tag',
      image_url: '',
      display_order: categories.length + 1,
      is_active: true
    });
    setShowModal(true);
  };

  const handleOpenEdit = (cat) => {
    setEditingCategory(cat);
    setForm({
      name: cat.name || '',
      slug: cat.slug || '',
      icon: cat.icon || '',
      image_url: cat.image_url || '',
      display_order: cat.display_order ?? 0,
      is_active: cat.is_active !== false
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('error', 'Da fatan a shigar da sunan rukuni');
      return;
    }

    setSaving(true);
    const slug = form.slug.trim() || form.name.toLowerCase().trim().replace(/[\s\W-]+/g, '-');

    try {
      if (editingCategory) {
        // Update
        const { data, error } = await supabase
          .from('categories')
          .update({
            name: form.name.trim(),
            slug,
            icon: form.icon,
            image_url: form.image_url.trim(),
            display_order: parseInt(form.display_order) || 0,
            is_active: form.is_active
          })
          .eq('id', editingCategory.id)
          .select()
          .single();

        if (error) throw error;
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? data : c));
        showToast('success', 'An sabunta rukuni cikin nasara!');
      } else {
        // Insert
        const { data, error } = await supabase
          .from('categories')
          .insert([{
            name: form.name.trim(),
            slug,
            icon: form.icon,
            image_url: form.image_url.trim(),
            display_order: parseInt(form.display_order) || 0,
            is_active: form.is_active
          }])
          .select()
          .single();

        if (error) throw error;
        setCategories(prev => [...prev, data]);
        showToast('success', 'An kirkiri sabon rukuni cikin nasara!');
      }
      setShowModal(false);
    } catch (err) {
      console.error('Save category error:', err);
      showToast('error', 'An samu matsala wajen ajiye rukuni: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (cat) => {
    const nextStatus = !cat.is_active;
    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: nextStatus })
        .eq('id', cat.id);

      if (error) throw error;
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: nextStatus } : c));
      showToast('success', `Rukuni ya koma ${nextStatus ? 'Active' : 'Inactive'}`);
    } catch (err) {
      console.error(err);
      showToast('error', 'Kuskure wajen canza matsayi');
    }
  };

  const handleDelete = async (cat) => {
    if (!window.confirm(`Shin kana da tabbacin kana son goge rukunin "${cat.name}"?`)) return;

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', cat.id);

      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      showToast('success', 'An goge rukuni cikin nasara');
    } catch (err) {
      console.error(err);
      showToast('error', 'An kasa goge rukuni: ' + err.message);
    }
  };

  const filteredCategories = categories.filter(c => 
    (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.slug || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-violet-600 uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            <span>Tsarin Rukunai (Category Management)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rukunan Kayan Kasuwa</h1>
          <p className="text-sm text-slate-500 mt-1">Sarrafa dukkan rukunan kayayyakin da ke kasuwar Abu Mafhal cikin sauki.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchCategories}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
            title="Sake loda rukunai"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-violet-600' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-violet-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Sanya Sabon Rukuni</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {message.text && (
        <div className={`p-4 rounded-xl text-sm font-semibold border flex items-center justify-between ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="text-xs opacity-70 hover:opacity-100 font-bold">×</button>
        </div>
      )}

      {/* Search Bar & Summary */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Nemo rukuni ta suna..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 transition-all text-slate-800 placeholder-slate-400"
          />
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span>Jimillar Rukunai: <strong className="text-slate-900 font-bold">{categories.length}</strong></span>
          <span className="text-slate-300">•</span>
          <span>Masu Aiki (Active): <strong className="text-emerald-600 font-bold">{categories.filter(c => c.is_active !== false).length}</strong></span>
        </div>
      </div>

      {/* Categories Grid / Table */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-sm text-center">
          <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-bold text-slate-600">Ana loda rukunan kasuwa...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Babu wani rukuni da aka samu</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1">Danna maballin "Sanya Sabon Rukuni" don kara rukunin farko na kasuwar ku.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Rukuni (Name & Slug)</th>
                  <th className="py-3.5 px-4 text-center">Jeri (Order)</th>
                  <th className="py-3.5 px-4 text-center">Hoto / Icon</th>
                  <th className="py-3.5 px-4 text-center">Matsayi (Status)</th>
                  <th className="py-3.5 px-5 text-right">Ayyuka (Actions)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCategories.map((cat) => {
                  const isActive = cat.is_active !== false;
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {cat.image_url ? (
                              <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                            ) : (
                              <Layers className="w-5 h-5 text-violet-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 group-hover:text-violet-600 transition-colors">{cat.name}</p>
                            <p className="text-xs text-slate-400 font-mono">/{cat.slug || 'no-slug'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-slate-700">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/60 text-xs">
                          {cat.display_order ?? 0}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-200/50">
                          {cat.icon || 'default'}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(cat)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(cat)}
                            className="p-2 rounded-xl text-slate-500 hover:text-violet-600 hover:bg-violet-50 transition-all"
                            title="Gyara Rukuni"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(cat)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            title="Goge Rukuni"
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

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingCategory ? 'Gyara Rukunin Kasuwa' : 'Kirkiri Sabon Rukuni'}
                </h3>
                <p className="text-xs text-slate-500">Cika bayanan rukunin don bayyana shi a shagon kasuwa.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Sunan Rukuni (Category Name) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Misali: Fashion & Kayan Sawa"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Slug (URL Key)
                  </label>
                  <input
                    type="text"
                    placeholder="misali: fashion-and-wear"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jeri (Display Order)
                  </label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Hoto / Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Icon Identifier
                </label>
                <input
                  type="text"
                  placeholder="Misali: Smartphone, Shirt, ShoppingBag"
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-600"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="cat_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500"
                />
                <label htmlFor="cat_active" className="text-sm font-semibold text-slate-700">
                  Kunna wannan rukuni a kasuwa (Active on Marketplace)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Soke (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold shadow-lg shadow-violet-600/20 transition-all disabled:opacity-50"
                >
                  {saving ? 'Ana ajiye...' : (editingCategory ? 'Ajiye Gyara' : 'Kirkiri Rukuni')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCategories;
