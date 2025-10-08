import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
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
      const productsQuery = query(
        collection(db, 'products'),
        where('vendorId', '==', currentUser.uid)
      );
      const productsSnapshot = await getDocs(productsQuery);
      const productIds = productsSnapshot.docs.map(doc => doc.id);

      const allReviews = [];
      for (const productId of productIds) {
        const reviewsQuery = query(
          collection(db, 'reviews'),
          where('productId', '==', productId)
        );
        const reviewsSnapshot = await getDocs(reviewsQuery);
        reviewsSnapshot.docs.forEach(doc => {
          allReviews.push({ id: doc.id, ...doc.data() });
        });
      }

      setReviews(allReviews);

      if (allReviews.length > 0) {
        const avg = allReviews.reduce((sum, review) => sum + review.rating, 0) / allReviews.length;
        setAverageRating(avg.toFixed(1));
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
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
                  {review.createdAt?.toDate().toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-semibold mb-2">{review.productName}</h3>
              <p className="text-gray-600 dark:text-gray-400">{review.comment}</p>
              <p className="text-sm text-gray-500 mt-2">By: {review.buyerName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reviews;