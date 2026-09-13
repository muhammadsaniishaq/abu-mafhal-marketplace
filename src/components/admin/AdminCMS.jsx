import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { 
  Sparkles, Plus, Image as ImageIcon, ExternalLink, 
  Trash2, Edit2, CheckCircle, XCircle, RefreshCw, Eye,
  ArrowUpDown, Layers
} from 'lucide-react';

const AdminCMS = () => {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ type: '', text: '' });
  const [activeSection, setActiveSection] = useState('all');

  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    image_url: '',
    action_link: '/shop',
    section: 'home',
    display_order: 1,
    is_active: true
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const showToast = (type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast({ type: '', text: '' }), 4000);
  };

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error('Error loading banners:', error.message);
      showToast('error', 'Kuskure wajen loda banners: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditingBanner(null);
    setForm({
      title: '',
      subtitle: '',
      image_url: '',
      action_link: '/shop',
      section: 'home',
      display_order: banners.length + 1,
      is_active: true
    });
    setShowModal(true);
  };

  const handleOpenEdit = (banner) => {
    setEditingBanner(banner);
    setForm({
      title: banner.title || '',
      subtitle: banner.subtitle || '',
      image_url: banner.image_url || '',
      action_link: banner.action_link || '/shop',
      section: banner.section || 'home',
      display_order: banner.display_order ?? 1,
      is_active: banner.is_active !== false
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.image_url.trim()) {
      showToast('error', 'Da fatan a saka adireshin hoton banner (Image URL)');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        image_url: form.image_url.trim(),
        action_link: form.action_link.trim() || '/shop',
        section: form.section || 'home',
        display_order: parseInt(form.display_order) || 1,
        is_active: form.is_active
      };

      if (editingBanner) {
        const { data, error } = await supabase
          .from('banners')
          .update(payload)
          .eq('id', editingBanner.id)
          .select()
          .single();

        if (error) throw error;
        setBanners(prev => prev.map(b => b.id === editingBanner.id ? data : b));
        showToast('success', 'An sabunta banner cikin nasara!');
      } else {
        const { data, error } = await supabase
          .from('banners')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        setBanners(prev => [...prev, data]);
        showToast('success', 'An dora sabon banner a kasuwa!');
      }

      setShowModal(false);
    } catch (error) {
      console.error('Banner save error:', error);
      showToast('error', 'Kuskure wajen ajiye banner: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (banner) => {
    const nextActive = !banner.is_active;
    try {
      const { error } = await supabase
        .from('banners')
        .update({ is_active: nextActive })
        .eq('id', banner.id);

      if (error) throw error;
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, is_active: nextActive } : b));
      showToast('success', `Banner ya koma ${nextActive ? 'Active' : 'Inactive'}`);
    } catch (error) {
      showToast('error', 'Kuskure wajen canza matsayi: ' + error.message);
    }
  };

  const handleDelete = async (banner) => {
    if (!window.confirm(`Shin kana da tabbacin goge wannan banner "${banner.title || 'Mara Suna'}"?`)) return;

    try {
      const { error } = await supabase
        .from('banners')
        .delete()
        .eq('id', banner.id);

      if (error) throw error;
      setBanners(prev => prev.filter(b => b.id !== banner.id));
      showToast('success', 'An goge banner cikin nasara');
    } catch (error) {
      showToast('error', 'An kasa goge banner: ' + error.message);
    }
  };

  const filteredBanners = banners.filter(b => {
    if (activeSection === 'all') return true;
    return (b.section || 'home') === activeSection;
  });

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── HEADER BANNER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Tallan Kasuwa (Campaigns & Banners)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Tallace da Hero Banners</h1>
          <p className="text-sm text-slate-500 mt-1">Sarrafa dukkan manyan hotunan talla (Hero Banners) da ke yawo a shafin gida da shagon Abu Mafhal.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchBanners}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
            title="Sake loda banners"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-purple-600' : ''}`} />
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-600/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Sanya Sabon Banner</span>
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

      {/* ── SECTION FILTER ── */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveSection('all')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Dukkan Banners ({banners.length})
          </button>
          <button
            onClick={() => setActiveSection('home')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'home' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Shafin Farko (Home)
          </button>
          <button
            onClick={() => setActiveSection('shop')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === 'shop' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Shagon Kasuwa (Shop)
          </button>
        </div>

        <div className="text-xs font-semibold text-slate-500 hidden sm:block">
          Masu Aiki: <strong className="text-emerald-600 font-bold">{banners.filter(b => b.is_active !== false).length}</strong>
        </div>
      </div>

      {/* ── BANNERS GRID ── */}
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-sm text-center">
          <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-sm font-bold text-slate-600">Ana loda banners...</p>
        </div>
      ) : filteredBanners.length === 0 ? (
        <div className="p-16 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200/80 shadow-sm text-center">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-4">
            <ImageIcon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Babu wani banner a halin yanzu</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1">Danna "Sanya Sabon Banner" don dora hoton tallan farko a kasuwa.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredBanners.map((banner) => {
            const isActive = banner.is_active !== false;
            return (
              <div 
                key={banner.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col justify-between group hover:shadow-md transition-all"
              >
                {/* Banner Image Preview */}
                <div className="relative aspect-[16/7] w-full bg-slate-100 overflow-hidden">
                  <img
                    src={banner.image_url}
                    alt={banner.title || 'Banner'}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600'; }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-5 text-white">
                    <span className="inline-block self-start px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/20 backdrop-blur-md mb-1.5">
                      {banner.section || 'home'}
                    </span>
                    <h3 className="text-lg font-black leading-tight drop-shadow-sm">{banner.title || 'Babu Suna'}</h3>
                    {banner.subtitle && (
                      <p className="text-xs text-slate-200 mt-0.5 drop-shadow-sm line-clamp-1">{banner.subtitle}</p>
                    )}
                  </div>

                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-sm ${
                      isActive 
                        ? 'bg-emerald-500/90 text-white' 
                        : 'bg-slate-900/80 text-slate-300'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-slate-500'}`} />
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                {/* Banner Details & Actions */}
                <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-400 font-medium truncate">
                      Link: <span className="font-mono text-slate-600">{banner.action_link || '/shop'}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                      Jeri (Order): #{banner.display_order ?? 1}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(banner)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      }`}
                    >
                      {isActive ? 'Kashe' : 'Kunna'}
                    </button>
                    <button
                      onClick={() => handleOpenEdit(banner)}
                      className="p-2 rounded-xl text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-all"
                      title="Gyara Banner"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(banner)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                      title="Goge Banner"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── ADD / EDIT BANNER MODAL ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  {editingBanner ? 'Gyara Tallan Banner' : 'Sanya Sabon Tallan Banner'}
                </h3>
                <p className="text-xs text-slate-500">Dora hoton talla da zai bayyana a babban shafin kasuwa.</p>
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
                  Hoton Banner (Image URL) *
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://images.unsplash.com/..."
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
                {form.image_url && (
                  <div className="mt-2 aspect-[16/6] rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                    <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Babban Take (Title)
                </label>
                <input
                  type="text"
                  placeholder="Misali: Babban Ragi Na Ranar Juma'a"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Karin Bayani (Subtitle)
                </label>
                <input
                  type="text"
                  placeholder="Misali: Samun rangwamen kashi 30% a dukkan kayan sawa"
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Bangare (Section)
                  </label>
                  <select
                    value={form.section}
                    onChange={(e) => setForm({ ...form, section: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-bold"
                  >
                    <option value="home">Shafin Gida (Home)</option>
                    <option value="shop">Shagon Kasuwa (Shop)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Jeri (Display Order)
                  </label>
                  <input
                    type="number"
                    value={form.display_order}
                    onChange={(e) => setForm({ ...form, display_order: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Mahaɗar Maballi (Action Link)
                </label>
                <input
                  type="text"
                  placeholder="/shop ko /category/electronics"
                  value={form.action_link}
                  onChange={(e) => setForm({ ...form, action_link: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-600 font-mono text-xs"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="banner_active"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                />
                <label htmlFor="banner_active" className="text-sm font-semibold text-slate-700">
                  Kunna wannan banner nan take (Active on Storefront)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Soke (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-lg shadow-purple-600/20 transition-all disabled:opacity-50"
                >
                  {saving ? 'Ana ajiye...' : (editingBanner ? 'Ajiye Gyara' : 'Dora Banner')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCMS;