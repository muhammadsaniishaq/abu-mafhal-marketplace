import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getDisputes, updateDisputeStatus, addDisputeMessage } from '../../services/disputeService';

const AdminDisputes = () => {
  const { currentUser } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');
  const [resolution, setResolution] = useState('');

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      const data = await getDisputes(null, 'admin');
      setDisputes(data);
    } catch (error) {
      console.error('Error fetching disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim()) return;

    try {
      await addDisputeMessage(selectedDispute.id, message, currentUser.uid, 'admin');
      setMessage('');
      fetchDisputes();
      // Refresh selected dispute
      const updated = disputes.find(d => d.id === selectedDispute.id);
      setSelectedDispute(updated);
    } catch (error) {
      alert('Failed to send message');
    }
  };

  const handleResolve = async (disputeId) => {
    if (!window.confirm('Are you sure you want to resolve this dispute?')) return;

    try {
      await updateDisputeStatus(disputeId, 'resolved', resolution);
      alert('Dispute resolved successfully!');
      setShowModal(false);
      setResolution('');
      fetchDisputes();
    } catch (error) {
      alert('Failed to resolve dispute');
    }
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
      <h1 className="text-3xl font-bold mb-6">Disputes Management</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left py-3 px-4">Dispute ID</th>
              <th className="text-left py-3 px-4">Order ID</th>
              <th className="text-left py-3 px-4">User</th>
              <th className="text-left py-3 px-4">Reason</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {disputes.map(dispute => (
              <tr key={dispute.id} className="border-b dark:border-gray-700">
                <td className="py-3 px-4">#{dispute.id.substring(0, 8)}</td>
                <td className="py-3 px-4">#{dispute.orderId?.substring(0, 8)}</td>
                <td className="py-3 px-4">{dispute.userName}</td>
                <td className="py-3 px-4">{dispute.reason}</td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    dispute.status === 'resolved' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {dispute.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <button
                    onClick={() => {
                      setSelectedDispute(dispute);
                      setShowModal(true);
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {disputes.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-600">No disputes found</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && selectedDispute && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Dispute Details</h2>
            
            <div className="mb-4">
              <p><strong>Reason:</strong> {selectedDispute.reason}</p>
              <p><strong>Description:</strong> {selectedDispute.description}</p>
            </div>

            <div className="mb-4 max-h-60 overflow-y-auto space-y-2">
              {selectedDispute.messages?.map((msg, idx) => (
                <div key={idx} className={`p-3 rounded ${
                  msg.senderRole === 'admin' ? 'bg-blue-50 ml-8' : 'bg-gray-50 mr-8'
                }`}>
                  <p className="text-sm font-semibold">{msg.senderRole === 'admin' ? 'Admin' : 'User'}</p>
                  <p>{msg.message}</p>
                </div>
              ))}
            </div>

            {selectedDispute.status !== 'resolved' && (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg mb-2"
                  placeholder="Type your message..."
                  rows="3"
                />
                <button
                  onClick={handleSendMessage}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg mb-4"
                >
                  Send Message
                </button>

                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg mb-2"
                  placeholder="Resolution notes..."
                  rows="2"
                />
                <button
                  onClick={() => handleResolve(selectedDispute.id)}
                  className="w-full bg-green-600 text-white py-2 rounded-lg"
                >
                  Resolve Dispute
                </button>
              </>
            )}

            <button
              onClick={() => setShowModal(false)}
              className="w-full mt-4 bg-gray-200 py-2 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDisputes;