import React, { useState, useEffect } from 'react';
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
  Phone, HelpCircle, Lock, Award, MapPin, Check, X,
  Scale, MessageCircle, Send, CheckCircle, ChevronDown
} from 'lucide-react';

// Live Ticker items matching mobile
const LIVE_TICKER_TEXT = "LIVE ESCROW VAULT ACTIVE • ₦2.5B+ SECURED • 24H EXPRESS TRANSIT • 100% VERIFIED MERCHANTS";

// Value pillars matching mobile WHY_CHOOSE_US
const WHY_CHOOSE_US = [
  {
    id: 1,
    icon: ShieldCheck,
    title: '100% Escrow Protection',
    desc: 'Buyer funds are safeguarded in an independent vault. Payment is released only after you verify satisfaction.',
    color: '#10B981',
    bgColor: '#ECFDF5',
    borderColor: '#A7F3D0'
  },
  {
    id: 2,
    icon: Lock,
    title: 'Bank-Grade Payment Gateways',
    desc: 'Seamless transactions secured by CBN-licensed financial channels (Paystack, Flutterwave, Monnify).',
    color: '#D9A73A',
    bgColor: '#FEF3C7',
    borderColor: '#FDE68A'
  },
  {
    id: 3,
    icon: Award,
    title: 'Identity-Verified Merchants',
    desc: 'Every seller undergoes stringent background authentication via government CAC registration or NIN credentials.',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    borderColor: '#BFDBFE'
  },
  {
    id: 4,
    icon: RefreshCw,
    title: 'Guaranteed Rapid Refunds',
    desc: 'Dispute arbitration guarantees prompt refunds if goods arrive damaged or not as described.',
    color: '#EF4444',
    bgColor: '#FEF2F2',
    borderColor: '#FECACA'
  }
];

// Default categories matching mobile DEFAULT_CATEGORIES
const CATEGORIES = [
  { id: 'all', name: 'All Items', icon: '✨' },
  { id: 'cat-phones', name: 'Phones & Tablets', icon: '📱' },
  { id: 'cat-fashion', name: 'Fashion & Apparel', icon: '👔' },
  { id: 'cat-electronics', name: 'Electronics & Gadgets', icon: '💻' },
  { id: 'cat-shoes', name: 'Shoes & Footwear', icon: '👟' },
  { id: 'cat-beauty', name: 'Beauty & Health', icon: '💄' },
  { id: 'cat-home', name: 'Home & Living', icon: '🏠' }
];

// Delivery hubs matching mobile delivery estimator
const DELIVERY_HUBS = [
  { name: 'Abuja', timeframe: 'Guaranteed 24 - 48 Hours Insured Cargo Dispatch' },
  { name: 'Lagos', timeframe: 'Guaranteed 24 - 48 Hours Express Hub Delivery' },
  { name: 'Kano', timeframe: 'Guaranteed 24 Hours Regional Fast Dispatch' },
  { name: 'Port Harcourt', timeframe: 'Guaranteed 48 Hours Insured Cargo Transit' }
];

// Verified testimonials matching mobile TESTIMONIALS_FALLBACK
const TESTIMONIALS = [
  {
    id: 't-1',
    quote: "Abu Mafhal's Escrow Vault gave me total peace of mind. My funds were never exposed until I held and tested my phone in person.",
    name: "Ibrahim Sani",
    role: "Verified Buyer (Kano)",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150",
    rating: 5
  },
  {
    id: 't-2',
    quote: "Registering my store on Abu Mafhal expanded my customer reach nationwide. Instant payouts and zero fraud make it unmatched.",
    name: "Amina Yusuf",
    role: "Verified Merchant (Abuja)",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150",
    rating: 5
  },
  {
    id: 't-3',
    quote: "Fastest dispatch I've ever experienced in Nigeria. Tracking was accurate, and product condition was 100% genuine.",
    name: "David Adeleke",
    role: "Verified Buyer (Lagos)",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150",
    rating: 5
  }
];

// Fallback Popular Products matching mobile POPULAR_FALLBACKS
const FALLBACK_POPULAR = [
  {
    id: 'pop-1',
    name: 'iPhone 15 Pro Max 256GB Natural Titanium',
    price: 1250000,
    compare_at_price: 1470000,
    discount: 15,
    rating: 4.9,
    reviews_count: 142,
    category: 'Phones & Tablets',
    seller_state: 'Lagos',
    image_url: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=500&auto=format&fit=crop'
  },
  {
    id: 'pop-2',
    name: 'Apple Watch Series 9 GPS 45mm Starlight',
    price: 390000,
    compare_at_price: 450000,
    discount: 20,
    rating: 4.8,
    reviews_count: 98,
    category: 'Electronics & Gadgets',
    seller_state: 'Abuja',
    image_url: 'https://images.unsplash.com/photo-1542496658-e33a6d0d50f6?w=500&auto=format&fit=crop'
  },
  {
    id: 'pop-3',
    name: 'Nike Air Jordan 1 Retro High Chicago Edition',
    price: 85000,
    compare_at_price: 95000,
    discount: 10,
    rating: 4.7,
    reviews_count: 76,
    category: 'Fashion & Apparel',
    seller_state: 'Kano',
    image_url: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?w=500&auto=format&fit=crop'
  },
  {
    id: 'pop-4',
    name: 'Dior Sauvage Eau De Parfum Vaporisateur 100ml',
    price: 78000,
    compare_at_price: 95000,
    discount: 18,
    rating: 4.9,
    reviews_count: 65,
    category: 'Beauty & Health',
    seller_state: 'Lagos',
    image_url: 'https://images.unsplash.com/photo-1547887537-6158d64c35b3?w=500&auto=format&fit=crop'
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
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [sortFilter, setSortFilter] = useState('featured'); // 'featured', 'rating', 'deals'
  const [priceRange, setPriceRange] = useState('all'); // 'all', 'under50k', '50k-250k', '250k+'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHub, setSelectedHub] = useState(DELIVERY_HUBS[0]);
  const [toastMsg, setToastMsg] = useState('');
  const [quickViewProduct, setQuickViewProduct] = useState(null);

  // Policy Modal matching mobile InfoModal
  const [infoModal, setInfoModal] = useState({ open: false, title: '', subtitle: '', content: '' });

  // Live Flash Sale Countdown
  const [timeLeft, setTimeLeft] = useState({ hours: 14, minutes: 22, seconds: 45 });

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

  // Fetch live products from Supabase
  useEffect(() => {
    async function fetchProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*, profiles:vendor_id(business_name, full_name, is_verified, state)')
          .order('created_at', { ascending: false })
          .limit(16);

        if (!error && data && data.length > 0) {
          const mapped = data.map(p => ({
            ...p,
            seller_name: p.profiles?.business_name || p.profiles?.full_name || 'Verified Merchant',
            seller_state: p.profiles?.state || 'Nigeria',
            image_url: p.image_url || (Array.isArray(p.images) ? p.images[0] : null) || FALLBACK_POPULAR[0].image_url
          }));
          setProducts(mapped);
          setFlashDeals(mapped.slice(0, 4));
        } else {
          setFlashDeals(FALLBACK_POPULAR);
        }
      } catch (_) {
        setFlashDeals(FALLBACK_POPULAR);
      }
    }
    fetchProducts();
  }, []);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
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

  const openInfoModal = (type) => {
    switch (type) {
      case 'escrow-policy':
        setInfoModal({
          open: true,
          title: '100% Escrow Protection Policy',
          subtitle: 'Bank-Grade Financial Custody & Buyer Shield',
          content: 'Every transaction is safeguarded by CBN-licensed financial channels. When you make a purchase, funds are held securely in the Abu Mafhal Escrow Vault. Sellers are only paid after you receive your package, inspect it, and verify that it matches what you ordered.'
        });
        break;
      case 'buyer-protection':
        setInfoModal({
          open: true,
          title: 'Buyer Protection Guarantee',
          subtitle: 'Genuine Products, Insured Transit & 7-Day Returns',
          content: 'If an item is counterfeit, damaged, or fails to arrive, our 24-hour dispute arbitration system steps in immediately to guarantee a full refund to your wallet or original payment source.'
        });
        break;
      case 'become-seller':
        setInfoModal({
          open: true,
          title: 'Become a Verified Merchant',
          subtitle: 'Reach Millions of Shoppers Across 36 States',
          content: 'Grow your business with zero upfront store listing fees, fast next-day settlements, integrated logistics, and trusted CAC/NIN verification badges.'
        });
        break;
      case 'delivery-transit':
        setInfoModal({
          open: true,
          title: 'Nationwide Logistics Network',
          subtitle: 'Express 24 to 48-Hour Doorstep Transit',
          content: 'We operate regional sorting hubs in Abuja, Lagos, Kano, and Port Harcourt to ensure your parcel travels with real-time waypoint tracking and insured care.'
        });
        break;
      default:
        break;
    }
  };

  // Filter & Sort logic identical to mobile
  let displayedProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All Items' ||
      (p.category && p.category.toLowerCase().includes(selectedCategory.toLowerCase()));
    const matchesQuery = !searchQuery.trim() ||
      (p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.category && p.category.toLowerCase().includes(searchQuery.toLowerCase()));

    let matchesPrice = true;
    const numPrice = Number(p.price) || 0;
    if (priceRange === 'under50k') {
      matchesPrice = numPrice < 50000;
    } else if (priceRange === '50k-250k') {
      matchesPrice = numPrice >= 50000 && numPrice <= 250000;
    } else if (priceRange === '250k+') {
      matchesPrice = numPrice > 250000;
    }

    return matchesCategory && matchesQuery && matchesPrice;
  });

  if (sortFilter === 'rating') {
    displayedProducts = [...displayedProducts].sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sortFilter === 'deals') {
    displayedProducts = [...displayedProducts].sort((a, b) => {
      const discA = a.compare_at_price ? (a.compare_at_price - a.price) : 0;
      const discB = b.compare_at_price ? (b.compare_at_price - b.price) : 0;
      return discB - discA;
    });
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans text-slate-800">
      <Navbar />

      {/* ─── LIVE ESCROW STATUS TICKER (Matching Mobile topLiveTicker) ─── */}
      <div className="bg-[#070F1E] text-white py-2 px-4 border-b border-white/5 overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-2.5 text-[10px] sm:text-xs font-black tracking-wider uppercase">
          <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shrink-0" />
          <span className="truncate text-slate-300">{LIVE_TICKER_TEXT}</span>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-16 sm:bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-[#070F1E] border border-[#D9A73A]/40 text-white text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <ShieldCheck className="w-4 h-4 text-[#D9A73A]" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Quick View Product Modal */}
      {quickViewProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl animate-in zoom-in-95">
            <button
              onClick={() => setQuickViewProduct(null)}
              className="absolute top-5 right-5 p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
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
                <h3 className="text-lg font-extrabold text-[#070F1E]">{quickViewProduct.name}</h3>
                <div className="flex items-center gap-2 text-xs text-amber-500 font-bold">
                  <Star className="w-4 h-4 fill-current" />
                  <span>{quickViewProduct.rating || 4.9}</span>
                  <span className="text-slate-400 font-normal">({quickViewProduct.reviews_count || 12} reviews)</span>
                </div>
                <div className="pt-2">
                  <p className="text-2xl font-black text-[#070F1E]">₦{Number(quickViewProduct.price).toLocaleString()}</p>
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
                    className="flex-1 py-3 rounded-xl bg-[#070F1E] hover:bg-[#112240] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    Add to Cart
                  </button>
                  <Link
                    to={`/product/${quickViewProduct.id}`}
                    className="px-4 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-[#070F1E] font-bold text-xs flex items-center justify-center border border-[#D9A73A]/40"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info / Policy Modal */}
      {infoModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-4 shadow-2xl animate-in zoom-in-95 border border-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-[#070F1E]">{infoModal.title}</h3>
                <p className="text-[11px] text-[#D9A73A] font-bold">{infoModal.subtitle}</p>
              </div>
              <button
                onClick={() => setInfoModal({ open: false, title: '', subtitle: '', content: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">{infoModal.content}</p>
            <div className="pt-3 text-right">
              <button
                onClick={() => setInfoModal({ open: false, title: '', subtitle: '', content: '' })}
                className="px-6 py-2.5 rounded-xl bg-[#070F1E] text-white text-xs font-bold hover:bg-[#112240] transition-colors cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* ─── 1. SIGNATURE LUXURY HERO SECTION (Identical to Mobile Hero) ─── */}
        <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-10 lg:p-12 overflow-hidden relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Copy & Actions */}
            <div className="lg:col-span-7 space-y-6">
              {/* Security Trust Pill */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-extrabold text-emerald-800">
                <ShieldCheck className="w-4 h-4 text-[#10B981]" />
                <span>100% Escrow & Verified Market</span>
              </div>

              {/* Headline */}
              <div className="space-y-1">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#070F1E] tracking-tight leading-[1.08]">
                  Shop Smart. <br />
                  Sell More. <br />
                  <span className="text-[#D9A73A]">Grow Together.</span>
                </h1>
              </div>

              <p className="text-sm sm:text-base text-slate-500 max-w-xl font-normal leading-relaxed">
                Nigeria's premier multi-vendor marketplace fortified with 100% Escrow Vault protection. Authentic goods, vetted merchants, and 24h insured delivery.
              </p>

              {/* Dual Call To Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  to="/shop"
                  className="px-7 py-3.5 rounded-xl bg-[#070F1E] hover:bg-[#112240] text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 group"
                >
                  <ShoppingCart className="w-4 h-4 text-white" />
                  <span>Browse Market</span>
                  <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-3 h-3 text-white" />
                  </div>
                </Link>

                <button
                  onClick={() => openInfoModal('become-seller')}
                  className="px-7 py-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-[#D9A73A]/50 text-[#070F1E] font-black text-xs sm:text-sm transition-all flex items-center gap-2 group cursor-pointer"
                >
                  <Store className="w-4 h-4 text-[#D9A73A]" />
                  <span>Start Selling</span>
                  <div className="w-5 h-5 rounded-full bg-[#D9A73A] flex items-center justify-center group-hover:translate-x-1 transition-transform">
                    <ArrowRight className="w-3 h-3 text-white" />
                  </div>
                </button>
              </div>
            </div>

            {/* Right Column: Hero Device Mockup with Overlaid Micro-Badges */}
            <div className="lg:col-span-5 relative flex items-center justify-center">
              <div className="relative w-full max-w-[340px] sm:max-w-[380px] aspect-[4/5] flex items-center justify-center">
                {/* Background Glow */}
                <div className="absolute inset-0 bg-gradient-to-tr from-[#D9A73A]/15 via-emerald-500/10 to-transparent rounded-full blur-2xl" />

                <img
                  src="/hero_mockup.png"
                  alt="Abu Mafhal Mobile App Experience"
                  className="w-full h-full object-contain relative z-10 drop-shadow-2xl"
                  onError={(e) => {
                    // Fallback to stylized card if image missing
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600&auto=format&fit=crop';
                  }}
                />

                {/* Floating Micro-Badge Top Left */}
                <div className="absolute top-4 left-0 sm:-left-3 z-20 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-emerald-200 shadow-lg flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
                  <span className="text-[10px] font-black text-[#070F1E]">Escrow Secured</span>
                </div>

                {/* Floating Micro-Badge Bottom Right */}
                <div className="absolute bottom-6 right-0 sm:-right-3 z-20 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-md border border-amber-200 shadow-lg flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-current" />
                  <span className="text-[10px] font-black text-[#070F1E]">4.9/5 Rating</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── 2. SEARCH & INSTANT DISCOVERY BAR (Matching Mobile searchBarSection) ─── */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-2 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2.5 px-3">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search verified products, brands, stores..."
              className="w-full text-xs sm:text-sm text-[#070F1E] bg-transparent outline-none placeholder:text-slate-400 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="p-1 rounded-full text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Link
            to={`/shop?q=${encodeURIComponent(searchQuery)}`}
            className="px-5 py-2.5 rounded-xl bg-[#070F1E] text-white text-xs font-bold hover:bg-[#112240] transition-colors shrink-0"
          >
            Search
          </Link>
        </div>

        {/* ─── 3. CATEGORY CHIP TABS (Matching Mobile categoryChipsSection) ─── */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.name;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#D9A73A] text-[#070F1E] shadow-sm font-extrabold'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* ─── 4. DYNAMIC SORT & BUDGET FILTER PILLS (Matching Mobile sortFilterBar) ─── */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 text-xs text-slate-600 scrollbar-none">
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider shrink-0">Filter:</span>
          
          <button
            onClick={() => setSortFilter('featured')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
              sortFilter === 'featured' ? 'bg-[#070F1E] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            🔥 Featured
          </button>
          <button
            onClick={() => setSortFilter('rating')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
              sortFilter === 'rating' ? 'bg-[#070F1E] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ⭐ Top Rated
          </button>
          <button
            onClick={() => setSortFilter('deals')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
              sortFilter === 'deals' ? 'bg-[#070F1E] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ⚡ Deals
          </button>

          <span className="w-px h-4 bg-slate-300 mx-1 shrink-0" />

          <button
            onClick={() => setPriceRange('all')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
              priceRange === 'all' ? 'bg-[#070F1E] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Prices
          </button>
          <button
            onClick={() => setPriceRange('under50k')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
              priceRange === 'under50k' ? 'bg-[#070F1E] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Under ₦50K
          </button>
          <button
            onClick={() => setPriceRange('50k-250k')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
              priceRange === '50k-250k' ? 'bg-[#070F1E] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ₦50K - ₦250K
          </button>
          <button
            onClick={() => setPriceRange('250k+')}
            className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all ${
              priceRange === '250k+' ? 'bg-[#070F1E] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            ₦250K+
          </button>
        </div>

        {/* ─── 5. ELEGANT ESCROW & BANK SECURITY STRIP (Matching Mobile escrowCompactSection) ─── */}
        <div
          onClick={() => openInfoModal('escrow-policy')}
          className="bg-gradient-to-r from-[#070F1E] via-[#0A192F] to-[#0F2746] rounded-2xl p-5 sm:p-6 border border-[#D9A73A]/30 shadow-lg cursor-pointer hover:border-[#D9A73A] transition-all group"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#10B981]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-white text-xs sm:text-sm font-black tracking-wider uppercase">100% ESCROW BUYER VAULT</h3>
                  <span className="px-1.5 py-0.5 rounded bg-[#10B981] text-white text-[9px] font-black uppercase tracking-wider">
                    TAP FOR POLICY
                  </span>
                </div>
                <p className="text-slate-400 text-xs mt-0.5">
                  Funds are safely preserved in escrow until you receive and verify your package.
                </p>
              </div>
            </div>

            {/* 3 Steps Pillar */}
            <div className="flex items-center gap-2 sm:gap-4 text-xs font-bold text-slate-200 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/10">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#D9A73A]" />
                <span>1. Vault Deposit</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-sky-400" />
                <span>2. Tracked Transit</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              <div className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#10B981]" />
                <span>3. Approve / Refund</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── 6. FLASH DEALS (WITH LIVE COUNTDOWN TIMER & PROGRESS) ─── */}
        {flashDeals.length > 0 && (
          <section className="bg-amber-50/60 rounded-3xl border border-amber-200/80 p-5 sm:p-7 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-300 flex items-center justify-center text-rose-600">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#070F1E]">Flash Deals</h3>
                  <p className="text-xs text-slate-500 font-medium">Up to 30% off limited-time verified clearance sales</p>
                </div>
              </div>

              {/* Countdown Timer */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Closes In:</span>
                <div className="flex items-center gap-1 font-mono text-xs font-black">
                  <span className="px-2 py-1 rounded-lg bg-[#070F1E] text-rose-400">
                    {String(timeLeft.hours).padStart(2, '0')}h
                  </span>
                  <span>:</span>
                  <span className="px-2 py-1 rounded-lg bg-[#070F1E] text-rose-400">
                    {String(timeLeft.minutes).padStart(2, '0')}m
                  </span>
                  <span>:</span>
                  <span className="px-2 py-1 rounded-lg bg-[#070F1E] text-rose-400">
                    {String(timeLeft.seconds).padStart(2, '0')}s
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {flashDeals.map((p, idx) => {
                const discountPct = p.compare_at_price && p.compare_at_price > p.price
                  ? Math.round(((p.compare_at_price - p.price) / p.compare_at_price) * 100)
                  : (p.discount || 15);
                const progressPct = 65 + ((idx * 11) % 30);

                return (
                  <div
                    key={p.id || idx}
                    className="bg-white rounded-2xl border border-slate-200/80 hover:border-[#D9A73A] transition-all p-3.5 space-y-3 flex flex-col justify-between shadow-xs group"
                  >
                    <div className="space-y-2.5">
                      <div className="relative rounded-xl overflow-hidden aspect-square bg-slate-50 border border-slate-100">
                        <img src={p.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-black uppercase">
                          -{discountPct}%
                        </span>
                        <button
                          onClick={() => toggleWishlistHandler(p)}
                          className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-xs cursor-pointer ${
                            isWishlisted(p.id) ? 'text-rose-600' : ''
                          }`}
                        >
                          <Heart className={`w-3.5 h-3.5 ${isWishlisted(p.id) ? 'fill-current' : ''}`} />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-[#070F1E] line-clamp-1">{p.name}</h4>
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-black text-[#070F1E]">₦{Number(p.price).toLocaleString()}</span>
                          {p.compare_at_price && (
                            <span className="text-[11px] text-slate-400 line-through">₦{Number(p.compare_at_price).toLocaleString()}</span>
                          )}
                        </div>
                      </div>

                      {/* Stock Progress Bar (Matching Mobile flashStockBar) */}
                      <div className="space-y-1">
                        <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full bg-rose-500 rounded-full" style={{ width: `${progressPct}%` }} />
                        </div>
                        <p className="text-[10px] text-slate-500 font-bold">⚡ {progressPct}% Claimed</p>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        addToCart(p, 1);
                        showToast('Added to cart!');
                      }}
                      className="w-full py-2.5 rounded-xl bg-[#070F1E] hover:bg-[#112240] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ShoppingCart className="w-3.5 h-3.5 text-[#D9A73A]" />
                      Claim Deal
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── 7. TRENDING MARKETPLACE (Matching Mobile Section 7) ─── */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-[#070F1E]">Trending Marketplace</h2>
              <p className="text-xs text-slate-500">
                {selectedCategory === 'All Items'
                  ? `Showing ${displayedProducts.length} verified products`
                  : `${selectedCategory} (${displayedProducts.length} items)`}
              </p>
            </div>
            <Link
              to="/shop"
              className="text-xs font-extrabold text-[#D9A73A] hover:underline flex items-center gap-1"
            >
              <span>Explore All Products</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {displayedProducts.slice(0, 8).map(product => (
              <div
                key={product.id}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-[#D9A73A] transition-all p-3.5 space-y-3 flex flex-col justify-between shadow-xs group"
              >
                <div className="space-y-2.5">
                  <div className="relative rounded-xl overflow-hidden aspect-square bg-slate-50 border border-slate-100">
                    <img src={product.image_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    
                    {/* Escrow Badge Pill */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-[#10B981]" />
                      <span className="text-[9px] font-black text-emerald-800">Escrow Safe</span>
                    </div>

                    <button
                      onClick={() => toggleWishlistHandler(product)}
                      className={`absolute top-2 right-2 w-7 h-7 rounded-full bg-white/95 flex items-center justify-center text-slate-400 hover:text-rose-500 shadow-xs cursor-pointer ${
                        isWishlisted(product.id) ? 'text-rose-600' : ''
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isWishlisted(product.id) ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      onClick={() => setQuickViewProduct(product)}
                      className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-white/95 hover:bg-white text-[#070F1E] text-[10px] font-bold shadow-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3 text-[#D9A73A]" /> Preview
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                      <span className="uppercase text-[#D9A73A]">{product.category || 'Marketplace'}</span>
                      <span>{product.seller_state || 'Nigeria'}</span>
                    </div>
                    <Link
                      to={`/product/${product.id}`}
                      className="block text-xs font-bold text-[#070F1E] hover:text-[#D9A73A] transition-colors line-clamp-2"
                    >
                      {product.name}
                    </Link>
                  </div>

                  {/* Rating & Verified Tag */}
                  <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                    <Star className="w-3 h-3 fill-current" />
                    <span>{product.rating ? Number(product.rating).toFixed(1) : '4.9'}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({product.reviews_count || 48})</span>
                    <span className="text-[10px] text-emerald-600 font-bold ml-1">• Verified</span>
                  </div>

                  <div className="flex items-baseline gap-2 pt-0.5">
                    <span className="text-base font-black text-[#070F1E]">₦{Number(product.price).toLocaleString()}</span>
                    {product.compare_at_price && (
                      <span className="text-xs text-slate-400 line-through">₦{Number(product.compare_at_price).toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <button
                    onClick={() => {
                      addToCart(product, 1);
                      showToast('Added to cart!');
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#070F1E] hover:bg-[#112240] text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 text-[#D9A73A]" />
                    Add to Cart
                  </button>
                  <button
                    onClick={() => {
                      addToComparison(product);
                      showToast('Added to comparison');
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-[#D9A73A] hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
                    title="Compare"
                  >
                    <Scale className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 8. DELIVERY ESTIMATOR WIDGET (Matching Mobile deliveryEstimatorSection) ─── */}
        <section className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 space-y-4 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-[#D9A73A]/40 flex items-center justify-center text-[#D9A73A]">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#070F1E]">Nationwide Delivery Transit</h3>
              <p className="text-xs text-slate-500">Select destination hub to view estimated freight timeframe:</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {DELIVERY_HUBS.map((hub) => {
              const isSel = selectedHub.name === hub.name;
              return (
                <button
                  key={hub.name}
                  onClick={() => setSelectedHub(hub)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSel
                      ? 'bg-[#070F1E] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {hub.name}
                </button>
              );
            })}
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs font-bold text-emerald-800">
            <Zap className="w-4 h-4 text-[#10B981] fill-current shrink-0" />
            <span>{selectedHub.name}: {selectedHub.timeframe}</span>
          </div>
        </section>

        {/* ─── 9. WHY CHOOSE US (Matching Mobile WHY_CHOOSE_US) ─── */}
        <section className="space-y-6 pt-4">
          <div className="text-center space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black text-[#070F1E]">Why Choose Abu Mafhal?</h2>
            <p className="text-xs text-slate-500">Built on bank-grade security, transparency, and verified integrity</p>
            <div className="w-12 h-1 bg-[#D9A73A] mx-auto rounded-full mt-2" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {WHY_CHOOSE_US.map((item) => {
              const IconComp = item.icon;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-3 shadow-xs hover:border-[#D9A73A] transition-all"
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border"
                    style={{ backgroundColor: item.bgColor, borderColor: item.borderColor }}
                  >
                    <IconComp className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  <h4 className="text-sm font-black text-[#070F1E]">{item.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ─── 10. LIVE PLATFORM IMPACT & STATS (Matching Mobile statsSectionContainer) ─── */}
        <section className="bg-[#070F1E] rounded-3xl p-6 sm:p-10 border border-white/10 shadow-xl text-white">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center divide-y md:divide-y-0 md:divide-x divide-white/10">
            <div className="space-y-1 pt-2 md:pt-0">
              <p className="text-3xl sm:text-4xl font-black text-[#D9A73A]">50K+</p>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Active Buyers</p>
            </div>
            <div className="space-y-1 pt-4 md:pt-0">
              <p className="text-3xl sm:text-4xl font-black text-[#10B981]">₦2.5B+</p>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Escrow Secured</p>
            </div>
            <div className="space-y-1 pt-4 md:pt-0">
              <p className="text-3xl sm:text-4xl font-black text-sky-400">15K+</p>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Verified Sellers</p>
            </div>
            <div className="space-y-1 pt-4 md:pt-0">
              <p className="text-3xl sm:text-4xl font-black text-amber-400">4.9/5</p>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Satisfaction</p>
            </div>
          </div>
        </section>

        {/* ─── 11. DIRECT CONCIERGE & WHATSAPP SUPPORT PILL ─── */}
        <section className="bg-emerald-50 rounded-2xl border border-emerald-200 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#10B981] text-white flex items-center justify-center shrink-0 shadow-md">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-black text-[#070F1E]">Need Shopping Assistance?</h4>
              <p className="text-xs text-slate-600">Chat with our personal shopping concierge on WhatsApp 24/7</p>
            </div>
          </div>
          <a
            href="https://wa.me/2348145853539"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs font-black shadow-xs transition-all flex items-center gap-1.5 shrink-0"
          >
            <span>Chat On WhatsApp</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </section>

        {/* ─── 12. VERIFIED CUSTOMER TESTIMONIALS (Matching Mobile TESTIMONIALS_FALLBACK) ─── */}
        <section className="space-y-6 pt-4">
          <div className="text-center space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black text-[#070F1E]">Trusted by Thousands</h2>
            <p className="text-xs text-slate-500">Real feedback from verified buyers and sellers nationwide</p>
            <div className="w-12 h-1 bg-[#D9A73A] mx-auto rounded-full mt-2" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1 text-amber-500">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} className="w-3.5 h-3.5 fill-current" />
                    ))}
                  </div>
                  <p className="text-xs text-slate-600 italic leading-relaxed">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>

                <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                  <img src={t.avatar} alt="" className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                  <div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black text-[#070F1E]">{t.name}</span>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{t.role}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}