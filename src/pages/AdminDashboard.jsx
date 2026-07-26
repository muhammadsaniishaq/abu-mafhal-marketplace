import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BarChart2, Users, ShoppingBag, CheckCircle,
  Package, ShoppingCart, AlertCircle, CreditCard,
  FileText, ClipboardList, Tag, Zap, DollarSign,
  Star, TrendingUp, Settings, Menu, X, LogOut,
  Bell, ChevronDown, Search, Store, Shield,
  ChevronRight, LayoutDashboard
} from 'lucide-react';

const NAV_GROUPS = [
  {
    title: 'Overview',
    items: [
      { label: 'Analytics', path: '/admin/analytics', icon: BarChart2, color: 'text-violet-400' },
      { label: 'Audit Logs', path: '/admin/audit-logs', icon: ClipboardList, color: 'text-blue-400' },
    ]
  },
  {
    title: 'Store',
    items: [
      { label: 'Products', path: '/admin/products', icon: Package, color: 'text-emerald-400' },
      { label: 'Orders', path: '/admin/orders', icon: ShoppingCart, color: 'text-amber-400' },
      { label: 'Abandoned Carts', path: '/admin/abandoned-carts', icon: AlertCircle, color: 'text-red-400' },
      { label: 'Reviews', path: '/admin/reviews', icon: Star, color: 'text-yellow-400' },
    ]
  },
  {
    title: 'Users',
    items: [
      { label: 'All Users', path: '/admin/users', icon: Users, color: 'text-cyan-400' },
      { label: 'Vendors', path: '/admin/vendors', icon: ShoppingBag, color: 'text-pink-400' },
      { label: 'Vendor Approvals', path: '/admin/vendor-approvals', icon: CheckCircle, color: 'text-green-400' },
    ]
  },
  {
    title: 'Finance',
    items: [
      { label: 'Payments', path: '/admin/payments', icon: CreditCard, color: 'text-violet-400' },
      { label: 'Payouts', path: '/admin/payouts', icon: DollarSign, color: 'text-emerald-400' },
      { label: 'Financials', path: '/admin/financials', icon: TrendingUp, color: 'text-blue-400' },
      { label: 'Disputes', path: '/admin/disputes', icon: AlertCircle, color: 'text-red-400' },
    ]
  },
  {
    title: 'Marketing',
    items: [
      { label: 'CMS / Campaigns', path: '/admin/cms', icon: FileText, color: 'text-orange-400' },
      { label: 'Coupons', path: '/admin/coupons', icon: Tag, color: 'text-pink-400' },
      { label: 'Flash Sales', path: '/admin/flash-sales', icon: Zap, color: 'text-yellow-400' },
      { label: 'Settings', path: '/admin/settings', icon: Settings, color: 'text-slate-400' },
    ]
  }
];

const AdminDashboard = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Close profile dropdown on outside click
  useEffect(() => {
    if (!profileOpen) return;
    const handler = () => setProfileOpen(false);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  const toggleGroup = (title) =>
    setCollapsedGroups(prev => ({ ...prev, [title]: !prev[title] }));

  const handleLogout = async () => {
    try { await logout(); navigate('/'); } catch (e) { console.error(e); }
  };

  // Get current page label
  let pageTitle = 'Dashboard';
  NAV_GROUPS.forEach(g => {
    const found = g.items.find(i => location.pathname.startsWith(i.path));
    if (found) pageTitle = found.label;
  });

  const userInitial = (currentUser?.full_name || currentUser?.name || 'A')[0].toUpperCase();
  const userName = currentUser?.full_name || currentUser?.name || 'Admin';
  const userEmail = currentUser?.email || 'admin@abumafhal.com';

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900 overflow-hidden font-sans">

      {/* ── MOBILE OVERLAY ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ══════════════════ SIDEBAR ══════════════════ */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-[260px] flex-shrink-0 flex flex-col h-screen
        bg-white/80 backdrop-blur-xl border-r border-slate-200
        transform transition-transform duration-300
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100 flex-shrink-0">
          <Link to="/admin/analytics" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center font-black text-sm shadow-lg shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-all text-white">
              AM
            </div>
            <div>
              <p className="font-black text-sm text-slate-900 leading-none">Admin Console</p>
              <p className="text-[10px] text-violet-600 font-bold uppercase tracking-widest mt-0.5">Abu Mafhal</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-950 hover:bg-slate-100 rounded-lg transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_GROUPS.map((group) => {
            const isCollapsed = collapsedGroups[group.title];
            return (
              <div key={group.title} className="mb-1">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.title)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {group.title}
                  <ChevronRight className={`w-3 h-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                </button>

                {/* Items */}
                {!isCollapsed && (
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const isActive = location.pathname.startsWith(item.path);
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          className={`
                            relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200
                            ${isActive
                              ? 'bg-violet-50 text-violet-600 border border-violet-100 shadow-sm shadow-violet-500/5'
                              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent'
                            }
                          `}
                        >
                          {/* Active left bar */}
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-violet-600 rounded-r-full" />
                          )}

                          <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-violet-600' : item.color} transition-colors`} />
                          <span>{item.label}</span>

                          {isActive && (
                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-600" />
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

        {/* Sidebar footer */}
        <div className="p-4 border-t border-slate-100 flex-shrink-0 space-y-2">
          <Link to="/shop"
            className="flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 transition-all group">
            <Store className="w-4 h-4 group-hover:text-violet-600 transition-colors" />
            Visit Storefront
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full hover:bg-red-50 border border-transparent hover:border-red-100 rounded-xl text-sm font-bold text-slate-500 hover:text-red-600 transition-all group">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ══════════════════ MAIN AREA ══════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">

        {/* ── TOP BAR ── */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-4 sm:px-6 bg-white/70 backdrop-blur-xl border-b border-slate-200">

          <div className="flex items-center gap-3">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Page title */}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium hidden sm:block">Admin</span>
                <ChevronRight className="w-3 h-3 text-slate-400 hidden sm:block" />
                <h1 className="text-sm font-black text-slate-900">{pageTitle}</h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Search button */}
            <button className="hidden md:flex items-center gap-2.5 px-4 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 rounded-xl text-xs font-medium transition-all">
              <Search className="w-3.5 h-3.5" />
              <span>Search...</span>
              <div className="flex gap-1 ml-2">
                <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-[9px] font-bold">⌘</kbd>
                <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-[9px] font-bold">K</kbd>
              </div>
            </button>

            {/* Notifications */}
            <button className="relative w-9 h-9 flex items-center justify-center text-slate-500 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-violet-600 rounded-full border-2 border-white" />
            </button>

            {/* Profile */}
            <div className="relative" onMouseDown={(e) => e.stopPropagation()}>
              <button
                onClick={() => setProfileOpen(p => !p)}
                className="flex items-center gap-2.5 pl-3 pr-2 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center text-xs font-black shadow-lg shadow-violet-500/20 text-white">
                  {userInitial}
                </div>
                <span className="hidden sm:block text-sm font-bold text-slate-900 max-w-[80px] truncate">{userName.split(' ')[0]}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Profile dropdown */}
              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl shadow-slate-200/50 overflow-hidden z-50">
                  {/* User info */}
                  <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center font-black shadow-lg shadow-violet-500/30 text-white">
                        {userInitial}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-black text-slate-900 truncate">{userName}</p>
                        <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                      </div>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-50 border border-violet-100 rounded-full">
                      <Shield className="w-3 h-3 text-violet-600" />
                      <span className="text-[10px] font-black text-violet-600 uppercase tracking-wider">Super Admin</span>
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="p-2">
                    <Link to="/admin/settings" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all">
                      <Settings className="w-4 h-4 text-slate-400" /> Platform Settings
                    </Link>
                    <Link to="/shop" onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all">
                      <Store className="w-4 h-4 text-slate-400" /> View Storefront
                    </Link>
                    <div className="h-px bg-slate-100 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 rounded-xl transition-all">
                      <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── CONTENT AREA ── */}
        <main className="flex-1 overflow-y-auto bg-slate-50 scroll-smooth">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 min-h-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
