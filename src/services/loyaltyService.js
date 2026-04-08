import { supabase } from '../config/supabase';

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
    const { data, error } = await supabase
      .from('loyalty')
      .insert({
        user_id: userId,
        user_name: userName,
        points: POINTS_CONFIG.accountCreation,
        lifetime_points: POINTS_CONFIG.accountCreation,
        tier: 'bronze',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Record transaction
    const { error: txError } = await supabase
      .from('loyalty_transactions')
      .insert({
        user_id: userId,
        points: POINTS_CONFIG.accountCreation,
        type: 'earn',
        reason: 'Welcome bonus',
        created_at: new Date().toISOString()
      });

    if (txError) throw txError;

    return data.id;
  } catch (error) {
    console.error('Error initializing loyalty account:', error.message);
    throw error;
  }
};

export const awardPoints = async (userId, amount, reason, metadata = {}) => {
  try {
    const { data: loyaltyData, error: loyaltyError } = await supabase
      .from('loyalty')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (loyaltyError || !loyaltyData) {
      console.error('Loyalty account not found');
      return;
    }

    const newPoints = loyaltyData.points + amount;
    const newLifetimePoints = loyaltyData.lifetime_points + amount;
    const newTier = calculateTier(newLifetimePoints);

    const { error: updateError } = await supabase
      .from('loyalty')
      .update({
        points: newPoints,
        lifetime_points: newLifetimePoints,
        tier: newTier,
        updated_at: new Date().toISOString()
      })
      .eq('id', loyaltyData.id);

    if (updateError) throw updateError;

    // Record transaction
    await supabase
      .from('loyalty_transactions')
      .insert({
        user_id: userId,
        points: amount,
        type: 'earn',
        reason,
        metadata,
        created_at: new Date().toISOString()
      });

    return { newPoints, newTier };
  } catch (error) {
    console.error('Error awarding points:', error.message);
    throw error;
  }
};

export const redeemPoints = async (userId, amount, reason) => {
  try {
    const { data: loyaltyData, error: loyaltyError } = await supabase
      .from('loyalty')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (loyaltyError || !loyaltyData) {
      throw new Error('Loyalty account not found');
    }

    if (loyaltyData.points < amount) {
      throw new Error('Insufficient points');
    }

    const newPoints = loyaltyData.points - amount;

    const { error: updateError } = await supabase
      .from('loyalty')
      .update({
        points: newPoints,
        updated_at: new Date().toISOString()
      })
      .eq('id', loyaltyData.id);

    if (updateError) throw updateError;

    // Record transaction
    await supabase
      .from('loyalty_transactions')
      .insert({
        user_id: userId,
        points: -amount,
        type: 'redeem',
        reason,
        created_at: new Date().toISOString()
      });

    return newPoints;
  } catch (error) {
    console.error('Error redeeming points:', error.message);
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
    const { data, error } = await supabase
      .from('loyalty')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error getting loyalty account:', error.message);
    return null;
  }
};

export const getLoyaltyTransactions = async (userId) => {
  try {
    const { data, error } = await supabase
      .from('loyalty_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting transactions:', error.message);
    return [];
  }
};

export { POINTS_CONFIG, TIER_THRESHOLDS, TIER_BENEFITS };