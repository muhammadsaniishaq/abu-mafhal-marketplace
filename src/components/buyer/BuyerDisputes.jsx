import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { createDispute } from '../../services/disputeService';

const BuyerDisputes = () => {
  const { currentUser } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [formData, setFormData] = useState({
    subject: '',
    category: 'product',
    description: '',
    desiredResolution: ''
  });

  const categories = [
    { value: 'product', label: 'Product Quality Issue' },
    { value: 'delivery', label: 'Delivery Problem' },
    { value: 'description', label: 'Item Not as Described' },
    { value: 'damaged', label: 'Damaged/Defective Item' },
    { value: 'missing', label: 'Missing Items' },
    { value: 'refund', label: 'Refund Request' },
    { value: 'other', label: 'Other' }
  ];

  useEffect(() => {
    fetchDisputes();
    fetchOrders();
  }, [currentUser]);

  const fetchDisputes = async () => {
    try {
      const q = query(
        collection(db, 'disputes'),
        where('buyerId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const disputesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDisputes(disputesData);
    } catch (error) {
      console.error('Error fetching disputes:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const q = query(
        collection(db, 'orders'),
        where('userId', '==', currentUser.uid),
        where('status', 'in', ['delivered', 'completed'])
      );
      const snapshot = await getDocs(q);
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const disputeData = {
        buyerId: currentUser.uid,
        buyerName: currentUser.name,
        buyerEmail: currentUser.email,
        orderId: selectedOrder.id,
        vendorId: selectedOrder.items[0].vendorId,
        vendorName: selectedOrder.items[0].vendorName,
        orderTotal: selectedOrder.total,
        subject: formData.subject,
        category: formData.category,
        description: formData.description,
        desiredResolution: formData.desiredResolution
      };

      await createDispute(disputeData);
      alert('Dispute filed successfully! Our team will review it shortly.');
      setShowCreateModal(false);
      setFormData({
        subject: '',
        category: 'product',
        description: '',
        desiredResolution: ''
      });
      setSelectedOrder(null);
      fetchDisputes();
    } catch (error) {
      console.error('Error creating dispute:', error);
      alert('Failed to file dispute');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      investigating: 'bg-blue-100 text-blue-800 border-blue-300',
      resolved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
      closed: 'bg-gray-100 text-gray-800 border-gray-300'
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
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Disputes</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
        >
          File a Dispute
        </button>
      </div>

      {disputes.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg">
          <p className="text-6xl mb-4">⚖️</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No disputes filed</h2>
          <p className="text-gray-600 dark:text-gray-400">We hope all your orders are going smoothly!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map(dispute => (
            <div key={dispute.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {dispute.subject}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Dispute #{dispute.id.substring(0, 8)} • Order #{dispute.orderId.substring(0, 8)}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(dispute.status)}`}>
                  {dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">{dispute.description}</p>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  Filed on {new Date(dispute.createdAt).toLocaleDateString()}
                </div>
                <Link
                  to={`/buyer/disputes/${dispute.id}`}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dispute Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">File a Dispute</h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full"
              >
                ×
              </button>
            </div>

            {!selectedOrder ? (
              <div>
                <h3 className="font-semibold mb-4">Select an order to dispute:</h3>
                {orders.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-400">
                    No eligible orders. You can only dispute delivered or completed orders.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {orders.map(order => (
                      <button
                        key={order.id}
                        onClick={() => setSelectedOrder(order)}
                        className="w-full p-4 border rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-900"
                      >
                        <p className="font-medium">Order #{order.id.substring(0, 8)}</p>
                        <p className="text-sm text-gray-600">
                          {order.items.length} items • ₦{order.total.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.createdAt).toLocaleDateString()}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm">
                    Order #{selectedOrder.id.substring(0, 8)}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedOrder(null)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Change order
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Subject</label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="Brief summary of the issue"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  >
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    required
                    rows="4"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="Describe the issue in detail..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Desired Resolution</label>
                  <textarea
                    value={formData.desiredResolution}
                    onChange={(e) => setFormData({...formData, desiredResolution: e.target.value})}
                    required
                    rows="3"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="What would you like to happen? (e.g., refund, replacement, etc.)"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400"
                >
                  {loading ? 'Filing...' : 'File Dispute'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerDisputes;