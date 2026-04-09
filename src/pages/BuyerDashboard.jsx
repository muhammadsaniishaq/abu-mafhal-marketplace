import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { 
  Menu, X, ChevronRight, ShoppingBag, Heart, Wallet, 
  Gift, Star, Scale, Users, User, Settings, Store, LogOut
} from 'lucide-react';

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
        const { data, error } = await supabase
          .from('vendor_applications')
          .select('status')
          .eq('user_id', currentUser.id || currentUser.uid)
          .order('submitted_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) throw error;
        if (data) setVendorApplicationStatus(data.status);
      } catch (error) {
        console.error('Error checking vendor application:', error.message);
      }
    }
  };

  const menuItems = [
    { label: 'My Orders', path: '/buyer/orders', icon: ShoppingBag, color: 'text-blue-500' },
    { label: 'Wishlist', path: '/buyer/wishlist', icon: Heart, color: 'text-rose-500' },
    { label: 'Wallet', path: '/buyer/wallet', icon: Wallet, color: 'text-emerald-500' },
    { label: 'Loyalty & Rewards', path: '/buyer/loyalty', icon: Gift, color: 'text-purple-500' },
    { label: 'Reviews', path: '/buyer/reviews', icon: Star, color: 'text-amber-500' },
    { label: 'Disputes', path: '/buyer/disputes', icon: Scale, color: 'text-slate-500' },
    { label: 'Referrals', path: '/buyer/referrals', icon: Users, color: 'text-indigo-500' },
    { label: 'Profile', path: '/buyer/profile', icon: User, color: 'text-slate-700' },
    { label: 'Settings', path: '/buyer/settings', icon: Settings, color: 'text-slate-500' },
  ];

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Pending Review', color: 'bg-yellow-100 text-yellow-800', icon: '⏳' },
      processing: { text: 'Processing', color: 'bg-blue-100 text-blue-800', icon: '⚙️' },
      approved: { text: 'Approved', color: 'bg-green-100 text-green-800', icon: '✅' },
      rejected: { text: 'Rejected', color: 'bg-red-100 text-red-800', icon: '❌' }
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white font-bold text-xs shadow-md shadow-indigo-500/20">
              AM
            </div>
            <h1 className="text-lg font-black tracking-tight">My Dashboard</h1>
          </div>
          <Link to="/shop" className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-slate-900/10">
            Visit Shop
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
                  <p className="font-black text-lg truncate leading-tight">{currentUser?.name || 'Buyer'}</p>
                  <p className="text-xs opacity-70 truncate mb-2">{currentUser?.email}</p>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-black uppercase tracking-widest px-2 py-0.5 rounded-full">Buyer Account</span>
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
              {menuItems.map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-4 p-3.5 text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all font-black text-xs uppercase tracking-widest group"
                  >
                    <div className={`p-2 rounded-xl bg-white border border-slate-100 shadow-sm group-hover:scale-110 transition-transform ${item.color}`}>
                      <Icon size={18} />
                    </div>
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all text-slate-300" />
                  </Link>
                );
              })}

              {/* Become a Vendor Section */}
              <div className="pt-4 mt-2 px-1">
                {vendorApplicationStatus ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                        <Store size={18} />
                      </div>
                      <span className="font-black text-sm text-slate-900">Vendor Application</span>
                    </div>
                    <div className={`text-[10px] px-3 py-1.5 rounded-xl inline-flex items-center gap-2 font-black uppercase tracking-wider border ${getStatusBadge(vendorApplicationStatus)?.color}`}>
                      <span>{getStatusBadge(vendorApplicationStatus)?.icon}</span>
                      <span>{getStatusBadge(vendorApplicationStatus)?.text}</span>
                    </div>
                    {vendorApplicationStatus === 'rejected' && (
                      <Link to="/vendor-application" className="text-xs text-blue-600 font-bold hover:underline block mt-2" onClick={() => setShowMenu(false)}>
                        Reapply Now
                      </Link>
                    )}
                  </div>
                ) : (
                  <Link 
                    to="/vendor-application" 
                    className="flex items-center gap-4 p-4 bg-gradient-to-br from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 rounded-2xl transition border border-emerald-100 group" 
                    onClick={() => setShowMenu(false)}
                  >
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                      <Store size={22} />
                    </div>
                    <div className="flex-1">
                      <span className="font-black text-emerald-900 block text-sm">Become a Vendor</span>
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">Start selling today</span>
                    </div>
                  </Link>
                )}
              </div>
            </nav>

            <div className="p-4 border-t border-slate-100">
              <button 
                onClick={handleLogout} 
                className="w-full flex items-center justify-center gap-3 p-3.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-2xl font-black text-sm transition-all active:scale-95 shadow-sm shadow-red-200/50"
              >
                 Logout Account
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