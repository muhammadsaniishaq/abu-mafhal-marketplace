import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { addReview, markReviewHelpful, reportReview, uploadReviewImages, addVendorResponse } from '../../services/reviewService';
import { Link } from 'react-router-dom';

const ProductReviews = ({ productId, vendorId }) => {
  const { currentUser } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [formData, setFormData] = useState({
    rating: 5,
    title: '',
    comment: '',
    images: []
  });
  const [imageFiles, setImageFiles] = useState([]);
  const [filterRating, setFilterRating] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [respondingTo, setRespondingTo] = useState(null);
  const [vendorResponseText, setVendorResponseText] = useState('');

  useEffect(() => {
    fetchReviews();
    if (currentUser) {
      checkIfCanReview();
    }
  }, [productId, currentUser]);

  const fetchReviews = async () => {
    try {
      const q = query(
        collection(db, 'reviews'),
        where('productId', '==', productId),
        where('status', '==', 'approved')
      );
      const snapshot = await getDocs(q);
      const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReviews(reviewsData);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkIfCanReview = async () => {
    try {
      const ordersQuery = query(
        collection(db, 'orders'),
        where('userId', '==', currentUser.uid),
        where('status', 'in', ['delivered', 'completed'])
      );
      const ordersSnapshot = await getDocs(ordersQuery);
      
      const hasPurchased = ordersSnapshot.docs.some(doc => {
        const order = doc.data();
        return order.items.some(item => item.productId === productId);
      });

      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('productId', '==', productId),
        where('userId', '==', currentUser.uid)
      );
      const reviewsSnapshot = await getDocs(reviewsQuery);
      
      setCanReview(hasPurchased && reviewsSnapshot.empty);
    } catch (error) {
      console.error('Error checking review eligibility:', error);
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length + imageFiles.length > 5) {
      alert('Maximum 5 images allowed');
      return;
    }
    setImageFiles([...imageFiles, ...files]);
  };

  const removeImage = (index) => {
    setImageFiles(imageFiles.filter((_, i) => i !== index));
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let imageUrls = [];
      if (imageFiles.length > 0) {
        imageUrls = await uploadReviewImages(imageFiles);
      }

      await addReview({
        productId,
        userId: currentUser.uid,
        userName: currentUser.name,
        userAvatar: currentUser.avatar || null,
        ...formData,
        images: imageUrls,
        verified: true
      });

      alert('Review submitted successfully!');
      setShowReviewForm(false);
      setFormData({ rating: 5, title: '', comment: '', images: [] });
      setImageFiles([]);
      fetchReviews();
      setCanReview(false);
    } catch (error) {
      alert(error.message || 'Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  const handleVendorResponse = async (reviewId) => {
    if (!vendorResponseText.trim()) {
      alert('Please enter a response');
      return;
    }

    try {
      await addVendorResponse(reviewId, vendorResponseText, currentUser.uid, currentUser.name);
      alert('Response added successfully!');
      setRespondingTo(null);
      setVendorResponseText('');
      fetchReviews();
    } catch (error) {
      alert('Failed to add response');
    }
  };

  const handleHelpful = async (reviewId) => {
    try {
      await markReviewHelpful(reviewId);
      fetchReviews();
    } catch (error) {
      console.error('Error marking helpful:', error);
    }
  };

  const handleReport = async (reviewId) => {
    const reason = window.prompt('Please provide a reason for reporting this review:');
    if (!reason) return;

    try {
      await reportReview(reviewId, reason);
      alert('Review reported. Thank you for helping us maintain quality.');
    } catch (error) {
      alert('Failed to report review');
    }
  };

  const getFilteredReviews = () => {
    let filtered = reviews;

    if (filterRating !== 'all') {
      filtered = filtered.filter(r => r.rating === parseInt(filterRating));
    }

    if (sortBy === 'recent') {
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === 'helpful') {
      filtered.sort((a, b) => (b.helpful || 0) - (a.helpful || 0));
    } else if (sortBy === 'rating-high') {
      filtered.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'rating-low') {
      filtered.sort((a, b) => a.rating - b.rating);
    }

    return filtered;
  };

  const ratingDistribution = [5, 4, 3, 2, 1].map(star => ({
    star,
    count: reviews.filter(r => r.rating === star).length,
    percentage: reviews.length > 0 ? (reviews.filter(r => r.rating === star).length / reviews.length) * 100 : 0
  }));

  const averageRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  const renderStars = (rating, size = 'text-base') => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} className={`${size} ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>
            ★
          </span>
        ))}
      </div>
    );
  };

  const isVendor = currentUser?.role === 'vendor' && currentUser?.uid === vendorId;

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Customer Reviews</h2>

      {/* Rating Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pb-8 border-b">
        <div className="text-center">
          <div className="text-5xl font-bold mb-2">{averageRating}</div>
          {renderStars(Math.round(averageRating), 'text-2xl')}
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Based on {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
          </p>
        </div>

        <div className="md:col-span-2">
          {ratingDistribution.map(({ star, count, percentage }) => (
            <div key={star} className="flex items-center gap-3 mb-2">
              <span className="text-sm w-12">{star} star</span>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-yellow-400 h-2 rounded-full"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
              <span className="text-sm w-12 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Write Review Button */}
      {currentUser && canReview && !showReviewForm && (
        <button
          onClick={() => setShowReviewForm(true)}
          className="mb-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
        >
          Write a Review
        </button>
      )}

      {!currentUser && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <Link to="/login" className="text-blue-600 hover:underline">
            Login to write a review
          </Link>
        </div>
      )}

      {/* Review Form */}
      {showReviewForm && (
        <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <h3 className="text-xl font-semibold mb-4">Write Your Review</h3>
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Rating *</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFormData({ ...formData, rating: star })}
                    className={`text-4xl ${star <= formData.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Review Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800"
                placeholder="Sum up your experience"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Your Review *</label>
              <textarea
                value={formData.comment}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                required
                rows="5"
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800"
                placeholder="Share your thoughts about this product..."
              />
            </div>

            {/* Image Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">Add Photos (Optional, max 5)</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageChange}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800"
              />
              {imageFiles.length > 0 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {imageFiles.map((file, index) => (
                    <div key={index} className="relative">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-20 object-cover rounded"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:bg-gray-400"
              >
                {loading ? 'Submitting...' : 'Submit Review'}
              </button>
              <button
                type="button"
                onClick={() => setShowReviewForm(false)}
                className="px-6 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-lg"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters and Sort */}
      {reviews.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
            className="px-4 py-2 border rounded-lg dark:bg-gray-800"
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2 border rounded-lg dark:bg-gray-800"
          >
            <option value="recent">Most Recent</option>
            <option value="helpful">Most Helpful</option>
            <option value="rating-high">Highest Rating</option>
            <option value="rating-low">Lowest Rating</option>
          </select>
        </div>
      )}

      {/* Reviews List */}
      <div className="space-y-6">
        {getFilteredReviews().map(review => (
          <div key={review.id} className="border-b pb-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xl font-bold">
                {review.userName?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium">{review.userName}</span>
                  {review.verified && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                      Verified Purchase
                    </span>
                  )}
                </div>
                {renderStars(review.rating)}
                <h4 className="font-semibold mt-2">{review.title}</h4>
                <p className="text-gray-700 dark:text-gray-300 mt-2">{review.comment}</p>

                {/* Review Images */}
                {review.images && review.images.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {review.images.map((img, index) => (
                      <img
                        key={index}
                        src={img}
                        alt={`Review ${index + 1}`}
                        className="w-20 h-20 object-cover rounded cursor-pointer hover:opacity-80"
                        onClick={() => window.open(img, '_blank')}
                      />
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4 mt-3 text-sm">
                  <span className="text-gray-500">
                    {new Date(review.createdAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleHelpful(review.id)}
                    className="text-gray-600 hover:text-blue-600"
                  >
                    👍 Helpful ({review.helpful || 0})
                  </button>
                  <button
                    onClick={() => handleReport(review.id)}
                    className="text-gray-600 hover:text-red-600"
                  >
                    Report
                  </button>
                  {isVendor && !review.vendorResponse && (
                    <button
                      onClick={() => setRespondingTo(review.id)}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Respond
                    </button>
                  )}
                </div>

                {/* Vendor Response */}
                {review.vendorResponse && (
                  <div className="mt-4 ml-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-l-4 border-blue-500">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-blue-700 dark:text-blue-400">
                        {review.vendorResponse.vendorName}
                      </span>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">
                        Vendor
                      </span>
                    </div>
                    <p className="text-sm">{review.vendorResponse.message}</p>
                    <span className="text-xs text-gray-500 mt-2 block">
                      {new Date(review.vendorResponse.respondedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Vendor Response Form */}
                {respondingTo === review.id && (
                  <div className="mt-4 ml-8">
                    <textarea
                      value={vendorResponseText}
                      onChange={(e) => setVendorResponseText(e.target.value)}
                      rows="3"
                      className="w-full px-4 py-2 border rounded-lg dark:bg-gray-800"
                      placeholder="Write your response..."
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleVendorResponse(review.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm"
                      >
                        Submit Response
                      </button>
                      <button
                        onClick={() => {
                          setRespondingTo(null);
                          setVendorResponseText('');
                        }}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {getFilteredReviews().length === 0 && (
          <p className="text-center text-gray-500 py-10">
            No reviews match your filters
          </p>
        )}
      </div>
    </div>
  );
};

export default ProductReviews;