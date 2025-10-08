import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { Link } from 'react-router-dom';

const BuyerWishlist = () => {
  const { currentUser } = useAuth();
  const { addToCart } = useCart();
  const [wishlistItems, setWishlistItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedForComparison, setSelectedForComparison] = useState([]);
  const [showComparison, setShowComparison] = useState(false);

  useEffect(() => {
    fetchWishlist();
  }, [currentUser]);

  const fetchWishlist = async () => {
    try {
      const q = query(
        collection(db, 'wishlists'),
        where('userId', '==', currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const items = [];
      
      for (const wishDoc of snapshot.docs) {
        const wishData = wishDoc.data();
        const productDoc = await getDoc(doc(db, 'products', wishData.productId));
        
        if (productDoc.exists()) {
          items.push({
            wishlistId: wishDoc.id,
            ...wishData,
            product: { id: productDoc.id, ...productDoc.data() }
          });
        }
      }
      
      setWishlistItems(items);
    } catch (error) {
      console.error('Error fetching wishlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (wishlistId) => {
    try {
      await deleteDoc(doc(db, 'wishlists', wishlistId));
      setWishlistItems(wishlistItems.filter(item => item.wishlistId !== wishlistId));
      setSelectedForComparison(selectedForComparison.filter(id => id !== wishlistId));
    } catch (error) {
      console.error('Error removing from wishlist:', error);
      alert('Failed to remove item');
    }
  };

  const moveToCart = (item) => {
    addToCart(item.product, 1);
    removeFromWishlist(item.wishlistId);
    alert('Item moved to cart!');
  };

  const toggleComparison = (wishlistId) => {
    if (selectedForComparison.includes(wishlistId)) {
      setSelectedForComparison(selectedForComparison.filter(id => id !== wishlistId));
    } else {
      if (selectedForComparison.length >= 4) {
        alert('You can compare up to 4 products at a time');
        return;
      }
      setSelectedForComparison([...selectedForComparison, wishlistId]);
    }
  };

  const getComparisonProducts = () => {
    return wishlistItems
      .filter(item => selectedForComparison.includes(item.wishlistId))
      .map(item => item.product);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Wishlist</h1>
        {selectedForComparison.length > 1 && (
          <button
            onClick={() => setShowComparison(true)}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Compare ({selectedForComparison.length})
          </button>
        )}
      </div>

      {wishlistItems.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg">
          <p className="text-6xl mb-4">❤️</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Your wishlist is empty</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Add items you love to save them for later</p>
          <Link
            to="/shop"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} in your wishlist
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {wishlistItems.map(item => (
              <div key={item.wishlistId} className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden group relative">
                {/* Comparison Checkbox */}
                <div className="absolute top-2 left-2 z-10">
                  <label className="flex items-center gap-2 bg-white dark:bg-gray-700 px-2 py-1 rounded-lg shadow cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedForComparison.includes(item.wishlistId)}
                      onChange={() => toggleComparison(item.wishlistId)}
                      className="w-4 h-4"
                    />
                    <span className="text-xs font-medium">Compare</span>
                  </label>
                </div>

                {/* Remove Button */}
                <button
                  onClick={() => removeFromWishlist(item.wishlistId)}
                  className="absolute top-2 right-2 z-10 bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
                >
                  ×
                </button>

                <Link to={`/product/${item.product.id}`}>
                  <div className="relative overflow-hidden aspect-square">
                    <img
                      src={item.product.images?.[0] || 'https://via.placeholder.com/300'}
                      alt={item.product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    {item.product.discount && (
                      <span className="absolute bottom-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                        -{item.product.discount}%
                      </span>
                    )}
                  </div>
                </Link>

                <div className="p-4">
                  <Link to={`/product/${item.product.id}`}>
                    <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-2 mb-2 hover:text-blue-600 min-h-[3rem]">
                      {item.product.name}
                    </h3>
                  </Link>

                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-orange-600 dark:text-orange-400 font-bold text-xl">
                      ₦{item.product.price?.toLocaleString()}
                    </p>
                    {item.product.originalPrice && item.product.originalPrice > item.product.price && (
                      <p className="text-sm text-gray-500 line-through">
                        ₦{item.product.originalPrice?.toLocaleString()}
                      </p>
                    )}
                  </div>

                  {item.product.stock !== undefined && (
                    <p className={`text-xs mb-3 ${
                      item.product.stock > 10 ? 'text-green-600' : 
                      item.product.stock > 0 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {item.product.stock > 10 ? 'In Stock' : 
                       item.product.stock > 0 ? `Only ${item.product.stock} left` : 'Out of Stock'}
                    </p>
                  )}

                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Added {new Date(item.createdAt).toLocaleDateString()}
                  </p>

                  <button
                    onClick={() => moveToCart(item)}
                    disabled={item.product.stock === 0}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {item.product.stock === 0 ? 'Out of Stock' : 'Move to Cart'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Comparison Modal */}
      {showComparison && (
        <ComparisonModal
          products={getComparisonProducts()}
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
};

// Product Comparison Modal Component
const ComparisonModal = ({ products, onClose }) => {
  const { addToCart } = useCart();

  const features = [
    { key: 'price', label: 'Price' },
    { key: 'originalPrice', label: 'Original Price' },
    { key: 'discount', label: 'Discount' },
    { key: 'stock', label: 'Stock' },
    { key: 'category', label: 'Category' },
    { key: 'brand', label: 'Brand' },
    { key: 'rating', label: 'Rating' },
    { key: 'reviews', label: 'Reviews' },
    { key: 'weight', label: 'Weight' },
    { key: 'dimensions', label: 'Dimensions' }
  ];

  const getFeatureValue = (product, key) => {
    if (key === 'price' || key === 'originalPrice') {
      return product[key] ? `₦${product[key].toLocaleString()}` : 'N/A';
    }
    if (key === 'discount') {
      return product[key] ? `${product[key]}%` : 'None';
    }
    if (key === 'stock') {
      return product[key] !== undefined ? product[key] : 'N/A';
    }
    if (key === 'rating') {
      return product[key] ? `${product[key]} ⭐` : 'No rating';
    }
    return product[key] || 'N/A';
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-auto">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-6 flex justify-between items-center z-10">
          <h2 className="text-2xl font-bold">Compare Products</h2>
          <button 
            onClick={onClose}
            className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full"
          >
            ×
          </button>
        </div>

        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-4 border-b sticky left-0 bg-white dark:bg-gray-800 min-w-[150px]">
                    Feature
                  </th>
                  {products.map(product => (
                    <th key={product.id} className="p-4 border-b min-w-[200px]">
                      <div>
                        <img
                          src={product.images?.[0] || 'https://via.placeholder.com/150'}
                          alt={product.name}
                          className="w-32 h-32 object-cover rounded-lg mx-auto mb-2"
                        />
                        <p className="font-semibold text-sm line-clamp-2">{product.name}</p>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map(feature => (
                  <tr key={feature.key} className="border-b">
                    <td className="p-4 font-medium sticky left-0 bg-white dark:bg-gray-800">
                      {feature.label}
                    </td>
                    {products.map(product => (
                      <td key={product.id} className="p-4 text-center">
                        {getFeatureValue(product, feature.key)}
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Description Row */}
                <tr className="border-b">
                  <td className="p-4 font-medium sticky left-0 bg-white dark:bg-gray-800">
                    Description
                  </td>
                  {products.map(product => (
                    <td key={product.id} className="p-4 text-sm">
                      <p className="line-clamp-3">{product.description || 'No description'}</p>
                    </td>
                  ))}
                </tr>

                {/* Action Row */}
                <tr>
                  <td className="p-4 font-medium sticky left-0 bg-white dark:bg-gray-800">
                    Actions
                  </td>
                  {products.map(product => (
                    <td key={product.id} className="p-4">
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            addToCart(product, 1);
                            alert('Added to cart!');
                          }}
                          disabled={product.stock === 0}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm disabled:bg-gray-400"
                        >
                          Add to Cart
                        </button>
                        <Link
                          to={`/product/${product.id}`}
                          className="block w-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-center py-2 rounded-lg text-sm"
                        >
                          View Details
                        </Link>
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuyerWishlist;