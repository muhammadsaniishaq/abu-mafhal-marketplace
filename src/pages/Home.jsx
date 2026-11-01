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

      {/* ─── 1. ULTRA-MODERN LUXURY HERO SECTION WITH 3D AMBIENT LIGHTING ─── */}
      <section className="relative overflow-hidden mesh-gradient-dark text-white border-b border-white/10 py-16 lg:py-24">
        {/* Ambient Glow Orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#00BFA5]/25 rounded-full blur-[128px] pointer-events-none animate-pulse-slow" />
        <div className="absolute top-1/2 -right-32 w-[32rem] h-[32rem] bg-[#D9A73A]/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-600/15 rounded-full blur-[110px] pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-7">
              {/* Top Trust & Live Delivery Pill */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs text-white">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00BFA5] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#00BFA5]"></span>
                  </span>
                  <span className="font-semibold text-slate-300">Live CBN Escrow Protection Active</span>
                </div>

                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-[#00BFA5]" />
                  <span className="text-slate-300">Ship to:</span>
                  <select
                    value={selectedState.name}
                    onChange={(e) => {
                      const found = DELIVERY_STATES.find(s => s.name === e.target.value);
                      if (found) setSelectedState(found);
                    }}
                    className="bg-transparent font-bold text-white outline-none cursor-pointer hover:text-[#00BFA5] transition-colors"
                  >
                    {DELIVERY_STATES.map(s => (
                      <option key={s.name} value={s.name} className="bg-[#0A192F] text-white">{s.name}</option>
                    ))}
                  </select>
                  <span className="hidden sm:inline text-[11px] text-[#00BFA5] font-semibold">
                    ({selectedState.days})
                  </span>
                </div>
              </div>

              {/* Main Headline */}
              <div className="space-y-3">
                <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-white tracking-tight leading-[1.08]">
                  The Future of <br className="hidden sm:block" />
                  <span className="bg-gradient-to-r from-emerald-400 via-[#00BFA5] to-teal-200 bg-clip-text text-transparent">
                    Zero-Risk Commerce
                  </span>
                  <br />
                  in Nigeria.
                </h1>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-xl">
                  Shop over 15,000+ vetted electronics, fashion, and provisions. Your funds remain locked inside our automated banking escrow vault until your package arrives sealed and approved at your doorstep.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  to="/shop"
                  className="px-8 py-4 rounded-2xl bg-gradient-to-r from-[#00BFA5] to-[#00a896] hover:from-[#00a896] hover:to-[#008f80] text-white font-black text-sm shadow-xl shadow-[#00BFA5]/30 hover:shadow-[#00BFA5]/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2.5"
                >
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  <span>Start Shopping</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
                <Link
                  to="/pay-small-small"
                  className="px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-xl border border-white/20 text-white font-extrabold text-sm transition-all flex items-center gap-2 hover:border-[#D9A73A]/60"
                >
                  <Zap className="w-4 h-4 text-[#D9A73A] fill-current" />
                  <span>Pay Small Small (BNPL)</span>
                </Link>
                <Link
                  to="/stores"
                  className="px-5 py-4 rounded-2xl bg-transparent hover:bg-white/5 text-slate-300 hover:text-white font-semibold text-sm transition-all flex items-center gap-2"
                >
                  <Store className="w-4 h-4 text-slate-400" />
                  <span>Explore Stores</span>
                </Link>
              </div>

              {/* Live Metric Stats Cards with Glassmorphism */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-white/10">
                {[
                  { label: 'Escrow Vault Locked', val: '₦1.8B+', sub: 'Zero fraud rate', color: 'text-[#00BFA5]' },
                  { label: 'Active Catalog', val: '15,000+', sub: '100% Genuine', color: 'text-white' },
                  { label: 'Vetted Merchants', val: '1,200+', sub: 'CAC Verified', color: 'text-amber-400' },
                  { label: 'Coverage', val: '36 States', sub: 'FCT Doorstep', color: 'text-teal-300' }
                ].map(m => (
                  <div key={m.label} className="p-3.5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 space-y-0.5 hover:bg-white/10 transition-colors">
                    <p className={`text-xl sm:text-2xl font-black ${m.color}`}>{m.val}</p>
                    <p className="text-[11px] font-bold text-slate-200">{m.label}</p>
                    <p className="text-[10px] text-slate-400 font-medium">{m.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Showcase: 3D Holographic Escrow Showcase Card */}
            <div className="lg:col-span-5 relative">
              <div className="glow-card rounded-3xl bg-gradient-to-b from-white/10 to-white/[0.03] backdrop-blur-2xl border border-white/20 p-7 sm:p-8 space-y-6 shadow-2xl">
                {/* Vault Status Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#00BFA5]/20 border border-[#00BFA5]/40 flex items-center justify-center text-[#00BFA5]">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-white">Smart Escrow Vault</p>
                      <p className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> 256-Bit Financial Encryption
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-[#00BFA5]/15 text-[#00BFA5] border border-[#00BFA5]/30">
                    ESCROW VERIFIED
                  </span>
                </div>

                {/* Featured Pick Title */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[11px] font-extrabold text-[#D9A73A] uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Prime Spotlight
                    </span>
                    <span className="text-[11px] text-slate-400">Direct from Lagos Hub</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">{FALLBACK_POPULAR[0].name}</h3>
                </div>

                {/* Visual Product Box with Ambient Shadow */}
                <div className="rounded-2xl overflow-hidden aspect-video bg-black/40 border border-white/15 relative group">
                  <img
                    src={FALLBACK_POPULAR[0].image_url}
                    alt={FALLBACK_POPULAR[0].name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07101E] via-transparent to-transparent opacity-80" />
                  
                  {/* Floating Price Tag */}
                  <div className="absolute bottom-3 left-3 bg-[#0A192F]/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/20 shadow-lg">
                    <p className="text-[10px] text-slate-300 font-medium">Vault Release Price</p>
                    <p className="text-xl font-black text-[#00BFA5]">₦{FALLBACK_POPULAR[0].price.toLocaleString()}</p>
                  </div>

                  <div className="absolute top-3 right-3 bg-rose-500/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-white text-[10px] font-black uppercase">
                    Free Delivery
                  </div>
                </div>

                {/* Live Vault Progress Indicator */}
                <div className="p-3.5 rounded-2xl bg-black/30 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#00BFA5]" /> Buyer Protection Protocol
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">100% Guaranteed</span>
                  </div>
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-gradient-to-r from-[#00BFA5] to-emerald-400 h-full w-full rounded-full" />
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Payment is released to vendor ONLY when you inspect and confirm receipt.
                  </p>
                </div>

                {/* Card CTA */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      addToCart(FALLBACK_POPULAR[0], 1);
                      showToast('Item added to cart!');
                    }}
                    className="flex-1 py-3 rounded-xl bg-[#00BFA5] hover:bg-[#00a896] text-white text-xs font-black transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Instant Secure Order
                  </button>
                  <Link
                    to={`/product/${FALLBACK_POPULAR[0].id}`}
                    className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-bold transition-all"
                  >
                    Details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 2. FLASH DEALS WITH LIVE COUNTDOWN ─── */}
      <section className="py-12 bg-white border-b border-slate-200 relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-600 text-xs font-black uppercase tracking-widest">
                <Zap className="w-3.5 h-3.5 fill-current animate-bounce" />
                Limited-Time Flash Deals
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-[#0A192F]">Today&apos;s Super Discounts</h2>
            </div>

            {/* Countdown Badge */}
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs text-slate-500 font-bold">Deal closes in:</span>
              <div className="flex items-center gap-1.5 font-mono text-xs font-black">
                <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-rose-400 border border-rose-500/30 shadow-xs">
                  {String(timeLeft.hours).padStart(2, '0')}h
                </span>
                <span className="text-slate-400 font-bold">:</span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-rose-400 border border-rose-500/30 shadow-xs">
                  {String(timeLeft.minutes).padStart(2, '0')}m
                </span>
                <span className="text-slate-400 font-bold">:</span>
                <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-rose-400 border border-rose-500/30 shadow-xs">
                  {String(timeLeft.seconds).padStart(2, '0')}s
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {flashDeals.map((item, idx) => (
              <div key={item.id || idx} className="rounded-3xl border border-slate-200 bg-white hover:border-[#00BFA5]/60 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-4 space-y-3.5 flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden aspect-square bg-slate-100 border border-slate-100">
                    <img src={item.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-gradient-to-r from-rose-600 to-rose-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                      Save 15%
                    </span>
                    <button
                      onClick={() => toggleWishlistHandler(item)}
                      className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 backdrop-blur-xs flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm transition-transform active:scale-90 ${
                        isWishlisted(item.id) ? 'text-rose-600' : ''
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isWishlisted(item.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-extrabold text-[#00BFA5] uppercase tracking-wider">{item.category}</p>
                    <h4 className="text-xs font-bold text-[#0A192F] line-clamp-2 group-hover:text-[#00BFA5] transition-colors">{item.name}</h4>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-black text-[#0A192F]">₦{Number(item.price).toLocaleString()}</span>
                    {item.compare_at_price && (
                      <span className="text-[11px] text-slate-400 line-through">₦{Number(item.compare_at_price).toLocaleString()}</span>
                    )}
                  </div>

                  {/* Stock Progress Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200/50">
                      <div className="bg-gradient-to-r from-rose-500 to-amber-500 h-2 rounded-full" style={{ width: `${60 + (idx * 10)}%` }} />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                      <span>Live Claim</span>
                      <span className="text-rose-600 font-bold">{60 + (idx * 10)}% sold</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    addToCart(item, 1);
                    showToast('Added to cart!');
                  }}
                  className="w-full py-3 rounded-xl bg-[#0A192F] hover:bg-[#00BFA5] text-white text-xs font-extrabold transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-95"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Claim Deal Now
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 3. CATEGORY SHOWCASE GRID ─── */}
      <section className="py-12 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-extrabold uppercase text-[#00BFA5] tracking-wider">Browse by Department</span>
              <h2 className="text-2xl font-black text-[#0A192F]">Curated Market Categories</h2>
            </div>
            <Link to="/shop" className="text-xs font-bold text-[#00BFA5] hover:text-[#0A192F] flex items-center gap-1">
              View All Categories <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3.5">
            {MARKET_CATEGORIES.map(cat => (
              <Link
                key={cat.name}
                to={`/shop?category=${encodeURIComponent(cat.name)}`}
                className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-[#00BFA5] hover:shadow-lg hover:-translate-y-1 transition-all text-center space-y-2 group"
              >
                <div className="text-3xl mb-1 group-hover:scale-125 transition-transform duration-300">{cat.icon}</div>
                <h4 className="text-xs font-bold text-[#0A192F] leading-tight line-clamp-1">{cat.name}</h4>
                <p className="text-[10px] text-slate-400 font-semibold">{cat.count}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 4. PAY SMALL SMALL (PSS) BANNER ─── */}
      <section className="py-10 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="relative rounded-3xl bg-gradient-to-r from-amber-500 via-[#D9A73A] to-amber-600 p-8 sm:p-12 text-slate-950 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-8 overflow-hidden">
            <div className="space-y-3 max-w-xl relative z-10">
              <span className="inline-block px-3 py-1 rounded-full bg-slate-950 text-white text-[10px] font-black uppercase tracking-widest shadow-xs">
                Buy Now Pay Later (BNPL)
              </span>
              <h3 className="text-2xl sm:text-4xl font-black text-slate-950 leading-tight">
                Pay Small Small (PSS) — 0% Interest Installments
              </h3>
              <p className="text-xs sm:text-sm font-semibold text-slate-900/90 leading-relaxed">
                Pay 25% down today on gadgets, laptops, phones, and fashion. Split the balance across 4 flexible weekly payouts with zero hidden charges. Item is reserved in escrow immediately!
              </p>
            </div>

            <Link
              to="/pay-small-small"
              className="px-8 py-4 rounded-2xl bg-slate-950 hover:bg-slate-900 text-white font-black text-xs sm:text-sm shrink-0 shadow-2xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <Zap className="w-4 h-4 text-[#D9A73A] fill-current" />
              <span>Calculate Payment Plan</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 5. POPULAR & TRENDING PRODUCTS ─── */}
      <section className="py-12 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs font-extrabold uppercase text-[#00BFA5] tracking-wider">Top Verified Catalog</span>
              <h2 className="text-2xl font-black text-[#0A192F]">Trending Marketplace Items</h2>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto py-1">
              {['All', 'Phones', 'Electronics', 'Computing', 'Fashion'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveCategoryTab(tab)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeCategoryTab === tab
                      ? 'bg-[#0A192F] text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {filteredProducts.map(p => (
              <div key={p.id} className="rounded-3xl border border-slate-200/90 bg-white hover:border-[#00BFA5]/60 hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 p-4 space-y-3.5 flex flex-col justify-between group">
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden aspect-square bg-slate-50 border border-slate-100">
                    <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    <button
                      onClick={() => toggleWishlistHandler(p)}
                      className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/95 backdrop-blur-xs flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-sm transition-transform active:scale-90 ${
                        isWishlisted(p.id) ? 'text-rose-600' : ''
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isWishlisted(p.id) ? 'fill-current' : ''}`} />
                    </button>
                    <button
                      onClick={() => setQuickViewProduct(p)}
                      className="absolute bottom-2.5 left-2.5 px-3 py-1.5 rounded-xl bg-[#0A192F]/85 hover:bg-[#0A192F] text-white text-[10px] font-bold backdrop-blur-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 shadow-md"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#00BFA5]" /> Quick Preview
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-extrabold text-[#00BFA5] uppercase tracking-wider">{p.category || 'Item'}</span>
                      <span className="flex items-center gap-1 text-slate-500 font-medium">
                        <MapPin className="w-2.5 h-2.5 text-[#00BFA5]" />
                        {p.seller_state}
                      </span>
                    </div>
                    <Link to={`/product/${p.id}`} className="block text-xs font-extrabold text-[#0A192F] hover:text-[#00BFA5] transition-colors line-clamp-2 leading-relaxed">
                      {p.name}
                    </Link>
                  </div>

                  <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    <span>{p.rating || 4.9}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({p.reviews_count || 34})</span>
                  </div>

                  <div className="flex items-baseline gap-2 pt-0.5">
                    <span className="text-base font-black text-[#0A192F]">₦{Number(p.price).toLocaleString()}</span>
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
                    className="flex-1 py-2.5 rounded-xl bg-[#0A192F] hover:bg-[#00BFA5] text-white text-xs font-extrabold transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
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
                    <Scale className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 text-center">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-900 font-extrabold text-xs shadow-xs transition-all"
            >
              <span>Explore All 15,000+ Items in Shop</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── 6. INTERACTIVE CONSIGNMENT TRACKING WIDGET ─── */}
      <section className="py-12 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl bg-slate-50 border border-slate-200 p-6 sm:p-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#00BFA5]/10 flex items-center justify-center text-[#00BFA5]">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-[#0A192F]">Live Consignment & Waybill Tracker</h3>
                <p className="text-xs text-slate-500">Track shipments across Nigeria with real-time waypoint telemetry.</p>
              </div>
            </div>

            <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={trackQuery}
                onChange={(e) => setTrackQuery(e.target.value)}
                placeholder="Enter Order ID or Consignment Number (e.g. ORD-981240)..."
                className="flex-1 text-xs px-4 py-3 rounded-2xl border border-slate-200 bg-white focus:outline-none focus:border-[#00BFA5]"
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-[#00BFA5] hover:bg-[#00a896] text-white text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Track Now
              </button>
            </form>

            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-2 border-t border-slate-200/60">
              <span className="flex items-center gap-1.5 font-semibold text-[#0A192F]">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Live GPS Milestones
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-semibold text-[#0A192F]">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                Escrow Locked until Delivery
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-semibold text-[#0A192F]">
                <Phone className="w-4 h-4 text-amber-600" />
                Dedicated Rider Dispatch
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 7. WHY CHOOSE ABU MAFHAL PILLARS ─── */}
      <section className="py-14 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <span className="text-xs font-extrabold uppercase text-[#00BFA5] tracking-widest">Marketplace Standards</span>
            <h2 className="text-3xl font-black text-[#0A192F]">Why Nigeria Trusts Abu Mafhal</h2>
            <p className="text-xs text-slate-500">Built to eliminate online purchase fraud with bank-grade security protocols.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUE_PILLARS.map(p => (
              <div key={p.title} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
                <div className={`w-12 h-12 rounded-2xl ${p.bg} ${p.border} border flex items-center justify-center ${p.color}`}>
                  <p.icon className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-extrabold text-[#0A192F]">{p.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-bold text-[#00BFA5]">
            <button onClick={() => openPolicy('escrow')} className="hover:underline cursor-pointer">
              Read 100% Escrow Policy →
            </button>
            <span>•</span>
            <button onClick={() => openPolicy('returns')} className="hover:underline cursor-pointer">
              Read 7-Day Refund Safe Harbor →
            </button>
            <span>•</span>
            <button onClick={() => openPolicy('merchants')} className="hover:underline cursor-pointer">
              Read Merchant Vetting Standards →
            </button>
          </div>
        </div>
      </section>

      {/* ─── 8. BECOME A VENDOR PROMOTION ─── */}
      <section className="py-12 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="rounded-3xl bg-gradient-to-br from-[#0A192F] to-[#112240] p-8 sm:p-12 text-white flex flex-col md:flex-row md:items-center justify-between gap-8 shadow-xl">
            <div className="space-y-3 max-w-xl">
              <span className="px-3 py-1 rounded-full bg-[#00BFA5]/20 text-[#00BFA5] text-[10px] font-black uppercase tracking-widest">
                Merchant Opportunity
              </span>
              <h3 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                Sell to 50,000+ Verified Buyers Across Nigeria
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Open your verified online storefront on Abu Mafhal with zero setup fees. Enjoy automatic payouts, nationwide logistics dispatch, and fraud-free escrow settlements.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <Link
                to="/vendor-application"
                className="px-8 py-3.5 rounded-2xl bg-[#00BFA5] hover:bg-[#00a896] text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-[#00BFA5]/25 transition-all text-center"
              >
                Apply as a Merchant
              </Link>
              <Link
                to="/stores"
                className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm transition-all text-center"
              >
                View Active Stores
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}