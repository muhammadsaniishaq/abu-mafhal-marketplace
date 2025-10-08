import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { addDisputeMessage } from '../../services/disputeService';

const VendorDisputes = () => {
  const { currentUser } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [message, setMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchDisputes();
  }, [currentUser]);

  const fetchDisputes = async () => {
    try {
      const q = query(
        collection(db, 'disputes'),
        where('vendorId', '==', currentUser.uid)
      );
      const snapshot = await getDocs(q);
      const disputesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      disputesData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setDisputes(disputesData);
    } catch (error) {
      console.error('Error fetching disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshSelectedDispute = async () => {
    if (!selectedDispute) return;
    try {
      const disputeDoc = await getDoc(doc(db, 'disputes', selectedDispute.id));
      if (disputeDoc.exists()) {
        setSelectedDispute({ id: disputeDoc.id, ...disputeDoc.data() });
      }
    } catch (error) {
      console.error('Error refreshing dispute:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    try {
      await addDisputeMessage(selectedDispute.id, message, currentUser.uid, 'vendor');
      setMessage('');
      await refreshSelectedDispute();
      fetchDisputes();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const filteredDisputes = disputes.filter(d => {
    if (filterStatus === 'all') return true;
    return d.status === filterStatus;
  });

  const getStatusColor = (status) => {
    const colors = {
      open: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400',
      investigating: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400',
      resolved: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-400',
      rejected: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-400'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Disputes Against Your Products</h1>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
          <p className="text-2xl font-bold">{disputes.length}</p>
        </div>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">Open</p>
          <p className="text-2xl font-bold text-yellow-800 dark:text-yellow-300">
            {disputes.filter(d => d.status === 'open').length}
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-blue-700 dark:text-blue-400">Investigating</p>
          <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
            {disputes.filter(d => d.status === 'investigating').length}
          </p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 shadow">
          <p className="text-sm text-green-700 dark:text-green-400">Resolved</p>
          <p className="text-2xl font-bold text-green-800 dark:text-green-300">
            {disputes.filter(d => d.status === 'resolved').length}
          </p>
        </div>
      </div>

      {/* Filter */}
      <select
        value={filterStatus}
        onChange={(e) => setFilterStatus(e.target.value)}
        className="mb-6 px-4 py-2 border rounded-lg dark:bg-gray-700"
      >
        <option value="all">All Disputes</option>
        <option value="open">Open</option>
        <option value="investigating">Investigating</option>
        <option value="resolved">Resolved</option>
      </select>

      {/* Disputes List */}
      {filteredDisputes.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-lg">
          <p className="text-6xl mb-4">⚖️</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No disputes</h2>
          <p className="text-gray-600 dark:text-gray-400">Keep providing excellent service!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDisputes.map(dispute => (
            <div key={dispute.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    {dispute.subject}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Dispute #{dispute.id.substring(0, 8)} • Order #{dispute.orderId?.substring(0, 8)}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Category: <span className="capitalize">{dispute.category?.replace('_', ' ')}</span>
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(dispute.status)}`}>
                  {dispute.status.charAt(0).toUpperCase() + dispute.status.slice(1)}
                </span>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  <span className="font-medium">Issue:</span> {dispute.description}
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-medium">Buyer wants:</span> {dispute.desiredResolution}
                </p>
              </div>

              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  Filed on {new Date(dispute.createdAt).toLocaleDateString()} by {dispute.buyerName}
                </div>
                <button
                  onClick={() => {
                    setSelectedDispute(dispute);
                    setShowDetailsModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
                >
                  Respond
                </button>
              </div>

              {dispute.resolution && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border-l-4 border-green-500">
                  <p className="text-sm font-medium mb-1">Resolution:</p>
                  <p className="text-sm capitalize">
                    Decided in favor of: {dispute.resolution.decision?.replace('_', ' ')}
                  </p>
                  {dispute.resolution.notes && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {dispute.resolution.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedDispute && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b p-6 flex justify-between items-center z-10">
              <div>
                <h2 className="text-2xl font-bold">Dispute Response</h2>
                <p className="text-sm text-gray-600">#{selectedDispute.id.substring(0, 8)}</p>
              </div>
              <button 
                onClick={() => {
                  setShowDetailsModal(false);
                  setMessage('');
                }}
                className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full"
              >
                ×
              </button>
            </div>

            <div className="p-6">
              {/* Dispute Details */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Dispute Information</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-gray-600 dark:text-gray-400">Subject:</span> <span className="font-medium">{selectedDispute.subject}</span></p>
                  <p><span className="text-gray-600 dark:text-gray-400">Category:</span> <span className="font-medium capitalize">{selectedDispute.category?.replace('_', ' ')}</span></p>
                  <p><span className="text-gray-600 dark:text-gray-400">Order Value:</span> <span className="font-medium">₦{selectedDispute.orderTotal?.toLocaleString()}</span></p>
                  <p><span className="text-gray-600 dark:text-gray-400">Filed:</span> <span className="font-medium">{new Date(selectedDispute.createdAt).toLocaleString()}</span></p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold mb-2">Issue Description</h3>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-sm">{selectedDispute.description}</p>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="font-semibold mb-2">Desired Resolution</h3>
                <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <p className="text-sm">{selectedDispute.desiredResolution}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="mb-6">
                <h3 className="font-semibold mb-3">Communication</h3>
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto space-y-3">
                  {selectedDispute.messages && selectedDispute.messages.length > 0 ? (
                    selectedDispute.messages.map(msg => (
                      <div key={msg.id} className={`p-3 rounded-lg ${
                        msg.senderRole === 'admin' 
                          ? 'bg-blue-50 dark:bg-blue-900/20' 
                          : msg.senderRole === 'vendor'
                          ? 'bg-green-50 dark:bg-green-900/20 ml-4'
                          : 'bg-gray-50 dark:bg-gray-900 mr-4'
                      }`}>
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-medium capitalize">{msg.senderRole}</span>
                          <span className="text-xs text-gray-500">
                            {new Date(msg.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm">{msg.message}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 text-center py-4">No messages yet</p>
                  )}
                </div>

                {/* Send Message */}
                {selectedDispute.status !== 'resolved' && selectedDispute.status !== 'rejected' && (
                  <div className="mt-3">
                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-3 border border-yellow-200 dark:border-yellow-800">
                      <p className="text-xs text-yellow-800 dark:text-yellow-400">
                        💡 Tip: Provide detailed explanations and any evidence that supports your case. Be professional and factual.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Type your response..."
                        className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700"
                        onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      />
                      <button
                        onClick={handleSendMessage}
                        className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                      >
                        Send
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Resolution Display */}
              {selectedDispute.resolution && (
                <div className="border-t pt-6">
                  <h3 className="font-semibold mb-4">Final Resolution</h3>
                  <div className={`p-4 rounded-lg ${
                    selectedDispute.resolution.decision === 'vendor_favor' 
                      ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
                      : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                  }`}>
                    <p className="text-sm mb-2">
                      <span className="font-medium">Decision:</span> 
                      <span className="ml-2 capitalize font-bold">
                        {selectedDispute.resolution.decision?.replace('_', ' ')}
                      </span>
                    </p>
                    {selectedDispute.resolution.refundAmount > 0 && (
                      <p className="text-sm mb-2">
                        <span className="font-medium">Refund Amount:</span> 
                        <span className="ml-2">₦{selectedDispute.resolution.refundAmount?.toLocaleString()}</span>
                      </p>
                    )}
                    <p className="text-sm mb-2">
                      <span className="font-medium">Admin Notes:</span> 
                      <span className="ml-2">{selectedDispute.resolution.notes}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-3">
                      Resolved on {new Date(selectedDispute.resolution.resolvedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorDisputes;