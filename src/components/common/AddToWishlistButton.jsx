import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const AddToWishlistButton = ({ product }) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [wishlistId, setWishlistId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      checkWishlistStatus();
    }
  }, [currentUser, product.id]);

  const checkWishlistStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('wishlists')
        .select('id')
        .eq('user_id', currentUser.id || currentUser.uid)
        .eq('product_id', product.id || product.product_id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setIsInWishlist(true);
        setWishlistId(data.id);
      } else {
        setIsInWishlist(false);
        setWishlistId(null);
      }
    } catch (error) {
      console.error('Error checking wishlist:', error.message);
    }
  };

  const toggleWishlist = async () => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    setLoading(true);

    try {
      if (isInWishlist && wishlistId) {
        const { error } = await supabase
          .from('wishlists')
          .delete()
          .eq('id', wishlistId);
          
        if (error) throw error;
        setIsInWishlist(false);
        setWishlistId(null);
      } else {
        const { data, error } = await supabase
          .from('wishlists')
          .insert([{
            user_id: currentUser.id || currentUser.uid,
            product_id: product.id || product.product_id,
            created_at: new Date().toISOString()
          }])
          .select('id')
          .single();
          
        if (error) throw error;
        setIsInWishlist(true);
        setWishlistId(data.id);
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error.message);
      alert('Failed to update wishlist');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleWishlist}
      disabled={loading}
      className={`px-6 py-3 rounded-lg font-medium transition ${
        isInWishlist
          ? 'bg-red-100 text-red-600 hover:bg-red-200'
          : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
      } disabled:opacity-50`}
    >
      {loading ? 'Loading...' : isInWishlist ? '❤️ In Wishlist' : '🤍 Add to Wishlist'}
    </button>
  );
};

export default AddToWishlistButton;