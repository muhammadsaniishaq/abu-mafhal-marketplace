// src/components/buyer/Wallet.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatCurrency, formatDateTime } from '../../utils/helpers';

const Wallet = () => {
  const { currentUser } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWalletData();
  }, [currentUser]);

  const fetchWalletData = async () => {
    try {
      // Fetch wallet balance
      const walletDoc = await getDocs(query(
        collection(db, 'wallets'),
        where('userId', '==', currentUser.uid),
        limit(1)
      ));
      
      if (!walletDoc.empty) {
        setBalance(walletDoc.docs[0].data().balance || 0);
      }

      // Fetch transactions
      const txQuery = query(
        collection(db, 'wallets', currentUser.uid, 'transactions'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const txSnap = await getDocs(txQuery);
      setTransactions(txSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">My Wallet</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage your wallet and transactions</p>
      </div>

      {/* Balance Card */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-8 text-white mb-6">
        <p className="text-sm opacity-90 mb-2">Available Balance</p>
        <p className="text-4xl font-bold mb-6">{formatCurrency(balance)}</p>
        <div className="flex space-x-4">
          <button className="px-6 py-2 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100">
            Add Money
          </button>
          <button className="px-6 py-2 bg-transparent border-2 border-white rounded-lg font-semibold hover:bg-white hover:text-blue-600">
            Withdraw
          </button>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
          Transaction History
        </h2>

        {transactions.length === 0 ? (
          <p className="text-center text-gray-600 dark:text-gray-400 py-8">
            No transactions yet
          </p>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between py-4 border-b dark:border-gray-700 last:border-0">
                <div className="flex items-center space-x-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    tx.type === 'credit' ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'
                  }`}>
                    <span className="text-2xl">
                      {tx.type === 'credit' ? '↓' : '↑'}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-white">
                      {tx.description || tx.type}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatDateTime(tx.createdAt)}
                    </p>
                  </div>
                </div>
                <p className={`text-lg font-bold ${
                  tx.type === 'credit' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Wallet;