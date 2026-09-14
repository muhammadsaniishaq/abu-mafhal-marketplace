import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Store, CheckCircle, Star, Heart, Search, Bell, ShoppingCart,
  MapPin, ChevronRight, ArrowRight, ExternalLink, ShieldCheck, Plus,
  Sparkles, Phone, MessageSquare, Share2, X, Check, Eye, LayoutGrid,
  List, Lock, Zap, Award, Building2, Layers
} from 'lucide-react';
import { supabase } from '../config/supabase';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import Navbar from '../components/common/Navbar';

const FOLLOWED_STORES_KEY = 'abumafhal_followed_stores_web_v2';
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400&auto=format&fit=crop';
const AM_LOGO = '/logo.png';

const getImg = (product) => {
  if (product?.image_url) return product.image_url;
  if (Array.isArray(product?.images) && product.images.length > 0) return product.images[0];
  if (typeof product?.images === 'string') {
    try {
      const parsed = JSON.parse(product.images);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed[0];
    } catch (_) {}
    return product.images;
  }
  return FALLBACK_IMG;
};

const Stores = () => {
  const navigate = useNavigate();
  const { cart, addToCart } = useCart();
  const { wishlist, toggleWishlist } = useWishlist();

  const [activeTab, setActiveTab] = useState('popular');
  const [viewMode, setViewMode] = useState('rich'); // 'rich' | 'grid'
  const [searchQuery, setSearchQuery] = useState('');
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [followedStores, setFollowedStores] = useState({});
  const [loading, setLoading] = useState(true);

  // Dedicated Store Modal View
  const [selectedStore, setSelectedStore] = useState(null);
  const [storeSearch, setStoreSearch] = useState('');
  const [storeCategoryFilter, setStoreCategoryFilter] = useState('all');
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FOLLOWED_STORES_KEY);
      if (raw) setFollowedStores(JSON.parse(raw));
    } catch (_) {}

    fetchStoresAndData();
  }, []);

  const toggleFollow = (storeId, storeName) => {
    setFollowedStores(prev => {
      const isFollowed = !prev[storeId];
      const updated = { ...prev, [storeId]: isFollowed };
      try {
        localStorage.setItem(FOLLOWED_STORES_KEY, JSON.stringify(updated));
      } catch (_) {}
      showToast(isFollowed ? `Now following ${storeName}` : `Unfollowed ${storeName}`);
      return updated;
    });
  };

  const fetchStoresAndData = async () => {
    setLoading(true);
    try {
      const [profilesRes, productsRes, categoriesRes] = await Promise.allSettled([
        supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: true }),
        supabase
          .from('products')
          .select('id, name, description, price, compare_at_price, image_url, images, category, rating, reviews, stock, total_sales, is_active, status, vendor_id, created_at')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .limit(120),
        supabase
          .from('categories')
          .select('id, name, slug, icon, is_active')
          .eq('is_active', true)
          .order('display_order', { ascending: true })
      ]);

      const realProducts = (productsRes.status === 'fulfilled' && productsRes.value?.data) ? productsRes.value.data : [];
      const realCategories = (categoriesRes.status === 'fulfilled' && categoriesRes.value?.data) ? categoriesRes.value.data : [];
      const allProfiles = (profilesRes.status === 'fulfilled' && Array.isArray(profilesRes.value?.data)) ? profilesRes.value.data : [];
      
      setProducts(realProducts);
      setCategories(realCategories);

      // Group products by vendor_id
      const productsByVendor = {};
      const unassignedProducts = [];
      realProducts.forEach(prod => {
        if (prod.vendor_id) {
          if (!productsByVendor[prod.vendor_id]) productsByVendor[prod.vendor_id] = [];
          productsByVendor[prod.vendor_id].push(prod);
        } else {
          unassignedProducts.push(prod);
        }
      });

      const adminProfile = allProfiles.find(p => p.role === 'admin') || null;
      const vendorProfiles = allProfiles.filter(p => p.id !== adminProfile?.id && (p.role === 'vendor' || (typeof p.business_name === 'string' && p.business_name.trim().length > 0)));

      // Parse metadata helper
      const parseAddr = (addr) => {
        if (!addr || typeof addr !== 'string') return {};
        try {
          if (addr.startsWith('{') && addr.endsWith('}')) return JSON.parse(addr);
        } catch (_) {}
        return {};
      };

      const adminAddr = parseAddr(adminProfile?.address);
      const adminProds = [...(productsByVendor[adminProfile?.id] || []), ...unassignedProducts];

      // Official Flagship Store (Always verified & recommended)
      const officialStore = {
        id: adminProfile?.id || 'official-abumafhal',
        name: adminProfile?.business_name || 'Abu Mafhal Official Store',
        tagline: adminAddr.tagline || 'Official Flagship Mall • 100% Genuine Guaranteed',
        category: adminProfile?.business_category || 'Official Mall & Flagship Store',
        rating: 5.0,
        reviews: '3.8K',
        baseFollowers: 1420,
        products: adminProds.length > 0 ? adminProds : realProducts,
        productsCount: adminProds.length > 0 ? adminProds.length : realProducts.length,
        avatar: adminProfile?.avatar_url || AM_LOGO,
        banner: adminProfile?.cover_image || adminAddr.cover_image || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&q=80',
        verified: true,
        isOfficial: true,
        is_recommended: true,
        isRecommended: true,
        phone: adminProfile?.phone || adminProfile?.phone_number || '2349021486162',
        whatsapp: adminAddr.whatsapp || adminProfile?.phone || '2349021486162',
        email: adminAddr.email || adminProfile?.email || 'support@abumafhal.com',
        address: adminAddr.address || adminProfile?.address || 'Main Commercial Plaza, Gashua, Yobe State, Nigeria',
        working_hours: adminAddr.working_hours || 'Mon - Sat: 8:00 AM - 8:00 PM',
        policy: adminAddr.policy || '7 Days Nationwide Return Policy • 100% Buyer Protection',
        instagram: adminAddr.instagram || '@abumafhal',
        facebook: adminAddr.facebook || 'Abu Mafhal Marketplace',
        twitter: adminAddr.twitter || '@abumafhal',
        bio: adminProfile?.about || adminAddr.about || 'The official verified flagship mall of Abu Mafhal Marketplace. Genuine brand warranty, authentic products, and 100% buyer protection across Nigeria.',
        memberSince: adminProfile?.created_at ? new Date(adminProfile.created_at).getFullYear().toString() : '2023'
      };

      const mappedVendors = vendorProfiles.map(vp => {
        const storeProds = productsByVendor[vp.id] || [];
        const year = vp.created_at ? new Date(vp.created_at).getFullYear().toString() : '2024';
        const vAddr = parseAddr(vp.address);
        const isRec = vp.is_recommended !== undefined ? !!vp.is_recommended : (vAddr.is_recommended || false);

        return {
          id: vp.id,
          name: vp.business_name || vp.full_name || vp.username || 'Verified Merchant',
          tagline: vAddr.tagline || 'Verified Merchant on Abu Mafhal',
          category: vp.business_category || vAddr.category || (vp.role === 'vendor' ? 'Verified Seller' : 'Registered Merchant'),
          rating: 4.9,
          reviews: '120+',
          baseFollowers: 165,
          products: storeProds,
          productsCount: storeProds.length,
          avatar: vp.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(vp.business_name || vp.full_name || 'Vendor')}&background=0A192F&color=38BDF8`,
          banner: vp.cover_image || vAddr.cover_image || 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=1200&q=80',
          verified: true,
          isOfficial: false,
          is_recommended: isRec,
          isRecommended: isRec,
          phone: vp.phone || vp.phone_number || '2349021486162',
          whatsapp: vAddr.whatsapp || vp.phone || vp.phone_number || '',
          email: vAddr.email || vp.email || '',
          address: vAddr.address || vp.address || vp.state || 'Nigeria',
          working_hours: vAddr.working_hours || 'Mon - Sat: 8:00 AM - 6:00 PM',
          policy: vAddr.policy || 'Prompt delivery and standard merchant warranty apply.',
          instagram: vAddr.instagram || '',
          facebook: vAddr.facebook || '',
          twitter: vAddr.twitter || '',
          bio: vp.about || vAddr.about || `Authentic merchant verified on Abu Mafhal Marketplace since ${year}. Dedicated to high quality products and reliable customer support.`,
          memberSince: year
        };
      });

      setStores([officialStore, ...mappedVendors]);
    } catch (err) {
      console.error('[Stores] Error loading stores:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppContact = (store, e) => {
    if (e) e.stopPropagation();
    const rawPhone = store.whatsapp || store.phone || '2349021486162';
    const phone = rawPhone.replace(/[^0-9]/g, '');
    const msg = encodeURIComponent(`Hello ${store.name}, I am contacting you directly from Abu Mafhal Marketplace regarding your products.`);
    window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
  };

  const handleAddToCart = (product, e) => {
    if (e) e.stopPropagation();
    if (addToCart) {
      addToCart(product);
      showToast(`Added "${product.name}" to cart!`);
    }
  };

  // Filter stores
  const filteredStores = stores.filter(store => {
    const matchesSearch = !searchQuery || 
      store.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      store.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (store.tagline && store.tagline.toLowerCase().includes(searchQuery.toLowerCase()));
    if (!matchesSearch) return false;

    if (activeTab === 'recommended') return !!(store.is_recommended || store.isRecommended);
    if (activeTab === 'top_rated') return Number(store.rating) >= 4.9;
    if (activeTab === 'official') return store.isOfficial;
    return true;
  });

  // Filter store modal products
  const currentStoreProducts = selectedStore?.products || [];
  const modalFilteredProducts = currentStoreProducts.filter(p => {
    const matchesSearch = !storeSearch || 
      p.name.toLowerCase().includes(storeSearch.toLowerCase()) ||
      (p.category && p.category.toLowerCase().includes(storeSearch.toLowerCase()));

    const matchesCat = storeCategoryFilter === 'all' || 
      (p.category && p.category.toLowerCase() === storeCategoryFilter.toLowerCase());

    return matchesSearch && matchesCat;
  });

  const modalCategories = ['all', ...new Set(currentStoreProducts.map(p => p.category).filter(Boolean))];

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-800 antialiased">
      {/* Site Navbar */}
      <Navbar />

      {/* Main Content Area */}
      <main className="max-w-[1500px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">

        {/* ══════════════════════════════════════════════════
            1. TOP HEADER TITLE & SEARCH / CTA
        ══════════════════════════════════════════════════ */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-1 bg-sky-100 text-sky-700 text-[11px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600" /> Verified Merchant Directory
              </span>
              <span className="hidden sm:inline-flex px-2.5 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-full">
                100% Genuine Guaranteed
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0A192F] tracking-tight">
              Abu Mafhal Verified Stores
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Browse authentic goods directly from vetted Nigerian merchants with buyer escrow protection.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search input in header */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search stores, brands, items..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all font-medium"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <Link
              to="/vendor/register"
              className="shrink-0 px-4 sm:px-5 py-2.5 bg-[#0284C7] hover:bg-sky-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-sky-600/20 flex items-center gap-2 transition-all hover:-translate-y-0.5"
            >
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">Open a Store</span>
              <span className="sm:hidden">Sell</span>
            </Link>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            2. TRUST & PLATFORM TICKER
        ══════════════════════════════════════════════════ */}
        <div className="bg-gradient-to-r from-slate-900 via-[#0A192F] to-slate-900 rounded-2xl p-3 sm:p-3.5 text-white shadow-md overflow-x-auto">
          <div className="flex items-center justify-around min-w-[620px] text-xs font-semibold gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>100% Vetted Merchants</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Buyer Escrow Protection</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Direct WhatsApp Chat</span>
            </div>
            <span className="text-slate-600">•</span>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Fast Express Dispatch</span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════
            3. "FEATURED BRANDS" STORY RINGS (Instagram / Shopee Style)
        ══════════════════════════════════════════════════ */}
        {stores.length > 0 && (
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-3.5 px-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-slate-800 tracking-wider uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Featured Brands
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  • Click to open storefront
                </span>
              </div>
              <span className="text-[11px] text-sky-600 font-bold hidden sm:inline">
                {stores.length} Verified Brands
              </span>
            </div>

            <div className="flex items-center gap-4 sm:gap-6 overflow-x-auto pb-2 scrollbar-none">
              {stores.slice(0, 12).map((st) => {
                const isOfficial = st.isOfficial;
                const isRec = st.is_recommended || st.isRecommended;

                return (
                  <button
                    key={'story-' + st.id}
                    onClick={() => setSelectedStore(st)}
                    className="flex flex-col items-center gap-1.5 shrink-0 group focus:outline-none"
                  >
                    <div className={`p-0.5 rounded-full transition-transform duration-300 group-hover:scale-105 ${
                      isOfficial
                        ? 'bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 p-[2.5px] shadow-sm'
                        : isRec
                        ? 'bg-gradient-to-tr from-emerald-500 via-teal-400 to-sky-500 p-[2.5px] shadow-sm'
                        : 'bg-gradient-to-tr from-sky-400 to-indigo-500 p-[2px]'
                    }`}>
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white p-0.5 overflow-hidden relative flex items-center justify-center">
                        {st.avatar ? (
                          <img
                            src={st.avatar}
                            alt={st.name}
                            className="w-full h-full object-contain rounded-full"
                          />
                        ) : (
                          <Store className="w-6 h-6 text-sky-600" />
                        )}
                        {st.verified && (
                          <div className="absolute bottom-0 right-0 w-4 h-4 bg-sky-600 rounded-full border-2 border-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-white" />
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 max-w-[70px] truncate text-center group-hover:text-sky-600 transition-colors">
                      {st.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            4. SUB-TABS & VIEW MODE TOGGLE
        ══════════════════════════════════════════════════ */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'popular', label: 'All Verified Stores' },
              { id: 'recommended', label: '⭐ Recommended Vendors' },
              { id: 'official', label: 'Official Flagship Mall' },
              { id: 'top_rated', label: 'Top Rated Sellers' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-[#0284C7] text-white shadow-md shadow-sky-600/25'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-white border border-slate-200 rounded-xl p-0.5 shadow-sm">
              <button
                onClick={() => setViewMode('rich')}
                title="Rich Cards"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'rich' ? 'bg-[#0A192F] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                title="Compact Grid"
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid' ? 'bg-[#0A192F] text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <Link to="/shop" className="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1 shrink-0">
              <span>All Products</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-sky-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading verified stores & live catalog...</p>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            5. MODERN VENDOR CARDS (RICH OR COMPACT GRID)
        ══════════════════════════════════════════════════ */}
        {!loading && filteredStores.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm space-y-3">
            <Store className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-bold text-slate-800">No stores found</h3>
            <p className="text-xs text-slate-500">No merchants match your search term "{searchQuery}".</p>
            <button
              onClick={() => { setSearchQuery(''); setActiveTab('popular'); }}
              className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold shadow-md"
            >
              Reset Filters
            </button>
          </div>
        ) : !loading && viewMode === 'rich' ? (
          /* ─── RICH COMPACT MOBILE-FIRST VENDOR CARDS ─── */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredStores.map((store) => {
              const isFollowed = !!followedStores[store.id];
              const followers = (store.baseFollowers || 100) + (isFollowed ? 1 : 0);
              const previewProds = (store.products && Array.isArray(store.products)) ? store.products.slice(0, 3) : [];

              return (
                <div
                  key={store.id}
                  className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-slate-200/60 transition-all flex flex-col justify-between group hover:-translate-y-1"
                >
                  <div>
                    {/* Micro Cover Banner (75px) */}
                    <div 
                      onClick={() => setSelectedStore(store)}
                      className="h-20 w-full relative overflow-hidden bg-slate-900 cursor-pointer"
                    >
                      <img
                        src={store.banner}
                        alt={store.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 opacity-80"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      
                      {/* Left Top Badge */}
                      <div className="absolute top-2.5 left-2.5">
                        {store.isOfficial ? (
                          <span className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-md">
                            OFFICIAL MALL
                          </span>
                        ) : (store.is_recommended || store.isRecommended) ? (
                          <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-md flex items-center gap-1">
                            ⭐ RECOMMENDED
                          </span>
                        ) : (
                          <span className="bg-emerald-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-md shadow-md flex items-center gap-1">
                            <CheckCircle className="w-2.5 h-2.5" /> VERIFIED
                          </span>
                        )}
                      </div>

                      {/* Right Quick Follow Heart */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFollow(store.id, store.name); }}
                        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm text-white hover:bg-black/60 flex items-center justify-center transition-all"
                        title={isFollowed ? 'Unfollow' : 'Follow'}
                      >
                        <Heart className={`w-3.5 h-3.5 ${isFollowed ? 'fill-rose-500 text-rose-500' : ''}`} />
                      </button>
                    </div>

                    {/* Store Identity & Overlapping Avatar */}
                    <div className="p-4 pt-0 relative">
                      <div className="relative -mt-7 mb-2.5 flex items-end justify-between">
                        <div 
                          onClick={() => setSelectedStore(store)}
                          className="w-14 h-14 rounded-2xl overflow-hidden border-3 border-white shadow-md bg-white flex items-center justify-center cursor-pointer p-0.5"
                        >
                          {store.avatar ? (
                            <img src={store.avatar} alt={store.name} className="w-full h-full object-contain rounded-xl" />
                          ) : (
                            <Store className="w-6 h-6 text-sky-600" />
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-semibold block">Merchant Rating</span>
                          <div className="flex items-center gap-1 text-amber-500 font-black text-xs">
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
                            <span>{store.rating}</span>
                            <span className="text-slate-400 font-medium">({store.reviews})</span>
                          </div>
                        </div>
                      </div>

                      <div 
                        onClick={() => setSelectedStore(store)}
                        className="cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm sm:text-base font-black text-slate-900 truncate group-hover:text-sky-600 transition-colors">
                            {store.name}
                          </h3>
                          {store.verified && (
                            <CheckCircle className="w-4 h-4 fill-sky-600 text-white shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{store.category}</p>
                      </div>

                      {/* Micro-Stats Strip */}
                      <div className="flex items-center gap-2 text-[11px] text-slate-600 mt-2 font-semibold bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100">
                        <span>{store.productsCount} Products</span>
                        <span className="text-slate-300">•</span>
                        <span>{followers} Fans</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-emerald-700 font-bold">Fast Dispatch</span>
                      </div>

                      {/* ─── MINI 3-PRODUCT PREVIEW STRIP (Shopify / Shopee style) ─── */}
                      {previewProds.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-slate-100">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Catalog Preview
                            </span>
                            <span className="text-[10px] text-sky-600 font-bold hover:underline cursor-pointer" onClick={() => setSelectedStore(store)}>
                              View all ({store.productsCount})
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {previewProds.map((prod, pIdx) => (
                              <div
                                key={'p-prev-' + prod.id + '-' + pIdx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/product/${prod.id}`);
                                }}
                                className="group/item relative rounded-xl overflow-hidden border border-slate-100 bg-slate-50 aspect-square cursor-pointer hover:border-sky-300 hover:shadow-sm transition-all"
                              >
                                <img
                                  src={getImg(prod)}
                                  alt={prod.name}
                                  className="w-full h-full object-contain p-1 group-hover/item:scale-110 transition-transform duration-300"
                                />
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent py-0.5 px-1 text-center">
                                  <span className="text-[9px] font-black text-white block truncate">
                                    ₦{Number(prod.price).toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Row */}
                  <div className="p-4 pt-0 grid grid-cols-2 gap-2 border-t border-slate-50 pt-3">
                    <button
                      onClick={(e) => handleWhatsAppContact(store, e)}
                      className="py-2.5 px-2 rounded-xl text-xs font-bold border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 flex items-center justify-center gap-1.5 transition-all"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      onClick={() => setSelectedStore(store)}
                      className="py-2.5 px-3 bg-[#0A192F] hover:bg-sky-700 text-white text-xs font-bold rounded-xl text-center shadow-md transition-all flex items-center justify-center gap-1"
                    >
                      <span>Visit Store</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ─── 2-COL / 4-COL COMPACT SCANNING GRID ─── */
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredStores.map((store) => {
              const isFollowed = !!followedStores[store.id];

              return (
                <div
                  key={'grid-' + store.id}
                  onClick={() => setSelectedStore(store)}
                  className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between group hover:-translate-y-0.5"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-50 border border-slate-100 p-1 mb-2.5 relative flex items-center justify-center">
                      {store.avatar ? (
                        <img src={store.avatar} alt={store.name} className="w-full h-full object-contain rounded-xl" />
                      ) : (
                        <Store className="w-8 h-8 text-sky-600" />
                      )}
                      {store.verified && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-sky-600 rounded-full border-2 border-white flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                    </div>

                    <h3 className="text-xs sm:text-sm font-black text-slate-900 line-clamp-1 group-hover:text-sky-600 transition-colors">
                      {store.name}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium line-clamp-1 mt-0.5">
                      {store.category}
                    </p>

                    <div className="flex items-center gap-1 text-amber-500 font-bold text-[11px] mt-1.5">
                      <Star className="w-3 h-3 fill-amber-500" />
                      <span>{store.rating}</span>
                      <span className="text-slate-400 font-normal">({store.productsCount} items)</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleWhatsAppContact(store, e)}
                      className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                      title="WhatsApp Chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setSelectedStore(store)}
                      className="flex-1 py-1.5 px-2 bg-[#0A192F] hover:bg-sky-600 text-white text-[11px] font-bold rounded-xl text-center transition-colors"
                    >
                      Visit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            6. LIVE POPULAR PRODUCTS FROM STORES
        ══════════════════════════════════════════════════ */}
        {!loading && products.length > 0 && (
          <div className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                    Live Products from Verified Stores
                  </h2>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Real products with buyer protection directly from registered marketplace sellers
                </p>
              </div>
              <Link to="/shop" className="text-xs font-bold text-sky-600 hover:underline flex items-center gap-1">
                <span>View All Products</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {products.slice(0, 12).map((prod) => {
                const hasDiscount = Number(prod.compare_at_price) > Number(prod.price);
                const discount = hasDiscount
                  ? Math.round(((Number(prod.compare_at_price) - Number(prod.price)) / Number(prod.compare_at_price)) * 100)
                  : null;
                const inWishlist = wishlist?.some ? wishlist.some(w => w.id === prod.id) : false;

                return (
                  <div
                    key={prod.id}
                    onClick={() => navigate(`/product/${prod.id}`)}
                    className="bg-white rounded-2xl border border-slate-100 p-3.5 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 transition-all flex flex-col justify-between relative group cursor-pointer hover:-translate-y-1"
                  >
                    {/* Wishlist Heart */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleWishlist && toggleWishlist(prod); }}
                      className="absolute top-2.5 right-2.5 p-1.5 text-slate-300 hover:text-rose-500 rounded-full bg-white/90 backdrop-blur-sm z-10 transition-colors shadow-sm"
                    >
                      <Heart className={`w-3.5 h-3.5 ${inWishlist ? 'fill-rose-500 text-rose-500' : ''}`} />
                    </button>

                    {/* Discount badge if present */}
                    {discount && (
                      <span className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-rose-500 text-white font-black text-[9px] rounded-lg z-10 shadow-sm">
                        -{discount}%
                      </span>
                    )}

                    <div>
                      {/* Image */}
                      <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-50 mb-2.5 flex items-center justify-center p-2">
                        <img
                          src={getImg(prod)}
                          alt={prod.name}
                          className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>

                      <span className="text-[9px] font-black text-sky-600 uppercase tracking-wider block mb-1">
                        {prod.category || 'General'}
                      </span>
                      <h3 className="text-xs font-black text-slate-900 line-clamp-2 leading-snug">
                        {prod.name}
                      </h3>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-50 flex items-center justify-between">
                      <div>
                        <p className="text-xs sm:text-sm font-black text-slate-900">
                          ₦{Number(prod.price).toLocaleString()}
                        </p>
                        {hasDiscount && (
                          <p className="text-[10px] text-slate-400 line-through">
                            ₦{Number(prod.compare_at_price).toLocaleString()}
                          </p>
                        )}
                      </div>

                      <button
                        onClick={(e) => handleAddToCart(prod, e)}
                        className="p-2 rounded-xl bg-[#0A192F] hover:bg-sky-600 text-white transition-colors shadow-sm"
                        title="Add to Cart"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ══════════════════════════════════════════════════
          7. DEDICATED STORE DETAIL MODAL (WEB)
      ══════════════════════════════════════════════════ */}
      {selectedStore && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-hidden flex flex-col shadow-2xl border border-slate-100">
            {/* Modal Header Cover */}
            <div className="relative h-44 sm:h-52 bg-slate-900 overflow-hidden shrink-0">
              <img
                src={selectedStore.banner}
                alt={selectedStore.name}
                className="w-full h-full object-cover opacity-70"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />

              <button
                onClick={() => setSelectedStore(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/40 text-white hover:bg-black/60 flex items-center justify-center transition-all z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="absolute bottom-4 left-4 sm:left-6 right-4 flex items-end justify-between gap-3">
                <div className="flex items-end gap-3 sm:gap-4">
                  <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-white p-1 shadow-xl overflow-hidden border-2 border-white shrink-0">
                    {selectedStore.avatar ? (
                      <img src={selectedStore.avatar} alt={selectedStore.name} className="w-full h-full object-contain rounded-xl" />
                    ) : (
                      <Store className="w-full h-full text-sky-600 p-3" />
                    )}
                  </div>

                  <div className="text-white pb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg sm:text-xl font-black">{selectedStore.name}</h2>
                      {selectedStore.verified && (
                        <CheckCircle className="w-4 h-4 fill-sky-500 text-white shrink-0" />
                      )}
                      {selectedStore.isOfficial ? (
                        <span className="bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm">
                          Official Mall
                        </span>
                      ) : (selectedStore.is_recommended || selectedStore.isRecommended) ? (
                        <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm flex items-center gap-1">
                          ⭐ Recommended
                        </span>
                      ) : null}
                    </div>
                    <p className="text-xs text-sky-300 font-semibold">{selectedStore.category}</p>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-2 pb-1">
                  <button
                    onClick={() => toggleFollow(selectedStore.id, selectedStore.name)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                      followedStores[selectedStore.id]
                        ? 'bg-sky-100 text-sky-700 border-sky-300'
                        : 'bg-white/90 text-slate-800 border-white hover:bg-white'
                    }`}
                  >
                    {followedStores[selectedStore.id] ? 'Following' : '+ Follow'}
                  </button>

                  <button
                    onClick={(e) => handleWhatsAppContact(selectedStore, e)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Subheader & Mobile Quick Actions */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4 bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-4 sm:gap-6 text-xs font-bold text-slate-700">
                <div>
                  <span className="text-slate-400 font-normal block text-[10px]">Rating</span>
                  <span className="text-amber-500 font-black">★ {selectedStore.rating}</span> ({selectedStore.reviews})
                </div>
                <div>
                  <span className="text-slate-400 font-normal block text-[10px]">Followers</span>
                  <span>{(selectedStore.baseFollowers || 100) + (followedStores[selectedStore.id] ? 1 : 0)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-normal block text-[10px]">Catalog Items</span>
                  <span>{selectedStore.productsCount}</span>
                </div>
              </div>

              {/* Mobile Action Buttons */}
              <div className="flex sm:hidden items-center gap-2 w-full pt-1">
                <button
                  onClick={() => toggleFollow(selectedStore.id, selectedStore.name)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border text-center transition-all ${
                    followedStores[selectedStore.id]
                      ? 'bg-sky-100 text-sky-700 border-sky-300'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {followedStores[selectedStore.id] ? 'Following' : '+ Follow'}
                </button>

                <button
                  onClick={(e) => handleWhatsAppContact(selectedStore, e)}
                  className="flex-1 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>
            </div>

            {/* Modal Catalog Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* About store */}
              <div className="bg-sky-50/60 p-3.5 sm:p-4 rounded-2xl border border-sky-100 text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-sky-900 block mb-1">About Store</span>
                {selectedStore.bio}
              </div>

              {/* Store Products Search & Category Filter */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                  Store Products ({modalFilteredProducts.length})
                </h3>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={`Search in ${selectedStore.name}...`}
                    value={storeSearch}
                    onChange={e => setStoreSearch(e.target.value)}
                    className="bg-slate-100 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 w-full focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                  />
                  {storeSearch && (
                    <button onClick={() => setStoreSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Category Pills if more than 1 category */}
              {modalCategories.length > 2 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {modalCategories.map(cat => (
                    <button
                      key={'modal-cat-' + cat}
                      onClick={() => setStoreCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold shrink-0 transition-all ${
                        storeCategoryFilter === cat
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat === 'all' ? 'All Items' : cat}
                    </button>
                  ))}
                </div>
              )}

              {/* Product Grid inside Modal */}
              {modalFilteredProducts.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Store className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs font-bold">No products match this filter in {selectedStore.name}.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
                  {modalFilteredProducts.map(prod => (
                    <div
                      key={prod.id}
                      onClick={() => { setSelectedStore(null); navigate(`/product/${prod.id}`); }}
                      className="bg-white border border-slate-100 rounded-2xl p-3 hover:shadow-lg transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="w-full aspect-square rounded-xl bg-slate-50 overflow-hidden mb-2 p-2">
                        <img src={getImg(prod)} alt={prod.name} className="w-full h-full object-contain" />
                      </div>
                      <h4 className="text-xs font-black text-slate-900 line-clamp-1">{prod.name}</h4>
                      <div className="mt-2 pt-2 border-t border-slate-50 flex items-center justify-between">
                        <span className="text-xs font-black text-sky-600">₦{Number(prod.price).toLocaleString()}</span>
                        <button
                          onClick={(e) => handleAddToCart(prod, e)}
                          className="p-1.5 bg-[#0A192F] hover:bg-sky-600 text-white rounded-lg transition-colors"
                          title="Add to Cart"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] bg-[#0A192F] text-white text-xs font-bold px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};

export default Stores;
