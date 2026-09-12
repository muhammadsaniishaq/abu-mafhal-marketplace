import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import {
  Search, Bell, ShoppingCart, User, MapPin, ChevronDown,
  Home as HomeIcon, Grid, Store, Zap, Package, MessageSquare,
  Wallet, Heart, Ticket, HelpCircle, ArrowRight, ShieldCheck,
  Truck, CheckCircle, Star, Sparkles, Plus, Clock, ExternalLink,
  ChevronRight, ArrowUpRight, Flame
} from 'lucide-react';

const AM_LOGO = "/logo.png";

// Category Data with pastel accents
const CATEGORIES = [
  { id: 'fashion', name: 'Fashion', icon: '👗', bg: 'bg-pink-50 text-pink-600 border-pink-200' },
  { id: 'electronics', name: 'Electronics', icon: '💻', bg: 'bg-blue-50 text-blue-600 border-blue-200' },
  { id: 'phones', name: 'Mobile Accessories', icon: '📱', bg: 'bg-cyan-50 text-cyan-600 border-cyan-200' },
  { id: 'beauty', name: 'Beauty & Personal Care', icon: '💄', bg: 'bg-rose-50 text-rose-600 border-rose-200' },
  { id: 'home', name: 'Home & Living', icon: '🛋️', bg: 'bg-amber-50 text-amber-600 border-amber-200' },
  { id: 'groceries', name: 'Groceries', icon: '🛒', bg: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  { id: 'health', name: 'Health & Wellness', icon: '💓', bg: 'bg-purple-50 text-purple-600 border-purple-200' },
  { id: 'sports', name: 'Sports & Outdoors', icon: '⚽', bg: 'bg-teal-50 text-teal-600 border-teal-200' },
  { id: 'kids', name: 'Baby & Kids', icon: '🧸', bg: 'bg-orange-50 text-orange-600 border-orange-200' },
  { id: 'automotive', name: 'Automotive', icon: '🚗', bg: 'bg-sky-50 text-sky-600 border-sky-200' },
  { id: 'books', name: 'Books & Stationery', icon: '📚', bg: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
];

const FLASH_PRODUCTS = [
  {
    id: 'fp1',
    name: 'iPhone 14 Pro 256GB',
    brand: 'Apple',
    category: 'Electronics',
    price: 1200000,
    oldPrice: 2000000,
    discount: 40,
    rating: 4.8,
    reviews: 320,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: 'fp2',
    name: 'JBL Tune 720BT Wireless',
    brand: 'JBL',
    category: 'Audio',
    price: 45000,
    oldPrice: 70000,
    discount: 35,
    rating: 4.7,
    reviews: 189,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: 'fp3',
    name: "Nike Air Max 270 Sneakers",
    brand: 'Nike',
    category: 'Footwear',
    price: 60000,
    oldPrice: 120000,
    discount: 50,
    rating: 4.6,
    reviews: 421,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: 'fp4',
    name: 'Dior Sauvage EDP 100ml',
    brand: 'Dior',
    category: 'Beauty',
    price: 95000,
    oldPrice: 135000,
    discount: 30,
    rating: 4.9,
    reviews: 228,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: 'fp5',
    name: 'Nexus Air Fryer 6.5L Digital',
    brand: 'Nexus',
    category: 'Appliances',
    price: 75000,
    oldPrice: 100000,
    discount: 25,
    rating: 4.5,
    reviews: 367,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?q=80&w=400&auto=format&fit=crop',
  },
  {
    id: 'fp6',
    name: 'Oraimo Watch 4 Plus',
    brand: 'Oraimo',
    category: 'Wearables',
    price: 32000,
    oldPrice: 40000,
    discount: 20,
    rating: 4.4,
    reviews: 290,
    inStock: true,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400&auto=format&fit=crop',
  },
];

const FEATURED_STORES = [
  { id: 's1', name: 'Mafhal Fashion', category: 'Fashion & Clothing', rating: 4.8, products: 320, image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=200&auto=format&fit=crop' },
  { id: 's2', name: 'TechWorld NG', category: 'Smartphones & Gadgets', rating: 4.7, products: 450, image: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=200&auto=format&fit=crop' },
  { id: 's3', name: 'Home Essentials', category: 'Kitchen & Decor', rating: 4.6, products: 290, image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=200&auto=format&fit=crop' },
  { id: 's4', name: 'Beauty Hub', category: 'Perfumes & Cosmetics', rating: 4.7, products: 310, image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=200&auto=format&fit=crop' },
  { id: 's5', name: 'Grocery Mart', category: 'Fresh & Packaged Food', rating: 4.6, products: 500, image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=200&auto=format&fit=crop' },
];

const FEATURED_PRODUCTS = [
  { id: 'p1', name: "Smartphone 128GB 6.7'' Display", price: 185000, oldPrice: 220000, discount: 16, rating: 4.8, reviews: 320, image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=400&auto=format&fit=crop' },
  { id: 'p2', name: "Men's Casual Sneakers", price: 38000, oldPrice: 50000, discount: 24, rating: 4.6, reviews: 210, image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=400&auto=format&fit=crop' },
  { id: 'p3', name: "Women's Handbag Premium Quality", price: 42000, oldPrice: 60000, discount: 30, rating: 4.7, reviews: 180, image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=400&auto=format&fit=crop' },
  { id: 'p4', name: 'Smart Watch Heart Rate Monitor', price: 65000, oldPrice: 90000, discount: 28, rating: 4.5, reviews: 410, image: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?q=80&w=400&auto=format&fit=crop' },
];

const POPULAR_PRODUCTS = [
  { id: 'pp1', name: 'Wireless Earbuds with Charging Case', price: 28000, oldPrice: 40000, discount: 30, rating: 4.6, reviews: 320, image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=400&auto=format&fit=crop' },
  { id: 'pp2', name: 'Electric Rice Cooker 5L Large', price: 55000, oldPrice: 75000, discount: 27, rating: 4.7, reviews: 260, image: 'https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?q=80&w=400&auto=format&fit=crop' },
  { id: 'pp3', name: "Men's Polo Shirt Premium Cotton", price: 18000, oldPrice: 25000, discount: 28, rating: 4.4, reviews: 190, image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?q=80&w=400&auto=format&fit=crop' },
  { id: 'pp4', name: 'Kitchen Blender High Speed Multi-blade', price: 32000, oldPrice: 45000, discount: 29, rating: 4.6, reviews: 310, image: 'https://images.unsplash.com/photo-1570222094114-d054a817e56b?q=80&w=400&auto=format&fit=crop' },
];

const Home = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { cartItems, addToCart } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('home');

  // Flash sale countdown timer (12 Days, 08 Hours, 24 Minutes, 36 Seconds)
  const [timeLeft, setTimeLeft] = useState({ days: 12, hours: 8, minutes: 24, seconds: 36 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        return { days: 12, hours: 8, minutes: 24, seconds: 36 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col">
      {/* ── TOP NAVBAR (Matching Desktop Mockup) ── */}
      <header className="sticky top-0 z-50 bg-[#0A192F] text-white border-b border-slate-800 shadow-md">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 h-18 flex items-center justify-between gap-4 py-3">
          {/* Left Brand Logo */}
          <Link to="/" className="flex items-center gap-3 group flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-amber-500 p-1.5 flex items-center justify-center shadow-lg shadow-amber-400/20">
              <img src={AM_LOGO} alt="Abu Mafhal" className="w-full h-full object-contain" onError={(e) => { e.target.src = "/logo.png"; }} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-wide text-white flex items-center gap-1.5">
                ABU <span className="text-[#00D2FF]">MAFHAL</span>
              </h1>
              <p className="text-[8px] font-bold text-slate-400 tracking-widest uppercase">
                Your Marketplace, Your Choice.
              </p>
            </div>
          </Link>

          {/* Search Bar + Delivery Dropdown */}
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl mx-2 hidden sm:flex items-center bg-white rounded-full p-1 border border-slate-200 shadow-inner">
            <div className="flex items-center flex-1 px-3 gap-2">
              <Search className="w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for products, brands and stores..."
                className="w-full text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:outline-none bg-transparent"
              />
            </div>
            <div className="hidden lg:flex items-center gap-1.5 border-l border-slate-200 px-3 py-1 text-xs text-slate-600 font-semibold cursor-pointer">
              <MapPin className="w-3.5 h-3.5 text-[#00BFA5]" />
              <span>Deliver to <strong>Gashua, Yobe State</strong></span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </div>
            <button
              type="submit"
              className="bg-[#00BFA5] hover:bg-[#00A892] text-white px-5 py-2 rounded-full text-xs font-bold transition-all shadow-sm flex items-center gap-1"
            >
              Search
            </button>
          </form>

          {/* Right Action Icons */}
          <div className="flex items-center gap-4">
            <Link to="/notifications" className="relative p-2 text-slate-300 hover:text-white transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[9px] font-bold flex items-center justify-center">
                3
              </span>
            </Link>

            <Link to="/cart" className="relative p-2 text-slate-300 hover:text-white transition-colors">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#F59E0B] text-slate-950 rounded-full text-[9px] font-black flex items-center justify-center">
                {cartItems?.length || 2}
              </span>
            </Link>

            {currentUser ? (
              <Link to="/buyer/profile" className="flex items-center gap-2.5 pl-2 border-l border-slate-800">
                <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-400 flex items-center justify-center font-bold text-xs">
                  {currentUser?.name?.[0] || 'U'}
                </div>
                <div className="hidden xl:block text-left">
                  <p className="text-xs font-bold text-white leading-tight">{currentUser.name || 'Muhammad Sani'}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{currentUser.role || 'Customer'}</p>
                </div>
              </Link>
            ) : (
              <Link
                to="/login"
                className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 px-4 py-2 rounded-xl text-xs font-black shadow-md hover:from-amber-300 hover:to-amber-400 transition-all"
              >
                <User className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* ── MAIN BODY WITH SIDEBAR ── */}
      <div className="flex-1 max-w-[1600px] w-full mx-auto flex flex-col md:flex-row gap-6 p-4 lg:p-6">
        {/* Left Desktop Sidebar */}
        <aside className="w-full md:w-60 flex-shrink-0 bg-[#070F1E] text-white rounded-3xl p-4 flex flex-col justify-between border border-slate-800 shadow-xl self-start sticky top-22 hidden md:flex">
          <nav className="space-y-1">
            {[
              { id: 'home', label: 'Home', icon: HomeIcon, path: '/' },
              { id: 'categories', label: 'Categories', icon: Grid, path: '/shop' },
              { id: 'stores', label: 'Stores', icon: Store, path: '/stores' },
              { id: 'flash-sale', label: 'Flash Sale', icon: Zap, path: '/shop?filter=flash' },
              { id: 'orders', label: 'Orders', icon: Package, path: '/buyer/orders' },
              { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/messages', badge: 2 },
              { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/buyer/wallet' },
              { id: 'wishlist', label: 'Wishlist', icon: Heart, path: '/buyer/wishlist' },
              { id: 'vouchers', label: 'Vouchers', icon: Ticket, path: '/buyer/loyalty' },
              { id: 'support', label: 'Help & Support', icon: HelpCircle, path: '/contact' },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <Link
                  key={item.id}
                  to={item.path}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#00BFA5] text-white shadow-md shadow-[#00BFA5]/20 font-black'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Referral Card */}
          <div className="mt-8 bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-2xl p-3.5">
            <div className="flex items-center gap-2 mb-1 text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-xs font-black">Invite & Earn</span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium leading-snug">
              Get rewards for inviting friends to shop on Abu Mafhal!
            </p>
            <Link to="/buyer/profile" className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:underline">
              <span>Start Inviting</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </aside>

        {/* ── MAIN CONTENT AREA ── */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* ── TOP HERO ROW (Main Banner + 2 Side Promo Cards) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Left 2 Cols: Main Big Deals Banner */}
            <div className="lg:col-span-2 relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#0A192F] via-[#0E2A4D] to-[#133E68] text-white p-6 sm:p-8 flex flex-col justify-between shadow-xl border border-slate-700/50 min-h-[260px]">
              <div className="relative z-10 max-w-md">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-amber-400 p-1 flex items-center justify-center">
                    <img src={AM_LOGO} alt="" className="w-full h-full object-contain" />
                  </div>
                  <span className="text-[10px] tracking-widest font-black uppercase text-amber-400">
                    Abu Mafhal Marketplace
                  </span>
                </div>

                <h2 className="text-2xl sm:text-4xl font-black leading-tight tracking-tight">
                  Shop Everything <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
                    You Need
                  </span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 mt-2 font-medium">
                  From trusted sellers across Nigeria, all in one marketplace.
                </p>

                <div className="mt-5 flex items-center gap-3">
                  <Link
                    to="/shop"
                    className="bg-[#F59E0B] hover:bg-amber-400 text-slate-950 px-6 py-2.5 rounded-full text-xs sm:text-sm font-black transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
                  >
                    <span>Shop Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* Bottom Feature Badges */}
              <div className="relative z-10 mt-6 pt-4 border-t border-white/10 flex flex-wrap items-center gap-4 text-[11px] font-bold text-slate-300">
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Great Prices</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Trusted Sellers</span>
                <span className="flex items-center gap-1.5"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Fast Delivery</span>
              </div>

              {/* Floating Product Artwork */}
              <img
                src="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=450&auto=format&fit=crop"
                alt="Products"
                className="absolute right-0 bottom-0 w-64 h-64 object-contain opacity-40 lg:opacity-90 pointer-events-none -mr-8 -mb-8 drop-shadow-2xl"
              />
            </div>

            {/* Right Column: 2 Feature Cards */}
            <div className="flex flex-col gap-4">
              {/* Card 1: Fast & Reliable Delivery */}
              <div className="flex-1 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3 relative overflow-hidden group hover:border-slate-300 transition-all">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-[#00BFA5] tracking-wider">
                    <Truck className="w-3.5 h-3.5" /> Fast Delivery
                  </div>
                  <h3 className="text-sm font-black text-slate-900">Fast & Reliable Delivery</h3>
                  <p className="text-xs text-slate-500">To your doorstep across Nigeria</p>
                  <Link to="/buyer/orders" className="text-xs font-bold text-[#00BFA5] flex items-center gap-1 pt-1 group-hover:underline">
                    <span>Track Order</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-3xl flex items-center justify-center flex-shrink-0">
                  🛵
                </div>
              </div>

              {/* Card 2: Become a Seller */}
              <div className="flex-1 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm flex items-center justify-between gap-3 relative overflow-hidden group hover:border-slate-300 transition-all">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-500 tracking-wider">
                    <Store className="w-3.5 h-3.5" /> Vendor Hub
                  </div>
                  <h3 className="text-sm font-black text-slate-900">Become a Seller</h3>
                  <p className="text-xs text-slate-500">Start selling on ABU MAFHAL today</p>
                  <Link to="/vendor-application" className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-full transition-all">
                    <span>Open a Store</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-amber-50 text-3xl flex items-center justify-center flex-shrink-0">
                  🏪
                </div>
              </div>
            </div>
          </div>

          {/* ── HORIZONTAL CATEGORIES ROW (Soft Pastel Cards) ── */}
          <section className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-black text-slate-900">Popular Categories</h3>
              <Link to="/shop" className="text-xs font-bold text-[#00BFA5] hover:underline flex items-center gap-1">
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <Link
                  key={cat.id}
                  to={`/shop?category=${cat.id}`}
                  className="flex flex-col items-center justify-center min-w-[85px] p-3 rounded-2xl bg-slate-50 hover:bg-white hover:shadow-md border border-slate-200/60 transition-all text-center group flex-shrink-0"
                >
                  <span className="text-2xl mb-1.5 group-hover:scale-110 transition-transform">{cat.icon}</span>
                  <span className="text-[11px] font-bold text-slate-700 leading-tight line-clamp-1">{cat.name}</span>
                </Link>
              ))}
            </div>
          </section>

          {/* ── FLASH SALE ROW (Matching Screenshot 5) ── */}
          <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-[#0A192F] to-[#122B4D] text-white p-5 rounded-2xl">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-400/25">
                  <Zap className="w-6 h-6 fill-slate-950" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-rose-500 text-white font-black text-[9px] uppercase rounded tracking-wider">
                      Limited Time
                    </span>
                    <h3 className="text-lg sm:text-xl font-black text-amber-400">FLASH SALE</h3>
                  </div>
                  <p className="text-xs text-slate-300 font-medium">Amazing Deals. Unbeatable Prices.</p>
                </div>
              </div>

              {/* 4 Countdown Boxes + Shop Now button */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl text-center min-w-[48px]">
                    <p className="text-sm font-black text-white">{String(timeLeft.days).padStart(2, '0')}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Days</p>
                  </div>
                  <span className="font-bold text-slate-500">:</span>
                  <div className="bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl text-center min-w-[48px]">
                    <p className="text-sm font-black text-white">{String(timeLeft.hours).padStart(2, '0')}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Hours</p>
                  </div>
                  <span className="font-bold text-slate-500">:</span>
                  <div className="bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl text-center min-w-[48px]">
                    <p className="text-sm font-black text-white">{String(timeLeft.minutes).padStart(2, '0')}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Mins</p>
                  </div>
                  <span className="font-bold text-slate-500">:</span>
                  <div className="bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl text-center min-w-[48px]">
                    <p className="text-sm font-black text-amber-400">{String(timeLeft.seconds).padStart(2, '0')}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Secs</p>
                  </div>
                </div>

                <Link
                  to="/shop?filter=flash"
                  className="px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>Shop Now</span>
                  <span>→</span>
                </Link>
              </div>
            </div>

            {/* 6-Column Product Grid Matching Screenshot 5 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {FLASH_PRODUCTS.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-slate-50/70 hover:bg-white rounded-2xl p-3 border border-slate-200/60 hover:shadow-lg transition-all flex flex-col justify-between group relative"
                >
                  {/* Discount tag */}
                  <span className="absolute top-2.5 left-2.5 bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md z-10">
                    -{prod.discount}%
                  </span>

                  {/* Image */}
                  <div className="w-full h-32 rounded-xl overflow-hidden mb-2 bg-white flex items-center justify-center p-2">
                    <img src={prod.image} alt={prod.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                  </div>

                  {/* Details */}
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-900 truncate leading-snug">{prod.name}</h4>
                    <p className="text-[10px] text-slate-400 font-medium">{prod.brand}</p>
                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span className="font-bold text-slate-700">{prod.rating}</span>
                      <span className="text-slate-400">({prod.reviews})</span>
                    </div>

                    {/* In Stock Badge */}
                    <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 pt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>In Stock</span>
                    </div>

                    {/* Price & Add to Cart button */}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <p className="text-xs sm:text-sm font-black text-slate-950">₦{prod.price.toLocaleString()}</p>
                        <p className="text-[10px] text-slate-400 line-through">₦{prod.oldPrice.toLocaleString()}</p>
                      </div>
                      <button
                        onClick={() => addToCart(prod)}
                        className="w-7 h-7 rounded-lg bg-[#0A192F] hover:bg-[#00BFA5] text-white flex items-center justify-center transition-colors shadow-sm"
                        title="Add to Cart"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── FEATURED STORES ROW ── */}
          <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Featured Stores</h3>
                <p className="text-xs text-slate-500 font-medium">Verified sellers with top-rated service</p>
              </div>
              <Link to="/stores" className="text-xs font-bold text-[#00BFA5] hover:underline flex items-center gap-1">
                <span>View All Stores</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {FEATURED_STORES.map((store) => (
                <Link
                  key={store.id}
                  to="/stores"
                  className="bg-slate-50 hover:bg-white rounded-2xl p-3 border border-slate-200/60 hover:shadow-md transition-all flex items-center gap-3"
                >
                  <img src={store.image} alt={store.name} className="w-10 h-10 rounded-xl object-cover border border-slate-200" />
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate">{store.name}</h4>
                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                      <span className="font-bold">{store.rating}</span>
                      <span>• {store.products} items</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* ── FEATURED & POPULAR PRODUCTS GRID ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: Featured Products */}
            <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Featured Products</h3>
                <Link to="/shop" className="text-xs font-bold text-[#00BFA5] hover:underline">View All</Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {FEATURED_PRODUCTS.map((p) => (
                  <div key={p.id} className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 flex flex-col justify-between group">
                    <div className="w-full h-28 rounded-xl overflow-hidden mb-2 bg-white flex items-center justify-center p-2">
                      <img src={p.image} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 truncate">{p.name}</h4>
                      <p className="text-xs font-black text-slate-950 mt-1">₦{p.price.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Right: Popular Products */}
            <section className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black text-slate-900">Popular Products</h3>
                <Link to="/shop" className="text-xs font-bold text-[#00BFA5] hover:underline">View All</Link>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {POPULAR_PRODUCTS.map((p) => (
                  <div key={p.id} className="bg-slate-50/80 rounded-2xl p-3 border border-slate-200/60 flex flex-col justify-between group">
                    <div className="w-full h-28 rounded-xl overflow-hidden mb-2 bg-white flex items-center justify-center p-2">
                      <img src={p.image} alt={p.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 truncate">{p.name}</h4>
                      <p className="text-xs font-black text-slate-950 mt-1">₦{p.price.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ── BOTTOM TRUST BANNER ── */}
          <div className="bg-[#0A192F] text-white rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 border border-slate-800">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-6 h-6 text-[#00BFA5]" />
              <div>
                <h4 className="text-xs font-bold">Secure Shopping</h4>
                <p className="text-[10px] text-slate-400">Your data is safe with 256-bit encryption</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Truck className="w-6 h-6 text-amber-400" />
              <div>
                <h4 className="text-xs font-bold">Fast Delivery</h4>
                <p className="text-[10px] text-slate-400">Across Nigeria & international exports</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
              <div>
                <h4 className="text-xs font-bold">Genuine Products</h4>
                <p className="text-[10px] text-slate-400">From 100% verified local sellers</p>
              </div>
            </div>

            <Link
              to="/shop"
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 px-5 py-2 rounded-full text-xs font-black transition-all shadow-md"
            >
              Shop Now →
            </Link>
          </div>
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-[#070F1E] text-slate-400 py-6 text-center text-xs border-t border-slate-800">
        <p>© {new Date().getFullYear()} ABU MAFHAL Marketplace. All rights reserved. Shop Smarter, Live Better.</p>
      </footer>
    </div>
  );
};

export default Home;