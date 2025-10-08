import { collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';

export const uploadReviewImages = async (files) => {
  try {
    const uploadPromises = files.map(async (file) => {
      const storageRef = ref(storage, `reviews/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      return await getDownloadURL(storageRef);
    });
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading review images:', error);
    throw error;
  }
};

export const addReview = async (reviewData) => {
  try {
    const q = query(
      collection(db, 'reviews'),
      where('productId', '==', reviewData.productId),
      where('userId', '==', reviewData.userId)
    );
    const existingReviews = await getDocs(q);
    
    if (!existingReviews.empty) {
      throw new Error('You have already reviewed this product');
    }

    const review = await addDoc(collection(db, 'reviews'), {
      ...reviewData,
      createdAt: new Date().toISOString(),
      helpful: 0,
      reported: false,
      vendorResponse: null,
      status: 'approved' // Auto-approve or set to 'pending' for moderation
    });

    await updateProductRating(reviewData.productId);
    return review.id;
  } catch (error) {
    console.error('Error adding review:', error);
    throw error;
  }
};

export const addVendorResponse = async (reviewId, response, vendorId, vendorName) => {
  try {
    await updateDoc(doc(db, 'reviews', reviewId), {
      vendorResponse: {
        message: response,
        vendorId,
        vendorName,
        respondedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error adding vendor response:', error);
    throw error;
  }
};

export const updateProductRating = async (productId) => {
  try {
    const q = query(
      collection(db, 'reviews'),
      where('productId', '==', productId),
      where('status', '==', 'approved')
    );
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    const reviews = snapshot.docs.map(doc => doc.data());
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    const reviewCount = reviews.length;

    await updateDoc(doc(db, 'products', productId), {
      rating: parseFloat(avgRating.toFixed(1)),
      reviews: reviewCount
    });
  } catch (error) {
    console.error('Error updating product rating:', error);
  }
};

export const markReviewHelpful = async (reviewId) => {
  try {
    const reviewDoc = await getDoc(doc(db, 'reviews', reviewId));
    if (reviewDoc.exists()) {
      await updateDoc(doc(db, 'reviews', reviewId), {
        helpful: (reviewDoc.data().helpful || 0) + 1
      });
    }
  } catch (error) {
    console.error('Error marking review helpful:', error);
  }
};

export const reportReview = async (reviewId, reason) => {
  try {
    await updateDoc(doc(db, 'reviews', reviewId), {
      reported: true,
      reportReason: reason,
      reportedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reporting review:', error);
  }
};

export const moderateReview = async (reviewId, status, moderatorNotes = '') => {
  try {
    await updateDoc(doc(db, 'reviews', reviewId), {
      status,
      moderatorNotes,
      moderatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error moderating review:', error);
    throw error;
  }
};

export const deleteReview = async (reviewId, productId) => {
  try {
    await deleteDoc(doc(db, 'reviews', reviewId));
    await updateProductRating(productId);
  } catch (error) {
    console.error('Error deleting review:', error);
    throw error;
  }
};