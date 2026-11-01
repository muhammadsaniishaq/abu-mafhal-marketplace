import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import { supabase } from '../config/supabase';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useComparison } from '../context/ComparisonContext';
import {
  Search, ShoppingCart, Heart, ShieldCheck, Truck, Star,
  Zap, ArrowRight, CheckCircle2, ChevronRight, Package,
  Store, Clock, AlertCircle, RefreshCw, Eye, Sparkles,
  Phone, HelpCircle, Lock, Award, Building2, MapPin,
  Check, X, Scale
} from 'lucide-react';

// Nigerian Destination Delivery States
const DELIVERY_STATES = [
  { name: 'Abuja (FCT)', days: 'Same-day or 24-hr Air Express' },
  { name: 'Lagos', days: '24 to 48-hr Express Cargo' },
  { name: 'Kano', days: '24-hr Regional Transit' },
  { name: 'Kaduna', days: '24-hr Direct Road Freight' },
  { name: 'Port Harcourt', days: '48-hr Doorstep Cargo' },
  { name: 'Ibadan', days: '24 to 48-hr Logistics' },
  { name: 'Yobe / Damaturu', days: 'Same-day Local Dispatch' },
  { name: 'Maiduguri', days: '24-hr Regional Transit' }
];

// Market Categories
const MARKET_CATEGORIES = [
  { name: 'Phones & Tablets', count: '1,420+ items', icon: '📱', color: 'from-blue-500/10 to-indigo-500/10' },
  { name: 'Electronics & Audio', count: '2,150+ items', icon: '🎧', color: 'from-teal-500/10 to-emerald-500/10' },
  { name: 'Computing & Laptops', count: '980+ items', icon: '💻', color: 'from-purple-500/10 to-pink-500/10' },
  { name: 'Fashion & Apparel', count: '3,840+ items', icon: '👔', color: 'from-amber-500/10 to-orange-500/10' },
  { name: 'Beauty & Personal Care', count: '1,210+ items', icon: '✨', color: 'from-rose-500/10 to-pink-500/10' },
  { name: 'Home & Kitchen', count: '2,630+ items', icon: '🍳', color: 'from-emerald-500/10 to-teal-500/10' },
  { name: 'Groceries & Provisions', count: '1,890+ items', icon: '🥫', color: 'from-cyan-500/10 to-blue-500/10' },
  { name: 'Automobiles & Spares', count: '740+ items', icon: '🚗', color: 'from-slate-500/10 to-slate-700/10' }
];

// Why Choose Us Pillars
const VALUE_PILLARS = [
  {
    icon: ShieldCheck,
    title: '100% Escrow Protection Vault',
    desc: 'Buyer funds remain locked in an independent banking escrow vault until you physically inspect and approve your order.',
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200'
  },
  {
    icon: Award,
    title: 'CAC & KYC Vetted Merchants',
    desc: 'Every seller undergoes stringent background authentication via government CAC registration and physical inventory inspection.',
    color: 'text-[#00BFA5]',
    bg: 'bg-teal-50',
    border: 'border-teal-200'
  },
  {
    icon: Truck,
    title: '36 States Doorstep Logistics',
    desc: 'Priority air and road freight partners delivering to all 36 Nigerian states and FCT with live waypoint GPS tracking.',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200'
  },
  {
    icon: RefreshCw,
    title: '7-Day Free Returns & Refunds',
    desc: 'Dispute arbitration guarantees prompt reimbursement if goods arrive damaged, non-genuine, or delayed.',
    color: 'text-[#D9A73A]',
    bg: 'bg-amber-50',
    border: 'border-amber-200'
  }
];

// Fallback Products
const FALLBACK_POPULAR = [
  {
    id: 'p-1',
    name: 'Apple iPhone 15 Pro Max 256GB Natural Titanium',
    price: 1250000,
    compare_at_price: 1450000,
    category: 'Phones & Tablets',
    rating: 4.9,
    reviews_count: 88,
    seller_name: 'Apex Digital Hub',
    seller_state: 'Lagos',
    image_url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500&auto=format&fit=crop'
  },
  {
    id: 'p-2',
    name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
    price: 360000,
    compare_at_price: 420000,
    category: 'Electronics & Audio',
    rating: 4.8,
    reviews_count: 64,
    seller_name: 'SoundWave Electronics',
    seller_state: 'Abuja',
    image_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=500&auto=format&fit=crop'
  },
  {
    id: 'p-3',
    name: 'MacBook Air 15-inch M2 8-Core CPU 512GB SSD Midnight',
    price: 1380000,
    compare_at_price: 1550000,
    category: 'Computing & Laptops',
    rating: 5.0,
    reviews_count: 42,
    seller_name: 'Pro Gadget Store',
    seller_state: 'Kano',
    image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&auto=format&fit=crop'
  },
  {
    id: 'p-4',
    name: 'Nike Air Jordan 1 Retro High Chicago OG Edition',
    price: 95000,
    compare_at_price: 120000,
    category: 'Fashion & Apparel',
    rating: 4.7,
    reviews_count: 110,
    seller_name: 'Kano Sneaker Vault',
    seller_state: 'Kano',
    image_url: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=500&auto=format&fit=crop'
  }
];

export default function Home() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { addToCart } = useCart();
  const { wishlistItems, addToWishlist, removeFromWishlist } = useWishlist();
  const { comparisonItems, addToComparison } = useComparison ? useComparison() : { comparisonItems: [], addToComparison: () => {} };

  const [products, setProducts] = useState(FALLBACK_POPULAR);
  const [flashDeals, setFlashDeals] = useState([]);
  const [activeCategoryTab, setActiveCategoryTab] = useState('All');
  const [selectedState, setSelectedState] = useState(DELIVERY_STATES[0]);
  const [trackQuery, setTrackQuery] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  // Policy Modal State
  const [policyModal, setPolicyModal] = useState({ open: false, title: '', content: '' });

  // Flash Sale Countdown Timer
  const [timeLeft, setTimeLeft] = useState({ hours: 14, minutes: 35, seconds: 20 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 24, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch live products
  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*, profiles:vendor_id(business_name, full_name, is_verified, state)')
          .order('created_at', { ascending: false })
          .limit(12);

        if (!error && data && data.length > 0) {
          const mapped = data.map(p => ({
            ...p,
            seller_name: p.profiles?.business_name || p.profiles?.full_name || 'Verified Merchant',
            seller_state: p.profiles?.state || 'Nigeria',
            image_url: p.image_url || (Array.isArray(p.images) ? p.images[0] : null) || FALLBACK_POPULAR[0].image_url
          }));
          setProducts(mapped);
          setFlashDeals(mapped.slice(0, 4));
        }
      } catch (_) {}
    }
    fetchProducts();
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleTrackSubmit = (e) => {
    e.preventDefault();
    if (!trackQuery.trim()) return;
    navigate(`/track-order?ref=${encodeURIComponent(trackQuery.trim())}`);
  };

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

  const filteredProducts = activeCategoryTab === 'All'
    ? products
    : products.filter(p => p.category?.toLowerCase().includes(activeCategoryTab.toLowerCase()));

  const openPolicy = (type) => {
    if (type === 'escrow') {
      setPolicyModal({
        open: true,
        title: '100% Escrow Protection Protocol',
        content: 'Every transaction on Abu Mafhal is safeguarded by bank-grade escrow. When you make a payment, the funds are held securely in a CBN-licensed account and are ONLY transferred to the seller after your package arrives, and you verify that items are in perfect condition.'
      });
    } else if (type === 'returns') {
      setPolicyModal({
        open: true,
        title: '7-Day Return & Rapid Refund Guarantee',
        content: 'If your purchase arrives damaged, incomplete, or significantly different from description, open a 1-click dispute on your dashboard. Our arbitration team reviews cases within 24 hours to issue instant refunds to your original payment method.'
      });
    } else if (type === 'merchants') {
      setPolicyModal({
        open: true,
        title: 'Vetted & Verified Merchant Standards',
        content: 'All sellers on Abu Mafhal submit government-issued identification (CAC certificate, NIN or BVN verification) and agree to our strict authenticity pledge before listing catalog items.'
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <Navbar />

      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-16 sm:bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-[#0A192F] text-white text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-[#00BFA5]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl animate-in zoom-in-95">
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
                  {quickViewProduct.compare_at_price && (
                    <p className="text-xs text-slate-400 line-through">₦{Number(quickViewProduct.compare_at_price).toLocaleString()}</p>
                  )}
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
                    className="px-4 py-3 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white text-xs font-bold"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Policy Modal */}
      {policyModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-base text-[#0A192F]">{policyModal.title}</h3>
              <button onClick={() => setPolicyModal({ open: false, title: '', content: '' })} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{policyModal.content}</p>
            <div className="pt-2 text-right">
              <button
                onClick={() => setPolicyModal({ open: false, title: '', content: '' })}
                className="px-5 py-2 rounded-xl bg-[#0A192F] text-white text-xs font-bold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 1. SPOTLESS MODERN HERO ─── */}
      <section className="relative overflow-hidden bg-white border-b border-slate-100 py-12 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10 text-center space-y-6 max-w-4xl">
          {/* Escrow Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-xs font-extrabold text-emerald-800 shadow-xs">
            <ShieldCheck className="w-4 h-4 text-[#00BFA5]" />
            <span>100% Escrow Protection • 36 States Express Delivery</span>
          </div>

          {/* Clean Modern Headline */}
          <h1 className="text-4xl sm:text-6xl font-black text-[#0A192F] tracking-tight leading-[1.1]">
            The Modern Marketplace for <br className="hidden sm:inline" />
            <span className="text-[#00BFA5]">Authentic Items</span> in Nigeria.
          </h1>

          <p className="text-sm sm:text-base text-slate-500 max-w-2xl mx-auto font-normal leading-relaxed">
            Shop directly from verified merchants. Your money stays safely locked inside an escrow vault until your package arrives sealed and approved at your doorstep.
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              to="/shop"
              className="px-8 py-3.5 rounded-xl bg-[#00BFA5] hover:bg-[#00a896] text-white font-extrabold text-sm shadow-md shadow-[#00BFA5]/25 hover:shadow-lg transition-all flex items-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Explore Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to="/stores"
              className="px-6 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0A192F] font-bold text-sm transition-all"
            >
              Browse Verified Stores
            </Link>
            <Link
              to="/pay-small-small"
              className="px-5 py-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-bold text-sm transition-all flex items-center gap-1.5"
            >
              <Zap className="w-4 h-4 text-amber-600 fill-current" />
              <span>Pay Small Small (BNPL)</span>
            </Link>
          </div>

          {/* Category Chips Carousel */}
          <div className="pt-8 flex items-center justify-center gap-2 overflow-x-auto py-2">
            {MARKET_CATEGORIES.map(cat => (
              <Link
                key={cat.name}
                to={`/shop?category=${encodeURIComponent(cat.name)}`}
                className="px-4 py-2 rounded-xl bg-slate-50 hover:bg-white hover:border-[#00BFA5] border border-slate-200/80 text-xs font-bold text-slate-700 whitespace-nowrap transition-all shadow-2xs flex items-center gap-1.5"
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 2. LIMITED TIME FLASH DEALS ─── */}
      <section className="py-10 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-1.5 text-rose-600 text-xs font-black uppercase tracking-wider">
                <Zap className="w-3.5 h-3.5 fill-current" />
                Limited Super Deals
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0A192F]">Flash Discounts</h2>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-bold">Ends in:</span>
              <div className="flex items-center gap-1 font-mono text-xs font-black">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-rose-400">
                  {String(timeLeft.hours).padStart(2, '0')}h
                </span>
                <span>:</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-rose-400">
                  {String(timeLeft.minutes).padStart(2, '0')}m
                </span>
                <span>:</span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-rose-400">
                  {String(timeLeft.seconds).padStart(2, '0')}s
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {flashDeals.map((item, idx) => (
              <div key={item.id || idx} className="rounded-2xl border border-slate-200 bg-white hover:border-[#00BFA5] hover:shadow-lg transition-all p-3.5 space-y-3 flex flex-col justify-between group">
                <div className="space-y-2.5">
                  <div className="relative rounded-xl overflow-hidden aspect-square bg-slate-50 border border-slate-100">
                    <img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase">
                      Save 15%
                    </span>
                    <button
                      onClick={() => toggleWishlistHandler(item)}
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-xs ${
                        isWishlisted(item.id) ? 'text-rose-600' : ''
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isWishlisted(item.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#00BFA5] uppercase">{item.category}</p>
                    <h4 className="text-xs font-bold text-[#0A192F] line-clamp-2">{item.name}</h4>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-black text-[#0A192F]">₦{Number(item.price).toLocaleString()}</span>
                    {item.compare_at_price && (
                      <span className="text-[11px] text-slate-400 line-through">₦{Number(item.compare_at_price).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    addToCart(item, 1);
                    showToast('Added to cart!');
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#0A192F] hover:bg-[#00BFA5] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Claim Deal
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 3. VERIFIED TRENDING PRODUCTS ─── */}
      <section className="py-12 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0A192F]">Marketplace Catalog</h2>
              <p className="text-xs text-slate-500">Authenticated merchandise protected by buyer escrow</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              {['All', 'Phones', 'Electronics', 'Computing', 'Fashion'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveCategoryTab(tab)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeCategoryTab === tab
                      ? 'bg-[#00BFA5] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map(p => (
              <div key={p.id} className="rounded-2xl border border-slate-200 bg-white hover:border-[#00BFA5] hover:shadow-lg transition-all p-3.5 space-y-3 flex flex-col justify-between group">
                <div className="space-y-2.5">
                  <div className="relative rounded-xl overflow-hidden aspect-square bg-slate-50 border border-slate-100">
                    <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <button
                      onClick={() => toggleWishlistHandler(p)}
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-xs ${
                        isWishlisted(p.id) ? 'text-rose-600' : ''
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isWishlisted(p.id) ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => setQuickViewProduct(p)}
                      className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-white/90 hover:bg-white text-[#0A192F] text-[10px] font-bold shadow-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3 text-[#00BFA5]" /> Preview
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-bold uppercase text-[#00BFA5]">{p.category || 'Item'}</span>
                      <span className="text-slate-500">{p.seller_state}</span>
                    </div>
                    <Link to={`/product/${p.id}`} className="block text-xs font-extrabold text-[#0A192F] hover:text-[#00BFA5] transition-colors line-clamp-2">
                      {p.name}
                    </Link>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{p.rating || 4.9}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({p.reviews_count || 18})</span>
                  </div>

                  <div className="flex items-baseline gap-2 pt-0.5">
                    <span className="text-base font-black text-[#0A192F]">₦{Number(p.price).toLocaleString()}</span>
                    {p.compare_at_price && (
                      <span className="text-xs text-slate-400 line-through">₦{Number(p.compare_at_price).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => {
                      addToCart(p, 1);
                      showToast('Added to cart!');
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#00BFA5] hover:bg-[#00a896] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Add to Cart
                  </button>
                  <button
                    onClick={() => {
                      addToComparison(p);
                      showToast('Added to comparison');
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-[#00BFA5] hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                    title="Compare"
                  >
                    <Scale className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 text-center">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs shadow-xs transition-all"
            >
              <span>Explore All 15,000+ Items</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 4. INSTANT ORDER TRACKER STRIP ─── */}
      <section className="py-12 bg-slate-50 border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#00BFA5]/10 text-[#00BFA5]">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-[#0A192F]">Track Your Shipment Status</h3>
            <p className="text-xs text-slate-500 mt-1">Check real-time milestone dispatch across all 36 Nigerian states.</p>
          </div>

          <form onSubmit={handleTrackSubmit} className="flex gap-2 max-w-lg mx-auto">
            <input
              type="text"
              value={trackQuery}
              onChange={(e) => setTrackQuery(e.target.value)}
              placeholder="Enter Order ID (e.g. ORD-981240)..."
              className="flex-1 text-xs px-4 py-3 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#00BFA5]"
            />
            <button
              type="submit"
              className="px-6 py-3 rounded-xl bg-[#00BFA5] hover:bg-[#00a896] text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              Track Order
            </button>
          </form>
        </div>
      </section>

      <Footer />
    </div>
  );
}