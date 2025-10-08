// ============================================
// FIXED ProductCard.jsx
// ============================================
// Replace your current ProductCard.jsx file with this code

import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, ShoppingCart } from 'lucide-react';
import { useWishlist } from '../../context/WishlistContext';
import { useCart } from '../../context/CartContext';

const ProductCard = ({ product }) => {
  const { wishlistItems, addToWishlist, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  // ✅ FIX: Changed from calling isInWishlist(product.id) as a function
  // to checking if the product exists in the wishlistItems array
  const isInWishlist = wishlistItems.some(item => item.id === product.id);

  const handleWishlistToggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isInWishlist) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist(product);
    }
  };

  const handleAddToCart = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
      <Link to={`/product/${product.id}`} className="block relative group">
        <div className="relative h-64 overflow-hidden bg-gray-100">
          <img
            src={product.images?.[0] || product.image || '/placeholder-product.jpg'}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
          
          {product.discount > 0 && (
            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-md text-sm font-semibold">
              -{product.discount}%
            </div>
          )}

          <div className="absolute top-2 right-2 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <button
              onClick={handleWishlistToggle}
              className={`p-2 rounded-full ${
                isInWishlist 
                  ? 'bg-red-500 text-white' 
                  : 'bg-white text-gray-700 hover:bg-red-500 hover:text-white'
              } transition-colors duration-200 shadow-md`}
              aria-label={isInWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart className={`w-5 h-5 ${isInWishlist ? 'fill-current' : ''}`} />
            </button>
            
            <button
              onClick={handleAddToCart}
              className="p-2 bg-white text-gray-700 rounded-full hover:bg-blue-500 hover:text-white transition-colors duration-200 shadow-md"
              aria-label="Add to cart"
            >
              <ShoppingCart className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4">
          {product.category && (
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              {product.category}
            </p>
          )}

          <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2 hover:text-blue-600 transition-colors">
            {product.name}
          </h3>

          {product.rating && (
            <div className="flex items-center mb-2">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <span key={i}>
                    {i < Math.floor(product.rating) ? '★' : '☆'}
                  </span>
                ))}
              </div>
              <span className="text-sm text-gray-600 ml-2">
                ({product.reviewCount || 0})
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-gray-900">
                ${product.discount > 0 
                  ? (product.price * (1 - product.discount / 100)).toFixed(2)
                  : product.price.toFixed(2)
                }
              </span>
              {product.discount > 0 && (
                <span className="text-sm text-gray-500 line-through">
                  ${product.price.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          {product.stock !== undefined && (
            <div className="mt-2">
              {product.stock > 0 ? (
                <span className="text-xs text-green-600">
                  {product.stock} in stock
                </span>
              ) : (
                <span className="text-xs text-red-600">Out of stock</span>
              )}
            </div>
          )}
        </div>
      </Link>
    </div>
  );
};

export default ProductCard;