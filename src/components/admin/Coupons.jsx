import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';

const Coupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage',
    value: 0,
    min_purchase: 0,
    max_discount: 0,
    usage_limit: 0,
    expiry_date: '',
    active: true,
    applicable_to: 'all'
  });

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('coupons')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCoupons(data || []);
    } catch (error) {
      console.error('Error fetching coupons:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const couponData = {
        code: formData.code,
        type: formData.type,
        value: parseFloat(formData.value),
        min_purchase: parseFloat(formData.min_purchase),
        max_discount: parseFloat(formData.max_discount),
        usage_limit: parseInt(formData.usage_limit),
        expiry_date: formData.expiry_date,
        active: formData.active,
        applicable_to: formData.applicable_to,
        updated_at: new Date().toISOString()
      };

      if (editingCoupon) {
        const { error } = await supabase
          .from('coupons')
          .update(couponData)
          .eq('id', editingCoupon.id);
        if (error) throw error;
        alert('Coupon updated successfully!');
      } else {
        couponData.used_count = 0;
        couponData.created_at = new Date().toISOString();
        const { error } = await supabase
          .from('coupons')
          .insert(couponData);
        if (error) throw error;
        alert('Coupon created successfully!');
      }
      
      resetForm();
      fetchCoupons();
    } catch (error) {
      console.error('Error saving coupon:', error.message);
      alert('Failed to save coupon');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code || '',
      type: coupon.type || 'percentage',
      value: coupon.value || 0,
      min_purchase: coupon.min_purchase || coupon.minPurchase || 0,
      max_discount: coupon.max_discount || coupon.maxDiscount || 0,
      usage_limit: coupon.usage_limit || coupon.usageLimit || 0,
      expiry_date: coupon.expiry_date || coupon.expiryDate || '',
      active: coupon.active ?? true,
      applicable_to: coupon.applicable_to || coupon.applicableTo || 'all'
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this coupon?')) {
      try {
        const { error } = await supabase
          .from('coupons')
          .delete()
          .eq('id', id);
        if (error) throw error;
        alert('Coupon deleted successfully!');
        fetchCoupons();
      } catch (error) {
        console.error('Error deleting coupon:', error.message);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      code: '',
      type: 'percentage',
      value: 0,
      min_purchase: 0,
      max_discount: 0,
      usage_limit: 0,
      expiry_date: '',
      active: true,
      applicable_to: 'all'
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
              <p><strong>Min Purchase:</strong> ₦{(coupon.min_purchase || coupon.minPurchase || 0).toLocaleString()}</p>
              {(coupon.max_discount > 0 || coupon.maxDiscount > 0) && (
                <p><strong>Max Discount:</strong> ₦{(coupon.max_discount || coupon.maxDiscount || 0).toLocaleString()}</p>
              )}
              <p><strong>Usage:</strong> {coupon.used_count || coupon.usedCount || 0} / {coupon.usage_limit || coupon.usageLimit || '∞'}</p>
              <p><strong>Expires:</strong> {new Date(coupon.expiry_date || coupon.expiryDate).toLocaleDateString()}</p>
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
                    value={formData.min_purchase}
                    onChange={(e) => setFormData({...formData, min_purchase: parseFloat(e.target.value)})}
                    min="0"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Max Discount (₦)</label>
                  <input
                    type="number"
                    value={formData.max_discount}
                    onChange={(e) => setFormData({...formData, max_discount: parseFloat(e.target.value)})}
                    min="0"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Usage Limit</label>
                  <input
                    type="number"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({...formData, usage_limit: parseInt(e.target.value)})}
                    min="0"
                    placeholder="0 for unlimited"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({...formData, expiry_date: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Applicable To</label>
                <select
                  value={formData.applicable_to}
                  onChange={(e) => setFormData({...formData, applicable_to: e.target.value})}
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