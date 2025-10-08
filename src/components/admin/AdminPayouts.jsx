import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, updateDoc, doc, addDoc, orderBy, where } from 'firebase/firestore';
import { db } from '../../config/firebase';

const AdminPayouts = () => {
  const [payouts, setPayouts] = useState([]);
  const [wallets, setWallets] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    fetchPayouts();
  }, []);

  const fetchPayouts = async () => {
    try {
      const payoutsQuery = query(
        collection(db, 'vendorPayouts'),
        orderBy('createdAt', 'desc')
      );
      const payoutsSnapshot = await getDocs(payoutsQuery);
      const payoutsData = payoutsSnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setPayouts(payoutsData);

      // Fetch vendor wallets
      const walletsQuery = query(collection(db, 'vendorWallets'));
      const walletsSnapshot = await getDocs(walletsQuery);
      const walletsData = {};
      walletsSnapshot.docs.forEach(doc => {
        walletsData[doc.id] = doc.data();
      });
      setWallets(walletsData);
    } catch (error) {
      console.error('Error fetching payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayout = async (payout) => {
    if (!window.confirm(`Approve payout of ₦${payout.amount.toLocaleString()} to ${payout.vendorName}?`)) {
      return;
    }

    setProcessingId(payout.id);

    try {
      // Update payout status
      await updateDoc(doc(db, 'vendorPayouts', payout.id), {
        status: 'completed',
        processedAt: new Date().toISOString(),
        processedBy: 'admin'
      });

      // Update vendor wallet
      const wallet = wallets[payout.vendorId] || { balance: 0, pendingPayouts: 0, totalPayouts: 0 };
      await updateDoc(doc(db, 'vendorWallets', payout.vendorId), {
        balance: (wallet.balance || 0) - payout.amount,
        pendingPayouts: (wallet.pendingPayouts || 0) - payout.amount,
        totalPayouts: (wallet.totalPayouts || 0) + payout.amount,
        updatedAt: new Date().toISOString()
      });

      // Add transaction record
      await addDoc(collection(db, 'walletTransactions'), {
        vendorId: payout.vendorId,
        type: 'payout',
        amount: payout.amount,
        description: `Payout approved - ${payout.method}`,
        status: 'completed',
        createdAt: new Date().toISOString()
      });

      alert('Payout approved successfully!');
      fetchPayouts();
    } catch (error) {
      console.error('Error approving payout:', error);
      alert('Failed to approve payout');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectPayout = async (payout) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;

    setProcessingId(payout.id);

    try {
      // Update payout status
      await updateDoc(doc(db, 'vendorPayouts', payout.id), {
        status: 'rejected',
        processedAt: new Date().toISOString(),
        processedBy: 'admin',
        rejectionReason: reason
      });

      // Update vendor wallet - remove from pending
      const wallet = wallets[payout.vendorId] || { pendingPayouts: 0 };
      await updateDoc(doc(db, 'vendorWallets', payout.vendorId), {
        pendingPayouts: (wallet.pendingPayouts || 0) - payout.amount,
        updatedAt: new Date().toISOString()
      });

      alert('Payout rejected');
      fetchPayouts();
    } catch (error) {
      console.error('Error rejecting payout:', error);
      alert('Failed to reject payout');
    } finally {
      setProcessingId(null);
    }
  };

  const viewDetails = (payout) => {
    setSelectedPayout(payout);
    setShowDetailsModal(true);
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

  const filteredPayouts = payouts.filter(payout => {
    if (filterStatus === 'all') return true;
    return payout.status === filterStatus;
  });

  const stats = {
    total: payouts.length,
    pending: payouts.filter(p => p.status === 'pending').length,
    completed: payouts.filter(p => p.status === 'completed').length,
    rejected: payouts.filter(p => p.status === 'rejected').length,
    totalAmount: payouts
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + (p.amount || 0), 0),
    pendingAmount: payouts
      .filter(p => p.status === 'pending')
      .reduce((sum, p) => sum + (p.amount || 0), 0)
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Payout Management</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Payouts</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg shadow p-6">
          <p className="text-sm text-yellow-700 dark:text-yellow-400 mb-1">Pending</p>
          <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">{stats.pending}</p>
          <p className="text-xs text-yellow-600 mt-1">₦{stats.pendingAmount.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg shadow p-6">
          <p className="text-sm text-green-700 dark:text-green-400 mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-800 dark:text-green-300">{stats.completed}</p>
          <p className="text-xs text-green-600 mt-1">₦{stats.totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg shadow p-6">
          <p className="text-sm text-red-700 dark:text-red-400 mb-1">Rejected</p>
          <p className="text-2xl font-bold text-red-800 dark:text-red-300">{stats.rejected}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="all">All Payouts</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Payouts Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700">
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-left py-3 px-4">Vendor</th>
              <th className="text-left py-3 px-4">Amount</th>
              <th className="text-left py-3 px-4">Method</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPayouts.map(payout => (
              <tr key={payout.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="py-3 px-4">
                  {new Date(payout.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <p className="font-medium">{payout.vendorName}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{payout.vendorEmail}</p>
                </td>
                <td className="py-3 px-4">
                  <p className="font-bold text-lg">₦{payout.amount?.toLocaleString()}</p>
                </td>
                <td className="py-3 px-4 capitalize">
                  {payout.method}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(payout.status)}`}>
                    {payout.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => viewDetails(payout)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                    >
                      View
                    </button>
                    {payout.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprovePayout(payout)}
                          disabled={processingId === payout.id}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded disabled:bg-gray-400"
                        >
                          {processingId === payout.id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleRejectPayout(payout)}
                          disabled={processingId === payout.id}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded disabled:bg-gray-400"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredPayouts.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-600 dark:text-gray-400">No payouts found</p>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedPayout && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Payout Details</h2>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Vendor Name</p>
                  <p className="font-medium">{selectedPayout.vendorName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
                  <p className="font-medium">{selectedPayout.vendorEmail}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Amount</p>
                  <p className="text-2xl font-bold text-green-600">₦{selectedPayout.amount?.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Method</p>
                  <p className="font-medium capitalize">{selectedPayout.method}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Request Date</p>
                  <p className="font-medium">{new Date(selectedPayout.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedPayout.status)}`}>
                    {selectedPayout.status}
                  </span>
                </div>
              </div>

              {selectedPayout.bankDetails && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">Bank Details</h3>
                  <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Account Name</p>
                      <p className="font-medium">{selectedPayout.bankDetails.accountName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Account Number</p>
                      <p className="font-medium font-mono">{selectedPayout.bankDetails.accountNumber}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Bank Name</p>
                      <p className="font-medium">{selectedPayout.bankDetails.bankName}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Account Type</p>
                      <p className="font-medium capitalize">{selectedPayout.bankDetails.accountType}</p>
                    </div>
                  </div>
                </div>
              )}

              {selectedPayout.processedAt && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Processed Date</p>
                  <p className="font-medium">{new Date(selectedPayout.processedAt).toLocaleString()}</p>
                </div>
              )}

              {selectedPayout.rejectionReason && (
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">Rejection Reason</p>
                  <p className="font-medium text-red-600">{selectedPayout.rejectionReason}</p>
                </div>
              )}

              {selectedPayout.status === 'pending' && (
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => {
                      handleApprovePayout(selectedPayout);
                      setShowDetailsModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
                  >
                    Approve Payout
                  </button>
                  <button
                    onClick={() => {
                      handleRejectPayout(selectedPayout);
                      setShowDetailsModal(false);
                    }}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium"
                  >
                    Reject Payout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayouts;