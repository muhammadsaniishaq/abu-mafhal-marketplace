import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Header with Hamburger */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-2xl p-2 hover:bg-white/10 rounded-lg transition"
          >
            ☰
          </button>
          <h1 className="text-xl font-bold">Vendor Dashboard</h1>
          <Link to="/shop" className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition">
            🏪 Shop
          </Link>
        </div>
      </div>

      {/* Hamburger Sidebar */}
      {showMenu && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowMenu(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-800 z-50 shadow-2xl overflow-y-auto">
            <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl overflow-hidden">
                  {currentUser?.avatar ? <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" /> : '👤'}
                </div>
                <div className="flex-1">
                  <p className="font-bold truncate">{currentUser?.name || 'Vendor'}</p>
                  <p className="text-sm opacity-90 truncate">{currentUser?.email}</p>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full mt-1 inline-block">Vendor</span>
                </div>
              </div>
              <button onClick={() => setShowMenu(false)} className="absolute top-4 right-4 text-2xl hover:bg-white/10 w-8 h-8 rounded-full">✕</button>
            </div>

            <nav className="p-4 space-y-2">
              {menuItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t">
              <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium">
                <span className="text-xl">🚪</span> Logout
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