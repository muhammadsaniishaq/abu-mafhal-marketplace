import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Store, CheckCircle, Star, Heart, Search, Bell, ShoppingCart, User,
  MapPin, ChevronRight, ArrowRight, ExternalLink, ShieldCheck, Plus,
  Shirt, Laptop, Sparkles, Home, ShoppingBasket, Headphones,
  Activity, Trophy, BookOpen, Car, MoreHorizontal, Check
} from 'lucide-react';

const Stores = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('popular');
  const [activeCategory, setActiveCategory] = useState('all');
  const [followedStores, setFollowedStores] = useState({});

  const toggleFollow = (storeId) => {
    setFollowedStores(prev => ({
      ...prev,
      [storeId]: !prev[storeId]
    }));
  };

  const categories = [
    { id: 'all', label: 'All Stores', icon: Store },
    { id: 'fashion', label: 'Fashion', icon: Shirt },
    { id: 'electronics', label: 'Electronics', icon: Laptop },
    { id: 'beauty', label: 'Beauty', icon: Sparkles },
    { id: 'home', label: 'Home & Living', icon: Home },
    { id: 'groceries', label: 'Groceries', icon: ShoppingBasket },
    { id: 'accessories', label: 'Mobile Accessories', icon: Headphones },
    { id: 'health', label: 'Health & Wellness', icon: Activity },
    { id: 'sports', label: 'Sports', icon: Trophy },
    { id: 'books', label: 'Books & Stationery', icon: BookOpen },
    { id: 'auto', label: 'Automotive', icon: Car },
    { id: 'more', label: 'More', icon: MoreHorizontal },
  ];

  const featuredStores = [
    {
      id: 'store-elson',
      name: 'ELSON Boutique',
      tagline: 'Fashion for Every You',
      rating: 4.8,
      reviews: '2.1K',
      productsCount: 356,
      avatar: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=150&q=80',
      banner: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500&q=80',
      category: 'fashion',
      verified: true,
    },
    {
      id: 'store-techhub',
      name: 'TechHUB',
      tagline: 'Smart Choices, Better Life',
      rating: 4.7,
      reviews: '1.9K',
      productsCount: 482,
      avatar: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=150&q=80',
      banner: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=500&q=80',
      category: 'electronics',
      verified: true,
    },
    {
      id: 'store-freshmart',
      name: 'FreshMart',
      tagline: 'Groceries & More',
      rating: 4.6,
      reviews: '1.5K',
      productsCount: 620,
      avatar: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=150&q=80',
      banner: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&q=80',
      category: 'groceries',
      verified: true,
    },
    {
      id: 'store-glowville',
      name: 'GlowVille Beauty',
      tagline: 'Beauty Redefined',
      rating: 4.8,
      reviews: '2.3K',
      productsCount: 410,
      avatar: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=150&q=80',
      banner: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=500&q=80',
      category: 'beauty',
      verified: true,
    },
  ];

  const popularProducts = [
    {
      id: 'prod-infinix',
      name: 'Infinix Note 40 Pro',
      store: 'TechHub Store',
      price: 389000,
      oldPrice: null,
      rating: 4.8,
      reviews: 320,
      image: 'https://images.unsplash.com/photo-1591337676887-a217a6970a8a?w=300&q=80',
    },
    {
      id: 'prod-sneakers',
      name: 'Men Sport Sneakers',
      store: 'ELSON Boutique',
      price: 24500,
      oldPrice: 29000,
      discount: '-15%',
      rating: 4.6,
      reviews: 210,
      image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&q=80',
    },
    {
      id: 'prod-airfryer',
      name: 'Binatone Air Fryer 5.5L',
      store: 'HomeSmart',
      price: 78000,
      oldPrice: null,
      rating: 4.7,
      reviews: 95,
      image: 'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?w=300&q=80',
    },
    {
      id: 'prod-handbag',
      name: 'Ladies Handbag',
      store: 'ELSON Boutique',
      price: 16000,
      oldPrice: 20000,
      discount: '-20%',
      rating: 4.8,
      reviews: 180,
      image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=300&q=80',
    },
    {
      id: 'prod-rice',
      name: 'Mama Gold Parboiled Rice 5kg',
      store: 'FreshMart',
      price: 8500,
      oldPrice: null,
      rating: 4.6,
      reviews: 410,
      image: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=300&q=80',
    },
    {
      id: 'prod-smartwatch',
      name: 'Oraimo Smart Watch',
      store: 'TechHub Store',
      price: 42000,
      oldPrice: null,
      rating: 4.5,
      reviews: 260,
      image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F4F7FB] font-sans text-slate-800 antialiased selection:bg-[#00BFA5] selection:text-white">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 px-4 lg:px-8 py-2.5 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0A192F] to-[#1E3A8A] flex items-center justify-center p-0.5 shadow-md shadow-slate-900/10 border border-amber-400/40">
              <span className="font-black text-[#F59E0B] text-base tracking-tighter">AM</span>
            </div>
            <div>
              <h1 className="text-base font-black tracking-tight text-[#0A192F] leading-none uppercase">Abu Mafhal</h1>
              <p className="text-[10px] text-slate-500 font-medium">Your Marketplace, Your Choice.</p>
            </div>
          </Link>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-xl mx-6">
            <div className="w-full flex items-center bg-slate-100/90 border border-slate-200/90 rounded-xl overflow-hidden focus-within:border-[#00BFA5] focus-within:ring-2 focus-within:ring-[#00BFA5]/20 transition-all">
              <input
                type="text"
                placeholder="Search for products, brands, or stores..."
                className="w-full bg-transparent px-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
              />
              <button className="bg-[#0A192F] hover:bg-[#112240] text-white p-2.5 px-4 transition-colors">
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Location & Quick Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-700 bg-slate-100/80 px-3 py-1.5 rounded-xl border border-slate-200/80">
              <MapPin className="w-3.5 h-3.5 text-[#00BFA5]" />
              <span>Deliver to <strong>Gashua, Yobe</strong></span>
            </div>

            <Link to="/cart" className="relative p-2 text-slate-700 hover:bg-slate-100 rounded-xl">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white font-black text-[10px] rounded-full flex items-center justify-center">
                2
              </span>
            </Link>

            <Link to="/notifications" className="relative p-2 text-slate-700 hover:bg-slate-100 rounded-xl">
              <Bell className="w-5 h-5" />
            </Link>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-[#00BFA5] text-white flex items-center justify-center text-xs font-bold">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-xs font-bold text-slate-900">Muhammad Sani</p>
                <p className="text-[10px] text-slate-400">Customer</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Header Title & Become a Seller CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Top Stores</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Discover trusted stores and shop from verified sellers on ABU MAFHAL.
            </p>
          </div>

          <Link
            to="/vendor/register"
            className="self-start sm:self-auto px-5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 font-bold text-xs rounded-xl shadow-sm flex items-center gap-2 transition-all active:scale-95"
          >
            <Store className="w-4 h-4" />
            <span>Become a Seller</span>
          </Link>
        </div>

        {/* Sub-Tabs: Popular Stores, Top Rated, New Stores, Official Stores */}
        <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 pb-4 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            {[
              { id: 'popular', label: 'Popular Stores' },
              { id: 'top_rated', label: 'Top Rated' },
              { id: 'new_stores', label: 'New Stores' },
              { id: 'official', label: 'Official Stores' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-[#00BFA5] text-white shadow-md shadow-[#00BFA5]/25'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Link to="/shop" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 shrink-0">
            <span>View All Stores</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Horizontal Category Selector Icons */}
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2.5">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isSelected = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                  isSelected
                    ? 'bg-white border-[#00BFA5] ring-2 ring-[#00BFA5]/20 shadow-sm'
                    : 'bg-white border-slate-200/80 hover:border-slate-300 text-slate-600'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 ${
                  isSelected ? 'bg-[#00BFA5]/10 text-[#00BFA5]' : 'bg-slate-100 text-slate-600'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`text-[11px] truncate w-full font-bold ${
                  isSelected ? 'text-[#00BFA5]' : 'text-slate-700'
                }`}>
                  {cat.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* 4 Featured Store Cards (Row of 4) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {featuredStores.map((store) => {
            const isFollowed = followedStores[store.id];
            return (
              <div
                key={store.id}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Banner Image */}
                  <div className="h-32 w-full relative overflow-hidden bg-slate-100">
                    <img
                      src={store.banner}
                      alt={store.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  </div>

                  {/* Avatar & Store Info */}
                  <div className="p-4 pt-0 relative">
                    <div className="relative -mt-9 mb-2 flex items-end justify-between">
                      <div className="w-16 h-16 rounded-2xl overflow-hidden border-4 border-white shadow-md bg-white">
                        <img src={store.avatar} alt={store.name} className="w-full h-full object-cover" />
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm sm:text-base font-black text-slate-900 truncate">
                        {store.name}
                      </h3>
                      {store.verified && (
                        <CheckCircle className="w-4 h-4 fill-blue-500 text-white shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 font-medium truncate mt-0.5">{store.tagline}</p>

                    <div className="flex items-center gap-3 text-xs text-slate-600 mt-2 font-semibold">
                      <div className="flex items-center gap-1 text-amber-500 font-bold">
                        <Star className="w-3.5 h-3.5 fill-amber-500" />
                        <span>{store.rating}</span>
                        <span className="text-slate-400 font-normal">({store.reviews})</span>
                      </div>
                      <span className="text-slate-300">|</span>
                      <span>{store.productsCount} Products</span>
                    </div>
                  </div>
                </div>

                {/* Follow & View Store Buttons */}
                <div className="p-4 pt-0 grid grid-cols-2 gap-2 mt-2">
                  <button
                    onClick={() => toggleFollow(store.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all ${
                      isFollowed
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${isFollowed ? 'fill-emerald-600 text-emerald-600' : ''}`} />
                    <span>{isFollowed ? 'Following' : 'Follow'}</span>
                  </button>

                  <Link
                    to="/shop"
                    className="py-2 px-3 bg-[#0A192F] hover:bg-[#112240] text-white text-xs font-bold rounded-xl text-center shadow-sm transition-all"
                  >
                    View Store
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Section: Popular Products from Top Stores */}
        <div className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900">Popular Products from Top Stores</h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">Handpicked products from our verified stores</p>
            </div>
            <Link to="/shop" className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
              <span>View All Products</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {popularProducts.map((prod) => (
              <div
                key={prod.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group"
              >
                {/* Wishlist Heart */}
                <button className="absolute top-2.5 right-2.5 p-1 text-slate-300 hover:text-rose-500 rounded-full bg-white/85 backdrop-blur-sm z-10 transition-colors">
                  <Heart className="w-3.5 h-3.5" />
                </button>

                {/* Discount badge if present */}
                {prod.discount && (
                  <span className="absolute top-2.5 left-2.5 px-1.5 py-0.5 bg-rose-500 text-white font-black text-[9px] rounded z-10">
                    {prod.discount}
                  </span>
                )}

                <div>
                  {/* Image */}
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-slate-50 mb-2 flex items-center justify-center p-2">
                    <img
                      src={prod.image}
                      alt={prod.name}
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  <h3 className="text-xs font-black text-slate-900 truncate leading-snug">{prod.name}</h3>
                  <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">{prod.store}</p>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-black text-slate-900">₦{prod.price.toLocaleString()}</p>
                    {prod.oldPrice && (
                      <p className="text-[10px] text-slate-400 line-through">₦{prod.oldPrice.toLocaleString()}</p>
                    )}
                    <div className="flex items-center gap-1 text-[10px] font-bold text-amber-500 mt-0.5">
                      <span>★ {prod.rating}</span>
                      <span className="text-slate-400 font-normal">({prod.reviews})</span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate('/cart')}
                    className="p-2 rounded-xl bg-[#0A192F] hover:bg-[#112240] text-white transition-colors shadow-sm"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Stores;
