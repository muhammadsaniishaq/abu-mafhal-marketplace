// src/components/admin/ProductModeration.jsx
import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { formatCurrency, formatDate, getStatusColor } from '../../utils/helpers';

const ProductModeration = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          users!products_vendor_id_fkey (name, business_name)
        `)
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (productId) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString()
        })
        .eq('id', productId);
        
      if (error) throw error;
      setProducts(products.map(p => p.id === productId ? {...p, status: 'approved'} : p));
    } catch (error) {
      alert('Failed to approve product');
    }
  };

  const handleReject = async (productId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({
          status: 'rejected',
          rejection_reason: reason,
          rejected_at: new Date().toISOString()
        })
        .eq('id', productId);
        
      if (error) throw error;
      setProducts(products.map(p => p.id === productId ? {...p, status: 'rejected'} : p));
    } catch (error) {
      alert('Failed to reject product');
    }
  };

  const filteredProducts = products.filter(p => filter === 'all' || p.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Product Moderation</h1>
        <p className="text-gray-600 dark:text-gray-400">Review and moderate product listings</p>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex space-x-2 border-b dark:border-gray-700">
        {['pending', 'approved', 'rejected', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 font-medium capitalize ${
              filter === status
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 dark:text-gray-400 hover:text-blue-600'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div key={product.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              <div className="aspect-square bg-gray-200 dark:bg-gray-700">
                {product.images?.[0] && (
                  <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover" />
                )}
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-gray-800 dark:text-white">{product.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(product.status)}`}>
                    {product.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  by {product.users?.business_name || product.users?.name || product.vendor_name || product.vendorName || 'Vendor'}
                </p>
                <p className="text-xl font-bold text-blue-600 mb-4">
                  {formatCurrency(product.price)}
                </p>
                
                {product.status === 'pending' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleApprove(product.id)}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(product.id)}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductModeration;