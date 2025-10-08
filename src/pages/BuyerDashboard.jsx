import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const BuyerDashboard = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [vendorApplicationStatus, setVendorApplicationStatus] = useState(null);

  useEffect(() => {
    checkVendorApplicationStatus();
  }, [currentUser]);

  const checkVendorApplicationStatus = async () => {
    if (currentUser?.role === 'buyer') {
      try {
        const appDoc = await getDoc(doc(db, 'vendorApplications', currentUser.uid));
        if (appDoc.exists()) {
          setVendorApplicationStatus(appDoc.data().status);
        }
      } catch (error) {
        console.error('Error checking vendor application:', error);
      }
    }
  };

  const menuItems = [
    { label: 'My Orders', path: '/buyer/orders', icon: '📦' },
    { label: 'Wishlist', path: '/buyer/wishlist', icon: '❤️' },
    { label: 'Wallet', path: '/buyer/wallet', icon: '💰' },
    { label: 'Loyalty & Rewards', path: '/buyer/loyalty', icon: '🎁' },
    { label: 'Reviews', path: '/buyer/reviews', icon: '⭐' },
    { label: 'Disputes', path: '/buyer/disputes', icon: '⚖️' },
    { label: 'Referrals', path: '/buyer/referrals', icon: '👥' },
    { label: 'Profile', path: '/buyer/profile', icon: '👤' },
    { label: 'Settings', path: '/buyer/settings', icon: '⚙️' },
  ];

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Pending Review', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400', icon: '⏳' },
      processing: { text: 'Processing', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400', icon: '⚙️' },
      approved: { text: 'Approved', color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400', icon: '✅' },
      rejected: { text: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400', icon: '❌' }
    };
    return badges[status] || null;
  };

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
      {/* Top Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-2xl p-2 hover:bg-white/10 rounded-lg transition"
          >
            ☰
          </button>
          <h1 className="text-xl font-bold">My Dashboard</h1>
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
            <div className="p-4 bg-gradient-to-r from-orange-500 to-red-500 text-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl overflow-hidden">
                  {currentUser?.avatar ? <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" /> : '👤'}
                </div>
                <div className="flex-1">
                  <p className="font-bold truncate">{currentUser?.name || 'Buyer'}</p>
                  <p className="text-sm opacity-90 truncate">{currentUser?.email}</p>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full mt-1 inline-block">Buyer</span>
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

              {/* Become a Vendor Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                {vendorApplicationStatus ? (
                  <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">🏪</span>
                      <span className="font-medium text-sm">Vendor Application</span>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 border ${getStatusBadge(vendorApplicationStatus)?.color}`}>
                      <span>{getStatusBadge(vendorApplicationStatus)?.icon}</span>
                      <span>{getStatusBadge(vendorApplicationStatus)?.text}</span>
                    </div>
                    {vendorApplicationStatus === 'rejected' && (
                      <Link to="/vendor-application" className="text-xs text-blue-600 dark:text-blue-400 hover:underline block mt-2" onClick={() => setShowMenu(false)}>
                        Reapply Now
                      </Link>
                    )}
                  </div>
                ) : (
                  <Link 
                    to="/vendor-application" 
                    className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition border border-green-200 dark:border-green-800" 
                    onClick={() => setShowMenu(false)}
                  >
                    <span className="text-xl">🏪</span>
                    <div className="flex-1">
                      <span className="font-medium text-green-700 dark:text-green-400 block">Become a Vendor</span>
                      <span className="text-xs text-green-600 dark:text-green-500">Start selling on our platform</span>
                    </div>
                  </Link>
                )}
              </div>
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

export default BuyerDashboard;