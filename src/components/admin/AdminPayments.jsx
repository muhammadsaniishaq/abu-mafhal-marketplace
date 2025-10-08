import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';

const AdminPayments = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const ordersSnapshot = await getDocs(collection(db, 'orders'));
      const paymentsData = ordersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        paymentStatus: doc.data().status === 'delivered' ? 'completed' : 
                       doc.data().status === 'cancelled' ? 'refunded' : 'pending'
      }));
      setPayments(paymentsData);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterByDate = (payment) => {
    if (dateRange === 'all') return true;
    
    const paymentDate = new Date(payment.createdAt);
    const now = new Date();
    
    switch (dateRange) {
      case 'today':
        return paymentDate.toDateString() === now.toDateString();
      case 'week':
        const weekAgo = new Date(now.setDate(now.getDate() - 7));
        return paymentDate >= weekAgo;
      case 'month':
        const monthAgo = new Date(now.setMonth(now.getMonth() - 1));
        return paymentDate >= monthAgo;
      default:
        return true;
    }
  };

  const filteredPayments = payments
    .filter(payment => {
      const matchesFilter = filter === 'all' || payment.paymentStatus === filter;
      const matchesDate = filterByDate(payment);
      return matchesFilter && matchesDate;
    });

  const stats = {
    totalRevenue: payments.reduce((sum, p) => sum + (p.total || 0), 0),
    completedPayments: payments.filter(p => p.paymentStatus === 'completed').length,
    pendingPayments: payments.filter(p => p.paymentStatus === 'pending').length,
    refundedPayments: payments.filter(p => p.paymentStatus === 'refunded').length,
    completedRevenue: payments.filter(p => p.paymentStatus === 'completed').reduce((sum, p) => sum + (p.total || 0), 0),
    pendingRevenue: payments.filter(p => p.paymentStatus === 'pending').reduce((sum, p) => sum + (p.total || 0), 0),
    platformCommission: payments.filter(p => p.paymentStatus === 'completed').reduce((sum, p) => sum + (p.total || 0), 0) * 0.10
  };

  const getPaymentStatusColor = (status) => {
    const colors = {
      completed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      refunded: 'bg-red-100 text-red-800',
      failed: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
      <h1 className="text-3xl font-bold mb-6">Payment Management</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6 shadow-lg">
          <p className="text-sm opacity-90 mb-1">Total Revenue</p>
          <p className="text-3xl font-bold">₦{stats.totalRevenue.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">{payments.length} transactions</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6 shadow-lg">
          <p className="text-sm opacity-90 mb-1">Completed Payments</p>
          <p className="text-3xl font-bold">₦{stats.completedRevenue.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">{stats.completedPayments} payments</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg p-6 shadow-lg">
          <p className="text-sm opacity-90 mb-1">Pending Payments</p>
          <p className="text-3xl font-bold">₦{stats.pendingRevenue.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">{stats.pendingPayments} payments</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6 shadow-lg">
          <p className="text-sm opacity-90 mb-1">Platform Commission (10%)</p>
          <p className="text-3xl font-bold">₦{stats.platformCommission.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">From completed orders</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-700"
        >
          <option value="all">All Payments</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="refunded">Refunded</option>
        </select>

        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-700"
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
        </select>
      </div>

      {/* Payments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left py-3 px-4">Transaction ID</th>
              <th className="text-left py-3 px-4">Customer</th>
              <th className="text-left py-3 px-4">Payment Method</th>
              <th className="text-left py-3 px-4">Amount</th>
              <th className="text-left py-3 px-4">Commission</th>
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-left py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayments.map(payment => (
              <tr key={payment.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="py-3 px-4 font-mono text-sm">#{payment.id.substring(0, 8)}</td>
                <td className="py-3 px-4">
                  <p className="font-medium">{payment.userName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{payment.userEmail}</p>
                </td>
                <td className="py-3 px-4 capitalize">
                  {payment.paymentMethod || 'Card'}
                </td>
                <td className="py-3 px-4 font-bold text-lg">
                  ₦{payment.total?.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-purple-600 font-medium">
                  ₦{((payment.total || 0) * 0.10).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-sm">
                  {new Date(payment.createdAt).toLocaleDateString()}
                  <br />
                  <span className="text-xs text-gray-500">
                    {new Date(payment.createdAt).toLocaleTimeString()}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPaymentStatusColor(payment.paymentStatus)}`}>
                    {payment.paymentStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredPayments.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-600 dark:text-gray-400">No payments found</p>
          </div>
        )}
      </div>

      {/* Summary Section */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-1">Vendor Earnings (90%)</p>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
            ₦{(stats.completedRevenue * 0.90).toLocaleString()}
          </p>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <p className="text-sm text-purple-700 dark:text-purple-400 mb-1">Platform Revenue (10%)</p>
          <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">
            ₦{stats.platformCommission.toLocaleString()}
          </p>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <p className="text-sm text-green-700 dark:text-green-400 mb-1">Average Transaction</p>
          <p className="text-2xl font-bold text-green-800 dark:text-green-300">
            ₦{payments.length > 0 ? Math.round(stats.totalRevenue / payments.length).toLocaleString() : 0}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminPayments;