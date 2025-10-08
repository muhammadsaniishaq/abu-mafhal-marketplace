import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Loader from '../common/Loader';

const DisputeResolution = () => {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchDisputes();
  }, []);

  const fetchDisputes = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'disputes'));
      const disputesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDisputes(disputesList);
    } catch (error) {
      console.error('Error fetching disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (disputeId, resolution) => {
    try {
      await updateDoc(doc(db, 'disputes', disputeId), {
        status: 'resolved',
        resolution,
        resolvedAt: new Date()
      });
      alert('Dispute resolved successfully!');
      fetchDisputes();
    } catch (error) {
      console.error('Error resolving dispute:', error);
      alert('Error resolving dispute');
    }
  };

  const filteredDisputes = filter === 'all' 
    ? disputes 
    : disputes.filter(d => d.status === filter);

  if (loading) return <Loader />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Dispute Resolution
      </h1>

      <div className="mb-6 flex gap-2">
        {['all', 'pending', 'investigating', 'resolved'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {filteredDisputes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No disputes found
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDisputes.map((dispute) => (
            <div key={dispute.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">Dispute #{dispute.id.slice(0, 8)}</h3>
                  <p className="text-sm text-gray-500">
                    Order: {dispute.orderId} | Created: {dispute.createdAt?.toDate().toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  dispute.status === 'resolved' 
                    ? 'bg-green-100 text-green-800'
                    : dispute.status === 'investigating'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {dispute.status}
                </span>
              </div>

              <div className="mb-4">
                <p className="font-medium">Reason:</p>
                <p className="text-gray-600 dark:text-gray-400">{dispute.reason}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium">Buyer:</p>
                  <p className="text-gray-600 dark:text-gray-400">{dispute.buyerName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Vendor:</p>
                  <p className="text-gray-600 dark:text-gray-400">{dispute.vendorName}</p>
                </div>
              </div>

              {dispute.status !== 'resolved' && (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleResolve(dispute.id, 'Refunded to buyer')}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Resolve - Refund Buyer
                  </button>
                  <button
                    onClick={() => handleResolve(dispute.id, 'Favor vendor')}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Resolve - Favor Vendor
                  </button>
                </div>
              )}

              {dispute.resolution && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900 rounded">
                  <p className="text-sm font-medium">Resolution:</p>
                  <p className="text-sm">{dispute.resolution}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DisputeResolution;