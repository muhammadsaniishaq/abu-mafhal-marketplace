import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import Loader from '../common/Loader';

const Reviews = () => {
  const { currentUser } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);

  useEffect(() => {
    fetchReviews();
  }, [currentUser]);

  const fetchReviews = async () => {
    try {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('vendor_id', currentUser.id || currentUser.uid);

      if (productsError) throw productsError;
      
      const productIds = (productsData || []).map(p => p.id);

      if (productIds.length > 0) {
        const { data: reviewsData, error: reviewsError } = await supabase
          .from('reviews')
          .select('*')
          .in('product_id', productIds);

        if (reviewsError) throw reviewsError;
        
        const allReviews = reviewsData || [];
        setReviews(allReviews);

        if (allReviews.length > 0) {
          const avg = allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length;
          setAverageRating(avg.toFixed(1));
        }
      } else {
        setReviews([]);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Customer Reviews
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="text-center">
          <p className="text-5xl font-bold text-yellow-400 mb-2">
            {averageRating || 'N/A'}
          </p>
          <div className="flex justify-center mb-2">
            {[...Array(5)].map((_, i) => (
              <span
                key={i}
                className={`text-2xl ${
                  i < Math.round(averageRating) ? 'text-yellow-400' : 'text-gray-300'
                }`}
              >
                ★
              </span>
            ))}
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Based on {reviews.length} reviews
          </p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No reviews yet
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <div
              key={review.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <span
                      key={i}
                      className={`text-xl ${
                        i < review.rating ? 'text-yellow-400' : 'text-gray-300'
                      }`}
                    >
                      ★
                    </span>
                  ))}
                </div>
                <span className="text-sm text-gray-500">
                  {new Date(review.created_at || review.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-semibold mb-2">{review.product_name || review.productName}</h3>
              <p className="text-gray-600 dark:text-gray-400">{review.comment}</p>
              <p className="text-sm text-gray-500 mt-2">By: {review.user_name || review.buyerName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reviews;