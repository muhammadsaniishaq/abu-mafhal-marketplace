import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useWishlist } from '../../context/WishlistContext';
import { useComparison } from '../../context/ComparisonContext';
import { supabase } from '../../config/supabase';
import {
  Search, ShoppingCart, Heart, User, LogOut, Menu, X,
  ShieldCheck, Truck, Zap, Store, Compass, ArrowRight,
  ChevronDown, Bell, Scale, Clock, Sparkles, Layers,
  Phone, CheckCircle2, Package
} from 'lucide-react';
import NotificationBell from './NotificationBell';

const CATEGORIES = [
  'All Categories',
  'Phones & Tablets',
  'Electronics',
  'Computing & Laptops',
  'Fashion & Apparel',
  'Beauty & Personal Care',
  'Home & Kitchen',
  'Groceries & Provisions'
];

export default function Navbar() {
  const { currentUser, logout } = useAuth();
  const { cartItems } = useCart();
  const { wishlistItems } = useWishlist();
  const { comparisonItems } = useComparison ? useComparison() : { comparisonItems: [] };
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState('All Categories');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const searchRef = useRef(null);
  const userMenuRef = useRef(null);

  const totalCartCount = (cartItems || []).reduce((sum, item) => sum + (item.quantity || 1), 0);
  const totalWishlistCount = (wishlistItems || []).length;
  const totalCompareCount = (comparisonItems || []).length;

  // Click outside listener for search & user menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserDropdownOpen(false);
    setShowSuggestions(false);
  }, [location.pathname]);

  // Live search debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        let q = supabase
          .from('products')
          .select('id, name, price, image_url, images, category')
          .ilike('name', `%${searchQuery.trim()}%`)
          .limit(5);

        if (selectedCat !== 'All Categories') {
          q = q.ilike('category', `%${selectedCat}%`);
        }

        const { data } = await q;
        setSearchSuggestions(data || []);
        setShowSuggestions(true);
      } catch (_) {
        setSearchSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCat]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setShowSuggestions(false);
    navigate(`/shop?search=${encodeURIComponent(searchQuery.trim())}&category=${encodeURIComponent(selectedCat)}`);
  };

  const getDashboardPath = () => {
    if (currentUser?.role === 'admin' || currentUser?.role === 'superadmin') return '/admin';
    if (currentUser?.role === 'vendor') return '/vendor';
    return '/buyer';
  };

  const getImg = (p) => {
    if (p.image_url) return p.image_url;
    if (Array.isArray(p.images) && p.images[0]) return p.images[0];
    if (typeof p.images === 'string' && p.images.startsWith('http')) return p.images;
    return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=200';
  };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 font-sans shadow-xs">
      {/* ─── 1. TOP ANNOUNCEMENT TICKER ─── */}
      <div className="bg-[#0A192F] text-white text-[11px] font-medium py-1.5 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#00BFA5]/20 text-[#00BFA5] font-bold text-[10px] tracking-wide uppercase">
              <ShieldCheck className="w-3 h-3" /> 100% Escrow Vault
            </span>
            <span className="text-slate-300 hidden sm:inline">
              Nationwide Delivery Across all 36 States • 7-Day Free Returns • CBN-Licensed Channels
            </span>
            <span className="text-slate-300 sm:hidden">
              Nationwide 36 States Express Delivery
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-300 shrink-0">
            <Link to="/track-order" className="hover:text-[#00BFA5] transition-colors flex items-center gap-1 hidden md:flex">
              <Truck className="w-3 h-3 text-[#00BFA5]" />
              Track Order
            </Link>
            <Link to="/pay-small-small" className="hover:text-[#D9A73A] transition-colors flex items-center gap-1 hidden lg:flex font-semibold text-[#D9A73A]">
              <Zap className="w-3 h-3 fill-current" />
              Pay Small Small (PSS)
            </Link>
            <Link to="/vendor-application" className="hover:text-white transition-colors hidden sm:inline font-bold">
              Become a Vendor
            </Link>
            <a href="tel:+2348145853539" className="hover:text-[#00BFA5] transition-colors flex items-center gap-1">
              <Phone className="w-3 h-3 text-[#00BFA5]" />
              <span className="hidden sm:inline">+234 814 585 3539</span>
            </a>
          </div>
        </div>
      </div>

      {/* ─── 2. MAIN HEADER ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
        <div className="flex items-center justify-between gap-4 lg:gap-8">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative">
              <img
                src="/logo.png"
                alt="Abu Mafhal"
                className="w-9 h-9 sm:w-10 sm:h-10 object-contain rounded-xl drop-shadow-sm group-hover:scale-105 transition-transform"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-extrabold text-[#0A192F] tracking-tight leading-none group-hover:text-[#00BFA5] transition-colors">
                ABU MAFHAL
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                Marketplace
              </span>
            </div>
          </Link>

          {/* Live Search Form (Desktop & Tablet) */}
          <div ref={searchRef} className="hidden md:flex flex-1 max-w-2xl relative">
            <form onSubmit={handleSearchSubmit} className="flex items-center w-full bg-slate-50 hover:bg-slate-100/80 focus-within:bg-white rounded-2xl border border-slate-200 focus-within:border-[#00BFA5] focus-within:ring-2 focus-within:ring-[#00BFA5]/20 transition-all overflow-hidden">
              <select
                value={selectedCat}
                onChange={(e) => setSelectedCat(e.target.value)}
                className="text-xs font-semibold text-slate-700 bg-slate-100/90 hover:bg-slate-200/80 py-2.5 px-3 border-r border-slate-200 outline-none cursor-pointer max-w-[140px] truncate"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <div className="relative flex-1 flex items-center">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search 15,000+ authentic items, gadgets, fashion, phones..."
                  className="w-full text-xs text-slate-800 bg-transparent px-3 py-2.5 outline-none placeholder:text-slate-400 font-medium"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setSearchSuggestions([]); }}
                    className="p-1 mr-1 text-slate-400 hover:text-slate-600 rounded-full"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                className="px-5 py-2.5 bg-[#00BFA5] hover:bg-[#00a896] text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Search</span>
              </button>
            </form>

            {/* Instant Suggestions Dropdown */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 divide-y divide-slate-100">
                <div className="px-4 py-2 bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Product Suggestions</span>
                  <span>{searchSuggestions.length} found</span>
                </div>
                {searchSuggestions.map((p) => (
                  <Link
                    key={p.id}
                    to={`/product/${p.id}`}
                    onClick={() => setShowSuggestions(false)}
                    className="flex items-center gap-3 p-3 hover:bg-slate-50 transition-colors"
                  >
                    <img src={getImg(p)} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#0A192F] truncate">{p.name}</p>
                      <p className="text-[11px] text-[#00BFA5] font-bold">₦{Number(p.price || 0).toLocaleString()}</p>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400 px-2 py-0.5 rounded bg-slate-100 shrink-0">
                      {p.category || 'General'}
                    </span>
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="w-full text-center py-2.5 text-xs font-bold text-[#00BFA5] hover:bg-[#00BFA5]/5 transition-colors cursor-pointer"
                >
                  View all results for &quot;{searchQuery}&quot; →
                </button>
              </div>
            )}
          </div>

          {/* Action Utilities */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Compare Products */}
            <Link
              to="/compare"
              className="relative p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 hover:text-[#0A192F] transition-colors hidden sm:flex items-center justify-center"
              title="Compare Products"
            >
              <Scale className="w-5 h-5 text-slate-600" />
              {totalCompareCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] font-extrabold flex items-center justify-center">
                  {totalCompareCount}
                </span>
              )}
            </Link>

            {/* Wishlist */}
            <Link
              to="/buyer/wishlist"
              className="relative p-2.5 rounded-xl hover:bg-slate-100 text-slate-700 hover:text-[#0A192F] transition-colors hidden sm:flex items-center justify-center"
              title="Wishlist"
            >
              <Heart className="w-5 h-5 text-slate-600" />
              {totalWishlistCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-extrabold flex items-center justify-center">
                  {totalWishlistCount}
                </span>
              )}
            </Link>

            {/* Cart Drawer Button */}
            <Link
              to="/cart"
              className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-[#0A192F] transition-all relative"
            >
              <div className="relative">
                <ShoppingCart className="w-5 h-5 text-[#0A192F]" />
                {totalCartCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 px-1.5 py-0.2 rounded-full bg-[#00BFA5] text-white text-[10px] font-black">
                    {totalCartCount > 99 ? '99+' : totalCartCount}
                  </span>
                )}
              </div>
              <span className="hidden xl:inline text-xs font-bold text-[#0A192F]">Cart</span>
            </Link>

            {/* Notifications */}
            {currentUser && <NotificationBell />}

            {/* User Account Menu */}
            <div ref={userMenuRef} className="relative">
              {currentUser ? (
                <div>
                  <button
                    onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                    className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 rounded-2xl bg-[#0A192F] hover:bg-[#112240] text-white transition-all cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-xl bg-[#00BFA5] text-white font-bold text-xs flex items-center justify-center shrink-0 uppercase">
                      {currentUser.full_name ? currentUser.full_name[0] : (currentUser.email ? currentUser.email[0] : 'U')}
                    </div>
                    <span className="hidden md:inline text-xs font-bold max-w-[100px] truncate">
                      {currentUser.full_name || currentUser.email?.split('@')[0]}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
                  </button>

                  {/* Dropdown */}
                  {userDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl border border-slate-200 shadow-xl py-2 z-50 divide-y divide-slate-100">
                      <div className="px-4 py-2.5">
                        <p className="text-xs font-bold text-[#0A192F] truncate">
                          {currentUser.full_name || 'My Account'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">{currentUser.email}</p>
                        <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-[#00BFA5]/10 text-[#00BFA5] text-[10px] font-bold uppercase">
                          {currentUser.role || 'Buyer'}
                        </span>
                      </div>

                      <div className="py-1">
                        <Link
                          to={getDashboardPath()}
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0A192F]"
                        >
                          <Layers className="w-4 h-4 text-slate-400" />
                          Dashboard
                        </Link>
                        <Link
                          to="/buyer/orders"
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0A192F]"
                        >
                          <Package className="w-4 h-4 text-slate-400" />
                          My Orders
                        </Link>
                        <Link
                          to="/buyer/wishlist"
                          className="flex items-center gap-2.5 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-[#0A192F]"
                        >
                          <Heart className="w-4 h-4 text-slate-400" />
                          My Wishlist ({totalWishlistCount})
                        </Link>
                      </div>

                      <div className="pt-1">
                        <button
                          onClick={logout}
                          className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <LogOut className="w-4 h-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    to="/login"
                    className="px-3.5 py-2 text-xs font-bold text-[#0A192F] hover:text-[#00BFA5] transition-colors"
                  >
                    Sign In
                  </Link>
                  <Link
                    to="/register"
                    className="hidden sm:inline-flex px-4 py-2 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-xs font-bold shadow-xs transition-all"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>

            {/* Mobile Menu Hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 md:hidden"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="mt-2.5 md:hidden">
          <form onSubmit={handleSearchSubmit} className="flex items-center w-full bg-slate-50 rounded-xl border border-slate-200 px-3 py-2">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, brands, stores..."
              className="w-full text-xs text-slate-800 bg-transparent px-2.5 outline-none font-medium"
            />
          </form>
        </div>
      </div>

      {/* ─── 3. SECONDARY CATEGORY / NAV STRIP ─── */}
      <nav className="hidden md:block bg-slate-50 border-t border-slate-200/80 py-2 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-xs font-bold text-slate-700">
          <div className="flex items-center gap-6 overflow-x-auto py-0.5">
            <Link
              to="/"
              className={`hover:text-[#00BFA5] transition-colors whitespace-nowrap ${location.pathname === '/' ? 'text-[#00BFA5] font-extrabold' : ''}`}
            >
              Home
            </Link>
            <Link
              to="/shop"
              className={`hover:text-[#00BFA5] transition-colors whitespace-nowrap ${location.pathname === '/shop' ? 'text-[#00BFA5] font-extrabold' : ''}`}
            >
              All Products
            </Link>
            <Link
              to="/stores"
              className={`hover:text-[#00BFA5] transition-colors whitespace-nowrap flex items-center gap-1 ${location.pathname === '/stores' ? 'text-[#00BFA5] font-extrabold' : ''}`}
            >
              <Store className="w-3.5 h-3.5 text-[#D9A73A]" />
              Verified Stores
            </Link>
            <Link
              to="/pay-small-small"
              className={`hover:text-[#D9A73A] transition-colors whitespace-nowrap flex items-center gap-1 text-slate-800 ${location.pathname === '/pay-small-small' ? 'text-[#D9A73A] font-extrabold' : ''}`}
            >
              <Zap className="w-3.5 h-3.5 text-[#D9A73A] fill-current" />
              Pay Small Small
            </Link>
            <Link
              to="/track-order"
              className={`hover:text-[#00BFA5] transition-colors whitespace-nowrap flex items-center gap-1 ${location.pathname === '/track-order' ? 'text-[#00BFA5] font-extrabold' : ''}`}
            >
              <Truck className="w-3.5 h-3.5 text-blue-500" />
              Live Order Tracker
            </Link>
          </div>

          <div className="flex items-center gap-3 shrink-0 text-slate-500 text-[11px] font-semibold">
            <span className="flex items-center gap-1 text-emerald-700 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Inspected & Approved Before Payout
            </span>
          </div>
        </div>
      </nav>

      {/* ─── 4. MOBILE DRAWER ─── */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-slate-200 px-5 py-5 space-y-4 shadow-xl">
          <div className="space-y-1 font-bold text-sm text-[#0A192F]">
            <Link to="/" className="block py-2 hover:text-[#00BFA5]">Home Landing</Link>
            <Link to="/shop" className="block py-2 hover:text-[#00BFA5]">Browse Shop</Link>
            <Link to="/stores" className="block py-2 hover:text-[#00BFA5]">Verified Stores</Link>
            <Link to="/pay-small-small" className="block py-2 text-[#D9A73A]">⚡ Pay Small Small (PSS)</Link>
            <Link to="/track-order" className="block py-2 hover:text-[#00BFA5]">📦 Track Consignment</Link>
            <Link to="/compare" className="block py-2 hover:text-[#00BFA5]">⚖️ Compare Products ({totalCompareCount})</Link>
            <Link to="/buyer/wishlist" className="block py-2 hover:text-[#00BFA5]">❤️ Wishlist ({totalWishlistCount})</Link>
            <Link to="/vendor-application" className="block py-2 text-emerald-700 font-extrabold">🚀 Become a Vendor</Link>
          </div>

          <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
            {currentUser ? (
              <>
                <Link
                  to={getDashboardPath()}
                  className="w-full text-center py-2.5 rounded-xl bg-[#0A192F] text-white text-xs font-bold"
                >
                  My Dashboard
                </Link>
                <button
                  onClick={logout}
                  className="w-full text-center py-2 text-xs font-bold text-rose-600"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <Link
                  to="/login"
                  className="flex-1 text-center py-2.5 rounded-xl bg-slate-100 text-[#0A192F] text-xs font-bold"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="flex-1 text-center py-2.5 rounded-xl bg-[#0A192F] text-white text-xs font-bold"
                >
                  Register
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 5. MOBILE BOTTOM APP BAR (Fixed for app-like experience) ─── */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-3 py-2 flex items-center justify-around shadow-lg">
        <Link to="/" className={`flex flex-col items-center gap-1 ${location.pathname === '/' ? 'text-[#00BFA5]' : 'text-slate-500'}`}>
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-bold">Home</span>
        </Link>
        <Link to="/shop" className={`flex flex-col items-center gap-1 ${location.pathname === '/shop' ? 'text-[#00BFA5]' : 'text-slate-500'}`}>
          <Package className="w-5 h-5" />
          <span className="text-[10px] font-bold">Shop</span>
        </Link>
        <Link to="/stores" className={`flex flex-col items-center gap-1 ${location.pathname === '/stores' ? 'text-[#00BFA5]' : 'text-slate-500'}`}>
          <Store className="w-5 h-5" />
          <span className="text-[10px] font-bold">Stores</span>
        </Link>
        <Link to="/cart" className={`flex flex-col items-center gap-1 relative ${location.pathname === '/cart' ? 'text-[#00BFA5]' : 'text-slate-500'}`}>
          <div className="relative">
            <ShoppingCart className="w-5 h-5" />
            {totalCartCount > 0 && (
              <span className="absolute -top-1.5 -right-2 px-1 py-0.2 rounded-full bg-[#00BFA5] text-white text-[9px] font-black">
                {totalCartCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold">Cart</span>
        </Link>
        <Link to={currentUser ? getDashboardPath() : '/login'} className={`flex flex-col items-center gap-1 ${location.pathname.startsWith('/buyer') || location.pathname.startsWith('/vendor') || location.pathname.startsWith('/admin') ? 'text-[#00BFA5]' : 'text-slate-500'}`}>
          <User className="w-5 h-5" />
          <span className="text-[10px] font-bold">{currentUser ? 'Account' : 'Login'}</span>
        </Link>
      </div>
    </header>
  );
}