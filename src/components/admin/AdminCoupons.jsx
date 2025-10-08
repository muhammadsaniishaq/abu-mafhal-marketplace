import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage',
    value: '',
    minPurchase: 0,
    maxDiscount: 0,
    usageLimit: 0,
    usedCount: 0,
    expiryDate: '',
    active: true,
    description: ''
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'coupons'));
      const couponsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      couponsData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setCoupons(couponsData);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateCouponCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const couponData = {
        ...formData,
        code: formData.code.toUpperCase(),
        value: parseFloat(formData.value),
        minPurchase: parseFloat(formData.minPurchase) || 0,
        maxDiscount: parseFloat(formData.maxDiscount) || 0,
        usageLimit: parseInt(formData.usageLimit) || 0,
        usedCount: editingId ? formData.usedCount : 0,
        createdAt: editingId ? formData.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'coupons', editingId), couponData);
        alert('Coupon updated successfully!');
      } else {
        await addDoc(collection(db, 'coupons'), couponData);
        alert('Coupon created successfully!');
      }

      setShowCreateModal(false);
      resetForm();
      fetchCoupons();
    } catch (error) {
      console.error('Error saving coupon:', error);
      alert('Failed to save coupon');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (coupon) => {
    setFormData(coupon);
    setEditingId(coupon.id);
    setShowCreateModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;

    try {
      await deleteDoc(doc(db, 'coupons', id));
      alert('Coupon deleted successfully!');
      fetchCoupons();
    } catch (error) {
      console.error('Error deleting coupon:', error);
      alert('Failed to delete coupon');
    }
  };

  const toggleActive = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'coupons', id), {
        active: !currentStatus,
        updatedAt: new Date().toISOString()
      });
      fetchCoupons();
    } catch (error) {
      console.error('Error toggling coupon status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      type: 'percentage',
      value: '',
      minPurchase: 0,
      maxDiscount: 0,
      usageLimit: 0,
      usedCount: 0,
      expiryDate: '',
      active: true,
      description: ''
    });
    setEditingId(null);
  };

  const isExpired = (expiryDate) => {
    return new Date(expiryDate) < new Date();
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Coupon Management</h1>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
        >
          Create Coupon
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Coupons</p>
          <p className="text-2xl font-bold">{coupons.length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-green-700 dark:text-green-400">Active Coupons</p>
          <p className="text-2xl font-bold text-green-800 dark:text-green-300">
            {coupons.filter(c => c.active && !isExpired(c.expiryDate)).length}
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-blue-700 dark:text-blue-400">Total Uses</p>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
            {coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-red-700 dark:text-red-400">Expired</p>
          <p className="text-2xl font-bold text-red-800 dark:text-red-300">
            {coupons.filter(c => isExpired(c.expiryDate)).length}
          </p>
        </div>
      </div>

      {/* Coupons Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left py-3 px-4">Code</th>
              <th className="text-left py-3 px-4">Type</th>
              <th className="text-left py-3 px-4">Value</th>
              <th className="text-left py-3 px-4">Usage</th>
              <th className="text-left py-3 px-4">Expiry</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map(coupon => (
              <tr key={coupon.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="py-3 px-4">
                  <p className="font-mono font-bold text-lg">{coupon.code}</p>
                  {coupon.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">{coupon.description}</p>
                  )}
                </td>
                <td className="py-3 px-4 capitalize">{coupon.type}</td>
                <td className="py-3 px-4">
                  <p className="font-bold text-green-600">
                    {coupon.type === 'percentage' ? `${coupon.value}%` : `₦${coupon.value.toLocaleString()}`}
                  </p>
                  {coupon.minPurchase > 0 && (
                    <p className="text-xs text-gray-500">Min: ₦{coupon.minPurchase.toLocaleString()}</p>
                  )}
                  {coupon.maxDiscount > 0 && coupon.type === 'percentage' && (
                    <p className="text-xs text-gray-500">Max: ₦{coupon.maxDiscount.toLocaleString()}</p>
                  )}
                </td>
                <td className="py-3 px-4">
                  <p>{coupon.usedCount || 0} / {coupon.usageLimit || '∞'}</p>
                  {coupon.usageLimit > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${((coupon.usedCount || 0) / coupon.usageLimit) * 100}%` }}
                      ></div>
                    </div>
                  )}
                </td>
                <td className="py-3 px-4 text-sm">
                  {new Date(coupon.expiryDate).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  {isExpired(coupon.expiryDate) ? (
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Expired</span>
                  ) : coupon.active ? (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Active</span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">Inactive</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(coupon)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(coupon.id, coupon.active)}
                      className={`px-3 py-1 rounded text-sm ${
                        coupon.active 
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {coupon.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(coupon.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {coupons.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-600 dark:text-gray-400">No coupons created yet</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                {editingId ? 'Edit Coupon' : 'Create Coupon'}
              </h2>
              <button 
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Coupon Code *</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    required
                    className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 font-mono"
                    placeholder="SUMMER2025"
                  />
                  <button
                    type="button"
                    onClick={generateCouponCode}
                    className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg"
                  >
                    Generate
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  placeholder="Summer sale discount"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Type *</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Value *</label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({...formData, value: e.target.value})}
                    required
                    min="1"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder={formData.type === 'percentage' ? '10' : '5000'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Min Purchase (₦)</label>
                  <input
                    type="number"
                    value={formData.minPurchase}
                    onChange={(e) => setFormData({...formData, minPurchase: e.target.value})}
                    min="0"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Max Discount (₦)</label>
                  <input
                    type="number"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({...formData, maxDiscount: e.target.value})}
                    min="0"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="0 = unlimited"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Usage Limit</label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({...formData, usageLimit: e.target.value})}
                    min="0"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="0 = unlimited"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Expiry Date *</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400"
              >
                {loading ? 'Saving...' : editingId ? 'Update Coupon' : 'Create Coupon'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCoupons;