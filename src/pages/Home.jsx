import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import {
  Zap, Search, ArrowRight, Globe, Award, Rocket, Star,
  Check, X, Mail, Shield, Users, Package, ChevronDown,
  Truck, HeadphonesIcon, Lock, ShoppingBag, ChevronRight,
  Flag, Sparkles
} from 'lucide-react';

/* ─── Testimonials ─── */
const TESTIMONIALS = [
  { quote: 'The logistics service is unmatched. I received my order from Lagos to London in record time!', name: 'Sani Ibrahim', role: 'Elite Shopper', initials: 'SI', color: 'bg-blue-600' },
  { quote: 'As a vendor, Abu Mafhal has given me access to thousands of new customers. My sales have tripled!', name: 'Fatima Musa', role: 'Verified Vendor', initials: 'FM', color: 'bg-emerald-600' },
  { quote: 'I love the clean interface and secure payment options. It\'s the only platform I trust for global shopping.', name: 'John Doe', role: 'Daily User', initials: 'JD', color: 'bg-purple-600' },
];

/* ─── FAQ ─── */
const FAQS = [
  { q: 'How do I become a vendor?', a: 'Apply through the Vendor Application page. Our team reviews applications within 48 hours.' },
  { q: 'Is global shipping available?', a: 'Yes! We ship to 25+ countries with real-time GPS tracking on every order.' },
  { q: 'How secure are my payments?', a: 'All payments are processed via 256-bit SSL encryption. Your data is always safe.' },
];

/* ─── Ecosystem cards ─── */
const ECOSYSTEM = [
  { tag: 'MARKETPLACE', title: 'Shop Premium Products', img: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2670&auto=format&fit=crop', bg: 'bg-slate-900' },
  { tag: 'LOGISTICS', title: 'Global Elite Delivery', img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2670&auto=format&fit=crop', bg: 'bg-blue-600' },
  { tag: 'VENDORS', title: 'Empowering Local Businesses to Grow Rapidly', img: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?q=80&w=2670&auto=format&fit=crop', bg: 'bg-emerald-600' },
];

const MILESTONES = [
  { year: '2024', label: 'The Genesis', text: 'Launched with a vision to connect local vendors to global shoppers.', icon: Flag, color: 'text-blue-600 border-blue-200' },
  { year: 'PRESENT', label: 'Elite Ecosystem', text: 'Now serving 10,000+ customers with AI-ready logistics and secure payments.', icon: Rocket, color: 'text-blue-600 border-blue-200' },
  { year: 'FUTURE 2025', label: 'Global Leadership', text: 'Deploying full AI concierge and autonomous logistics networks globally.', icon: Star, color: 'text-emerald-600 border-emerald-200', future: true },
];

const MEMBERSHIP_ROWS = [
  { name: 'Global Shipping', basic: true, elite: true },
  { name: 'Priority Support', basic: false, elite: true },
  { name: 'Elite Vendor Access', basic: false, elite: true },
  { name: 'Cashback & Rewards', basic: '1%', elite: '5%' },
];

/* ─── Countdown Timer ─── */
const useCountdown = (endDate) => {
  const calc = () => {
    const diff = new Date(endDate) - new Date();
    if (diff <= 0) return null;
    return {
      h: Math.floor(diff / 3600000),
      m: Math.floor((diff % 3600000) / 60000),
      s: Math.floor((diff % 60000) / 1000),
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const t = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(t);
  }, [endDate]);
  return time;
};

const CountdownTimer = ({ endDate }) => {
  const t = useCountdown(endDate);
  if (!t) return null;
  const pad = n => String(n).padStart(2, '0');
  return (
    <div className="flex items-center gap-1">
      {[{ v: t.h, l: 'h' }, { v: t.m, l: 'm' }, { v: t.s, l: 's' }].map(({ v, l }, i) => (
        <React.Fragment key={l}>
          <div className="flex flex-col items-center">
            <div className="bg-slate-900 text-white text-sm font-black w-9 h-9 rounded-lg flex items-center justify-center tabular-nums shadow">{pad(v)}</div>
            <span className="text-[9px] font-black text-slate-400 uppercase mt-1">{l}</span>
          </div>
          {i < 2 && <span className="text-slate-400 font-black text-lg mb-3">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

/* ─── Flash Sale Card ─── */
const FlashSaleCard = ({ sale }) => {
  const t = useCountdown(sale.end_date);
  if (!t) return null; // auto-hide when expired
  const products = sale.products || [];
  return (
    <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-3xl overflow-hidden shadow-xl shadow-red-500/20 flex flex-col lg:flex-row">
      {/* Left: info + timer */}
      <div className="flex-1 p-8 lg:p-10 flex flex-col justify-between gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-300 fill-yellow-300 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-red-100">Limited Offer</span>
          </div>
          <h3 className="text-3xl font-black text-white leading-tight tracking-tighter">{sale.title}</h3>
          {sale.description && <p className="text-red-100 text-sm font-medium leading-relaxed">{sale.description}</p>}
          {sale.discount_percentage > 0 && (
            <div className="inline-flex items-center gap-2 bg-white/20 border border-white/30 text-white rounded-full px-4 py-1.5">
              <span className="text-2xl font-black">{sale.discount_percentage}% OFF</span>
              <span className="text-sm text-red-100">on selected items</span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-[10px] font-black text-red-200 uppercase tracking-widest">Ends In:</p>
          <CountdownTimer endDate={sale.end_date} />
        </div>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 bg-white text-red-600 font-black text-sm uppercase tracking-widest px-6 py-3.5 rounded-xl hover:bg-red-50 transition-all hover:scale-105 shadow-lg w-fit"
        >
          Shop Now <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      {/* Right: product previews */}
      {products.length > 0 && (
        <div className="lg:w-80 p-6 flex flex-col gap-3 bg-black/10">
          <p className="text-[10px] font-black text-red-200 uppercase tracking-widest">Deals in this sale</p>
          {products.slice(0, 3).map((p, i) => (
            <Link key={i} to={`/product/${p.id}`} className="flex items-center gap-3 bg-white/10 hover:bg-white/20 transition-all rounded-xl p-3">
              <img
                src={p.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=100'}
                alt={p.name}
                className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-xs line-clamp-1">{p.name}</p>
                <p className="text-red-200 font-black text-sm">₦{p.price?.toLocaleString()}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

/* ─── Hero Banner Carousel ─── */
const DEFAULT_BANNERS = [
  { id: 1, image_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2670&auto=format&fit=crop', label: 'PREMIUM QUALITY' },
  { id: 2, image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2670&auto=format&fit=crop', label: 'ELITE SELECTION' },
  { id: 3, image_url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=2670&auto=format&fit=crop', label: 'SHOP GLOBAL' },
];

const HeroBanner = ({ banners }) => {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);
  const data = banners.length > 0 ? banners : DEFAULT_BANNERS;

  useEffect(() => {
    timerRef.current = setInterval(() => setIdx(p => (p + 1) % data.length), 5000);
    return () => clearInterval(timerRef.current);
  }, [data.length]);

  return (
    <div className="relative w-full h-72 lg:h-96 rounded-3xl overflow-hidden shadow-2xl shadow-slate-200">
      {data.map((b, i) => (
        <div
          key={b.id || i}
          className={`absolute inset-0 transition-opacity duration-700 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
        >
          <img src={b.image_url} alt={b.label || ''} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
          {(b.label || b.title) && (
            <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm px-4 py-2.5 rounded-xl border-l-4 border-blue-600 shadow-lg">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">{b.label || b.title}</span>
            </div>
          )}
        </div>
      ))}

      {/* Dots */}
      <div className="absolute bottom-5 right-6 flex gap-2">
        {data.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${i === idx ? 'bg-white w-7' : 'bg-white/40 w-1.5'}`}
          />
        ))}
      </div>
    </div>
  );
};

/* ─── FAQ Accordion Item ─── */
const FaqItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-slate-100 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center py-5 text-left gap-4"
      >
        <span className="text-sm font-bold text-slate-700">{q}</span>
        <ChevronDown className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="pb-5 text-sm text-slate-500 leading-relaxed font-medium">{a}</p>}
    </div>
  );
};

/* ═══════ MAIN COMPONENT ═══════ */
const Home = () => {
  const navigate = useNavigate();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [banners, setBanners] = useState([]);
  const [promoBanners, setPromoBanners] = useState([]);
  const [promoIdx, setPromoIdx] = useState(0);
  const [flashSales, setFlashSales] = useState([]);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    // Fetch products from Supabase
    try {
      const { data: prods, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(8);
      if (!error && prods) setFeaturedProducts(prods);
    } catch (e) { console.error('products fetch error', e); }
    finally { setLoading(false); }

    // Fetch banners from Supabase
    try {
      const { data: bAll } = await supabase.from('banners').select('*').eq('is_active', true).order('display_order');
      if (bAll) {
        setBanners(bAll.filter(b => !b.section || b.section === 'landing' || b.section === 'all' || b.section === ''));
        setPromoBanners(bAll.filter(b => b.section === 'promo'));
      }
    } catch (e) { /* silent */ }

    // Fetch flash sales with their products
    try {
      const now = new Date().toISOString();
      const { data: sales } = await supabase
        .from('flash_sales')
        .select('*, products:flash_sale_products(product:products(*))')
        .eq('active', true)
        .gt('end_date', now)
        .order('end_date', { ascending: true });

      if (sales && sales.length > 0) {
        const cleaned = sales.map(s => ({
          ...s,
          products: (s.products || []).map(fp => fp.product).filter(Boolean),
        }));
        setFlashSales(cleaned);
      } else {
        // Fallback: try without join in case table structure differs
        const { data: salesSimple } = await supabase
          .from('flash_sales')
          .select('*')
          .eq('active', true)
          .gt('end_date', now)
          .order('end_date', { ascending: true });
        if (salesSimple) setFlashSales(salesSimple);
      }
    } catch (e) { console.error('flash_sales fetch error', e); }
  };

  // Promo auto-slide
  useEffect(() => {
    if (promoBanners.length < 2) return;
    const t = setInterval(() => setPromoIdx(p => (p + 1) % promoBanners.length), 4000);
    return () => clearInterval(t);
  }, [promoBanners.length]);

  const handleSearch = () => {
    navigate(searchQuery.trim() ? `/shop?q=${encodeURIComponent(searchQuery)}` : '/shop');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar />

      {/* ─── TICKER ─── */}
      <div className="bg-slate-900 py-2 overflow-hidden whitespace-nowrap">
        <div className="flex animate-marquee gap-12 items-center">
          {[
            '⚡ New Elite Vendor in Dubai',
            '📦 1,200+ Active Shipments Worldwide',
            '🔥 Flash Sale: Premium Electronics',
            '✅ 24/7 Verified Support Live',
            '🚀 New: AI Product Recommendations',
            '⚡ New Elite Vendor in Dubai',
            '📦 1,200+ Active Shipments Worldwide',
            '🔥 Flash Sale: Premium Electronics',
            '✅ 24/7 Verified Support Live',
            '🚀 New: AI Product Recommendations',
          ].map((t, i) => (
            <span key={i} className="text-[11px] font-black uppercase tracking-widest text-white/80">{t}</span>
          ))}
        </div>
      </div>

      {/* ─── HERO ─── */}
      <section className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left */}
            <div className="space-y-8">
              <p className="text-xs font-black text-blue-600 uppercase tracking-[0.3em]">Welcome to the Future</p>

              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black text-slate-900 leading-[1.05] tracking-tighter">
                Discover the <span className="text-blue-600">Elite</span> Modern Ecosystem
              </h1>

              <p className="text-lg text-slate-500 leading-relaxed font-medium max-w-lg">
                Abu Mafhal is more than just a marketplace. We bridge the gap between quality products, seamless logistics, and premium vendor services.
              </p>

              <Link
                to="/shop"
                className="inline-flex items-center gap-3 bg-slate-900 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-slate-900/20"
              >
                Start Exploring <ArrowRight className="w-4 h-4" />
              </Link>

              {/* Search */}
              <div className="relative group max-w-xl">
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden focus-within:border-blue-500 focus-within:shadow-lg focus-within:shadow-blue-500/10 transition-all">
                  <Search className="w-5 h-5 text-slate-400 ml-5 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Search for elite products..."
                    className="flex-1 px-4 py-4 bg-transparent text-slate-900 placeholder-slate-400 font-semibold text-sm outline-none"
                  />
                  <button
                    onClick={handleSearch}
                    className="m-2 bg-slate-900 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-blue-600 transition-colors"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {/* Trending */}
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trending:</span>
                  {['iPhone 15', 'MacBook M3', 'Elite Watch', 'Premium Audio'].map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setSearchQuery(t)}
                      className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs text-slate-600 font-bold hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Banner carousel */}
            <div>
              <HeroBanner banners={banners} />
            </div>
          </div>
        </div>
      </section>

      {/* ─── PLATFORM STATS ─── */}
      <div className="bg-white border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100">
            {[
              { val: '10k+', label: 'Orders' },
              { val: '500+', label: 'Vendors' },
              { val: '24/7', label: 'Support' },
              { val: '100%', label: 'Secure' },
            ].map((s, i) => (
              <div key={i} className="text-center py-8">
                <div className="text-4xl font-black text-slate-900 tracking-tighter">{s.val}</div>
                <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── LIMITED OFFER (FLASH SALES) ─── */}
      {flashSales.length > 0 && (
        <section className="py-10 px-6 bg-white border-b border-slate-100">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-red-500 fill-red-500 animate-pulse" />
              <h2 className="text-2xl font-black text-slate-900 tracking-tighter">Limited Offers</h2>
              <span className="px-3 py-1 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                {flashSales.length} Active
              </span>
            </div>
            {flashSales.map(sale => (
              <FlashSaleCard key={sale.id} sale={sale} />
            ))}
          </div>
        </section>
      )}

      {/* ─── PROMO BANNERS ─── */}
      {promoBanners.length > 0 && (
        <div className="py-8 bg-white border-b border-slate-100 overflow-hidden">
          <div className="max-w-7xl mx-auto px-6">
            <div className="relative">
              <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${promoIdx * 100}%)` }}>
                {promoBanners.map((promo, i) => (
                  <div key={promo.id || i} className="min-w-full">
                    <div className="relative h-36 rounded-2xl overflow-hidden bg-slate-900 shadow-xl cursor-pointer" onClick={() => navigate('/shop')}>
                      <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover opacity-50" />
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-transparent" />
                      <div className="absolute inset-0 flex items-center px-8 gap-4">
                        <div>
                          {promo.subtitle && (
                            <span className="inline-block bg-red-500 text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded mb-2">
                              {promo.subtitle}
                            </span>
                          )}
                          <h3 className="text-xl font-black text-white">{promo.title || 'Special Promotion'}</h3>
                          <p className="text-white/70 text-sm mt-1">Explore Offer →</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Promo dots */}
              {promoBanners.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-4">
                  {promoBanners.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPromoIdx(i)}
                      className={`h-1.5 rounded-full transition-all ${i === promoIdx ? 'bg-slate-900 w-6' : 'bg-slate-300 w-1.5'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── ECOSYSTEM GRID ─── */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-3">Core Architecture</p>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">The Abu Mafhal Ecosystem</h2>
            <p className="text-slate-500 font-medium mt-3 max-w-lg">Everything you need in one powerful platform.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ECOSYSTEM.map((card, i) => (
              <Link
                key={i}
                to="/shop"
                className={`relative group h-72 ${card.bg} rounded-3xl overflow-hidden hover:scale-[1.02] transition-transform duration-500 shadow-xl`}
              >
                <img src={card.img} alt={card.tag} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-700" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6 space-y-2">
                  <span className="inline-block bg-white/10 border border-white/20 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
                    {card.tag}
                  </span>
                  <h3 className="text-xl font-black text-white leading-tight">{card.title}</h3>
                  <div className="flex items-center gap-2 text-white/60 group-hover:text-white transition-colors font-black text-xs uppercase tracking-wider">
                    Explore <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GLOBAL REACH ─── */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          <div className="bg-slate-900 rounded-3xl p-12 lg:p-16 relative overflow-hidden">
            <div className="absolute inset-0 opacity-5 flex items-center justify-center">
              <Globe className="w-[40rem] h-[40rem] text-blue-400" />
            </div>
            {/* Animated dots */}
            <div className="absolute top-1/3 left-[30%] w-3 h-3 rounded-full bg-blue-500 animate-ping opacity-60" />
            <div className="absolute top-1/2 left-[55%] w-3 h-3 rounded-full bg-blue-500 animate-ping opacity-60" style={{ animationDelay: '0.8s' }} />
            <div className="absolute top-2/5 left-[72%] w-3 h-3 rounded-full bg-blue-500 animate-ping opacity-60" style={{ animationDelay: '1.5s' }} />

            <div className="relative z-10 max-w-2xl space-y-6">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.3em]">Platform Coverage</p>
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight">Global Elite<br />Network</h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                We connect premium vendors from Africa to the rest of the world with seamless logistics and real-time tracking systems.
              </p>
              <div className="flex gap-12">
                {[{ val: '25+', label: 'Active Countries' }, { val: '150+', label: 'Global Ports' }].map((s, i) => (
                  <div key={i}>
                    <div className="text-4xl font-black text-white">{s.val}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-blue-400 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURED PRODUCTS ─── */}
      <section className="py-20 px-6 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-12">
            <div>
              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-3">Curated</p>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">Featured Products</h2>
            </div>
            <Link to="/shop" className="flex items-center gap-1 text-sm font-black text-slate-500 hover:text-blue-600 transition-colors uppercase tracking-widest group">
              View All <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-slate-100 rounded-2xl h-64 animate-pulse" />
              ))}
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-14 h-14 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-400 font-black uppercase tracking-widest text-sm">No products yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {featuredProducts.map(product => (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="group bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-xl hover:shadow-slate-200/60 transition-all hover:-translate-y-1"
                >
                  <div className="relative h-48 overflow-hidden bg-slate-50">
                    <img
                      src={
                        product.image_url ||
                        (Array.isArray(product.images) ? product.images[0] : null) ||
                        product.images?.[0] ||
                        'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=400&auto=format&fit=crop'
                      }
                      alt={product.name || 'Product'}
                      onError={e => { e.target.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=400&auto=format&fit=crop'; }}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    {product.discount > 0 && (
                      <div className="absolute top-3 right-3 bg-red-500 text-white text-[10px] font-black px-2 py-1 rounded-lg">
                        -{product.discount}%
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg">
                      Elite Pick
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {product.category_name || product.category ? (
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{product.category_name || product.category}</p>
                    ) : null}
                    <h3 className="font-black text-slate-900 text-sm line-clamp-2 leading-tight">{product.name || 'Product'}</h3>
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="font-black text-blue-600 text-lg">₦{(product.price || 0).toLocaleString()}</span>
                        {product.discount > 0 && (
                          <span className="text-xs text-slate-400 line-through ml-2">
                            ₦{Math.round((product.price || 0) / (1 - (product.discount / 100))).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-blue-600 group-hover:border-blue-600 transition-all flex-shrink-0">
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-white" />
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── MILESTONE TIMELINE ─── */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-16">
            {/* heading */}
            <div className="lg:w-1/3 space-y-5">
              <div className="w-1 h-12 bg-blue-600 rounded-full" />
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Our Journey</h2>
              <p className="text-slate-500 font-medium leading-relaxed">Evolution of the Abu Mafhal ecosystem from conceptualization to global leadership.</p>
            </div>

            {/* milestones */}
            <div className="flex-1 space-y-6 relative">
              <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200" />
              {MILESTONES.map((m, i) => (
                <div key={i} className="relative flex gap-8">
                  <div className={`w-12 h-12 rounded-2xl border-2 ${m.color} bg-white flex items-center justify-center z-10 flex-shrink-0 shadow-sm`}>
                    <m.icon className={`w-5 h-5 ${m.future ? 'text-emerald-600' : 'text-blue-600'}`} />
                  </div>
                  <div className={`flex-1 p-8 rounded-2xl border ${m.future ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'} shadow-sm hover:shadow-md transition-all`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${m.future ? 'text-emerald-600' : 'text-blue-600'}`}>{m.year}</p>
                    <h3 className="text-xl font-black text-slate-900 mb-2">{m.label}</h3>
                    <p className="text-slate-500 font-medium text-sm leading-relaxed">{m.text}</p>
                    {m.future && <span className="mt-3 inline-block px-3 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-full">Coming Soon</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── MEMBERSHIP COMPARISON ─── */}
      <section className="py-20 px-6 bg-white border-y border-slate-100">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black text-slate-900 text-center mb-10 tracking-tighter">Membership Comparison</h2>
          <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-xl shadow-slate-100">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="py-5 px-8 text-[10px] font-black text-slate-400 uppercase tracking-widest w-1/2">Feature</th>
                  <th className="py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Basic</th>
                  <th className="py-5 px-6 text-[10px] font-black text-blue-600 uppercase tracking-widest text-center">Elite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {MEMBERSHIP_ROWS.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-5 px-8 text-sm font-black text-slate-700">{row.name}</td>
                    <td className="py-5 px-6 text-center">
                      {typeof row.basic === 'boolean' ? (
                        row.basic ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />
                      ) : <span className="text-xs font-bold text-slate-500">{row.basic}</span>}
                    </td>
                    <td className="py-5 px-6 text-center">
                      {typeof row.elite === 'boolean' ? (
                        row.elite ? <Check className="w-5 h-5 text-blue-600 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />
                      ) : <span className="text-sm font-black text-blue-600">{row.elite}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── CONCIERGE HIGHLIGHT ─── */}
      <section className="px-6 py-12 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 bg-white border border-slate-100 rounded-2xl p-8 shadow-sm hover:shadow-md transition-all">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/30">
              <HeadphonesIcon className="w-7 h-7 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-slate-900 mb-1">Elite Concierge 24/7</h3>
              <p className="text-sm text-slate-500 font-medium leading-relaxed">Personalized support and expert guidance for your every need. Exclusively for our Elite members.</p>
            </div>
            <ChevronRight className="w-6 h-6 text-slate-300 flex-shrink-0 hidden sm:block" />
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-20 px-6 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="mb-12">
            <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.3em] mb-3">Community Feedback</p>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter">What Our Users Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl p-8 space-y-6 hover:shadow-lg hover:shadow-slate-200/60 transition-all hover:-translate-y-1">
                <div className="flex gap-1">
                  {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-slate-600 font-medium text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white text-xs font-black`}>{t.initials}</div>
                  <div>
                    <p className="text-sm font-black text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-400 font-medium">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter mb-8">Quick Questions</h2>
          <div className="bg-white border border-slate-100 rounded-2xl px-8 shadow-sm">
            {FAQS.map((f, i) => <FaqItem key={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* ─── ELITE MEMBERSHIP CTA ─── */}
      <section className="px-6 pb-20 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white border border-slate-100 rounded-2xl p-10 shadow-sm space-y-6">
            <div className="flex items-center gap-3">
              <Star className="w-7 h-7 text-amber-400 fill-amber-400" />
              <h3 className="text-2xl font-black text-slate-900">Elite Membership</h3>
            </div>
            <p className="text-slate-500 font-medium leading-relaxed max-w-xl">
              Join the Elite inner circle for priority shipping, 24/7 dedicated concierge, and early access to global product drops.
            </p>
            <Link
              to="/register"
              className="inline-block bg-slate-900 hover:bg-blue-600 text-white font-black text-sm uppercase tracking-widest px-8 py-4 rounded-xl transition-all hover:scale-105 shadow-xl"
            >
              Upgrade Now
            </Link>
          </div>
        </div>
      </section>

      {/* ─── MOBILE APP SECTION ─── */}
      <section className="py-20 px-6 bg-white border-y border-slate-100">
        <div className="max-w-7xl mx-auto">
          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-12 lg:p-20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/5 rounded-full -mr-20 -mt-20" />

            <div className="flex flex-col lg:flex-row items-center gap-16">
              {/* Left */}
              <div className="flex-1 space-y-8">
                <div className="inline-block bg-blue-50 text-blue-600 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl border border-blue-100">
                  Better on Mobile
                </div>
                <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter leading-tight">
                  The Entire Ecosystem<br />In Your Pocket.
                </h2>
                <p className="text-slate-500 text-lg leading-relaxed max-w-md font-medium">
                  Experience seamless transactions, real-time logistics tracking, and exclusive Elite-only digital collectibles.
                </p>

                {/* Benefit cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
                    <div className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-600/30">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-sm">Instant Alerts</p>
                      <p className="text-xs text-slate-400 font-medium">Price drops & restocks</p>
                    </div>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-2xl p-6 flex items-start gap-4 shadow-sm">
                    <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/30">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 text-sm">Live Tracking</p>
                      <p className="text-xs text-slate-400 font-medium">Real-time GPS delivery</p>
                    </div>
                  </div>
                </div>

                {/* Store buttons */}
                <div className="flex flex-wrap gap-4">
                  <button className="flex items-center gap-3 bg-slate-900 text-white px-6 py-4 rounded-2xl hover:bg-slate-800 transition-all hover:scale-105 shadow-xl">
                    <Rocket className="w-5 h-5" />
                    <div className="text-left">
                      <p className="text-[9px] font-black text-blue-400 tracking-widest uppercase">Get it on</p>
                      <p className="text-sm font-black">Google Play</p>
                    </div>
                  </button>
                  <button className="flex items-center gap-3 bg-slate-900 text-white px-6 py-4 rounded-2xl hover:bg-slate-800 transition-all hover:scale-105 shadow-xl">
                    <Award className="w-5 h-5" />
                    <div className="text-left">
                      <p className="text-[9px] font-black text-blue-400 tracking-widest uppercase">Download on the</p>
                      <p className="text-sm font-black">App Store</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Phone mockup */}
              <div className="w-52 h-[26rem] bg-slate-900 rounded-[3rem] border-[10px] border-slate-800 shadow-2xl relative flex-shrink-0 overflow-hidden hover:-rotate-3 transition-transform duration-700 group">
                <div className="w-full h-full bg-gradient-to-br from-slate-950 to-blue-950 p-5 space-y-4">
                  <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-lg">A</div>
                  <div className="h-3 bg-white/20 rounded-full w-3/4" />
                  <div className="h-20 bg-white/5 rounded-2xl" />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="h-16 bg-white/5 rounded-2xl" />
                    <div className="h-16 bg-white/5 rounded-2xl" />
                  </div>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-4">
                  <div className="bg-white/10 border border-white/20 backdrop-blur-xl rounded-2xl p-3 text-center">
                    <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Trade Elite</p>
                    <p className="text-white text-xs mt-0.5 italic font-bold">Join the ecosystem</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── NEWSLETTER ─── */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="relative bg-blue-600 rounded-3xl overflow-hidden p-12 lg:p-20 text-center">
            <div className="absolute inset-0 opacity-10 flex items-center justify-center">
              <Globe className="w-[30rem] h-[30rem] text-white" />
            </div>
            <div className="relative z-10 space-y-6 max-w-xl mx-auto">
              <Mail className="w-10 h-10 text-blue-200 mx-auto" />
              <h2 className="text-4xl font-black text-white tracking-tighter">Elite Newsletter</h2>
              <p className="text-blue-100 font-medium leading-relaxed">
                Stay ahead of the curve. Get exclusive offers, ecosystem updates, and new arrivals directly in your inbox.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="flex-1 bg-white/10 border border-white/20 text-white placeholder-blue-200 font-semibold text-sm rounded-xl px-5 py-4 outline-none focus:bg-white/20 transition-all"
                />
                <button className="bg-white text-blue-600 font-black text-sm uppercase tracking-widest px-8 py-4 rounded-xl hover:bg-blue-50 transition-all hover:scale-105 shadow-xl flex-shrink-0">
                  Subscribe Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Home;