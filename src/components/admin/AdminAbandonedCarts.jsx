import React, { useState, useEffect } from 'react';
import { getAbandonedCarts, sendCartReminder } from '../../services/cartRecoveryService';

const AdminAbandonedCarts = () => {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchCarts();
  }, []);

  const fetchCarts = async () => {
    try {
      const data = await getAbandonedCarts();
      setCarts(data);
    } catch (error) {
      console.error('Error fetching carts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendReminder = async (cartId) => {
    try {
      await sendCartReminder(cartId);
      alert('Reminder sent successfully!');
      fetchCarts();
    } catch (error) {
      alert('Failed to send reminder');
    }
  };

  const filteredCarts = carts.filter(cart => {
    if (filter === 'recovered') return cart.recovered;
    if (filter === 'active') return !cart.recovered;
    return true;
  });

  const stats = {
    total: carts.length,
    active: carts.filter(c => !c.recovered).length,
    recovered: carts.filter(c => c.recovered).length,
    totalValue: carts.reduce((sum, c) => sum + (c.total || 0), 0),
    activeValue: carts.filter(c => !c.recovered).reduce((sum, c) => sum + (c.total || 0), 0),
    recoveredValue: carts.filter(c => c.recovered).reduce((sum, c) => sum + (c.total || 0), 0)
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
      <h1 className="text-3xl font-bold mb-6">Abandoned Cart Recovery</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Active Abandoned Carts</p>
          <p className="text-3xl font-bold">{stats.active}</p>
          <p className="text-sm text-orange-600 mt-2">Value: ₦{stats.activeValue.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 shadow">
          <p className="text-sm text-green-700 dark:text-green-400 mb-1">Recovered Carts</p>
          <p className="text-3xl font-bold text-green-800 dark:text-green-300">{stats.recovered}</p>
          <p className="text-sm text-green-600 mt-2">Value: ₦{stats.recoveredValue.toLocaleString()}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 shadow">
          <p className="text-sm text-blue-700 dark:text-blue-400 mb-1">Recovery Rate</p>
          <p className="text-3xl font-bold text-blue-800 dark:text-blue-300">
            {stats.total > 0 ? ((stats.recovered / stats.total) * 100).toFixed(1) : 0}%
          </p>
        </div>
      </div>

      {/* Filter */}
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-6 px-4 py-2 border rounded-lg dark:bg-gray-700"
      >
        <option value="all">All Carts</option>
        <option value="active">Active Only</option>
        <option value="recovered">Recovered Only</option>
      </select>

      {/* Carts Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left py-3 px-4">Customer</th>
              <th className="text-left py-3 px-4">Items</th>
              <th className="text-left py-3 px-4">Total Value</th>
              <th className="text-left py-3 px-4">Created</th>
              <th className="text-left py-3 px-4">Reminders</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCarts.map(cart => (
              <tr key={cart.id} className="border-b dark:border-gray-700">
                <td className="py-3 px-4">
                  <p className="font-medium">{cart.userName}</p>
                  <p className="text-sm text-gray-600">{cart.userEmail}</p>
                </td>
                <td className="py-3 px-4">
                  <p className="font-medium">{cart.items?.length || 0} items</p>
                  <p className="text-sm text-gray-600 line-clamp-1">
                    {cart.items?.[0]?.name}
                    {cart.items?.length > 1 && ` +${cart.items.length - 1} more`}
                  </p>
                </td>
                <td className="py-3 px-4 font-bold text-lg">
                  ₦{cart.total?.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-sm">
                  {new Date(cart.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <p className="font-medium">{cart.remindersSent || 0}</p>
                  {cart.lastReminderSent && (
                    <p className="text-xs text-gray-500">
                      Last: {new Date(cart.lastReminderSent).toLocaleDateString()}
                    </p>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    cart.recovered 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {cart.recovered ? 'Recovered' : 'Active'}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {!cart.recovered && (
                    <button
                      onClick={() => handleSendReminder(cart.id)}
                      disabled={cart.remindersSent >= 3}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {cart.remindersSent >= 3 ? 'Max Sent' : 'Send Reminder'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredCarts.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-600 dark:text-gray-400">No abandoned carts found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAbandonedCarts;