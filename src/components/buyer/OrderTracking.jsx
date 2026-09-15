import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { 
  ArrowLeft, Search, Bell, ShoppingCart, User, Check, Truck,
  Phone, Headset, HelpCircle, MapPin, Copy, ExternalLink,
  ChevronRight, Navigation, Plus, Minus, CheckCircle2,
  PackageCheck, Clock, ShieldCheck
} from 'lucide-react';

const OrderTracking = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  // Default demo data matching Screenshot 2
  const defaultOrder = {
    trackingNumber: orderId || 'AMF12873645',
    placedDate: '10 Sept 2026, 14:32',
    estimatedDelivery: '12 Sept 2026',
    estimatedTimeWindow: '12 Sept 2026, 2:00 PM – 6:00 PM',
    status: 'out_for_delivery',
    statusLabel: 'Out for Delivery',
    product: {
      name: 'Oraimo FreePods 4 Wireless Earbuds',
      variant: 'Black | 1 Piece',
      seller: 'ABU MAFHAL',
      price: 24500,
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=250&q=80',
    },
    deliveryMethod: 'ABU MAFHAL Delivery',
    trackingId: 'AMF12873645',
    paymentMethod: 'Paystack (Paid)',
    rider: {
      name: 'Ibrahim Danladi',
      phone: '+234 803 123 4567',
      status: 'On the Way',
      subtext: 'Your order will arrive soon',
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    if (!orderId) {
      setOrder(defaultOrder);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error || !data) {
        setOrder(defaultOrder);
      } else {
        setOrder({
          ...defaultOrder,
          trackingNumber: data.order_number || orderId,
          trackingId: data.order_number || orderId,
          placedDate: new Date(data.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
          status: data.status,
        });
      }
    } catch (e) {
      setOrder(defaultOrder);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const trackingSteps = [
    {
      title: 'Order Confirmed',
      description: 'Your order has been placed successfully.',
      timestamp: '10 Sept 2026, 14:32',
      completed: true,
      active: false,
    },
    {
      title: 'Processing',
      description: 'Your item is being prepared by the seller.',
      timestamp: '10 Sept 2026, 16:10',
      completed: true,
      active: false,
    },
    {
      title: 'Shipped',
      description: 'Your order has been handed over to our delivery partner.',
      timestamp: '11 Sept 2026, 09:25',
      completed: true,
      active: false,
    },
    {
      title: 'Out for Delivery',
      description: 'Your order is on the way to your location.',
      timestamp: '12 Sept 2026, 10:15',
      completed: false,
      active: true,
    },
    {
      title: 'Delivered',
      description: 'Your order will be marked as delivered once it reaches you.',
      timestamp: 'Pending',
      completed: false,
      active: false,
    },
  ];

  const currentOrder = order || defaultOrder;

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-sans text-slate-800 antialiased selection:bg-[#00BFA5] selection:text-white">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-4 lg:px-8 py-2.5 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0A192F] to-[#1E3A8A] flex items-center justify-center p-0.5 shadow-md shadow-slate-900/10 border border-amber-400/40">
              <span className="font-black text-[#F59E0B] text-base tracking-tighter">AM</span>
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-[#0A192F] leading-none uppercase">Abu Mafhal</h1>
              <p className="text-[10px] text-slate-500 font-medium">Your Marketplace, Your Choice.</p>
            </div>
          </Link>

          {/* Search bar */}
          <div className="hidden md:flex flex-1 max-w-xl mx-6">
            <div className="w-full flex items-center bg-slate-100/90 border border-slate-200/90 rounded-xl overflow-hidden focus-within:border-[#00BFA5] focus-within:ring-2 focus-within:ring-[#00BFA5]/20 transition-all">
              <div className="pl-3.5 text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search for products, brands and stores..."
                className="w-full bg-transparent px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
            </div>
          </div>

          {/* Location & Account Nav */}
          <div className="flex items-center gap-4">
            {/* Delivery address */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-700 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/80">
              <MapPin className="w-3.5 h-3.5 text-[#00BFA5]" />
              <div className="text-left leading-tight">
                <p className="text-[10px] text-slate-400 font-semibold">Deliver to</p>
                <p className="text-xs font-bold text-slate-800">Gashua, Yobe State</p>
              </div>
            </div>

            {/* Notification */}
            <Link to="/notifications" className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-sm">
                3
              </span>
            </Link>

            {/* Cart */}
            <Link to="/cart" className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white font-bold text-[10px] rounded-full flex items-center justify-center shadow-sm">
                2
              </span>
            </Link>

            {/* User Profile */}
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-[#0A192F] text-white flex items-center justify-center font-bold text-xs">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-xs font-bold text-slate-800">My Account</p>
                <p className="text-[10px] text-slate-400 font-medium">Welcome</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
        {/* Breadcrumb & Back Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
              <Link to="/" className="hover:text-slate-700">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/buyer/orders" className="hover:text-slate-700">My Orders</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-700 font-bold">Order Tracking</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Order Tracking</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Track your order in real-time and get the latest updates.
            </p>
          </div>

          <Link
            to="/buyer/orders"
            className="self-start sm:self-auto px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Orders</span>
          </Link>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Order details & 5-stage timeline (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* Order Summary & Product Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm">
              {/* Order ID Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base sm:text-lg font-black text-slate-900">
                      Order #{currentOrder.trackingNumber}
                    </span>
                    <button
                      onClick={() => copyToClipboard(currentOrder.trackingNumber)}
                      className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors"
                      title="Copy Tracking Number"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    {copied && <span className="text-[10px] text-emerald-600 font-bold">Copied!</span>}
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    Placed on {currentOrder.placedDate}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                    <Truck className="w-3.5 h-3.5" />
                    <span>Out for Delivery</span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-1">
                    Estimated delivery: {currentOrder.estimatedDelivery}
                  </p>
                </div>
              </div>

              {/* Product Item Row */}
              <div className="py-5 flex items-center gap-4 border-b border-slate-100">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-50 border border-slate-200/80 shrink-0 p-1 flex items-center justify-center">
                  <img
                    src={currentOrder.product.image}
                    alt={currentOrder.product.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 leading-snug">
                        {currentOrder.product.name}
                      </h3>
                      <p className="text-xs text-slate-400 font-medium mt-0.5">
                        {currentOrder.product.variant}
                      </p>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Sold by <span className="text-blue-600 font-semibold">{currentOrder.product.seller}</span>
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-slate-400 shrink-0">
                      Qty: {currentOrder.product.quantity}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-base sm:text-lg font-black text-slate-900">
                      ₦{currentOrder.product.price.toLocaleString()}
                    </span>
                    <Link
                      to="/shop"
                      className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
                    >
                      View Product
                    </Link>
                  </div>
                </div>
              </div>

              {/* 5-Stage Tracking Timeline */}
              <div className="pt-6">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5">
                  Shipment Progress
                </h4>

                <div className="relative pl-6 sm:pl-8 space-y-7">
                  {/* Timeline connecting line */}
                  <div className="absolute left-[13px] sm:left-[17px] top-3 bottom-3 w-0.5 bg-slate-200" />

                  {trackingSteps.map((step, idx) => {
                    return (
                      <div key={idx} className="relative flex items-start justify-between gap-4 group">
                        {/* Node Icon */}
                        <div className="absolute -left-6 sm:-left-8 top-0.5 flex items-center justify-center">
                          {step.completed ? (
                            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 ring-4 ring-white">
                              <Check className="w-4 h-4 stroke-[3]" />
                            </div>
                          ) : step.active ? (
                            <div className="relative w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30 ring-4 ring-white">
                              <div className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                              <div className="absolute w-2.5 h-2.5 rounded-full bg-white" />
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center ring-4 ring-white">
                              <div className="w-2 h-2 rounded-full bg-slate-400" />
                            </div>
                          )}
                        </div>

                        {/* Text */}
                        <div className="flex-1">
                          <h5 className={`text-sm font-black ${
                            step.active ? 'text-blue-600' : step.completed ? 'text-slate-900' : 'text-slate-400'
                          }`}>
                            {step.title}
                          </h5>
                          <p className="text-xs text-slate-500 font-medium mt-0.5 leading-relaxed">
                            {step.description}
                          </p>
                        </div>

                        {/* Timestamp */}
                        <span className={`text-xs font-semibold shrink-0 ${
                          step.active ? 'text-blue-600 font-bold' : step.completed ? 'text-slate-400' : 'text-slate-300'
                        }`}>
                          {step.timestamp}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live Tracking Map, Rider Card, Delivery Details (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            {/* Live Tracking Map Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-black text-slate-900 text-sm sm:text-base">Live Tracking</h3>
                <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 text-xs font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Live</span>
                </div>
              </div>

              {/* Styled Interactive-looking Vector Map */}
              <div className="relative h-64 bg-[#E8ECEF] overflow-hidden">
                {/* River depiction (Yobe River) */}
                <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="riverGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#BAE6FD" />
                      <stop offset="100%" stopColor="#7DD3FC" />
                    </linearGradient>
                  </defs>
                  {/* Water path */}
                  <path
                    d="M-20 200 C 80 180, 160 210, 260 190 C 340 170, 420 185, 520 175 L 520 260 L -20 260 Z"
                    fill="url(#riverGrad)"
                    opacity="0.8"
                  />
                  {/* Road Network */}
                  <path d="M 40 40 L 120 70 L 220 90 L 320 80 L 440 60" stroke="#CBD5E1" strokeWidth="6" fill="none" />
                  <path d="M 120 70 L 150 160 L 280 150" stroke="#CBD5E1" strokeWidth="5" fill="none" />
                  <path d="M 40 120 L 460 120" stroke="#E2E8F0" strokeWidth="4" fill="none" />
                  <path d="M 280 40 L 280 200" stroke="#E2E8F0" strokeWidth="4" fill="none" />

                  {/* Active Delivery Route in Bright Blue */}
                  <path
                    d="M 50 130 C 90 125, 140 100, 220 105 C 280 110, 320 70, 380 65"
                    stroke="#2563EB"
                    strokeWidth="4"
                    strokeDasharray="6 4"
                    fill="none"
                  />
                </svg>

                {/* Map Labels */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/85 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-200 text-xs font-black text-slate-800 shadow-sm">
                  Gashua
                </div>
                <div className="absolute bottom-16 left-12 text-[10px] font-bold text-slate-500 bg-white/70 px-2 py-0.5 rounded">
                  Sabon Gari
                </div>
                <div className="absolute bottom-20 right-16 text-[10px] font-bold text-slate-500 bg-white/70 px-2 py-0.5 rounded">
                  Tsohon Giri
                </div>
                <div className="absolute bottom-3 right-8 text-[10px] font-bold text-sky-700 italic">
                  Yobe River ~
                </div>

                {/* Depot / Start Marker */}
                <div className="absolute top-28 left-9 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg border-2 border-white">
                  <div className="w-2 h-2 rounded-full bg-white" />
                </div>

                {/* Van / Rider moving Marker on Route */}
                <div className="absolute top-20 left-48 bg-white p-1.5 rounded-xl shadow-xl border border-slate-300 text-blue-600 flex items-center justify-center transform -translate-x-1/2 -translate-y-1/2 animate-bounce">
                  <Truck className="w-4 h-4 fill-blue-600 text-white" />
                </div>

                {/* Destination / House Marker */}
                <div className="absolute top-11 right-12 w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xl border-2 border-white">
                  <MapPin className="w-4 h-4 fill-white text-emerald-600" />
                </div>

                {/* Map Controls */}
                <div className="absolute right-3 bottom-3 flex flex-col gap-1.5">
                  <button className="w-7 h-7 bg-white/95 rounded-lg shadow border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-100 text-xs font-bold">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button className="w-7 h-7 bg-white/95 rounded-lg shadow border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-100 text-xs font-bold">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button className="w-7 h-7 bg-white/95 rounded-lg shadow border border-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-100 text-xs font-bold">
                    <Navigation className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Rider Status Strip */}
              <div className="p-4 bg-slate-50/80 flex items-center justify-between gap-3 border-t border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="text-xs sm:text-sm font-black text-slate-900">{currentOrder.rider.status}</h5>
                    <p className="text-[11px] text-slate-500 font-medium">{currentOrder.rider.subtext}</p>
                  </div>
                </div>

                <a
                  href={`tel:${currentOrder.rider.phone}`}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-800 text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-all"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Call Rider</span>
                </a>
              </div>
            </div>

            {/* Delivery Details Card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3.5">
              <h3 className="font-black text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-[#00BFA5]" />
                <span>Delivery Details</span>
              </h3>

              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Delivery Method</span>
                  <span className="font-bold text-slate-800">{currentOrder.deliveryMethod}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Estimated Delivery</span>
                  <span className="font-bold text-slate-800">{currentOrder.estimatedTimeWindow}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Tracking ID</span>
                  <span className="font-bold text-slate-800 font-mono">{currentOrder.trackingId}</span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-500 font-medium">Payment Method</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {currentOrder.paymentMethod}
                  </span>
                </div>
              </div>
            </div>

            {/* Support Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                to="/contact"
                className="py-3 px-4 bg-[#0A192F] hover:bg-[#112240] text-white rounded-2xl text-xs font-bold text-center flex items-center justify-center gap-2 shadow-md transition-all active:scale-95"
              >
                <Headset className="w-4 h-4 text-[#00BFA5]" />
                <span>Contact Support</span>
              </Link>
              <Link
                to="/contact"
                className="py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 rounded-2xl text-xs font-bold text-center flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
              >
                <HelpCircle className="w-4 h-4 text-slate-500" />
                <span>Need Help?</span>
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OrderTracking;