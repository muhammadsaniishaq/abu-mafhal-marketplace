import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getLoyaltyAccount, getLoyaltyTransactions, redeemPoints, getTierBenefits, TIER_THRESHOLDS } from '../../services/loyaltyService';

const LoyaltyRewards = () => {
  const { currentUser } = useAuth();
  const [loyaltyData, setLoyaltyData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState('');

  useEffect(() => {
    fetchLoyaltyData();
  }, [currentUser]);

  const fetchLoyaltyData = async () => {
    try {
      const account = await getLoyaltyAccount(currentUser.uid);
      const history = await getLoyaltyTransactions(currentUser.uid);
      setLoyaltyData(account);
      setTransactions(history);
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    const amount = parseInt(redeemAmount);
    if (!amount || amount < 100) {
      alert('Minimum redemption is 100 points');
      return;
    }

    if (amount > loyaltyData.points) {
      alert('Insufficient points');
      return;
    }

    try {
      await redeemPoints(currentUser.uid, amount, 'Manual redemption for discount code');
      alert(`Successfully redeemed ${amount} points! Check your email for the discount code.`);
      setShowRedeemModal(false);
      setRedeemAmount('');
      fetchLoyaltyData();
    } catch (error) {
      alert('Failed to redeem points');
    }
  };

  const getNextTier = () => {
    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const currentIndex = tiers.indexOf(loyaltyData.tier);
    if (currentIndex === tiers.length - 1) return null;
    return tiers[currentIndex + 1];
  };

  const getProgressToNextTier = () => {
    const nextTier = getNextTier();
    if (!nextTier) return 100;

    const currentThreshold = TIER_THRESHOLDS[loyaltyData.tier];
    const nextThreshold = TIER_THRESHOLDS[nextTier];
    const progress = ((loyaltyData.lifetimePoints - currentThreshold) / (nextThreshold - currentThreshold)) * 100;
    return Math.min(100, Math.max(0, progress));
  };

  const tierColors = {
    bronze: 'from-amber-700 to-amber-900',
    silver: 'from-gray-400 to-gray-600',
    gold: 'from-yellow-400 to-yellow-600',
    platinum: 'from-purple-400 to-purple-600'
  };

  const tierIcons = {
    bronze: '🥉',
    silver: '🥈',
    gold: '🥇',
    platinum: '💎'
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!loyaltyData) {
    return (
      <div className="p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">Loyalty account not found. Contact support.</p>
        </div>
      </div>
    );
  }

  const benefits = getTierBenefits(loyaltyData.tier);
  const nextTier = getNextTier();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Loyalty & Rewards</h1>

      {/* Tier Card */}
      <div className={`bg-gradient-to-br ${tierColors[loyaltyData.tier]} text-white rounded-lg p-8 mb-6 shadow-xl`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm opacity-90">Your Tier</p>
            <h2 className="text-4xl font-bold capitalize flex items-center gap-3">
              {tierIcons[loyaltyData.tier]} {loyaltyData.tier}
            </h2>
          </div>
          <div className="text-right">
            <p className="text-sm opacity-90">Available Points</p>
            <p className="text-4xl font-bold">{loyaltyData.points.toLocaleString()}</p>
          </div>
        </div>

        {nextTier && (
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Progress to {nextTier}</span>
              <span>{loyaltyData.lifetimePoints.toLocaleString()} / {TIER_THRESHOLDS[nextTier].toLocaleString()} points</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3">
              <div
                className="bg-white h-3 rounded-full transition-all duration-500"
                style={{ width: `${getProgressToNextTier()}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Benefits & Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Benefits */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h3 className="text-xl font-bold mb-4">Your Benefits</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">💰</span>
              <div>
                <p className="font-semibold">{benefits.discount}% Member Discount</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">On all purchases</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">⭐</span>
              <div>
                <p className="font-semibold">{benefits.pointsMultiplier}x Points Multiplier</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Earn more points faster</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-2xl">🚚</span>
              <div>
                <p className="font-semibold">
                  {benefits.freeShipping ? 'Free Shipping' : 'Standard Shipping'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {benefits.freeShipping ? 'On all orders' : 'Regular rates apply'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h3 className="text-xl font-bold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button
              onClick={() => setShowRedeemModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-medium"
            >
              Redeem Points
            </button>
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
              <p className="text-sm font-semibold mb-1">Points Value</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Your {loyaltyData.points.toLocaleString()} points = ₦{loyaltyData.points.toLocaleString()} discount
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* How to Earn Points */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow mb-6">
        <h3 className="text-xl font-bold mb-4">How to Earn Points</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 border rounded-lg">
            <p className="text-3xl mb-2">🛒</p>
            <p className="font-semibold">Shop</p>
            <p className="text-sm text-gray-600">1 point per ₦100</p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-3xl mb-2">⭐</p>
            <p className="font-semibold">Review Products</p>
            <p className="text-sm text-gray-600">50 points each</p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-3xl mb-2">👥</p>
            <p className="font-semibold">Refer Friends</p>
            <p className="text-sm text-gray-600">200 points each</p>
          </div>
          <div className="p-4 border rounded-lg">
            <p className="text-3xl mb-2">🎂</p>
            <p className="font-semibold">Birthday Bonus</p>
            <p className="text-sm text-gray-600">1000 points</p>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
        <h3 className="text-xl font-bold mb-4">Points History</h3>
        <div className="space-y-3">
          {transactions.length === 0 ? (
            <p className="text-center text-gray-500 py-10">No transactions yet</p>
          ) : (
            transactions.map(transaction => (
              <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div>
                  <p className="font-medium">{transaction.reason}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(transaction.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <p className={`text-lg font-bold ${transaction.type === 'earn' ? 'text-green-600' : 'text-red-600'}`}>
                  {transaction.type === 'earn' ? '+' : '-'}{Math.abs(transaction.points)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Redeem Modal */}
      {showRedeemModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Redeem Points</h2>
              <button 
                onClick={() => setShowRedeemModal(false)}
                className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full"
              >
                ×
              </button>
            </div>

            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm mb-1">Available Points</p>
              <p className="text-2xl font-bold text-blue-600">{loyaltyData.points.toLocaleString()}</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Points to Redeem (min 100)</label>
              <input
                type="number"
                value={redeemAmount}
                onChange={(e) => setRedeemAmount(e.target.value)}
                min="100"
                max={loyaltyData.points}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              />
              {redeemAmount && (
                <p className="text-sm text-gray-600 mt-2">
                  = ₦{parseInt(redeemAmount || 0).toLocaleString()} discount
                </p>
              )}
            </div>

            <button
              onClick={handleRedeem}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-medium"
            >
              Redeem Points
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoyaltyRewards;