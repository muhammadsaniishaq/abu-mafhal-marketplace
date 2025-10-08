import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  handlePaystackPopup,
  handleFlutterwavePopup,
  initializeCryptoPayment
} from '../../services/paymentService';
import CryptoPayment from './CryptoPayment';

const PaymentGateway = ({ amount, orderId, onSuccess, onCancel }) => {
  const { currentUser } = useAuth();
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [showCryptoPayment, setShowCryptoPayment] = useState(false);

  const handlePaystackPayment = () => {
    handlePaystackPopup(
      currentUser.email,
      amount,
      (response) => {
        onSuccess({
          method: 'paystack',
          reference: response.reference,
          status: 'successful'
        });
      },
      () => {
        console.log('Payment closed');
      }
    );
  };

  const handleFlutterwavePayment = () => {
    handleFlutterwavePopup(
      currentUser.email,
      amount,
      currentUser.displayName || 'Customer',
      (response) => {
        onSuccess({
          method: 'flutterwave',
          reference: response.transaction_id,
          status: 'successful'
        });
      },
      () => {
        console.log('Payment closed');
      }
    );
  };

  const handleCryptoPaymentSuccess = (paymentData) => {
    onSuccess({
      method: 'crypto',
      reference: paymentData.payment_id,
      status: 'successful'
    });
  };

  if (showCryptoPayment) {
    return (
      <CryptoPayment
        amount={amount}
        orderId={orderId}
        onSuccess={handleCryptoPaymentSuccess}
        onCancel={() => setShowCryptoPayment(false)}
      />
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Select Payment Method
      </h2>

      <div className="space-y-4">
        {/* Paystack */}
        <button
          onClick={handlePaystackPayment}
          className="w-full p-6 border-2 border-gray-300 rounded-lg hover:border-blue-600 transition text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Paystack
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pay with Card, Bank Transfer, or USSD
              </p>
            </div>
            <div className="text-3xl">💳</div>
          </div>
        </button>

        {/* Flutterwave */}
        <button
          onClick={handleFlutterwavePayment}
          className="w-full p-6 border-2 border-gray-300 rounded-lg hover:border-blue-600 transition text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Flutterwave
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pay with Card, Bank Transfer, or Mobile Money
              </p>
            </div>
            <div className="text-3xl">💰</div>
          </div>
        </button>

        {/* Cryptocurrency */}
        <button
          onClick={() => setShowCryptoPayment(true)}
          className="w-full p-6 border-2 border-gray-300 rounded-lg hover:border-blue-600 transition text-left"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Cryptocurrency
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pay with Bitcoin, Ethereum, USDT, or other crypto
              </p>
            </div>
            <div className="text-3xl">₿</div>
          </div>
        </button>
      </div>

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900 rounded-lg">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <strong>Amount to pay:</strong> ₦{amount.toLocaleString()}
        </p>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full mt-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
      )}
    </div>
  );
};

export default PaymentGateway;