import React, { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import { supabase } from '../config/supabase';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useComparison } from '../context/ComparisonContext';
import {
  Search, SlidersHorizontal, Grid3X3, List, Heart, ShoppingCart,
  Star, ShieldCheck, MapPin, X, Check, ArrowRight, Zap, RefreshCw,
  Scale, Eye, AlertCircle, ChevronDown, Package
} from 'lucide-react';

const CATEGORIES = [
  'All Items',
  'Phones & Tablets',
  'Electronics & Audio',
  'Computing & Laptops',
  'Fashion & Apparel',
  'Beauty & Personal Care',
  'Home & Kitchen',
  'Groceries & Provisions',
  'Automobiles & Spares'
];

const PRICE_PRESETS = [
  { label: 'All Prices', min: 0, max: Infinity },
  { label: 'Under ₦50,000', min: 0, max: 50000 },
  { label: '₦50k – ₦250k', min: 50000, max: 250000 },
  { label: '₦250k – ₦1,000,000', min: 250000, max: 1000000 },
  { label: 'Over ₦1,000,000', min: 1000000, max: Infinity }
];

const FALLBACK_PRODUCTS = [
  {
    id: 'sh-1',
    name: 'Apple iPhone 15 Pro Max 256GB Natural Titanium',
    price: 1250000,
    compare_at_price: 1450000,
    category: 'Phones & Tablets',
    rating: 4.9,
    reviews_count: 94,
    seller_name: 'Apex Digital Store',
    seller_state: 'Lagos',
    is_verified: true,
    in_stock: true,
    image_url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500&auto=format&fit=crop'
  },
  {
    id: 'sh-2',
    name: 'Sony WH-1000XM5 Premium Noise Cancelling Headphones',
    price: 360000,
    compare_at_price: 420000,
    category: 'Electronics & Audio',
    rating: 4.8,
    reviews_count: 62,
    seller_name: 'SoundWave Electronics',
    seller_state: 'Abuja',
    is_verified: true,
    in_stock: true,
    image_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500&auto=format&fit=crop'
  },
  {
    id: 'sh-3',
    name: 'MacBook Air 15-inch M2 8-Core 512GB SSD Space Gray',
    price: 1380000,
    compare_at_price: 1550000,
    category: 'Computing & Laptops',
    rating: 5.0,
    reviews_count: 48,
    seller_name: 'Pro Tech Kano',
    seller_state: 'Kano',
    is_verified: true,
    in_stock: true,
    image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop'
  },
  {
    id: 'sh-4',
    name: 'Nike Air Jordan 1 Retro High Chicago Edition',
    price: 95000,
    compare_at_price: 120000,
    category: 'Fashion & Apparel',
    rating: 4.7,
    reviews_count: 110,
    seller_name: 'Kano Sneaker Vault',
    seller_state: 'Kano',
    is_verified: true,
    in_stock: true,
    image_url: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=500&auto=format&fit=crop'
  },
  {
    id: 'sh-5',
    name: 'Samsung Galaxy S24 Ultra 512GB Titanium Black',
    price: 1420000,
    compare_at_price: 1600000,
    category: 'Phones & Tablets',
    rating: 4.9,
    reviews_count: 53,
    seller_name: 'Mobile Hub Abuja',
    seller_state: 'Abuja',
    is_verified: true,
    in_stock: true,
    image_url: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=500&auto=format&fit=crop'
  },
  {
    id: 'sh-6',
    name: 'Apple Watch Ultra 2 GPS + Cellular 49mm Titanium',
    price: 890000,
    compare_at_price: 980000,
    category: 'Electronics & Audio',
    rating: 4.9,
    reviews_count: 36,
    seller_name: 'Apex Digital Store',
    seller_state: 'Lagos',
    is_verified: true,
    in_stock: true,
    image_url: 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=500&auto=format&fit=crop'
  }
];

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToCart } = useCart();
  const { wishlistItems, addToWishlist, removeFromWishlist } = useWishlist();
  const { comparisonItems, addToComparison } = useComparison ? useComparison() : { comparisonItems: [], addToComparison: () => {} };

  // Filter States
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || 'All Items');
  const [selectedPricePreset, setSelectedPricePreset] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(true);
  const [sortBy, setSortBy] = useState('featured'); // 'featured', 'low-high', 'high-low', 'rating', 'newest'
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'

  // Data State
  const [products, setProducts] = useState(FALLBACK_PRODUCTS);
  const [loading, setLoading] = useState(true);
  const [quickViewProduct, setQuickViewProduct] = useState(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  useEffect(() => {
    const qSearch = searchParams.get('search');
    const qCat = searchParams.get('category');
    if (qSearch) setSearchQuery(qSearch);
    if (qCat && qCat !== 'All Categories') setSelectedCategory(qCat);
  }, [searchParams]);

  // Fetch live products from Supabase
  useEffect(() => {
    async function loadCatalog() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*, profiles:vendor_id(business_name, full_name, is_verified, state)')
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          const mapped = data.map(p => ({
            ...p,
            seller_name: p.profiles?.business_name || p.profiles?.full_name || 'Verified Merchant',
            seller_state: p.profiles?.state || 'Nigeria',
            is_verified: p.profiles?.is_verified !== false,
            in_stock: p.stock_quantity !== 0,
            image_url: p.image_url || (Array.isArray(p.images) ? p.images[0] : null) || FALLBACK_PRODUCTS[0].image_url
          }));
          setProducts(mapped);
        }
      } catch (_) {}
      finally {
        setLoading(false);
      }
    }
    loadCatalog();
  }, []);

  const isWishlisted = (id) => (wishlistItems || []).some(w => w.id === id);

  const toggleWishlistHandler = (p) => {
    if (isWishlisted(p.id)) {
      removeFromWishlist(p.id);
      showToast('Removed from wishlist');
    } else {
      addToWishlist(p);
      showToast('Added to wishlist');
    }
  };

  // Filtered and Sorted Products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.seller_name?.toLowerCase().includes(q)
      );
    }

    // Category
    if (selectedCategory !== 'All Items' && selectedCategory !== 'All Categories') {
      result = result.filter(p => p.category?.toLowerCase().includes(selectedCategory.toLowerCase()));
    }

    // Price preset
    const preset = PRICE_PRESETS[selectedPricePreset];
    if (preset) {
      result = result.filter(p => {
        const val = Number(p.price) || 0;
        return val >= preset.min && val <= preset.max;
      });
    }

    // Verified only
    if (verifiedOnly) {
      result = result.filter(p => p.is_verified);
    }

    // In-stock only
    if (inStockOnly) {
      result = result.filter(p => p.in_stock !== false);
    }

    // Sorting
    if (sortBy === 'low-high') {
      result.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    } else if (sortBy === 'high-low') {
      result.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    } else if (sortBy === 'rating') {
      result.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    return result;
  }, [products, searchQuery, selectedCategory, selectedPricePreset, verifiedOnly, inStockOnly, sortBy]);

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedCategory('All Items');
    setSelectedPricePreset(0);
    setVerifiedOnly(false);
    setInStockOnly(false);
    setSortBy('featured');
    setSearchParams({});
  };

  const hasActiveFilters = searchQuery || (selectedCategory !== 'All Items' && selectedCategory !== 'All Categories') || selectedPricePreset !== 0 || verifiedOnly || !inStockOnly;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <Navbar />

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-16 sm:bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-[#0A192F] text-white text-xs font-bold shadow-2xl flex items-center gap-2">
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl">
            <button
              onClick={() => setQuickViewProduct(null)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
              <div className="rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 aspect-square">
                <img src={quickViewProduct.image_url} alt="" className="w-full h-full object-cover" />
              </div>
              <div className="space-y-3">
                <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                  {quickViewProduct.category || 'General'}
                </span>
                <h3 className="text-lg font-extrabold text-[#0A192F]">{quickViewProduct.name}</h3>
                <div className="flex items-center gap-2 text-xs text-amber-500 font-bold">
                  <Star className="w-4 h-4 fill-current" />
                  <span>{quickViewProduct.rating || 4.9}</span>
                  <span className="text-slate-400 font-normal">({quickViewProduct.reviews_count || 12} reviews)</span>
                </div>
                <div className="pt-2">
                  <p className="text-2xl font-black text-[#00BFA5]">₦{Number(quickViewProduct.price).toLocaleString()}</p>
                </div>
                <div className="pt-3 flex gap-2">
                  <button
                    onClick={() => {
                      addToCart(quickViewProduct, 1);
                      showToast('Added to cart!');
                      setQuickViewProduct(null);
                    }}
                    className="flex-1 py-3 rounded-xl bg-[#00BFA5] hover:bg-[#00a896] text-white text-xs font-bold transition-all shadow-md"
                  >
                    Add to Cart
                  </button>
                  <Link
                    to={`/product/${quickViewProduct.id}`}
                    className="px-4 py-3 rounded-xl bg-[#0A192F] text-white text-xs font-bold"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Container */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 py-8 w-full space-y-6">
        {/* Breadcrumb + Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Link to="/" className="hover:text-[#00BFA5]">Home</Link>
              <span>/</span>
              <span className="text-[#0A192F] font-bold">Shop Catalog</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#0A192F] tracking-tight">
              Marketplace Catalog
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* View Switch */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-slate-600">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'grid' ? 'bg-white text-[#0A192F] shadow-xs' : ''}`}
                title="Grid View"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${viewMode === 'list' ? 'bg-white text-[#0A192F] shadow-xs' : ''}`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile Filter Toggle */}
            <button
              onClick={() => setMobileFilterOpen(!mobileFilterOpen)}
              className="lg:hidden px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-2"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filters</span>
            </button>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl px-3 py-2 outline-none cursor-pointer"
            >
              <option value="featured">Featured First</option>
              <option value="low-high">Price: Low to High</option>
              <option value="high-low">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
              <option value="newest">Newest Arrivals</option>
            </select>
          </div>
        </div>

        {/* Content Layout: Sidebar + Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Filter Sidebar */}
          <aside className={`lg:block ${mobileFilterOpen ? 'block' : 'hidden'} bg-white rounded-3xl border border-slate-200 p-6 space-y-6 shadow-xs`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#00BFA5]" />
                <h3 className="font-extrabold text-sm text-[#0A192F]">Filters</h3>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-rose-600 hover:underline font-bold cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Category Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-[#0A192F] uppercase tracking-wider block">Departments</label>
              <div className="space-y-1">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-[#00BFA5]/10 text-[#00BFA5]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{cat}</span>
                    {selectedCategory === cat && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Presets */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-[#0A192F] uppercase tracking-wider block">Price Range</label>
              <div className="space-y-1">
                {PRICE_PRESETS.map((preset, idx) => (
                  <button
                    key={preset.label}
                    onClick={() => setSelectedPricePreset(idx)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                      selectedPricePreset === idx
                        ? 'bg-[#00BFA5]/10 text-[#00BFA5]'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span>{preset.label}</span>
                    {selectedPricePreset === idx && <Check className="w-3.5 h-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <label className="text-xs font-bold text-[#0A192F] uppercase tracking-wider block">Preferences</label>

              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="rounded border-slate-300 text-[#00BFA5] focus:ring-[#00BFA5] w-4 h-4 cursor-pointer"
                />
                <ShieldCheck className="w-3.5 h-3.5 text-[#00BFA5]" />
                <span>Verified CAC Sellers Only</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="rounded border-slate-300 text-[#00BFA5] focus:ring-[#00BFA5] w-4 h-4 cursor-pointer"
                />
                <span>In-Stock Ready to Dispatch</span>
              </label>
            </div>
          </aside>

          {/* Main Product Grid */}
          <div className="lg:col-span-3 space-y-6">
            {/* Active Filters Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="text-slate-500 font-semibold">
                Showing <strong className="text-[#0A192F]">{filteredProducts.length}</strong> items
              </span>

              {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2">
                  {selectedCategory !== 'All Items' && (
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center gap-1.5">
                      {selectedCategory}
                      <button onClick={() => setSelectedCategory('All Items')}>✕</button>
                    </span>
                  )}
                  {searchQuery && (
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center gap-1.5">
                      &quot;{searchQuery}&quot;
                      <button onClick={() => setSearchQuery('')}>✕</button>
                    </span>
                  )}
                  {selectedPricePreset !== 0 && (
                    <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold flex items-center gap-1.5">
                      {PRICE_PRESETS[selectedPricePreset].label}
                      <button onClick={() => setSelectedPricePreset(0)}>✕</button>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Product Cards */}
            {filteredProducts.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-white border border-slate-200 space-y-4">
                <Package className="w-12 h-12 text-slate-300 mx-auto" />
                <h3 className="text-lg font-bold text-[#0A192F]">No matching items found</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Try adjusting or clearing your filters to see more results from our 15,000+ catalog items.
                </p>
                <button
                  onClick={clearAllFilters}
                  className="px-6 py-2.5 rounded-xl bg-[#00BFA5] hover:bg-[#00a896] text-white text-xs font-bold cursor-pointer"
                >
                  Reset All Filters
                </button>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {filteredProducts.map(p => (
                  <div key={p.id} className="rounded-3xl border border-slate-200 bg-white hover:shadow-md transition-all p-4 space-y-3 flex flex-col justify-between group">
                    <div className="space-y-3">
                      <div className="relative rounded-2xl overflow-hidden aspect-square bg-slate-100 border border-slate-100">
                        <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <button
                          onClick={() => toggleWishlistHandler(p)}
                          className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm ${
                            isWishlisted(p.id) ? 'text-rose-600' : ''
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${isWishlisted(p.id) ? 'fill-current' : ''}`} />
                        </button>
                        <button
                          onClick={() => setQuickViewProduct(p)}
                          className="absolute bottom-2.5 left-2.5 px-3 py-1 rounded-lg bg-[#0A192F]/80 hover:bg-[#0A192F] text-white text-[10px] font-bold backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" /> Quick View
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span className="font-bold uppercase">{p.category || 'Item'}</span>
                          <span className="flex items-center gap-1 text-slate-600">
                            <MapPin className="w-2.5 h-2.5 text-[#00BFA5]" />
                            {p.seller_state}
                          </span>
                        </div>
                        <Link to={`/product/${p.id}`} className="block text-xs font-bold text-[#0A192F] hover:text-[#00BFA5] transition-colors line-clamp-2">
                          {p.name}
                        </Link>
                      </div>

                      <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                        <Star className="w-3.5 h-3.5 fill-current" />
                        <span>{p.rating || 4.9}</span>
                        <span className="text-[10px] text-slate-400 font-normal">({p.reviews_count || 12})</span>
                      </div>

                      <div className="flex items-baseline gap-2 pt-1">
                        <span className="text-base font-black text-[#00BFA5]">₦{Number(p.price).toLocaleString()}</span>
                        {p.compare_at_price && (
                          <span className="text-xs text-slate-400 line-through">₦{Number(p.compare_at_price).toLocaleString()}</span>
                        )}
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <button
                        onClick={() => {
                          addToCart(p, 1);
                          showToast('Added to cart!');
                        }}
                        className="flex-1 py-2.5 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Add to Cart
                      </button>
                      <button
                        onClick={() => {
                          addToComparison(p);
                          showToast('Added to comparison');
                        }}
                        className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
                        title="Compare"
                      >
                        <Scale className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProducts.map(p => (
                  <div key={p.id} className="rounded-3xl border border-slate-200 bg-white hover:shadow-md transition-all p-4 flex flex-col sm:flex-row gap-5 items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 shrink-0">
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">{p.category || 'Item'}</span>
                        <Link to={`/product/${p.id}`} className="block text-sm font-bold text-[#0A192F] hover:text-[#00BFA5] transition-colors truncate">
                          {p.name}
                        </Link>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-amber-500 font-bold flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-current" /> {p.rating || 4.9}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500">{p.seller_name} ({p.seller_state})</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-3 shrink-0">
                      <span className="text-lg font-black text-[#00BFA5]">₦{Number(p.price).toLocaleString()}</span>
                      <button
                        onClick={() => {
                          addToCart(p, 1);
                          showToast('Added to cart!');
                        }}
                        className="px-5 py-2.5 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                        Add to Cart
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
