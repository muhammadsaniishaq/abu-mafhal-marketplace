import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { saveAbandonedCart, deleteAbandonedCart } from '../../services/cartRecoveryService';
import { getLoyaltyAccount, pointsToDiscount, redeemPoints } from '../../services/loyaltyService';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const Cart = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCart();
  const [coupons, setCoupons] = useState([]);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [loyaltyAccount, setLoyaltyAccount] = useState(null);
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      fetchLoyaltyAccount();
      fetchCoupons();
    }
  }, [currentUser]);

  // Track abandoned cart
  useEffect(() => {
    let timeoutId;
    
    if (currentUser && cartItems.length > 0) {
      timeoutId = setTimeout(() => {
        saveAbandonedCart(
          currentUser.uid,
          cartItems,
          currentUser.email,
          currentUser.name
        );
      }, 5 * 60 * 1000); // 5 minutes
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [cartItems, currentUser]);

  const fetchLoyaltyAccount = async () => {
    try {
      const account = await getLoyaltyAccount(currentUser.uid);
      setLoyaltyAccount(account);
    } catch (error) {
      console.error('Error fetching loyalty account:', error);
    }
  };

  const fetchCoupons = async () => {
    try {
      const q = query(
        collection(db, 'coupons'),
        where('active', '==', true)
      );
      const snapshot = await getDocs(q);
      const couponsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCoupons(couponsData);
    } catch (error) {
      console.error('Error fetching coupons:', error);
    }
  };

  const applyCoupon = () => {
    if (!couponCode.trim()) {
      alert('Please enter a coupon code');
      return;
    }

    const coupon = coupons.find(c => 
      c.code.toUpperCase() === couponCode.toUpperCase() &&
      c.active &&
      new Date(c.expiryDate) > new Date() &&
      (!c.usageLimit || c.usedCount < c.usageLimit)
    );

    if (!coupon) {
      alert('Invalid or expired coupon code');
      return;
    }

    if (coupon.minPurchase > subtotal) {
      alert(`Minimum purchase of ₦${coupon.minPurchase.toLocaleString()} required`);
      return;
    }

    setAppliedCoupon(coupon);
    alert(`Coupon applied! You saved ₦${calculateCouponDiscount(coupon).toLocaleString()}`);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };

  const calculateCouponDiscount = (coupon) => {
    if (!coupon) return 0;
    
    let discount = 0;
    if (coupon.type === 'percentage') {
      discount = (subtotal * coupon.value) / 100;
      if (coupon.maxDiscount > 0) {
        discount = Math.min(discount, coupon.maxDiscount);
      }
    } else {
      discount = coupon.value;
    }
    
    return Math.min(discount, subtotal);
  };

  const handlePointsChange = (e) => {
    const points = parseInt(e.target.value) || 0;
    const maxPoints = Math.min(loyaltyAccount?.points || 0, subtotal);
    setPointsToUse(Math.min(points, maxPoints));
  };

  const handleRemoveFromCart = (productId) => {
    removeFromCart(productId);
  };

  const handleUpdateQuantity = (productId, newQuantity) => {
    if (newQuantity < 1) {
      handleRemoveFromCart(productId);
      return;
    }
    
    const item = cartItems.find(i => i.id === productId);
    if (newQuantity > item.stock) {
      alert(`Only ${item.stock} items available in stock`);
      return;
    }
    
    updateQuantity(productId, newQuantity);
  };

  const handleClearCart = () => {
    if (window.confirm('Are you sure you want to clear your cart?')) {
      clearCart();
      setAppliedCoupon(null);
      setUsePoints(false);
      setPointsToUse(0);
    }
  };

  const handleCheckout = () => {
    if (!currentUser) {
      alert('Please login to checkout');
      navigate('/login');
      return;
    }

    // Check stock availability
    for (const item of cartItems) {
      if (item.quantity > item.stock) {
        alert(`${item.name} has only ${item.stock} items in stock`);
        return;
      }
    }

    // Delete abandoned cart on checkout
    if (currentUser) {
      deleteAbandonedCart(currentUser.uid);
    }

    // Pass discount info to checkout
    const checkoutData = {
      appliedCoupon,
      pointsUsed: usePoints ? pointsToUse : 0,
      loyaltyDiscount: usePoints ? pointsToUse : 0
    };

    navigate('/checkout', { state: checkoutData });
  };

  // Calculations
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const couponDiscount = calculateCouponDiscount(appliedCoupon);
  const loyaltyDiscount = usePoints ? pointsToUse : 0;
  const totalDiscount = couponDiscount + loyaltyDiscount;
  const shipping = subtotal > 0 ? (subtotal >= 50000 ? 0 : 2000) : 0;
  const total = Math.max(0, subtotal - totalDiscount + shipping);

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-10">
            <p className="text-6xl mb-4">🛒</p>
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">Your Cart is Empty</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Looks like you haven't added anything to your cart yet
            </p>
            <Link
              to="/shop"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-lg"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Shopping Cart</h1>
          <button
            onClick={handleClearCart}
            className="text-red-600 hover:text-red-700 font-medium"
          >
            Clear Cart
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {cartItems.map((item) => (
              <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
                <div className="flex gap-4">
                  {/* Product Image */}
                  <img
                    src={item.images?.[0] || 'https://via.placeholder.com/150'}
                    alt={item.name}
                    className="w-24 h-24 object-cover rounded-lg"
                  />

                  {/* Product Details */}
                  <div className="flex-1">
                    <Link
                      to={`/product/${item.id}`}
                      className="text-lg font-semibold hover:text-blue-600 dark:text-white"
                    >
                      {item.name}
                    </Link>
                    
                    {item.variation && Object.keys(item.variation).length > 0 && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {Object.entries(item.variation).map(([key, value]) => (
                          <span key={key} className="mr-3">
                            {key}: <strong>{value}</strong>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-3">
                      <div className="flex items-center border rounded-lg">
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                          className="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value) || 1)}
                          className="w-16 text-center border-x dark:bg-gray-800"
                          min="1"
                          max={item.stock}
                        />
                        <button
                          onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                          className="px-3 py-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          +
                        </button>
                      </div>

                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Stock: {item.stock}
                      </p>
                    </div>

                    {/* Flash Sale Badge */}
                    {item.flashSale && (
                      <div className="mt-2">
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                          ⚡ Flash Sale: {item.flashSale.discount}% OFF
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Price and Remove */}
                  <div className="text-right">
                    <p className="text-xl font-bold text-gray-900 dark:text-white">
                      ₦{(item.price * item.quantity).toLocaleString()}
                    </p>
                    {item.originalPrice && item.originalPrice > item.price && (
                      <p className="text-sm text-gray-500 line-through">
                        ₦{(item.originalPrice * item.quantity).toLocaleString()}
                      </p>
                    )}
                    <button
                      onClick={() => handleRemoveFromCart(item.id)}
                      className="mt-4 text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Continue Shopping */}
            <Link
              to="/shop"
              className="inline-block text-blue-600 hover:underline font-medium"
            >
              ← Continue Shopping
            </Link>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sticky top-6">
              <h2 className="text-xl font-bold mb-4">Order Summary</h2>

              {/* Coupon Code */}
              <div className="mb-4 pb-4 border-b dark:border-gray-700">
                <label className="block text-sm font-medium mb-2">Coupon Code</label>
                {!appliedCoupon ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter code"
                      className="flex-1 px-3 py-2 border rounded-lg dark:bg-gray-700 text-sm"
                    />
                    <button
                      onClick={applyCoupon}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                    >
                      Apply
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-300">
                        {appliedCoupon.code}
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        -{appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}%` : `₦${appliedCoupon.value}`}
                      </p>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Loyalty Points */}
              {currentUser && loyaltyAccount && loyaltyAccount.points > 0 && (
                <div className="mb-4 pb-4 border-b dark:border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Use Loyalty Points</label>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={usePoints}
                        onChange={(e) => {
                          setUsePoints(e.target.checked);
                          if (!e.target.checked) setPointsToUse(0);
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                  {usePoints && (
                    <div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        Available: {loyaltyAccount.points.toLocaleString()} points (₦{loyaltyAccount.points.toLocaleString()})
                      </p>
                      <input
                        type="number"
                        value={pointsToUse}
                        onChange={handlePointsChange}
                        max={Math.min(loyaltyAccount.points, subtotal)}
                        min="0"
                        className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 text-sm"
                        placeholder="Points to use"
                      />
                      {pointsToUse > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                          Saving: ₦{pointsToUse.toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Price Breakdown */}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Subtotal</span>
                  <span className="font-medium">₦{subtotal.toLocaleString()}</span>
                </div>

                {couponDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Coupon Discount</span>
                    <span className="text-green-600 font-medium">-₦{couponDiscount.toLocaleString()}</span>
                  </div>
                )}

                {loyaltyDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-600">Loyalty Points</span>
                    <span className="text-purple-600 font-medium">-₦{loyaltyDiscount.toLocaleString()}</span>
                  </div>
                )}

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Shipping</span>
                  <span className="font-medium">
                    {shipping === 0 ? (
                      <span className="text-green-600">FREE</span>
                    ) : (
                      `₦${shipping.toLocaleString()}`
                    )}
                  </span>
                </div>

                {shipping > 0 && (
                  <p className="text-xs text-gray-500">
                    Add ₦{(50000 - subtotal).toLocaleString()} more for free shipping
                  </p>
                )}

                {totalDiscount > 0 && (
                  <div className="pt-3 border-t dark:border-gray-700">
                    <div className="flex justify-between text-sm font-medium text-green-600">
                      <span>Total Savings</span>
                      <span>₦{totalDiscount.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Total */}
              <div className="border-t dark:border-gray-700 pt-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ₦{total.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleCheckout}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition"
              >
                Proceed to Checkout
              </button>

              {/* Security Badge */}
              <div className="mt-4 text-center text-xs text-gray-500">
                <p>🔒 Secure Checkout</p>
              </div>

              {/* Benefits */}
              <div className="mt-6 space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Free returns within 7 days</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Secure payment options</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Earn loyalty points on purchase</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* You May Also Like */}
        <div className="mt-10">
          <h2 className="text-2xl font-bold mb-4">You May Also Like</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Based on items in your cart...
          </p>
        </div>
      </div>
    </div>
  );
};

export default Cart;