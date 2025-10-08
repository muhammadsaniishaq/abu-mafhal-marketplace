import { collection, addDoc, query, where, getDocs, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const saveAbandonedCart = async (userId, cartItems, userEmail, userName) => {
  try {
    if (cartItems.length === 0) return;

    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Check if abandoned cart already exists
    const q = query(
      collection(db, 'abandonedCarts'),
      where('userId', '==', userId),
      where('recovered', '==', false)
    );
    const existing = await getDocs(q);

    if (!existing.empty) {
      // Update existing
      await updateDoc(doc(db, 'abandonedCarts', existing.docs[0].id), {
        items: cartItems,
        total,
        updatedAt: new Date().toISOString()
      });
    } else {
      // Create new
      await addDoc(collection(db, 'abandonedCarts'), {
        userId,
        userEmail,
        userName,
        items: cartItems,
        total,
        recovered: false,
        remindersSent: 0,
        createdAt: new Date().toISOString(),
        lastReminderSent: null
      });
    }
  } catch (error) {
    console.error('Error saving abandoned cart:', error);
  }
};

export const markCartAsRecovered = async (userId) => {
  try {
    const q = query(
      collection(db, 'abandonedCarts'),
      where('userId', '==', userId),
      where('recovered', '==', false)
    );
    const snapshot = await getDocs(q);
    
    snapshot.docs.forEach(async (docSnap) => {
      await updateDoc(doc(db, 'abandonedCarts', docSnap.id), {
        recovered: true,
        recoveredAt: new Date().toISOString()
      });
    });
  } catch (error) {
    console.error('Error marking cart as recovered:', error);
  }
};

export const deleteAbandonedCart = async (userId) => {
  try {
    const q = query(
      collection(db, 'abandonedCarts'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    
    snapshot.docs.forEach(async (docSnap) => {
      await deleteDoc(doc(db, 'abandonedCarts', docSnap.id));
    });
  } catch (error) {
    console.error('Error deleting abandoned cart:', error);
  }
};

export const getAbandonedCarts = async () => {
  try {
    const snapshot = await getDocs(collection(db, 'abandonedCarts'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting abandoned carts:', error);
    return [];
  }
};

export const sendCartReminder = async (cartId) => {
  try {
    const cartDoc = await getDocs(doc(db, 'abandonedCarts', cartId));
    const cart = cartDoc.data();

    await updateDoc(doc(db, 'abandonedCarts', cartId), {
      remindersSent: (cart.remindersSent || 0) + 1,
      lastReminderSent: new Date().toISOString()
    });

    // Queue email notification
    await addDoc(collection(db, 'emailQueue'), {
      to: cart.userEmail,
      template: 'cart-reminder',
      data: {
        userName: cart.userName,
        items: cart.items,
        total: cart.total,
        cartUrl: `${window.location.origin}/cart`
      },
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error sending cart reminder:', error);
  }
};