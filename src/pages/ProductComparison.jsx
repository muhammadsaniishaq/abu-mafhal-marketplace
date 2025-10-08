import React, { useState, useEffect } from 'react';
import { useComparison } from '../context/ComparisonContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { Link, useNavigate } from 'react-router-dom';

const ProductComparison = () => {
  const { comparisonItems, removeFromComparison, clearComparison } = useComparison();
  const { addToCart } = useCart();
  const { addToWishlist } = useWishlist();
  const navigate = useNavigate();

  if (comparisonItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-10">
            <p className="text-6xl mb-4">📊</p>
            <h2 className="text-2xl font-bold mb-4">No Products to Compare</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Add products from the shop to compare their features
            </p>
            <Link
              to="/shop"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg"
            >
              Browse Products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const allFeatures = new Set();
  comparisonItems.forEach(product => {
    if (product.specifications) {
      Object.keys(product.specifications).forEach(key => allFeatures.add(key));
    }
  });

  const handleAddToCart = (product) => {
    addToCart(product);
    alert('Added to cart!');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Product Comparison</h1>
          <button
            onClick={clearComparison}
            className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50"
          >
            Clear All
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b dark:border-gray-700">
                <th className="p-4 text-left bg-gray-50 dark:bg-gray-900 sticky left-0 z-10 min-w-[200px]">
                  Feature
                </th>
                {comparisonItems.map(product => (
                  <th key={product.id} className="p-4 min-w-[250px]">
                    <div className="text-center">
                      <button
                        onClick={() => removeFromComparison(product.id)}
                        className="absolute top-2 right-2 text-red-600 hover:text-red-700"
                      >
                        ✕
                      </button>
                      <img
                        src={product.images?.[0] || 'https://via.placeholder.com/200'}
                        alt={product.name}
                        className="w-32 h-32 object-cover mx-auto rounded-lg mb-3"
                      />
                      <Link
                        to={`/product/${product.id}`}
                        className="font-semibold hover:text-blue-600 block mb-2"
                      >
                        {product.name}
                      </Link>
                      <p className="text-2xl font-bold text-blue-600 mb-3">
                        ₦{product.price.toLocaleString()}
                      </p>
                      <div className="space-y-2">
                        <button
                          onClick={() => handleAddToCart(product)}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg text-sm"
                        >
                          Add to Cart
                        </button>
                        <button
                          onClick={() => addToWishlist(product)}
                          className="w-full border border-gray-300 hover:bg-gray-50 py-2 px-4 rounded-lg text-sm"
                        >
                          Add to Wishlist
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Price Row */}
              <tr className="border-b dark:border-gray-700 bg-blue-50 dark:bg-blue-900/10">
                <td className="p-4 font-semibold bg-gray-50 dark:bg-gray-900 sticky left-0 z-10">
                  Price
                </td>
                {comparisonItems.map(product => (
                  <td key={product.id} className="p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      ₦{product.price.toLocaleString()}
                    </p>
                    {product.originalPrice && product.originalPrice > product.price && (
                      <p className="text-sm text-gray-500 line-through">
                        ₦{product.originalPrice.toLocaleString()}
                      </p>
                    )}
                  </td>
                ))}
              </tr>

              {/* Category */}
              <tr className="border-b dark:border-gray-700">
                <td className="p-4 font-semibold bg-gray-50 dark:bg-gray-900 sticky left-0 z-10">
                  Category
                </td>
                {comparisonItems.map(product => (
                  <td key={product.id} className="p-4 text-center">
                    {product.category}
                  </td>
                ))}
              </tr>

              {/* Rating */}
              <tr className="border-b dark:border-gray-700">
                <td className="p-4 font-semibold bg-gray-50 dark:bg-gray-900 sticky left-0 z-10">
                  Rating
                </td>
                {comparisonItems.map(product => (
                  <td key={product.id} className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span className="text-yellow-500">⭐</span>
                      <span className="font-semibold">
                        {product.averageRating?.toFixed(1) || 'N/A'}
                      </span>
                      <span className="text-gray-500 text-sm">
                        ({product.totalReviews || 0})
                      </span>
                    </div>
                  </td>
                ))}
              </tr>

              {/* Stock */}
              <tr className="border-b dark:border-gray-700">
                <td className="p-4 font-semibold bg-gray-50 dark:bg-gray-900 sticky left-0 z-10">
                  Availability
                </td>
                {comparisonItems.map(product => (
                  <td key={product.id} className="p-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-sm ${
                      product.stock > 0 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {product.stock > 0 ? `In Stock (${product.stock})` : 'Out of Stock'}
                    </span>
                  </td>
                ))}
              </tr>

              {/* Description */}
              <tr className="border-b dark:border-gray-700">
                <td className="p-4 font-semibold bg-gray-50 dark:bg-gray-900 sticky left-0 z-10">
                  Description
                </td>
                {comparisonItems.map(product => (
                  <td key={product.id} className="p-4 text-sm">
                    {product.description?.substring(0, 150)}...
                  </td>
                ))}
              </tr>

              {/* Specifications */}
              {Array.from(allFeatures).map(feature => (
                <tr key={feature} className="border-b dark:border-gray-700">
                  <td className="p-4 font-semibold bg-gray-50 dark:bg-gray-900 sticky left-0 z-10 capitalize">
                    {feature}
                  </td>
                  {comparisonItems.map(product => (
                    <td key={product.id} className="p-4 text-center">
                      {product.specifications?.[feature] || '-'}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Vendor */}
              <tr className="border-b dark:border-gray-700">
                <td className="p-4 font-semibold bg-gray-50 dark:bg-gray-900 sticky left-0 z-10">
                  Vendor
                </td>
                {comparisonItems.map(product => (
                  <td key={product.id} className="p-4 text-center">
                    {product.vendorName || 'N/A'}
                  </td>
                ))}
              </tr>

              {/* Shipping */}
              <tr className="border-b dark:border-gray-700">
                <td className="p-4 font-semibold bg-gray-50 dark:bg-gray-900 sticky left-0 z-10">
                  Shipping
                </td>
                {comparisonItems.map(product => (
                  <td key={product.id} className="p-4 text-center">
                    {product.freeShipping ? 'Free Shipping' : 'Standard Shipping'}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-xl font-bold mb-4">Quick Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="font-semibold text-green-800 dark:text-green-300 mb-2">
                💰 Best Price
              </p>
              <p className="text-lg">
                {comparisonItems.reduce((min, p) => p.price < min.price ? p : min).name}
              </p>
              <p className="text-sm text-gray-600">
                ₦{Math.min(...comparisonItems.map(p => p.price)).toLocaleString()}
              </p>
            </div>

            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="font-semibold text-yellow-800 dark:text-yellow-300 mb-2">
                ⭐ Highest Rated
              </p>
              <p className="text-lg">
                {comparisonItems.reduce((max, p) => (p.averageRating || 0) > (max.averageRating || 0) ? p : max).name}
              </p>
              <p className="text-sm text-gray-600">
                {Math.max(...comparisonItems.map(p => p.averageRating || 0)).toFixed(1)} stars
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductComparison;