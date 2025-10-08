import React, { useState } from 'react';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

const Marketing = () => {
  const { currentUser } = useAuth();
  const [coupon, setCoupon] = useState({
    code: '',
    discount: 0,
    type: 'percentage',
    expiryDate: '',
    minPurchase: 0
  });
  const [loading, setLoading] = useState(false);

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'coupons'), {
        ...coupon,
        vendorId: currentUser.uid,
        createdAt: new Date(),
        active: true
      });
      alert('Coupon created successfully!');
      setCoupon({
        code: '',
        discount: 0,
        type: 'percentage',
        expiryDate: '',
        minPurchase: 0
      });
    } catch (error) {
      console.error('Error creating coupon:', error);
      alert('Error creating coupon');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Marketing Tools
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Create Coupon</h2>
        <form onSubmit={handleCreateCoupon}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Coupon Code</label>
              <input
                type="text"
                value={coupon.code}
                onChange={(e) => setCoupon({ ...coupon, code: e.target.value.toUpperCase() })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                placeholder="SAVE20"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Discount Type</label>
              <select
                value={coupon.type}
                onChange={(e) => setCoupon({ ...coupon, type: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (₦)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Discount Value</label>
              <input
                type="number"
                value={coupon.discount}
                onChange={(e) => setCoupon({ ...coupon, discount: Number(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                min="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Expiry Date</label>
              <input
                type="date"
                value={coupon.expiryDate}
                onChange={(e) => setCoupon({ ...coupon, expiryDate: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Minimum Purchase (₦)</label>
              <input
                type="number"
                value={coupon.minPurchase}
                onChange={(e) => setCoupon({ ...coupon, minPurchase: Number(e.target.value) })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                min="0"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Creating...' : 'Create Coupon'}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Marketing Tips</h2>
        <ul className="space-y-3 text-gray-600 dark:text-gray-400">
          <li>✓ Create seasonal promotions to boost sales</li>
          <li>✓ Offer bundle deals on related products</li>
          <li>✓ Use limited-time offers to create urgency</li>
          <li>✓ Reward loyal customers with exclusive discounts</li>
          <li>✓ Share your store on social media platforms</li>
        </ul>
      </div>
    </div>
  );
};

export default Marketing;