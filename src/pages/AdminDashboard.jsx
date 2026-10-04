import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Package, Layers, ShoppingCart,
  Store, Users, Sparkles, Settings, Menu, X, LogOut,
  Bell, ChevronDown, Search, Shield, ChevronRight,
  ExternalLink, CheckCircle2, RefreshCw, ShieldCheck,
  CreditCard, Tag, Zap, DollarSign, AlertTriangle, Star,
  Truck, ArrowRight, ChevronLeft, ChevronUp
} from 'lucide-react';
import { supabase } from '../config/supabase';

// Categorized Executive Admin Modules
const MODULE_SECTIONS = [
  {
    id: 'overview',
    title: 'Cibiyar Kula (Executive Pulse)',
    items: [
      { 
        label: 'Executive Overview', 
        subLabel: 'Analytics, KPI & Metrics',
        path: '/admin/analytics', 
        icon: LayoutDashboard, 
        color: 'text-violet-600',
        badge: 'Live'
      },
      { 
        label: 'Official Store Profile', 
        subLabel: 'Store Name, Cover & Bio',
        path: '/admin/store-profile', 
        icon: Store, 
        color: 'text-amber-500',
        badge: null
      },
    ]
  },
  {
    id: 'commerce',
    title: 'Kasuwa & Ciniki (Commerce & Orders)',
    items: [
      { 
        label: 'Orders & Deliveries', 
        subLabel: 'PSS, POD, Prepaid & Shipments',
        path: '/admin/orders', 
        icon: ShoppingCart, 
        color: 'text-blue-600',
        badge: 'PSS / POD'
      },
      { 
        label: 'Marketplace Products', 
        subLabel: 'Catalog & Inventory Control',
        path: '/admin/products', 
        icon: Package, 
        color: 'text-emerald-600',
        badge: null
      },
      { 
        label: 'Store Categories', 
        subLabel: 'Taxonomy, Icons & Slugs',
        path: '/admin/categories', 
        icon: Layers, 
        color: 'text-amber-600',
        badge: null
      },
      { 
        label: 'Abandoned Carts', 
        subLabel: 'Unfinished Sales Recovery',
        path: '/admin/abandoned-carts', 
        icon: RefreshCw, 
        color: 'text-rose-500',
        badge: null
      },
    ]
  },
  {
    id: 'relationships',
    title: 'Masu Harka (Merchants & Customers)',
    items: [
      { 
        label: 'Merchant Stores', 
        subLabel: 'Active Vendors & Shops',
        path: '/admin/vendors', 
        icon: Users, 
        color: 'text-pink-600',
        badge: null
      },
      { 
        label: 'Vendor Approvals', 
        subLabel: 'KYC & Shop Applications',
        path: '/admin/vendor-approvals', 
        icon: ShieldCheck, 
        color: 'text-indigo-600',
        badge: 'KYC'
      },
      { 
        label: 'Customer Accounts', 
        subLabel: 'Buyer Profiles, Tiers & CRM',
        path: '/admin/users', 
        icon: Users, 
        color: 'text-cyan-600',
        badge: null
      },
      { 
        label: 'Vendor Payouts', 
        subLabel: 'Settlements & Withdrawals',
        path: '/admin/payouts', 
        icon: CreditCard, 
        color: 'text-emerald-600',
        badge: null
      },
    ]
  },
  {
    id: 'marketing',
    title: 'Talla & Rangwame (Marketing & CMS)',
    items: [
      { 
        label: 'Discount Coupons', 
        subLabel: 'Promo Vouchers & Codes',
        path: '/admin/coupons', 
        icon: Tag, 
        color: 'text-teal-600',
        badge: null
      },
      { 
        label: 'Flash Sales', 
        subLabel: 'Time-Limited Discount Deals',
        path: '/admin/flash-sales', 
        icon: Zap, 
        color: 'text-orange-500',
        badge: null
      },
      { 
        label: 'Content & Banners CMS', 
        subLabel: 'Hero Sliders, Pages & Media',
        path: '/admin/cms', 
        icon: Sparkles, 
        color: 'text-purple-600',
        badge: null
      },
    ]
  },
  {
    id: 'financials',
    title: 'Kudi & Tsaro (Financials & Security)',
    items: [
      { 
        label: 'Financials & Revenue', 
        subLabel: 'Revenue, Profit & Cash Flow',
        path: '/admin/financials', 
        icon: DollarSign, 
        color: 'text-emerald-500',
        badge: null
      },
      { 
        label: 'Payment Transactions', 
        subLabel: 'Gateways, Paystack & Escrow',
        path: '/admin/payments', 
        icon: CreditCard, 
        color: 'text-blue-500',
        badge: null
      },
      { 
        label: 'Audit & Security Logs', 
        subLabel: 'Activity Trail, IP & Exports',
        path: '/admin/audit-logs', 
        icon: Shield, 
        color: 'text-slate-600',
        badge: null
      },
    ]
  },
  {
    id: 'governance',
    title: 'Saituna & Goyon Baya (Settings & Support)',
    items: [
      { 
        label: 'Customer Reviews', 
        subLabel: 'Feedback & Ratings Moderation',
        path: '/admin/reviews', 
        icon: Star, 
        color: 'text-amber-500',
        badge: null
      },
      { 
        label: 'Dispute Resolution', 
        subLabel: 'Escrow & Order Disputes',
        path: '/admin/disputes', 
        icon: AlertTriangle, 
        color: 'text-rose-500',
        badge: null
      },
      { 
        label: 'Platform Settings', 
        subLabel: 'Shipping Rates, Fees & API',
        path: '/admin/settings', 
        icon: Settings, 
        color: 'text-slate-700',
        badge: null
      },
    ]
  }
];

const AdminDashboard = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchModule, setSearchModule] = useState('');
  const [collapsedSections, setCollapsedSections] = useState({});
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);

  // Fetch pending count for live badge
  useEffect(() => {
    const fetchBadgeData = async () => {
      try {
        const { count, error } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'processing']);
        if (!error && count !== null) {
          setPendingOrdersCount(count);
        }
      } catch (_) {}
    };
    fetchBadgeData();
  }, []);

  // Close sidebar on path change (mobile)
  useEffect(() => { 
    setSidebarOpen(false); 
  }, [location.pathname]);

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handler = () => setProfileOpen(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  const handleLogout = async () => {
    try { 
      await logout(); 
      navigate('/login'); 
    } catch (e) { 
      console.error('Logout error:', e); 
    }
  };

  const toggleSection = (sectionId) => {
    setCollapsedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  // Filter modules based on searchModule
  const filteredSections = useMemo(() => {
    if (!searchModule.trim()) return MODULE_SECTIONS;
    const q = searchModule.toLowerCase();
    return MODULE_SECTIONS.map(sec => {
      const matchedItems = sec.items.filter(item => 
        item.label.toLowerCase().includes(q) ||
        item.subLabel.toLowerCase().includes(q)
      );
      return {
        ...sec,
        items: matchedItems
      };
    }).filter(sec => sec.items.length > 0);
  }, [searchModule]);

  // Determine current active section title
  const currentItem = useMemo(() => {
    for (const sec of MODULE_SECTIONS) {
      for (const item of sec.items) {
        if (location.pathname === item.path || (item.path !== '/admin/analytics' && location.pathname.startsWith(item.path))) {
          return item;
        }
      }
    }
    return MODULE_SECTIONS[0].items[0];
  }, [location.pathname]);

  const pageTitle = currentItem?.label || 'Admin Portal';
  const pageSubTitle = currentItem?.subLabel || 'Abu Mafhal Marketplace';

  const userInitial = (currentUser?.full_name || currentUser?.name || currentUser?.email || 'A')[0].toUpperCase();
  const userName = currentUser?.full_name || currentUser?.name || 'Administrator';
  const userEmail = currentUser?.email || 'admin@abumafhal.com';

  return (
    <div className="min-h-screen flex bg-slate-50/70 text-slate-900 overflow-hidden font-sans">
      {/* ── MOBILE OVERLAY ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════ MODERN EXECUTIVE SIDEBAR ══════════════════ */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-[300px] flex-shrink-0 flex flex-col h-screen
        bg-[#0B132B] text-slate-200 border-r border-slate-800 shadow-2xl lg:shadow-none
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Logo & Tag */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-800/80 flex-shrink-0 bg-[#0B132B]">
          <Link to="/admin/analytics" className="flex items-center gap-3.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-600 flex items-center justify-center font-black text-base shadow-lg shadow-amber-500/25 group-hover:scale-105 transition-transform text-slate-950">
              AM
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base text-white tracking-tight">ABU MAFHAL</span>
              </div>
              <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                <span>Enterprise Console</span>
              </p>
            </div>
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live System Status & Quick Search */}
        <div className="px-4 pt-4 pb-2 space-y-3 flex-shrink-0 bg-[#0B132B]">
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-bold text-slate-300 text-[11px]">Server & Supabase</span>
            </div>
            <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              Operational
            </span>
          </div>

          {/* Quick Module Filter */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search modules (e.g. orders, pss)..."
              value={searchModule}
              onChange={(e) => setSearchModule(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-800 rounded-xl py-2 pl-9 pr-7 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-400/60 transition-all font-medium"
            />
            {searchModule && (
              <button 
                onClick={() => setSearchModule('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation Modules (Grouped Scrollable) */}
        <nav className="flex-1 overflow-y-auto px-3.5 py-2 space-y-5 custom-scrollbar">
          {filteredSections.map((sec) => {
            const isCollapsed = !searchModule && collapsedSections[sec.id];

            return (
              <div key={sec.id} className="space-y-1">
                <div 
                  onClick={() => !searchModule && toggleSection(sec.id)}
                  className="flex items-center justify-between px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-200 cursor-pointer select-none"
                >
                  <span className="truncate">{sec.title}</span>
                  {!searchModule && (
                    <span className="text-slate-500">
                      {isCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                    </span>
                  )}
                </div>

                {!isCollapsed && (
                  <div className="space-y-1 pt-0.5">
                    {sec.items.map((item) => {
                      const isActive = location.pathname === item.path || 
                        (item.path !== '/admin/analytics' && location.pathname.startsWith(item.path));
                      const Icon = item.icon;
                      const isOrderLink = item.path === '/admin/orders';

                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`
                            relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 group
                            ${isActive
                              ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 font-black'
                              : 'text-slate-300 hover:text-white hover:bg-slate-850'
                            }
                          `}
                          style={!isActive ? { backgroundColor: 'rgba(255,255,255,0.03)' } : {}}
                        >
                          <div className={`
                            w-7 h-7 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 flex-shrink-0
                            ${isActive ? 'bg-slate-950 text-amber-400' : 'bg-slate-800 ' + item.color}
                          `}>
                            <Icon className="w-4 h-4" />
                          </div>
                          
                          <div className="flex-1 min-w-0 text-left">
                            <p className="truncate text-[12px] font-extrabold tracking-tight leading-tight">{item.label}</p>
                            <p className={`text-[10px] truncate ${isActive ? 'text-slate-900/80 font-bold' : 'text-slate-400'}`}>
                              {item.subLabel}
                            </p>
                          </div>

                          {/* Dynamic or Static Badge */}
                          {isOrderLink && pendingOrdersCount > 0 ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                              isActive ? 'bg-slate-950 text-amber-400' : 'bg-amber-400 text-slate-950 animate-pulse'
                            }`}>
                              {pendingOrdersCount}
                            </span>
                          ) : item.badge ? (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                              isActive ? 'bg-slate-950/20 text-slate-950' : 'bg-slate-800 text-amber-400'
                            }`}>
                              {item.badge}
                            </span>
                          ) : null}

                          {isActive && (
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-3.5 border-t border-slate-800/80 flex-shrink-0 space-y-2 bg-[#080E21]">
          <Link 
            to="/shop"
            target="_blank"
            className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/90 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 hover:text-amber-400 transition-all group"
          >
            <div className="flex items-center gap-2.5">
              <Store className="w-4 h-4 text-slate-400 group-hover:text-amber-400 transition-colors" />
              <span>Duba Kasuwa (Storefront)</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3.5 py-2.5 w-full hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-400 transition-all group"
          >
            <LogOut className="w-4 h-4 text-slate-500 group-hover:text-rose-400 transition-colors" />
            <span>Fita Daga Asusu (Sign Out)</span>
          </button>
        </div>
      </aside>

      {/* ══════════════════ MAIN WORKSPACE ══════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* ── TOP NAV BAR ── */}
        <header className="h-20 flex-shrink-0 flex items-center justify-between px-5 sm:px-8 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 z-20">
          <div className="flex items-center gap-4">
            {/* Mobile Toggle Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-10 h-10 flex items-center justify-center text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb & Section Name */}
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <span>Abu Mafhal Admin</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                <span className="text-amber-600 font-extrabold">{pageTitle}</span>
              </div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none mt-1">
                {pageTitle}
              </h1>
            </div>
          </div>

          {/* Right Action Icons & Profile */}
          <div className="flex items-center gap-3">
            {/* Quick Orders Badge Button */}
            <Link
              to="/admin/orders"
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-xl text-xs font-bold text-amber-900 transition-all"
            >
              <ShoppingCart className="w-3.5 h-3.5 text-amber-600" />
              <span className="hidden sm:inline">Ododi:</span>
              <span className="bg-amber-500 text-slate-950 font-black px-1.5 py-0.5 rounded-full text-[10px]">
                {pendingOrdersCount}
              </span>
            </Link>

            {/* View Shopfront Shortcut */}
            <Link
              to="/shop"
              target="_blank"
              className="hidden md:inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 rounded-xl text-xs font-bold text-slate-700 transition-all"
            >
              <Store className="w-3.5 h-3.5 text-amber-600" />
              <span>Duba Shagon Kasuwa</span>
            </Link>

            {/* Profile Dropdown */}
            <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
              <button
                onClick={() => setProfileOpen(p => !p)}
                className="flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center text-xs font-black shadow-md shadow-amber-500/20 text-slate-950">
                  {userInitial}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-black text-slate-900 truncate max-w-[100px] leading-tight">
                    {userName.split(' ')[0]}
                  </p>
                  <p className="text-[10px] text-amber-600 font-bold leading-tight">Admin</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-fadeIn">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/75">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-700 flex items-center justify-center font-black text-sm text-slate-950 shadow-md shadow-amber-500/30">
                        {userInitial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{userName}</p>
                        <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-50 border border-amber-100 rounded-full">
                      <Shield className="w-3 h-3 text-amber-600" />
                      <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Super Administrator</span>
                    </div>
                  </div>

                  <div className="p-2 space-y-0.5">
                    <Link
                      to="/admin/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-950 hover:bg-slate-50 rounded-xl transition-all"
                    >
                      <Settings className="w-4 h-4 text-slate-400" />
                      <span>Saitunan Kasuwa (Settings)</span>
                    </Link>
                    <Link
                      to="/shop"
                      target="_blank"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-950 hover:bg-slate-50 rounded-xl transition-all"
                    >
                      <Store className="w-4 h-4 text-slate-400" />
                      <span>Bude Shagon Kasuwa</span>
                    </Link>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Fita Daga Asusu (Sign Out)</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── SUB-PAGE OUTLET ── */}
        <main className="flex-1 overflow-y-auto bg-slate-50/70 p-4 sm:p-6 lg:p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
