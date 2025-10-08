// ============================================
// AI RECOMMENDATIONS - src/components/AIRecommendations.jsx
// ============================================
import React, { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, Heart, ShoppingBag } from 'lucide-react';
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";

const AIRecommendations = ({ currentProduct = null }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();
  const { cartItems, addToCart } = useCart();

  useEffect(() => {
    loadRecommendations();
  }, [currentProduct, currentUser]);

  const loadRecommendations = async () => {
    setLoading(true);
    
    // Simulate AI processing delay
    setTimeout(() => {
      const recs = getAIRecommendations();
      setRecommendations(recs);
      setLoading(false);
    }, 1000);
  };

  // AI-powered recommendation logic
  const getAIRecommendations = () => {
    // Sample products - replace with your actual products from Firebase
    const allProducts = [
      {
        id: 1,
        name: 'iPhone 17 Pro Max',
        price: 100000,
        image: 'https://via.placeholder.com/300x300/4F46E5/ffffff?text=iPhone+17',
        category: 'Electronics',
        rating: 4.9,
        tags: ['phone', 'apple', 'premium']
      },
      {
        id: 2,
        name: 'MacBook Pro M4',
        price: 450000,
        image: 'https://via.placeholder.com/300x300/059669/ffffff?text=MacBook+Pro',
        category: 'Electronics',
        rating: 5.0,
        tags: ['laptop', 'apple', 'premium']
      },
      {
        id: 3,
        name: 'Nike Air Jordan 1',
        price: 35000,
        image: 'https://via.placeholder.com/300x300/DC2626/ffffff?text=Air+Jordan',
        category: 'Fashion',
        rating: 4.8,
        tags: ['shoes', 'nike', 'sports']
      },
      {
        id: 4,
        name: 'Sony WH-1000XM6',
        price: 85000,
        image: 'https://via.placeholder.com/300x300/7C3AED/ffffff?text=Sony+Headphones',
        category: 'Electronics',
        rating: 4.9,
        tags: ['headphones', 'sony', 'audio']
      },
      {
        id: 5,
        name: 'Samsung Galaxy S25 Ultra',
        price: 95000,
        image: 'https://via.placeholder.com/300x300/F59E0B/ffffff?text=Galaxy+S25',
        category: 'Electronics',
        rating: 4.8,
        tags: ['phone', 'samsung', 'android']
      },
      {
        id: 6,
        name: 'iPad Pro 2024',
        price: 180000,
        image: 'https://via.placeholder.com/300x300/3B82F6/ffffff?text=iPad+Pro',
        category: 'Electronics',
        rating: 4.9,
        tags: ['tablet', 'apple', 'premium']
      }
    ];

    let filteredProducts = [...allProducts];

    // AI Logic 1: If viewing a specific product, recommend similar items
    if (currentProduct) {
      filteredProducts = allProducts.filter(p => 
        p.id !== currentProduct.id && 
        (p.category === currentProduct.category || 
         p.tags.some(tag => currentProduct.tags?.includes(tag)))
      );
    }

    // AI Logic 2: Personalized based on cart items
    if (cartItems && cartItems.length > 0) {
      const cartCategories = [...new Set(cartItems.map(item => item.category))];
      const cartTags = [...new Set(cartItems.flatMap(item => item.tags || []))];
      
      filteredProducts = filteredProducts.map(product => ({
        ...product,
        score: calculateRelevanceScore(product, cartCategories, cartTags)
      })).sort((a, b) => b.score - a.score);
    }

    // AI Logic 3: Trending and high-rated items
    filteredProducts = filteredProducts.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return Math.random() - 0.5; // Add some randomness
    });

    // Return top 6 recommendations
    return filteredProducts.slice(0, 6);
  };

  // Calculate relevance score for personalization
  const calculateRelevanceScore = (product, cartCategories, cartTags) => {
    let score = 0;
    
    // Category match
    if (cartCategories.includes(product.category)) score += 3;
    
    // Tag matches
    const tagMatches = product.tags?.filter(tag => cartTags.includes(tag)).length || 0;
    score += tagMatches * 2;
    
    // Rating boost
    score += product.rating;
    
    return score;
  };

  const handleAddToCart = (product) => {
    addToCart(product);
  };

  if (loading) {
    return (
      <div className="py-8">
        <div className="flex items-center gap-2 mb-6">
          <Sparkles className="w-6 h-6 text-purple-600 animate-pulse" />
          <h2 className="text-2xl font-bold">AI is analyzing your preferences...</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-gray-200 animate-pulse rounded-lg h-80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-purple-600" />
          <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
            AI Recommended For You
          </h2>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <TrendingUp className="w-4 h-4" />
          <span>Personalized picks</span>
        </div>
      </div>

      {/* Recommendation reason */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-gray-700">
          {currentProduct ? (
            <>🎯 Based on your interest in <strong>{currentProduct.name}</strong></>
          ) : cartItems?.length > 0 ? (
            <>🛍️ Picked based on items in your cart</>
          ) : currentUser ? (
            <>👤 Personalized for you, <strong>{currentUser.displayName}</strong></>
          ) : (
            <>🔥 Trending products loved by our customers</>
          )}
        </p>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {recommendations.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 group"
          >
            {/* AI Badge */}
            <div className="relative">
              <div className="absolute top-2 left-2 bg-purple-600 text-white px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1 z-10">
                <Sparkles className="w-3 h-3" />
                AI Pick
              </div>
              
              {/* Image */}
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-300"
              />

              {/* Quick Actions */}
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button className="p-2 bg-white rounded-full shadow-md hover:bg-red-50 transition">
                  <Heart className="w-5 h-5 text-gray-700 hover:text-red-500" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-purple-600 font-semibold uppercase">
                  {product.category}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">★</span>
                  <span className="text-sm font-semibold">{product.rating}</span>
                </div>
              </div>

              <h3 className="font-semibold text-gray-800 mb-2 line-clamp-2 group-hover:text-purple-600 transition">
                {product.name}
              </h3>

              <div className="flex items-center justify-between mt-4">
                <div>
                  <span className="text-2xl font-bold text-gray-900">
                    ₦{product.price.toLocaleString()}
                  </span>
                </div>

                <button
                  onClick={() => handleAddToCart(product)}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2 text-sm"
                >
                  <ShoppingBag className="w-4 h-4" />
                  Add
                </button>
              </div>

              {/* Why recommended */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  {getRecommendationReason(product, currentProduct, cartItems)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      <div className="text-center mt-8">
        <button
          onClick={loadRecommendations}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition"
        >
          Show More AI Recommendations
        </button>
      </div>
    </div>
  );
};

// Helper function to generate recommendation reason
const getRecommendationReason = (product, currentProduct, cartItems) => {
  if (currentProduct && product.category === currentProduct.category) {
    return `Similar to ${currentProduct.name}`;
  }
  
  if (cartItems?.some(item => item.category === product.category)) {
    return 'Based on your cart';
  }

  if (product.rating >= 4.8) {
    return 'Highly rated by customers';
  }

  return 'Popular choice';
};

export default AIRecommendations;