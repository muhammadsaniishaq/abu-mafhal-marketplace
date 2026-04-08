import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';

const Reviews = () => {
  const { currentUser } = useAuth();
  const [myReviews, setMyReviews] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchReviews();
    fetchPendingReviews();
  }, [currentUser]);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('user_id', currentUser.id || currentUser.uid);
        
      if (error) throw error;
      setMyReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error.message);
    }
  };

  const fetchPendingReviews = async () => {
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('buyer_id', currentUser.id || currentUser.uid)
        .eq('status', 'completed');
        
      if (ordersError) throw ordersError;
      
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('product_id, productId')
        .eq('user_id', currentUser.id || currentUser.uid);
        
      if (reviewsError) throw reviewsError;
      
      const reviewedProductIds = (reviewsData || []).map(r => r.product_id || r.productId);

      const pending = [];
      (ordersData || []).forEach(order => {
        order.items?.forEach(item => {
          const pId = item.product_id || item.productId;
          if (!reviewedProductIds.includes(pId)) {
            pending.push({
              orderId: order.id,
              ...item
            });
          }
        });
      });
      
      setPendingReviews(pending);
    } catch (error) {
      console.error('Error fetching pending reviews:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const openReviewModal = (order) => {
    setSelectedOrder(order);
    setShowReviewModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">My Reviews</h1>

      {/* Pending Reviews */}
      {pendingReviews.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Products to Review</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingReviews.map((item, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <img 
                  src={item.image || 'https://via.placeholder.com/150'} 
                  alt={item.product_name || item.productName}
                  className="w-full h-32 object-cover rounded-lg mb-3"
                />
                <h3 className="font-semibold mb-2">{item.product_name || item.productName}</h3>
                <button
                  onClick={() => openReviewModal(item)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
                >
                  Write Review
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Reviews */}
      <div>
        <h2 className="text-xl font-semibold mb-4">My Reviews ({myReviews.length})</h2>
        {myReviews.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400">You haven't written any reviews yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {myReviews.map(review => (
              <div key={review.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <div className="flex gap-4">
                  <img 
                    src={review.product_image || review.productImage} 
                    alt={review.product_name || review.productName}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{review.product_name || review.productName}</h3>
                    <div className="flex items-center gap-1 mb-2">
                      {[1,2,3,4,5].map(star => (
                        <span key={star} className={star <= review.rating ? 'text-yellow-500' : 'text-gray-300'}>
                          ★
                        </span>
                      ))}
                      <span className="text-sm text-gray-600 ml-2">
                        {new Date(review.created_at || review.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mb-2">{review.comment}</p>
                    {review.images?.length > 0 && (
                      <div className="flex gap-2">
                        {review.images.map((img, i) => (
                          <img key={i} src={img} alt={`Review ${i+1}`} className="w-16 h-16 object-cover rounded" />
                        ))}
                      </div>
                    )}
                    {review.helpful > 0 && (
                      <p className="text-sm text-gray-600 mt-2">
                        {review.helpful} people found this helpful
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && <ReviewModal order={selectedOrder} onClose={() => setShowReviewModal(false)} onSuccess={() => { fetchReviews(); fetchPendingReviews(); }} />}
    </div>
  );
};

// Review Modal Component
const ReviewModal = ({ order, onClose, onSuccess }) => {
  const { currentUser } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 5) {
      alert('Maximum 5 images allowed');
      return;
    }
    setImages([...images, ...files]);
    const previews = files.map(file => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...previews]);
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    const urls = [];
    for (let i = 0; i < images.length; i++) {
      const filePath = `reviews/${currentUser.id || currentUser.uid}/${Date.now()}_${images[i].name}`;
      const { error } = await supabase.storage.from('reviews').upload(filePath, images[i]);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('reviews').getPublicUrl(filePath);
      urls.push(publicUrl);
    }
    return urls;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (rating === 0) {
      alert('Please select a rating');
      return;
    }

    setLoading(true);
    try {
      const imageUrls = await uploadImages();

      const { error } = await supabase.from('reviews').insert([{
        user_id: currentUser.id || currentUser.uid,
        user_name: currentUser.name || currentUser.full_name || 'Anonymous',
        user_avatar: currentUser.avatar_url || currentUser.avatar || null,
        product_id: order.product_id || order.productId,
        product_name: order.product_name || order.productName,
        product_image: order.image,
        vendor_id: order.vendor_id || order.vendorId,
        order_id: order.orderId || order.order_id,
        rating,
        comment,
        images: imageUrls,
        helpful: 0,
        verified: true,
        created_at: new Date().toISOString()
      }]);

      if (error) throw error;

      // Update product rating
      // You'll need to calculate average rating here

      alert('Review submitted successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error submitting review:', error.message);
      alert('Failed to submit review');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">Write a Review</h2>
          <button onClick={onClose} className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full">×</button>
        </div>

        <div className="mb-6">
          <img src={order.image} alt={order.product_name || order.productName} className="w-20 h-20 object-cover rounded-lg mb-2" />
          <h3 className="font-semibold">{order.product_name || order.productName}</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Rating</label>
            <div className="flex gap-2">
              {[1,2,3,4,5].map(star => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="text-3xl transition hover:scale-110"
                >
                  <span className={star <= rating ? 'text-yellow-500' : 'text-gray-300'}>★</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Your Review</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              required
              rows="4"
              placeholder="Share your experience with this product..."
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Add Photos (Optional)</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
            />
            {imagePreviews.length > 0 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img src={preview} alt={`Preview ${index+1}`} className="w-full h-20 object-cover rounded" />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400"
          >
            {loading ? 'Submitting...' : 'Submit Review'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Reviews;