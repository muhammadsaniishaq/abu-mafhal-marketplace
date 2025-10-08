import React, { useState } from 'react';
import { initializeCryptoPayment } from '../../services/paymentService';
import { useAuth } from '../../context/AuthContext';
import Loader from '../common/Loader';

const CryptoPayment = ({ amount, orderId, onSuccess, onCancel }) => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedCrypto, setSelectedCrypto] = useState('btc');
  const [paymentData, setPaymentData] = useState(null);

  const cryptos = [
    { id: 'btc', name: 'Bitcoin', symbol: 'BTC' },
    { id: 'eth', name: 'Ethereum', symbol: 'ETH' },
    { id: 'usdt', name: 'Tether', symbol: 'USDT' },
    { id: 'bnb', name: 'Binance Coin', symbol: 'BNB' },
  ];

  const handleInitiatePayment = async () => {
    setLoading(true);
    try {
      const result = await initializeCryptoPayment({
        amount,
        currency: selectedCrypto,
        orderId,
        userId: currentUser.uid,
        email: currentUser.email
      });

      setPaymentData(result);
    } catch (error) {
      console.error('Error initiating crypto payment:', error);
      alert('Error initiating payment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Cryptocurrency Payment
      </h2>

      {!paymentData ? (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-3">Select Cryptocurrency</label>
            <div className="grid grid-cols-2 gap-4">
              {cryptos.map((crypto) => (
                <button
                  key={crypto.id}
                  onClick={() => setSelectedCrypto(crypto.id)}
                  className={`p-4 border-2 rounded-lg text-center transition ${
                    selectedCrypto === crypto.id
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-900'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <p className="font-semibold">{crypto.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{crypto.symbol}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <p className="text-lg">
              <span className="text-gray-600 dark:text-gray-400">Amount: </span>
              <span className="font-bold">₦{amount.toLocaleString()}</span>
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleInitiatePayment}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
            >
              Continue with {cryptos.find(c => c.id === selectedCrypto)?.name}
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-6">
          <div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-lg">
            <p className="text-sm font-medium mb-2">Payment Instructions:</p>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Send exactly the amount shown below to the address</li>
              <li>Payment will be confirmed automatically</li>
              <li>Do not close this page until payment is confirmed</li>
            </ol>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Send Amount:</p>
            <p className="text-3xl font-bold mb-4">{paymentData.pay_amount} {paymentData.pay_currency}</p>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">To Address:</p>
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded mb-4 break-all font-mono text-sm">
              {paymentData.pay_address}
            </div>

            <button
              onClick={() => navigator.clipboard.writeText(paymentData.pay_address)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Copy Address
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Payment ID: {paymentData.payment_id}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Status: <span className="font-semibold text-yellow-600">Waiting for payment...</span>
            </p>
          </div>

          <button
            onClick={onCancel}
            className="w-full border border-gray-300 py-3 rounded-lg hover:bg-gray-50"
          >
            Cancel Payment
          </button>
        </div>
      )}
    </div>
  );
};

export default CryptoPayment;