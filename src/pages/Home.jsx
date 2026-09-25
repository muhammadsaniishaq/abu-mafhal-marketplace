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
  Package, CheckCircle2, PhoneCall, HelpCircle, Lock, Shield,
  ChevronDown, ChevronUp, Award, Rocket, Globe, Clock, AlertCircle,
  CreditCard, CheckCircle, ExternalLink, ShieldAlert
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

// Testimonials Data
const TESTIMONIALS = [
  {
    quote: "The 100% Escrow Protection gave me complete peace of mind. The seller shipped my iPhone from Kano to Abuja in 24 hours, and funds were only released when I inspected and approved it!",
    name: "Dr. Aliyu Garba",
    role: "Verified Buyer (Abuja)",
    initials: "AG",
    color: "bg-blue-600",
    rating: 5,
    verified: true
  },
  {
    quote: "Selling on Abu Mafhal transformed our electronics retail business. With verified payouts, instant notifications, and zero chargeback scams, our monthly sales tripled!",
    name: "Hajiya Maryam Bello",
    role: "Verified Gold Merchant",
    initials: "MB",
    color: "bg-amber-600",
    rating: 5,
    verified: true
  },
  {
    quote: "Superb customer care and air cargo tracking. Ordered traditional textiles and smart gadgets; both arrived sealed with authenticity tags. 10/10 recommended.",
    name: "Engr. Tukur Usman",
    role: "Repeat Customer (Kaduna)",
    initials: "TU",
    color: "bg-emerald-600",
    rating: 5,
    verified: true
  },
];

// Ecosystem Cards
const ECOSYSTEM = [
  {
    tag: "MARKETPLACE",
    title: "100% Escrow Marketplace",
    desc: "Shop over 15,000 authentic items with bank-grade 256-bit buyer protection and instant dispute refund safeguards.",
    img: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=600&auto=format&fit=crop",
    link: "/shop",
    badge: "Escrow Protected",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
  },
  {
    tag: "LOGISTICS & CARGO",
    title: "Nationwide Doorstep Dispatch",
    desc: "Priority air & express interstate freight delivering safely to all 36 states and FCT with live GPS dispatch tracking.",
    img: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop",
    link: "/shop",
    badge: "Live GPS Tracking",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
  },
  {
    tag: "VERIFIED VENDORS",
    title: "Vetted Merchant Network",
    desc: "Every seller is KYC-verified with registered CAC credentials and strict product quality warranties before onboarding.",
    img: "https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?q=80&w=600&auto=format&fit=crop",
    link: "/stores",
    badge: "KYC & CAC Verified",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20"
  }
];

// Frequently Asked Questions
const FAQS = [
  {
    q: "How does the Abu Mafhal 100% Escrow Protection work?",
    a: "When you place an order, your payment is held securely in an isolated, CBN-compliant escrow holding vault. The seller prepares and dispatches your order. Only after you receive the item, verify its authentic condition, and approve delivery will funds be released to the seller. If anything is wrong, you receive an immediate full refund."
  },
  {
    q: "How are vendors verified on Abu Mafhal?",
    a: "Every vendor undergoes rigorous multi-tier KYC verification including identity verification (NIN/BVN), physical business address confirmation, CAC business registration checks, and merchant inventory quality vetting."
  },
  {
    q: "How fast is delivery across Nigeria?",
    a: "Orders within major cities (Kano, Abuja, Kaduna, Lagos) arrive within 24 to 48 hours. Nationwide deliveries to other states arrive within 2 to 4 business days via verified priority courier partners with live SMS and tracking updates."
  },
  {
    q: "Can I become a vendor and sell my products here?",
    a: "Yes! Simply click 'Become a Verified Seller' or 'Sell on Abu Mafhal', complete the vendor application form, and our merchant onboarding committee will review and activate your digital storefront within 24 hours."
  },
  {
    q: "What payment methods are supported?",
    a: "We support ATM Debit Cards (Mastercard, Visa, Verve), Bank Transfers to dedicated virtual accounts, USSD, Apple Pay, and digital wallet balances, all secured with 256-bit bank encryption via Paystack and Flutterwave."
  }
];

// Security Features Matrix
const SECURITY_FEATURES = [
  {
    icon: Lock,
    title: "256-Bit Bank Encryption",
    desc: "All transaction traffic, payment tokens, and user credentials use enterprise-grade SSL and end-to-end cryptographic hashing.",
    tag: "Bank-Grade SSL"
  },
  {
    icon: ShieldCheck,
    title: "100% Escrow Protection",
    desc: "Sellers are never paid until you physically receive and confirm your product meets all advertised specifications.",
    tag: "Money-Back Guarantee"
  },
  {
    icon: CheckCircle,
    title: "Vetted KYC Sellers",
    desc: "Zero tolerance for counterfeits. Every seller provides biometric NIN verification and verifiable physical business premises.",
    tag: "CAC & NIN Verified"
  },
  {
    icon: ShieldAlert,
    title: "Fraud Prevention Shield",
    desc: "Continuous automated anomaly detection monitors suspicious transactions and prevents unauthorized account access.",
    tag: "Active 24/7 Defense"
  }
];

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
  const [sortBy, setSortBy] = useState('featured');

  // ── UI INTERACTION STATES ──
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);
  const [addedItemIds, setAddedItemIds] = useState({});
  const [toastMessage, setToastMessage] = useState(null);
  const [openFaqIndex, setOpenFaqIndex] = useState(0);

  // ── TYPED SEARCH HERO PLACEHOLDER ──
  const [typedPlaceholder, setTypedPlaceholder] = useState('');
  const searchPhrases = ['smartphones, laptops, & electronics...', 'modest fashion, abayas, & textiles...', 'solar power systems & batteries...', 'groceries & household essentials...'];
  
  useEffect(() => {
    let phraseIdx = 0;
    let charIdx = 0;
    let isDeleting = false;
    let timer;

    const type = () => {
      const current = searchPhrases[phraseIdx];
      if (isDeleting) {
        setTypedPlaceholder(current.substring(0, charIdx - 1));
        charIdx--;
      } else {
        setTypedPlaceholder(current.substring(0, charIdx + 1));
        charIdx++;
      }

      if (!isDeleting && charIdx === current.length) {
        isDeleting = true;
        timer = setTimeout(type, 2200);
      } else if (isDeleting && charIdx === 0) {
        isDeleting = false;
        phraseIdx = (phraseIdx + 1) % searchPhrases.length;
        timer = setTimeout(type, 400);
      } else {
        timer = setTimeout(type, isDeleting ? 40 : 80);
      }
    };

    timer = setTimeout(type, 500);
    return () => clearTimeout(timer);
  }, []);

  // ── FLASH SALE COUNTDOWN STATE ──
  const [timeLeft, setTimeLeft] = useState({ hours: 14, minutes: 42, seconds: 18 });
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 23, minutes: 59, seconds: 59 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Fetch All Real Data from Supabase
  const fetchLiveMarketplaceData = async () => {
    try {
      setLoading(true);

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

      if (bannersRes.status === 'fulfilled' && bannersRes.value?.data?.length > 0) {
        setBanners(bannersRes.value.data);
      } else {
        setBanners([
          {
            id: 'b-1',
            title: 'Experience Premium Quality & Escrow Protection',
            subtitle: 'Nigeria’s Most Trusted Marketplace for Authentic Electronics, Fashion & Home Living',
            image_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1200&auto=format&fit=crop',
            action_link: '/shop'
          },
          {
            id: 'b-2',
            title: 'Verified Sellers & Safe Doorstep Dispatch',
            subtitle: 'Shop with 100% Peace of Mind — Direct Doorstep Dispatch Across All 36 States',
            image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop',
            action_link: '/shop'
          }
        ]);
      }

      if (categoriesRes.status === 'fulfilled' && categoriesRes.value?.data?.length > 0) {
        setCategories(categoriesRes.value.data);
      } else {
        setCategories([
          { id: '1', name: 'Phones & Tablets' },
          { id: '2', name: 'Fashion & Apparel' },
          { id: '3', name: 'Electronics & Computing' },
          { id: '4', name: 'Shoes & Footwear' },
          { id: '5', name: 'Beauty & Health' },
          { id: '6', name: 'Home & Living' },
        ]);
      }

      if (productsRes.status === 'fulfilled' && productsRes.value?.data?.length > 0) {
        setProducts(productsRes.value.data);
      }
    } catch (err) {
      console.error('Error fetching live marketplace data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLiveMarketplaceData();
  }, []);

  // Filter and Sort Products
  const filteredProducts = useMemo(() => {
    let list = [...products];

    if (selectedCategory !== 'All') {
      list = list.filter(
        (p) => p.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

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

    if (sortBy === 'price-low') {
      list.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === 'price-high') {
      list.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sortBy === 'rating') {
      list.sort((a, b) => Number(b.rating || b.average_rating || 0) - Number(a.rating || a.average_rating || 0));
    }

    return list;
  }, [products, selectedCategory, searchQuery, sortBy]);

  // Handle Quick Add to Cart
  const handleAddToCart = (e, product) => {
    e.preventDefault();
    e.stopPropagation();

    addToCart(product, 1);
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

      {/* ── TOP ANNOUNCEMENT & ESCROW SECURITY STRIP ── */}
      <div className="bg-[#070F1E] text-slate-300 text-[11px] font-medium py-2 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 bg-emerald-950 text-emerald-400 border border-emerald-800/80 px-2.5 py-0.5 rounded-full font-black text-[10px]">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              100% ESCROW PROTECTED
            </span>
            <span className="hidden sm:inline text-slate-400">
              Funds held securely until buyer verifies order satisfaction.
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <Link to="/contact" className="hover:text-amber-400 transition-colors flex items-center gap-1 text-xs">
              <PhoneCall className="w-3 h-3 text-amber-400" /> 24/7 Verified Support
            </Link>
            <span className="hidden sm:inline">•</span>
            <Link to="/vendor-application" className="text-amber-400 font-black hover:underline hidden sm:inline text-xs">
              Become a Verified Seller ➔
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
                placeholder={`Search ${typedPlaceholder}`}
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
              placeholder="Search marketplace..."
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

      {/* ── 1. RESTORED & MODERNIZED HERO SECTION ── */}
      <section className="relative pt-12 pb-20 overflow-hidden bg-gradient-to-b from-[#0A192F] via-[#0E203C] to-[#0A192F] text-white">
        {/* Glow ambient effects */}
        <div className="absolute top-[10%] left-[-5%] w-96 h-96 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[10%] right-[-5%] w-[30rem] h-[30rem] rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-full px-4 py-1.5 text-xs font-bold text-amber-300">
                <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                <span>Nigeria’s Premier Verified Multi-Vendor Ecosystem</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.1] text-white">
                Shop Smart.<br />
                Sell Fast.<br />
                <span className="bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                  Grow Together.
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed font-normal max-w-xl mx-auto lg:mx-0">
                Discover verified products direct from vetted Nigerian merchants. Enjoy 100% Escrow Protection, instant settlements, and nationwide doorstep dispatch you can trust.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 items-center justify-center lg:justify-start pt-2">
                <Link
                  to="/shop"
                  className="inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-300 shadow-xl shadow-amber-500/20 hover:-translate-y-0.5"
                >
                  <span>Start Shopping</span>
                  <ArrowRight className="w-4 h-4 text-slate-950" />
                </Link>

                <Link
                  to="/vendor-application"
                  className="inline-flex items-center justify-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-white border border-slate-700 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-300 hover:-translate-y-0.5"
                >
                  <Store className="w-4 h-4 text-amber-400" />
                  <span>Start Selling</span>
                </Link>
              </div>

              {/* Security Pill Highlights */}
              <div className="flex flex-wrap gap-5 pt-4 border-t border-slate-800/80 justify-center lg:justify-start">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold text-slate-300">256-Bit Escrow Vault</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="text-xs font-bold text-slate-300">Nationwide Air & Express Cargo</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                  <span className="text-xs font-bold text-slate-300">CAC & NIN Vetted Sellers</span>
                </div>
              </div>
            </div>

            {/* Right Interactive Device Showcase */}
            <div className="lg:col-span-5 relative flex justify-center">
              <div className="absolute -top-4 -left-4 w-[20rem] h-[28rem] border-2 border-dashed border-amber-400/20 rounded-[2.8rem] pointer-events-none hidden sm:block" />

              <div className="w-[19rem] sm:w-[21rem] bg-[#070F1E] rounded-[2.8rem] border-[6px] border-slate-800 shadow-2xl p-4 flex flex-col justify-between transition-transform duration-500 hover:scale-[1.02]">
                {/* Phone Speaker Notch */}
                <div className="w-20 h-4 bg-slate-800 rounded-full mx-auto mb-3 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-slate-900" />
                </div>

                {/* Card Live Product Preview */}
                <div className="space-y-3 bg-[#0A192F] p-4 rounded-2xl border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      ESCROW PROTECTED
                    </span>
                    <span className="text-[10px] font-mono text-amber-400 font-bold">₦0 DEPOSIT RISK</span>
                  </div>

                  <div className="w-full h-36 rounded-xl overflow-hidden bg-slate-900 relative">
                    <img
                      src="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=400&auto=format&fit=crop"
                      alt="Product Preview"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-amber-400 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md">
                      SAVE 25%
                    </div>
                  </div>

                  <div>
                    <h5 className="text-xs font-bold text-white">Apple iPhone 15 Pro Max (256GB)</h5>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-black text-amber-400">₦1,450,000</span>
                      <span className="text-[10px] text-slate-400 line-through">₦1,950,000</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Delivery Status:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <Truck className="w-3 h-3" /> Dispatched via Air Cargo
                    </span>
                  </div>
                </div>

                {/* Instant Verification Banner */}
                <div className="mt-3 p-3 rounded-xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-500/30 flex items-center gap-2.5">
                  <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <p className="text-[10px] text-slate-300 leading-tight">
                    Funds released only when buyer confirms order is 100% satisfactory.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 2. VALUE PILLARS (Clean, Crisp & Trust-Building) ── */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 -mt-8 relative z-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-md flex items-center gap-3.5 hover:border-amber-400 transition-all">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Nationwide Delivery</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Doorstep dispatch to 36 states</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-md flex items-center gap-3.5 hover:border-amber-400 transition-all">
            <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">100% Escrow Protected</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Funds held safe until delivery</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-md flex items-center gap-3.5 hover:border-amber-400 transition-all">
            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">Verified KYC Sellers</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Direct from vetted merchants</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-slate-200/80 dark:border-slate-800 shadow-md flex items-center gap-3.5 hover:border-amber-400 transition-all">
            <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
              <PhoneCall className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">24/7 Verified Support</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Real human help on demand</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-10 space-y-12 flex-1">

        {/* ── 3. DEDICATED ESCROW & SECURITY VAULT SECTION ("ya kasance da tsaro") ── */}
        <section className="bg-gradient-to-br from-[#070F1E] via-[#0A192F] to-[#070F1E] rounded-3xl p-6 sm:p-10 border border-slate-800 shadow-2xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className="max-w-2xl space-y-3 mb-8">
            <div className="inline-flex items-center gap-2 bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 text-xs font-black uppercase px-3 py-1 rounded-full">
              <ShieldCheck className="w-4 h-4" />
              <span>Certified Bank-Grade Protection</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white leading-tight">
              Your Money is 100% Protected in Escrow
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              We eliminated fraudulent merchants and delivery scams. On Abu Mafhal, your payment is held safely until you receive, examine, and confirm your items.
            </p>
          </div>

          {/* 4-Step Escrow Timeline Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 relative">
              <span className="text-3xl font-black text-amber-400/30 absolute top-4 right-4">01</span>
              <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center font-black text-sm mb-3">
                <CreditCard className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">1. Deposit into Escrow</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                You place an order and pay securely. Your money stays in our regulated escrow vault — the seller is NOT paid yet.
              </p>
            </div>

            <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 relative">
              <span className="text-3xl font-black text-blue-400/30 absolute top-4 right-4">02</span>
              <div className="w-9 h-9 rounded-xl bg-blue-400/20 text-blue-400 flex items-center justify-center font-black text-sm mb-3">
                <Package className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">2. Merchant Dispatches</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                The seller prepares authentic, inspected goods and dispatches via priority tracking cargo to your doorstep.
              </p>
            </div>

            <div className="bg-slate-900/70 p-5 rounded-2xl border border-slate-800 relative">
              <span className="text-3xl font-black text-purple-400/30 absolute top-4 right-4">03</span>
              <div className="w-9 h-9 rounded-xl bg-purple-400/20 text-purple-400 flex items-center justify-center font-black text-sm mb-3">
                <Truck className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">3. Inspect & Verify</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Receive the item at your door, open, inspect condition, and verify it matches what you ordered.
              </p>
            </div>

            <div className="bg-slate-900/70 p-5 rounded-2xl border border-emerald-500/30 relative bg-emerald-950/20">
              <span className="text-3xl font-black text-emerald-400/30 absolute top-4 right-4">04</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-400/20 text-emerald-400 flex items-center justify-center font-black text-sm mb-3">
                <CheckCircle className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">4. Funds Released</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Once satisfied, confirm receipt in 1 tap and funds are transferred to seller. If not satisfied, receive a full refund.
              </p>
            </div>
          </div>

          {/* 4 Security Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6 border-t border-slate-800">
            {SECURITY_FEATURES.map((sec, idx) => {
              const IconComp = sec.icon;
              return (
                <div key={idx} className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-slate-800 text-amber-400 flex-shrink-0 mt-0.5">
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-white">{sec.title}</h5>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{sec.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 4. LIMITED FLASH SALE WITH LIVE COUNTDOWN ── */}
        <section className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 rounded-3xl p-6 sm:p-8 text-slate-950 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left max-w-xl">
            <div className="inline-flex items-center gap-1.5 bg-slate-950 text-amber-400 text-[10px] font-black uppercase px-3 py-1 rounded-full">
              <Zap className="w-3.5 h-3.5 fill-amber-400 animate-pulse" />
              <span>Limited Time Flash Sale</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black leading-tight">
              Up to 40% OFF Top Electronics & Fashion
            </h3>
            <p className="text-xs sm:text-sm font-semibold opacity-90">
              Verified clearance products with 100% Escrow Protection. Grab deals before timer resets!
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Countdown Box */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-950 text-white rounded-2xl px-3.5 py-2 text-center min-w-[54px] shadow-lg">
                <span className="text-lg font-black font-mono">{String(timeLeft.hours).padStart(2, '0')}</span>
                <span className="block text-[9px] text-slate-400 font-bold uppercase">HRS</span>
              </div>
              <span className="text-xl font-black text-slate-950">:</span>
              <div className="bg-slate-950 text-white rounded-2xl px-3.5 py-2 text-center min-w-[54px] shadow-lg">
                <span className="text-lg font-black font-mono">{String(timeLeft.minutes).padStart(2, '0')}</span>
                <span className="block text-[9px] text-slate-400 font-bold uppercase">MIN</span>
              </div>
              <span className="text-xl font-black text-slate-950">:</span>
              <div className="bg-slate-950 text-white rounded-2xl px-3.5 py-2 text-center min-w-[54px] shadow-lg">
                <span className="text-lg font-black font-mono text-amber-400">{String(timeLeft.seconds).padStart(2, '0')}</span>
                <span className="block text-[9px] text-slate-400 font-bold uppercase">SEC</span>
              </div>
            </div>

            <Link
              to="/shop"
              className="bg-slate-950 hover:bg-slate-900 text-white font-black text-xs px-6 py-3.5 rounded-2xl shadow-xl transition-all hover:scale-105 flex items-center gap-2 whitespace-nowrap"
            >
              <span>Shop Deals Now</span>
              <ArrowRight className="w-4 h-4 text-amber-400" />
            </Link>
          </div>
        </section>

        {/* ── 5. ECOSYSTEM SHOWCASE (Marketplace, Logistics, Verified Stores) ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                The Abu Mafhal Ecosystem
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                An integrated platform built for retail shoppers, corporate merchants, and logistics
              </p>
            </div>
            <Link to="/about" className="text-xs font-bold text-amber-600 hover:underline flex items-center gap-1">
              <span>Learn More</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ECOSYSTEM.map((eco, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
              >
                <div className="relative h-44 overflow-hidden bg-slate-900">
                  <img
                    src={eco.img}
                    alt={eco.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute top-3 left-3">
                    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border backdrop-blur-md bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-white`}>
                      {eco.tag}
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-3 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors">
                      {eco.title}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                      {eco.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${eco.badgeColor}`}>
                      {eco.badge}
                    </span>
                    <Link
                      to={eco.link}
                      className="text-xs font-black text-slate-900 dark:text-white hover:text-amber-500 flex items-center gap-1"
                    >
                      <span>Explore</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 6. LIVE CATEGORIES SELECTOR (Filter Products Instantly) ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Shop by Department
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Filter real inventory from vetted vendors</p>
            </div>
            <button
              onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
              className="text-xs font-bold text-amber-600 hover:text-amber-700 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                selectedCategory === 'All'
                  ? 'bg-[#0A192F] text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>All Products</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-700/30 text-white font-black">
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
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-500/20'
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
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

        {/* ── 7. LIVE PRODUCTS CATALOG (Real Supabase Data Only) ── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                <span>{selectedCategory === 'All' ? 'Verified Marketplace Catalog' : selectedCategory}</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  {filteredProducts.length} items
                </span>
              </h3>
              {searchQuery && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Showing results matching "<span className="text-amber-600 font-bold">{searchQuery}</span>"
                </p>
              )}
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2 text-xs">
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-500 dark:text-slate-400 font-medium">Sort by:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-amber-400 cursor-pointer"
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
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="bg-white dark:bg-slate-900 rounded-3xl p-4 border border-slate-200/70 dark:border-slate-800 shadow-sm animate-pulse space-y-3">
                  <div className="w-full h-44 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
                  <div className="w-2/3 h-4 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="w-1/3 h-3 bg-slate-200 dark:bg-slate-800 rounded" />
                  <div className="w-1/2 h-5 bg-slate-200 dark:bg-slate-800 rounded" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            /* Empty State */
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 max-w-md mx-auto my-8">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-500 flex items-center justify-center mx-auto text-2xl">
                <Package className="w-8 h-8" />
              </div>
              <h4 className="text-base font-black text-slate-900 dark:text-white">No Live Products Found</h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {searchQuery
                  ? `No products match your search "${searchQuery}". Try clearing filters.`
                  : `There are currently no approved products listed under ${selectedCategory}.`}
              </p>
              <button
                onClick={() => { setSelectedCategory('All'); setSearchQuery(''); }}
                className="inline-flex items-center gap-2 bg-[#0A192F] hover:bg-slate-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl transition-all shadow-md cursor-pointer"
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
                    className="bg-white dark:bg-slate-900 rounded-3xl p-3.5 sm:p-4 border border-slate-200/80 dark:border-slate-800 hover:border-amber-400 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between group relative"
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
                      className="absolute top-5 right-5 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-800/90 hover:bg-white text-slate-400 hover:text-rose-500 flex items-center justify-center shadow-md transition-all cursor-pointer"
                      title={isItemInWishlist ? "Remove from wishlist" : "Add to wishlist"}
                    >
                      <Heart
                        className={`w-4 h-4 transition-colors ${
                          isItemInWishlist ? 'fill-rose-500 text-rose-500' : ''
                        }`}
                      />
                    </button>

                    {/* Image Box */}
                    <div className="w-full h-44 sm:h-48 rounded-2xl overflow-hidden bg-slate-50 dark:bg-slate-800/50 flex items-center justify-center p-3 mb-3 relative">
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

                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition-colors line-clamp-2 leading-snug">
                          {product.name}
                        </h4>
                      </div>

                      {/* Stock & Escrow Protection Indicator */}
                      <div className="pt-1 flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold ${
                            inStock ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${inStock ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-0.5">
                          <ShieldCheck className="w-3 h-3" /> Escrow
                        </span>
                      </div>

                      {/* Price & Add to Cart Button */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 mt-2">
                        <div>
                          <p className="text-sm sm:text-base font-black text-slate-950 dark:text-white">
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
                          className={`px-3 py-2 rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
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

        {/* ── 8. GROWTH METRICS & MILESTONES ── */}
        <section className="bg-slate-900 rounded-3xl p-8 sm:p-12 text-white border border-slate-800 text-center">
          <div className="max-w-xl mx-auto space-y-2 mb-8">
            <span className="text-xs font-black text-amber-400 uppercase tracking-widest">
              PROVEN TRACK RECORD
            </span>
            <h3 className="text-2xl sm:text-3xl font-black">
              Trusted by Thousands Across Nigeria
            </h3>
            <p className="text-xs sm:text-sm text-slate-400">
              Numbers that reflect our dedication to speed, security, and authentic merchant trade.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <p className="text-3xl sm:text-4xl font-black text-amber-400 font-mono">50K+</p>
              <p className="text-xs text-slate-400 font-bold uppercase mt-1">Verified Users</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <p className="text-3xl sm:text-4xl font-black text-emerald-400 font-mono">₦2.5B+</p>
              <p className="text-xs text-slate-400 font-bold uppercase mt-1">Volume Processed</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <p className="text-3xl sm:text-4xl font-black text-blue-400 font-mono">36</p>
              <p className="text-xs text-slate-400 font-bold uppercase mt-1">States Covered</p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <p className="text-3xl sm:text-4xl font-black text-purple-400 font-mono">99.9%</p>
              <p className="text-xs text-slate-400 font-bold uppercase mt-1">Escrow Success</p>
            </div>
          </div>
        </section>

        {/* ── 9. VERIFIED CUSTOMER TESTIMONIALS ── */}
        <section className="space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-black text-amber-600 uppercase tracking-widest">
              BUYER & SELLER REVIEWS
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              What Real Users Say
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Honest feedback from shoppers and business owners who rely on Abu Mafhal daily.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic">
                    "{t.quote}"
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${t.color} text-white flex items-center justify-center font-bold text-xs`}>
                    {t.initials}
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1">
                      {t.name}
                      {t.verified && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                    </h5>
                    <p className="text-[11px] text-slate-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 10. FREQUENTLY ASKED QUESTIONS (FAQ Accordion) ── */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-10 border border-slate-200/80 dark:border-slate-800 shadow-sm space-y-6">
          <div className="text-center max-w-xl mx-auto space-y-2">
            <span className="text-xs font-black text-amber-600 uppercase tracking-widest">
              FREQUENTLY ASKED QUESTIONS
            </span>
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              Got Questions? We Have Answers.
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Everything you need to know about shopping, escrow safety, and selling on Abu Mafhal.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full p-4 sm:p-5 flex items-center justify-between text-left font-bold text-xs sm:text-sm text-slate-900 dark:text-white bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-amber-500" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>

                  {isOpen && (
                    <div className="p-4 sm:p-5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 11. SELLER INVITATION BANNER (Verified Vendor Hub) ── */}
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
              className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 px-6 py-3.5 rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 whitespace-nowrap"
            >
              <span>Open Store Now</span>
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link
              to="/shop"
              className="bg-slate-800/80 hover:bg-slate-700 text-white px-5 py-3.5 rounded-2xl font-bold text-xs sm:text-sm border border-slate-700 transition-all whitespace-nowrap"
            >
              Browse Products
            </Link>
          </div>
        </section>

      </main>

      {/* ── 12. COMPREHENSIVE SECURITY & LEGAL FOOTER ── */}
      <footer className="bg-[#070F1E] text-slate-400 border-t border-slate-800/80 mt-12 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          
          {/* Brand & Corporate Credentials */}
          <div className="space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-400 p-1.5 flex items-center justify-center shadow-md">
                <img src={AM_LOGO} alt="" className="w-full h-full object-contain" />
              </div>
              <div>
                <span className="text-base font-black text-white">ABU MAFHAL</span>
                <span className="block text-[9px] font-bold text-amber-400 uppercase tracking-widest">MARKETPLACE</span>
              </div>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Nigeria’s trusted digital marketplace connecting buyers with verified sellers nationwide. Authentic products, 100% secured escrow payments, and swift delivery.
            </p>
            <div className="pt-2 text-[11px] text-slate-500 space-y-1">
              <p>Registered Entity: <span className="text-slate-300 font-bold">ABU MAFHAL LTD</span></p>
              <p>Corporate RC: <span className="text-slate-300 font-bold">RC-8979939</span></p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-white tracking-wider">Quick Navigation</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/shop" className="hover:text-amber-400 transition-colors">Marketplace Catalog</Link></li>
              <li><Link to="/stores" className="hover:text-amber-400 transition-colors">Verified Merchant Stores</Link></li>
              <li><Link to="/buyer/orders" className="hover:text-amber-400 transition-colors">Track Active Orders</Link></li>
              <li><Link to="/vendor-application" className="hover:text-amber-400 transition-colors">Become a Seller</Link></li>
              <li><Link to="/cart" className="hover:text-amber-400 transition-colors">Shopping Cart</Link></li>
            </ul>
          </div>

          {/* Customer Care & Security */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-white tracking-wider">Support & Safety</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/contact" className="hover:text-amber-400 transition-colors">Help Center & Disputes</Link></li>
              <li><Link to="/terms" className="hover:text-amber-400 transition-colors">Terms & Escrow Policy</Link></li>
              <li><Link to="/privacy" className="hover:text-amber-400 transition-colors">NDPR Privacy Compliance</Link></li>
              <li><Link to="/about" className="hover:text-amber-400 transition-colors">About Abu Mafhal</Link></li>
            </ul>
          </div>

          {/* Verified Payment Partners & Badges */}
          <div className="space-y-3">
            <h4 className="text-xs font-black uppercase text-white tracking-wider">Security & Guarantee</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              All transactions are secured with 256-bit bank encryption via CBN-licensed payment institutions.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="px-2.5 py-1 bg-slate-800 text-[10px] font-bold text-slate-300 rounded-lg border border-slate-700">Paystack Verified</span>
              <span className="px-2.5 py-1 bg-slate-800 text-[10px] font-bold text-slate-300 rounded-lg border border-slate-700">Flutterwave</span>
              <span className="px-2.5 py-1 bg-slate-800 text-[10px] font-bold text-slate-300 rounded-lg border border-slate-700">PCI-DSS Level 1</span>
              <span className="px-2.5 py-1 bg-emerald-950 text-[10px] font-bold text-emerald-400 rounded-lg border border-emerald-800">100% Escrow</span>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Abu Mafhal Ltd. All rights reserved. Registered under Nigerian Corporate Law.</p>
          <p className="text-[11px] text-amber-500 font-bold">Your Marketplace, Guaranteed Safe.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;