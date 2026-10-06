import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../config/supabase';
import { 
  Layers, Plus, Search, Edit2, Trash2, CheckCircle, 
  XCircle, Image as ImageIcon, ArrowUpDown, RefreshCw, Eye,
  Package, ExternalLink, Filter, Check, X, UploadCloud,
  Sparkles, ShieldCheck
} from 'lucide-react';

const invalidateWebCaches = () => {
  try {
    const keys = [
      '@abumafhal_home_cache_v2',
      '@abumafhal_shop_cache',
      'abumafhal_categories_cache',
      '@abumafhal_categories_v2'
    ];
    if (typeof window !== 'undefined' && window.localStorage) {
      keys.forEach(k => {
        try { window.localStorage.removeItem(k); } catch (_) {}
      });
    }
  } catch (e) {
    console.error('Error clearing web cache:', e);
  }
};

const AdminCategories = () => {
  const [categories, setCategories] = useState([]);
  const [productCounts, setProductCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    name: '',
    slug: '',
    icon: '',
    image_url: '',
    display_order: 1,
    is_active: true
  });

  useEffect(() => {
    fetchCategoriesAndCounts();

    const channel = supabase
      .channel('web-admin-categories-sync-v5')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
        fetchCategoriesAndCounts(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
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
      const [catsRes, prodsRes, settingsRes] = await Promise.allSettled([
        supabase
          .from('categories')
          .select('*')
          .order('display_order', { ascending: true, nullsFirst: false }),
        supabase
          .from('products')
          .select('id, category'),
        supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'custom_taxonomy_categories')
          .maybeSingle()
      ]);

      const rawTable = (catsRes.status === 'fulfilled' && Array.isArray(catsRes.value?.data)) ? catsRes.value.data : [];
      const prods = (prodsRes.status === 'fulfilled' && Array.isArray(prodsRes.value?.data)) ? prodsRes.value.data : [];

      let rawCustom = [];
      let deletedSlugs = [];
      if (settingsRes.status === 'fulfilled' && settingsRes.value?.data?.value) {
        let val = settingsRes.value.data.value;
        if (typeof val === 'string') {
          try { val = JSON.parse(val); } catch (_) {}
        }
        if (Array.isArray(val)) {
          rawCustom = val;
        } else if (val && typeof val === 'object') {
          if (Array.isArray(val.categories)) rawCustom = val.categories;
          if (Array.isArray(val.deletedSlugs)) deletedSlugs = val.deletedSlugs;
        }
      }

      const categoryMap = new Map();
      rawTable.forEach(cat => {
        const slug = (cat.slug || cat.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-')).toLowerCase().trim();
        if (deletedSlugs.includes(slug)) return;
        categoryMap.set(slug, {
          ...cat,
          slug,
          display_order: Number(cat.display_order) || 0,
          is_active: cat.is_active !== false
        });
      });

      rawCustom.forEach(cat => {
        if (!cat || !cat.name) return;
        const slug = (cat.slug || cat.name?.toLowerCase().replace(/[^a-z0-9]+/g, '-')).toLowerCase().trim();
        if (cat.is_deleted === true || deletedSlugs.includes(slug)) {
          categoryMap.delete(slug);
          return;
        }
        const existing = categoryMap.get(slug);
        categoryMap.set(slug, {
          id: cat.id || existing?.id || `cat_${Date.now()}`,
          name: cat.name,
          slug,
          icon: cat.icon || existing?.icon || 'Tag',
          image_url: cat.image_url !== undefined ? cat.image_url : (existing?.image_url || null),
          display_order: cat.display_order !== undefined ? Number(cat.display_order) : (existing?.display_order || 0),
          is_active: cat.is_active !== false,
          created_at: cat.created_at || existing?.created_at || new Date().toISOString()
        });
      });

      const mergedCats = Array.from(categoryMap.values()).sort((a, b) => {
        if (a.display_order !== b.display_order) return a.display_order - b.display_order;
        return (a.name || '').localeCompare(b.name || '');
      });

      const counts = {};
      prods.forEach(p => {
        if (p.category) {
          const norm = p.category.toLowerCase().trim();
          counts[norm] = (counts[norm] || 0) + 1;
        }
      });

      setCategories(mergedCats);
      setProductCounts(counts);
    } catch (err) {
      console.error('Error fetching categories:', err);
      showToast('error', 'Failed to load categories: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || 'png';
      const fileName = `cat_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `category_images/${fileName}`;

      let uploadRes = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadRes.error) {
        // Try fallback bucket 'products'
        uploadRes = await supabase.storage
          .from('products')
          .upload(filePath, file);
      }

      if (uploadRes.error) throw uploadRes.error;

      const { data: publicUrlData } = supabase.storage
        .from(uploadRes.data?.fullPath ? uploadRes.data.fullPath.split('/')[0] : 'product-images')
        .getPublicUrl(filePath);

      setForm(prev => ({ ...prev, image_url: publicUrlData.publicUrl }));
      showToast('success', 'Image uploaded successfully!');
    } catch (err) {
      console.error('Upload error:', err);
      showToast('error', 'Could not upload image: ' + (err.message || 'Storage error'));
    } finally {
      setUploading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingCategory(null);
    const maxOrder = categories.reduce((max, c) => Math.max(max, parseInt(c.display_order, 10) || 0), 0);
    setForm({
      name: '',
      slug: '',
      icon: 'Tag',
      image_url: '',
      display_order: maxOrder + 1,
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
      display_order: cat.display_order ?? 1,
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

  const syncCustomTaxonomy = async (updatedList, deletedSlugs = []) => {
    try {
      await supabase.rpc('save_app_setting', {
        p_key: 'custom_taxonomy_categories',
        p_value: {
          categories: updatedList,
          deletedSlugs,
          updated_at: new Date().toISOString()
        },
        p_description: 'Platform Taxonomy Categories'
      });
    } catch (e) {
      console.warn('RPC sync notice:', e);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showToast('error', 'Please enter a category name');
      return;
    }

    setSaving(true);
    const name = form.name.trim();
    const slug = form.slug.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const displayOrder = parseInt(form.display_order, 10) || 0;
    const isActive = form.is_active === true;
    const imageUrl = form.image_url.trim() || null;
    const icon = form.icon || 'Tag';

    try {
      // 1. Try table write
      try {
        if (editingCategory?.id && typeof editingCategory.id === 'number') {
          await supabase
            .from('categories')
            .update({
              name,
              slug,
              icon,
              image_url: imageUrl,
              display_order: displayOrder,
              is_active: isActive
            })
            .eq('id', editingCategory.id);
        } else if (!editingCategory) {
          await supabase
            .from('categories')
            .insert([{
              name,
              slug,
              icon,
              image_url: imageUrl,
              display_order: displayOrder,
              is_active: isActive
            }]);
        }
      } catch (dbErr) {
        console.warn('Table write notice:', dbErr);
      }

      // 2. Sync to custom taxonomy RPC
      const savedRecord = {
        id: editingCategory?.id || `cat_${Date.now()}`,
        name,
        slug,
        icon,
        image_url: imageUrl,
        display_order: displayOrder,
        is_active: isActive,
        updated_at: new Date().toISOString()
      };

      const existingIndex = categories.findIndex(
        c => (editingCategory?.id && c.id === editingCategory.id) || c.slug === slug
      );

      let nextList = [...categories];
      if (existingIndex >= 0) {
        nextList[existingIndex] = { ...nextList[existingIndex], ...savedRecord };
      } else {
        nextList.push(savedRecord);
      }

      await syncCustomTaxonomy(nextList);
      invalidateWebCaches();
      showToast('success', editingCategory ? `Category "${name}" updated and live!` : `Category "${name}" created and live!`);
      setShowModal(false);
      fetchCategoriesAndCounts(true);
    } catch (err) {
      console.error('Save category error:', err);
      showToast('error', 'Failed to save category: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (cat) => {
    const nextStatus = cat.is_active === false ? true : false;
    setCategories(prev => prev.map(c => (c.id === cat.id || c.slug === cat.slug) ? { ...c, is_active: nextStatus } : c));

    try {
      try {
        if (cat.id && typeof cat.id === 'number') {
          await supabase.from('categories').update({ is_active: nextStatus }).eq('id', cat.id);
        }
      } catch (_) {}

      const nextList = categories.map(c => (c.id === cat.id || c.slug === cat.slug) ? { ...c, is_active: nextStatus } : c);
      await syncCustomTaxonomy(nextList);
      invalidateWebCaches();
      showToast('success', `Category set to ${nextStatus ? 'Active' : 'Inactive'}`);
    } catch (err) {
      console.error(err);
      setCategories(prev => prev.map(c => (c.id === cat.id || c.slug === cat.slug) ? { ...c, is_active: !nextStatus } : c));
      showToast('error', 'Could not update category status');
    }
  };

  const handleDelete = async (cat) => {
    const count = productCounts[(cat.name || '').toLowerCase().trim()] || 0;
    const warn = count > 0 ? ` WARNING: This category currently has ${count} linked products.` : '';

    if (!window.confirm(`Are you sure you want to delete category "${cat.name}"?${warn}`)) return;

    try {
      try {
        if (cat.id && typeof cat.id === 'number') {
          await supabase.from('categories').delete().eq('id', cat.id);
        }
      } catch (_) {}

      const nextList = categories.filter(c => c.id !== cat.id && c.slug !== cat.slug);
      setCategories(nextList);
      await syncCustomTaxonomy(nextList, [cat.slug]);
      invalidateWebCaches();
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

  // Key performance indicators
  const totalCategories = categories.length;
  const activeCategories = categories.filter(c => c.is_active !== false).length;
  const inactiveCategories = categories.filter(c => c.is_active === false).length;
  const totalLinkedProducts = Object.values(productCounts).reduce((acc, curr) => acc + curr, 0);

  return (
    <div className="space-y-6 font-sans">
      {/* Header Banner - Luxury Navy & Gold Aesthetic */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#071422] via-[#0A192F] to-[#0E2340] p-6 sm:p-8 text-white shadow-xl border border-[#D9A73A]/30">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#D9A73A]/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D9A73A]/15 border border-[#D9A73A]/40 text-[#D9A73A] text-xs font-black tracking-widest uppercase mb-2">
              <Sparkles className="w-3.5 h-3.5 text-[#D9A73A]" />
              <span>Abu Mafhal Taxonomy Suite</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Category Management
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl">
              Organize marketplace departments, display sequence, and visibility with instant live catalog synchronization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchCategoriesAndCounts()}
              className="p-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-all hover:scale-105 active:scale-95 shadow-sm"
              title="Refresh categories"
            >
              <RefreshCw className={`w-4 h-4 text-[#D9A73A] ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleOpenAdd}
              className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-[#D9A73A] to-[#B8860B] hover:from-[#E5B548] hover:to-[#C69213] text-[#071422] font-black text-xs sm:text-sm rounded-2xl shadow-lg shadow-[#D9A73A]/25 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Add New Category</span>
            </button>
          </div>
        </div>

        {/* 4 KPI Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 backdrop-blur-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Departments</p>
            <p className="text-xl sm:text-2xl font-black text-white mt-0.5">{totalCategories}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3.5 border border-emerald-500/20 backdrop-blur-sm">
            <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Active & Visible</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-400 mt-0.5">{activeCategories}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3.5 border border-white/10 backdrop-blur-sm">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Inactive / Hidden</p>
            <p className="text-xl sm:text-2xl font-black text-slate-300 mt-0.5">{inactiveCategories}</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-3.5 border border-[#D9A73A]/20 backdrop-blur-sm">
            <p className="text-[11px] font-bold text-[#D9A73A] uppercase tracking-wider">Linked Products</p>
            <p className="text-xl sm:text-2xl font-black text-[#D9A73A] mt-0.5">{totalLinkedProducts}</p>
          </div>
        </div>
      </div>

      {/* Toast Alert */}
      {message.text && (
        <div className={`p-4 rounded-2xl text-xs sm:text-sm font-bold border flex items-center justify-between animate-fadeIn ${
          message.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : 'bg-rose-50 text-rose-800 border-rose-200'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage({ type: '', text: '' })} className="text-xs opacity-70 hover:opacity-100 font-bold px-2">✕</button>
        </div>
      )}

      {/* Search Bar & Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-[#D9A73A] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search department name or slug..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A73A]/30 focus:border-[#D9A73A] transition-all text-slate-800 placeholder-slate-400 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: `All (${totalCategories})` },
            { key: 'active', label: `Active (${activeCategories})` },
            { key: 'inactive', label: `Inactive (${inactiveCategories})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-[#0A192F] text-white shadow-sm border border-[#D9A73A]/40'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Categories Table */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-sm text-center">
          <div className="w-10 h-10 border-4 border-[#D9A73A] border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-xs sm:text-sm font-bold text-slate-600">Loading catalog taxonomy...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#FEF3C7] text-[#D9A73A] flex items-center justify-center mb-4">
            <Layers className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-black text-slate-900">No categories found</h3>
          <p className="text-xs sm:text-sm text-slate-500 max-w-sm mt-1">
            {searchTerm ? 'No results matched your search terms.' : 'Click "Add New Category" above to configure your first marketplace department.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-4 px-5">Department (Name & Slug)</th>
                  <th className="py-4 px-4 text-center">Display Order</th>
                  <th className="py-4 px-4 text-center">Linked Products</th>
                  <th className="py-4 px-4 text-center">Visibility Status</th>
                  <th className="py-4 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredCategories.map((cat) => {
                  const isActive = cat.is_active !== false;
                  const count = productCounts[(cat.name || '').toLowerCase().trim()] || 0;

                  return (
                    <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
                            {cat.image_url ? (
                              <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover" />
                            ) : (
                              <Layers className="w-6 h-6 text-[#D9A73A]" />
                            )}
                          </div>
                          <div>
                            <p className="font-black text-slate-900 group-hover:text-[#D9A73A] transition-colors">{cat.name}</p>
                            <p className="text-xs text-slate-400 font-mono">/{cat.slug || 'category'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center font-bold text-slate-700">
                        <span className="px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-black">
                          #{cat.display_order ?? 0}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
                          <Package className="w-3.5 h-3.5 text-[#D9A73A]" />
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
                          title={isActive ? 'Click to deactivate' : 'Click to activate'}
                        >
                          <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </button>
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenEdit(cat)}
                            className="p-2 rounded-xl text-slate-500 hover:text-[#0A192F] hover:bg-slate-100 transition-all"
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
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden relative">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-[#071422] to-[#0A192F] px-6 py-5 flex items-center justify-between text-white border-b border-[#D9A73A]/20">
              <div>
                <h3 className="text-lg font-black text-white">
                  {editingCategory ? 'Edit Category' : 'Add New Category'}
                </h3>
                <p className="text-xs text-slate-300">Configure marketplace department details, priority and image.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Image Preview & Upload */}
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                  Category Image
                </label>
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center flex-shrink-0 shadow-sm relative">
                    {form.image_url ? (
                      <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-7 h-7 text-[#D9A73A]" />
                    )}
                    {uploading && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <div className="w-5 h-5 border-2 border-[#D9A73A] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="px-3 py-1.5 bg-[#0A192F] hover:bg-[#112240] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <UploadCloud className="w-3.5 h-3.5 text-[#D9A73A]" />
                        <span>{uploading ? 'Uploading...' : 'Choose File'}</span>
                      </button>
                      {form.image_url && (
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, image_url: '' })}
                          className="text-xs text-rose-600 hover:underline font-bold"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <input
                      type="url"
                      placeholder="Or paste direct image URL (https://...)"
                      value={form.image_url}
                      onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#D9A73A]"
                    />
                  </div>
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
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A73A]/20 focus:border-[#D9A73A] font-bold"
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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#D9A73A]/20 focus:border-[#D9A73A] font-mono"
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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#D9A73A]/20 focus:border-[#D9A73A] font-black"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="cat_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 text-[#D9A73A] rounded border-slate-300 focus:ring-[#D9A73A]"
                />
                <label htmlFor="cat_active" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Activate Category (Publish live on customer mobile app & website)
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
                  disabled={saving || uploading}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#D9A73A] to-[#B8860B] hover:from-[#E5B548] hover:to-[#C69213] text-[#071422] text-xs font-black shadow-lg shadow-[#D9A73A]/25 transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving...' : (editingCategory ? 'Update Category' : 'Create & Publish Category')}
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
