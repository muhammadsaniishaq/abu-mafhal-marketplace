import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

const FlashSales = () => {
  const [flashSales, setFlashSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSale, setEditingSale] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discountPercentage: 0,
    startDate: '',
    endDate: '',
    productIds: [],
    maxQuantityPerUser: 1,
    totalStock: 0,
    active: true
  });

  useEffect(() => {
    fetchFlashSales();
    fetchProducts();
  }, []);

  const fetchFlashSales = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'flashSales'));
      const sales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFlashSales(sales);
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
        soldCount: 0,
        createdAt: new Date().toISOString()
      };

      if (editingSale) {
        await updateDoc(doc(db, 'flashSales', editingSale.id), {
          ...formData,
          updatedAt: new Date().toISOString()
        });
        alert('Flash sale updated successfully!');
      } else {
        await addDoc(collection(db, 'flashSales'), saleData);
        alert('Flash sale created successfully!');
      }
      
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
    setEditingSale(sale);
    setFormData({
      title: sale.title,
      description: sale.description,
      discountPercentage: sale.discountPercentage,
      startDate: sale.startDate,
      endDate: sale.endDate,
      productIds: sale.productIds,
      maxQuantityPerUser: sale.maxQuantityPerUser,
      totalStock: sale.totalStock,
      active: sale.active
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this flash sale?')) {
      try {
        await deleteDoc(doc(db, 'flashSales', id));
        alert('Flash sale deleted successfully!');
        fetchFlashSales();
      } catch (error) {
        console.error('Error deleting flash sale:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      discountPercentage: 0,
      startDate: '',
      endDate: '',
      productIds: [],
      maxQuantityPerUser: 1,
      totalStock: 0,
      active: true
    });
    setEditingSale(null);
    setShowModal(false);
  };

  const getTimeRemaining = (endDate) => {
    const total = Date.parse(endDate) - Date.now();
    const seconds = Math.floor((total / 1000) % 60);
    const minutes = Math.floor((total / 1000 / 60) % 60);
    const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
    const days = Math.floor(total / (1000 * 60 * 60 * 24));
    
    return { total, days, hours, minutes, seconds };
  };

  const handleProductToggle = (productId) => {
    setFormData(prev => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter(id => id !== productId)
        : [...prev.productIds, productId]
    }));
  };

  if (loading && flashSales.length === 0) {
    return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Flash Sales</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
        >
          Create Flash Sale
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {flashSales.map(sale => {
          const timeRemaining = getTimeRemaining(sale.endDate);
          const isActive = timeRemaining.total > 0 && sale.active;

          return (
            <div key={sale.id} className="bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-lg shadow-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-2xl font-bold mb-1">{sale.title}</h3>
                  <p className="text-sm opacity-90">{sale.description}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleEdit(sale)} className="text-white hover:bg-white/20 p-2 rounded">✏️</button>
                  <button onClick={() => handleDelete(sale.id)} className="text-white hover:bg-white/20 p-2 rounded">🗑️</button>
                </div>
              </div>

              <div className="bg-white/20 rounded-lg p-4 mb-4">
                <p className="text-3xl font-bold text-center">{sale.discountPercentage}% OFF</p>
              </div>

              {isActive ? (
                <div>
                  <p className="text-sm mb-2">Ends in:</p>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-white/20 rounded p-2">
                      <p className="text-2xl font-bold">{timeRemaining.days}</p>
                      <p className="text-xs">Days</p>
                    </div>
                    <div className="bg-white/20 rounded p-2">
                      <p className="text-2xl font-bold">{timeRemaining.hours}</p>
                      <p className="text-xs">Hours</p>
                    </div>
                    <div className="bg-white/20 rounded p-2">
                      <p className="text-2xl font-bold">{timeRemaining.minutes}</p>
                      <p className="text-xs">Min</p>
                    </div>
                    <div className="bg-white/20 rounded p-2">
                      <p className="text-2xl font-bold">{timeRemaining.seconds}</p>
                      <p className="text-xs">Sec</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white/20 rounded-lg p-4 text-center">
                  <p className="font-semibold">
                    {timeRemaining.total <= 0 ? 'Ended' : 'Not Started'}
                  </p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-white/20 space-y-2 text-sm">
                <p>Products: {sale.productIds?.length || 0}</p>
                <p>Sold: {sale.soldCount || 0} / {sale.totalStock}</p>
                <p>Max per user: {sale.maxQuantityPerUser}</p>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{editingSale ? 'Edit Flash Sale' : 'Create Flash Sale'}</h2>
              <button onClick={resetForm} className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full">×</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    placeholder="Black Friday Sale"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    rows="2"
                    placeholder="Limited time offer"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Discount Percentage</label>
                  <input
                    type="number"
                    value={formData.discountPercentage}
                    onChange={(e) => setFormData({...formData, discountPercentage: parseInt(e.target.value)})}
                    required
                    min="1"
                    max="99"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Total Stock</label>
                  <input
                    type="number"
                    value={formData.totalStock}
                    onChange={(e) => setFormData({...formData, totalStock: parseInt(e.target.value)})}
                    required
                    min="1"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Start Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">End Date & Time</label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Max Quantity Per User</label>
                  <input
                    type="number"
                    value={formData.maxQuantityPerUser}
                    onChange={(e) => setFormData({...formData, maxQuantityPerUser: parseInt(e.target.value)})}
                    required
                    min="1"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Select Products</label>
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                  {products.map(product => (
                    <label key={product.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.productIds.includes(product.id)}
                        onChange={() => handleProductToggle(product.id)}
                        className="w-5 h-5"
                      />
                      <img src={product.images?.[0]} alt={product.name} className="w-12 h-12 object-cover rounded" />
                      <div className="flex-1">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-sm text-gray-600">₦{product.price?.toLocaleString()}</p>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-sm text-gray-600 mt-2">{formData.productIds.length} products selected</p>
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
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400"
              >
                {loading ? 'Saving...' : (editingSale ? 'Update Flash Sale' : 'Create Flash Sale')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlashSales;