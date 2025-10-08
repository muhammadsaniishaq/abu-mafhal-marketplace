import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage',
    value: 0,
    minPurchase: 0,
    maxDiscount: 0,
    usageLimit: 0,
    expiryDate: '',
    active: true,
    applicableTo: 'all'
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'coupons'));
      const couponsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCoupons(couponsData);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingCoupon) {
        await updateDoc(doc(db, 'coupons', editingCoupon.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        alert('Coupon updated successfully!');
      } else {
        await addDoc(collection(db, 'coupons'), {
          ...formData,
          usedCount: 0,
          createdAt: new Date().toISOString()
        });
        alert('Coupon created successfully!');
      }
      
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
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      minPurchase: coupon.minPurchase,
      maxDiscount: coupon.maxDiscount,
      usageLimit: coupon.usageLimit,
      expiryDate: coupon.expiryDate,
      active: coupon.active,
      applicableTo: coupon.applicableTo
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this coupon?')) {
      try {
        await deleteDoc(doc(db, 'coupons', id));
        alert('Coupon deleted successfully!');
        fetchCoupons();
      } catch (error) {
        console.error('Error deleting coupon:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      type: 'percentage',
      value: 0,
      minPurchase: 0,
      maxDiscount: 0,
      usageLimit: 0,
      expiryDate: '',
      active: true,
      applicableTo: 'all'
    });
    setEditingCoupon(null);
    setShowModal(false);
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({...formData, code});
  };

  if (loading && coupons.length === 0) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Coupon Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
        >
          Create Coupon
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {coupons.map(coupon => (
          <div key={coupon.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-blue-600">{coupon.code}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${coupon.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {coupon.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(coupon)} className="text-blue-600 hover:text-blue-800">Edit</button>
                <button onClick={() => handleDelete(coupon.id)} className="text-red-600 hover:text-red-800">Delete</button>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <p><strong>Discount:</strong> {coupon.type === 'percentage' ? `${coupon.value}%` : `₦${coupon.value}`}</p>
              <p><strong>Min Purchase:</strong> ₦{coupon.minPurchase?.toLocaleString()}</p>
              {coupon.maxDiscount > 0 && <p><strong>Max Discount:</strong> ₦{coupon.maxDiscount?.toLocaleString()}</p>}
              <p><strong>Usage:</strong> {coupon.usedCount || 0} / {coupon.usageLimit || '∞'}</p>
              <p><strong>Expires:</strong> {new Date(coupon.expiryDate).toLocaleDateString()}</p>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</h2>
              <button onClick={resetForm} className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full">×</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Coupon Code</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                    required
                    className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="SUMMER2024"
                  />
                  <button type="button" onClick={generateRandomCode} className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg">
                    Generate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Discount Type</label>
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
                  <label className="block text-sm font-medium mb-2">Discount Value</label>
                  <input
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({...formData, value: parseFloat(e.target.value)})}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Min Purchase (₦)</label>
                  <input
                    type="number"
                    value={formData.minPurchase}
                    onChange={(e) => setFormData({...formData, minPurchase: parseFloat(e.target.value)})}
                    min="0"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Max Discount (₦)</label>
                  <input
                    type="number"
                    value={formData.maxDiscount}
                    onChange={(e) => setFormData({...formData, maxDiscount: parseFloat(e.target.value)})}
                    min="0"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Usage Limit</label>
                  <input
                    type="number"
                    value={formData.usageLimit}
                    onChange={(e) => setFormData({...formData, usageLimit: parseInt(e.target.value)})}
                    min="0"
                    placeholder="0 for unlimited"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiryDate}
                    onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Applicable To</label>
                <select
                  value={formData.applicableTo}
                  onChange={(e) => setFormData({...formData, applicableTo: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                >
                  <option value="all">All Products</option>
                  <option value="category">Specific Category</option>
                  <option value="vendor">Specific Vendor</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({...formData, active: e.target.checked})}
                  className="w-5 h-5"
                />
                <label className="text-sm font-medium">Active</label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400"
              >
                {loading ? 'Saving...' : (editingCoupon ? 'Update Coupon' : 'Create Coupon')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Coupons;