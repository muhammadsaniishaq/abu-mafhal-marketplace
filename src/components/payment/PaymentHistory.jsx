import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import Loader from '../common/Loader';

const PaymentHistory = () => {
  const { currentUser } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetchPayments();
  }, [currentUser]);

  const fetchPayments = async () => {
    try {
      const q = query(
        collection(db, 'payments'),
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      const paymentsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPayments(paymentsList);
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = filter === 'all' 
    ? payments 
    : payments.filter(p => p.status === filter);

  if (loading) return <Loader />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Payment History
      </h1>

      <div className="mb-6 flex gap-2">
        {['all', 'successful', 'pending', 'failed'].map(status => (
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

      {filteredPayments.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No payment history found
        </div>
      ) : (
        <div className="space-y-4">
          {filteredPayments.map((payment) => (
            <div
              key={payment.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">
                      ₦{payment.amount?.toLocaleString()}
                    </h3>
                    <span className={`px-3 py-1 rounded-full text-xs ${
                      payment.status === 'successful' 
                        ? 'bg-green-100 text-green-800'
                        : payment.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {payment.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                    <p>Reference: {payment.reference}</p>
                    <p>Method: {payment.method}</p>
                    <p>Date: {payment.createdAt?.toDate().toLocaleString()}</p>
                    {payment.orderId && <p>Order: #{payment.orderId.slice(0, 8)}</p>}
                  </div>
                </div>

                {payment.method === 'paystack' && (
                  <div className="text-blue-600">💳</div>
                )}
                {payment.method === 'flutterwave' && (
                  <div className="text-orange-600">💳</div>
                )}
                {payment.method === 'crypto' && (
                  <div className="text-yellow-600">₿</div>
                )}
              </div>

              {payment.status === 'failed' && payment.errorMessage && (
                <div className="mt-3 p-3 bg-red-50 dark:bg-red-900 rounded text-sm">
                  <p className="text-red-800 dark:text-red-200">
                    Error: {payment.errorMessage}
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

export default PaymentHistory;