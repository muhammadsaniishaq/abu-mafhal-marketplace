import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, X, ChevronRight, Store, LayoutDashboard, LogOut } from 'lucide-react';

const VendorDashboard = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  const menuItems = [
    { label: 'Analytics', path: '/vendor/analytics', icon: '📊' },
    { label: 'Products', path: '/vendor/products', icon: '📦' },
    { label: 'Orders', path: '/vendor/orders', icon: '🛒' },
    { label: 'Wallet', path: '/vendor/wallet', icon: '💰' },
    { label: 'Disputes', path: '/vendor/disputes', icon: '⚖️' },
    { label: 'Profile', path: '/vendor/profile', icon: '👤' },
    { label: 'Settings', path: '/vendor/settings', icon: '⚙️' },
  ];

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      try {
        await logout();
        navigate('/login');
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Top Header */}
      <div className="bg-white/70 backdrop-blur-xl border-b border-slate-200 text-slate-900 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-2xl p-2 hover:bg-slate-100 rounded-xl transition-all"
          >
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-blue-500/20">
              AM
            </div>
            <h1 className="text-lg font-black tracking-tight">Vendor Panel</h1>
          </div>
          <Link to="/shop" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-slate-900/10 flex items-center gap-2">
            <Store className="w-4 h-4" />
            <span className="hidden sm:inline">Storefront</span>
          </Link>
        </div>
      </div>

      {/* Hamburger Sidebar */}
      {showMenu && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowMenu(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-80 bg-white/95 backdrop-blur-2xl z-50 shadow-2xl overflow-y-auto border-r border-slate-100">
            <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 text-white relative">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-2xl overflow-hidden border border-white/20 shadow-inner">
                  {currentUser?.avatar ? <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" /> : '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-lg truncate leading-tight">{currentUser?.name || 'Vendor'}</p>
                  <p className="text-xs opacity-70 truncate mb-2">{currentUser?.email}</p>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Pro Vendor</span>
                </div>
              </div>
              <button 
                onClick={() => setShowMenu(false)} 
                className="absolute top-4 right-4 text-slate-400 hover:text-white hover:bg-white/10 w-8 h-8 rounded-xl flex items-center justify-center transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="p-4 space-y-1">
              {menuItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-3.5 p-3 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all font-semibold text-sm group"
                >
                  <span className="text-xl group-hover:scale-110 transition-transform">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-100">
              <button 
                onClick={handleLogout} 
                className="w-full flex items-center justify-center gap-3 p-3.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-sm shadow-red-200/50"
              >
                <LogOut className="w-4 h-4" /> Sign Out
              </button>
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <main className="w-full">
        <Outlet />
      </main>
    </div>
  );
};

export default VendorDashboard;