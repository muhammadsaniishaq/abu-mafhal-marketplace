import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import {
  Zap, Search, ArrowRight, Globe, Award, Rocket, Star,
  Check, X, Mail, Shield, Users, Package, ChevronDown,
  Truck, HeadphonesIcon, Lock, ShoppingBag, ChevronRight,
  Flag, Sparkles, TrendingUp, Activity, Cpu, MapPin, 
  DollarSign, ArrowUpRight, CheckCircle, Terminal
} from 'lucide-react';

/* ─── Testimonials ─── */
const TESTIMONIALS = [
  { quote: 'The logistics service is unmatched. I received my order from Lagos to London in record time!', name: 'Sani Ibrahim', role: 'Elite Shopper', initials: 'SI', color: 'bg-indigo-600' },
  { quote: 'As a vendor, Abu Mafhal has given me access to thousands of new customers. My sales have tripled!', name: 'Fatima Musa', role: 'Verified Vendor', initials: 'FM', color: 'bg-emerald-600' },
  { quote: 'I love the clean interface and secure payment options. It\'s the only platform I trust for global shopping.', name: 'John Doe', role: 'Daily User', initials: 'JD', color: 'bg-purple-600' },
];

/* ─── FAQ ─── */
const FAQS = [
  { q: 'How do I become a vendor?', a: 'Apply through the Vendor Application page. Our team reviews applications within 48 hours.' },
  { q: 'Is global shipping available?', a: 'Yes! We ship to 25+ countries with real-time GPS tracking on every order.' },
  { q: 'How secure are my payments?', a: 'All payments are processed via 256-bit SSL encryption. Your data is always safe.' },
];

/* ─── Ecosystem Cards ─── */
const ECOSYSTEM = [
  { tag: 'MARKETPLACE', title: 'Shop Premium Products', desc: 'Secure local trade with integrated digital wallet deposits and secure escrow transactions.', img: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=600&auto=format&fit=crop', color: 'border-indigo-500/20 shadow-indigo-500/5 hover:border-indigo-500/50' },
  { tag: 'LOGISTICS', title: 'Global Elite Delivery', desc: 'Export and deliver goods from Africa to international locations with automated customs handling.', img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=600&auto=format&fit=crop', color: 'border-blue-500/20 shadow-blue-500/5 hover:border-blue-500/50' },
  { tag: 'VENDORS', title: 'Grow Business Analytics', desc: 'Empowering local businesses with high-fidelity analytical reporting, instant settlements, and client chat.', img: 'https://images.unsplash.com/photo-1556742502-ec7c0e9f34b1?q=80&w=600&auto=format&fit=crop', color: 'border-emerald-500/20 shadow-emerald-500/5 hover:border-emerald-500/50' },
];

const MILESTONES = [
  { year: '2024', label: 'The Genesis', text: 'Launched with a vision to connect local vendors to global shoppers.', icon: Flag, color: 'text-indigo-500 border-indigo-200/50 bg-indigo-50 dark:bg-indigo-950/30' },
  { year: 'PRESENT', label: 'Elite Ecosystem', text: 'Now serving 10,000+ customers with AI-ready logistics and secure payments.', icon: Rocket, color: 'text-blue-500 border-blue-200/50 bg-blue-50 dark:bg-blue-950/30' },
  { year: 'FUTURE 2025', label: 'Global Leadership', text: 'Deploying full AI concierge and autonomous logistics networks globally.', icon: Star, color: 'text-emerald-500 border-emerald-200/50 bg-emerald-50 dark:bg-emerald-950/30', future: true },
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
    <div className="flex items-center gap-1.5">
      {[{ v: t.h, l: 'h' }, { v: t.m, l: 'm' }, { v: t.s, l: 's' }].map(({ v, l }, i) => (
        <React.Fragment key={l}>
          <div className="flex flex-col items-center">
            <div className="bg-slate-900/90 dark:bg-slate-950/90 text-white text-base font-black w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 shadow-md tabular-nums">{pad(v)}</div>
            <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase mt-1 tracking-wider">{l}</span>
          </div>
          {i < 2 && <span className="text-white/60 font-black text-lg mb-4">:</span>}
        </React.Fragment>
      ))}
    </div>
  );
};

/* ─── Flash Sale Card ─── */
const FlashSaleCard = ({ sale }) => {
  const t = useCountdown(sale.end_date);
  if (!t) return null;
  const products = sale.products || [];
  return (
    <div className="relative bg-gradient-to-br from-indigo-900 via-purple-950 to-slate-950 rounded-3xl overflow-hidden shadow-2xl border border-indigo-500/20 flex flex-col lg:flex-row">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(99,102,241,0.15),transparent_60%)]" />
      
      {/* Left: Info */}
      <div className="relative flex-1 p-8 lg:p-12 flex flex-col justify-between gap-8 z-10">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5 text-indigo-400 fill-indigo-400 animate-pulse" />
            Limited Flash Sale
          </div>
          <h3 className="text-3xl lg:text-4xl font-black text-white leading-tight tracking-tight">{sale.title}</h3>
          {sale.description && <p className="text-slate-300 text-sm leading-relaxed max-w-lg font-medium">{sale.description}</p>}
          {sale.discount_percentage > 0 && (
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/15 text-white rounded-2xl px-4 py-2">
              <span className="text-2xl font-black text-indigo-400">{sale.discount_percentage}% OFF</span>
              <span className="text-xs text-slate-300 border-l border-white/20 pl-2">applied at checkout</span>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-[10px] font-black text-indigo-300 uppercase tracking-widest">Ending In:</p>
          <CountdownTimer endDate={sale.end_date} />
        </div>
        <Link
          to="/shop"
          className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest px-6 py-4 rounded-xl transition-all hover:scale-105 shadow-lg shadow-indigo-600/30 w-fit"
        >
          View All Deals <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Right: Products preview */}
      {products.length > 0 && (
        <div className="relative lg:w-96 p-8 flex flex-col gap-4 bg-slate-900/50 border-l border-white/5 backdrop-blur-md z-10">
          <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Featured Products</p>
          <div className="flex flex-col gap-3">
            {products.slice(0, 3).map((p, i) => (
              <Link key={i} to={`/product/${p.id}`} className="flex items-center gap-4 bg-slate-950/40 hover:bg-slate-950/80 border border-white/5 hover:border-indigo-500/30 transition-all rounded-2xl p-3">
                <img
                  src={p.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=100'}
                  alt={p.name}
                  className="w-14 h-14 object-cover rounded-xl flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-bold text-xs line-clamp-1">{p.name}</p>
                  <p className="text-indigo-400 font-black text-sm mt-1">₦{p.price?.toLocaleString()}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Hero Banner Carousel (database banners fallback showcase) ─── */
const DEFAULT_BANNERS = [
  { id: 1, image_url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1200&auto=format&fit=crop', label: 'PREMIUM QUALITY' },
  { id: 2, image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200&auto=format&fit=crop', label: 'ELITE SELECTION' },
  { id: 3, image_url: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=1200&auto=format&fit=crop', label: 'SHOP GLOBAL' },
];

const HeroBanner = ({ banners }) => {
  const [idx, setIdx] = useState(0);
  const data = banners.length > 0 ? banners : DEFAULT_BANNERS;

  useEffect(() => {
    const t = setInterval(() => setIdx(p => (p + 1) % data.length), 5000);
    return () => clearInterval(t);
  }, [data.length]);

  return (
    <div className="relative w-full h-48 lg:h-64 rounded-3xl overflow-hidden shadow-xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-900">
      {data.map((b, i) => (
        <div
          key={b.id || i}
          className={`absolute inset-0 transition-opacity duration-1000 ${i === idx ? 'opacity-100' : 'opacity-0'}`}
        >
          <img src={b.image_url} alt={b.label || ''} className="w-full h-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
          {(b.label || b.title) && (
            <div className="absolute bottom-6 left-6 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-xl border border-indigo-500/20 shadow-lg">
              <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{b.label || b.title}</span>
            </div>
          )}
        </div>
      ))}
      <div className="absolute bottom-5 right-6 flex gap-1.5">
        {data.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`h-1.5 rounded-full transition-all ${i === idx ? 'bg-indigo-500 w-6' : 'bg-white/40 w-1.5'}`}
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
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex justify-between items-center py-5 text-left gap-4"
      >
        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{q}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="pb-5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{a}</p>}
    </div>
  );
};

/* ─── Interactive AI Concierge Chat Box ─── */
const AIConciergePreview = () => {
  const [messages, setMessages] = useState([
    { sender: 'user', text: 'Ina son in tura kaya daga Kano zuwa London, ya za a yi?' },
    { sender: 'ai', text: 'Barka da zuwa! Zan taimaka muku. Na tanadi Elite Route na musamman don jigilar kayan ku zuwa London tare da cikakken tracking. Ko in hada ku da vendor na logistics?' }
  ]);
  const [typing, setTyping] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const script = [
      { trigger: 5000, sender: 'user', text: 'Eh, ina son in tura yanzu kuma in biya da wallet dina.' },
      { trigger: 9000, sender: 'ai', text: 'An riga an shirya! An cire ₦45,000 daga Wallet dinku. Lambar bibiya (Tracking ID): AM-LN-9921. Zaku iya ganin taswirar tafiyar yanzu.' }
    ];

    if (step >= script.length) return;

    const t = setTimeout(() => {
      setTyping(true);
      const typeT = setTimeout(() => {
        setMessages(prev => [...prev, { sender: script[step].sender, text: script[step].text }]);
        setTyping(false);
        setStep(s => s + 1);
      }, 1500);
      return () => clearTimeout(typeT);
    }, script[step].trigger);

    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[380px]">
      {/* Header */}
      <div className="bg-slate-950 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black text-sm">A</div>
          <div>
            <p className="text-white text-xs font-bold">Elite Concierge Service</p>
            <p className="text-[9px] text-emerald-400 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> AI Assistant Online
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500" />
        </div>
      </div>

      {/* Messages body */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 flex flex-col justify-end bg-slate-950/40">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs font-medium leading-relaxed ${
              m.sender === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/10' 
                : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/50'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start">
            <div className="bg-slate-800 text-slate-400 rounded-2xl rounded-bl-none px-4 py-2.5 text-xs font-medium border border-slate-700/50 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-2">
        <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-500 font-semibold italic">
          Elite Concierge handles translations & logistics...
        </div>
        <button className="bg-indigo-600 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

/* ═══════ MAIN LANDING PAGE COMPONENT ═══════ */
const Home = () => {
  const navigate = useNavigate();
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [banners, setBanners] = useState([]);
  const [promoBanners, setPromoBanners] = useState([]);
  const [promoIdx, setPromoIdx] = useState(0);
  const [flashSales, setFlashSales] = useState([]);
  
  // Interactive Hero tab state
  const [activeHeroTab, setActiveHeroTab] = useState('marketplace');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    // Fetch products
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

    // Fetch banners
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-300 relative overflow-hidden tech-grid-bg">
      <Navbar />

      {/* ─── Glow Blobs ─── */}
      <div className="absolute top-[10%] left-[-10%] w-[30rem] h-[30rem] rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-3xl pointer-events-none" />
      <div className="absolute top-[40%] right-[-10%] w-[35rem] h-[35rem] rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-[20%] left-[20%] w-[30rem] h-[30rem] rounded-full bg-pink-500/10 dark:bg-pink-500/5 blur-3xl pointer-events-none" />

      {/* ─── TICKER (Marquee) ─── */}
      <div className="bg-slate-900 border-b border-slate-800 py-3 overflow-hidden whitespace-nowrap z-10 relative">
        <div className="flex animate-marquee gap-16 items-center">
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
            <span key={i} className="text-[10px] font-black uppercase tracking-[0.25em] text-white/95 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 inline-block shadow-lg shadow-indigo-500/50" /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* ─── HERO SECTION ─── */}
      <section className="relative pt-12 pb-24 border-b border-slate-200/50 dark:border-slate-900/80">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Column */}
            <div className="space-y-8 relative z-10">
              <div className="inline-flex items-center gap-2 bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 fill-indigo-500/20" />
                The Autonomous Trade Hub
              </div>

              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black text-slate-900 dark:text-white leading-[1.05] tracking-tight">
                Discover the <br />
                <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  Elite Modern
                </span><br />
                Ecosystem
              </h1>

              <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed font-medium max-w-lg">
                Abu Mafhal is the premier multi-vendor network connecting quality African production, automated global air-cargo logistics, and premium user savings accounts under one digital hub.
              </p>

              {/* Action row */}
              <div className="flex flex-wrap gap-4 items-center">
                <Link
                  to="/shop"
                  className="inline-flex items-center gap-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-7 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all hover:scale-105 shadow-xl shadow-slate-950/10 hover:shadow-indigo-500/10 hover:bg-indigo-600 dark:hover:bg-indigo-50 hover:text-white dark:hover:text-slate-950"
                >
                  Start Exploring <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 px-7 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-indigo-500/30 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all hover:scale-105"
                >
                  Join Ecosystem
                </Link>
              </div>

              {/* Search Block */}
              <div className="relative group max-w-xl">
                <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden focus-within:border-indigo-500 focus-within:shadow-xl focus-within:shadow-indigo-500/5 transition-all p-1.5 glow-focus">
                  <Search className="w-4 h-4 text-slate-400 ml-4 flex-shrink-0" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Search premium products (e.g., watch, shoes)..."
                    className="flex-1 px-4 py-3 bg-transparent text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 font-semibold text-xs outline-none"
                  />
                  <button
                    onClick={handleSearch}
                    className="bg-indigo-600 text-white px-5 py-3 rounded-xl flex items-center justify-center hover:bg-indigo-500 transition-all font-black text-xs uppercase tracking-widest"
                  >
                    Find
                  </button>
                </div>
                {/* Quick suggestions */}
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Popular:</span>
                  {['AirPods', 'MacBook', 'Leather', 'Elite Watch'].map((t, i) => (
                    <button
                      key={i}
                      onClick={() => setSearchQuery(t)}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-[10px] text-slate-600 dark:text-slate-400 font-bold hover:bg-indigo-600 hover:text-white hover:border-indigo-600 dark:hover:bg-indigo-600 dark:hover:text-white transition-all shadow-sm"
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Dynamic Interactive Showcase Panel */}
            <div className="relative z-10">
              <div className="bg-slate-100 dark:bg-slate-900/30 p-2.5 rounded-3xl border border-slate-200/50 dark:border-slate-800/40">
                {/* Tabs selector */}
                <div className="grid grid-cols-3 gap-1.5 mb-3 bg-slate-200/50 dark:bg-slate-950/60 p-1.5 rounded-2xl">
                  {[
                    { id: 'marketplace', label: '🛍️ App View' },
                    { id: 'logistics', label: '✈️ Cargo Map' },
                    { id: 'vendor', label: '📊 Sales Hub' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveHeroTab(tab.id)}
                      className={`py-2 px-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 ${
                        activeHeroTab === tab.id
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/50 dark:border-slate-800/30'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Main Showcase Viewport */}
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-900 rounded-2xl h-[380px] p-5 relative overflow-hidden transition-all duration-500 shadow-xl">
                  {/* Grid overlay */}
                  <div className="absolute inset-0 bg-grid-slate-950/[0.01] dark:bg-grid-white/[0.01] pointer-events-none" />

                  {activeHeroTab === 'marketplace' && (
                    <div className="h-full flex flex-col justify-between relative text-left">
                      {/* Search & Categories Bar */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-900 pb-3">
                          <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Featured Shop</span>
                          </div>
                          <ShoppingBag className="w-4 h-4 text-indigo-500" />
                        </div>
                        <div className="flex gap-2">
                          {['All', 'Electronics', 'Apparel', 'Local Items'].map((cat, i) => (
                            <span key={i} className={`px-2.5 py-1 text-[9px] font-black rounded-lg border ${
                              i === 0 ? 'bg-indigo-500 text-white border-indigo-500' : 'bg-slate-50 dark:bg-slate-900 text-slate-500 border-slate-100 dark:border-slate-800'
                            }`}>{cat}</span>
                          ))}
                        </div>
                      </div>

                      {/* Mock Product Grid */}
                      <div className="grid grid-cols-2 gap-3 my-4">
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 space-y-2 relative group hover:border-indigo-500/20 transition-all">
                          <div className="h-20 bg-slate-200 dark:bg-slate-950 rounded-lg overflow-hidden relative">
                            <img src="https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=150" alt="" className="w-full h-full object-cover" />
                            <span className="absolute top-1 right-1 bg-indigo-500 text-white text-[7px] font-bold px-1 rounded">HOT</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">iPhone Elite Case</p>
                            <p className="text-xs font-black text-indigo-500 mt-0.5">₦32,500</p>
                          </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-2.5 space-y-2 relative hover:border-indigo-500/20 transition-all">
                          <div className="h-20 bg-slate-200 dark:bg-slate-950 rounded-lg overflow-hidden relative">
                            <img src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=150" alt="" className="w-full h-full object-cover" />
                            <span className="absolute top-1 right-1 bg-emerald-500 text-white text-[7px] font-bold px-1 rounded">20% off</span>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate">Elite Speed Shoes</p>
                            <p className="text-xs font-black text-indigo-500 mt-0.5">₦145,000</p>
                          </div>
                        </div>
                      </div>

                      {/* Floating Checkout Success Alert */}
                      <div className="bg-slate-900/90 dark:bg-white text-white dark:text-slate-950 rounded-xl p-2.5 flex items-center justify-between border border-indigo-500/20 dark:border-slate-200 shadow-lg animate-float">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                          <span className="text-[9px] font-bold">Escrow secured payout approved</span>
                        </div>
                        <ArrowUpRight className="w-3 h-3 text-slate-400" />
                      </div>
                    </div>
                  )}

                  {activeHeroTab === 'logistics' && (
                    <div className="h-full flex flex-col justify-between relative text-left">
                      {/* Live Logistics Route map */}
                      <div className="border-b border-slate-100 dark:border-slate-900 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cargo Route telemetry</span>
                        </div>
                        <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[8px] font-black uppercase tracking-widest rounded-lg">Live Active</span>
                      </div>

                      {/* Simulated map route */}
                      <div className="h-32 bg-slate-900 rounded-xl relative overflow-hidden my-3 border border-slate-800">
                        {/* Map nodes */}
                        <div className="absolute top-4 left-6 flex flex-col items-center">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                          <span className="text-[7px] font-black text-white uppercase mt-1">Kano, NG</span>
                        </div>
                        <div className="absolute bottom-6 right-8 flex flex-col items-center">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                          <span className="text-[7px] font-black text-white uppercase mt-1">London, UK</span>
                        </div>
                        {/* Connecting track path */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                          <path d="M 40 25 Q 120 70 230 90" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4 4" className="stroke-indigo-500" />
                        </svg>
                        <div className="absolute top-12 left-28 bg-indigo-600/90 text-white rounded-lg p-1.5 flex items-center gap-1.5 border border-indigo-400/30">
                          <Truck className="w-3 h-3 text-white" />
                          <span className="text-[8px] font-black">AM-990 (IN AIR)</span>
                        </div>
                      </div>

                      {/* Cargo Status Info */}
                      <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3 grid grid-cols-3 gap-2">
                        <div>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Altitude</p>
                          <p className="text-xs font-black text-slate-800 dark:text-white">32,500 ft</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">ETA London</p>
                          <p className="text-xs font-black text-indigo-500">4h 12m</p>
                        </div>
                        <div>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">Escrow Release</p>
                          <p className="text-xs font-black text-emerald-500">On Delivery</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeHeroTab === 'vendor' && (
                    <div className="h-full flex flex-col justify-between relative text-left">
                      {/* Vendor Dashboard stats */}
                      <div className="border-b border-slate-100 dark:border-slate-900 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Vendor Analytics Portal</span>
                        </div>
                        <span className="text-[9px] font-bold text-emerald-500">+34.8% growth</span>
                      </div>

                      {/* Earnings bar charts */}
                      <div className="my-4 space-y-3">
                        <div>
                          <div className="flex justify-between text-[9px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                            <span>Monthly Sales Goal</span>
                            <span>₦12,450,000 / ₦20,000,000</span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200/50 dark:border-slate-800/50">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: '62%' }} />
                          </div>
                        </div>

                        {/* Recent ledger transactions */}
                        <div className="space-y-1.5">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Recent Sales</p>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1.5 rounded-lg">
                              <span className="font-bold text-slate-700 dark:text-slate-300">Aminu I. (Lagos)</span>
                              <span className="font-black text-indigo-500">₦95,000</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-1.5 rounded-lg">
                              <span className="font-bold text-slate-700 dark:text-slate-300">Haruna K. (Dubai)</span>
                              <span className="font-black text-indigo-500">₦340,000</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Ledger Payout button */}
                      <div className="flex items-center gap-2 bg-slate-950 text-white rounded-xl p-2 border border-slate-800">
                        <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-[9px] font-mono text-slate-400">Console: Payout to wallet processed...</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PLATFORM KEY STATS ─── */}
      <div className="bg-white dark:bg-slate-900 border-y border-slate-200/50 dark:border-slate-900 relative z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-200/60 dark:divide-slate-800">
            {[
              { val: '₦1.2B+', label: 'Volume Transacted' },
              { val: '500+', label: 'Verified Sellers' },
              { val: '24/7', label: 'Air cargo routes' },
              { val: '100%', label: 'Escrow Insured' },
            ].map((s, i) => (
              <div key={i} className="text-center py-10 px-4">
                <div className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">{s.val}</div>
                <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-2">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── LIMITED FLASH DEALS SECTION ─── */}
      {flashSales.length > 0 && (
        <section className="py-20 px-6 bg-white dark:bg-slate-950 border-b border-slate-200/50 dark:border-slate-900/60 relative z-10">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-6 bg-indigo-500 rounded-full" />
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Active Flash Deals</h2>
              <span className="px-2.5 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-black uppercase tracking-widest rounded-full animate-pulse">
                {flashSales.length} Live Offer
              </span>
            </div>
            <div className="space-y-6">
              {flashSales.map(sale => (
                <FlashSaleCard key={sale.id} sale={sale} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── SPECIAL PROMOTIONS / ANNOUNCEMENTS ─── */}
      {banners.length > 0 && (
        <section className="py-16 px-6 bg-slate-50 dark:bg-slate-950/20 border-b border-slate-200/50 dark:border-slate-900/60 relative z-10">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-6 bg-indigo-500 rounded-full" />
              <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Ecosystem Announcements</h2>
            </div>
            <HeroBanner banners={banners} />
          </div>
        </section>
      )}

      {/* ─── PROMO BANNER SUB-SLIDER ─── */}
      {promoBanners.length > 0 && (
        <div className="py-10 bg-white dark:bg-slate-900 border-b border-slate-200/50 dark:border-slate-900 relative z-10">
          <div className="max-w-7xl mx-auto px-6">
            <div className="relative">
              <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${promoIdx * 100}%)` }}>
                {promoBanners.map((promo, i) => (
                  <div key={promo.id || i} className="min-w-full">
                    <div className="relative h-40 rounded-2xl overflow-hidden bg-slate-900 shadow-xl cursor-pointer border border-white/5" onClick={() => navigate('/shop')}>
                      <img src={promo.image_url} alt={promo.title} className="w-full h-full object-cover opacity-40 hover:scale-105 transition-transform duration-1000" />
                      <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/60 to-transparent" />
                      <div className="absolute inset-0 flex items-center px-8">
                        <div>
                          {promo.subtitle && (
                            <span className="inline-block bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg mb-2">
                              {promo.subtitle}
                            </span>
                          )}
                          <h3 className="text-xl lg:text-2xl font-black text-white">{promo.title || 'Special Promotion'}</h3>
                          <p className="text-indigo-400 text-xs mt-1.5 font-bold flex items-center gap-1">Explore Offer <ArrowRight className="w-3.5 h-3.5" /></p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {promoBanners.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-4">
                  {promoBanners.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setPromoIdx(i)}
                      className={`h-1.5 rounded-full transition-all ${i === promoIdx ? 'bg-indigo-500 w-6' : 'bg-slate-300 dark:bg-slate-800 w-1.5'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── ECOSYSTEM GRID ─── */}
      <section className="py-24 px-6 bg-slate-50 dark:bg-slate-950/40 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="mb-16 space-y-3">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.25em]">Core Infrastructure</p>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">The Abu Mafhal Ecosystem</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium max-w-lg">Everything you need to launch, trade, and deliver locally and abroad.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {ECOSYSTEM.map((card, i) => (
              <div
                key={i}
                className={`relative group bg-white dark:bg-slate-900 border ${card.color} rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-500 flex flex-col justify-between`}
              >
                <div className="relative h-48 overflow-hidden bg-slate-100 dark:bg-slate-950">
                  <img src={card.img} alt={card.tag} className="absolute inset-0 w-full h-full object-cover opacity-80 dark:opacity-60 group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-white dark:from-slate-900 via-transparent to-transparent" />
                  <div className="absolute top-4 left-4">
                    <span className="bg-slate-950/80 backdrop-blur-md text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border border-white/10">
                      {card.tag}
                    </span>
                  </div>
                </div>
                
                <div className="p-6 space-y-3 relative z-10 bg-white dark:bg-slate-900">
                  <h3 className="text-xl font-black text-slate-900 dark:text-white leading-tight">{card.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{card.desc}</p>
                  <Link
                    to="/shop"
                    className="inline-flex items-center gap-1.5 text-xs font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 uppercase tracking-widest pt-2 group"
                  >
                    Launch Service <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GLOBAL CONNECTIONS & MAP OVERLAY ─── */}
      <section className="px-6 pb-24 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="bg-slate-900 dark:bg-slate-900/60 border border-slate-800 rounded-3xl p-8 lg:p-16 relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 opacity-10 flex items-center justify-center animate-pulse-slow">
              <Globe className="w-[45rem] h-[45rem] text-indigo-400" />
            </div>

            {/* Simulated route pings */}
            <div className="absolute top-[20%] left-[30%] w-3 h-3 rounded-full bg-indigo-500 animate-ping opacity-60" />
            <div className="absolute top-[50%] left-[55%] w-3 h-3 rounded-full bg-indigo-500 animate-ping opacity-60" style={{ animationDelay: '0.8s' }} />
            <div className="absolute top-[35%] left-[72%] w-3 h-3 rounded-full bg-indigo-500 animate-ping opacity-60" style={{ animationDelay: '1.5s' }} />

            <div className="relative z-10 max-w-2xl space-y-6">
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest">
                Global Coverage
              </span>
              <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-tight">
                Global Cargo <br />
                Delivery Network
              </h2>
              <p className="text-slate-400 text-base leading-relaxed">
                Our logistics network connects premium merchants from local Nigerian hubs directly to buyers in 25+ countries with integrated real-time tracking, custom clearances, and escrow protection.
              </p>
              <div className="flex gap-12 pt-4">
                {[{ val: '25+', label: 'Active Countries' }, { val: '150+', label: 'Global Cargo Ports' }].map((s, i) => (
                  <div key={i}>
                    <div className="text-4xl font-black text-white">{s.val}</div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-indigo-400 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── FEATURED PRODUCTS SECTION ─── */}
      <section className="py-24 px-6 bg-white dark:bg-slate-950 border-y border-slate-200/50 dark:border-slate-900 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between mb-16">
            <div className="space-y-3">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.25em]">Curated Picks</p>
              <h2 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight">Featured Products</h2>
            </div>
            <Link to="/shop" className="flex items-center gap-1.5 text-xs font-black text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors uppercase tracking-widest group">
              View Shop <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="bg-slate-100 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/40 rounded-3xl h-64 animate-shimmer" />
              ))}
            </div>
          ) : featuredProducts.length === 0 ? (
            <div className="text-center py-20 bg-slate-50 dark:bg-slate-900/20 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
              <Package className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
              <p className="text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest text-xs">No active products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {featuredProducts.map(product => (
                <Link
                  key={product.id}
                  to={`/product/${product.id}`}
                  className="group bg-white dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-900 rounded-3xl overflow-hidden hover:shadow-xl hover:shadow-slate-200/50 dark:hover:shadow-indigo-950/20 hover:border-indigo-500/20 dark:hover:border-indigo-500/20 transition-all duration-300"
                >
                  <div className="relative h-48 overflow-hidden bg-slate-100 dark:bg-slate-950">
                    <img
                      src={
                        product.image_url ||
                        (Array.isArray(product.images) ? product.images[0] : null) ||
                        product.images?.[0] ||
                        'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=400&auto=format&fit=crop'
                      }
                      alt={product.name || 'Product'}
                      onError={e => { e.target.src = 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=400&auto=format&fit=crop'; }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    {product.discount > 0 && (
                      <span className="absolute top-3 right-3 bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-lg shadow-md">
                        -{product.discount}%
                      </span>
                    )}
                    <span className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border border-white/10">
                      Elite Pick
                    </span>
                  </div>
                  <div className="p-5 space-y-2.5">
                    {(product.category_name || product.category) && (
                      <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{product.category_name || product.category}</p>
                    )}
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 text-xs line-clamp-2 leading-tight h-8">{product.name || 'Product'}</h3>
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-900">
                      <div>
                        <span className="font-black text-slate-900 dark:text-white text-base">₦{(product.price || 0).toLocaleString()}</span>
                        {product.discount > 0 && (
                          <span className="text-[10px] text-slate-400 line-through ml-2">
                            ₦{Math.round((product.price || 0) / (1 - (product.discount / 100))).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <div className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 flex items-center justify-center group-hover:bg-indigo-600 group-hover:border-indigo-600 transition-all">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
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
      <section className="py-24 px-6 bg-slate-50 dark:bg-slate-950/30 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row gap-16">
            <div className="lg:w-1/3 space-y-5">
              <div className="w-1.5 h-12 bg-indigo-500 rounded-full" />
              <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Ecosystem Journey</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed">The evolution of the Abu Mafhal ecosystem from genesis conceptualization to global automated systems.</p>
            </div>

            <div className="flex-1 space-y-6 relative">
              <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-800" />
              {MILESTONES.map((m, i) => (
                <div key={i} className="relative flex gap-8">
                  <div className={`w-12 h-12 rounded-2xl border-2 ${m.color} flex items-center justify-center z-10 flex-shrink-0 shadow-sm`}>
                    <m.icon className="w-5 h-5 text-inherit" />
                  </div>
                  <div className={`flex-1 p-8 rounded-3xl border bg-white dark:bg-slate-900 ${
                    m.future ? 'border-emerald-500/20 shadow-emerald-500/5' : 'border-slate-200/60 dark:border-slate-900 shadow-sm'
                  } hover:shadow-md transition-all`}>
                    <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${m.future ? 'text-emerald-500' : 'text-indigo-500'}`}>{m.year}</p>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">{m.label}</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-xs leading-relaxed">{m.text}</p>
                    {m.future && (
                      <span className="mt-3 inline-block px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] font-black uppercase tracking-widest rounded-lg">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── MEMBERSHIP CARDS MATRIX (Pricing) ─── */}
      <section className="py-24 px-6 bg-white dark:bg-slate-950 border-y border-slate-200/50 dark:border-slate-900 relative z-10">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Pricing & Access Levels</p>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">Membership Comparison</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mx-auto">Compare basic client registration and elite membership access.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch max-w-4xl mx-auto">
            {/* Basic Tier Card */}
            <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/40 rounded-3xl p-8 flex flex-col justify-between space-y-8 relative">
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white">Basic User</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Free client account for standard retail buyers.</p>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white">₦0 <span className="text-xs text-slate-400 font-bold">/ lifetime</span></div>
                
                <hr className="border-slate-200 dark:border-slate-850" />
                
                <ul className="space-y-3">
                  {[
                    'Access to full Multi-Vendor marketplace',
                    'Escrow secure standard local trade',
                    'Standard wallet deposit / withdrawal',
                    'Standard logistics dispatch tracking',
                    '1% loyalty cashback points'
                  ].map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-400">
                      <Check className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link to="/register" className="w-full bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white py-3.5 rounded-xl text-center text-xs font-black uppercase tracking-widest transition-all">
                Create Free Account
              </Link>
            </div>

            {/* Elite VIP Tier Card */}
            <div className="bg-gradient-to-br from-indigo-900 via-purple-950 to-slate-950 border border-indigo-500/35 rounded-3xl p-8 flex flex-col justify-between space-y-8 relative overflow-hidden shadow-2xl">
              {/* Gold gradient glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
              
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-black text-white">Elite Member</h3>
                    <p className="text-xs text-indigo-300 font-medium mt-1">Premium VIP access tier for merchants & shoppers.</p>
                  </div>
                  <span className="bg-amber-400 text-slate-950 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-md">
                    <Star className="w-3 h-3 fill-slate-950" /> VIP Elite
                  </span>
                </div>
                <div className="text-3xl font-black text-white">₦15,000 <span className="text-xs text-indigo-300 font-bold">/ monthly</span></div>
                
                <hr className="border-indigo-500/20" />
                
                <ul className="space-y-3">
                  {[
                    'Priority air-cargo logistics slots',
                    '24/7 dedicated human concierge assistant',
                    'Escrow release prioritization',
                    'Early access to limited global drops',
                    '5% loyalty cashback rewards points',
                    'Exclusive VIP dashboard access'
                  ].map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                      <Check className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link to="/register" className="w-full bg-gradient-to-r from-amber-400 to-indigo-500 hover:from-amber-300 hover:to-indigo-400 text-slate-950 font-black py-3.5 rounded-xl text-center text-xs uppercase tracking-widest transition-all hover:scale-[1.02] shadow-lg shadow-indigo-600/20">
                Upgrade to Elite VIP
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI CONCIERGE & TESTIMONIALS ─── */}
      <section className="py-24 px-6 bg-slate-50 dark:bg-slate-950/20 border-b border-slate-200/50 dark:border-slate-900 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Chat simulator mockup (Left) */}
          <div>
            <AIConciergePreview />
          </div>

          {/* Core Info (Right) */}
          <div className="space-y-6">
            <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest">
              Dedicated Support
            </span>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">
              Elite Concierge 24/7
            </h2>
            <p className="text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
              We understand cross-border trade is complex. That's why our VIP members receive immediate dedicated assistance to translate requests, coordinate multi-vendor cargo deliveries, and verify product compliance manually before transit.
            </p>

            <div className="flex gap-4">
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
                <Shield className="w-6 h-6 text-indigo-500" />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Escrow Security</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Insured Trades Only</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl shadow-sm">
                <HeadphonesIcon className="w-6 h-6 text-indigo-500" />
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Response Speed</p>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">&lt; 3 mins Average</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIAL FEEDBACKS ─── */}
      <section className="py-24 px-6 bg-white dark:bg-slate-950 border-b border-slate-200/50 dark:border-slate-900/65 relative z-10">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3">
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Ecosystem Feedback</p>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white tracking-tight">What Our Users Say</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-slate-50 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-850 rounded-3xl p-8 space-y-6 hover:shadow-lg hover:border-indigo-500/20 transition-all duration-300">
                <div className="flex gap-1.5">
                  {[...Array(5)].map((_, j) => <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-medium text-xs leading-relaxed italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3.5 pt-2 border-t border-slate-200/40 dark:border-slate-800">
                  <div className={`w-10 h-10 ${t.color} rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg`}>{t.initials}</div>
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-white">{t.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="py-24 px-6 bg-slate-50 dark:bg-slate-950/20 border-b border-slate-200/50 dark:border-slate-900 relative z-10">
        <div className="max-w-3xl mx-auto space-y-8">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight text-center">Frequently Questions</h2>
          <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-850 rounded-3xl px-8 py-2 shadow-sm">
            {FAQS.map((f, i) => <FaqItem key={i} {...f} />)}
          </div>
        </div>
      </section>

      {/* ─── MOBILE APP EXCLUSIVE CODES & PHONE PERSPECTIVE ─── */}
      <section className="py-24 px-6 bg-white dark:bg-slate-950 border-b border-slate-200/50 dark:border-slate-900 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="bg-slate-50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-850 rounded-3xl p-8 lg:p-16 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

            <div className="flex flex-col lg:flex-row items-center gap-16 justify-between">
              {/* Content left */}
              <div className="flex-1 space-y-8 text-left">
                <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 dark:text-indigo-400 rounded-full px-3.5 py-1 text-xs font-black uppercase tracking-widest">
                  Ecosystem Client App
                </span>
                <h2 className="text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  The Complete Hub <br />
                  In Your Pocket
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed font-medium max-w-md">
                  Download the Abu Mafhal mobile client to deposit escrow funds, activate quick P2P savings pots, track shipping routes in real-time, and get live alerts on vendor price-drops instantly.
                </p>

                {/* Benefits cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                      <Zap className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-black text-slate-950 dark:text-white text-xs">Pots & Budgets</p>
                      <p className="text-[9px] text-slate-400 font-bold">Functional saving pots</p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                    <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                      <Globe className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-black text-slate-950 dark:text-white text-xs">Map Tracking</p>
                      <p className="text-[9px] text-slate-400 font-bold">Real-time GPS delivery</p>
                    </div>
                  </div>
                </div>

                {/* App store links */}
                <div className="flex flex-wrap gap-4 pt-2">
                  <button className="flex items-center gap-3 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl transition-all hover:scale-105 shadow-xl">
                    <Rocket className="w-5 h-5 text-indigo-400" />
                    <div className="text-left">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Get it on</p>
                      <p className="text-xs font-black">Google Play</p>
                    </div>
                  </button>
                  <button className="flex items-center gap-3 bg-slate-900 hover:bg-slate-800 text-white px-5 py-3 rounded-2xl transition-all hover:scale-105 shadow-xl">
                    <Award className="w-5 h-5 text-indigo-400" />
                    <div className="text-left">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Download on</p>
                      <p className="text-xs font-black">App Store</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Isometric Phone container (Right) */}
              <div className="w-56 h-[400px] bg-slate-950 rounded-[2.8rem] border-[8px] border-slate-900 shadow-2xl relative flex-shrink-0 overflow-hidden hover:scale-105 transition-transform duration-500">
                <div className="w-full h-full bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-5 space-y-4">
                  {/* Phone Notch */}
                  <div className="w-24 h-4 bg-slate-900 rounded-full mx-auto mb-2 border border-slate-850" />
                  
                  {/* Mock content */}
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xs">A</div>
                    <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping" />
                  </div>
                  
                  <div className="space-y-1 pt-2">
                    <div className="h-3 bg-white/20 rounded-full w-2/3" />
                    <div className="h-2 bg-white/10 rounded-full w-1/2" />
                  </div>

                  <div className="h-24 bg-white/5 rounded-2xl border border-white/5 p-3 flex flex-col justify-between">
                    <p className="text-[8px] font-black text-indigo-400 uppercase">Savings Pots Balance</p>
                    <p className="text-sm font-black text-white">₦2,450,000</p>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: '75%' }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="h-12 bg-white/5 rounded-xl border border-white/5 p-2 flex flex-col justify-between">
                      <span className="text-[7px] text-slate-400">Active Goals</span>
                      <span className="text-xs font-bold text-white">3 Active</span>
                    </div>
                    <div className="h-12 bg-white/5 rounded-xl border border-white/5 p-2 flex flex-col justify-between">
                      <span className="text-[7px] text-slate-400">Total Saved</span>
                      <span className="text-xs font-bold text-emerald-400">₦850k</span>
                    </div>
                  </div>

                  {/* Micro-badge */}
                  <div className="bg-indigo-600/90 text-white rounded-xl p-2 text-center border border-indigo-400/20 text-[8px] font-bold">
                    Escrow Insured Account Active
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── NEWSLETTER JOIN ─── */}
      <section className="py-24 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <div className="relative bg-gradient-to-br from-indigo-700 via-indigo-900 to-slate-950 rounded-3xl overflow-hidden p-12 lg:p-20 text-center border border-indigo-500/20 shadow-2xl">
            <div className="absolute inset-0 opacity-10 flex items-center justify-center animate-pulse-slow">
              <Globe className="w-[30rem] h-[30rem] text-white" />
            </div>
            <div className="relative z-10 space-y-6 max-w-xl mx-auto">
              <Mail className="w-10 h-10 text-indigo-300 mx-auto" />
              <h2 className="text-4xl font-black text-white tracking-tight">Elite Newsletter</h2>
              <p className="text-indigo-200 text-sm font-medium leading-relaxed">
                Stay updated on new air cargo routes, select premium vendor product launches, and exclusive member discounts directly to your inbox.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto p-1 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-md">
                <input
                  type="email"
                  placeholder="Enter your email address"
                  className="flex-1 bg-transparent text-white placeholder-indigo-300 font-semibold text-xs rounded-xl px-5 py-4 outline-none border-0"
                />
                <button className="bg-white text-indigo-900 font-black text-xs uppercase tracking-widest px-6 py-4 rounded-xl hover:bg-slate-100 transition-all hover:scale-105 shadow-xl">
                  Subscribe
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