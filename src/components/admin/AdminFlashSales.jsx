import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

const AdminFlashSales = () => {
  const [flashSales, setFlashSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discountPercentage: '',
    startDate: '',
    endDate: '',
    productIds: [],
    totalStock: 0,
    soldCount: 0,
    active: true
  });
  const [editingId, setEditingId] = useState(null);

  useEffect(() => {
    fetchFlashSales();
    fetchProducts();
  }, []);

  const fetchFlashSales = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'flashSales'));
      const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      salesData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setFlashSales(salesData);
    } catch (error) {
      console.error('Error fetching flash sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const q = query(collection(db, 'products'), where('status', '==', 'approved'));
      const snapshot = await getDocs(q);
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const saleData = {
        ...formData,
        discountPercentage: parseFloat(formData.discountPercentage),
        totalStock: parseInt(formData.totalStock),
        soldCount: editingId ? formData.soldCount : 0,
        createdAt: editingId ? formData.createdAt : new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await updateDoc(doc(db, 'flashSales', editingId), saleData);
        alert('Flash sale updated successfully!');
      } else {
        await addDoc(collection(db, 'flashSales'), saleData);
        alert('Flash sale created successfully!');
      }

      setShowCreateModal(false);
      resetForm();
      fetchFlashSales();
    } catch (error) {
      console.error('Error saving flash sale:', error);
      alert('Failed to save flash sale');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (sale) => {
    setFormData(sale);
    setEditingId(sale.id);
    setShowCreateModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this flash sale?')) return;

    try {
      await deleteDoc(doc(db, 'flashSales', id));
      alert('Flash sale deleted successfully!');
      fetchFlashSales();
    } catch (error) {
      console.error('Error deleting flash sale:', error);
      alert('Failed to delete flash sale');
    }
  };

  const toggleActive = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'flashSales', id), {
        active: !currentStatus,
        updatedAt: new Date().toISOString()
      });
      fetchFlashSales();
    } catch (error) {
      console.error('Error toggling flash sale status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      discountPercentage: '',
      startDate: '',
      endDate: '',
      productIds: [],
      totalStock: 0,
      soldCount: 0,
      active: true
    });
    setEditingId(null);
  };

  const handleProductSelect = (productId) => {
    const updatedProducts = formData.productIds.includes(productId)
      ? formData.productIds.filter(id => id !== productId)
      : [...formData.productIds, productId];
    
    setFormData({ ...formData, productIds: updatedProducts });
  };

  const getStatusBadge = (sale) => {
    const now = new Date();
    const start = new Date(sale.startDate);
    const end = new Date(sale.endDate);

    if (!sale.active) {
      return <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">Inactive</span>;
    }
    if (now < start) {
      return <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Upcoming</span>;
    }
    if (now > end) {
      return <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">Expired</span>;
    }
    return <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">Active</span>;
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Flash Sales Management</h1>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
        >
          Create Flash Sale
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total Flash Sales</p>
          <p className="text-2xl font-bold">{flashSales.length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-green-700 dark:text-green-400">Active Now</p>
          <p className="text-2xl font-bold text-green-800 dark:text-green-300">
            {flashSales.filter(s => {
              const now = new Date();
              return s.active && new Date(s.startDate) <= now && new Date(s.endDate) >= now;
            }).length}
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-blue-700 dark:text-blue-400">Upcoming</p>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
            {flashSales.filter(s => s.active && new Date(s.startDate) > new Date()).length}
          </p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-orange-700 dark:text-orange-400">Total Items Sold</p>
          <p className="text-2xl font-bold text-orange-800 dark:text-orange-300">
            {flashSales.reduce((sum, s) => sum + (s.soldCount || 0), 0)}
          </p>
        </div>
      </div>

      {/* Flash Sales Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left py-3 px-4">Title</th>
              <th className="text-left py-3 px-4">Discount</th>
              <th className="text-left py-3 px-4">Duration</th>
              <th className="text-left py-3 px-4">Stock</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {flashSales.map(sale => (
              <tr key={sale.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="py-3 px-4">
                  <p className="font-medium">{sale.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{sale.description}</p>
                </td>
                <td className="py-3 px-4">
                  <span className="text-lg font-bold text-red-600">{sale.discountPercentage}% OFF</span>
                </td>
                <td className="py-3 px-4 text-sm">
                  <p>{new Date(sale.startDate).toLocaleDateString()}</p>
                  <p className="text-gray-500">to</p>
                  <p>{new Date(sale.endDate).toLocaleDateString()}</p>
                </td>
                <td className="py-3 px-4">
                  <p className="font-medium">{sale.soldCount || 0} / {sale.totalStock}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${((sale.soldCount || 0) / sale.totalStock) * 100}%` }}
                    ></div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  {getStatusBadge(sale)}
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(sale)}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(sale.id, sale.active)}
                      className={`px-3 py-1 rounded text-sm ${
                        sale.active 
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                          : 'bg-green-600 hover:bg-green-700 text-white'
                      }`}
                    >
                      {sale.active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(sale.id)}
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

        {flashSales.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-600 dark:text-gray-400">No flash sales created yet</p>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">
                {editingId ? 'Edit Flash Sale' : 'Create Flash Sale'}
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
                <label className="block text-sm font-medium mb-2">Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  required
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  placeholder="e.g., Weekend Flash Sale"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  required
                  rows="3"
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  placeholder="Describe your flash sale..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Discount Percentage *</label>
                  <input
                    type="number"
                    value={formData.discountPercentage}
                    onChange={(e) => setFormData({...formData, discountPercentage: e.target.value})}
                    required
                    min="1"
                    max="99"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="e.g., 50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Total Stock *</label>
                  <input
                    type="number"
                    value={formData.totalStock}
                    onChange={(e) => setFormData({...formData, totalStock: e.target.value})}
                    required
                    min="1"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="e.g., 100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Start Date *</label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">End Date *</label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Select Products (Optional)</label>
                <div className="max-h-40 overflow-y-auto border rounded-lg p-3 space-y-2">
                  {products.map(product => (
                    <label key={product.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.productIds.includes(product.id)}
                        onChange={() => handleProductSelect(product.id)}
                      />
                      <span className="text-sm">{product.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400"
              >
                {loading ? 'Saving...' : editingId ? 'Update Flash Sale' : 'Create Flash Sale'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminFlashSales;