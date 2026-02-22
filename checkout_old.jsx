import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePaystackPayment } from 'react-paystack';
import { paystackConfig } from '../../config/paystack';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { awardPoints, calculatePurchasePoints, getLoyaltyAccount } from '../../services/loyaltyService';
import { markCartAsRecovered } from '../../services/cartRecoveryService';

const Checkout = () => {
  const { cartItems, getCartTotal, clearCart } = useCart();
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const [shippingInfo, setShippingInfo] = useState({
    fullName: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || '',
    address: '',
    city: '',
    state: '',
    zipCode: ''
  });

  const [paymentMethod, setPaymentMethod] = useState('paystack');
  const [loading, setLoading] = useState(false);

  // Coupon states
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [discount, setDiscount] = useState(0);

  const shippingFee = 2000;
  const subtotal = getCartTotal();
  const total = subtotal + shippingFee - discount;

  // Apply Coupon Function
  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      alert('Please enter a coupon code');
      return;
    }

    try {
      const q = query(
        collection(db, 'coupons'),
        where('code', '==', couponCode.toUpperCase()),
        where('active', '==', true)
      );
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert('Invalid coupon code');
        return;
      }

      const coupon = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

      // Validate expiry
      if (new Date(coupon.expiryDate) < new Date()) {
        alert('This coupon has expired');
        return;
      }

      // Validate usage limit
      if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
        alert('This coupon has reached its usage limit');
        return;
      }

      // Validate minimum purchase
      if (subtotal < coupon.minPurchase) {
        alert(`Minimum purchase of ₦${coupon.minPurchase.toLocaleString()} required for this coupon`);
        return;
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.type === 'percentage') {
        discountAmount = (subtotal * coupon.value) / 100;
        if (coupon.maxDiscount > 0) {
          discountAmount = Math.min(discountAmount, coupon.maxDiscount);
        }
      } else {
        discountAmount = coupon.value;
      }

      setAppliedCoupon(coupon);
      setDiscount(discountAmount);
      alert(`Coupon applied! You saved ₦${discountAmount.toLocaleString()}`);
    } catch (error) {
      console.error('Error applying coupon:', error);
      alert('Failed to apply coupon. Please try again.');
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setDiscount(0);
    setCouponCode('');
  };

  const config = {
    ...paystackConfig,
    email: shippingInfo.email,
    amount: total * 100,
    metadata: {
      custom_fields: [
        {
          display_name: "Customer Name",
          variable_name: "customer_name",
          value: shippingInfo.fullName
        }
      ]
    }
  };

  const onSuccess = async (reference) => {
    setLoading(true);
    try {
      const orderData = {
        userId: currentUser.uid,
        customerName: shippingInfo.fullName,
        customerEmail: shippingInfo.email,
        customerPhone: shippingInfo.phone,
        shippingAddress: {
          address: shippingInfo.address,
          city: shippingInfo.city,
          state: shippingInfo.state,
          zipCode: shippingInfo.zipCode
        },
        items: cartItems.map(item => ({
          productId: item.id,
          productName: item.name,
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          price: item.price,
          quantity: item.quantity,
          selectedVariation: item.selectedVariation,
          image: item.images?.[0]
        })),
        subtotal,
        shippingFee,
        discount,
        couponCode: appliedCoupon?.code || null,
        total,
        paymentMethod: 'paystack',
        paymentReference: reference.reference,
        paymentStatus: 'paid',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const orderRef = await addDoc(collection(db, 'orders'), orderData);

      // Send order confirmation email to customer
      try {
        await triggerOrderConfirmationEmail({
          id: orderRef.id,
          ...orderData
        });
        console.log('Order confirmation email sent');
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
      }

      // Send notification to buyer
      try {
        await triggerOrderNotification({ id: orderRef.id, userId: currentUser.uid }, 'placed');
      } catch (notifError) {
        console.error('Error sending buyer notification:', notifError);
      }

      // Update coupon usage if applied
      if (appliedCoupon) {
        await updateDoc(doc(db, 'coupons', appliedCoupon.id), {
          usedCount: (appliedCoupon.usedCount || 0) + 1
        });
      }

      // Create vendor orders, send emails and notifications
      const vendorOrders = {};
      cartItems.forEach(item => {
        if (!vendorOrders[item.vendorId]) {
          vendorOrders[item.vendorId] = [];
        }
        vendorOrders[item.vendorId].push(item);
      });

      for (const [vendorId, items] of Object.entries(vendorOrders)) {
        // Create vendor order
        await addDoc(collection(db, 'vendorOrders'), {
          vendorId,
          orderId: orderRef.id,
          items: items.map(item => ({
            productId: item.id,
            productName: item.name,
            price: item.price,
            quantity: item.quantity,
            selectedVariation: item.selectedVariation
          })),
          total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          status: 'pending',
          createdAt: new Date().toISOString()
        });
        await markCartAsRecovered(currentUser.uid);

        try {
  const loyaltyAccount = await getLoyaltyAccount(currentUser.uid);
  if (loyaltyAccount) {
    const pointsEarned = calculatePurchasePoints(total, loyaltyAccount.tier);
    await awardPoints(
      currentUser.uid,
      pointsEarned,
      `Purchase - Order #${orderRef.id.substring(0, 8)}`,
      { orderId: orderRef.id, amount: total }
    );
  }
} catch (error) {
  console.error('Error awarding loyalty points:', error);
}


        // Send email and notification to vendor
        try {
          const vendorDoc = await getDoc(doc(db, 'users', vendorId));
          if (vendorDoc.exists()) {
            const vendorData = vendorDoc.data();
            
            // Send email
            await triggerVendorNewOrderEmail(
              {
                id: orderRef.id,
                customerName: shippingInfo.fullName,
                total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                items
              },
              vendorData.email,
              vendorData.name
            );
            
            // Send notification
            await triggerVendorOrderNotification(vendorId, {
              id: orderRef.id,
              total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
            });
            
            console.log(`Vendor email and notification sent to ${vendorData.email}`);
          }
        } catch (vendorError) {
          console.error('Error sending vendor communications:', vendorError);
        }
      }

      clearCart();
      navigate(`/buyer/orders?success=true&orderId=${orderRef.id}`);
    } catch (error) {
      console.error('Error creating order:', error);
      alert('Order creation failed. Please contact support.');
    } finally {
      setLoading(false);
    }
  };

  const onClose = () => {
    console.log('Payment closed');
  };

  const initializePayment = usePaystackPayment(config);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!shippingInfo.address || !shippingInfo.city || !shippingInfo.state) {
      alert('Please fill in all shipping information');
      return;
    }

    if (paymentMethod === 'paystack') {
      initializePayment(onSuccess, onClose);
    }
  };

  if (cartItems.length === 0) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Checkout</h1>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Shipping Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Full Name</label>
                  <input
                    type="text"
                    value={shippingInfo.fullName}
                    onChange={(e) => setShippingInfo({...shippingInfo, fullName: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Email</label>
                  <input
                    type="email"
                    value={shippingInfo.email}
                    onChange={(e) => setShippingInfo({...shippingInfo, email: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Phone</label>
                  <input
                    type="tel"
                    value={shippingInfo.phone}
                    onChange={(e) => setShippingInfo({...shippingInfo, phone: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Address</label>
                  <input
                    type="text"
                    value={shippingInfo.address}
                    onChange={(e) => setShippingInfo({...shippingInfo, address: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">City</label>
                  <input
                    type="text"
                    value={shippingInfo.city}
                    onChange={(e) => setShippingInfo({...shippingInfo, city: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">State</label>
                  <input
                    type="text"
                    value={shippingInfo.state}
                    onChange={(e) => setShippingInfo({...shippingInfo, state: e.target.value})}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">ZIP Code</label>
                  <input
                    type="text"
                    value={shippingInfo.zipCode}
                    onChange={(e) => setShippingInfo({...shippingInfo, zipCode: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
              <div className="space-y-3">
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700">
                  <input
                    type="radio"
                    value="paystack"
                    checked={paymentMethod === 'paystack'}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <p className="font-medium">Paystack</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Pay securely with card, bank transfer, or USSD</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 sticky top-6">
              <h2 className="text-xl font-semibold mb-4">Order Summary</h2>
              
              {/* Products */}
              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
                {cartItems.map((item, index) => (
                  <div key={index} className="flex gap-3">
                    <img src={item.images?.[0]} alt={item.name} className="w-16 h-16 object-cover rounded" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold">₦{(item.price * item.quantity).toLocaleString()}</p>
                  </div>
                ))}
              </div>

              {/* Coupon Section */}
              <div className="border-t pt-4 mb-4">
                <label className="block text-sm font-medium mb-2">Have a coupon?</label>
                {appliedCoupon ? (
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                          {appliedCoupon.code}
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-500">
                          You saved ₦{discount.toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={removeCoupon}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      placeholder="Enter coupon code"
                      className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700 text-sm"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* Price Summary */}
              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-semibold">₦{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-semibold">₦{shippingFee.toLocaleString()}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span className="font-semibold">-₦{discount.toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-xl font-bold text-orange-600">₦{total.toLocaleString()}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400"
              >
                {loading ? 'Processing...' : 'Place Order'}
              </button>

              <p className="text-xs text-gray-500 text-center mt-3">
                By placing your order, you agree to our terms and conditions
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Checkout;