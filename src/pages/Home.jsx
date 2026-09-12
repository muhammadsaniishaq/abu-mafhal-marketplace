import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import {
  Search, ShoppingCart, Heart, User, Check, Truck, ShieldCheck,
  Star, Sparkles, ArrowRight, ChevronLeft, ChevronRight,
  SlidersHorizontal, X, Store, ArrowUpRight, Zap, RefreshCw,
  Package, CheckCircle2, PhoneCall, HelpCircle
} from 'lucide-react';

const AM_LOGO = "/logo.png";

// Helper for extracting clean image URL
const getImg = (product) => {
  if (!product) return null;
  const img = product.image_url || product.thumbnail;
  if (img) return img;
  const imgs = product.images;
  if (!imgs) return null;
  if (typeof imgs === 'string') {
    try {
      const parsed = JSON.parse(imgs);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : parsed;
    } catch {
      return imgs;
    }
  }
  if (Array.isArray(imgs) && imgs.length > 0) return imgs[0];
  return null;
};

const Home = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { cartItems, addToCart } = useCart();
  const { wishlistItems, addToWishlist, removeFromWishlist, isInWishlist } = useWishlist();

  // ── LIVE SUPABASE STATES ──
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── FILTER & SORT STATES ──
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('featured'); // 'featured', 'price-low', 'price-high', 'rating'

  // ── UI INTERACTION STATES ──
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [addedItemIds, setAddedItemIds] = useState({});
  const [toastMessage, setToastMessage] = useState(null);
  const bannerTimerRef = useRef(null);

  // 1. Fetch All Real Data from Supabase
  const fetchLiveMarketplaceData = async () => {
    try {
      setLoading(true);

      // Parallel queries for speed & responsiveness
      const [bannersRes, categoriesRes, productsRes] = await Promise.allSettled([
        supabase
          .from('banners')
          .select('id, title, subtitle, image_url, action_link, section, display_order')
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
        supabase
          .from('categories')
          .select('id, name, icon, image_url, display_order')
          .eq('is_active', true)
          .order('display_order', { ascending: true }),
        supabase
          .from('products')
          .select('*')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
      ]);

      // ── Process Banners ──
      if (bannersRes.status === 'fulfilled' && bannersRes.value?.data?.length > 0) {
        setBanners(bannersRes.value.data);
      } else {
        // High-end default banner if banners table has no records yet
        setBanners([
          {
            id: 'b-default-1',
            title: 'Experience Premium Quality',
            subtitle: 'Nigeria’s Most Trusted Marketplace for Authentic Products & Fast Delivery',
            image_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1200&auto=format&fit=crop',
            action_link: '/shop'
          },
          {
            id: 'b-default-2',
            title: 'Verified Sellers & Safe Escrow',
            subtitle: 'Shop with 100% Peace of Mind — Direct Doorstep Dispatch Across All 36 States',
            image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop',
            action_link: '/shop'
          }
        ]);
      }

      // ── Process Products ──
      const liveProducts = (productsRes.status === 'fulfilled' && productsRes.value?.data) || [];
      setProducts(liveProducts);

      // ── Process Categories ──
      let liveCategories = (categoriesRes.status === 'fulfilled' && categoriesRes.value?.data) || [];
      
      // If categories table has records, use them; also incorporate distinct product categories
      const distinctProdCategories = [...new Set(liveProducts.map(p => p.category).filter(Boolean))];
      
      const existingNames = new Set(liveCategories.map(c => c.name?.toLowerCase()));
      distinctProdCategories.forEach(catName => {
        if (!existingNames.has(catName.toLowerCase())) {
          liveCategories.push({ id: `cat-${catName}`, name: catName });
        }
      });

      setCategories(liveCategories);
    } catch (err) {
      console.error('Error loading marketplace data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveMarketplaceData();
  }, []);

  // 2. Auto-advance Banner Carousel
  useEffect(() => {
    if (banners.length <= 1) return;
    bannerTimerRef.current = setInterval(() => {
      setCurrentBannerIndex((prev) => (prev + 1) % banners.length);
    }, 6000);

    return () => clearInterval(bannerTimerRef.current);
  }, [banners]);

  // 3. Filter and Sort Products
  const filteredProducts = useMemo(() => {
    let list = [...products];

    // Category Filter
    if (selectedCategory !== 'All') {
      list = list.filter(
        (p) => p.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Search Query Filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q) ||
          p.brand?.toLowerCase().includes(q)
      );
    }

    // Sorting
    if (sortBy === 'price-low') {
      list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === 'price-high') {
      list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sortBy === 'rating') {
      list.sort((a, b) => Number(b.rating || b.average_rating || 0) - Number(a.rating || a.average_rating || 0));
    }

    return list;
  }, [products, selectedCategory, searchQuery, sortBy]);

  // Handle Quick Add to Cart with Visual Feedback
  const handleAddToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();

    addToCart(product, 1);

    // Visual button success tick
    setAddedItemIds((prev) => ({ ...prev, [product.id]: true }));
    showToast(`"${product.name}" added to cart!`);

    setTimeout(() => {
      setAddedItemIds((prev) => ({ ...prev, [product.id]: false }));
    }, 1800);
  };

  // Handle Wishlist Toggle
  const handleWishlistToggle = (e, product) => {
    e.preventDefault();
    e.stopPropagation();

    if (isInWishlist(product.id)) {
      removeFromWishlist(product.id);
      showToast('Removed from wishlist');
    } else {
      addToWishlist(product);
      showToast('Saved to wishlist!');
    }
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  const totalCartCount = cartItems?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;
  const totalWishlistCount = wishlistItems?.length || 0;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col selection:bg-amber-400 selection:text-slate-950">
      
      {/* ── TOAST NOTIFICATION ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#070F1E] text-white px-5 py-3 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 animate-fade-in">
          <div className="w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs">
            ✓
          </div>
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ── TOP ANNOUNCEMENT STRIP ── */}
      <div className="bg-[#070F1E] text-slate-300 text-[11px] font-medium py-1.5 px-4 border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Welcome to Abu Mafhal Marketplace — Direct Doorstep Dispatch Across Nigeria</span>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-slate-400">
            <Link to="/contact" className="hover:text-amber-400 transition-colors flex items-center gap-1">
              <PhoneCall className="w-3 h-3" /> 24/7 Support
            </Link>
            <span>•</span>
            <Link to="/vendor-application" className="text-amber-400 font-bold hover:underline">
              Become a Verified Seller
            </Link>
          </div>
        </div>
      </div>

      {/* ── MAIN HEADER / NAVBAR ── */}
      <header className="sticky top-0 z-40 bg-[#0A192F]/95 backdrop-blur-md text-white border-b border-slate-800 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          
          {/* Logo & Brand Identity */}
          <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 p-1.5 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
              <img src={AM_LOGO} alt="Abu Mafhal" className="w-full h-full object-contain" onError={(e) => { e.target.src = "/logo.png"; }} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-black tracking-wide text-white">ABU</span>
                <span className="text-lg font-black text-amber-400">MAFHAL</span>
              </div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                Marketplace
              </p>
            </div>
          </Link>

          {/* Search Bar with Instant Live Filter */}
          <div className="flex-1 max-w-xl mx-2 hidden md:block">
            <div className="relative flex items-center">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search real products, categories, or brands..."
                className="w-full bg-slate-800/80 hover:bg-slate-800 focus:bg-white text-white focus:text-slate-900 placeholder-slate-400 text-xs sm:text-sm pl-11 pr-10 py-3 rounded-2xl border border-slate-700/80 focus:border-amber-400 focus:outline-none transition-all shadow-inner"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-4 pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* User & Cart Navigation Actions */}
          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* Wishlist */}
            <Link
              to="/buyer/wishlist"
              className="relative p-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/60 transition-all"
              title="Saved Items"
            >
              <Heart className="w-5 h-5" />
              {totalWishlistCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {totalWishlistCount}
                </span>
              )}
            </Link>

            {/* Cart Button */}
            <Link
              to="/cart"
              className="relative flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 px-4 py-2.5 rounded-xl font-black text-xs shadow-md shadow-amber-500/15 transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Cart</span>
              <span className="bg-slate-950 text-amber-400 text-[10px] font-black px-1.5 py-0.5 rounded-full ml-0.5">
                {totalCartCount}
              </span>
            </Link>

            {/* Profile / Auth */}
            {currentUser ? (
              <Link
                to="/buyer/profile"
                className="flex items-center gap-2.5 pl-2 border-l border-slate-800"
              >
                <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 text-amber-400 flex items-center justify-center font-bold text-xs uppercase">
                  {currentUser?.name?.[0] || currentUser?.email?.[0] || 'U'}
                </div>
                <div className="hidden lg:block text-left">
                  <p className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">
                    {currentUser?.name || currentUser?.full_name || 'My Account'}
                  </p>
                  <p className="text-[10px] text-slate-400 capitalize">
                    {currentUser?.role || 'Customer'}
                  </p>
                </div>
              </Link>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2.5 rounded-xl text-xs font-bold border border-slate-700 transition-all"
              >
                <User className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>

        {/* Mobile Search Input */}
        <div className="px-4 pb-3 md:hidden">
          <div className="relative flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="w-full bg-slate-800 text-white text-xs pl-10 pr-8 py-2.5 rounded-xl border border-slate-700 focus:border-amber-400 focus:outline-none"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 text-slate-400">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 space-y-8 flex-1">
        
        {/* ── HERO BANNER CAROUSEL (Live Supabase Banners) ── */}
        {banners.length > 0 && (
          <section className="relative rounded-3xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl min-h-[300px] sm:min-h-[360px] flex items-center">
            {banners.map((banner, index) => {
              const isActive = index === currentBannerIndex;
              return (
                <div
                  key={banner.id}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  {/* Background Image with Deep Gradient Overlay */}
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-full object-cover object-center transform scale-105 transition-transform duration-1000"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#070F1E] via-[#0A192F]/85 to-transparent" />
                  
                  {/* Banner Content */}
                  <div className="relative z-20 h-full max-w-xl p-8 sm:p-12 flex flex-col justify-center text-white space-y-4">
                    <div className="inline-flex items-center gap-2 bg-amber-400/20 border border-amber-400/30 text-amber-400 text-[10px] font-black uppercase px-3 py-1 rounded-full w-fit">
                      <Sparkles className="w-3 h-3" />
                      <span>Featured Marketplace Promotion</span>
                    </div>

                    <h2 className="text-2xl sm:text-4xl font-black leading-tight text-white tracking-tight">
                      {banner.title}
                    </h2>

                    <p className="text-xs sm:text-sm text-slate-300 font-medium line-clamp-2">
                      {banner.subtitle}
                    </p>

                    <div className="pt-2">
                      <Link
                        to={banner.action_link || '/shop'}
                        className="inline-flex items-center gap-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm px-6 py-3 rounded-xl shadow-lg shadow-amber-500/20 transition-all hover:translate-x-1"
                      >
                        <span>Explore Deals</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Slider Navigation Dots */}
            {banners.length > 1 && (
              <div className="absolute bottom-4 right-6 z-20 flex items-center gap-2">
                {banners.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentBannerIndex(i)}
                    className={`h-2 rounded-full transition-all ${
                      i === currentBannerIndex
                        ? 'w-7 bg-amber-400'
                        : 'w-2 bg-white/40 hover:bg-white/70'
                    }`}
                    aria-label={`Slide ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── VALUE PILLARS (Clean, Crisp & Trust-Building) ── */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex items-center gap-3.5 hover:border-slate-300 transition-all">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">Nationwide Delivery</h4>
              <p className="text-[11px] text-slate-500">Fast doorstep dispatch across Nigeria</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex items-center gap-3.5 hover:border-slate-300 transition-all">
            <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">Escrow Protected</h4>
              <p className="text-[11px] text-slate-500">100% money-back safe purchases</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex items-center gap-3.5 hover:border-slate-300 transition-all">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">Verified Sellers</h4>
              <p className="text-[11px] text-slate-500">Direct from vetted authentic merchants</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-sm flex items-center gap-3.5 hover:border-slate-300 transition-all">
            <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">Instant Support</h4>
              <p className="text-[11px] text-slate-500">Real human help whenever you need</p>
            </div>
          </div>
        </section>

        {/* ── LIVE CATEGORIES SELECTOR (Filter Products Instantly) ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Shop by Category
              </h3>
              <p className="text-xs text-slate-500">Select any department to filter real items</p>
            </div>
            <button
              onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                selectedCategory === 'All'
                  ? 'bg-[#0A192F] text-white shadow-md shadow-slate-900/10'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>All Products</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700/30 font-black">
                {products.length}
              </span>
            </button>

            {categories.map((cat) => {
              const isSelected = selectedCategory.toLowerCase() === cat.name.toLowerCase();
              const categoryCount = products.filter(
                (p) => p.category?.toLowerCase() === cat.name.toLowerCase()
              ).length;

              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20'
                      : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  <span>{cat.name}</span>
                  {categoryCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-950/10 font-bold">
                      {categoryCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── LIVE PRODUCTS CATALOG (Real Supabase Data Only) ── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>{selectedCategory === 'All' ? 'Marketplace Catalog' : selectedCategory}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {filteredProducts.length} items
                </span>
              </h3>
              {searchQuery && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Showing results matching "<span className="text-amber-600 font-bold">{searchQuery}</span>"
                </p>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 font-medium">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="featured">Newest First</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="rating">Top Rated</option>
              </select>
            </div>
          </div>

          {/* Loading Skeleton */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-white rounded-3xl p-4 border border-slate-200/70 shadow-sm animate-pulse space-y-3">
                  <div className="w-full h-44 bg-slate-200 rounded-2xl" />
                  <div className="w-2/3 h-4 bg-slate-200 rounded" />
                  <div className="w-1/3 h-3 bg-slate-200 rounded" />
                  <div className="w-1/2 h-5 bg-slate-200 rounded" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm space-y-4 max-w-md mx-auto my-8">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto text-2xl">
                <Package className="w-8 h-8" />
              </div>
              <h4 className="text-base font-black text-slate-900">No Live Products Found</h4>
              <p className="text-xs text-slate-500">
                {searchQuery
                  ? `No products match your search "${searchQuery}". Try clearing filters.`
                  : `There are currently no approved products listed under ${selectedCategory}.`}
              </p>
              <button
                onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
                className="inline-flex items-center gap-2 bg-[#0A192F] hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md"
              >
                <span>View All Products</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Live Product Grid */
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filteredProducts.map((product) => {
                const img = getImg(product);
                const isItemInWishlist = isInWishlist(product.id);
                const isJustAdded = addedItemIds[product.id];
                const price = Number(product.price || 0);
                const comparePrice = Number(product.compare_at_price || 0);
                const hasDiscount = comparePrice > price;
                const discountPct = hasDiscount ? Math.round(((comparePrice - price) / comparePrice) * 100) : 0;
                const rating = Number(product.rating || product.average_rating || 5).toFixed(1);
                const inStock = (product.stock_quantity ?? product.stock ?? 10) > 0;

                return (
                  <Link
                    key={product.id}
                    to={`/product/${product.id}`}
                    className="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative"
                  >
                    {/* Top Badges */}
                    <div className="absolute top-5 left-5 z-10 flex flex-col gap-1.5">
                      {hasDiscount && (
                        <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-sm">
                          -{discountPct}%
                        </span>
                      )}
                      {product.is_new && (
                        <span className="bg-emerald-500 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-sm uppercase">
                          New
                        </span>
                      )}
                    </div>

                    {/* Wishlist Button */}
                    <button
                      onClick={(e) => handleWishlistToggle(e, product)}
                      className="absolute top-5 right-5 z-10 w-8 h-8 rounded-full bg-white/90 hover:bg-white text-slate-400 hover:text-rose-500 flex items-center justify-center shadow-md transition-all"
                      title={isItemInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                    >
                      <Heart
                        className={`w-4 h-4 transition-colors ${
                          isItemInWishlist ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                    </button>

                    {/* Image Box */}
                    <div className="w-full h-44 sm:h-48 rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center p-3 mb-3 relative">
                      {img ? (
                        <img
                          src={img}
                          alt={product.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <Package className="w-12 h-12 text-slate-300" />
                      )}
                    </div>

                    {/* Details */}
                    <div className="space-y-1.5 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                          <span className="font-bold uppercase tracking-wider truncate max-w-[120px]">
                            {product.category || 'General'}
                          </span>
                          <div className="flex items-center gap-1 text-amber-500 font-black">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>{rating}</span>
                          </div>
                        </div>

                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-amber-600 transition-colors line-clamp-2 leading-snug">
                          {product.name}
                        </h4>
                      </div>

                      {/* Stock Indicator */}
                      <div className="pt-1">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                            inStock ? 'text-emerald-600' : 'text-rose-500'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </div>

                      {/* Price & Add to Cart Button */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 mt-2">
                        <div>
                          <p className="text-sm sm:text-base font-black text-slate-950">
                            ₦{price.toLocaleString()}
                          </p>
                          {hasDiscount && (
                            <p className="text-[10px] text-slate-400 line-through">
                              ₦{comparePrice.toLocaleString()}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={(e) => handleAddToCart(e, product)}
                          className={`px-3 py-2 rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5 ${
                            isJustAdded
                              ? 'bg-emerald-500 text-white'
                              : 'bg-[#0A192F] hover:bg-amber-400 hover:text-slate-950 text-white'
                          }`}
                          title="Add to Cart"
                        >
                          {isJustAdded ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Added</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Add</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* ── SELLER INVITATION BANNER (Verified Vendor Hub) ── */}
        <section className="bg-gradient-to-r from-[#070F1E] via-[#0A192F] to-[#122A4E] rounded-3xl p-6 sm:p-10 text-white border border-slate-800 shadow-xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative z-10 max-w-xl space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 bg-amber-400/20 text-amber-400 border border-amber-400/30 text-[10px] font-black uppercase px-3 py-1 rounded-full">
              <Store className="w-3 h-3" />
              <span>Vendor Empowerment Program</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white leading-tight">
              Start Selling Your Products on <span className="text-amber-400">Abu Mafhal</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 font-medium">
              Join Nigeria's fastest growing digital marketplace. Reach verified buyers nationwide with instant payments and low commission fees.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center gap-3">
            <Link
              to="/vendor-application"
              className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 px-6 py-3 rounded-xl font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2"
            >
              <span>Open Store Now</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              to="/shop"
              className="bg-slate-800/80 hover:bg-slate-700 text-white px-5 py-3 rounded-xl font-bold text-xs sm:text-sm border border-slate-700 transition-all"
            >
              Browse Products
            </Link>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-[#070F1E] text-slate-400 border-t border-slate-800/80 mt-12 py-10 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          {/* Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-400 p-1 flex items-center justify-center">
                <img src={AM_LOGO} alt="" className="w-full h-full object-contain" />
              </div>
              <span className="text-base font-black text-white">ABU MAFHAL</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Nigeria’s trusted digital marketplace connecting buyers with verified sellers nationwide. Authentic products, secured escrow payments, and swift delivery.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase text-white tracking-wider">Quick Links</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/shop" className="hover:text-amber-400 transition-colors">All Products</Link></li>
              <li><Link to="/stores" className="hover:text-amber-400 transition-colors">Verified Stores</Link></li>
              <li><Link to="/buyer/orders" className="hover:text-amber-400 transition-colors">Track Orders</Link></li>
              <li><Link to="/vendor-application" className="hover:text-amber-400 transition-colors">Sell on Abu Mafhal</Link></li>
            </ul>
          </div>

          {/* Customer Care */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase text-white tracking-wider">Customer Care</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/contact" className="hover:text-amber-400 transition-colors">Help Center & Support</Link></li>
              <li><Link to="/terms" className="hover:text-amber-400 transition-colors">Terms of Service</Link></li>
              <li><Link to="/privacy" className="hover:text-amber-400 transition-colors">Privacy Policy</Link></li>
              <li><Link to="/about" className="hover:text-amber-400 transition-colors">About Us</Link></li>
            </ul>
          </div>

          {/* Security & Guarantees */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase text-white tracking-wider">Security & Trust</h4>
            <p className="text-xs text-slate-400">
              Payments are 100% secured via 256-bit SSL encryption through certified CBN-approved payment gateways.
            </p>
            <div className="flex items-center gap-2 pt-2">
              <span className="px-2.5 py-1 bg-slate-800 text-[10px] font-bold text-slate-300 rounded-md border border-slate-700">Paystack</span>
              <span className="px-2.5 py-1 bg-slate-800 text-[10px] font-bold text-slate-300 rounded-md border border-slate-700">Flutterwave</span>
              <span className="px-2.5 py-1 bg-slate-800 text-[10px] font-bold text-slate-300 rounded-md border border-slate-700">Bank Transfer</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Abu Mafhal Marketplace. All rights reserved.</p>
          <p className="text-[11px]">Your Marketplace, Your Choice.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;