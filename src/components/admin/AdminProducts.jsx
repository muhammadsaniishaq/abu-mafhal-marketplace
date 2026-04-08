import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiFilter, FiPlus, FiEye, FiEdit2, FiTrash2, FiCheckCircle, FiXCircle, FiMoreVertical } from 'react-icons/fi';

const AdminProducts = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          vendor:vendor_id(full_name, email)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (productId) => {
    if (!window.confirm('Approve this product? It will become visible on the marketplace.')) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          status: 'approved',
        })
        .eq('id', productId);

      if (error) throw error;
      
      // Update local state
      setProducts(products.map(p => p.id === productId ? { ...p, status: 'approved' } : p));
      setActiveDropdown(null);
    } catch (error) {
      console.error('Error approving product:', error);
      alert('Failed to approve product');
    }
  };

  const handleReject = async (productId) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .update({ 
          status: 'rejected',
          metadata: { rejection_reason: rejectionReason } // Assumes we can safely merge or simply overwrite this part in a real env, but a direct replace works for mock
        })
        .eq('id', productId);

      if (error) throw error;

      setProducts(products.map(p => p.id === productId ? { ...p, status: 'rejected' } : p));
      setShowModal(false);
      setRejectionReason('');
      setActiveDropdown(null);
    } catch (error) {
       console.error(error);
      alert('Failed to reject product');
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Permanently delete this product? This cannot be undone!')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      
      setProducts(products.filter(p => p.id !== productId));
      setActiveDropdown(null);
    } catch (error) {
      console.error(error);
      alert('Failed to delete product');
    }
  };

  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.vendor?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filter === 'all' || product.status === filter;
      return matchesSearch && matchesFilter;
    });

  const stats = {
    all: products.length,
    pending: products.filter(p => p.status === 'pending').length,
    approved: products.filter(p => p.status === 'approved').length,
    rejected: products.filter(p => p.status === 'rejected').length
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="font-sans">
      {/* Header Area */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">Product Database</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Manage global inventory, review submissions, and control catalog.</p>
        </div>
        <button
          onClick={() => navigate('/admin/products/add')}
          className="group flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:-translate-y-0.5"
        >
          <FiPlus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
          Add New Product
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-[#111111] border border-gray-200/50 dark:border-white/5 rounded-2xl p-6 shadow-sm">
          <p className="text-gray-500 dark:text-gray-400 text-sm font-bold tracking-wider uppercase mb-1">Total Products</p>
          <p className="text-3xl font-black text-gray-900 dark:text-white">{stats.all}</p>
        </div>
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/10 border border-yellow-200/50 dark:border-yellow-500/20 rounded-2xl p-6 shadow-sm">
          <p className="text-yellow-700 dark:text-yellow-500 text-sm font-bold tracking-wider uppercase mb-1">Pending Review</p>
          <p className="text-3xl font-black text-yellow-800 dark:text-yellow-400">{stats.pending}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 border border-green-200/50 dark:border-green-500/20 rounded-2xl p-6 shadow-sm">
          <p className="text-green-700 dark:text-green-500 text-sm font-bold tracking-wider uppercase mb-1">Active</p>
          <p className="text-3xl font-black text-green-800 dark:text-green-400">{stats.approved}</p>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/10 border border-red-200/50 dark:border-red-500/20 rounded-2xl p-6 shadow-sm">
          <p className="text-red-700 dark:text-red-500 text-sm font-bold tracking-wider uppercase mb-1">Rejected</p>
          <p className="text-3xl font-black text-red-800 dark:text-red-400">{stats.rejected}</p>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 bg-white dark:bg-[#111111] p-3 rounded-2xl border border-gray-200/50 dark:border-white/5 shadow-sm">
        <div className="relative flex-1">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search by name, category, or vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-black/50 border-none rounded-xl text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder-gray-400"
          />
        </div>
        <div className="relative min-w-[200px]">
          <FiFilter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 z-10" size={18} />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-11 pr-10 py-3 bg-gray-50 dark:bg-black/50 border-none rounded-xl text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending Review</option>
            <option value="approved">Approved / Active</option>
            <option value="rejected">Rejected / Disabled</option>
          </select>
        </div>
      </div>

      {/* Products Data Grid */}
      <div className="bg-white dark:bg-[#111111] rounded-2xl border border-gray-200/50 dark:border-white/5 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 dark:bg-white/5 border-b border-gray-200/50 dark:border-white/5 text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider">
                <th className="py-4 px-6 font-bold">Product</th>
                <th className="py-4 px-6 font-bold">Category</th>
                <th className="py-4 px-6 font-bold">Price</th>
                <th className="py-4 px-6 font-bold">Stock</th>
                <th className="py-4 px-6 font-bold">Vendor</th>
                <th className="py-4 px-6 font-bold">Status</th>
                <th className="py-4 px-6 text-right font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-white/5">
              {filteredProducts.map(product => (
                <tr key={product.id} className="hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors group">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
                        <img
                          src={product.images?.[0] || 'https://via.placeholder.com/50'}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-white line-clamp-1">{product.name}</p>
                        <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5 uppercase">{product.sku || product.id.substring(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 capitalize border border-gray-200 dark:border-gray-700">
                      {product.category || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-bold text-gray-900 dark:text-white">₦{product.price?.toLocaleString()}</p>
                    {product.original_price && product.original_price > product.price && (
                       <p className="text-xs text-gray-400 line-through">₦{product.original_price.toLocaleString()}</p>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${
                          product.stock_quantity === 0 ? 'bg-red-500' :
                          product.stock_quantity < 10 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`} />
                       <span className={`font-bold ${
                          product.stock_quantity === 0 ? 'text-red-600 dark:text-red-400' :
                          product.stock_quantity < 10 ? 'text-yellow-600 dark:text-yellow-400' :
                          'text-gray-900 dark:text-white'
                       }`}>
                         {product.stock_quantity || 0}
                       </span>
                    </div>
                  </td>
                  <td className="py-4 px-6 font-medium text-gray-600 dark:text-gray-400">
                    {product.vendor?.full_name || 'Admin'}
                  </td>
                  <td className="py-4 px-6">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                      product.status === 'approved' ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20' :
                      product.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' :
                      'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20'
                    }`}>
                      {product.status === 'approved' ? <FiCheckCircle size={12} /> : 
                       product.status === 'rejected' ? <FiXCircle size={12} /> : 
                       <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 animate-pulse" />}
                      {product.status}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-right relative">
                    <button 
                      onClick={() => setActiveDropdown(activeDropdown === product.id ? null : product.id)}
                      className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
                    >
                      <FiMoreVertical size={20} />
                    </button>

                    {/* Action Dropdown */}
                    {activeDropdown === product.id && (
                      <div className="absolute right-8 top-12 w-48 bg-white dark:bg-[#1A1A1A] rounded-xl shadow-xl border border-gray-100 dark:border-white/10 z-20 py-1 overflow-hidden">
                        <button
                          onClick={() => { setSelectedProduct(product); setShowModal(true); setActiveDropdown(null); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                        >
                          <FiEye className="text-gray-400" /> View Details
                        </button>
                        <button
                          onClick={() => { navigate(`/admin/products/edit/${product.id}`); setActiveDropdown(null); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                        >
                          <FiEdit2 className="text-gray-400" /> Edit Product
                        </button>
                        
                        {product.status === 'pending' && (
                          <>
                            <div className="h-px bg-gray-100 dark:bg-white/5 my-1 mx-2" />
                            <button
                              onClick={() => handleApprove(product.id)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/10"
                            >
                              <FiCheckCircle /> Approve Fast
                            </button>
                            <button
                              onClick={() => { setSelectedProduct(product); setShowModal('reject'); setActiveDropdown(null); }}
                              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-500/10"
                            >
                              <FiXCircle /> Reject App
                            </button>
                          </>
                        )}
                        
                        <div className="h-px bg-gray-100 dark:bg-white/5 my-1 mx-2" />
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <FiTrash2 /> Delete Permanently
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredProducts.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                 <FiPackage size={24} className="text-gray-400" />
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white mb-1">No products found</p>
              <p className="text-gray-500 dark:text-gray-400 mb-6">Try adjusting your search or filter to find what you're looking for.</p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="px-6 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-medium transition-colors"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Product Details / Rejection Modal */}
      {showModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           {/* Backdrop */}
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
           
           <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl relative z-10 flex flex-col">
             
             {/* Modal Header */}
             <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50/50 dark:bg-black/20">
               <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {showModal === 'reject' ? 'Reject Product' : 'Product Details'}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5 font-mono uppercase">ID: {selectedProduct.id}</p>
               </div>
               <button onClick={() => setShowModal(false)} className="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 dark:bg-gray-800 rounded-full transition-colors">
                  <FiXCircle size={20} />
               </button>
             </div>

             {/* Modal Body */}
             <div className="flex-1 overflow-y-auto p-6">
                
                {showModal === 'reject' ? (
                  <div className="max-w-xl mx-auto py-8">
                     <h3 className="text-lg font-bold mb-2">Why are you rejecting "{selectedProduct.name}"?</h3>
                     <p className="text-gray-500 text-sm mb-6">Provide a reason so the vendor understands what needs to be fixed before resubmitting.</p>
                     <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="e.g., The product images violate our terms of service..."
                        className="w-full p-4 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-black/50 rounded-xl focus:ring-2 focus:ring-red-500 outline-none min-h-[150px]"
                      />
                      <div className="flex justify-end gap-3 mt-6">
                         <button onClick={() => setShowModal(false)} className="px-5 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">Cancel</button>
                         <button onClick={() => handleReject(selectedProduct.id)} className="px-5 py-2.5 rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/20">Confirm Rejection</button>
                      </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Images Column */}
                    <div>
                      <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden mb-4 border border-gray-200 dark:border-gray-700">
                        <img
                          src={selectedProduct.images?.[0] || 'https://via.placeholder.com/600'}
                          alt={selectedProduct.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      {selectedProduct.images?.length > 1 && (
                        <div className="grid grid-cols-4 gap-3">
                          {selectedProduct.images?.slice(1, 5).map((img, idx) => (
                            <div key={idx} className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
                              <img src={img} alt={`View ${idx}`} className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Info Column */}
                    <div className="space-y-6">
                       <div>
                          <div className="flex gap-2 mb-2">
                            <span className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg capitalize">
                              {selectedProduct.category || 'Categorized'}
                            </span>
                            <span className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-bold rounded-lg uppercase">
                              {selectedProduct.brand || 'No Brand'}
                            </span>
                          </div>
                          <h2 className="text-2xl font-black text-gray-900 dark:text-white leading-tight mb-2">
                             {selectedProduct.name}
                          </h2>
                          <div className="flex items-center gap-3">
                            <p className="text-3xl font-black text-gray-900 dark:text-white">₦{selectedProduct.price?.toLocaleString()}</p>
                            {selectedProduct.original_price && selectedProduct.original_price > selectedProduct.price && (
                               <div className="flex items-center gap-2">
                                  <p className="text-lg text-gray-400 line-through">₦{selectedProduct.original_price.toLocaleString()}</p>
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">
                                    {(100 - (selectedProduct.price / selectedProduct.original_price) * 100).toFixed(0)}% OFF
                                  </span>
                               </div>
                            )}
                          </div>
                       </div>

                       <div className="p-4 bg-gray-50 dark:bg-black/30 rounded-xl border border-gray-100 dark:border-white/5 space-y-3">
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Status</span>
                            <span className="font-bold capitalize">{selectedProduct.status}</span>
                         </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Stock Available</span>
                            <span className="font-bold">{selectedProduct.stock_quantity} units</span>
                         </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-500">Vendor</span>
                            <span className="font-bold">{selectedProduct.vendor?.full_name || 'Admin'}</span>
                         </div>
                         {selectedProduct.metadata?.is_digital && (
                           <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-500">Format</span>
                              <span className="font-bold text-purple-500">Digital Product 📥</span>
                           </div>
                         )}
                       </div>

                       <div>
                          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">Description</h4>
                          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                            {selectedProduct.description}
                          </p>
                       </div>

                       {/* Action Buttons inside Details */}
                       {selectedProduct.status === 'pending' && (
                         <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex gap-3">
                           <button onClick={() => { setShowModal('reject'); }} className="flex-1 py-3 px-4 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:hover:bg-red-500/20 dark:text-red-400 font-bold rounded-xl transition-colors">
                              Reject
                           </button>
                           <button onClick={() => { handleApprove(selectedProduct.id); setShowModal(false); }} className="flex-[2] py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-green-500/20">
                              Approve Product
                           </button>
                         </div>
                       )}
                    </div>
                  </div>
                )}
             </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default AdminProducts;