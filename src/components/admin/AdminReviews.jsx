import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { moderateReview, deleteReview } from '../../services/reviewService';

const AdminReviews = () => {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedReview, setSelectedReview] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [moderatorNotes, setModeratorNotes] = useState('');

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'reviews'));
      const reviewsData = await Promise.all(
        snapshot.docs.map(async (reviewDoc) => {
          const review = { id: reviewDoc.id, ...reviewDoc.data() };
          
          // Fetch product details
          const productDoc = await getDocs(
            query(collection(db, 'products'), where('__name__', '==', review.productId))
          );
          if (!productDoc.empty) {
            review.productName = productDoc.docs[0].data().name;
          }
          
          return review;
        })
      );
      
      reviewsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setReviews(reviewsData);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModerate = async (reviewId, status) => {
    try {
      await moderateReview(reviewId, status, moderatorNotes);
      alert(`Review ${status} successfully!`);
      setShowDetailsModal(false);
      setModeratorNotes('');
      fetchReviews();
    } catch (error) {
      alert('Failed to moderate review');
    }
  };

  const handleDelete = async (reviewId, productId) => {
    if (!window.confirm('Are you sure you want to delete this review permanently?')) return;

    try {
      await deleteReview(reviewId, productId);
      alert('Review deleted successfully!');
      fetchReviews();
    } catch (error) {
      alert('Failed to delete review');
    }
  };

  const filteredReviews = reviews.filter(r => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'reported') return r.reported;
    return r.status === filterStatus;
  });

  const stats = {
    total: reviews.length,
    pending: reviews.filter(r => r.status === 'pending').length,
    approved: reviews.filter(r => r.status === 'approved').length,
    rejected: reviews.filter(r => r.status === 'rejected').length,
    reported: reviews.filter(r => r.reported).length
  };

  const renderStars = (rating) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <span key={star} className={`text-lg ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}>
            ★
          </span>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Review Moderation</h1>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">Total Reviews</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-yellow-700">Pending</p>
          <p className="text-2xl font-bold text-yellow-800">{stats.pending}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-green-700">Approved</p>
          <p className="text-2xl font-bold text-green-800">{stats.approved}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-red-700">Rejected</p>
          <p className="text-2xl font-bold text-red-800">{stats.rejected}</p>
        </div>
        <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-orange-700">Reported</p>
          <p className="text-2xl font-bold text-orange-800">{stats.reported}</p>
        </div>
      </div>

      {/* Filter */}
      <select
        value={filterStatus}
        onChange={(e) => setFilterStatus(e.target.value)}
        className="mb-6 px-4 py-2 border rounded-lg dark:bg-gray-700"
      >
        <option value="all">All Reviews</option>
        <option value="pending">Pending</option>
        <option value="approved">Approved</option>
        <option value="rejected">Rejected</option>
        <option value="reported">Reported</option>
      </select>

      {/* Reviews Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left py-3 px-4">Product</th>
              <th className="text-left py-3 px-4">Reviewer</th>
              <th className="text-left py-3 px-4">Rating</th>
              <th className="text-left py-3 px-4">Review</th>
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReviews.map(review => (
              <tr key={review.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="py-3 px-4">
                  <p className="font-medium">{review.productName || 'Unknown'}</p>
                </td>
                <td className="py-3 px-4">
                  <p className="font-medium">{review.userName}</p>
                  {review.verified && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Verified</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  {renderStars(review.rating)}
                </td>
                <td className="py-3 px-4 max-w-xs">
                  <p className="font-semibold text-sm">{review.title}</p>
                  <p className="text-sm text-gray-600 line-clamp-2">{review.comment}</p>
                </td>
                <td className="py-3 px-4 text-sm">
                  {new Date(review.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <div className="space-y-1">
                    <span className={`px-2 py-1 rounded-full text-xs block w-fit ${
                      review.status === 'approved' ? 'bg-green-100 text-green-800' :
                      review.status === 'rejected' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {review.status}
                    </span>
                    {review.reported && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs block w-fit">
                        Reported
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedReview(review);
                        setShowDetailsModal(true);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                    >
                      Review
                    </button>
                    <button
                      onClick={() => handleDelete(review.id, review.productId)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredReviews.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-600">No reviews found</p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedReview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Review Details</h2>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Product</p>
                <p className="font-semibold">{selectedReview.productName}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Reviewer</p>
                <p className="font-semibold">{selectedReview.userName}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Rating</p>
                {renderStars(selectedReview.rating)}
              </div>

              <div>
                <p className="text-sm text-gray-600">Title</p>
                <p className="font-semibold">{selectedReview.title}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Review</p>
                <p>{selectedReview.comment}</p>
              </div>

              {selectedReview.images && selectedReview.images.length > 0 && (
                <div>
                  <p className="text-sm text-gray-600 mb-2">Images</p>
                  <div className="flex gap-2">
                    {selectedReview.images.map((img, index) => (
                      <img
                        key={index}
                        src={img}
                        alt={`Review ${index + 1}`}
                        className="w-24 h-24 object-cover rounded cursor-pointer"
                        onClick={() => window.open(img, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}

              {selectedReview.reported && (
                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <p className="text-sm font-semibold text-orange-700">Report Reason:</p>
                  <p className="text-sm">{selectedReview.reportReason}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Moderator Notes</label>
                <textarea
                  value={moderatorNotes}
                  onChange={(e) => setModeratorNotes(e.target.value)}
                  rows="3"
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  placeholder="Add notes about your decision..."
                />
              </div>

              {selectedReview.status !== 'approved' && (
                <button
                  onClick={() => handleModerate(selectedReview.id, 'approved')}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg mb-2"
                >
                  Approve Review
                </button>
              )}

              {selectedReview.status !== 'rejected' && (
                <button
                  onClick={() => handleModerate(selectedReview.id, 'rejected')}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg"
                >
                  Reject Review
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminReviews;