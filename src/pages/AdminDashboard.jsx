import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  FiBarChart2, FiUsers, FiShoppingBag, FiCheckCircle, 
  FiPackage, FiShoppingCart, FiAlertCircle, FiCreditCard, 
  FiFileText, FiClipboard, FiTag, FiZap, FiDollarSign, 
  FiStar, FiTrendingUp, FiSettings, FiMenu, FiX, FiLogOut, FiBell, FiChevronDown, FiSearch
} from 'react-icons/fi';

const AdminDashboard = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Close sidebar on route change for mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const menuGroups = [
    {
      title: 'Overview',
      items: [
        { label: 'Analytics', path: '/admin/analytics', icon: <FiBarChart2 /> },
        { label: 'Audit Logs', path: '/admin/audit-logs', icon: <FiClipboard /> },
      ]
    },
    {
      title: 'Store Management',
      items: [
        { label: 'Products', path: '/admin/products', icon: <FiPackage /> },
        { label: 'Orders', path: '/admin/orders', icon: <FiShoppingCart /> },
        { label: 'Abandoned Carts', path: '/admin/abandoned-carts', icon: <FiAlertCircle /> },
        { label: 'Reviews', path: '/admin/reviews', icon: <FiStar /> },
      ]
    },
    {
      title: 'User Management',
      items: [
        { label: 'Users', path: '/admin/users', icon: <FiUsers /> },
        { label: 'Vendors', path: '/admin/vendors', icon: <FiShoppingBag /> },
        { label: 'Vendor Approvals', path: '/admin/vendor-approvals', icon: <FiCheckCircle /> },
      ]
    },
    {
      title: 'Finance & Growth',
      items: [
        { label: 'Payments', path: '/admin/payments', icon: <FiCreditCard /> },
        { label: 'Payouts', path: '/admin/payouts', icon: <FiDollarSign /> },
        { label: 'Financials', path: '/admin/financials', icon: <FiTrendingUp /> },
        { label: 'Disputes', path: '/admin/disputes', icon: <FiAlertCircle /> },
      ]
    },
    {
      title: 'Marketing & Settings',
      items: [
        { label: 'Campaigns/CMS', path: '/admin/cms', icon: <FiFileText /> },
        { label: 'Coupons', path: '/admin/coupons', icon: <FiTag /> },
        { label: 'Flash Sales', path: '/admin/flash-sales', icon: <FiZap /> },
        { label: 'Platform Settings', path: '/admin/settings', icon: <FiSettings /> },
      ]
    }
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

  // Get current page title for breadcrumb
  let pageTitle = 'Dashboard';
  menuGroups.forEach(group => {
    const route = group.items.find(item => location.pathname.startsWith(item.path));
    if (route) pageTitle = route.label;
  });

  const handleScroll = (e) => {
    setScrolled(e.target.scrollTop > 10);
  };

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-[#0A0A0A] flex overflow-hidden font-sans text-gray-900 dark:text-gray-100">
      
      {/* Dynamic Background Elements for depth */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-400/5 dark:bg-purple-900/10 blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-400/5 dark:bg-blue-900/10 blur-[120px]"></div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-white/70 dark:bg-[#111111]/70 backdrop-blur-2xl border-r border-gray-200/50 dark:border-white/5
        transform transition-transform duration-300 cubic-bezier(0.4, 0, 0.2, 1) shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-[4px_0_24px_rgba(0,0,0,0.2)] lg:shadow-none
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col h-screen
      `}>
        {/* Sidebar Header */}
        <div className="h-20 flex-shrink-0 flex items-center justify-between px-6 border-b border-gray-200/50 dark:border-white/5">
          <Link to="/admin/analytics" className="flex items-center gap-4 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-all duration-300 group-hover:scale-105">
              AM
            </div>
            <div className="flex flex-col">
               <span className="font-bold text-lg tracking-tight leading-tight">Admin Console</span>
               <span className="text-[10px] uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-bold">Workspace</span>
            </div>
          </Link>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="p-2 -mr-2 text-gray-400 hover:text-gray-900 dark:hover:text-white lg:hidden rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6 custom-scrollbar z-10">
          {menuGroups.map((group, idx) => (
            <div key={idx} className="space-y-1">
              <div className="px-3 mb-2 text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                {group.title}
              </div>
              {group.items.map((item) => {
                const isActive = location.pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm font-semibold overflow-hidden ${
                      isActive 
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 shadow-sm border border-indigo-100 dark:border-indigo-500/20' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200 border border-transparent'
                    }`}
                  >
                    {/* Active State Background Glow */}
                    {isActive && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 to-transparent dark:from-indigo-400/10 pointer-events-none" />}
                    
                    <div className={`text-[1.1rem] transition-transform duration-200 ${isActive ? 'scale-110' : 'group-hover:scale-110 group-hover:text-indigo-500 dark:group-hover:text-indigo-400'}`}>
                      {item.icon}
                    </div>
                    <span className="relative z-10">{item.label}</span>

                    {/* Active Indicator Line */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1/2 bg-indigo-600 dark:bg-indigo-400 rounded-r-md" />
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-5 border-t border-gray-200/50 dark:border-white/5 bg-white/50 dark:bg-black/20 backdrop-blur-md">
           <Link to="/shop" className="group flex items-center justify-center gap-2 w-full py-3 px-4 bg-gray-900 dark:bg-white border border-transparent rounded-xl text-sm font-bold text-white dark:text-gray-900 hover:shadow-lg hover:shadow-gray-900/20 dark:hover:shadow-white/20 transition-all duration-300 hover:-translate-y-0.5">
             <FiShoppingBag className="group-hover:animate-bounce" /> Visit Storefront
           </Link>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 h-screen relative z-10">
        
        {/* Top App Bar */}
        <header className={`
          absolute top-0 inset-x-0 z-30 flex items-center justify-between px-4 sm:px-8 h-20
          transition-all duration-300 pointer-events-none
        `}>
          {/* Glass background container that fades in/out on scroll */}
          <div className={`absolute inset-0 transition-opacity duration-300 pointer-events-auto ${scrolled ? 'opacity-100 bg-white/70 dark:bg-[#0A0A0A]/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-white/5 shadow-sm' : 'opacity-0'}`} />

          <div className="flex items-center gap-4 relative pointer-events-auto">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2 -ml-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white lg:hidden rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition"
            >
              <FiMenu size={24} />
            </button>
            
            {/* Breadcrumb / Title */}
            <div>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white hidden sm:block tracking-tight">
                {pageTitle}
              </h2>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 hidden sm:block">
                Overview & Management
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 sm:gap-6 relative pointer-events-auto">
            
            {/* Command Search Simulation */}
            <button className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-[#1A1A1A] hover:bg-gray-200 dark:hover:bg-[#222] border border-transparent dark:border-white/5 text-gray-500 dark:text-gray-400 rounded-full text-sm font-medium transition-all duration-200">
              <FiSearch size={16} />
              <span>Search anywhere...</span>
              <div className="flex gap-1 ml-4">
                 <kbd className="font-sans px-1.5 py-0.5 bg-white dark:bg-black rounded-md shadow-sm text-[10px] font-bold">⌘</kbd>
                 <kbd className="font-sans px-1.5 py-0.5 bg-white dark:bg-black rounded-md shadow-sm text-[10px] font-bold">K</kbd>
              </div>
            </button>

            {/* Notification Bell */}
            <button className="relative p-2 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
              <FiBell size={20} />
              <span className="absolute top-1 right-1.5 w-2.5 h-2.5 bg-pink-500 rounded-full border-2 border-[#FDFDFD] dark:border-[#0A0A0A]"></span>
            </button>

            {/* Profile Dropdown */}
            <div className="flex items-center gap-3 pl-4 sm:pl-6 border-l border-gray-200 dark:border-white/10">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-black text-gray-900 dark:text-white leading-none mb-1 shadow-sm">
                  {currentUser?.name || 'Admin'}
                </p>
                <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 leading-none">
                  Super Admin
                </p>
              </div>
              <div className="relative group/menu">
                <button className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-all">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold overflow-hidden border-2 border-white dark:border-gray-800 shadow-md">
                    {currentUser?.avatar ? (
                      <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      (currentUser?.name?.[0] || 'A').toUpperCase()
                    )}
                  </div>
                  <FiChevronDown className="text-gray-500 sm:hidden" size={16} />
                </button>
                
                {/* Dropdown Menu Overlay */}
                <div className="absolute right-0 top-[110%] pt-2 w-64 opacity-0 invisible group-hover/menu:opacity-100 group-hover/menu:visible transition-all duration-200 origin-top-right z-50">
                  <div className="bg-white/90 dark:bg-[#111111]/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-200/50 dark:border-white/10 overflow-hidden px-2 py-2">
                    <div className="p-3 mb-1 sm:hidden border-b border-gray-200/50 dark:border-white/10">
                       <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          {currentUser?.name || 'Admin'}
                       </p>
                       <p className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate mt-1">
                          {currentUser?.email || 'admin@store.com'}
                       </p>
                    </div>
                    <div className="px-1 py-1">
                      <Link to="/admin/settings" className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors">
                        <FiSettings size={18} className="text-gray-500" /> Platform Settings
                      </Link>
                      <div className="h-px bg-gray-100 dark:bg-white/5 my-1 mx-2"></div>
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                      >
                        <FiLogOut size={18} /> Sign out securely
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <div 
          className="flex-1 overflow-y-auto w-full pt-20 pb-8 px-4 sm:px-8 relative z-10 custom-scrollbar"
          onScroll={handleScroll}
        >
          <div className="max-w-7xl mx-auto min-h-full py-8">
            <Outlet />
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminDashboard;