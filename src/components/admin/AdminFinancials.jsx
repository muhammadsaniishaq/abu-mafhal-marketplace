import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const AdminFinancials = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalRevenue: 0,
    platformCommission: 0,
    vendorEarnings: 0,
    pendingPayouts: 0,
    completedPayouts: 0,
    totalOrders: 0
  });
  const [revenueData, setRevenueData] = useState([]);
  const [payoutStatusData, setPayoutStatusData] = useState([]);

  const COLORS = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444'];
  const COMMISSION_RATE = 0.10;

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      // Fetch all orders
      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      const orders = ordersSnapshot.docs.map(doc => doc.data());

      // Fetch all payouts
      const payoutsSnapshot = await getDocs(collection(db, 'vendorPayouts'));
      const payouts = payoutsSnapshot.docs.map(doc => doc.data());

      // Calculate stats
      const totalRevenue = orders.reduce((sum, order) => sum + (order.total || 0), 0);
      const platformCommission = totalRevenue * COMMISSION_RATE;
      const vendorEarnings = totalRevenue - platformCommission;
      const pendingPayouts = payouts
        .filter(p => p.status === 'pending')
        .reduce((sum, p) => sum + (p.amount || 0), 0);
      const completedPayouts = payouts
        .filter(p => p.status === 'completed')
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      setStats({
        totalRevenue,
        platformCommission,
        vendorEarnings,
        pendingPayouts,
        completedPayouts,
        totalOrders: orders.length
      });

      // Revenue by month
      const revenueByMonth = {};
      orders.forEach(order => {
        const month = new Date(order.createdAt).toLocaleDateString('en-US', { month: 'short' });
        revenueByMonth[month] = (revenueByMonth[month] || 0) + order.total;
      });
      setRevenueData(Object.entries(revenueByMonth).map(([month, revenue]) => ({ month, revenue })));

      // Payout status breakdown
      const statusCounts = {
        pending: payouts.filter(p => p.status === 'pending').length,
        processing: payouts.filter(p => p.status === 'processing').length,
        completed: payouts.filter(p => p.status === 'completed').length,
        rejected: payouts.filter(p => p.status === 'rejected').length
      };
      setPayoutStatusData(Object.entries(statusCounts).map(([name, value]) => ({ 
        name: name.charAt(0).toUpperCase() + name.slice(1), 
        value 
      })));

    } catch (error) {
      console.error('Error fetching financial data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Financial Overview</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6">
          <p className="text-sm opacity-90 mb-1">Total Platform Revenue</p>
          <p className="text-3xl font-bold">₦{stats.totalRevenue.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">{stats.totalOrders} orders</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6">
          <p className="text-sm opacity-90 mb-1">Platform Commission (10%)</p>
          <p className="text-3xl font-bold">₦{stats.platformCommission.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">Your earnings</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6">
          <p className="text-sm opacity-90 mb-1">Vendor Earnings</p>
          <p className="text-3xl font-bold">₦{stats.vendorEarnings.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">90% to vendors</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg shadow p-6">
          <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-1">Pending Payouts</p>
          <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">₦{stats.pendingPayouts.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg shadow p-6">
          <p className="text-sm text-green-700 dark:text-green-400 mb-1">Completed Payouts</p>
          <p className="text-2xl font-bold text-green-800 dark:text-green-300">₦{stats.completedPayouts.toLocaleString()}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Payout Status</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={payoutStatusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {payoutStatusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default AdminFinancials;