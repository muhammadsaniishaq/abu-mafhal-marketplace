import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { usePaystackPayment } from 'react-paystack';
import { paystackConfig } from '../../config/paystack';
import { supabase } from '../../config/supabase';
import { awardPoints, calculatePurchasePoints, getLoyaltyAccount } from '../../services/loyaltyService';
import { markCartAsRecovered } from '../../services/cartRecoveryService';
import { triggerOrderConfirmationEmail, triggerVendorNewOrderEmail } from '../../utils/emailTriggers';
import { triggerOrderNotification, triggerVendorOrderNotification } from '../../utils/notificationTriggers';
import { triggerOrderConfirmationWhatsApp, triggerPaymentSuccessWhatsApp } from '../../utils/whatsappTriggers';


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
      const { data: couponsData, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase())
        .eq('active', true);
        
      if (error) throw error;
      
      if (!couponsData || couponsData.length === 0) {
        alert('Invalid coupon code');
        return;
      }

      const coupon = couponsData[0];
      const expiryDate = coupon.expiry_date || coupon.expiryDate;
      const usageLimit = coupon.usage_limit || coupon.usageLimit || 0;
      const usedCount = coupon.used_count || coupon.usedCount || 0;
      const minPurchase = coupon.min_purchase || coupon.minPurchase || 0;
      const maxDiscount = coupon.max_discount || coupon.maxDiscount || 0;

      // Validate expiry
      if (expiryDate && new Date(expiryDate) < new Date()) {
        alert('This coupon has expired');
        return;
      }

      // Validate usage limit
      if (usageLimit > 0 && usedCount >= usageLimit) {
        alert('This coupon has reached its usage limit');
        return;
      }

      // Validate minimum purchase
      if (subtotal < minPurchase) {
        alert(`Minimum purchase of ₦${minPurchase.toLocaleString()} required for this coupon`);
        return;
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.type === 'percentage') {
        discountAmount = (subtotal * coupon.value) / 100;
        if (maxDiscount > 0) {
          discountAmount = Math.min(discountAmount, maxDiscount);
        }
      } else {
        discountAmount = coupon.value;
      }

      setAppliedCoupon(coupon);
      setDiscount(discountAmount);
      alert(`Coupon applied! You saved ₦${discountAmount.toLocaleString()}`);
    } catch (error) {
      console.error('Error applying coupon:', error.message);
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
        user_id: currentUser.uid,
        customer_name: shippingInfo.fullName,
        customer_email: shippingInfo.email,
        customer_phone: shippingInfo.phone,
        shipping_address: {
          address: shippingInfo.address,
          city: shippingInfo.city,
          state: shippingInfo.state,
          zipCode: shippingInfo.zipCode
        },
        items: cartItems.map(item => ({
          product_id: item.id,
          product_name: item.name,
          vendor_id: item.vendorId || item.vendor_id,
          vendor_name: item.vendorName || item.vendor_name,
          price: item.price,
          quantity: item.quantity,
          selected_variation: item.selectedVariation || item.selected_variation,
          image: item.images?.[0]
        })),
        subtotal,
        shipping_fee: shippingFee,
        discount,
        coupon_code: appliedCoupon?.code || null,
        total,
        payment_method: 'paystack',
        payment_reference: reference.reference,
        payment_status: 'paid',
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data: orderResponse, error: orderError } = await supabase
        .from('orders')
        .insert([orderData])
        .select()
        .single();
        
      if (orderError) throw orderError;
      
      const orderId = orderResponse.id;

      // Send order confirmation email to customer
      try {
        await triggerOrderConfirmationEmail({
          id: orderId,
          ...orderData
        });
        console.log('Order confirmation email sent');
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
      }

      // Send notification to buyer
      try {
        await triggerOrderNotification({ id: orderId, userId: currentUser.uid }, 'placed');
      } catch (notifError) {
        console.error('Error sending buyer notification:', notifError);
      }

      // Send WhatsApp notifications
      try {
        const phone = shippingInfo.phone;
        if (phone) {
          await triggerOrderConfirmationWhatsApp(phone, orderId, total, currentUser.uid || currentUser.id);
          await triggerPaymentSuccessWhatsApp(phone, orderId, total, reference.reference, currentUser.uid || currentUser.id);
        }
      } catch (waError) {
        console.error('Error sending WhatsApp notifications:', waError);
      }

      // Update coupon usage if applied
      if (appliedCoupon) {
        await supabase
          .from('coupons')
          .update({
             used_count: (appliedCoupon.used_count || appliedCoupon.usedCount || 0) + 1
          })
          .eq('id', appliedCoupon.id);
      }

      // Create vendor orders, send emails and notifications
      const vendorOrders = {};
      cartItems.forEach(item => {
        const vendorId = item.vendorId || item.vendor_id;
        if (!vendorOrders[vendorId]) {
          vendorOrders[vendorId] = [];
        }
        vendorOrders[vendorId].push(item);
      });

      for (const [vendorId, items] of Object.entries(vendorOrders)) {
        // Create vendor order
        await supabase.from('vendor_orders').insert({
          vendor_id: vendorId,
          order_id: orderId,
          items: items.map(item => ({
            product_id: item.id,
            product_name: item.name,
            price: item.price,
            quantity: item.quantity,
            selected_variation: item.selectedVariation || item.selected_variation
          })),
          total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
          status: 'pending',
          created_at: new Date().toISOString()
        });
        await markCartAsRecovered(currentUser.uid);

        try {
  const loyaltyAccount = await getLoyaltyAccount(currentUser.uid);
  if (loyaltyAccount) {
    const pointsEarned = calculatePurchasePoints(total, loyaltyAccount.tier);
    await awardPoints(
      currentUser.uid,
      pointsEarned,
      `Purchase - Order #${orderId.substring(0, 8)}`,
      { orderId: orderId, amount: total }
    );
  }
} catch (error) {
  console.error('Error awarding loyalty points:', error);
}


        // Send email and notification to vendor
        try {
          const { data: vendorData, error: vendorError } = await supabase
            .from('users')
            .select('*')
            .eq('id', vendorId)
            .single();
            
          if (!vendorError && vendorData) {
            
            // Send email
            await triggerVendorNewOrderEmail(
              {
                id: orderId,
                customerName: shippingInfo.fullName,
                total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
                items
              },
              vendorData.email,
              vendorData.name
            );
            
            // Send notification
            await triggerVendorOrderNotification(vendorId, {
              id: orderId,
              total: items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
            });
            
            console.log(`Vendor email and notification sent to ${vendorData.email}`);
          }
        } catch (vendorError) {
          console.error('Error sending vendor communications:', vendorError);
        }
      }

      clearCart();
      navigate(`/buyer/orders?success=true&orderId=${orderId}`);
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