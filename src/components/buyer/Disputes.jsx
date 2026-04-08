import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
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
      const { data: disputesList, error } = await supabase
        .from('disputes')
        .select('*')
        .eq('buyer_id', currentUser.id || currentUser.uid)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDisputes(disputesList || []);
    } catch (error) {
      console.error('Error fetching disputes:', error.message);
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
                    Order #{dispute.order_id || dispute.orderId}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-2">
                    {dispute.reason || dispute.subject}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Created: {new Date(dispute.created_at || dispute.createdAt).toLocaleDateString()}
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