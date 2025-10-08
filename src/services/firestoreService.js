// src/services/firestoreService.js
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db } from '../config/firebase';

// ============ USERS ============
export const createUser = async (userId, userData) => {
  await updateDoc(doc(db, 'users', userId), {
    ...userData,
    updatedAt: serverTimestamp()
  });
};

export const getUser = async (userId) => {
  const docSnap = await getDoc(doc(db, 'users', userId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

export const updateUser = async (userId, updates) => {
  await updateDoc(doc(db, 'users', userId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

export const getAllUsers = async (role = null) => {
  let q = collection(db, 'users');
  if (role) {
    q = query(q, where('role', '==', role));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// ============ PRODUCTS ============
export const createProduct = async (productData) => {
  const docRef = await addDoc(collection(db, 'products'), {
    ...productData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    views: 0,
    sales: 0,
    rating: 0,
    reviewCount: 0,
    status: 'pending' // pending, approved, rejected
  });
  return docRef.id;
};

export const getProduct = async (productId) => {
  const docSnap = await getDoc(doc(db, 'products', productId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

export const updateProduct = async (productId, updates) => {
  await updateDoc(doc(db, 'products', productId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

export const deleteProduct = async (productId) => {
  await deleteDoc(doc(db, 'products', productId));
};

export const getProducts = async (filters = {}, limitCount = 20, lastDoc = null) => {
  let q = collection(db, 'products');
  
  // Apply filters
  if (filters.category) {
    q = query(q, where('category', '==', filters.category));
  }
  if (filters.vendorId) {
    q = query(q, where('vendorId', '==', filters.vendorId));
  }
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }
  
  // Sorting
  const sortField = filters.sortBy || 'createdAt';
  const sortDirection = filters.sortDirection || 'desc';
  q = query(q, orderBy(sortField, sortDirection));
  
  // Pagination
  q = query(q, limit(limitCount));
  if (lastDoc) {
    q = query(q, startAfter(lastDoc));
  }
  
  const snapshot = await getDocs(q);
  return {
    products: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    lastDoc: snapshot.docs[snapshot.docs.length - 1]
  };
};

export const incrementProductViews = async (productId) => {
  await updateDoc(doc(db, 'products', productId), {
    views: increment(1)
  });
};

// ============ ORDERS ============
export const createOrder = async (orderData) => {
  const docRef = await addDoc(collection(db, 'orders'), {
    ...orderData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: 'pending', // pending, confirmed, processing, shipped, delivered, cancelled
    paymentStatus: 'pending' // pending, paid, failed, refunded
  });
  return docRef.id;
};

export const getOrder = async (orderId) => {
  const docSnap = await getDoc(doc(db, 'orders', orderId));
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
};

export const updateOrder = async (orderId, updates) => {
  await updateDoc(doc(db, 'orders', orderId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

export const getUserOrders = async (userId, role = 'buyer') => {
  const field = role === 'vendor' ? 'vendorId' : 'buyerId';
  const q = query(
    collection(db, 'orders'),
    where(field, '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// ============ CART ============
export const getCart = async (userId) => {
  const docSnap = await getDoc(doc(db, 'carts', userId));
  return docSnap.exists() ? docSnap.data() : { items: [] };
};

export const updateCart = async (userId, items) => {
  await updateDoc(doc(db, 'carts', userId), {
    items: items,
    updatedAt: serverTimestamp()
  });
};

export const clearCart = async (userId) => {
  await updateDoc(doc(db, 'carts', userId), {
    items: [],
    updatedAt: serverTimestamp()
  });
};

// ============ WISHLIST ============
export const getWishlist = async (userId) => {
  const docSnap = await getDoc(doc(db, 'wishlists', userId));
  return docSnap.exists() ? docSnap.data() : { items: [] };
};

export const updateWishlist = async (userId, items) => {
  await updateDoc(doc(db, 'wishlists', userId), {
    items: items,
    updatedAt: serverTimestamp()
  });
};

// ============ REVIEWS ============
export const createReview = async (reviewData) => {
  const docRef = await addDoc(collection(db, 'reviews'), {
    ...reviewData,
    createdAt: serverTimestamp(),
    helpful: 0,
    verified: false
  });
  
  // Update product rating
  await updateProductRating(reviewData.productId);
  
  return docRef.id;
};

export const getProductReviews = async (productId) => {
  const q = query(
    collection(db, 'reviews'),
    where('productId', '==', productId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

const updateProductRating = async (productId) => {
  const reviews = await getProductReviews(productId);
  if (reviews.length > 0) {
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await updateDoc(doc(db, 'products', productId), {
      rating: avgRating,
      reviewCount: reviews.length
    });
  }
};

// ============ DISPUTES ============
export const createDispute = async (disputeData) => {
  const docRef = await addDoc(collection(db, 'disputes'), {
    ...disputeData,
    status: 'open', // open, in_progress, resolved, closed
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return docRef.id;
};

export const getDisputes = async (filters = {}) => {
  let q = collection(db, 'disputes');
  
  if (filters.userId) {
    q = query(q, where('buyerId', '==', filters.userId));
  }
  if (filters.vendorId) {
    q = query(q, where('vendorId', '==', filters.vendorId));
  }
  if (filters.status) {
    q = query(q, where('status', '==', filters.status));
  }
  
  q = query(q, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const updateDispute = async (disputeId, updates) => {
  await updateDoc(doc(db, 'disputes', disputeId), {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

// ============ NOTIFICATIONS ============
export const createNotification = async (notificationData) => {
  const docRef = await addDoc(collection(db, 'notifications'), {
    ...notificationData,
    read: false,
    createdAt: serverTimestamp()
  });
  return docRef.id;
};

export const getUserNotifications = async (userId, unreadOnly = false) => {
  let q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  
  if (unreadOnly) {
    q = query(q, where('read', '==', false));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const markNotificationAsRead = async (notificationId) => {
  await updateDoc(doc(db, 'notifications', notificationId), {
    read: true
  });
};

// ============ ANALYTICS ============
export const getAnalytics = async (userId, role) => {
  const analyticsDoc = await getDoc(doc(db, 'analytics', userId));
  return analyticsDoc.exists() ? analyticsDoc.data() : null;
};

export const updateAnalytics = async (userId, data) => {
  await updateDoc(doc(db, 'analytics', userId), {
    ...data,
    updatedAt: serverTimestamp()
  });
};