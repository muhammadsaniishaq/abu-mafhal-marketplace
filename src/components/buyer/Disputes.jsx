import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import Loader from '../common/Loader';

const Disputes = () => {
  const { currentUser } = useAuth();
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDisputes();
  }, [currentUser]);

  const fetchDisputes = async () => {
    try {
      const q = query(
        collection(db, 'disputes'),
        where('buyerId', '==', currentUser.uid)
      );
      const snapshot = await getDocs(q);
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

  if (loading) return <Loader />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        My Disputes
      </h1>

      {disputes.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No disputes found
        </div>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <div
              key={dispute.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg">
                    Order #{dispute.orderId}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    {dispute.reason}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Created: {dispute.createdAt?.toDate().toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  dispute.status === 'resolved' 
                    ? 'bg-green-100 text-green-800'
                    : dispute.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {dispute.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Disputes;