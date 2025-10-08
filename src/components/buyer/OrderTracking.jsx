import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useParams, Link } from 'react-router-dom';

const OrderTracking = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState(null);
  const [trackingHistory, setTrackingHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const statusSteps = [
    { key: 'pending', label: 'Order Placed', icon: '📋', description: 'Your order has been received' },
    { key: 'confirmed', label: 'Confirmed', icon: '✅', description: 'Vendor confirmed your order' },
    { key: 'processing', label: 'Processing', icon: '📦', description: 'Your order is being prepared' },
    { key: 'shipped', label: 'Shipped', icon: '🚚', description: 'Your order is on the way' },
    { key: 'delivered', label: 'Delivered', icon: '🎉', description: 'Order delivered successfully' }
  ];

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      if (orderDoc.exists()) {
        const orderData = { id: orderDoc.id, ...orderDoc.data() };
        setOrder(orderData);

        // Fetch tracking history
        const historyQuery = query(
          collection(db, 'orderTracking', orderId, 'history'),
          orderBy('timestamp', 'desc')
        );
        const historySnapshot = await getDocs(historyQuery);
        const history = historySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTrackingHistory(history);
      }
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentStepIndex = () => {
    const currentStatus = order?.status || 'pending';
    const statusMap = {
      'pending': 0,
      'confirmed': 1,
      'processing': 2,
      'shipped': 3,
      'delivered': 4,
      'completed': 4
    };
    return statusMap[currentStatus] || 0;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <p className="text-6xl mb-4">📦</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Order Not Found</h2>
          <Link to="/buyer/orders" className="text-blue-600 hover:underline">
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const currentStep = getCurrentStepIndex();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link to="/buyer/orders" className="text-blue-600 hover:underline flex items-center gap-2">
            ← Back to Orders
          </Link>
        </div>

        {/* Order Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Order #{order.id.substring(0, 8).toUpperCase()}
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Placed on {new Date(order.createdAt).toLocaleDateString()}
              </p>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${
              order.status === 'delivered' || order.status === 'completed' ? 'bg-green-100 text-green-800' :
              order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
              order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {order.status?.charAt(0).toUpperCase() + order.status?.slice(1)}
            </span>
          </div>

          {/* Tracking Number */}
          {order.trackingNumber && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-sm text-blue-800 dark:text-blue-400 mb-1">Tracking Number</p>
              <p className="font-mono font-bold text-blue-900 dark:text-blue-300">{order.trackingNumber}</p>
            </div>
          )}
        </div>

        {/* Progress Tracker */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-6">Order Progress</h2>
          
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-8 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-700">
              <div 
                className="h-full bg-blue-600 transition-all duration-500"
                style={{ width: `${(currentStep / (statusSteps.length - 1)) * 100}%` }}
              />
            </div>

            {/* Steps */}
            <div className="relative flex justify-between">
              {statusSteps.map((step, index) => {
                const isCompleted = index <= currentStep;
                const isCurrent = index === currentStep;

                return (
                  <div key={step.key} className="flex flex-col items-center" style={{ width: '20%' }}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-3 transition-all ${
                      isCompleted 
                        ? 'bg-blue-600 text-white shadow-lg scale-110' 
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    } ${isCurrent ? 'ring-4 ring-blue-300' : ''}`}>
                      {step.icon}
                    </div>
                    <p className={`text-sm font-medium text-center mb-1 ${
                      isCompleted ? 'text-gray-900 dark:text-white' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                      {step.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Estimated Delivery */}
          {order.estimatedDelivery && order.status !== 'delivered' && (
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-400">
                Estimated Delivery: <span className="font-semibold">{new Date(order.estimatedDelivery).toLocaleDateString()}</span>
              </p>
            </div>
          )}
        </div>

        {/* Tracking History */}
        {trackingHistory.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Tracking History</h2>
            <div className="space-y-4">
              {trackingHistory.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-blue-600' : 'bg-gray-300'}`} />
                    {index !== trackingHistory.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-300 dark:bg-gray-600 mt-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-4">
                    <p className="font-medium text-gray-900 dark:text-white">{event.status}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{event.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                    {event.location && (
                      <p className="text-xs text-gray-500">Location: {event.location}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Order Items */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Order Items</h2>
          <div className="space-y-4">
            {order.items?.map((item, index) => (
              <div key={index} className="flex gap-4 pb-4 border-b last:border-b-0">
                <img 
                  src={item.image || 'https://via.placeholder.com/100'} 
                  alt={item.productName}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">{item.productName}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Quantity: {item.quantity}</p>
                  {item.selectedVariation && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {Object.entries(item.selectedVariation).map(([key, value]) => `${key}: ${value}`).join(', ')}
                    </p>
                  )}
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">
                  ₦{(item.price * item.quantity).toLocaleString()}
                </p>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="mt-6 pt-4 border-t space-y-2">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Subtotal</span>
              <span>₦{order.subtotal?.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Shipping</span>
              <span>₦{order.shippingFee?.toLocaleString()}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span>
                <span>-₦{order.discount?.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold text-gray-900 dark:text-white pt-2 border-t">
              <span>Total</span>
              <span>₦{order.total?.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Shipping Address</h2>
          <div className="text-gray-700 dark:text-gray-300">
            <p className="font-medium">{order.customerName}</p>
            <p>{order.shippingAddress?.address}</p>
            <p>{order.shippingAddress?.city}, {order.shippingAddress?.state}</p>
            {order.shippingAddress?.zipCode && <p>{order.shippingAddress.zipCode}</p>}
            <p className="mt-2">{order.customerPhone}</p>
            <p>{order.customerEmail}</p>
          </div>
        </div>

        {/* Actions */}
        {order.status === 'delivered' && (
          <div className="mt-6 flex gap-4">
            <Link 
              to={`/buyer/reviews?orderId=${order.id}`}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-center py-3 rounded-lg font-medium"
            >
              Write a Review
            </Link>
            <button className="flex-1 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white py-3 rounded-lg font-medium">
              Report Issue
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderTracking;