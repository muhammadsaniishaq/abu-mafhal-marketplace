import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingCart, ClipboardList, Package, Users, Calendar,
  ChevronDown, Rocket, AlertTriangle, Zap, Plus, Settings,
  Megaphone
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';

const VendorAnalytics = () => {
  const [timeRange] = useState('Last 7 Days');

  // Chart data matching Screenshot 1 (5 Sep - 11 Sep, peak ₦320,000)
  const salesData = [
    { date: '5 Sep', sales: 48000 },
    { date: '6 Sep', sales: 125000 },
    { date: '7 Sep', sales: 175000 },
    { date: '8 Sep', sales: 155000 },
    { date: '9 Sep', sales: 210000 },
    { date: '10 Sep', sales: 260000 },
    { date: '11 Sep', sales: 320000 },
  ];

  const recentOrders = [
    {
      id: '#AMF001248',
      title: 'Wireless Headphones',
      price: '₦25,000',
      status: 'Delivered',
      statusColor: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      time: '2 hours ago',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&q=80',
    },
    {
      id: '#AMF001247',
      title: "Men's Smart Watch",
      price: '₦45,000',
      status: 'Processing',
      statusColor: 'bg-blue-100 text-blue-700 border-blue-200',
      time: '5 hours ago',
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150&q=80',
    },
    {
      id: '#AMF001246',
      title: 'Ladies Handbag',
      price: '₦32,000',
      status: 'Shipped',
      statusColor: 'bg-purple-100 text-purple-700 border-purple-200',
      time: '1 day ago',
      image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=150&q=80',
    },
    {
      id: '#AMF001245',
      title: 'Sneakers',
      price: '₦28,000',
      status: 'Pending',
      statusColor: 'bg-amber-100 text-amber-700 border-amber-200',
      time: '1 day ago',
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&q=80',
    },
  ];

  const lowStockItems = [
    {
      name: 'iPhone 13 Case',
      left: 3,
      price: '₦8,500',
      image: 'https://images.unsplash.com/photo-1601784551446-20c9e07cdbdb?w=150&q=80',
    },
    {
      name: 'Wireless Earbuds',
      left: 5,
      price: '₦18,000',
      image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=150&q=80',
    },
    {
      name: "Men's Cap",
      left: 4,
      price: '₦6,000',
      image: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=150&q=80',
    },
    {
      name: 'Power Bank 20000mAh',
      left: 2,
      price: '₦15,000',
      image: 'https://images.unsplash.com/photo-1609592807664-88480d5ca4ce?w=150&q=80',
    },
  ];

  const topProducts = [
    {
      name: 'iPhone 13',
      price: '₦520,000',
      sold: '124 sold',
      image: 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=150&q=80',
    },
    {
      name: 'Nike Air Force 1',
      price: '₦65,000',
      sold: '98 sold',
      image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=150&q=80',
    },
    {
      name: 'Ladies Handbag',
      price: '₦32,000',
      sold: '87 sold',
      image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=150&q=80',
    },
    {
      name: 'Wireless Headphones',
      price: '₦25,000',
      sold: '76 sold',
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&q=80',
    },
    {
      name: 'Smart Watch',
      price: '₦45,000',
      sold: '64 sold',
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150&q=80',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      {/* Top Banner Row: Welcome Header + Rocket Promotion */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-stretch">
        {/* Left 2 Cols: Welcome Header & 4 Stat Cards */}
        <div className="xl:col-span-2 flex flex-col justify-between space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2">
                Welcome to Your Store <span className="text-2xl">👋</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                Manage your products, orders and grow your business with ABU MAFHAL.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-100/80 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>11 Sep 2026</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          {/* 4 Key Metric Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Total Sales */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <ShoppingCart className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-500">Total Sales</p>
              <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">₦1,250,000</p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1.5">
                <span>↑ 12%</span>
                <span className="text-slate-400 font-normal">vs last week</span>
              </div>
            </div>

            {/* Total Orders */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <ClipboardList className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-500">Total Orders</p>
              <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">248</p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1.5">
                <span>↑ 18%</span>
                <span className="text-slate-400 font-normal">vs last week</span>
              </div>
            </div>

            {/* Total Products */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Package className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-500">Total Products</p>
              <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">136</p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1.5">
                <span>↑ 5%</span>
                <span className="text-slate-400 font-normal">vs last week</span>
              </div>
            </div>

            {/* Active Customers */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center shadow-md shadow-purple-500/20">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xs font-semibold text-slate-500">Active Customers</p>
              <p className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">482</p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 mt-1.5">
                <span>↑ 22%</span>
                <span className="text-slate-400 font-normal">vs last week</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Rocket Promotional Card */}
        <div className="bg-gradient-to-br from-[#0A192F] via-[#0E2442] to-[#16355F] text-white p-6 rounded-2xl border border-[#1e3e6b] shadow-xl relative overflow-hidden flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#00BFA5]/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-2 opacity-20 pointer-events-none">
            <div className="w-28 h-28 rounded-2xl border-4 border-[#00BFA5]/30 transform rotate-12" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#00BFA5] to-[#00E5FF] text-slate-950 flex items-center justify-center shadow-lg shadow-[#00BFA5]/30">
                <Rocket className="w-6 h-6 text-slate-950 fill-current" />
              </div>
              <div>
                <p className="text-[11px] font-bold text-[#00BFA5] uppercase tracking-wider">Store Growth Engine</p>
                <h3 className="text-base sm:text-lg font-black leading-tight text-white">
                  Grow Your Business with <span className="text-[#00BFA5]">ABU MAFHAL</span>
                </h3>
              </div>
            </div>
            <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-sm">
              Reach more customers across northern Nigeria. Sell more products with verified badges and boosted listings.
            </p>
          </div>

          <div className="relative z-10 mt-5 pt-3 border-t border-white/10 flex items-center justify-between">
            <button className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all active:scale-95">
              <span>Start Growing</span>
              <span>→</span>
            </button>
            <span className="text-[10px] text-slate-400 font-semibold">Over 15,000+ Active Buyers</span>
          </div>
        </div>
      </div>

      {/* Middle Grid: Sales Overview (Chart) + Recent Orders + Low Stock */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sales Overview Chart (6 Cols) */}
        <div className="lg:col-span-6 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#00BFA5]" />
                <h3 className="font-black text-slate-900 text-sm sm:text-base">Sales Overview</h3>
              </div>
              <p className="text-xs text-slate-400 font-medium ml-4.5">Your total sales for the last 7 days</p>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-700 cursor-pointer">
              <span>{timeRange}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
            </div>
          </div>

          {/* Recharts Area Chart */}
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00BFA5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#00BFA5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="date" 
                  tickLine={false} 
                  axisLine={{ stroke: '#CBD5E1' }} 
                  tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} 
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  tickFormatter={(v) => `₦${v / 1000}K`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white px-3 py-2 rounded-xl shadow-xl border border-slate-700 text-xs">
                          <p className="font-black text-[#00BFA5]">₦{payload[0].value.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-400 font-medium">{payload[0].payload.date} 2026</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#00BFA5" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#salesGrad)" 
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Tooltip Bubble at 11 Sep matching Mockup */}
            <div className="absolute top-3 right-6 bg-[#0A192F] text-white px-3 py-1.5 rounded-xl shadow-lg border border-[#00BFA5]/40 text-center pointer-events-none hidden sm:block">
              <p className="text-xs font-black text-[#00BFA5]">₦320,000</p>
              <p className="text-[10px] text-slate-300">11 Sep 2026</p>
            </div>
          </div>
        </div>

        {/* Recent Orders (3 Cols) */}
        <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
              <ClipboardList className="w-4 h-4 text-blue-500" />
              <span>Recent Orders</span>
            </h3>
            <Link to="/vendor/orders" className="text-xs font-bold text-[#00BFA5] hover:underline flex items-center gap-1">
              <span>View All</span>
              <span>→</span>
            </Link>
          </div>

          <div className="space-y-3">
            {recentOrders.map((order) => (
              <div key={order.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                <img src={order.image} alt={order.title} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-bold text-slate-500 truncate">{order.id}</p>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${order.statusColor}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate">{order.title}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-bold text-slate-800">{order.price}</span>
                    <span>{order.time}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Low Stock Alerts (3 Cols) */}
        <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-1.5 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-slate-900">Low Stock Alerts</span>
            </h3>
            <Link to="/vendor/products" className="text-xs font-bold text-[#00BFA5] hover:underline flex items-center gap-1">
              <span>View All</span>
              <span>→</span>
            </Link>
          </div>

          <div className="space-y-3">
            {lowStockItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                <img src={item.image} alt={item.name} className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate">{item.name}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                      ⚠️ {item.left} left
                    </span>
                    <span className="text-xs font-bold text-slate-800">{item.price}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Grid: Top Products + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Top Products (7 Cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
              <span>🏆 Top Products</span>
            </h3>
            <Link to="/vendor/products" className="text-xs font-bold text-[#00BFA5] hover:underline flex items-center gap-1">
              <span>View All</span>
              <span>→</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {topProducts.map((prod, idx) => (
              <div key={idx} className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-2.5 text-center group hover:bg-white hover:shadow-md transition-all">
                <div className="w-full aspect-square rounded-xl overflow-hidden bg-white mb-2 border border-slate-200/60 flex items-center justify-center">
                  <img src={prod.image} alt={prod.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                </div>
                <p className="text-xs font-black text-slate-900 truncate text-left">{prod.name}</p>
                <p className="text-xs font-bold text-[#0A192F] text-left mt-0.5">{prod.price}</p>
                <p className="text-[10px] font-bold text-emerald-600 text-left mt-0.5">↑ {prod.sold}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>Quick Actions</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Add Product */}
            <Link
              to="/vendor/products/add"
              className="bg-gradient-to-br from-teal-50 to-emerald-50/60 border border-teal-200/60 p-4 rounded-2xl flex flex-col items-center justify-center text-center group hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-[#00BFA5] text-white flex items-center justify-center mb-2 shadow-md shadow-[#00BFA5]/20 group-hover:scale-110 transition-transform">
                <Plus className="w-5 h-5" />
              </div>
              <p className="text-xs font-black text-slate-900">Add Product</p>
              <p className="text-[10px] text-slate-500 font-medium">List a new product</p>
            </Link>

            {/* Manage Orders */}
            <Link
              to="/vendor/orders"
              className="bg-gradient-to-br from-blue-50 to-indigo-50/60 border border-blue-200/60 p-4 rounded-2xl flex flex-col items-center justify-center text-center group hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center mb-2 shadow-md shadow-blue-500/20 group-hover:scale-110 transition-transform">
                <ClipboardList className="w-5 h-5" />
              </div>
              <p className="text-xs font-black text-slate-900">Manage Orders</p>
              <p className="text-[10px] text-slate-500 font-medium">View and process orders</p>
            </Link>

            {/* Store Settings */}
            <Link
              to="/vendor/settings"
              className="bg-gradient-to-br from-amber-50 to-yellow-50/60 border border-amber-200/60 p-4 rounded-2xl flex flex-col items-center justify-center text-center group hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-2 shadow-md shadow-amber-500/20 group-hover:scale-110 transition-transform">
                <Settings className="w-5 h-5" />
              </div>
              <p className="text-xs font-black text-slate-900">Store Settings</p>
              <p className="text-[10px] text-slate-500 font-medium">Update your store info</p>
            </Link>

            {/* Create Promotion */}
            <Link
              to="/vendor/promotions"
              className="bg-gradient-to-br from-purple-50 to-fuchsia-50/60 border border-purple-200/60 p-4 rounded-2xl flex flex-col items-center justify-center text-center group hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500 text-white flex items-center justify-center mb-2 shadow-md shadow-purple-500/20 group-hover:scale-110 transition-transform">
                <Megaphone className="w-5 h-5" />
              </div>
              <p className="text-xs font-black text-slate-900">Create Promotion</p>
              <p className="text-[10px] text-slate-500 font-medium">Discounts and offers</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorAnalytics;