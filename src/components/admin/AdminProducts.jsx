import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useNavigate } from 'react-router-dom';

const AdminProducts = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'products'));
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (productId, vendorId, productName) => {
    if (!window.confirm('Approve this product?')) return;

    try {
      await updateDoc(doc(db, 'products', productId), {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: 'admin'
      });

      // Optional: Send notification to vendor
      // await sendProductNotification(productId, vendorId, 'approved', productName);
      
      alert('Product approved successfully!');
      fetchProducts();
    } catch (error) {
      console.error('Error approving product:', error);
      alert('Failed to approve product');
    }
  };

  const handleReject = async (productId, vendorId, productName) => {
    if (!rejectionReason.trim()) {
      alert('Please provide a rejection reason');
      return;
    }

    try {
      await updateDoc(doc(db, 'products', productId), {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectionReason,
        rejectedBy: 'admin'
      });

      // Optional: Send notification to vendor
      // await sendProductNotification(productId, vendorId, 'rejected', productName);

      alert('Product rejected');
      setShowModal(false);
      setRejectionReason('');
      fetchProducts();
    } catch (error) {
      alert('Failed to reject product');
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Permanently delete this product? This cannot be undone!')) return;

    try {
      await deleteDoc(doc(db, 'products', productId));
      alert('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      alert('Failed to delete product');
    }
  };

  const handleEditProduct = (productId) => {
    navigate(`/admin/products/edit/${productId}`);
  };

  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.vendorName?.toLowerCase().includes(searchTerm.toLowerCase());
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
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Product Management</h1>
        <button
          onClick={() => navigate('/admin/products/add')}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <span className="text-xl">+</span>
          <span>Add New Product</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <p className="text-gray-600 dark:text-gray-400 text-sm">Total Products</p>
          <p className="text-3xl font-bold">{stats.all}</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6 shadow">
          <p className="text-yellow-700 dark:text-yellow-400 text-sm">Pending Review</p>
          <p className="text-3xl font-bold text-yellow-800 dark:text-yellow-300">{stats.pending}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 shadow">
          <p className="text-green-700 dark:text-green-400 text-sm">Approved</p>
          <p className="text-3xl font-bold text-green-800 dark:text-green-300">{stats.approved}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 shadow">
          <p className="text-red-700 dark:text-red-400 text-sm">Rejected</p>
          <p className="text-3xl font-bold text-red-800 dark:text-red-300">{stats.rejected}</p>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <input
          type="text"
          placeholder="Search products by name, category, or vendor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-700"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left py-3 px-4">Product</th>
              <th className="text-left py-3 px-4">Category</th>
              <th className="text-left py-3 px-4">Price</th>
              <th className="text-left py-3 px-4">Stock</th>
              <th className="text-left py-3 px-4">Vendor</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map(product => (
              <tr key={product.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={product.images?.[0] || 'https://via.placeholder.com/50'}
                      alt={product.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div>
                      <p className="font-medium line-clamp-1">{product.name}</p>
                      <p className="text-xs text-gray-500">ID: {product.id.substring(0, 8)}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4 capitalize">{product.category}</td>
                <td className="py-3 px-4 font-bold">₦{product.price?.toLocaleString()}</td>
                <td className="py-3 px-4">
                  <span className={`${
                    product.stock === 0 ? 'text-red-600' :
                    product.stock < 10 ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {product.stock}
                  </span>
                </td>
                <td className="py-3 px-4">{product.vendorName || 'Admin'}</td>
                <td className="py-3 px-4">
                  <span className={`px-3 py-1 rounded-full text-xs ${
                    product.status === 'approved' ? 'bg-green-100 text-green-800' :
                    product.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {product.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setSelectedProduct(product);
                        setShowModal(true);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditProduct(product.id)}
                      className="px-3 py-1 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
                    >
                      Edit
                    </button>
                    {product.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(product.id, product.vendorId, product.name)}
                          className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProduct(product);
                            setShowModal(true);
                          }}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(product.id)}
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

        {filteredProducts.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-600 dark:text-gray-400">No products found</p>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Clear Search
              </button>
            )}
          </div>
        )}
      </div>

      {/* Product Details Modal */}
      {showModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Product Details</h2>
              <button onClick={() => setShowModal(false)} className="text-2xl">×</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Images */}
              <div>
                <img
                  src={selectedProduct.images?.[0] || 'https://via.placeholder.com/400'}
                  alt={selectedProduct.name}
                  className="w-full h-64 object-cover rounded-lg mb-3"
                />
                <div className="grid grid-cols-4 gap-2">
                  {selectedProduct.images?.slice(1, 5).map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`Product ${idx + 2}`}
                      className="w-full h-16 object-cover rounded"
                    />
                  ))}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Product Name</p>
                  <p className="font-bold text-xl">{selectedProduct.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Category</p>
                  <p className="font-medium capitalize">{selectedProduct.category}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Price</p>
                  <p className="font-bold text-2xl text-blue-600">₦{selectedProduct.price?.toLocaleString()}</p>
                  {selectedProduct.originalPrice && selectedProduct.originalPrice > selectedProduct.price && (
                    <p className="text-sm text-gray-500 line-through">₦{selectedProduct.originalPrice?.toLocaleString()}</p>
                  )}
                </div>
                <div>
                  <p className="text-sm text-gray-600">Stock</p>
                  <p className="font-medium">{selectedProduct.stock} units</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Vendor</p>
                  <p className="font-medium">{selectedProduct.vendorName || 'Admin'}</p>
                </div>
                {selectedProduct.description && (
                  <div>
                    <p className="text-sm text-gray-600">Description</p>
                    <p className="text-sm">{selectedProduct.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs ${
                    selectedProduct.status === 'approved' ? 'bg-green-100 text-green-800' :
                    selectedProduct.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {selectedProduct.status}
                  </span>
                </div>
                {selectedProduct.rating && (
                  <div>
                    <p className="text-sm text-gray-600">Rating</p>
                    <p className="font-medium">{selectedProduct.rating} ⭐ ({selectedProduct.reviews || 0} reviews)</p>
                  </div>
                )}

                {selectedProduct.status === 'pending' && (
                  <div className="pt-4 border-t space-y-3">
                    <button
                      onClick={() => {
                        handleApprove(selectedProduct.id, selectedProduct.vendorId, selectedProduct.name);
                        setShowModal(false);
                      }}
                      className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Approve Product
                    </button>
                    <div>
                      <textarea
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        placeholder="Reason for rejection..."
                        className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                        rows="3"
                      />
                      <button
                        onClick={() => handleReject(selectedProduct.id, selectedProduct.vendorId, selectedProduct.name)}
                        className="w-full mt-2 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Reject Product
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;