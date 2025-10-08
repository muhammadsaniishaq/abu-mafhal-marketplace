import React, { useState, useEffect } from 'react';
import { getPersonalizedRecommendations } from '../../services/aiService';
import { useAuth } from '../../context/AuthContext';
import Loader from '../common/Loader';

const Recommendations = () => {
  const { currentUser } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecommendations();
  }, [currentUser]);

  const fetchRecommendations = async () => {
    try {
      const recs = await getPersonalizedRecommendations(currentUser.uid);
      setRecommendations(recs);
    } catch (error) {
      console.error('Error fetching recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Recommended For You
      </h1>

      {recommendations.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No recommendations available yet
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recommendations.map((product) => (
            <div
              key={product.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
            >
              <img
                src={product.images?.[0] || '/placeholder.png'}
                alt={product.name}
                className="w-full h-48 object-cover"
              />
              <div className="p-4">
                <h3 className="font-semibold text-lg">{product.name}</h3>
                <p className="text-blue-600 font-bold mt-2">
                  ₦{product.price?.toLocaleString()}
                </p>
                <button className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Recommendations;