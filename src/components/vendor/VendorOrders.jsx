import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { sendOrderNotification } from '../../services/notificationService';
import { sendLowStockAlert } from '../../services/notificationService';

const VendorOrders = () => {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    if (currentUser?.uid) {
      fetchOrders();
    }
  }, [currentUser]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('vendor_orders')
        .select('*')
        .eq('vendor_id', currentUser.uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching orders:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    if (!window.confirm(`Are you sure you want to mark this order as ${newStatus}?`)) {
      return;
    }

    setLoading(true);
    try {
      const now = new Date().toISOString();
      const statusUpdate = {
        status: newStatus,
        updated_at: now,
        ...(newStatus === 'shipped' && { shipped_at: now }),
        ...(newStatus === 'delivered' && { delivered_at: now }),
        ...(newStatus === 'cancelled' && { cancelled_at: now })
      };

      // Update vendor order status
      const { error: updateError } = await supabase
        .from('vendor_orders')
        .update(statusUpdate)
        .eq('id', orderId);

      if (updateError) throw updateError;

      // Get order details to check stock and main order
      const { data: orderData, error: fetchError } = await supabase
        .from('vendor_orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchError) throw fetchError;

      // Update main order status if all vendor orders have same status
      const mainOrderId = orderData.order_id || orderData.orderId;
      if (mainOrderId) {
        const { data: allVendorOrders, error: allOrdersError } = await supabase
          .from('vendor_orders')
          .select('status')
          .eq('order_id', mainOrderId);

        if (!allOrdersError && allVendorOrders) {
          const allSameStatus = allVendorOrders.every(
            vOrder => vOrder.status === newStatus
          );

          if (allSameStatus) {
            const { error: mainOrderError } = await supabase
              .from('orders')
              .update({
                status: newStatus,
                updated_at: now
              })
              .eq('id', mainOrderId);

            if (mainOrderError) {
              console.error('Error updating main order:', mainOrderError.message);
            }
          }
        }
      }

      // ✅ SEND NOTIFICATION TO BUYER
      await sendOrderNotification(
        mainOrderId || orderId,
        orderData.user_id || orderData.userId,
        'buyer',
        newStatus,
        { 
          total: orderData.total,
          orderNumber: orderId.substring(0, 8),
          vendorName: currentUser.name || currentUser.full_name
        }
      );

      // ✅ CHECK STOCK LEVELS AND ALERT IF LOW
      if (newStatus === 'shipped' || newStatus === 'delivered') {
        const items = orderData.items || [];
        for (const item of items) {
          try {
            const { data: product, error: productError } = await supabase
              .from('products')
              .select('id, name, stock')
              .eq('id', item.productId || item.product_id)
              .single();

            if (!productError && product) {
              if (product.stock < 10) {
                await sendLowStockAlert(
                  product.id,
                  currentUser.uid,
                  product.name,
                  product.stock
                );
              }
            }
          } catch (error) {
            console.error('Error checking stock:', error.message);
          }
        }
      }

      alert(`Order successfully marked as ${newStatus}!`);
      setShowDetailsModal(false);
      fetchOrders();
    } catch (error) {
      console.error('Error updating order status:', error.message);
      alert('Failed to update order status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowDetailsModal(true);
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      shipped: 'bg-purple-100 text-purple-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const filteredOrders = orders.filter(order => {
    if (filter === 'all') return true;
    return order.status === filter;
  });

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    processing: orders.filter(o => o.status === 'processing').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
    totalRevenue: orders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + (o.total || 0), 0)
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Orders Management</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Orders</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">Pending</p>
          <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">{stats.pending}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-blue-700 dark:text-blue-400">Processing</p>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{stats.processing}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-purple-700 dark:text-purple-400">Shipped</p>
          <p className="text-2xl font-bold text-purple-800 dark:text-purple-300">{stats.shipped}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-green-700 dark:text-green-400">Delivered</p>
          <p className="text-2xl font-bold text-green-800 dark:text-green-300">{stats.delivered}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-red-700 dark:text-red-400">Cancelled</p>
          <p className="text-2xl font-bold text-red-800 dark:text-red-300">{stats.cancelled}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-4 shadow">
          <p className="text-sm opacity-90">Revenue</p>
          <p className="text-xl font-bold">₦{stats.totalRevenue.toLocaleString()}</p>
        </div>
      </div>

      {/* Filter */}
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-6 px-4 py-2 border rounded-lg dark:bg-gray-700"
      >
        <option value="all">All Orders</option>
        <option value="pending">Pending</option>
        <option value="processing">Processing</option>
        <option value="shipped">Shipped</option>
        <option value="delivered">Delivered</option>
        <option value="cancelled">Cancelled</option>
      </select>

      {/* Orders Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left py-3 px-4">Order ID</th>
              <th className="text-left py-3 px-4">Customer</th>
              <th className="text-left py-3 px-4">Items</th>
              <th className="text-left py-3 px-4">Total</th>
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(order => (
              <tr key={order.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="py-3 px-4 font-mono text-sm">#{typeof order.id === 'string' ? order.id.substring(0, 8) : order.id}</td>
                <td className="py-3 px-4">
                  <p className="font-medium">{order.user_name || order.userName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{order.user_email || order.userEmail || 'N/A'}</p>
                </td>
                <td className="py-3 px-4">
                  <p className="font-medium">{order.items?.length || 0} items</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">
                    {order.items?.[0]?.productName}
                    {order.items?.length > 1 && ` +${order.items.length - 1}`}
                  </p>
                </td>
                <td className="py-3 px-4 font-bold text-lg">₦{order.total?.toLocaleString()}</td>
                <td className="py-3 px-4 text-sm">
                  {new Date(order.created_at || order.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                    {order.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => viewOrderDetails(order)}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    View Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredOrders.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-600 dark:text-gray-400">No orders found</p>
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Order Details</h2>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full"
              >
                ×
              </button>
            </div>

            {/* Order Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Order ID</p>
                <p className="font-mono font-bold">#{typeof selectedOrder.id === 'string' ? selectedOrder.id.substring(0, 8) : selectedOrder.id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedOrder.status)}`}>
                  {selectedOrder.status}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Order Date</p>
                <p className="font-medium">{new Date(selectedOrder.created_at || selectedOrder.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
                <p className="font-bold text-lg">₦{selectedOrder.total?.toLocaleString()}</p>
              </div>
            </div>

            {/* Customer Info */}
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
              <h3 className="font-semibold mb-3">Customer Information</h3>
              <p><strong>Name:</strong> {selectedOrder.user_name || selectedOrder.userName}</p>
              <p><strong>Email:</strong> {selectedOrder.user_email || selectedOrder.userEmail || 'N/A'}</p>
              {(selectedOrder.shipping_address || selectedOrder.shippingAddress) && (
                <>
                  <p className="mt-2"><strong>Shipping Address:</strong></p>
                  <p>{(selectedOrder.shipping_address || selectedOrder.shippingAddress).address}</p>
                  <p>{(selectedOrder.shipping_address || selectedOrder.shippingAddress).city}, {(selectedOrder.shipping_address || selectedOrder.shippingAddress).state} {(selectedOrder.shipping_address || selectedOrder.shippingAddress).zipCode}</p>
                  <p><strong>Phone:</strong> {(selectedOrder.shipping_address || selectedOrder.shippingAddress).phone}</p>
                </>
              )}
            </div>

            {/* Order Items */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Order Items</h3>
              <div className="space-y-3">
                {selectedOrder.items?.map((item, index) => (
                  <div key={index} className="flex gap-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <img
                      src={item.images?.[0] || 'https://via.placeholder.com/80'}
                      alt={item.productName}
                      className="w-20 h-20 object-cover rounded"
                    />
                    <div className="flex-1">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-gray-600">Quantity: {item.quantity}</p>
                      <p className="text-sm font-bold">₦{item.price?.toLocaleString()} each</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₦{(item.price * item.quantity).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Status Update Actions */}
            <div className="border-t dark:border-gray-700 pt-6">
              <h3 className="font-semibold mb-3">Update Order Status</h3>
              <div className="grid grid-cols-2 gap-3">
                {selectedOrder.status === 'pending' && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'processing')}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    Mark as Processing
                  </button>
                )}
                
                {(selectedOrder.status === 'pending' || selectedOrder.status === 'processing') && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'shipped')}
                    disabled={loading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400"
                  >
                    Mark as Shipped
                  </button>
                )}

                {selectedOrder.status === 'shipped' && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'delivered')}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                  >
                    Mark as Delivered
                  </button>
                )}

                {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
                  <button
                    onClick={() => updateOrderStatus(selectedOrder.id, 'cancelled')}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorOrders;