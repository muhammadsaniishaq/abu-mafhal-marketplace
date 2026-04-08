import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import Navbar from '../components/common/Navbar';
import {
  Search, X, Filter, ShoppingCart, Heart, Mic, Camera,
  ChevronDown, SlidersHorizontal, Package, ArrowRight,
  Star, Zap, Check, Grid3X3, List, Plus, Eye, AlertCircle
} from 'lucide-react';

/* ══════════════════ HELPERS ══════════════════ */
const getImg = (product) => {
  const img = product.image_url || product.thumbnail;
  if (img) return img;
  const imgs = product.images;
  if (!imgs) return null;
  if (typeof imgs === 'string') {
    try { const p = JSON.parse(imgs); return Array.isArray(p) ? p[0] : p; } catch { return imgs; }
  }
  if (Array.isArray(imgs) && imgs.length > 0) return imgs[0];
  return null;
};
const FALLBACK = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=400&auto=format&fit=crop';

/* ══════════════════ TOAST ══════════════════ */
const Toast = ({ msg, icon }) => (
  <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-3 bg-slate-900 text-white font-bold text-sm px-7 py-4 rounded-2xl shadow-2xl">
    <span className="text-lg">{icon}</span><span>{msg}</span>
  </div>
);

/* ══════════════════ BANNER CAROUSEL ══════════════════ */
const DEFAULT_BANNERS = [
  { id: 1, image_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=900&auto=format&fit=crop' },
  { id: 2, image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=900&auto=format&fit=crop' },
  { id: 3, image_url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=900&auto=format&fit=crop' },
];
const BannerCarousel = ({ banners }) => {
  const data = banners.length > 0 ? banners : DEFAULT_BANNERS;
  const [idx, setIdx] = useState(0);
  
  useEffect(() => {
    const t = setInterval(() => setIdx(p => (p + 1) % data.length), 5000);
    return () => clearInterval(t);
  }, [data.length]);

  return (
    <div className="relative rounded-[2rem] overflow-hidden shadow-2xl group/banner" style={{ height: 320 }}>
      <style>{`
        @keyframes kenburns {
          0% { transform: scale(1); }
          100% { transform: scale(1.15); }
        }
        .animate-kenburns { animation: kenburns 10s ease-in-out infinite alternate; }
      `}</style>
      
      {data.map((b, i) => (
        <div key={b.id || i} className={`absolute inset-0 transition-all duration-1000 ease-in-out ${i === idx ? 'opacity-100 scale-100' : 'opacity-0 scale-105 pointer-events-none'}`}>
          <img src={b.image_url} alt="" className={`w-full h-full object-cover transition-transform duration-[10000ms] ${i === idx ? 'animate-kenburns' : ''}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {(b.title || b.label) && (
            <div className="absolute bottom-10 left-10 max-w-lg space-y-3">
              <div className="inline-block px-4 py-1.5 bg-blue-600/90 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-blue-500/30">
                {b.subtitle || 'Exclusive Offer'}
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white leading-[1.1] drop-shadow-2xl">
                {b.title || b.label}
              </h2>
              <div className="flex gap-4 items-center">
                <button className="px-8 py-3.5 bg-white text-slate-900 font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-blue-600 hover:text-white transition-all shadow-xl hover:-translate-y-1">
                  Shop Now
                </button>
                <div className="bg-white/10 backdrop-blur-md border border-white/20 p-3 rounded-2xl text-white/90 text-xs font-bold">
                  Limited Time
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Modern Indicators */}
      <div className="absolute bottom-8 right-10 flex gap-3">
        {data.map((_, i) => (
          <button key={i} onClick={() => setIdx(i)} 
            className={`h-1 rounded-full transition-all duration-500 ${i === idx ? 'bg-white w-12 shadow-lg shadow-white/50' : 'bg-white/30 w-3 hover:bg-white/50'}`} />
        ))}
      </div>
    </div>
  );
};

/* ══════════════════ PRODUCT CARD — Mobile style ══════════════════ */
const ProductCard = ({ product, inWishlist, onWishlist, onAddToCart, view }) => {
  const navigate = useNavigate();
  const img = getImg(product) || FALLBACK;
  const price = Number(product.price) || 0;
  const originalPrice = product.discount > 0 ? Math.round(price / (1 - product.discount / 100)) : null;
  const rating = Number(product.rating) || 0;
  const reviews = Number(product.reviews) || 0;

  const go = () => navigate(`/product/${product.id}`);

  // ─── LIST VIEW ───
  if (view === 'list') {
    return (
      <div onClick={go} className="group flex bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:shadow-slate-200/60 transition-all cursor-pointer hover:-translate-y-0.5">
        {/* Image */}
        <div className="relative w-[120px] h-[120px] flex-shrink-0 bg-slate-50 overflow-hidden">
          <img src={img} alt={product.name} onError={e => e.target.src = FALLBACK}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          {product.discount > 0 && (
            <span className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow">-{product.discount}%</span>
          )}
          {product.is_new && !product.discount && (
            <span className="absolute top-2 left-2 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md shadow">NEW</span>
          )}
        </div>
        {/* Info */}
        <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
          <div>
            {product.category && <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-0.5">{product.category}</p>}
            <h3 className="font-black text-slate-900 text-sm line-clamp-2 leading-tight">{product.name || 'Product'}</h3>
            {rating > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {[...Array(5)].map((_, i) => <Star key={i} className={`w-3 h-3 ${i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`} />)}
                {reviews > 0 && <span className="text-[9px] text-slate-400 font-medium ml-1">({reviews})</span>}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <span className="font-black text-slate-900 text-base">₦{price.toLocaleString()}</span>
              {originalPrice && <span className="text-xs text-slate-400 line-through">₦{originalPrice.toLocaleString()}</span>}
            </div>
            <div className="flex gap-2">
              <button onClick={e => { e.stopPropagation(); onWishlist(product); }}
                className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all ${inWishlist ? 'bg-red-50 border-red-200 text-red-500' : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500'}`}>
                <Heart className={`w-4 h-4 ${inWishlist ? 'fill-red-500' : ''}`} />
              </button>
              <button onClick={e => { e.stopPropagation(); onAddToCart(product); }}
                className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center hover:bg-blue-600 transition-all shadow-sm">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── GRID VIEW (mobile card style) ───
  return (
    <div onClick={go} className="group bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-slate-200/70 transition-all cursor-pointer hover:-translate-y-1">
      {/* Image box — same as mobile shopImgBox */}
      <div className="relative overflow-hidden bg-slate-50" style={{ height: 180 }}>
        <img src={img} alt={product.name} onError={e => e.target.src = FALLBACK}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />

        {/* Discount / New badge — top left */}
        {product.discount > 0 ? (
          <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-md">-{product.discount}%</span>
        ) : product.is_new ? (
          <span className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-md">NEW</span>
        ) : null}

        {/* Wishlist — top right */}
        <button
          onClick={e => { e.stopPropagation(); onWishlist(product); }}
          className={`absolute top-2 right-2 w-8 h-8 rounded-xl border flex items-center justify-center transition-all shadow-sm ${inWishlist ? 'bg-red-50 border-red-200 text-red-500' : 'bg-white/90 border-white text-slate-400 hover:bg-red-50 hover:border-red-200 hover:text-red-500'}`}
        >
          <Heart className={`w-4 h-4 ${inWishlist ? 'fill-red-500' : ''}`} />
        </button>

        {/* Quick view on hover */}
        <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 backdrop-blur-sm p-2 translate-y-full group-hover:translate-y-0 transition-transform duration-300 flex items-center justify-center gap-3">
          <span className="text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
            <Eye className="w-3 h-3" /> Quick View
          </span>
        </div>
      </div>

      {/* Details — same as mobile shopDetails */}
      <div className="p-3 space-y-1">
        {product.category && (
          <p className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{product.category}</p>
        )}
        <h3 className="font-black text-slate-900 text-xs leading-tight line-clamp-2">{product.name || 'Product'}</h3>

        {/* Stars */}
        {rating > 0 && (
          <div className="flex items-center gap-0.5">
            {[...Array(5)].map((_, i) => <Star key={i} className={`w-2.5 h-2.5 ${i < Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 fill-slate-200'}`} />)}
            {reviews > 0 && <span className="text-[9px] text-slate-400 ml-1">({reviews})</span>}
          </div>
        )}

        {/* Price row */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col">
            <span className="font-black text-slate-900 text-sm">₦{price.toLocaleString()}</span>
            {originalPrice && (
              <span className="text-[9px] text-slate-400 line-through leading-none">₦{originalPrice.toLocaleString()}</span>
            )}
          </div>
          {/* Add to cart button — same as mobile addCartBtn */}
          <button
            onClick={e => { e.stopPropagation(); onAddToCart(product); }}
            className="w-8 h-8 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-all shadow-md hover:shadow-blue-600/30 hover:scale-110 flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════ CATEGORIES & SORT ══════════════════ */
const SORT_OPTIONS = [
  { val: 'default', label: 'Default' },
  { val: 'priceLow', label: 'Price ↑' },
  { val: 'priceHigh', label: 'Price ↓' },
  { val: 'reviews', label: 'Most Reviews' },
  { val: 'newest', label: 'Newest' },
];

/* ══════════════════ MAIN COMPONENT ══════════════════ */
const Shop = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { wishlistItems, addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(['All', 'Phones', 'Fashion', 'Shoes', 'Gaming', 'Home', 'Beauty', 'Electronics']);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [banners, setBanners] = useState([]);
  const [promoBanners, setPromoBanners] = useState([]);
  const [promoIdx, setPromoIdx] = useState(0);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('default');
  const [showSort, setShowSort] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState(10000000); // 10M default
  const [absMaxPrice, setAbsMaxPrice] = useState(10000000);
  const [view, setView] = useState('grid');
  const [isRecording, setIsRecording] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { applyFilters(); }, [products, searchQuery, activeCategory, sortBy, maxPrice]);

  useEffect(() => {
    if (promoBanners.length < 2) return;
    const t = setInterval(() => setPromoIdx(p => (p + 1) % promoBanners.length), 4000);
    return () => clearInterval(t);
  }, [promoBanners.length]);

  const showToast = (msg, icon = '✅') => {
    setToast({ msg, icon });
    setTimeout(() => setToast(null), 2500);
  };

  const fetchData = async () => {
    setFetchError(null);
    try {
      // ── Banners (silent fail) ──
      try {
        const { data: bAll } = await supabase.from('banners').select('*').eq('is_active', true).order('display_order');
        if (bAll) {
          setBanners(bAll.filter(b => b.section === 'shop' || !b.section || b.section === 'all' || b.section === ''));
          const promos = bAll.filter(b => b.section === 'promo').map(p => {
            let linkData = {};
            try { linkData = JSON.parse(p.action_link || '{}'); } catch { }
            return { ...p, linkData };
          }).filter(p => !p.linkData?.timerEnd || new Date() <= new Date(p.linkData.timerEnd));
          setPromoBanners(promos);
        }
      } catch (err) { /* silent banners skip */ }

      // ── Products ──
      const { data: allProds, error: allErr } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'approved')
        .order('created_at', { ascending: false })
        .limit(2000); 

      if (allErr) {
        setFetchError(`DB Error: ${allErr.message}`);
        return;
      }

      const raw = allProds || [];
      console.log('[Shop] Products fetched count:', raw.length);

      // Extract unique categories dynamically
      const uniqueCats = ['All', ...new Set(raw.map(p => p.category).filter(Boolean))];
      setCategories(uniqueCats);

      // Dynamic max price
      if (raw.length > 0) {
        const highest = Math.max(...raw.map(p => Number(p.price) || 0));
        const newMax = Math.max(highest, 1000000);
        setAbsMaxPrice(newMax);
        setMaxPrice(newMax);
      }

      const enriched = raw.map(p => ({
        ...p,
        rating: Number(p.rating) || 0,
        reviews: Number(p.reviews) || 0,
      }));
      setProducts(enriched);
    } catch (e) {
      console.error('[Shop] Critical fetch error:', e);
      setFetchError(e.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let res = [...products];
    if (activeCategory !== 'All') {
      const q = activeCategory.toLowerCase();
      res = res.filter(p => (p.category || '').toLowerCase() === q);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      res = res.filter(p => 
        (p.name || '').toLowerCase().includes(q) || 
        (p.description || '').toLowerCase().includes(q) || 
        (p.category || '').toLowerCase().includes(q)
      );
    }
    res = res.filter(p => Number(p.price || 0) <= maxPrice);
    if (sortBy === 'priceLow') res.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    else if (sortBy === 'priceHigh') res.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    else if (sortBy === 'reviews') res.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
    else if (sortBy === 'newest') res.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    
    setFiltered(res);
  };

  const handleWishlist = (product) => {
    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
      showToast('Removed from Wishlist', '💔');
    } else {
      addToWishlist(product);
      showToast('Added to Wishlist ❤️', '❤️');
    }
  };

  const handleAddToCart = (product) => {
    addToCart(product);
    showToast(`${(product.name || '').substring(0, 25)} added to Cart`, '🛒');
  };

  const handleVoiceSearch = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Voice search not supported in this browser', '⚠️'); return; }
    const r = new SR();
    r.lang = 'en-US';
    r.onstart = () => setIsRecording(true);
    r.onend = () => setIsRecording(false);
    r.onresult = e => { const t = e.results[0][0].transcript; setSearchQuery(t); showToast(`Heard: "${t}"`, '🎙️'); };
    r.onerror = () => { setIsRecording(false); showToast('Could not understand audio', '⚠️'); };
    r.start();
  };

  const resetFilters = () => { setSearchQuery(''); setActiveCategory('All'); setSortBy('default'); setMaxPrice(1000000); };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      {/* ── STICKY HEADER ── */}
      <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 pt-3 pb-2">
          {/* Search row */}
          <div className="flex items-center gap-2">
            {/* Search input */}
            <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-blue-500 focus-within:shadow-lg focus-within:shadow-blue-500/10 transition-all">
              <Search className="w-4 h-4 text-slate-400 ml-4 flex-shrink-0" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Escape' && setSearchQuery('')}
                placeholder="Search products..."
                className="flex-1 px-3 py-2.5 bg-transparent text-slate-900 placeholder-slate-400 font-semibold text-sm outline-none"
              />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="mr-2 text-slate-400 hover:text-slate-700 transition-colors"><X className="w-4 h-4" /></button>}
              <div className="flex items-center gap-1.5 border-l border-slate-200 px-3">
                <button onClick={handleVoiceSearch} title="Voice Search" className={`transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-blue-500 hover:text-blue-700'}`}>
                  <Mic className="w-4 h-4" />
                </button>
                <button onClick={() => fileInputRef.current?.click()} title="Image Search" className="text-blue-500 hover:text-blue-700 transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={() => showToast('AI Image Search coming soon!', '🤖')} className="hidden" />
              </div>
              {/* Sort inside search bar */}
              <div className="border-l border-slate-200 px-3">
                <button onClick={() => setShowSort(s => !s)} className={`flex items-center gap-1 text-xs font-black uppercase tracking-wider transition-colors ${sortBy !== 'default' ? 'text-blue-600' : 'text-slate-400 hover:text-slate-700'}`}>
                  <Filter className="w-4 h-4" />
                  <ChevronDown className={`w-3 h-3 transition-transform ${showSort ? 'rotate-180' : ''}`} />
                </button>
              </div>
            </div>

            {/* View & Filter buttons */}
            <div className="flex items-center gap-1.5 border border-slate-200 rounded-xl overflow-hidden bg-white">
              <button onClick={() => setView('grid')} className={`p-2.5 transition-all ${view === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><Grid3X3 className="w-4 h-4" /></button>
              <button onClick={() => setView('list')} className={`p-2.5 transition-all ${view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}><List className="w-4 h-4" /></button>
            </div>
            <button onClick={() => setShowFilters(true)} className="flex items-center gap-2 border border-slate-200 bg-white rounded-xl px-3 py-2.5 text-slate-500 hover:border-blue-500 hover:text-blue-600 transition-all">
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-black uppercase tracking-widest">Filter</span>
            </button>
          </div>

          {/* Sort Dropdown */}
          {showSort && (
            <div className="mt-2 flex flex-wrap gap-2">
              {SORT_OPTIONS.map(opt => (
                <button key={opt.val} onClick={() => { setSortBy(opt.val); setShowSort(false); }}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all border ${sortBy === opt.val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                  {sortBy === opt.val && <Check className="w-3 h-3" />}
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-2 overflow-x-auto pb-1">
            <div className="flex gap-2 min-w-max">
              {categories.map(cat => (
                <button key={cat} onClick={() => setActiveCategory(cat)}
                  className={`px-4 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all border ${activeCategory === cat ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── FILTER SIDEBAR ── */}
      {showFilters && (
        <>
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setShowFilters(false)} />
          <div className="fixed right-0 top-0 bottom-0 w-80 bg-white z-50 shadow-2xl overflow-y-auto flex flex-col">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-base font-black text-slate-900 tracking-tighter">Filters</h3>
              <button onClick={() => setShowFilters(false)} className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-slate-50"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 p-5 space-y-7 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Category</label>
                <div className="flex flex-wrap gap-2">
                  {categories.map(cat => <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition-all ${activeCategory === cat ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'}`}>{cat}</button>)}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Max Price: <span className="text-slate-900 normal-case">₦{maxPrice.toLocaleString()}</span></label>
                <input type="range" min="0" max={absMaxPrice} step={absMaxPrice / 100} value={maxPrice} onChange={e => setMaxPrice(+e.target.value)} className="w-full accent-blue-600" />
                <div className="flex justify-between text-xs font-bold text-slate-400 mt-1"><span>₦0</span><span>₦{absMaxPrice.toLocaleString()}</span></div>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Sort By</label>
                <div className="space-y-2">
                  {SORT_OPTIONS.map(opt => (
                    <button key={opt.val} onClick={() => setSortBy(opt.val)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-left transition-all border ${sortBy === opt.val ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-100 hover:bg-slate-100'}`}>
                      {sortBy === opt.val ? <Check className="w-4 h-4 flex-shrink-0" /> : <div className="w-4" />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-5 flex gap-3 border-t border-slate-100">
              <button onClick={resetFilters} className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-black text-sm hover:bg-slate-200 transition-all">Reset</button>
              <button onClick={() => setShowFilters(false)} className="flex-1 py-3 rounded-xl bg-slate-900 text-white font-black text-sm hover:bg-blue-600 transition-all">Apply</button>
            </div>
          </div>
        </>
      )}

      {/* ── MAIN CONTENT ── */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* Banners */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3">
            <BannerCarousel banners={banners} />
          </div>
          <div className="lg:col-span-2 space-y-4">
            {promoBanners.length > 0 ? (
              <div className="relative overflow-hidden rounded-[2rem] shadow-2xl group/promo" style={{ height: 320 }}>
                <div className="flex transition-transform duration-700 ease-out h-full" style={{ transform: `translateX(-${promoIdx * 100}%)` }}>
                  {promoBanners.map((promo, i) => (
                    <div key={promo.id || i} className="relative min-w-full h-full bg-slate-900 cursor-pointer overflow-hidden" onClick={() => navigate('/shop')}>
                      <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover opacity-60 group-hover/promo:scale-110 transition-transform duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/40 to-transparent" />
                      <div className="absolute inset-0 flex flex-col justify-end p-8 space-y-2">
                        <div className="p-4 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl space-y-1">
                          {promo.subtitle && <span className="inline-block bg-amber-400 text-slate-900 text-[9px] font-black uppercase px-2.5 py-1 rounded-full shadow-lg">{promo.subtitle}</span>}
                          <h3 className="text-xl font-black text-white leading-tight tracking-tight">{promo.title}</h3>
                          <div className="flex items-center gap-2 group/btn">
                             <div className="text-white font-bold text-xs">Claim Deal</div>
                             <ArrowRight className="w-4 h-4 text-amber-400 group-hover/btn:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {promoBanners.length > 1 && (
                  <div className="absolute top-6 right-8 flex gap-2">
                    {promoBanners.map((_, i) => <button key={i} onClick={() => setPromoIdx(i)} className={`h-1.5 rounded-full transition-all duration-300 ${i === promoIdx ? 'bg-white w-8' : 'bg-white/40 w-1.5'}`} />)}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full bg-slate-900 rounded-[2rem] flex items-center p-10 relative overflow-hidden shadow-2xl border border-white/5" style={{ minHeight: 320 }}>
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-blue-600 to-indigo-700 opacity-90" />
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl" />
                
                <div className="relative z-10 space-y-4">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-lg border border-white/30 rounded-full">
                    <Zap className="w-4 h-4 text-amber-400 fill-amber-400 animate-bounce" />
                    <span className="text-[10px] font-black text-white uppercase tracking-[0.1em]">Elite Access</span>
                  </div>
                  <h3 className="text-3xl font-black text-white tracking-tight leading-[1.1]">Exclusive<br />Vendor Pricing</h3>
                  <p className="text-white/80 text-sm font-medium leading-relaxed max-w-[200px]">Unlock lower prices on premium gadgets.</p>
                  <Link to="/shop" className="inline-flex items-center gap-3 bg-white text-slate-900 font-black text-[11px] uppercase tracking-widest px-7 py-3.5 rounded-2xl hover:bg-amber-400 transition-all shadow-xl hover:-translate-y-1 group">
                    Explore <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm font-black text-slate-900">{filtered.length} Products</p>
            {(searchQuery || activeCategory !== 'All' || sortBy !== 'default' || maxPrice < 1000000) && (
              <button onClick={resetFilters} className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-50 text-red-500 text-xs font-black border border-red-100 hover:bg-red-100 transition-all">
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>
          {sortBy !== 'default' && <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{SORT_OPTIONS.find(s => s.val === sortBy)?.label}</span>}
        </div>

        {/* Product grid */}
        {loading ? (
          <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4' : 'space-y-3'}>
            {[...Array(10)].map((_, i) => (
              <div key={i} className={`bg-white border border-slate-100 rounded-2xl animate-pulse ${view === 'grid' ? 'h-64' : 'h-28'}`} />
            ))}
          </div>
        ) : fetchError ? (
          <div className="text-center py-24 space-y-4">
            <div className="w-20 h-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <h3 className="text-xl font-black text-slate-900">Could not load products</h3>
            <p className="text-slate-400 font-medium text-sm">{fetchError}</p>
            <button onClick={fetchData} className="mt-2 px-6 py-3 bg-slate-900 text-white font-black text-sm rounded-xl hover:bg-blue-600 transition-all shadow-lg">Try Again</button>
          </div>
        ) : filtered.length === 0 && products.length > 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-900">No products match</h3>
            <p className="text-slate-400 font-medium text-sm">Try adjusting your filters or search.</p>
            <button onClick={resetFilters} className="mt-2 px-6 py-3 bg-slate-900 text-white font-black text-sm rounded-xl hover:bg-blue-600 transition-all shadow-lg">Clear all filters</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto">
              <Package className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-900">No products found</h3>
            <p className="text-slate-400 font-medium text-sm">Try adjusting your filters or search for something else.</p>
            <button onClick={resetFilters} className="mt-2 px-6 py-3 bg-slate-900 text-white font-black text-sm rounded-xl hover:bg-blue-600 transition-all shadow-lg">Clear all filters</button>
          </div>
        ) : (
          <div className={view === 'grid'
            ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4'
            : 'space-y-3'
          }>
            {filtered.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                inWishlist={isInWishlist(product.id)}
                onWishlist={handleWishlist}
                onAddToCart={handleAddToCart}
                view={view}
              />
            ))}
          </div>
        )}
      </div>

      {/* Voice overlay */}
      {isRecording && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-3xl p-10 text-center shadow-2xl space-y-4">
            <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto animate-pulse shadow-xl shadow-red-500/40">
              <Mic className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-xl font-black text-slate-900">Listening...</h3>
            <p className="text-slate-400 font-medium text-sm">Say a product name or category</p>
          </div>
        </div>
      )}

      {toast && <Toast msg={toast.msg} icon={toast.icon} />}
    </div>
  );
};

export default Shop;