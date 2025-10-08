import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalUsers: 0,
    totalVendors: 0,
    pendingOrders: 0,
    pendingProducts: 0,
    pendingVendorApps: 0,
    todayRevenue: 0,
    todayOrders: 0,
    activeDisputes: 0
  });
  
  const [recentOrders, setRecentOrders] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentUsers, setRecentUsers] = useState([]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Fetch Orders
      const ordersSnap = await getDocs(collection(db, 'orders'));
      const orders = ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
      const todayOrders = orders.filter(order => new Date(order.createdAt) >= today);
      const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.total || 0), 0);
      const pendingOrders = orders.filter(order => order.status === 'pending').length;

      // Fetch Products
      const productsSnap = await getDocs(collection(db, 'products'));
      const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const pendingProducts = products.filter(p => p.status === 'pending').length;

      // Top selling products
      const topProducts = products
        .sort((a, b) => (b.sales || 0) - (a.sales || 0))
        .slice(0, 5);

      // Fetch Users
      const usersSnap = await getDocs(collection(db, 'users'));
      const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const vendors = users.filter(u => u.role === 'vendor');
      
      // Recent users (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentUsers = users
        .filter(u => u.createdAt && new Date(u.createdAt) >= weekAgo)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

      // Fetch Vendor Applications
      const appsSnap = await getDocs(collection(db, 'vendorApplications'));
      const applications = appsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const pendingApps = applications.filter(app => app.status === 'pending').length;

      // Fetch Disputes
      const disputesSnap = await getDocs(collection(db, 'disputes'));
      const disputes = disputesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const activeDisputes = disputes.filter(d => d.status === 'open').length;

      // Recent orders
      const recentOrders = orders
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5);

      setStats({
        totalRevenue,
        totalOrders: orders.length,
        totalProducts: products.length,
        totalUsers: users.length,
        totalVendors: vendors.length,
        pendingOrders,
        pendingProducts,
        pendingVendorApps: pendingApps,
        todayRevenue,
        todayOrders: todayOrders.length,
        activeDisputes
      });

      setRecentOrders(recentOrders);
      setTopProducts(topProducts);
      setRecentUsers(recentUsers);

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard Analytics</h1>
        <p className="text-gray-600 dark:text-gray-400">Platform overview and key metrics</p>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Total Revenue */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm opacity-90">Total Revenue</p>
            <span className="text-2xl">💰</span>
          </div>
          <p className="text-3xl font-bold mb-1">₦{stats.totalRevenue.toLocaleString()}</p>
          <p className="text-xs opacity-75">From {stats.totalOrders} orders</p>
        </div>

        {/* Total Users */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm opacity-90">Total Users</p>
            <span className="text-2xl">👥</span>
          </div>
          <p className="text-3xl font-bold mb-1">{stats.totalUsers}</p>
          <p className="text-xs opacity-75">{stats.totalVendors} vendors</p>
        </div>

        {/* Total Products */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm opacity-90">Total Products</p>
            <span className="text-2xl">📦</span>
          </div>
          <p className="text-3xl font-bold mb-1">{stats.totalProducts}</p>
          <p className="text-xs opacity-75">{stats.pendingProducts} pending</p>
        </div>

        {/* Today's Stats */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm opacity-90">Today's Revenue</p>
            <span className="text-2xl">📈</span>
          </div>
          <p className="text-3xl font-bold mb-1">₦{stats.todayRevenue.toLocaleString()}</p>
          <p className="text-xs opacity-75">{stats.todayOrders} orders today</p>
        </div>
      </div>

      {/* Alert Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {stats.pendingOrders > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚠️</span>
              <div>
                <p className="font-semibold text-yellow-800 dark:text-yellow-400">{stats.pendingOrders} Pending Orders</p>
                <p className="text-sm text-yellow-700 dark:text-yellow-500">Require attention</p>
              </div>
            </div>
          </div>
        )}

        {stats.pendingVendorApps > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">📋</span>
              <div>
                <p className="font-semibold text-blue-800 dark:text-blue-400">{stats.pendingVendorApps} Vendor Applications</p>
                <p className="text-sm text-blue-700 dark:text-blue-500">Awaiting review</p>
              </div>
            </div>
          </div>
        )}

        {stats.activeDisputes > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⚡</span>
              <div>
                <p className="font-semibold text-red-800 dark:text-red-400">{stats.activeDisputes} Active Disputes</p>
                <p className="text-sm text-red-700 dark:text-red-500">Need resolution</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recent Orders */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Recent Orders</h2>
          {recentOrders.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No orders yet</p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map(order => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">#{order.id.substring(0, 8)}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{order.userName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">₦{order.total?.toLocaleString()}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Products */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold mb-4">Top Selling Products</h2>
          {topProducts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No sales data yet</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <span className="text-2xl font-bold text-gray-400">#{index + 1}</span>
                  <img
                    src={product.images?.[0] || 'https://via.placeholder.com/50'}
                    alt={product.name}
                    className="w-12 h-12 object-cover rounded"
                  />
                  <div className="flex-1">
                    <p className="font-medium line-clamp-1">{product.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{product.sales || 0} sales</p>
                  </div>
                  <p className="font-bold text-blue-600">₦{product.price?.toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Users */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Recent User Registrations</h2>
        {recentUsers.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No new users this week</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="text-left py-3 px-4">Name</th>
                  <th className="text-left py-3 px-4">Email</th>
                  <th className="text-left py-3 px-4">Role</th>
                  <th className="text-left py-3 px-4">Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map(user => (
                  <tr key={user.id} className="border-b dark:border-gray-700">
                    <td className="py-3 px-4 font-medium">{user.name}</td>
                    <td className="py-3 px-4 text-sm">{user.email}</td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2 py-1 rounded-full capitalize ${
                        user.role === 'vendor' ? 'bg-green-100 text-green-800' :
                        user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <button
          onClick={() => window.location.href = '/admin/vendor-approvals'}
          className="p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
        >
          <span className="text-3xl mb-2 block">📋</span>
          <p className="font-medium">Review Applications</p>
        </button>
        
        <button
          onClick={() => window.location.href = '/admin/products'}
          className="p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
        >
          <span className="text-3xl mb-2 block">📦</span>
          <p className="font-medium">Manage Products</p>
        </button>
        
        <button
          onClick={() => window.location.href = '/admin/orders'}
          className="p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
        >
          <span className="text-3xl mb-2 block">🛍️</span>
          <p className="font-medium">View Orders</p>
        </button>
        
        <button
          onClick={() => window.location.href = '/admin/users'}
          className="p-4 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30 rounded-lg transition-colors"
        >
          <span className="text-3xl mb-2 block">👥</span>
          <p className="font-medium">Manage Users</p>
        </button>
      </div>
    </div>
  );
};

export default AdminAnalytics;