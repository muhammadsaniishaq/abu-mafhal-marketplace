import React, { useState } from 'react';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../../config/firebase';

const VendorOrderManagement = ({ order, onUpdate }) => {
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: order.status,
    trackingNumber: order.trackingNumber || '',
    carrier: order.carrier || '',
    estimatedDelivery: order.estimatedDelivery || '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const carriers = ['DHL', 'UPS', 'FedEx', 'NIPOST', 'GIG Logistics', 'Aramex'];

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Update order
      await updateDoc(doc(db, 'vendorOrders', order.id), {
        status: updateData.status,
        trackingNumber: updateData.trackingNumber,
        carrier: updateData.carrier,
        estimatedDelivery: updateData.estimatedDelivery,
        updatedAt: new Date().toISOString()
      });

      // Add tracking history
      await addDoc(collection(db, 'orderTracking', order.orderId, 'history'), {
        status: updateData.status,
        description: updateData.notes || `Order status updated to ${updateData.status}`,
        timestamp: new Date().toISOString(),
        updatedBy: 'vendor'
      });

      // Also update main order
      await updateDoc(doc(db, 'orders', order.orderId), {
        status: updateData.status,
        trackingNumber: updateData.trackingNumber,
        carrier: updateData.carrier,
        estimatedDelivery: updateData.estimatedDelivery,
        updatedAt: new Date().toISOString()
      });

      alert('Order updated successfully!');
      setShowUpdateModal(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Error updating order:', error);
      alert('Failed to update order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowUpdateModal(true)}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
      >
        Update Status
      </button>

      {showUpdateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Update Order Status</h2>
              <button 
                onClick={() => setShowUpdateModal(false)}
                className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleUpdateOrder} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Order Status</label>
                <select
                  value={updateData.status}
                  onChange={(e) => setUpdateData({...updateData, status: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  required
                >
                  {statusOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tracking Number</label>
                <input
                  type="text"
                  value={updateData.trackingNumber}
                  onChange={(e) => setUpdateData({...updateData, trackingNumber: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  placeholder="TRK123456789"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Carrier</label>
                <select
                  value={updateData.carrier}
                  onChange={(e) => setUpdateData({...updateData, carrier: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                >
                  <option value="">Select Carrier</option>
                  {carriers.map(carrier => (
                    <option key={carrier} value={carrier}>{carrier}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Estimated Delivery</label>
                <input
                  type="date"
                  value={updateData.estimatedDelivery}
                  onChange={(e) => setUpdateData({...updateData, estimatedDelivery: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                <textarea
                  value={updateData.notes}
                  onChange={(e) => setUpdateData({...updateData, notes: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  placeholder="Add any additional notes about this update..."
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400"
              >
                {loading ? 'Updating...' : 'Update Order'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default VendorOrderManagement;