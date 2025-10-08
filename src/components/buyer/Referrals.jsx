import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, query, where, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';

const Referrals = () => {
  const { currentUser } = useAuth();
  const [referrals, setReferrals] = useState([]);
  const [stats, setStats] = useState({
    totalReferrals: 0,
    successfulReferrals: 0,
    totalEarned: 0,
    pendingRewards: 0
  });
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralCode = currentUser?.uid?.substring(0, 8).toUpperCase() || 'LOADING';
  const referralLink = `${window.location.origin}/register?ref=${referralCode}`;
  const referralReward = 500; // 500 Naira per successful referral

  useEffect(() => {
    fetchReferrals();
  }, [currentUser]);

  const fetchReferrals = async () => {
    try {
      const q = query(collection(db, 'referrals'), where('referrerId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const referralsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setReferrals(referralsData);

      const successful = referralsData.filter(r => r.status === 'completed');
      const pending = referralsData.filter(r => r.status === 'pending');

      setStats({
        totalReferrals: referralsData.length,
        successfulReferrals: successful.length,
        totalEarned: successful.length * referralReward,
        pendingRewards: pending.length * referralReward
      });
    } catch (error) {
      console.error('Error fetching referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareVia = (platform) => {
    const text = encodeURIComponent(`Join Abu Mafhal marketplace using my referral link and we both get rewards!`);
    const url = encodeURIComponent(referralLink);
    
    const links = {
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      email: `mailto:?subject=Join%20Abu%20Mafhal&body=${text}%20${url}`
    };

    window.open(links[platform], '_blank');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Referral Program</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6">
          <p className="text-sm opacity-90 mb-1">Total Referrals</p>
          <p className="text-4xl font-bold">{stats.totalReferrals}</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6">
          <p className="text-sm opacity-90 mb-1">Successful</p>
          <p className="text-4xl font-bold">{stats.successfulReferrals}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6">
          <p className="text-sm opacity-90 mb-1">Total Earned</p>
          <p className="text-4xl font-bold">₦{stats.totalEarned.toLocaleString()}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-lg p-6">
          <p className="text-sm opacity-90 mb-1">Pending</p>
          <p className="text-4xl font-bold">₦{stats.pendingRewards.toLocaleString()}</p>
        </div>
      </div>

      {/* Referral Link Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Your Referral Link</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Share your unique link and earn ₦{referralReward} for each friend who signs up and makes their first purchase!
        </p>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={referralLink}
            readOnly
            className="flex-1 px-4 py-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
          />
          <button
            onClick={copyToClipboard}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => shareVia('whatsapp')}
            className="flex-1 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
          >
            WhatsApp
          </button>
          <button
            onClick={() => shareVia('facebook')}
            className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
          >
            Facebook
          </button>
          <button
            onClick={() => shareVia('twitter')}
            className="flex-1 px-4 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium"
          >
            Twitter
          </button>
          <button
            onClick={() => shareVia('email')}
            className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium"
          >
            Email
          </button>
        </div>
      </div>

      {/* How it Works */}
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-5xl mb-3">1️⃣</div>
            <h3 className="font-semibold mb-2">Share Your Link</h3>
            <p className="text-sm opacity-90">Send your unique referral link to friends and family</p>
          </div>
          <div className="text-center">
            <div className="text-5xl mb-3">2️⃣</div>
            <h3 className="font-semibold mb-2">They Sign Up</h3>
            <p className="text-sm opacity-90">Your friends register using your link and make their first purchase</p>
          </div>
          <div className="text-center">
            <div className="text-5xl mb-3">3️⃣</div>
            <h3 className="font-semibold mb-2">Earn Rewards</h3>
            <p className="text-sm opacity-90">Get ₦{referralReward} added to your wallet for each successful referral</p>
          </div>
        </div>
      </div>

      {/* Referral History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Referral History</h2>
        {referrals.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-6xl mb-4">👥</p>
            <p className="text-gray-600 dark:text-gray-400">No referrals yet</p>
            <p className="text-sm text-gray-500 mt-2">Start sharing your link to earn rewards!</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">User</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Reward</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map(referral => (
                  <tr key={referral.id} className="border-b dark:border-gray-700">
                    <td className="py-3 px-4">{new Date(referral.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4">{referral.referredUserName || 'New User'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        referral.status === 'completed' ? 'bg-green-100 text-green-800' :
                        referral.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {referral.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold">
                      {referral.status === 'completed' ? `₦${referralReward}` : 'Pending'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Referrals;