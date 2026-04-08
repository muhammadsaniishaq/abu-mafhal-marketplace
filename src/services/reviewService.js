import { supabase } from '../config/supabase';

export const uploadReviewImages = async (files) => {
  try {
    const uploadPromises = files.map(async (file) => {
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `reviews/${fileName}`;
      
      const { error } = await supabase.storage
        .from('reviews')
        .upload(filePath, file);

      if (error) throw error;

      const { data } = supabase.storage.from('reviews').getPublicUrl(filePath);
      return data.publicUrl;
    });
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Error uploading review images:', error.message);
    throw error;
  }
};

export const addReview = async (reviewData) => {
  try {
    const { data: existingReviews, error: searchError } = await supabase
      .from('reviews')
      .select('id')
      .eq('product_id', reviewData.product_id || reviewData.productId)
      .eq('user_id', reviewData.user_id || reviewData.userId);

    if (existingReviews?.length > 0) {
      throw new Error('You have already reviewed this product');
    }

    const { data, error } = await supabase
      .from('reviews')
      .insert({
        ...reviewData,
        created_at: new Date().toISOString(),
        helpful: 0,
        reported: false,
        vendor_response: null,
        status: 'approved'
      })
      .select()
      .single();

    if (error) throw error;

    await updateProductRating(reviewData.product_id || reviewData.productId);
    return data.id;
  } catch (error) {
    console.error('Error adding review:', error.message);
    throw error;
  }
};

export const addVendorResponse = async (reviewId, response, vendorId, vendorName) => {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({
        vendor_response: {
          message: response,
          vendor_id: vendorId,
          vendor_name: vendorName,
          responded_at: new Date().toISOString()
        }
      })
      .eq('id', reviewId);

    if (error) throw error;
  } catch (error) {
    console.error('Error adding vendor response:', error.message);
    throw error;
  }
};

export const updateProductRating = async (productId) => {
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('rating')
      .eq('product_id', productId)
      .eq('status', 'approved');

    if (error || !reviews) return;

    if (reviews.length === 0) return;

    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    const reviewCount = reviews.length;

    await supabase
      .from('products')
      .update({
        rating: parseFloat(avgRating.toFixed(1)),
        reviews_count: reviewCount
      })
      .eq('id', productId);
  } catch (error) {
    console.error('Error updating product rating:', error.message);
  }
};

export const markReviewHelpful = async (reviewId) => {
  try {
    const { data: review, error } = await supabase
      .from('reviews')
      .select('helpful')
      .eq('id', reviewId)
      .single();

    if (error) throw error;

    await supabase
      .from('reviews')
      .update({
        helpful: (review.helpful || 0) + 1
      })
      .eq('id', reviewId);
  } catch (error) {
    console.error('Error marking review helpful:', error.message);
  }
};

export const reportReview = async (reviewId, reason) => {
  try {
    await supabase
      .from('reviews')
      .update({
        reported: true,
        report_reason: reason,
        reported_at: new Date().toISOString()
      })
      .eq('id', reviewId);
  } catch (error) {
    console.error('Error reporting review:', error.message);
  }
};

export const moderateReview = async (reviewId, status, moderatorNotes = '') => {
  try {
    const { error } = await supabase
      .from('reviews')
      .update({
        status,
        moderator_notes: moderatorNotes,
        moderated_at: new Date().toISOString()
      })
      .eq('id', reviewId);

    if (error) throw error;
  } catch (error) {
    console.error('Error moderating review:', error.message);
    throw error;
  }
};

export const deleteReview = async (reviewId, productId) => {
  try {
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', reviewId);

    if (error) throw error;
    await updateProductRating(productId);
  } catch (error) {
    console.error('Error deleting review:', error.message);
    throw error;
  }
};