import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
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
      const q = query(
        collection(db, 'wishlists'),
        where('userId', '==', currentUser.uid),
        where('productId', '==', product.id)
      );
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        setIsInWishlist(true);
        setWishlistId(snapshot.docs[0].id);
      } else {
        setIsInWishlist(false);
        setWishlistId(null);
      }
    } catch (error) {
      console.error('Error checking wishlist:', error);
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
        await deleteDoc(doc(db, 'wishlists', wishlistId));
        setIsInWishlist(false);
        setWishlistId(null);
      } else {
        const docRef = await addDoc(collection(db, 'wishlists'), {
          userId: currentUser.uid,
          productId: product.id,
          createdAt: new Date().toISOString()
        });
        setIsInWishlist(true);
        setWishlistId(docRef.id);
      }
    } catch (error) {
      console.error('Error toggling wishlist:', error);
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