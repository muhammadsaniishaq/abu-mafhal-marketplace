// ============================================
// CHECKOUT PAGE - src/pages/CheckoutPage.jsx
// ============================================
// NOTE: Renamed to CheckoutPage to avoid conflict with existing Checkout component
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { CreditCard, Wallet, Bitcoin, Lock, CheckCircle } from 'lucide-react';
import { usePaystackPayment } from 'react-paystack';
import { useFlutterwave, closePaymentModal } from 'flutterwave-react-v3';

import { supabase } from '../config/supabase';

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();
  const { currentUser } = useAuth();

  // Helper to parse price reliably
  const parsePrice = (price) => {
    if (typeof price === 'number') return price;
    if (!price) return 0;
    return parseFloat(price.toString().replace(/[^\d.]/g, '')) || 0;
  };

  const [paymentMethod, setPaymentMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  // ... (rest of states and calculations)

  // Complete order and save to database
  const completeOrder = async (transactionId, method) => {
    try {
      setLoading(true);

      // 1. Insert into orders table
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          buyer_id: currentUser?.uid || currentUser?.id,
          status: 'pending',
          total_amount: finalTotal,
          payment_method: method,
          transaction_id: transactionId,
          shipping_address: JSON.stringify(shippingInfo),
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (orderError) throw orderError;

      // 2. Insert into order_items table
      const itemsToInsert = cartItems.map(item => ({
        order_id: orderData.id,
        product_id: item.id,
        quantity: item.quantity || 1,
        price: parsePrice(item.price)
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      console.log('Order successfully synced to Supabase:', orderData);

      clearCart();
      setOrderPlaced(true);

      setTimeout(() => {
        navigate('/buyer/orders', { state: { success: true, orderId: orderData.id } });
      }, 2000);

    } catch (error) {
      console.error('Error completing order:', error);
      alert('Failed to complete order. Please contact support. Error: ' + (error.message || 'Unknown error'));
      setLoading(false);
    }
  };

  // Handle checkout submission
  const handleCheckout = () => {
    if (!validateForm()) return;

    setLoading(true);

    switch (paymentMethod) {
      case 'paystack':
        handlePaystackPayment();
        break;
      case 'flutterwave':
        handleFlutterwavePayment();
        break;
      case 'nowpayments':
        handleNOWPayment();
        break;
      default:
        alert('Please select a payment method');
        setLoading(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Placed Successfully!</h2>
          <p className="text-gray-600">Redirecting to order details...</p>
        </div>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Your cart is empty</h2>
          <button
            onClick={() => navigate('/shop')}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Checkout</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Information */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Shipping Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  name="fullName"
                  placeholder="Full Name *"
                  value={shippingInfo.fullName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  type="email"
                  name="email"
                  placeholder="Email *"
                  value={shippingInfo.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  type="tel"
                  name="phone"
                  placeholder="Phone Number *"
                  value={shippingInfo.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  type="text"
                  name="city"
                  placeholder="City *"
                  value={shippingInfo.city}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  type="text"
                  name="state"
                  placeholder="State *"
                  value={shippingInfo.state}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  type="text"
                  name="zipCode"
                  placeholder="Zip Code"
                  value={shippingInfo.zipCode}
                  onChange={handleInputChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <input
                  type="text"
                  name="address"
                  placeholder="Street Address *"
                  value={shippingInfo.address}
                  onChange={handleInputChange}
                  className="col-span-full w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Payment Method</h2>

              <div className="space-y-3">
                {/* Paystack */}
                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${paymentMethod === 'paystack' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input
                    type="radio"
                    name="payment"
                    value="paystack"
                    checked={paymentMethod === 'paystack'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <CreditCard className="w-6 h-6 ml-3 text-blue-600" />
                  <div className="ml-3">
                    <p className="font-semibold">Paystack</p>
                    <p className="text-sm text-gray-600">Pay with Card, Bank Transfer, USSD</p>
                  </div>
                </label>

                {/* Flutterwave */}
                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${paymentMethod === 'flutterwave' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input
                    type="radio"
                    name="payment"
                    value="flutterwave"
                    checked={paymentMethod === 'flutterwave'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-4 h-4 text-orange-600"
                  />
                  <Wallet className="w-6 h-6 ml-3 text-orange-600" />
                  <div className="ml-3">
                    <p className="font-semibold">Flutterwave</p>
                    <p className="text-sm text-gray-600">Card, Mobile Money, Bank Transfer</p>
                  </div>
                </label>

                {/* NOWPayments (Crypto) */}
                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${paymentMethod === 'nowpayments' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input
                    type="radio"
                    name="payment"
                    value="nowpayments"
                    checked={paymentMethod === 'nowpayments'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-4 h-4 text-yellow-600"
                  />
                  <Bitcoin className="w-6 h-6 ml-3 text-yellow-600" />
                  <div className="ml-3">
                    <p className="font-semibold">Cryptocurrency</p>
                    <p className="text-sm text-gray-600">Bitcoin, Ethereum, USDT, and more</p>
                  </div>
                </label>
              </div>

              <div className="mt-4 flex items-center text-sm text-gray-600">
                <Lock className="w-4 h-4 mr-2" />
                <span>Secure payment processing</span>
              </div>
            </div>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-4">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>

              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <img
                      src={item.image || item.images?.[0]}
                      alt={item.name}
                      className="w-16 h-16 object-cover rounded"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">₦{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>₦{totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>{shippingFee === 0 ? 'FREE' : `₦${shippingFee.toLocaleString()}`}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>₦{finalTotal.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading}
                className={`w-full mt-6 py-3 rounded-lg font-semibold transition ${loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                {loading ? 'Processing...' : `Pay ₦${finalTotal.toLocaleString()}`}
              </button>

              <p className="text-xs text-gray-500 text-center mt-4">
                By completing your purchase you agree to our Terms of Service
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;