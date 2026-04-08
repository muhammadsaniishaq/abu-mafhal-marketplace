import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
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
      const { data, error } = await supabase
        .from('disputes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDisputes(data || []);
    } catch (error) {
      console.error('Error fetching disputes:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (disputeId, resolution) => {
    try {
      const { error } = await supabase
        .from('disputes')
        .update({
          status: 'resolved',
          resolution,
          resolved_at: new Date().toISOString()
        })
        .eq('id', disputeId);

      if (error) throw error;
      
      alert('Dispute resolved successfully!');
      fetchDisputes();
    } catch (error) {
      console.error('Error resolving dispute:', error.message);
      alert('Error resolving dispute');
    }
  };

  const filteredDisputes = filter === 'all' 
    ? disputes 
    : disputes.filter(d => d.status === filter);

  if (loading) return <Loader />;

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Dispute Resolution
      </h1>

      <div className="mb-6 flex flex-wrap gap-2">
        {['all', 'pending', 'investigating', 'resolved'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {filteredDisputes.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white dark:bg-gray-800 rounded-lg shadow">
          No disputes found
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDisputes.map((dispute) => (
            <div key={dispute.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                    Dispute #{typeof dispute.id === 'string' ? dispute.id.slice(0, 8) : dispute.id}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Order: {dispute.order_id || dispute.orderId} | Created: {formatDate(dispute.created_at || dispute.createdAt)}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  dispute.status === 'resolved' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                    : dispute.status === 'investigating'
                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                }`}>
                  {dispute.status}
                </span>
              </div>

              <div className="mb-4">
                <p className="font-medium text-gray-700 dark:text-gray-300">Reason:</p>
                <p className="text-gray-600 dark:text-gray-400">{dispute.reason}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Buyer:</p>
                  <p className="text-gray-600 dark:text-gray-400">{dispute.buyer_name || dispute.buyerName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Vendor:</p>
                  <p className="text-gray-600 dark:text-gray-400">{dispute.vendor_name || dispute.vendorName}</p>
                </div>
              </div>

              {dispute.status !== 'resolved' && (
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    onClick={() => handleResolve(dispute.id, 'Refunded to buyer')}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Resolve - Refund Buyer
                  </button>
                  <button
                    onClick={() => handleResolve(dispute.id, 'Favor vendor')}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Resolve - Favor Vendor
                  </button>
                </div>
              )}

              {dispute.resolution && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-100 dark:border-green-800">
                  <p className="text-sm font-medium text-green-800 dark:text-green-300">Resolution:</p>
                  <p className="text-sm text-green-700 dark:text-green-400">{dispute.resolution}</p>
                  <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                    Resolved on: {formatDate(dispute.resolved_at || dispute.resolvedAt)}
                  </p>
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