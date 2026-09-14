import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  Store, Camera, Save, RefreshCw, Check, CheckCircle, 
  MapPin, Phone, ShieldCheck, Globe, Info, Sparkles 
} from 'lucide-react';

const CATEGORY_PRESETS = [
  'Official Mall & Flagship Store',
  'Electronics & Smart Devices',
  'Fashion & Designer Apparel',
  'Beauty, Perfumes & Personal Care',
  'Home, Kitchen & Living',
  'Groceries & Supermarket',
  'Phones & Accessories',
  'General Merchant'
];

const AdminStoreProfile = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });

  // Store profile fields
  const [storeName, setStoreName] = useState('Abu Mafhal Official Store');
  const [category, setCategory] = useState('Official Mall & Flagship Store');
  const [about, setAbout] = useState('');
  const [coverImage, setCoverImage] = useState('https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop');
  const [logoUrl, setLogoUrl] = useState('');
  const [phone, setPhone] = useState('2349021486162');
  const [address, setAddress] = useState('Main Commercial Plaza, Gashua, Yobe State, Nigeria');
  const [adminProfileId, setAdminProfileId] = useState(null);

  useEffect(() => {
    fetchAdminStore();
  }, [currentUser]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast({ type: '', message: '' }), 4000);
  };

  const fetchAdminStore = async () => {
    setLoading(true);
    try {
      // 1. Try fetching profile by current user ID or role 'admin'
      let query = supabase.from('profiles').select('*');
      if (currentUser?.uid) {
        query = query.eq('id', currentUser.uid);
      } else {
        query = query.eq('role', 'admin').limit(1);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;

      if (data) {
        setAdminProfileId(data.id);
        if (data.business_name) setStoreName(data.business_name);
        if (data.business_category) setCategory(data.business_category);
        if (data.about) setAbout(data.about);
        if (data.cover_image) setCoverImage(data.cover_image);
        if (data.avatar_url) setLogoUrl(data.avatar_url);
        if (data.phone) setPhone(data.phone);
        if (data.address) {
          if (data.address.startsWith('{')) {
            try {
              const parsed = JSON.parse(data.address);
              if (parsed.address) setAddress(parsed.address);
              if (!data.about && parsed.about) setAbout(parsed.about);
              if (!data.cover_image && parsed.cover_image) setCoverImage(parsed.cover_image);
              if (!data.business_category && parsed.category) setCategory(parsed.category);
            } catch (_) {
              setAddress(data.address);
            }
          } else {
            setAddress(data.address);
          }
        }
      }
    } catch (err) {
      console.error('Error loading admin store:', err);
      showToast('error', 'Failed to load official store data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e, type = 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const targetId = adminProfileId || currentUser?.uid || 'admin';
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `${targetId}/${type}_${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      if (type === 'cover') {
        setCoverImage(publicUrl);
        showToast('success', 'Cover banner photo uploaded!');
      } else {
        setLogoUrl(publicUrl);
        showToast('success', 'Store logo uploaded!');
      }
    } catch (err) {
      showToast('error', 'Upload failed: ' + err.message);
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const targetId = adminProfileId || currentUser?.uid;
      if (!targetId) {
        throw new Error('Admin profile ID not found. Please ensure you are logged in as admin.');
      }

      const addrPayload = JSON.stringify({
        address: address,
        about: about,
        cover_image: coverImage,
        category: category,
        business_name: storeName
      });

      const updates = {
        id: targetId,
        business_name: storeName,
        business_category: category,
        about: about,
        cover_image: coverImage,
        avatar_url: logoUrl,
        phone: phone,
        address: addrPayload,
        is_recommended: true,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updates, { onConflict: 'id' });

      if (error) throw error;

      showToast('success', 'Official Store profile saved and live across Mobile & Web!');
    } catch (err) {
      console.error('Error saving store profile:', err);
      showToast('error', 'Failed to save store: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-bold text-slate-500">Loading official flagship store data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Official Mall Customizer
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#0A192F] tracking-tight">
            Official Flagship Store Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            Customize the primary Abu Mafhal marketplace store: Banner cover, brand logo, store name & bio.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-[#0A192F] hover:bg-sky-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-navy-900/20 flex items-center gap-2 transition-all shrink-0"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4 text-sky-400" />
          )}
          <span>{saving ? 'Saving...' : 'Save Store Profile'}</span>
        </button>
      </div>

      {/* Toast */}
      {toast.message && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Info className="w-4 h-4 text-rose-600" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* LIVE STORE PREVIEW CARD */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Store className="w-4 h-4 text-sky-600" /> Live Customer Store Preview
          </span>
          <span className="text-[10px] font-bold text-slate-400">Updates live as you type</span>
        </div>

        {/* Banner Area */}
        <div className="h-44 sm:h-52 w-full relative overflow-hidden bg-slate-900">
          {coverImage ? (
            <img src={coverImage} alt="Store Cover" className="w-full h-full object-cover opacity-85" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">No Cover Image Set</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          <span className="absolute top-4 right-4 bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-md shadow-md">
            OFFICIAL MALL
          </span>

          <div className="absolute bottom-4 left-6 flex items-end gap-4">
            <div className="w-20 h-20 rounded-2xl bg-white p-1 shadow-xl overflow-hidden border-2 border-white shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Store Logo" className="w-full h-full object-contain" />
              ) : (
                <Store className="w-full h-full text-sky-600 p-3" />
              )}
            </div>
            <div className="text-white pb-1">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black">{storeName || 'Abu Mafhal Official Store'}</h2>
                <ShieldCheck className="w-4 h-4 text-sky-400 fill-sky-400/20" />
              </div>
              <p className="text-xs text-sky-300 font-semibold">{category}</p>
            </div>
          </div>
        </div>

        {/* Bio Preview */}
        <div className="p-6 bg-slate-50/30 text-xs text-slate-600 leading-relaxed border-t border-slate-100">
          <span className="font-bold text-slate-900 block mb-1">About Our Official Store:</span>
          {about || 'The official verified flagship store of Abu Mafhal Marketplace. Genuine brand warranty, authentic products, and 100% buyer protection across Nigeria.'}
        </div>
      </div>

      {/* EDIT FORM */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-100 p-6 sm:p-8 space-y-6 shadow-sm">
        <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">
          Store Branding & Information
        </h3>

        {/* Cover Banner Settings */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700">Store Cover Banner Image</label>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              value={coverImage}
              onChange={e => setCoverImage(e.target.value)}
              placeholder="Paste direct Cover Image URL (e.g. https://...)..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-500/20"
            />
            <label className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl cursor-pointer shrink-0 flex items-center gap-1.5 transition-all">
              <Camera className="w-3.5 h-3.5 text-slate-600" />
              <span>Upload Photo</span>
              <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'cover')} className="hidden" />
            </label>
          </div>
        </div>

        {/* Logo Settings */}
        <div className="space-y-3">
          <label className="block text-xs font-bold text-slate-700">Store Brand Logo</label>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <input
              type="text"
              value={logoUrl}
              onChange={e => setLogoUrl(e.target.value)}
              placeholder="Paste direct Logo URL..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-sky-500/20"
            />
            <label className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl cursor-pointer shrink-0 flex items-center gap-1.5 transition-all">
              <Camera className="w-3.5 h-3.5 text-slate-600" />
              <span>Upload Logo</span>
              <input type="file" accept="image/*" onChange={e => handleFileUpload(e, 'logo')} className="hidden" />
            </label>
          </div>
        </div>

        {/* Store Name & Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Store / Mall Name *</label>
            <input
              type="text"
              value={storeName}
              onChange={e => setStoreName(e.target.value)}
              placeholder="e.g. Abu Mafhal Official Store"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-sky-500/20"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-bold focus:ring-2 focus:ring-sky-500/20"
            >
              {CATEGORY_PRESETS.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* WhatsApp & Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Customer WhatsApp / Direct Phone</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 2349021486162"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Store Headquarters / Address</label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. Main Commercial Plaza, Gashua, Yobe State, Nigeria"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        </div>

        {/* About Bio */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">About Your Store / Bio</label>
          <textarea
            rows={4}
            value={about}
            onChange={e => setAbout(e.target.value)}
            placeholder="Tell marketplace buyers about the official store warranty, authentic brands, return policies..."
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-900 focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 bg-[#0A192F] hover:bg-sky-700 text-white font-black text-xs rounded-2xl shadow-xl shadow-navy-900/20 flex items-center justify-center gap-2 transition-all"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4 text-emerald-400" />
          )}
          <span>{saving ? 'Saving...' : 'Save and Publish Store Profile'}</span>
        </button>
      </form>
    </div>
  );
};

export default AdminStoreProfile;
