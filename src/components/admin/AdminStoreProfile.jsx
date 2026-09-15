import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { 
  Store, Camera, RefreshCw, Check, 
  MapPin, Phone, ShieldCheck, Globe, Info, Sparkles, Clock, FileText, Instagram, Facebook, Twitter, Mail
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

const WORKING_HOURS_PRESETS = [
  'Mon - Sat: 8:00 AM - 8:00 PM',
  'Mon - Fri: 9:00 AM - 5:00 PM',
  'Open 24/7 (Online Store)',
  'Mon - Sun: 8:00 AM - 10:00 PM'
];

const AdminStoreProfile = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ type: '', message: '' });

  // Store profile fields
  const [storeName, setStoreName] = useState('Abu Mafhal Official Store');
  const [tagline, setTagline] = useState('Official Flagship Mall • 100% Genuine Guaranteed');
  const [category, setCategory] = useState('Official Mall & Flagship Store');
  const [about, setAbout] = useState('');
  const [coverImage, setCoverImage] = useState('https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop');
  const [logoUrl, setLogoUrl] = useState('');
  const [phone, setPhone] = useState('08145853539');
  const [whatsapp, setWhatsapp] = useState('08145853539');
  const [email, setEmail] = useState('support@abumafhal.com');
  const [address, setAddress] = useState('Main Commercial Plaza, Gashua, Yobe State, Nigeria');
  const [workingHours, setWorkingHours] = useState('Mon - Sat: 8:00 AM - 8:00 PM');
  const [policy, setPolicy] = useState('7 Days Nationwide Return Policy • 100% Buyer Protection');
  const [instagram, setInstagram] = useState('@abumafhal');
  const [facebook, setFacebook] = useState('Abu Mafhal Marketplace');
  const [twitter, setTwitter] = useState('@abumafhal');
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
        if (data.email) setEmail(data.email);

        if (data.address) {
          if (data.address.startsWith('{')) {
            try {
              const parsed = JSON.parse(data.address);
              if (parsed.address) setAddress(parsed.address);
              if (parsed.tagline) setTagline(parsed.tagline);
              if (!data.about && parsed.about) setAbout(parsed.about);
              if (!data.cover_image && parsed.cover_image) setCoverImage(parsed.cover_image);
              if (!data.business_category && parsed.category) setCategory(parsed.category);
              if (parsed.whatsapp) setWhatsapp(parsed.whatsapp);
              if (parsed.working_hours) setWorkingHours(parsed.working_hours);
              if (parsed.policy) setPolicy(parsed.policy);
              if (parsed.instagram) setInstagram(parsed.instagram);
              if (parsed.facebook) setFacebook(parsed.facebook);
              if (parsed.twitter) setTwitter(parsed.twitter);
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
        tagline: tagline,
        about: about,
        cover_image: coverImage,
        logo: logoUrl,
        category: category,
        business_name: storeName,
        phone: phone,
        whatsapp: whatsapp,
        email: email,
        working_hours: workingHours,
        policy: policy,
        instagram: instagram,
        facebook: facebook,
        twitter: twitter,
        is_recommended: true
      });

      // 1. Update profiles table safely
      const profileUpdates = {
        business_name: storeName,
        business_category: category,
        about: about,
        cover_image: coverImage,
        avatar_url: logoUrl,
        address: addrPayload,
        is_recommended: true,
        updated_at: new Date().toISOString()
      };

      if (phone) {
        profileUpdates.phone_number = phone;
        profileUpdates.phone = phone;
      }

      let { error: profError } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', targetId);

      if (profError) {
        console.warn('Profile update retry without conflicting phone column:', profError.message);
        delete profileUpdates.phone;
        await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', targetId);
      }

      // 2. Update dedicated stores table safely
      try {
        const storeData = {
          name: storeName,
          about: about,
          cover_image: coverImage,
          logo: logoUrl,
          phone: phone || whatsapp,
          category: category,
          address: address,
          is_recommended: true,
          is_official: true,
          is_verified: true,
          updated_at: new Date().toISOString()
        };

        const { data: existingStore } = await supabase
          .from('stores')
          .select('id')
          .eq('user_id', targetId)
          .maybeSingle();

        if (existingStore) {
          await supabase.from('stores').update(storeData).eq('user_id', targetId);
        } else {
          await supabase.from('stores').insert({ user_id: targetId, ...storeData });
        }
      } catch (stErr) {
        console.warn('stores table sync notice:', stErr.message);
      }

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
        <p className="text-xs text-slate-500 font-bold">Loading official store settings...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Official Flagship Store Profile</h1>
            <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
              OFFICIAL MALL
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Customize the official Abu Mafhal flagship mall branding, cover photo, bio, guarantees and contacts.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-[#0A192F] hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-2 transition-all shrink-0"
        >
          {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-emerald-400" />}
          <span>{saving ? 'Saving...' : 'Save Live Changes'}</span>
        </button>
      </div>

      {/* Toast Alert */}
      {toast.message && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center gap-2 transition-all ${
          toast.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <Info className="w-4 h-4 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* LIVE STORE PREVIEW */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[11px] font-black uppercase text-slate-600 tracking-wider">Live Customer Preview</span>
          </div>
          <span className="text-[10px] text-slate-400 font-bold">Matches Mobile & Web Storefronts</span>
        </div>

        {/* Banner */}
        <div className="relative h-44 sm:h-56 bg-slate-800 overflow-hidden">
          <img
            src={coverImage || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop'}
            alt="Store Cover Banner"
            className="w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/30" />
          
          <div className="absolute top-4 right-4 bg-amber-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md">
            <span>⭐ OFFICIAL MALL</span>
          </div>

          <div className="absolute bottom-4 left-6 right-6 flex items-end gap-4">
            <div className="w-20 h-20 rounded-2xl border-4 border-white bg-white shadow-xl overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="Store Logo" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
                  <Store className="w-8 h-8 text-[#0A192F]" />
                </div>
              )}
            </div>

            <div className="text-white pb-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black truncate">{storeName || 'Abu Mafhal Official Store'}</h2>
                <ShieldCheck className="w-4 h-4 text-sky-400 fill-sky-400/20 shrink-0" />
              </div>
              <p className="text-xs text-amber-300 font-bold truncate">{tagline}</p>
              <p className="text-[11px] text-slate-300 font-medium">{category}</p>
            </div>
          </div>
        </div>

        {/* Meta & Bio Preview */}
        <div className="p-6 bg-slate-50/50 space-y-3 text-xs border-t border-slate-100">
          <p className="text-slate-700 leading-relaxed font-medium">
            {about || 'The official verified flagship store of Abu Mafhal Marketplace. Genuine brand warranty, authentic products, and 100% buyer protection across Nigeria.'}
          </p>
          <div className="flex flex-wrap gap-4 pt-2 text-[11px] text-slate-500 font-semibold border-t border-slate-200">
            <div className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-emerald-600" /> WhatsApp: {whatsapp || phone}</div>
            <div className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-600" /> {workingHours}</div>
            <div className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-sky-600" /> {address}</div>
          </div>
        </div>
      </div>

      {/* EDIT FORM */}
      <form onSubmit={handleSave} className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm">
        <h3 className="text-base font-black text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-3">
          Store Branding & Settings
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

        {/* Store Name, Tagline & Category */}
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

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">Store Slogan / Tagline</label>
          <input
            type="text"
            value={tagline}
            onChange={e => setTagline(e.target.value)}
            placeholder="e.g. Official Flagship Mall • 100% Genuine Guaranteed"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        {/* WhatsApp & Phone & Email */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">WhatsApp Business Number</label>
            <input
              type="text"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              placeholder="e.g. 2349021486162"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Primary Phone Number</label>
            <input
              type="text"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 2349021486162"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Support Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="e.g. support@abumafhal.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        </div>

        {/* Location & Operating Hours */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Hours of Operation</label>
            <input
              type="text"
              value={workingHours}
              onChange={e => setWorkingHours(e.target.value)}
              placeholder="e.g. Mon - Sat: 8:00 AM - 8:00 PM"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        </div>

        {/* Warranty & Delivery Policy */}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-2">Buyer Warranty & Delivery Policy</label>
          <input
            type="text"
            value={policy}
            onChange={e => setPolicy(e.target.value)}
            placeholder="e.g. 7 Days Nationwide Return Policy • 100% Genuine Guaranteed"
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-sky-500/20"
          />
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

        {/* Social Media */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Instagram</label>
            <input
              type="text"
              value={instagram}
              onChange={e => setInstagram(e.target.value)}
              placeholder="@abumafhal"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Facebook</label>
            <input
              type="text"
              value={facebook}
              onChange={e => setFacebook(e.target.value)}
              placeholder="Abu Mafhal Marketplace"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Twitter / X</label>
            <input
              type="text"
              value={twitter}
              onChange={e => setTwitter(e.target.value)}
              placeholder="@abumafhal"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 bg-[#0A192F] hover:bg-sky-700 text-white font-black text-sm rounded-2xl shadow-xl shadow-navy-900/20 flex items-center justify-center gap-2 transition-all"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-5 h-5 text-emerald-400" />
          )}
          <span>{saving ? 'Publishing Changes...' : 'Save and Publish Official Store Profile'}</span>
        </button>
      </form>
    </div>
  );
};

export default AdminStoreProfile;
