import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import {
  TrendingUp, Users, Package, Store, Layers,
  ShoppingBag, CheckCircle2, AlertTriangle, ArrowUpRight,
  ShieldCheck, Sparkles, RefreshCw, Clock, Plus, ExternalLink,
  ChevronRight, ArrowDownRight, Tag, Settings, Eye
} from 'lucide-react';

const AdminAnalytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState({
    totalProducts: 0,
    activeProducts: 0,
    pendingProducts: 0,
    totalUsers: 0,
    totalVendors: 0,
    totalBuyers: 0,
    totalCategories: 0,
    activeBanners: 0,
    totalOrders: 0,
    totalRevenue: 0
  });

  const [recentProducts, setRecentProducts] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // 1. Fetch Products
      const { data: productsData } = await supabase
        .from('products')
        .select('id, name, price, category, status, is_active, stock, stock_quantity, images, image_url, created_at')
        .order('created_at', { ascending: false });

      const prods = productsData || [];
      const totalProducts = prods.length;
      const activeProducts = prods.filter(p => p.is_active !== false && p.status !== 'rejected').length;
      const pendingProducts = prods.filter(p => p.status === 'pending' || !p.status).length;

      // 2. Fetch Profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, status, business_name, avatar_url, created_at')
        .order('created_at', { ascending: false });

      const profs = profilesData || [];
      const totalUsers = profs.length;
      const totalVendors = profs.filter(u => u.role === 'vendor').length;
      const totalBuyers = profs.filter(u => u.role !== 'vendor' && u.role !== 'admin').length;

      // 3. Fetch Categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name, slug, is_active, display_order')
        .order('display_order', { ascending: true, nullsFirst: false });

      const cats = categoriesData || [];

      // 4. Fetch Banners
      const { data: bannersData } = await supabase
        .from('banners')
        .select('id, title, is_active');

      const activeBanners = (bannersData || []).filter(b => b.is_active !== false).length;

      // 5. Fetch Orders / Transactions if available
      let totalOrders = 0;
      let totalRevenue = 0;
      try {
        const { data: ordersData } = await supabase
          .from('orders')
          .select('id, total_amount, status');

        if (ordersData && Array.isArray(ordersData)) {
          totalOrders = ordersData.length;
          totalRevenue = ordersData.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
        }
      } catch (e) {
        // Orders table empty or schema pending, graceful fallback
      }

      setStats({
        totalProducts,
        activeProducts,
        pendingProducts,
        totalUsers,
        totalVendors,
        totalBuyers,
        totalCategories: cats.length,
        activeBanners,
        totalOrders,
        totalRevenue
      });

      setRecentProducts(prods.slice(0, 5));
      setRecentUsers(profs.slice(0, 5));
      setCategories(cats.slice(0, 6));

    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const formatNaira = (amount) => {
    return '₦' + Number(amount || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px]">
        <div className="w-12 h-12 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-bold text-slate-600">Ana loda bayanan Babban Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* ── HERO BANNER & STATUS ── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl border border-slate-800 shadow-xl">
        <div className="absolute right-0 top-0 w-96 h-96 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Tsarin Yana Aiki 100% (Marketplace Live)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Babban Dashboard na Abu Mafhal
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Barka da zuwa cibiyar sarrafa kasuwa. Duba bayanan kayayyaki, dillalai (vendors), masu sayayya, da rukunai a lokaci guda ba tare da bata lokaci ba.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white font-bold text-xs backdrop-blur-md transition-all active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Ana Sabuntawa...' : 'Sake Sabuntawa'}</span>
            </button>
            <Link
              to="/admin/products/add"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-lg shadow-violet-600/30 transition-all hover:scale-105 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Sanya Sabon Kaya</span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Total Products */}
        <div 
          onClick={() => navigate('/admin/products')}
          className="group cursor-pointer bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-violet-300 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jimillar Kayan Kasuwa</span>
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center group-hover:bg-violet-600 group-hover:text-white transition-all">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totalProducts}</h3>
            <span className="inline-flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
              {stats.activeProducts} Masu Aiki
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Masu jiran tabbatarwa</span>
            <strong className="text-amber-600 font-bold">{stats.pendingProducts}</strong>
          </div>
        </div>

        {/* Vendors */}
        <div 
          onClick={() => navigate('/admin/vendors')}
          className="group cursor-pointer bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-blue-300 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Yan Kasuwa (Vendors)</span>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
              <Store className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totalVendors}</h3>
            <span className="inline-flex items-center text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
              Shagunan Kasuwa
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Dillalan da aka tantance</span>
            <strong className="text-slate-900 font-bold">{stats.totalVendors}</strong>
          </div>
        </div>

        {/* Total Users */}
        <div 
          onClick={() => navigate('/admin/users')}
          className="group cursor-pointer bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-cyan-300 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Masu Amfani (Users)</span>
            <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white transition-all">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totalUsers}</h3>
            <span className="inline-flex items-center text-xs font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded-md">
              {stats.totalBuyers} Masu Saye
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Rijistar dukkan asusun</span>
            <strong className="text-slate-900 font-bold">{stats.totalUsers}</strong>
          </div>
        </div>

        {/* Categories & Banners */}
        <div 
          onClick={() => navigate('/admin/categories')}
          className="group cursor-pointer bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Rukunai da Tallace</span>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-all">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-black text-slate-900">{stats.totalCategories}</h3>
            <span className="inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              {stats.activeBanners} Banners Masu Aiki
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Rukunan Kayan Kasuwa</span>
            <strong className="text-slate-900 font-bold">{stats.totalCategories}</strong>
          </div>
        </div>
      </div>

      {/* ── QUICK ACTIONS BAR ── */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600" />
            Hanyoyin Gaggawa (Quick Actions)
          </h2>
          <span className="text-xs text-slate-400">Sarrafa kasuwa kai tsaye</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => navigate('/admin/products/add')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-50 hover:bg-violet-50 hover:text-violet-700 border border-slate-200/80 text-slate-700 font-bold text-xs transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <span>Sanya Kaya</span>
          </button>

          <button
            onClick={() => navigate('/admin/products')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-50 hover:bg-violet-50 hover:text-violet-700 border border-slate-200/80 text-slate-700 font-bold text-xs transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Package className="w-4 h-4" />
            </div>
            <span>Duba Kayayyaki</span>
          </button>

          <button
            onClick={() => navigate('/admin/categories')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-50 hover:bg-violet-50 hover:text-violet-700 border border-slate-200/80 text-slate-700 font-bold text-xs transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Layers className="w-4 h-4" />
            </div>
            <span>Sarrafa Rukunai</span>
          </button>

          <button
            onClick={() => navigate('/admin/vendors')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-50 hover:bg-violet-50 hover:text-violet-700 border border-slate-200/80 text-slate-700 font-bold text-xs transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Store className="w-4 h-4" />
            </div>
            <span>Yan Kasuwa</span>
          </button>

          <button
            onClick={() => navigate('/admin/cms')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-50 hover:bg-violet-50 hover:text-violet-700 border border-slate-200/80 text-slate-700 font-bold text-xs transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>Tallan Banners</span>
          </button>

          <button
            onClick={() => navigate('/admin/settings')}
            className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-slate-50 hover:bg-violet-50 hover:text-violet-700 border border-slate-200/80 text-slate-700 font-bold text-xs transition-all group"
          >
            <div className="w-8 h-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
              <Settings className="w-4 h-4" />
            </div>
            <span>Saitunan Kasuwa</span>
          </button>
        </div>
      </div>

      {/* ── TWO COLUMN MAIN LAYOUT: RECENT PRODUCTS & RECENT PROFILES ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Products */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-base font-black text-slate-900">Kayan Da Aka Saka Kwanan Nan</h2>
                <p className="text-xs text-slate-500">Kayayyakin da aka sanya kwanan nan a kasuwa</p>
              </div>
              <Link 
                to="/admin/products"
                className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700"
              >
                <span>Duba Duka</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentProducts.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">Babu wani kaya a halin yanzu</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentProducts.map((p) => {
                  const img = p.images?.[0] || p.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=120';
                  return (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 border border-slate-100 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <img 
                          src={img} 
                          alt={p.name} 
                          className="w-11 h-11 rounded-lg object-cover bg-white border border-slate-200 flex-shrink-0"
                          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=120'; }}
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200/60">
                              {p.category || 'Gaba Daya'}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                              p.status === 'approved' 
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}>
                              {p.status || 'Active'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right pl-3 flex-shrink-0">
                        <p className="font-black text-sm text-slate-900">{formatNaira(p.price)}</p>
                        <p className="text-[11px] text-slate-400 font-medium">Stock: {p.stock ?? p.stock_quantity ?? '0'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          <div className="pt-4 mt-4 border-t border-slate-100 text-center">
            <Link
              to="/admin/products/add"
              className="inline-flex items-center gap-2 text-xs font-bold text-violet-600 hover:text-violet-700"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Sanya Sabon Kaya A Kasuwa</span>
            </Link>
          </div>
        </div>

        {/* Recent Registered Users & Vendors */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <div>
                <h2 className="text-base font-black text-slate-900">Sababbin Masu Rijista</h2>
                <p className="text-xs text-slate-500">Asusun da suka yi rajista a kasuwa</p>
              </div>
              <Link 
                to="/admin/users"
                className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700"
              >
                <span>Duba Duka</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-semibold">Babu sababbin masu amfani</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentUsers.map((u) => {
                  const initial = (u.full_name || u.business_name || u.email || 'A')[0].toUpperCase();
                  const isVendor = u.role === 'vendor';
                  const isAdmin = u.role === 'admin';
                  return (
                    <div key={u.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50/70 hover:bg-slate-50 border border-slate-100 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs text-white flex-shrink-0 shadow-sm ${
                          isVendor 
                            ? 'bg-gradient-to-br from-blue-600 to-indigo-700' 
                            : isAdmin 
                              ? 'bg-gradient-to-br from-violet-600 to-purple-700'
                              : 'bg-gradient-to-br from-slate-600 to-slate-700'
                        }`}>
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 truncate">
                            {u.full_name || u.business_name || 'Mai Sayayya'}
                          </p>
                          <p className="text-xs text-slate-400 truncate">{u.email || 'Babu Imel'}</p>
                        </div>
                      </div>
                      <div className="text-right pl-3 flex-shrink-0">
                        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                          isVendor 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : isAdmin 
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {u.role || 'buyer'}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Kwanan nan'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 text-center">
            <Link
              to="/admin/vendors"
              className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              <Store className="w-3.5 h-3.5" />
              <span>Duba Dukkan Dillalan Kasuwa (Vendors)</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminAnalytics;