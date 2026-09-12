import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Menu, X, Search, Bell, ShoppingCart, Store, CheckCircle, ExternalLink,
  LayoutDashboard, Package, ShoppingBag, Users, BarChart3, Settings,
  CreditCard, Megaphone, Star, MessageSquare, HelpCircle, Crown, ChevronDown
} from 'lucide-react';

const VendorDashboard = () => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('All Categories');

  const navItems = [
    { label: 'Dashboard', path: '/vendor/analytics', icon: LayoutDashboard },
    { label: 'Products', path: '/vendor/products', icon: Package },
    { label: 'Orders', path: '/vendor/orders', icon: ShoppingBag, badge: 12, badgeColor: 'bg-rose-500' },
    { label: 'Customers', path: '/vendor/customers', icon: Users },
    { label: 'Analytics', path: '/vendor/analytics', icon: BarChart3 },
    { label: 'Store Settings', path: '/vendor/settings', icon: Settings },
    { label: 'Payments', path: '/vendor/wallet', icon: CreditCard },
    { label: 'Promotions', path: '/vendor/promotions', icon: Megaphone },
    { label: 'Reviews', path: '/vendor/reviews', icon: Star },
    { label: 'Messages', path: '/messages', icon: MessageSquare, badge: 5, badgeColor: 'bg-rose-500' },
    { label: 'Help & Support', path: '/contact', icon: HelpCircle },
  ];

  const isActive = (path) => {
    if (path === '/vendor/analytics' && (location.pathname === '/vendor' || location.pathname === '/vendor/analytics')) {
      return true;
    }
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col font-sans text-slate-800 antialiased selection:bg-[#00BFA5] selection:text-white">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-4 lg:px-8 py-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          {/* Mobile Menu & Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0A192F] to-[#1E3A8A] flex items-center justify-center p-0.5 shadow-md shadow-slate-900/10 border border-amber-400/40">
                <span className="font-black text-[#F59E0B] text-base tracking-tighter">AM</span>
              </div>
              <div>
                <h1 className="text-base font-black tracking-tight text-[#0A192F] leading-none uppercase">Abu Mafhal</h1>
                <p className="text-[10px] text-slate-500 font-medium">Your Marketplace, Your Choice.</p>
              </div>
            </Link>
          </div>

          {/* Search Bar with Category Selector */}
          <div className="hidden md:flex flex-1 max-w-2xl mx-6">
            <div className="w-full flex items-center bg-slate-100/90 border border-slate-200/90 rounded-xl overflow-hidden focus-within:border-[#00BFA5] focus-within:ring-2 focus-within:ring-[#00BFA5]/20 transition-all">
              <div className="pl-3 text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search for products, orders, customers..."
                className="w-full bg-transparent px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <div className="border-l border-slate-200 px-3 py-1 flex items-center gap-1.5 text-xs text-slate-600 bg-slate-50/50">
                <select 
                  value={categoryFilter} 
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-transparent border-none text-xs text-slate-600 focus:outline-none cursor-pointer pr-1"
                >
                  <option>All Categories</option>
                  <option>Electronics</option>
                  <option>Fashion</option>
                  <option>Home & Living</option>
                </select>
              </div>
              <button className="bg-[#00BFA5] hover:bg-[#00a896] text-white p-2.5 px-4 transition-colors flex items-center justify-center">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-3">
            {/* Notification */}
            <Link to="/notifications" className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-sm">
                3
              </span>
            </Link>

            {/* Cart */}
            <Link to="/cart" className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-sm">
                12
              </span>
            </Link>

            {/* Vendor Profile Dropdown */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200 cursor-pointer group">
              <div className="w-8 h-8 rounded-xl bg-[#00BFA5]/10 text-[#00BFA5] flex items-center justify-center border border-[#00BFA5]/20">
                <Store className="w-4 h-4" />
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-xs font-bold text-slate-800 group-hover:text-[#00BFA5] transition-colors">
                  {currentUser?.name || 'Mafhal Store'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium">Vendor</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Container: Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar (Desktop) */}
        <aside className="hidden lg:flex w-64 bg-[#0A192F] text-slate-200 flex-col justify-between shrink-0 p-4 border-r border-[#152a4a] overflow-y-auto">
          <div className="space-y-4">
            {/* Store Profile Card */}
            <div className="bg-[#112240] rounded-2xl p-4 border border-[#1e3a63] text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#00BFA5] to-[#00D2FF] text-white flex items-center justify-center shadow-md">
                  <Store className="w-6 h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-sm text-white truncate">Mafhal Store</p>
                  <p className="text-[11px] text-slate-400">Store ID: #AMV1023</p>
                  <div className="flex items-center gap-1 text-[11px] text-[#00BFA5] font-semibold mt-0.5">
                    <CheckCircle className="w-3.5 h-3.5 fill-[#00BFA5] text-[#112240]" />
                    <span>Verified Store</span>
                  </div>
                </div>
              </div>
              <Link 
                to="/shop" 
                className="mt-3 w-full py-1.5 px-3 bg-[#0A192F] hover:bg-[#152a4a] border border-[#23426e] rounded-xl text-[11px] font-bold text-slate-200 flex items-center justify-center gap-1.5 transition-all"
              >
                <span>View Store</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </Link>
            </div>

            {/* Navigation Menu */}
            <nav className="space-y-1">
              {navItems.map((item) => {
                const active = isActive(item.path);
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.path}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      active
                        ? 'bg-[#00BFA5] text-white shadow-md shadow-[#00BFA5]/20 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-[#112240]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${item.badgeColor || 'bg-rose-500'}`}>
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Upgrade to Pro Card */}
          <div className="mt-6 bg-gradient-to-br from-[#112240] to-[#0f1d38] border border-amber-500/30 rounded-2xl p-4 relative overflow-hidden">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400">
                <Crown className="w-4 h-4" />
              </div>
              <span className="text-xs font-black text-white">Upgrade to Pro</span>
            </div>
            <p className="text-[11px] text-slate-300 mb-3 leading-relaxed">
              Get more tools and grow faster.
            </p>
            <button className="w-full py-2 px-3 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-900 font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5">
              <span>Upgrade Now</span>
              <span>→</span>
            </button>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed left-0 top-0 bottom-0 w-72 bg-[#0A192F] text-slate-200 p-5 flex flex-col justify-between overflow-y-auto z-50">
              <div>
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#1e3a63]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#F59E0B] text-slate-900 font-black flex items-center justify-center text-xs">
                      AM
                    </div>
                    <span className="font-black text-white text-sm">Vendor Panel</span>
                  </div>
                  <button onClick={() => setMobileMenuOpen(false)} className="text-slate-400 hover:text-white p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <nav className="space-y-1">
                  {navItems.map((item) => {
                    const active = isActive(item.path);
                    const IconComponent = item.icon;
                    return (
                      <Link
                        key={item.label}
                        to={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold ${
                          active
                            ? 'bg-[#00BFA5] text-white font-bold'
                            : 'text-slate-300 hover:bg-[#112240]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent className="w-4 h-4" />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </nav>
              </div>

              <button
                onClick={logout}
                className="mt-6 w-full py-2.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold"
              >
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default VendorDashboard;