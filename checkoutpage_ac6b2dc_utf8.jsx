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

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cartItems, clearCart } = useCart();
  const { currentUser } = useAuth();
  
  const [paymentMethod, setPaymentMethod] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  
  const [shippingInfo, setShippingInfo] = useState({
    fullName: currentUser?.displayName || '',
    email: currentUser?.email || '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Nigeria'
  });

  // Calculate total from cart items
  const totalAmount = cartItems.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);
  
  const shippingFee = totalAmount > 10000 ? 0 : 1500;
  const finalTotal = totalAmount + shippingFee;

  // Paystack Configuration
  const paystackConfig = {
    reference: `REF-${Date.now()}`,
    email: shippingInfo.email,
    amount: finalTotal * 100, // Amount in kobo
    publicKey: 'pk_test_92a99bcc7c063338c402506c2e6db390dd986585', // Replace with your key
  };

  const initializePaystack = usePaystackPayment(paystackConfig);

  // Flutterwave Configuration
  const flutterwaveConfig = {
    public_key: 'FLWPUBK-3fff199cbd02a7c478e39ce4e4c3ac0f-X', // Replace with your key
    tx_ref: `FLW-${Date.now()}`,
    amount: finalTotal,
    currency: 'NGN',
    payment_options: 'card,mobilemoney,ussd',
    customer: {
      email: shippingInfo.email,
      phone_number: shippingInfo.phone,
      name: shippingInfo.fullName,
    },
    customizations: {
      title: 'Abu Mafhal Marketplace',
      description: 'Payment for items in cart',
      logo: 'https://your-logo-url.com/logo.png',
    },
  };

  const handleFlutterwave = useFlutterwave(flutterwaveConfig);

  // Handle form input changes
  const handleInputChange = (e) => {
    setShippingInfo({
      ...shippingInfo,
      [e.target.name]: e.target.value
    });
  };

  // Validate form
  const validateForm = () => {
    const required = ['fullName', 'email', 'phone', 'address', 'city', 'state'];
    for (let field of required) {
      if (!shippingInfo[field]) {
        alert(`Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`);
        return false;
      }
    }
    if (!paymentMethod) {
      alert('Please select a payment method');
      return false;
    }
    return true;
  };

  // Handle Paystack Payment
  const handlePaystackPayment = () => {
    initializePaystack(
      (reference) => {
        console.log('Payment successful:', reference);
        completeOrder(reference.reference, 'paystack');
      },
      () => {
        alert('Payment cancelled');
        setLoading(false);
      }
    );
  };

  // Handle Flutterwave Payment
  const handleFlutterwavePayment = () => {
    handleFlutterwave({
      callback: (response) => {
        console.log('Payment successful:', response);
        completeOrder(response.transaction_id, 'flutterwave');
        closePaymentModal();
      },
      onClose: () => {
        alert('Payment cancelled');
        setLoading(false);
      },
    });
  };

  // Handle NOWPayments (Crypto)
  const handleNOWPayment = async () => {
    try {
      setLoading(true);
      
      // Create payment on NOWPayments
      const response = await fetch('https://api.nowpayments.io/v1/payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'c4455828-ed9b-4d52-943f-53e812e6db0c', // Replace with your key
        },
        body: JSON.stringify({
          price_amount: finalTotal / 1600, // Convert NGN to USD (approximate)
          price_currency: 'usd',
          pay_currency: 'btc', // Bitcoin
          order_id: `ORDER-${Date.now()}`,
          order_description: 'Purchase from Abu Mafhal Marketplace',
          ipn_callback_url: 'https://your-domain.com/api/nowpayments-callback',
          success_url: 'https://your-domain.com/order-success',
          cancel_url: 'https://your-domain.com/checkout',
        }),
      });

      const data = await response.json();
      
      if (data.payment_url) {
        // Redirect to NOWPayments page
        window.location.href = data.payment_url;
      } else {
        throw new Error('Failed to create payment');
      }
    } catch (error) {
      console.error('NOWPayments error:', error);
      alert('Failed to initialize crypto payment. Please try again.');
      setLoading(false);
    }
  };

  // Complete order and save to database
  const completeOrder = async (transactionId, method) => {
    try {
      const order = {
        userId: currentUser?.uid,
        items: cartItems,
        shippingInfo,
        paymentMethod: method,
        transactionId,
        totalAmount: finalTotal,
        status: 'pending',
        createdAt: new Date().toISOString()
      };

      // Save to your database (Firebase, etc.)
      // await saveOrderToDatabase(order);
      
      console.log('Order placed:', order);
      
      clearCart();
      setOrderPlaced(true);
      
      setTimeout(() => {
        navigate('/order-success', { state: { order } });
      }, 2000);
      
    } catch (error) {
      console.error('Error completing order:', error);
      alert('Failed to complete order. Please contact support.');
    } finally {
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
                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                  paymentMethod === 'paystack' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
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
                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                  paymentMethod === 'flutterwave' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'
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
                <label className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition ${
                  paymentMethod === 'nowpayments' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 hover:border-gray-300'
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
                    <p className="font-semibold">Γéª{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>Γéª{totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Shipping</span>
                  <span>{shippingFee === 0 ? 'FREE' : `Γéª${shippingFee.toLocaleString()}`}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>Γéª{finalTotal.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={loading}
                className={`w-full mt-6 py-3 rounded-lg font-semibold transition ${
                  loading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {loading ? 'Processing...' : `Pay Γéª${finalTotal.toLocaleString()}`}
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
