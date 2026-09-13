import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Package, Layers, ShoppingCart,
  Store, Users, Sparkles, Settings, Menu, X, LogOut,
  Bell, ChevronDown, Search, Shield, ChevronRight,
  ExternalLink, CheckCircle2, RefreshCw
} from 'lucide-react';

const NAV_ITEMS = [
  { 
    label: 'Babban Dashboard', 
    subLabel: 'Overview & Pulse',
    path: '/admin/analytics', 
    icon: LayoutDashboard, 
    color: 'text-violet-600' 
  },
  { 
    label: 'Kayan Kasuwa', 
    subLabel: 'Products Management',
    path: '/admin/products', 
    icon: Package, 
    color: 'text-emerald-600' 
  },
  { 
    label: 'Rukunai (Categories)', 
    subLabel: 'Store Categories',
    path: '/admin/categories', 
    icon: Layers, 
    color: 'text-amber-600' 
  },
  { 
    label: 'Odoji da Sayayya', 
    subLabel: 'Orders & Sales',
    path: '/admin/orders', 
    icon: ShoppingCart, 
    color: 'text-blue-600' 
  },
  { 
    label: 'Yan Kasuwa (Vendors)', 
    subLabel: 'Store Merchants',
    path: '/admin/vendors', 
    icon: Store, 
    color: 'text-pink-600' 
  },
  { 
    label: 'Masu Amfani (Users)', 
    subLabel: 'Customers & Profiles',
    path: '/admin/users', 
    icon: Users, 
    color: 'text-cyan-600' 
  },
  { 
    label: 'Talla da Banners', 
    subLabel: 'Promotions & Hero',
    path: '/admin/cms', 
    icon: Sparkles, 
    color: 'text-purple-600' 
  },
  { 
    label: 'Saitunan Kasuwa', 
    subLabel: 'Platform Settings',
    path: '/admin/settings', 
    icon: Settings, 
    color: 'text-slate-600' 
  },
];

const AdminDashboard = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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

  // Determine current active section title
  let currentItem = NAV_ITEMS.find(i => location.pathname === i.path || (i.path !== '/admin/analytics' && location.pathname.startsWith(i.path)));
  if (!currentItem && location.pathname.startsWith('/admin/analytics')) {
    currentItem = NAV_ITEMS[0];
  }
  const pageTitle = currentItem ? currentItem.label : 'Admin Portal';
  const pageSubTitle = currentItem ? currentItem.subLabel : 'Abu Mafhal Marketplace';

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

      {/* ══════════════════ MODERN SIDEBAR ══════════════════ */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-[280px] flex-shrink-0 flex flex-col h-screen
        bg-white border-r border-slate-200/90 shadow-lg lg:shadow-none
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Brand Logo & Tag */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 flex-shrink-0">
          <Link to="/admin/analytics" className="flex items-center gap-3.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-indigo-600 to-violet-500 flex items-center justify-center font-black text-base shadow-md shadow-violet-600/30 group-hover:scale-105 transition-transform text-white">
              AM
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-base text-slate-900 tracking-tight">ABU MAFHAL</span>
              </div>
              <p className="text-[10px] font-bold text-violet-600 uppercase tracking-widest">
                Enterprise Admin
              </p>
            </div>
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)} 
            className="lg:hidden w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live System Status Pill */}
        <div className="px-5 pt-4 pb-1">
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-slate-700 text-[11px]">Cibiyar Supabase</span>
            </div>
            <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-100/70 px-1.5 py-0.5 rounded">
              Live
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5">
          <div className="px-3 pb-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
            Babban Tsari (Core Modules)
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path !== '/admin/analytics' && location.pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  relative flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-sm font-bold transition-all duration-200 group
                  ${isActive
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25 scale-[1.01]'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                  }
                `}
              >
                <div className={`
                  w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105
                  ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 ' + item.color}
                `}>
                  <Icon className="w-4 h-4" />
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <p className="truncate text-xs font-black tracking-tight leading-tight">{item.label}</p>
                  <p className={`text-[10px] font-medium truncate ${isActive ? 'text-violet-100' : 'text-slate-400'}`}>
                    {item.subLabel}
                  </p>
                </div>

                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-100 flex-shrink-0 space-y-2 bg-slate-50/50">
          <Link 
            to="/shop"
            target="_blank"
            className="flex items-center justify-between px-3.5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 hover:text-violet-600 transition-all group shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <Store className="w-4 h-4 text-slate-400 group-hover:text-violet-600 transition-colors" />
              <span>Duba Kasuwa (Storefront)</span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 px-3.5 py-2.5 w-full hover:bg-rose-50 border border-transparent hover:border-rose-100 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 transition-all group"
          >
            <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-600 transition-colors" />
            <span>Fita Daga Asusu (Sign Out)</span>
          </button>
        </div>
      </aside>

      {/* ══════════════════ MAIN WORKSPACE ══════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* ── TOP NAV BAR ── */}
        <header className="h-20 flex-shrink-0 flex items-center justify-between px-5 sm:px-8 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 z-20">
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
                <span className="text-violet-600 font-extrabold">{pageTitle}</span>
              </div>
              <h1 className="text-lg font-black text-slate-900 tracking-tight leading-none mt-1">
                {pageTitle}
              </h1>
            </div>
          </div>

          {/* Right Action Icons & Profile */}
          <div className="flex items-center gap-3">
            {/* View Shopfront Shortcut */}
            <Link
              to="/shop"
              target="_blank"
              className="hidden md:inline-flex items-center gap-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 rounded-xl text-xs font-bold text-slate-700 transition-all"
            >
              <Store className="w-3.5 h-3.5 text-violet-600" />
              <span>Duba Shagon Kasuwa</span>
            </Link>

            {/* Profile Dropdown */}
            <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
              <button
                onClick={() => setProfileOpen(p => !p)}
                className="flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl transition-all"
              >
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-700 flex items-center justify-center text-xs font-black shadow-md shadow-violet-600/20 text-white">
                  {userInitial}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-black text-slate-900 truncate max-w-[100px] leading-tight">
                    {userName.split(' ')[0]}
                  </p>
                  <p className="text-[10px] text-violet-600 font-bold leading-tight">Admin</p>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile Dropdown Menu */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden z-50 animate-fadeIn">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/75">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-700 flex items-center justify-center font-black text-sm text-white shadow-md shadow-violet-600/30">
                        {userInitial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{userName}</p>
                        <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-violet-50 border border-violet-100 rounded-full">
                      <Shield className="w-3 h-3 text-violet-600" />
                      <span className="text-[10px] font-black text-violet-600 uppercase tracking-wider">Super Administrator</span>
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
