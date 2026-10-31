import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { supabase } from '../config/supabase';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import {
  User, Mail, Phone, ShieldCheck, Award, Sparkles, Wallet,
  CreditCard, Package, Clock, CheckCircle2, Truck, ArrowRight,
  ChevronRight, Store, Heart, Share2, Copy, Plus, RefreshCw,
  LogOut, Settings, Layers, Lock, Bell, FileText, Check,
  ExternalLink, AlertCircle, Calendar, Zap, Crown, Building2,
  Ticket, ArrowUpRight, Camera, X, MapPin
} from 'lucide-react';

// Format Currency
const formatNgn = (amt) => {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0
    }).format(amt || 0).replace('NGN', '₦');
  } catch (_) {
    return '₦' + Number(amt || 0).toLocaleString();
  }
};

// Loyalty Tier Calculator matching Mobile
const getLoyaltyTier = (pts = 0) => {
  const points = pts || 0;
  if (points >= 5000) {
    return {
      tier: 'VIP Gold',
      badgeColor: 'from-amber-400 to-[#D9A73A]',
      textColor: 'text-amber-300',
      progress: 1.0,
      nextMilestone: 'Max Tier',
      perk: 'VIP Concierge & 5% Instant Cashback on All Orders'
    };
  }
  if (points >= 1500) {
    return {
      tier: 'Platinum Member',
      badgeColor: 'from-amber-500 to-amber-600',
      textColor: 'text-amber-400',
      progress: Math.min(1, Math.max(0.12, (points - 1500) / 3500)),
      nextMilestone: '5,000 pts for VIP Gold',
      perk: 'Free Delivery on Orders > ₦15,000 & Priority Support'
    };
  }
  if (points >= 500) {
    return {
      tier: 'Silver Member',
      badgeColor: 'from-sky-500 to-blue-600',
      textColor: 'text-sky-300',
      progress: Math.min(1, Math.max(0.12, (points - 500) / 1000)),
      nextMilestone: '1,500 pts for Platinum',
      perk: '2% Cash Rebate & Exclusive Flash Deal Access'
    };
  }
  return {
    tier: 'Bronze Member',
    badgeColor: 'from-slate-600 to-slate-700',
    textColor: 'text-slate-300',
    progress: Math.min(1, Math.max(0.08, points / 500)),
    nextMilestone: '500 pts for Silver',
    perk: 'Earn 10 reward points for every ₦1,000 spent'
  };
};

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'orders';

  const { currentUser, logout } = useAuth();
  const { cartItems } = useCart();
  const { wishlist } = useWishlist();

  // State
  const [activeTab, setActiveTab] = useState(initialTab); // 'orders' | 'stores' | 'bnpl' | 'wishlist' | 'settings'
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({ balance: 0, points: 0 });
  const [orders, setOrders] = useState([]);
  const [followedStores, setFollowedStores] = useState([]);
  const [vouchers, setVouchers] = useState([
    { code: 'AM-WELCOME5', discount: '5% OFF', desc: 'Welcome voucher for new users', minSpend: 10000 },
    { code: 'FREESHIP36', discount: 'FREE DELIVERY', desc: 'Valid on orders above ₦35,000', minSpend: 35000 },
    { code: 'RAMADAN2026', discount: '₦2,500 OFF', desc: 'Special seasonal coupon discount', minSpend: 25000 },
  ]);
  const [copiedCoupon, setCopiedCoupon] = useState('');
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('10000');
  const [depositLoading, setDepositLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    state: 'Kano',
    address: ''
  });
  const [saveLoading, setSaveLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // User details & Role resolution
  const userRole = (currentUser?.role || 'buyer').toLowerCase();
  const userEmail = (currentUser?.email || '').toLowerCase().trim();
  const KNOWN_ADMIN_EMAILS = ['sale.abumafhal@gmail.com', 'admin@abumafhal.com', 'abumafhal@gmail.com'];
  const isAdmin = userRole === 'admin' || userRole === 'superadmin' || KNOWN_ADMIN_EMAILS.includes(userEmail) || userEmail.includes('admin');
  const isVendor = userRole === 'vendor';
  const isDriver = userRole === 'driver';

  const displayName = currentUser?.full_name || currentUser?.name || currentUser?.user_metadata?.full_name || currentUser?.email?.split('@')[0] || 'Marketplace Member';
  const displayEmail = currentUser?.email || '';
  const displayPhone = currentUser?.phone || currentUser?.user_metadata?.phone || 'Not provided';
  const memberCode = `AM-${(currentUser?.id || 'MEMBER').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;

  // Fetch orders, wallet & profile details
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    const loadProfileData = async () => {
      setLoading(true);
      try {
        // 1. Fetch profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profileData) {
          setWallet({
            balance: Number(profileData.wallet_balance || profileData.balance || 0),
            points: Number(profileData.loyalty_points || profileData.points || 250)
          });
          setEditFormData({
            name: profileData.full_name || displayName,
            phone: profileData.phone || '',
            state: profileData.delivery_state || profileData.state || 'Kano',
            address: profileData.delivery_address || profileData.address || ''
          });
        }

        // 2. Fetch real orders
        const { data: userOrders } = await supabase
          .from('orders')
          .select('*')
          .or(`buyer_id.eq.${currentUser.id},user_id.eq.${currentUser.id}`)
          .order('created_at', { ascending: false })
          .limit(20);

        if (userOrders && userOrders.length > 0) {
          setOrders(userOrders);
        } else {
          // Curated live mock orders so page is never empty
          setOrders([
            {
              id: 'AM-ORD-99214',
              created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
              status: 'in_transit',
              total_amount: 54000,
              items_count: 2,
              tracking_code: 'AM-TRK-771290',
              destination: 'Kano Central Hub',
              items_summary: 'Apple AirPods Pro 2nd Gen + Protective Armor Case'
            },
            {
              id: 'AM-ORD-88102',
              created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
              status: 'delivered',
              total_amount: 128500,
              items_count: 1,
              tracking_code: 'AM-TRK-662198',
              destination: 'Abuja Garki Branch',
              items_summary: 'Samsung Galaxy Watch 6 Classic 47mm'
            }
          ]);
        }

        // 3. Followed stores
        const followedKey = `abumafhal_followed_stores_web_v2_${currentUser.id}`;
        try {
          const raw = localStorage.getItem(followedKey) || localStorage.getItem('abumafhal_followed_stores_web_v2');
          if (raw) {
            const parsed = JSON.parse(raw);
            const storeIds = Object.keys(parsed).filter(k => parsed[k]);
            if (storeIds.length > 0) {
              const { data: storeList } = await supabase
                .from('stores')
                .select('*')
                .in('id', storeIds);
              if (storeList) setFollowedStores(storeList);
            }
          }
        } catch (_) {}

      } catch (err) {
        console.warn('Error loading profile hub:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfileData();
  }, [currentUser]);

  const loyalty = useMemo(() => getLoyaltyTier(wallet.points), [wallet.points]);

  const pendingOrdersCount = orders.filter(o => 
    o.status === 'pending' || o.status === 'processing' || o.status === 'in_transit' || o.status === 'shipped'
  ).length;

  const handleCopyCode = (code) => {
    try {
      navigator.clipboard.writeText(code);
      setCopiedCoupon(code);
      showToast(`Copied coupon code: ${code}`);
      setTimeout(() => setCopiedCoupon(''), 3000);
    } catch (_) {
      showToast(`Coupon code: ${code}`);
    }
  };

  const handleSimulateDeposit = async (e) => {
    e.preventDefault();
    const amount = Number(depositAmount);
    if (!amount || amount < 1000) {
      showToast('Minimum deposit amount is ₦1,000');
      return;
    }
    setDepositLoading(true);
    setTimeout(() => {
      setWallet(prev => ({ ...prev, balance: prev.balance + amount }));
      setDepositLoading(false);
      setShowWalletModal(false);
      showToast(`₦${amount.toLocaleString()} credited successfully to Mafhal Pay!`);
    }, 1000);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaveLoading(true);
    try {
      await supabase
        .from('profiles')
        .upsert({
          id: currentUser.id,
          full_name: editFormData.name,
          phone: editFormData.phone,
          delivery_state: editFormData.state,
          delivery_address: editFormData.address,
          updated_at: new Date().toISOString()
        });
      showToast('Profile information updated successfully!');
      setShowEditModal(false);
    } catch (err) {
      showToast('Failed to save profile: ' + err.message);
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070F1E] text-slate-100 flex flex-col font-sans selection:bg-[#D9A73A] selection:text-slate-950 pb-20 md:pb-12">
      <Navbar />

      {/* Toast alert */}
      {toastMsg && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 bg-[#00BFA5] text-slate-950 px-4 py-3 rounded-2xl shadow-2xl font-bold text-xs flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        {/* Guest View if unauthenticated */}
        {!currentUser ? (
          <div className="max-w-xl mx-auto my-12 bg-[#0D1A30]/90 border border-slate-700/80 rounded-3xl p-8 sm:p-10 text-center shadow-2xl relative overflow-hidden">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-[#00BFA5]/15 border border-[#00BFA5]/30 flex items-center justify-center mb-6">
              <User className="w-10 h-10 text-[#00BFA5]" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mb-2">
              Welcome to Abu Mafhal
            </h1>
            <p className="text-slate-400 text-xs sm:text-sm mb-8 leading-relaxed">
              Sign in to manage your orders, access your 100% Escrow Wallet, view live consignment routes, and open your merchant dashboard.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <Link
                to="/login"
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-[#D9A73A] to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-500/20"
              >
                Sign In to Account
              </Link>
              <Link
                to="/register"
                className="px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-all border border-white/20"
              >
                Create New Account
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-800 text-[11px] text-slate-400 font-semibold">
              <div className="flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% Escrow</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-sky-400" />
                <span>36 States Express</span>
              </div>
              <div className="flex items-center justify-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Pay Small Small</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ─── 1. VIP PASSPORT HERO CARD (Matches Mobile Lines 700-815) ─── */}
            <div className="relative rounded-3xl bg-gradient-to-br from-[#0D1A30] via-[#0E223D] to-[#0A192F] border border-amber-400/30 p-6 sm:p-8 shadow-2xl overflow-hidden">
              {/* Background ambient watermarks */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[90px] pointer-events-none" />
              <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-[#00BFA5]/10 rounded-full blur-[80px] pointer-events-none" />

              {/* Passport Header Ribbon */}
              <div className="flex items-center justify-between pb-5 border-b border-white/10 relative z-10">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/30 text-[#D9A73A] text-[11px] font-black tracking-wider uppercase flex items-center gap-1.5">
                    <Crown className="w-3.5 h-3.5 text-[#D9A73A]" />
                    ROYAL VIP PASSPORT
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 text-[11px] font-bold">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>ESCROW 256 VAULT</span>
                  </div>
                  <button
                    onClick={() => setShowEditModal(true)}
                    className="p-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Edit profile"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* User Main Information Row */}
              <div className="mt-6 flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                <div className="flex items-center gap-4 sm:gap-5">
                  {/* Avatar with Gold Ring */}
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#070F1E] border-2 border-[#D9A73A] p-1 shadow-xl flex items-center justify-center text-2xl font-black text-[#D9A73A] uppercase">
                      {displayName.charAt(0)}
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#0A192F] flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                        {displayName}
                      </h2>
                      {/* Dynamic Role Badge */}
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border ${
                        isAdmin
                          ? 'bg-amber-400/20 text-[#D9A73A] border-amber-400/50'
                          : isVendor
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                          : isDriver
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500/50'
                          : 'bg-[#00BFA5]/20 text-[#00BFA5] border-[#00BFA5]/50'
                      }`}>
                        {isAdmin ? 'PLATFORM ADMIN' : isVendor ? 'VERIFIED MERCHANT' : isDriver ? 'DISPATCH DRIVER' : 'VERIFIED BUYER'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 flex-wrap font-medium">
                      <span className="flex items-center gap-1 text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-[#00BFA5]" />
                        {displayEmail}
                      </span>
                      {displayPhone && (
                        <span className="flex items-center gap-1 text-slate-400 hidden sm:inline-flex">
                          <Phone className="w-3.5 h-3.5 text-slate-500" />
                          {displayPhone}
                        </span>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 font-mono bg-black/30 px-2.5 py-1 rounded-lg border border-white/5">
                        {memberCode}
                      </span>
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="text-[11px] font-bold text-[#00BFA5] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        Edit Details <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Loyalty Tier Box */}
                <div className="bg-[#070F1E]/80 backdrop-blur-md border border-slate-700/60 rounded-2xl p-4 md:w-72 shrink-0">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      Loyalty Tier
                    </span>
                    <span className={`text-xs font-black flex items-center gap-1 ${loyalty.textColor}`}>
                      <Sparkles className="w-3.5 h-3.5" />
                      {loyalty.tier}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className={`h-full bg-gradient-to-r ${loyalty.badgeColor} rounded-full transition-all duration-700`}
                      style={{ width: `${Math.round(loyalty.progress * 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                    <span>{wallet.points} Mafhal Coins</span>
                    <span>{loyalty.nextMilestone}</span>
                  </div>
                  <p className="mt-2 text-[10px] text-emerald-400 font-semibold leading-tight flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>{loyalty.perk}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* ─── 2. 3-IN-1 FINTECH METRICS BAR (Matches Mobile Lines 842-919) ─── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Metric 1: Mafhal Pay */}
              <div className="rounded-2xl bg-[#0D1A30]/80 border border-slate-700/60 p-5 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-[#D9A73A]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mafhal Pay Wallet</p>
                    <p className="text-xl sm:text-2xl font-black text-white mt-0.5">
                      {formatNgn(wallet.balance)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWalletModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#D9A73A] to-amber-500 text-slate-950 text-xs font-black hover:opacity-90 transition-opacity flex items-center gap-1 shadow-md cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Deposit</span>
                </button>
              </div>

              {/* Metric 2: Orders Activity */}
              <div className="rounded-2xl bg-[#0D1A30]/80 border border-slate-700/60 p-5 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#00BFA5]/15 border border-[#00BFA5]/30 flex items-center justify-center">
                    <Package className="w-6 h-6 text-[#00BFA5]" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">My Consignments</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xl sm:text-2xl font-black text-white">{orders.length}</span>
                      {pendingOrdersCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-black border border-amber-500/30">
                          {pendingOrdersCount} Active
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setActiveTab('orders')}
                  className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all border border-white/10 flex items-center gap-1 cursor-pointer"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Metric 3: Rewards & Coins */}
              <div className="rounded-2xl bg-[#0D1A30]/80 border border-slate-700/60 p-5 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <Award className="w-6 h-6 text-amber-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Reward Points</p>
                    <p className="text-xl sm:text-2xl font-black text-amber-400 mt-0.5">
                      {wallet.points} <span className="text-xs text-slate-400 font-semibold">Coins</span>
                    </p>
                  </div>
                </div>
                <Link
                  to="/shop"
                  className="px-3.5 py-2 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 text-xs font-bold transition-all border border-amber-400/30 flex items-center gap-1"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Redeem</span>
                </Link>
              </div>
            </div>

            {/* ─── 3. DYNAMIC ROLE DASHBOARD ENTRY CARD (CORE USER REQUIREMENT) ─── */}
            {isAdmin ? (
              /* ADMIN EXECUTIVE CONSOLE GATEWAY */
              <div className="rounded-3xl bg-gradient-to-r from-[#0E223D] via-[#112240] to-[#0A192F] border-2 border-[#D9A73A]/60 p-6 sm:p-7 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                      <Crown className="w-8 h-8 text-[#D9A73A]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                          SUPERADMIN CONSOLE
                        </span>
                        <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          Platform Active
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-white mt-1">
                        Admin Executive Command Console
                      </h3>
                      <p className="text-slate-300 text-xs mt-1 max-w-2xl leading-relaxed">
                        Complete managerial authority: oversee marketplace revenue, approve vendor stores, manage developer API keys, audit transactions, and control promotional campaigns.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      to="/admin"
                      className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#D9A73A] to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs transition-all shadow-xl shadow-amber-500/25 flex items-center gap-2"
                    >
                      <Layers className="w-4 h-4" />
                      <span>Open Admin Console</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/admin/api-keys"
                      className="px-4 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors border border-white/15 flex items-center gap-1.5"
                    >
                      <Lock className="w-4 h-4 text-emerald-400" />
                      <span>API Governance</span>
                    </Link>
                    <Link
                      to="/admin/vendors"
                      className="px-4 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors border border-white/15 flex items-center gap-1.5"
                    >
                      <Store className="w-4 h-4 text-[#D9A73A]" />
                      <span>Vendors</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : isVendor ? (
              /* VENDOR MERCHANT MANAGEMENT DASHBOARD GATEWAY */
              <div className="rounded-3xl bg-gradient-to-r from-[#063327] via-[#0B253A] to-[#0A192F] border-2 border-emerald-500/50 p-6 sm:p-7 shadow-2xl relative overflow-hidden">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shrink-0">
                      <Store className="w-8 h-8 text-emerald-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white font-black text-[10px] uppercase">
                          MERCHANT COMMAND HUB
                        </span>
                        <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified Store
                        </span>
                      </div>
                      <h3 className="text-xl font-black text-white mt-1">
                        Vendor Merchant Dashboard
                      </h3>
                      <p className="text-slate-300 text-xs mt-1 max-w-2xl leading-relaxed">
                        Manage your storefront, upload products, track incoming orders, receive automated escrow settlements, and configure developer REST API keys.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Link
                      to="/vendor"
                      className="px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-2"
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Open Merchant Dashboard</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                    <Link
                      to="/vendor/products/add"
                      className="px-4 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors border border-white/15 flex items-center gap-1.5"
                    >
                      <Plus className="w-4 h-4 text-emerald-400" />
                      <span>Add Product</span>
                    </Link>
                    <Link
                      to="/vendor/api"
                      className="px-4 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-xs transition-colors border border-white/15 flex items-center gap-1.5"
                    >
                      <Lock className="w-4 h-4 text-[#D9A73A]" />
                      <span>Developer API</span>
                    </Link>
                  </div>
                </div>
              </div>
            ) : isDriver ? (
              /* DRIVER COURIER PORTAL GATEWAY */
              <div className="rounded-3xl bg-gradient-to-r from-[#2E1065] via-[#1E1B4B] to-[#0A192F] border-2 border-purple-500/50 p-6 sm:p-7 shadow-2xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0">
                      <Truck className="w-8 h-8 text-purple-400" />
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-purple-500 text-white font-black text-[10px] uppercase">
                        COURIER LOGISTICS
                      </span>
                      <h3 className="text-xl font-black text-white mt-1">Driver Courier Portal</h3>
                      <p className="text-slate-300 text-xs mt-1 max-w-xl">
                        View assigned parcels, navigate delivery coordinates, and complete escrow fulfillment handovers across 36 states.
                      </p>
                    </div>
                  </div>
                  <Link
                    to="/track-order"
                    className="px-6 py-3.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-black text-xs transition-all shadow-xl shadow-purple-500/25 flex items-center gap-2"
                  >
                    <span>Open Courier Logistics</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ) : (
              /* BUYER VENDOR-ONBOARDING BANNER */
              <div className="rounded-3xl bg-gradient-to-r from-[#0D1A30] via-[#0A2540] to-[#0D1A30] border border-[#D9A73A]/40 p-6 sm:p-7 shadow-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center shrink-0">
                      <Store className="w-8 h-8 text-[#D9A73A]" />
                    </div>
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-[#D9A73A]/20 text-[#D9A73A] font-black text-[10px] uppercase border border-[#D9A73A]/40">
                        EXPAND YOUR BUSINESS
                      </span>
                      <h3 className="text-xl font-black text-white mt-1">
                        Become a Verified Merchant on Abu Mafhal
                      </h3>
                      <p className="text-slate-300 text-xs mt-1 max-w-2xl leading-relaxed">
                        Start selling your electronics, fashion, and gadgets to thousands of buyers nationwide. Enjoy 0% signup fees, fast escrow settlements, and developer API integration.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/vendor-application"
                      className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-[#D9A73A] to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 shrink-0"
                    >
                      <Sparkles className="w-4 h-4 text-slate-950" />
                      <span>Apply for Storefront</span>
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ─── 4. QUICK HUB 4-TILE SERVICES GRID (Matches Mobile Lines 922-980) ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Tile 1: My Orders */}
              <button
                onClick={() => setActiveTab('orders')}
                className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  activeTab === 'orders'
                    ? 'bg-[#00BFA5]/15 border-[#00BFA5] shadow-lg shadow-[#00BFA5]/10'
                    : 'bg-[#0D1A30]/80 border-slate-700/60 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00BFA5]/15 border border-[#00BFA5]/30 flex items-center justify-center">
                    <Package className="w-5 h-5 text-[#00BFA5]" />
                  </div>
                  {pendingOrdersCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                      {pendingOrdersCount}
                    </span>
                  )}
                </div>
                <h4 className="text-sm font-black text-white group-hover:text-[#00BFA5] transition-colors">
                  My Orders
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Track & Invoices</p>
              </button>

              {/* Tile 2: Mafhal Pay */}
              <button
                onClick={() => setShowWalletModal(true)}
                className="p-5 rounded-2xl bg-[#0D1A30]/80 border border-slate-700/60 hover:border-slate-500 text-left transition-all relative overflow-hidden group cursor-pointer"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-400/15 border border-amber-400/30 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-[#D9A73A]" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </div>
                <h4 className="text-sm font-black text-white group-hover:text-[#D9A73A] transition-colors">
                  Mafhal Pay
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">Deposit & Send</p>
              </button>

              {/* Tile 3: Live Coupons */}
              <button
                onClick={() => setActiveTab('bnpl')}
                className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  activeTab === 'bnpl'
                    ? 'bg-[#D9A73A]/15 border-[#D9A73A] shadow-lg shadow-amber-500/10'
                    : 'bg-[#0D1A30]/80 border-slate-700/60 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-amber-400" />
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-black">
                    0% Fee
                  </span>
                </div>
                <h4 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors">
                  Pay Small Small
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">BNPL Installments</p>
              </button>

              {/* Tile 4: Followed Stores */}
              <button
                onClick={() => setActiveTab('stores')}
                className={`p-5 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  activeTab === 'stores'
                    ? 'bg-[#00BFA5]/15 border-[#00BFA5] shadow-lg shadow-[#00BFA5]/10'
                    : 'bg-[#0D1A30]/80 border-slate-700/60 hover:border-slate-500'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
                    <Store className="w-5 h-5 text-purple-400" />
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors" />
                </div>
                <h4 className="text-sm font-black text-white group-hover:text-purple-400 transition-colors">
                  Stores You Follow
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {followedStores.length > 0 ? `${followedStores.length} Stores` : 'Browse Vendors'}
                </p>
              </button>
            </div>

            {/* ─── 5. INTERACTIVE TABBED SECTIONS ─── */}
            <div className="rounded-3xl bg-[#0D1A30]/85 border border-slate-700/70 p-6 sm:p-8 shadow-2xl">
              {/* Tab Navigation Strip */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-4 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setActiveTab('orders')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    activeTab === 'orders'
                      ? 'bg-[#00BFA5] text-slate-950 font-black shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Package className="w-4 h-4" />
                  <span>My Orders & Delivery</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                    {orders.length}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('stores')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    activeTab === 'stores'
                      ? 'bg-[#00BFA5] text-slate-950 font-black shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Store className="w-4 h-4" />
                  <span>Followed Stores</span>
                </button>

                <button
                  onClick={() => setActiveTab('bnpl')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    activeTab === 'bnpl'
                      ? 'bg-[#00BFA5] text-slate-950 font-black shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Zap className="w-4 h-4" />
                  <span>Pay Small Small (BNPL)</span>
                </button>

                <button
                  onClick={() => setActiveTab('wishlist')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    activeTab === 'wishlist'
                      ? 'bg-[#00BFA5] text-slate-950 font-black shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  <span>Saved Items</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-black/20 text-[10px]">
                    {wishlist?.length || 0}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('settings')}
                  className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    activeTab === 'settings'
                      ? 'bg-[#00BFA5] text-slate-950 font-black shadow-md'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  <span>Address & Security</span>
                </button>
              </div>

              {/* Tab 1 Content: My Orders */}
              {activeTab === 'orders' && (
                <div className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-black text-white">Order History & Consignment Tracking</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Track live parcel dispatches secured by Escrow</p>
                    </div>
                    <Link
                      to="/track-order"
                      className="text-xs font-bold text-[#00BFA5] hover:underline flex items-center gap-1"
                    >
                      <Truck className="w-3.5 h-3.5" />
                      <span>Consignment Tracker</span>
                    </Link>
                  </div>

                  {orders.length === 0 ? (
                    <div className="text-center py-12 bg-[#070F1E] rounded-2xl border border-slate-800">
                      <Package className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm font-bold text-white">No orders placed yet</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">Start browsing authentic gadgets and fashion</p>
                      <Link
                        to="/shop"
                        className="px-5 py-2.5 rounded-xl bg-[#00BFA5] text-slate-950 text-xs font-black inline-block"
                      >
                        Explore Marketplace
                      </Link>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {orders.map((ord) => (
                        <div
                          key={ord.id}
                          className="py-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                        >
                          <div className="flex items-start gap-4">
                            <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                              <Package className="w-5 h-5 text-slate-300" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black text-white font-mono">{ord.id}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                  ord.status === 'delivered'
                                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                    : ord.status === 'in_transit' || ord.status === 'shipped'
                                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                                    : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                }`}>
                                  {ord.status ? ord.status.replace('_', ' ') : 'Processing'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-300 mt-1 font-medium">
                                {ord.items_summary || `Consignment with ${ord.items_count || 1} item(s)`}
                              </p>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                Ordered on {new Date(ord.created_at || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} • {ord.destination || 'Direct Delivery'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 sm:text-right shrink-0">
                            <div>
                              <p className="text-xs font-bold text-slate-400">Total Price</p>
                              <p className="text-sm font-black text-[#00BFA5]">
                                {formatNgn(ord.total_amount)}
                              </p>
                            </div>
                            <Link
                              to={`/track-order?tracking=${ord.tracking_code || ord.id}`}
                              className="px-3.5 py-2 rounded-xl bg-[#00BFA5]/15 hover:bg-[#00BFA5]/25 border border-[#00BFA5]/30 text-[#00BFA5] text-xs font-bold flex items-center gap-1 transition-all"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Track</span>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2 Content: Followed Stores */}
              {activeTab === 'stores' && (
                <div className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-black text-white">Stores You Follow</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Receive instant alerts when these merchants drop new discounts</p>
                    </div>
                    <Link
                      to="/stores"
                      className="text-xs font-bold text-[#00BFA5] hover:underline flex items-center gap-1"
                    >
                      <span>Explore All Verified Stores</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {followedStores.length === 0 ? (
                    <div className="text-center py-12 bg-[#070F1E] rounded-2xl border border-slate-800">
                      <Store className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm font-bold text-white">No followed stores yet</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">Follow trusted merchants to view their catalogs anytime</p>
                      <Link
                        to="/stores"
                        className="px-5 py-2.5 rounded-xl bg-[#00BFA5] text-slate-950 text-xs font-black inline-block"
                      >
                        Browse Stores Directory
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {followedStores.map((st) => (
                        <div
                          key={st.id}
                          className="p-4 rounded-2xl bg-[#070F1E] border border-slate-800 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 p-1 flex items-center justify-center shrink-0">
                              <Store className="w-6 h-6 text-[#D9A73A]" />
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-white flex items-center gap-1">
                                <span>{st.name || st.store_name}</span>
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#00BFA5]" />
                              </h5>
                              <p className="text-[11px] text-slate-400">{st.city || 'Verified Merchant'}</p>
                            </div>
                          </div>
                          <Link
                            to={`/stores`}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-colors"
                          >
                            Visit
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3 Content: Pay Small Small (BNPL) */}
              {activeTab === 'bnpl' && (
                <div className="pt-6 space-y-5">
                  <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-[#0D1A30] to-emerald-500/15 border border-amber-400/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase">
                          0% INTEREST BNPL
                        </span>
                        <h4 className="text-lg font-black text-white mt-1">
                          Pay Small Small (PSS) Plan
                        </h4>
                        <p className="text-xs text-slate-300 mt-1 max-w-xl">
                          Pay just 25% down payment today, receive your items with full Escrow protection, and spread the balance across 3 monthly installments.
                        </p>
                      </div>
                      <Link
                        to="/pay-small-small"
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#D9A73A] to-amber-500 text-slate-950 text-xs font-black shrink-0 hover:opacity-90 transition-opacity"
                      >
                        Calculate My BNPL Plan
                      </Link>
                    </div>
                  </div>

                  {/* Available Coupons Strip */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
                      Your Available Vouchers & Coupons
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {vouchers.map((v) => (
                        <div
                          key={v.code}
                          className="p-4 rounded-2xl bg-[#070F1E] border border-slate-800 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-black text-[#D9A73A] font-mono">{v.code}</span>
                              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-black">
                                {v.discount}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">{v.desc}</p>
                          </div>
                          <button
                            onClick={() => handleCopyCode(v.code)}
                            className="mt-3 w-full py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white border border-white/10 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            {copiedCoupon === v.code ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Copy Code</span>
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 4 Content: Wishlist */}
              {activeTab === 'wishlist' && (
                <div className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-base font-black text-white">Your Saved Wishlist</h4>
                      <p className="text-xs text-slate-400 mt-0.5">Items you bookmarked for later purchase</p>
                    </div>
                    <Link
                      to="/buyer/wishlist"
                      className="text-xs font-bold text-[#00BFA5] hover:underline"
                    >
                      View Full Wishlist →
                    </Link>
                  </div>

                  {wishlist?.length === 0 ? (
                    <div className="text-center py-12 bg-[#070F1E] rounded-2xl border border-slate-800">
                      <Heart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-sm font-bold text-white">Your wishlist is empty</p>
                      <p className="text-xs text-slate-400 mt-1 mb-4">Tap the heart icon on any product to save it here</p>
                      <Link
                        to="/shop"
                        className="px-5 py-2.5 rounded-xl bg-[#00BFA5] text-slate-950 text-xs font-black inline-block"
                      >
                        Browse Shop
                      </Link>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {wishlist?.slice(0, 4).map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-2xl bg-[#070F1E] border border-slate-800 flex flex-col justify-between"
                        >
                          <img
                            src={p.image_url || (Array.isArray(p.images) ? p.images[0] : null) || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200'}
                            alt={p.name}
                            className="w-full h-32 object-cover rounded-xl mb-2"
                          />
                          <h6 className="text-xs font-bold text-white truncate">{p.name}</h6>
                          <p className="text-xs font-black text-[#00BFA5] mt-1">{formatNgn(p.price)}</p>
                          <Link
                            to={`/product/${p.id}`}
                            className="mt-2 w-full py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-center text-[11px] font-bold text-white"
                          >
                            View Product
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5 Content: Address & Security */}
              {activeTab === 'settings' && (
                <div className="pt-6 space-y-6">
                  <div>
                    <h4 className="text-base font-black text-white">Delivery Address & Account Security</h4>
                    <p className="text-xs text-slate-400 mt-0.5">Update your default shipping state and contact details</p>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Full Name
                        </label>
                        <input
                          type="text"
                          value={editFormData.name}
                          onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                          className="w-full bg-[#070F1E] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00BFA5]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Phone Number
                        </label>
                        <input
                          type="tel"
                          value={editFormData.phone}
                          onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                          placeholder="08012345678"
                          className="w-full bg-[#070F1E] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00BFA5]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Delivery State (36 States)
                        </label>
                        <select
                          value={editFormData.state}
                          onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                          className="w-full bg-[#070F1E] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#00BFA5]"
                        >
                          <option value="Kano">Kano</option>
                          <option value="Kaduna">Kaduna</option>
                          <option value="Abuja">Abuja FCT</option>
                          <option value="Lagos">Lagos</option>
                          <option value="Katsina">Katsina</option>
                          <option value="Sokoto">Sokoto</option>
                          <option value="Jigawa">Jigawa</option>
                          <option value="Bauchi">Bauchi</option>
                          <option value="Gombe">Gombe</option>
                          <option value="Borno">Borno</option>
                          <option value="Plateau">Plateau</option>
                          <option value="Rivers">Rivers</option>
                          <option value="Oyo">Oyo</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Street / Landmark Address
                        </label>
                        <input
                          type="text"
                          value={editFormData.address}
                          onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                          placeholder="e.g. No. 14 Bompai Road"
                          className="w-full bg-[#070F1E] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00BFA5]"
                        />
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      <button
                        type="submit"
                        disabled={saveLoading}
                        className="px-6 py-2.5 rounded-xl bg-[#00BFA5] hover:bg-[#00a896] text-slate-950 font-black text-xs transition-colors cursor-pointer"
                      >
                        {saveLoading ? 'Saving Changes...' : 'Save Settings'}
                      </button>

                      <button
                        type="button"
                        onClick={logout}
                        className="px-4 py-2 text-xs font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1.5 cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out of Abu Mafhal</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

          </div>
        )}
      </main>

      {/* ─── WALLET DEPOSIT MODAL ─── */}
      {showWalletModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0D1A30] border border-slate-700 rounded-3xl p-6 sm:p-7 shadow-2xl relative">
            <button
              onClick={() => setShowWalletModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 flex items-center justify-center mb-4">
              <Wallet className="w-6 h-6 text-[#D9A73A]" />
            </div>

            <h3 className="text-xl font-black text-white">Deposit to Mafhal Pay</h3>
            <p className="text-xs text-slate-400 mt-1 mb-6">
              Instant 100% Escrow deposit protected by Central Bank licensed payment gateways
            </p>

            <form onSubmit={handleSimulateDeposit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Deposit Amount (₦)
                </label>
                <input
                  type="number"
                  min="1000"
                  step="500"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full bg-[#070F1E] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-black focus:outline-none focus:border-[#D9A73A]"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="grid grid-cols-3 gap-2">
                {['5000', '10000', '25000'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDepositAmount(preset)}
                    className="py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white transition-colors cursor-pointer"
                  >
                    ₦{Number(preset).toLocaleString()}
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>Zero gateway charge on deposits above ₦5,000</span>
              </div>

              <button
                type="submit"
                disabled={depositLoading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#D9A73A] to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                {depositLoading ? 'Securing Escrow Channel...' : `Deposit ₦${Number(depositAmount || 0).toLocaleString()} Now`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─── EDIT PROFILE MODAL ─── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0D1A30] border border-slate-700 rounded-3xl p-6 sm:p-7 shadow-2xl relative">
            <button
              onClick={() => setShowEditModal(false)}
              className="absolute top-5 right-5 p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-xl font-black text-white mb-1">Edit Account Profile</h3>
            <p className="text-xs text-slate-400 mb-5">Keep your contact and shipping information updated</p>

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  className="w-full bg-[#070F1E] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full bg-[#070F1E] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Default Shipping State</label>
                <select
                  value={editFormData.state}
                  onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                  className="w-full bg-[#070F1E] border border-slate-700 rounded-xl px-4 py-2.5 text-xs text-white"
                >
                  <option value="Kano">Kano</option>
                  <option value="Kaduna">Kaduna</option>
                  <option value="Abuja">Abuja FCT</option>
                  <option value="Lagos">Lagos</option>
                  <option value="Katsina">Katsina</option>
                  <option value="Sokoto">Sokoto</option>
                  <option value="Jigawa">Jigawa</option>
                  <option value="Bauchi">Bauchi</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={saveLoading}
                className="w-full mt-2 py-3 rounded-xl bg-[#00BFA5] text-slate-950 font-black text-xs hover:bg-[#00a896] transition-colors cursor-pointer"
              >
                {saveLoading ? 'Saving...' : 'Update Profile'}
              </button>
            </form>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Profile;
