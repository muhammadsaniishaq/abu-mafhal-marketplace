import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { 
  Trash2, Plus, Minus, Check, MapPin, CreditCard, ShieldCheck,
  ChevronRight, ArrowLeft, ShoppingBag, Tag, Lock, ExternalLink,
  Store, Heart, Search, Bell, ShoppingCart, User
} from 'lucide-react';

const Cart = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { cartItems, removeFromCart, updateQuantity, clearCart } = useCart();

  // 5 Payment methods matching Screenshot 3
  const [selectedPayment, setSelectedPayment] = useState('paystack');
  const [selectedItems, setSelectedItems] = useState({ 0: true, 1: true, 2: true });

  // Default items matching Screenshot 3 if cart is empty or loaded
  const defaultItems = [
    {
      id: 'item-1',
      title: "Men's Sneakers",
      subtitle: 'Stylish Comfortable Sports Shoes',
      seller: 'UrbanStyle Fashion',
      size: '42',
      color: 'White/Blue',
      price: 28500,
      oldPrice: null,
      badge: 'New',
      badgeColor: 'bg-[#00BFA5] text-white',
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=200&q=80',
    },
    {
      id: 'item-2',
      title: 'Smart Watch',
      subtitle: 'Bluetooth Calling, Fitness Tracker',
      seller: 'TechWorld Store',
      size: null,
      color: 'Black',
      price: 45000,
      oldPrice: 53000,
      badge: '-15%',
      badgeColor: 'bg-rose-500 text-white',
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=200&q=80',
    },
    {
      id: 'item-3',
      title: 'Ladies Handbag',
      subtitle: 'Elegant Design, Premium Quality',
      seller: 'Classy Collections',
      size: null,
      color: 'Beige',
      price: 32000,
      oldPrice: null,
      badge: 'Bestseller',
      badgeColor: 'bg-amber-500 text-slate-900 font-bold',
      quantity: 1,
      image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=200&q=80',
    },
  ];

  // Recommendations carousel items
  const recommendations = [
    {
      id: 'rec-1',
      title: 'Smartphone 128GB',
      price: 185000,
      image: 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=150&q=80',
    },
    {
      id: 'rec-2',
      title: 'Noise Cancelling Headphones',
      price: 35000,
      image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&q=80',
    },
    {
      id: 'rec-3',
      title: 'Luxury Perfume 100ml',
      price: 22000,
      image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=150&q=80',
    },
    {
      id: 'rec-4',
      title: 'Leather Wallet AM Edition',
      price: 12000,
      image: 'https://images.unsplash.com/photo-1627123424574-724758594e93?w=150&q=80',
    },
  ];

  // Local state for items
  const [items, setItems] = useState(
    cartItems && cartItems.length > 0 ? cartItems : defaultItems
  );

  const toggleSelect = (idx) => {
    setSelectedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleQtyChange = (idx, delta) => {
    setItems(prev => {
      const copy = [...prev];
      const newQty = Math.max(1, (copy[idx].quantity || 1) + delta);
      copy[idx] = { ...copy[idx], quantity: newQty };
      return copy;
    });
  };

  const handleRemove = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Calculations matching Screenshot 3
  const subtotal = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
  const deliveryFee = 2000;
  const discount = 5000;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-sans text-slate-800 antialiased selection:bg-[#00BFA5] selection:text-white">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-4 lg:px-8 py-2.5 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0A192F] to-[#1E3A8A] flex items-center justify-center p-0.5 shadow-md shadow-slate-900/10 border border-amber-400/40">
              <span className="font-black text-[#F59E0B] text-base tracking-tighter">AM</span>
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-[#0A192F] leading-none uppercase">Abu Mafhal</h1>
              <p className="text-[10px] text-slate-500 font-medium">Your Marketplace, Your Choice.</p>
            </div>
          </Link>

          <div className="hidden md:flex flex-1 max-w-xl mx-6">
            <div className="w-full flex items-center bg-slate-100/90 border border-slate-200/90 rounded-xl overflow-hidden focus-within:border-[#00BFA5] focus-within:ring-2 focus-within:ring-[#00BFA5]/20 transition-all">
              <div className="pl-3.5 text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search for products, brands, or stores..."
                className="w-full bg-transparent px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button className="bg-[#0A192F] hover:bg-[#112240] text-white p-2 px-4 transition-colors">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/cart" className="relative p-2 text-slate-700 hover:bg-slate-100 rounded-xl">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center">
                {items.length}
              </span>
            </Link>

            <Link to="/notifications" className="relative p-2 text-slate-700 hover:bg-slate-100 rounded-xl">
              <Bell className="w-5 h-5" />
            </Link>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-[#0A192F] text-white flex items-center justify-center text-xs font-bold">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-xs font-bold text-slate-900">My Account</p>
                <p className="text-[10px] text-slate-400">Shop Smarter</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Cart Body */}
      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
        {/* Breadcrumb & Title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mb-1">
              <Link to="/" className="hover:text-slate-700">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-slate-700 font-bold">My Cart</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              My Cart <span className="text-lg text-slate-500 font-bold">({items.length} items)</span>
            </h1>
          </div>

          {items.length > 0 && (
            <button
              onClick={() => setItems([])}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 transition-colors p-2 rounded-xl hover:bg-rose-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear Cart</span>
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center max-w-lg mx-auto border border-slate-200/80 shadow-sm">
            <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
              <ShoppingBag className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-2">Your Cart is Empty</h3>
            <p className="text-xs text-slate-500 mb-6">Explore our marketplace and add top deals to your cart today.</p>
            <Link
              to="/shop"
              className="px-6 py-3 bg-[#0A192F] hover:bg-[#112240] text-white text-xs font-bold rounded-xl shadow-md transition-all inline-block"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Cart Items + Continue Shopping + Recommendations (7 Cols) */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-3.5">
                {items.map((item, idx) => {
                  const isChecked = selectedItems[idx] !== false;
                  return (
                    <div
                      key={item.id || idx}
                      className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-sm hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      {/* Checkbox + Thumbnail + Product Info */}
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        {/* Custom Round Checkbox */}
                        <button
                          onClick={() => toggleSelect(idx)}
                          className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                            isChecked ? 'bg-blue-600 text-white' : 'border-2 border-slate-300'
                          }`}
                        >
                          {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        {/* Image Thumbnail with Badge */}
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shrink-0 flex items-center justify-center p-1">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-full object-contain"
                          />
                          {item.badge && (
                            <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${item.badgeColor}`}>
                              {item.badge}
                            </span>
                          )}
                        </div>

                        {/* Details */}
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-black text-slate-900 truncate leading-tight">
                            {item.title}
                          </h4>
                          {item.subtitle && (
                            <p className="text-xs text-slate-500 truncate mt-0.5">{item.subtitle}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                            Sold by <span className="font-bold text-slate-800">{item.seller}</span>
                            <span className="w-3.5 h-3.5 rounded-full bg-blue-500 text-white flex items-center justify-center text-[8px]">✓</span>
                          </p>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                            {item.size && <span>Size: <strong className="text-slate-700">{item.size}</strong></span>}
                            {item.color && <span>Colour: <strong className="text-slate-700">{item.color}</strong></span>}
                          </div>
                        </div>
                      </div>

                      {/* Stepper + Price + Remove */}
                      <div className="flex items-center justify-between sm:flex-col sm:items-end gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                        {/* Price */}
                        <div className="text-left sm:text-right">
                          <p className="text-base sm:text-lg font-black text-slate-900">
                            ₦{item.price.toLocaleString()}
                          </p>
                          {item.oldPrice && (
                            <p className="text-xs text-slate-400 line-through">
                              ₦{item.oldPrice.toLocaleString()}
                            </p>
                          )}
                        </div>

                        {/* Quantity Stepper */}
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-0.5">
                            <button
                              onClick={() => handleQtyChange(idx, -1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-black text-slate-900">
                              {item.quantity || 1}
                            </span>
                            <button
                              onClick={() => handleQtyChange(idx, 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white text-slate-600 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          {/* Remove */}
                          <button
                            onClick={() => handleRemove(idx)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold"
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add more items strip + Continue Shopping button */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-slate-900">Add more items</h5>
                    <p className="text-[11px] text-slate-400">Explore more products from top stores</p>
                  </div>
                </div>

                <Link
                  to="/shop"
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Continue Shopping</span>
                </Link>
              </div>

              {/* Recommendations Carousel */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-black text-slate-900">You may also like</h4>
                  <Link to="/shop" className="text-xs font-bold text-blue-600 hover:underline">
                    View all
                  </Link>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.id}
                      className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-sm hover:shadow-md transition-all group relative"
                    >
                      <button className="absolute top-2.5 right-2.5 p-1 text-slate-300 hover:text-rose-500 rounded-full bg-white/80 backdrop-blur-sm z-10 transition-colors">
                        <Heart className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-50 mb-2 flex items-center justify-center p-2">
                        <img
                          src={rec.image}
                          alt={rec.title}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                        />
                      </div>
                      <h5 className="text-xs font-bold text-slate-900 truncate">{rec.title}</h5>
                      <p className="text-xs font-black text-[#0A192F] mt-1">₦{rec.price.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Order Summary, Address, Payment Methods, Golden CTA (5 Cols) */}
            <div className="lg:col-span-5 space-y-5">
              {/* Order Summary Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-4">
                <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#00BFA5]" />
                  <span>Order Summary</span>
                </h3>

                <div className="space-y-2.5 text-xs text-slate-600">
                  <div className="flex items-center justify-between">
                    <span>Subtotal ({items.length} items)</span>
                    <span className="font-black text-slate-900">₦{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Delivery Fee</span>
                    <span className="font-bold text-slate-800">₦{deliveryFee.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-emerald-600 font-bold">
                    <span>Discount</span>
                    <span>- ₦{discount.toLocaleString()}</span>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-sm font-black text-slate-900">Total</span>
                  <span className="text-xl font-black text-slate-900">₦{total.toLocaleString()}</span>
                </div>

                {/* Green Savings Pill */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-emerald-800">You're saving ₦5,000!</p>
                    <p className="text-[10px] text-emerald-600 font-medium">Great choice!</p>
                  </div>
                </div>
              </div>

              {/* Delivery Address Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-[#00BFA5]" />
                    <span>Delivery Address</span>
                  </h4>
                  <button className="text-xs font-bold text-blue-600 hover:underline">Change</button>
                </div>

                <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 flex items-center justify-between">
                  <div className="text-xs text-slate-600 leading-relaxed">
                    <p className="font-black text-slate-900">
                      {currentUser?.name || 'Muhammad Sani Isyaku'}
                    </p>
                    <p className="text-[11px] text-slate-500">No. 12, Kano Road, Gashua</p>
                    <p className="text-[11px] text-slate-500">Yobe State, Nigeria</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 text-xs sm:text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#00BFA5]" />
                    <span>Payment Method</span>
                  </h4>
                  <span className="text-xs font-bold text-blue-600 cursor-pointer hover:underline">See all</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {/* Paystack */}
                  <button
                    onClick={() => setSelectedPayment('paystack')}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      selectedPayment === 'paystack'
                        ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]">✓</div>
                    <span className="text-xs font-black text-slate-900">Paystack</span>
                  </button>

                  {/* Flutterwave */}
                  <button
                    onClick={() => setSelectedPayment('flutterwave')}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      selectedPayment === 'flutterwave'
                        ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-orange-500 text-white flex items-center justify-center text-[10px]">✦</div>
                    <span className="text-xs font-black text-slate-900">Flutterwave</span>
                  </button>

                  {/* Wallet */}
                  <button
                    onClick={() => setSelectedPayment('wallet')}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      selectedPayment === 'wallet'
                        ? 'border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">💼</div>
                    <div>
                      <p className="text-xs font-black text-slate-900">Wallet</p>
                      <p className="text-[10px] text-slate-400 font-medium">₦12,350</p>
                    </div>
                  </button>

                  {/* Crypto */}
                  <button
                    onClick={() => setSelectedPayment('crypto')}
                    className={`p-3 rounded-xl border text-left flex items-center gap-2 transition-all ${
                      selectedPayment === 'crypto'
                        ? 'border-purple-600 bg-purple-50/50 ring-2 ring-purple-600/20'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center text-[10px]">₿</div>
                    <div>
                      <p className="text-xs font-black text-slate-900">Crypto</p>
                      <p className="text-[10px] text-slate-400 font-medium">USDT, BTC</p>
                    </div>
                  </button>
                </div>

                {/* Pay on Delivery full width */}
                <button
                  onClick={() => setSelectedPayment('cod')}
                  className={`w-full p-3 rounded-xl border text-left flex items-center justify-between transition-all ${
                    selectedPayment === 'cod'
                      ? 'border-slate-900 bg-slate-50 ring-2 ring-slate-900/20'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🚚</span>
                    <span className="text-xs font-black text-slate-900">Pay on Delivery</span>
                  </div>
                  <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
                    Available in Gashua
                  </span>
                </button>
              </div>

              {/* Golden Checkout Button */}
              <button
                onClick={() => navigate('/checkout')}
                className="w-full py-4 px-6 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                <Lock className="w-4 h-4" />
                <span>Proceed to Checkout</span>
                <span>→</span>
              </button>

              {/* Trust Badge */}
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Secure & Encrypted Payment</span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Cart;