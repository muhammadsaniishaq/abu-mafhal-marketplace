import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { 
  Layers, Plus, Search, Edit2, Trash2, CheckCircle, 
  XCircle, Image as ImageIcon, ArrowUpDown, RefreshCw, Eye,
  Package, ExternalLink, Filter, Check, X
} from 'lucide-react';

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [productCounts, setProductCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
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
    fetchCategoriesAndCounts();

    const channel = supabase
      .channel('web-admin-categories-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchCategoriesAndCounts(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const showToast = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const fetchCategoriesAndCounts = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const [catsRes, prodsRes] = await Promise.allSettled([
        supabase
          .from('categories')
          .select('*')
          .order('display_order', { ascending: true, nullsFirst: false }),
        supabase
          .from('products')
          .select('id, category')
      ]);

      const cats = (catsRes.status === 'fulfilled' && Array.isArray(catsRes.value?.data)) ? catsRes.value.data : [];
      const prods = (prodsRes.status === 'fulfilled' && Array.isArray(prodsRes.value?.data)) ? prodsRes.value.data : [];

      const counts = {};
      prods.forEach(p => {
        if (p.category) {
          const norm = p.category.toLowerCase().trim();
          counts[norm] = (counts[norm] || 0) + 1;
        }
      });

      setCategories(cats);
      setProductCounts(counts);
    } catch (err) {
      console.error('Error fetching categories:', err);
      showToast('error', 'Failed to load categories: ' + err.message);
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

  const handleNameChange = (val) => {
    const nextForm = { ...form, name: val };
    if (!editingCategory) {
      nextForm.slug = val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
    }
    setForm(nextForm);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('error', 'Please enter a category name');
      return;
    }

    setSaving(true);
    const slug = form.slug.trim() || form.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');

    try {
      if (editingCategory) {
        // Update
        const { data, error } = await supabase
          .from('categories')
          .update({
            name: form.name.trim(),
            slug,
            icon: form.icon,
            image_url: form.image_url.trim() || null,
            display_order: parseInt(form.display_order, 10) || 0,
            is_active: form.is_active
          })
          .eq('id', editingCategory.id)
          .select()
          .single();

        if (error) throw error;
        setCategories(prev => prev.map(c => c.id === editingCategory.id ? data : c));
        showToast('success', 'Category updated successfully!');
      } else {
        // Insert
        const { data, error } = await supabase
          .from('categories')
          .insert([{
            name: form.name.trim(),
            slug,
            icon: form.icon,
            image_url: form.image_url.trim() || null,
            display_order: parseInt(form.display_order, 10) || 0,
            is_active: form.is_active
          }])
          .select()
          .single();

        if (error) throw error;
        setCategories(prev => [...prev, data]);
        showToast('success', 'New category created successfully!');
      }
      setShowModal(false);
    } catch (err) {
      console.error('Save category error:', err);
      showToast('error', 'Failed to save category: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (cat) => {
    const nextStatus = !cat.is_active;
    // Optimistic UI update
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: nextStatus } : c));

    try {
      const { error } = await supabase
        .from('categories')
        .update({ is_active: nextStatus })
        .eq('id', cat.id);

      if (error) throw error;
      showToast('success', `Category set to ${nextStatus ? 'Active' : 'Inactive'}`);
    } catch (err) {
      console.error(err);
      // Revert on error
      setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, is_active: !nextStatus } : c));
      showToast('error', 'Could not update category status');
    }
  };

  const handleDelete = async (cat) => {
    const count = productCounts[(cat.name || '').toLowerCase().trim()] || 0;
    const warn = count > 0 ? ` WARNING: This category currently has ${count} linked products.` : '';

    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?${warn}`)) return;

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', cat.id);

      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== cat.id));
      showToast('success', 'Category deleted successfully');
    } catch (err) {
      console.error(err);
      showToast('error', 'Failed to delete category: ' + err.message);
    }
  };

  const filteredCategories = categories.filter(c => {
    const matchesSearch = !searchTerm.trim() ||
      (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.slug || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'active') return c.is_active !== false;
    if (statusFilter === 'inactive') return c.is_active === false;
    return true;
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-sky-600 uppercase tracking-wider mb-1">
            <Layers className="w-4 h-4" />
            <span>Store Taxonomy Suite</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Category Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage marketplace departments, priority orders, and customer visibility.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchCategoriesAndCounts()}
            className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
            title="Refresh categories"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-sky-600' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0284C7] hover:bg-sky-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-sky-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {message.text && (
        <div className={`p-4 rounded-2xl text-sm font-bold border flex items-center justify-between animate-fadeIn ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage({ type: '', text: '' })} className="text-xs opacity-70 hover:opacity-100 font-bold">×</button>
        </div>
      )}

      {/* Search Bar & Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search category name or slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 transition-all text-slate-800 placeholder-slate-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-2">
          {[
            { key: 'all', label: `All (${categories.length})` },
            { key: 'active', label: `Active (${categories.filter(c => c.is_active !== false).length})` },
            { key: 'inactive', label: `Inactive (${categories.filter(c => c.is_active === false).length})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                statusFilter === tab.key
                  ? 'bg-[#0A192F] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories Table */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200/80 shadow-sm text-center">
          <div className="w-10 h-10 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-bold text-slate-600">Loading catalog taxonomy...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200/80 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900">No categories found</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1">Click "Add Category" above to create your first department.</p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-5">Category (Name & Slug)</th>
                  <th className="py-3.5 px-4 text-center">Display Order</th>
                  <th className="py-3.5 px-4 text-center">Linked Products</th>
                  <th className="py-3.5 px-4 text-center">Visibility Status</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCategories.map((cat) => {
                  const isActive = cat.is_active !== false;
                  const count = productCounts[(cat.name || '').toLowerCase().trim()] || 0;

                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors group">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {cat.image_url ? (
                              <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                            ) : (
                              <Layers className="w-5 h-5 text-sky-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 group-hover:text-sky-600 transition-colors">{cat.name}</p>
                            <p className="text-xs text-slate-400 font-mono">/{cat.slug || 'category'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-slate-700">
                        <span className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200/60 text-xs font-black">
                          #{cat.display_order ?? 0}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-100">
                          <Package className="w-3.5 h-3.5 text-sky-600" />
                          <span>{count} Products</span>
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          onClick={() => handleToggleStatus(cat)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black transition-all ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(cat)}
                            className="p-2 rounded-xl text-slate-500 hover:text-sky-600 hover:bg-sky-50 transition-all"
                            title="Edit Category"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(cat)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            title="Delete Category"
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
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h3>
                <p className="text-xs text-slate-500">Configure department details, priority order and icon.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Image Preview & URL */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Category Image URL
                </label>
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {form.image_url ? (
                      <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Phones & Tablets"
                  value={form.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. phones-tablets"
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-1.5">
                    Display Priority Order
                  </label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 font-black"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="cat_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500"
                />
                <label htmlFor="cat_active" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Activate Category (Visible on customer mobile app & website)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-[#0284C7] hover:bg-sky-700 text-white text-xs font-black shadow-lg shadow-sky-600/20 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editingCategory ? 'Update Category' : 'Create Category')}
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
