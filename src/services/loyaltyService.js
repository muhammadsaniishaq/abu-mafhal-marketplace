import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc, increment } from 'firebase/firestore';
import { db } from '../config/firebase';

const POINTS_CONFIG = {
  purchase: 1, // 1 point per ₦100 spent
  review: 50, // 50 points for writing a review
  referral: 200, // 200 points for successful referral
  firstPurchase: 500, // 500 bonus points for first purchase
  birthday: 1000, // 1000 points on birthday
  accountCreation: 100 // 100 welcome points
};

const TIER_THRESHOLDS = {
  bronze: 0,
  silver: 1000,
  gold: 5000,
  platinum: 15000
};

const TIER_BENEFITS = {
  bronze: { discount: 0, pointsMultiplier: 1, freeShipping: false },
  silver: { discount: 5, pointsMultiplier: 1.25, freeShipping: false },
  gold: { discount: 10, pointsMultiplier: 1.5, freeShipping: true },
  platinum: { discount: 15, pointsMultiplier: 2, freeShipping: true }
};

export const initializeLoyaltyAccount = async (userId, userName) => {
  try {
    const loyaltyRef = await addDoc(collection(db, 'loyalty'), {
      userId,
      userName,
      points: POINTS_CONFIG.accountCreation,
      lifetimePoints: POINTS_CONFIG.accountCreation,
      tier: 'bronze',
      createdAt: new Date().toISOString()
    });

    // Record transaction
    await addDoc(collection(db, 'loyaltyTransactions'), {
      userId,
      points: POINTS_CONFIG.accountCreation,
      type: 'earn',
      reason: 'Welcome bonus',
      createdAt: new Date().toISOString()
    });

    return loyaltyRef.id;
  } catch (error) {
    console.error('Error initializing loyalty account:', error);
    throw error;
  }
};

export const awardPoints = async (userId, amount, reason, metadata = {}) => {
  try {
    const q = query(collection(db, 'loyalty'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      console.error('Loyalty account not found');
      return;
    }

    const loyaltyDoc = snapshot.docs[0];
    const currentData = loyaltyDoc.data();
    const newPoints = currentData.points + amount;
    const newLifetimePoints = currentData.lifetimePoints + amount;
    const newTier = calculateTier(newLifetimePoints);

    await updateDoc(doc(db, 'loyalty', loyaltyDoc.id), {
      points: newPoints,
      lifetimePoints: newLifetimePoints,
      tier: newTier,
      updatedAt: new Date().toISOString()
    });

    // Record transaction
    await addDoc(collection(db, 'loyaltyTransactions'), {
      userId,
      points: amount,
      type: 'earn',
      reason,
      metadata,
      createdAt: new Date().toISOString()
    });

    return { newPoints, newTier };
  } catch (error) {
    console.error('Error awarding points:', error);
    throw error;
  }
};

export const redeemPoints = async (userId, amount, reason) => {
  try {
    const q = query(collection(db, 'loyalty'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      throw new Error('Loyalty account not found');
    }

    const loyaltyDoc = snapshot.docs[0];
    const currentData = loyaltyDoc.data();

    if (currentData.points < amount) {
      throw new Error('Insufficient points');
    }

    const newPoints = currentData.points - amount;

    await updateDoc(doc(db, 'loyalty', loyaltyDoc.id), {
      points: newPoints,
      updatedAt: new Date().toISOString()
    });

    // Record transaction
    await addDoc(collection(db, 'loyaltyTransactions'), {
      userId,
      points: -amount,
      type: 'redeem',
      reason,
      createdAt: new Date().toISOString()
    });

    return newPoints;
  } catch (error) {
    console.error('Error redeeming points:', error);
    throw error;
  }
};

export const calculateTier = (lifetimePoints) => {
  if (lifetimePoints >= TIER_THRESHOLDS.platinum) return 'platinum';
  if (lifetimePoints >= TIER_THRESHOLDS.gold) return 'gold';
  if (lifetimePoints >= TIER_THRESHOLDS.silver) return 'silver';
  return 'bronze';
};

export const getTierBenefits = (tier) => {
  return TIER_BENEFITS[tier] || TIER_BENEFITS.bronze;
};

export const calculatePurchasePoints = (amount, tier = 'bronze') => {
  const basePoints = Math.floor(amount / 100) * POINTS_CONFIG.purchase;
  const multiplier = TIER_BENEFITS[tier].pointsMultiplier;
  return Math.floor(basePoints * multiplier);
};

export const pointsToDiscount = (points) => {
  return points; // 1 point = ₦1 discount
};

export const getLoyaltyAccount = async (userId) => {
  try {
    const q = query(collection(db, 'loyalty'), where('userId', '==', userId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  } catch (error) {
    console.error('Error getting loyalty account:', error);
    return null;
  }
};

export const getLoyaltyTransactions = async (userId) => {
  try {
    const q = query(
      collection(db, 'loyaltyTransactions'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  } catch (error) {
    console.error('Error getting transactions:', error);
    return [];
  }
};

export { POINTS_CONFIG, TIER_THRESHOLDS, TIER_BENEFITS };