import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import Loader from '../common/Loader';

const Payouts = () => {
  const { currentUser } = useAuth();
  const [payouts, setPayouts] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayouts();
  }, [currentUser]);

  const fetchPayouts = async () => {
    try {
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('vendor_payouts')
        .select('*')
        .eq('vendor_id', currentUser.id || currentUser.uid);

      if (payoutsError) throw payoutsError;
      
      const payoutsList = payoutsData || [];
      setPayouts(payoutsList);

      // Calculate available balance
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, total')
        .eq('vendor_id', currentUser.id || currentUser.uid)
        .eq('status', 'completed');

      if (ordersError) throw ordersError;
      
      let totalEarnings = 0;
      (ordersData || []).forEach(order => {
        totalEarnings += (order.total_amount || order.total || 0);
      });

      const totalPaidOut = payoutsList.reduce((sum, payout) => sum + (payout.amount || 0), 0);
      setBalance(totalEarnings - totalPaidOut);

    } catch (error) {
      console.error('Error fetching payouts:', error.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Payouts
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <p className="text-gray-500 text-sm mb-2">Available Balance</p>
        <p className="text-4xl font-bold text-green-600">
          ₦{balance.toLocaleString()}
        </p>
        <button className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Request Payout
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Payout History</h2>
        {payouts.length === 0 ? (
          <p className="text-center py-8 text-gray-500">No payouts yet</p>
        ) : (
          <div className="space-y-4">
            {payouts.map((payout) => (
              <div
                key={payout.id}
                className="flex justify-between items-center border-b pb-4"
              >
                <div>
                  <p className="font-semibold">₦{payout.amount?.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(payout.created_at || payout.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  payout.status === 'completed' 
                    ? 'bg-green-100 text-green-800'
                    : payout.status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {payout.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Payouts;