import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const VendorWallet = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState({
    balance: 0,
    totalEarnings: 0,
    pendingPayouts: 0,
    totalPayouts: 0
  });
  const [transactions, setTransactions] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('bank');
  const [bankDetails, setBankDetails] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    accountType: 'savings'
  });
  const [earningsData, setEarningsData] = useState([]);

  const PLATFORM_COMMISSION = 0.10; // 10% platform fee

  useEffect(() => {
    fetchWalletData();
  }, [currentUser]);

  const fetchWalletData = async () => {
    try {
      // Fetch vendor wallet
      const walletDoc = await getDoc(doc(db, 'vendorWallets', currentUser.uid));
      if (walletDoc.exists()) {
        setWallet(walletDoc.data());
      }

      // Fetch transactions
      const transactionsQuery = query(
        collection(db, 'walletTransactions'),
        where('vendorId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      const transactionsData = transactionsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setTransactions(transactionsData);

      // Fetch payouts
      const payoutsQuery = query(
        collection(db, 'vendorPayouts'),
        where('vendorId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const payoutsSnapshot = await getDocs(payoutsQuery);
      const payoutsData = payoutsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setPayouts(payoutsData);

      // Calculate earnings over time
      const earningsByDate = {};
      transactionsData
        .filter(t => t.type === 'sale')
        .forEach(transaction => {
          const date = new Date(transaction.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          earningsByDate[date] = (earningsByDate[date] || 0) + transaction.amount;
        });
      
      const chartData = Object.entries(earningsByDate)
        .map(([date, amount]) => ({ date, amount }))
        .slice(-7); // Last 7 days
      setEarningsData(chartData);

    } catch (error) {
      console.error('Error fetching wallet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async (e) => {
    e.preventDefault();

    const amount = parseFloat(payoutAmount);

    if (amount < 5000) {
      alert('Minimum payout amount is ₦5,000');
      return;
    }

    if (amount > wallet.balance) {
      alert('Insufficient balance');
      return;
    }

    setLoading(true);

    try {
      await addDoc(collection(db, 'vendorPayouts'), {
        vendorId: currentUser.uid,
        vendorName: currentUser.name,
        vendorEmail: currentUser.email,
        amount,
        method: payoutMethod,
        bankDetails: payoutMethod === 'bank' ? bankDetails : null,
        status: 'pending',
        createdAt: new Date().toISOString(),
        processedAt: null
      });

      alert('Payout request submitted successfully! It will be processed within 1-3 business days.');
      setShowPayoutModal(false);
      setPayoutAmount('');
      fetchWalletData();
    } catch (error) {
      console.error('Error requesting payout:', error);
      alert('Failed to submit payout request');
    } finally {
      setLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    const icons = {
      sale: '💰',
      payout: '📤',
      refund: '↩️',
      commission: '💸'
    };
    return icons[type] || '📄';
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      processing: 'bg-blue-100 text-blue-800 border-blue-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Vendor Wallet</h1>

      {/* Wallet Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-lg p-6">
          <p className="text-sm opacity-90 mb-1">Available Balance</p>
          <p className="text-3xl font-bold">₦{wallet.balance?.toLocaleString()}</p>
          <button
            onClick={() => setShowPayoutModal(true)}
            className="mt-3 text-sm bg-white/20 hover:bg-white/30 px-4 py-1 rounded-full transition"
          >
            Request Payout
          </button>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-lg p-6">
          <p className="text-sm opacity-90 mb-1">Total Earnings</p>
          <p className="text-3xl font-bold">₦{wallet.totalEarnings?.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">All-time revenue</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-lg p-6">
          <p className="text-sm opacity-90 mb-1">Pending Payouts</p>
          <p className="text-3xl font-bold">₦{wallet.pendingPayouts?.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">Being processed</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-lg p-6">
          <p className="text-sm opacity-90 mb-1">Total Withdrawn</p>
          <p className="text-3xl font-bold">₦{wallet.totalPayouts?.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-2">Successfully paid out</p>
        </div>
      </div>

      {/* Earnings Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Earnings Overview (Last 7 Days)</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={earningsData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Payout Requests */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Payout History</h2>
        {payouts.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-6xl mb-4">💸</p>
            <p className="text-gray-600 dark:text-gray-400">No payout requests yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Amount</th>
                  <th className="text-left py-3 px-4">Method</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Processed</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map(payout => (
                  <tr key={payout.id} className="border-b dark:border-gray-700">
                    <td className="py-3 px-4">{new Date(payout.createdAt).toLocaleDateString()}</td>
                    <td className="py-3 px-4 font-semibold">₦{payout.amount?.toLocaleString()}</td>
                    <td className="py-3 px-4 capitalize">{payout.method}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(payout.status)}`}>
                        {payout.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm">
                      {payout.processedAt ? new Date(payout.processedAt).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Transaction History</h2>
        {transactions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-6xl mb-4">📊</p>
            <p className="text-gray-600 dark:text-gray-400">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map(transaction => (
              <div key={transaction.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">{getTransactionIcon(transaction.type)}</span>
                  <div>
                    <p className="font-medium capitalize">{transaction.type}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{transaction.description}</p>
                    <p className="text-xs text-gray-500">{new Date(transaction.createdAt).toLocaleString()}</p>
                  </div>
                </div>
                <p className={`text-lg font-bold ${transaction.type === 'payout' || transaction.type === 'commission' ? 'text-red-600' : 'text-green-600'}`}>
                  {transaction.type === 'payout' || transaction.type === 'commission' ? '-' : '+'}₦{transaction.amount?.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payout Request Modal */}
      {showPayoutModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Request Payout</h2>
              <button 
                onClick={() => setShowPayoutModal(false)}
                className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full"
              >
                ×
              </button>
            </div>

            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-400">
                Available Balance: <span className="font-bold">₦{wallet.balance?.toLocaleString()}</span>
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-500 mt-1">
                Minimum payout: ₦5,000 • Processing time: 1-3 business days
              </p>
            </div>

            <form onSubmit={handleRequestPayout} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Payout Amount</label>
                <input
                  type="number"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  required
                  min="5000"
                  max={wallet.balance}
                  step="100"
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  placeholder="Enter amount"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Payout Method</label>
                <select
                  value={payoutMethod}
                  onChange={(e) => setPayoutMethod(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                >
                  <option value="bank">Bank Transfer</option>
                  <option value="paystack">Paystack</option>
                  <option value="mobile">Mobile Money</option>
                </select>
              </div>

              {payoutMethod === 'bank' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Account Name</label>
                    <input
                      type="text"
                      value={bankDetails.accountName}
                      onChange={(e) => setBankDetails({...bankDetails, accountName: e.target.value})}
                      required
                      className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Account Number</label>
                    <input
                      type="text"
                      value={bankDetails.accountNumber}
                      onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})}
                      required
                      maxLength="10"
                      className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Bank Name</label>
                    <select
                      value={bankDetails.bankName}
                      onChange={(e) => setBankDetails({...bankDetails, bankName: e.target.value})}
                      required
                      className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    >
                      <option value="">Select Bank</option>
                      <option value="Access Bank">Access Bank</option>
                      <option value="GTBank">GTBank</option>
                      <option value="First Bank">First Bank</option>
                      <option value="UBA">UBA</option>
                      <option value="Zenith Bank">Zenith Bank</option>
                      <option value="Stanbic IBTC">Stanbic IBTC</option>
                      <option value="Sterling Bank">Sterling Bank</option>
                      <option value="Fidelity Bank">Fidelity Bank</option>
                      <option value="Union Bank">Union Bank</option>
                      <option value="Polaris Bank">Polaris Bank</option>
                      <option value="Ecobank">Ecobank</option>
                      <option value="FCMB">FCMB</option>
                      <option value="Wema Bank">Wema Bank</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Account Type</label>
                    <select
                      value={bankDetails.accountType}
                      onChange={(e) => setBankDetails({...bankDetails, accountType: e.target.value})}
                      className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    >
                      <option value="savings">Savings</option>
                      <option value="current">Current</option>
                    </select>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400"
              >
                {loading ? 'Processing...' : 'Request Payout'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorWallet;