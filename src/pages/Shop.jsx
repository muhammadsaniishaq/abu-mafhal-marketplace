import { supabase } from '../config/supabase';

const Shop = () => {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [flashSales, setFlashSales] = useState([]);
  const [loading, setLoading] = useState(true);

  // ... rest of states

  useEffect(() => {
    fetchProducts();
    fetchFlashSales();
    if (currentUser) {
      checkVendorApplicationStatus();
    }
    const interval = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'approved');

      if (error) throw error;

      const productsData = (data || []).map(p => ({
        ...p,
        createdAt: p.created_at || new Date().toISOString()
      }));
      setProducts(productsData);
    } catch (error) {
      console.error('Error fetching products from Supabase:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlashSales = async () => {
    try {
      const { data, error } = await supabase
        .from('flash_sales') // Guessing the table name based on mobile
        .select('*')
        .eq('active', true);

      if (!error && data) {
        setFlashSales(data.filter(sale => new Date(sale.end_date) > new Date()));
      }
    } catch (error) {
      console.error('Error fetching flash sales from Supabase:', error);
    }
  };

  const checkVendorApplicationStatus = async () => {
    if (currentUser?.role === 'buyer') {
      try {
        const appDoc = await getDoc(doc(db, 'vendorApplications', currentUser.uid));
        if (appDoc.exists()) {
          setVendorApplicationStatus(appDoc.data().status);
        }
      } catch (error) {
        console.error('Error checking vendor application:', error);
      }
    }
  };

  const handleVoiceSearch = () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setSearchQuery(transcript);
      };
      recognition.onerror = () => {
        setIsRecording(false);
        alert('Voice search error. Please try again.');
      };
      recognition.start();
    } else {
      alert('Voice search is not supported in your browser.');
    }
  };

  const handleImageSearch = (e) => {
    const file = e.target.files[0];
    if (file) {
      alert('AI Image Search feature coming soon!');
      e.target.value = '';
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      try {
        await logout();
        setShowMenu(false);
        navigate('/login');
      } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
      }
    }
  };

  const filteredProducts = products
    .filter(product => {
      const matchesSearch = !searchQuery ||
        product.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.category?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' ||
        product.category?.toLowerCase() === selectedCategory.toLowerCase();
      const matchesPrice = (product.price >= priceRange.min) && (product.price <= priceRange.max);
      return matchesSearch && matchesCategory && matchesPrice;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-low': return (a.price || 0) - (b.price || 0);
        case 'price-high': return (b.price || 0) - (a.price || 0);
        case 'name': return (a.name || '').localeCompare(b.name || '');
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'newest':
        default: return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Pending Review', color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800', icon: '⏳' },
      processing: { text: 'Processing', color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800', icon: '⚙️' },
      approved: { text: 'Approved', color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800', icon: '✅' },
      rejected: { text: 'Rejected', color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800', icon: '❌' }
    };
    return badges[status] || null;
  };

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setPriceRange({ min: 0, max: 1000000 });
    setSortBy('newest');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setShowMenu(!showMenu)} className="text-2xl p-2 hover:bg-white/10 rounded-lg transition-colors">☰</button>
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="Abu Mafhal" className="h-8 w-auto" />
              <span className="font-bold text-lg hidden sm:inline">Abu Mafhal</span>
            </Link>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Link to="/cart" className="text-2xl p-2 relative hover:bg-white/10 rounded-lg transition-colors">
                🛒
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold shadow-lg">0</span>
              </Link>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 relative">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search products, categories..." className="w-full pl-10 pr-4 py-2.5 rounded-full text-gray-900 focus:outline-none focus:ring-2 focus:ring-white shadow-md" />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-lg">🔍</span>
            </div>
            <button onClick={() => fileInputRef.current?.click()} className="p-2.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors shadow-md" title="AI Image Search">📷</button>
            <button onClick={handleVoiceSearch} className={`p-2.5 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-white/20 hover:bg-white/30'} rounded-full transition-colors shadow-md`} title="Voice Search">🎙️</button>
            <button onClick={() => setShowFilters(!showFilters)} className="p-2.5 bg-white/20 hover:bg-white/30 rounded-full transition-colors shadow-md" title="Filters">⚙️</button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSearch} className="hidden" />
          </div>
        </div>
      </div>

      {/* Hamburger Sidebar Menu */}
      {showMenu && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setShowMenu(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-800 z-50 shadow-2xl overflow-y-auto">
            <div className="p-4 bg-gradient-to-r from-orange-500 to-red-500 text-white">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-2xl overflow-hidden border-2 border-white/30">
                  {currentUser?.avatar ? <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" /> : <span>👤</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{currentUser?.name || 'Guest User'}</p>
                  <p className="text-sm opacity-90 truncate">{currentUser?.email || 'Not logged in'}</p>
                  {currentUser?.role && <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full mt-1 inline-block capitalize">{currentUser.role}</span>}
                </div>
              </div>
              <button onClick={() => setShowMenu(false)} className="absolute top-4 right-4 text-2xl hover:bg-white/10 w-8 h-8 rounded-full transition-colors">✕</button>
            </div>

            <nav className="p-4 space-y-2">
              <Link to="/" className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setShowMenu(false)}><span className="text-xl">🏠</span><span className="font-medium">Home</span></Link>
              <Link to="/shop" className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg" onClick={() => setShowMenu(false)}><span className="text-xl">🏪</span><span className="font-medium">Shop</span></Link>

              {currentUser && (
                <>
                  {currentUser.role === 'admin' && <Link to="/admin" className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setShowMenu(false)}><span className="text-xl">👑</span><span className="font-medium">Admin Dashboard</span></Link>}
                  {currentUser.role === 'vendor' && <Link to="/vendor" className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setShowMenu(false)}><span className="text-xl">📊</span><span className="font-medium">Vendor Dashboard</span></Link>}
                  {currentUser.role === 'buyer' && <Link to="/buyer" className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setShowMenu(false)}><span className="text-xl">📊</span><span className="font-medium">My Dashboard</span></Link>}

                  <Link to="/buyer/orders" className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setShowMenu(false)}><span className="text-xl">📦</span><span className="font-medium">My Orders</span></Link>
                  <Link to="/buyer/wishlist" className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setShowMenu(false)}><span className="text-xl">❤️</span><span className="font-medium">Wishlist</span></Link>
                  <Link to="/messages" className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setShowMenu(false)}><span className="text-xl">💬</span><span className="font-medium">Messages</span></Link>

                  {currentUser.role === 'buyer' && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                      {vendorApplicationStatus ? (
                        <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-2 mb-2"><span className="text-xl">🏪</span><span className="font-medium text-sm">Vendor Application</span></div>
                          <div className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 border ${getStatusBadge(vendorApplicationStatus)?.color}`}>
                            <span>{getStatusBadge(vendorApplicationStatus)?.icon}</span>
                            <span>{getStatusBadge(vendorApplicationStatus)?.text}</span>
                          </div>
                          {vendorApplicationStatus === 'rejected' && <Link to="/vendor-application" className="text-xs text-blue-600 dark:text-blue-400 hover:underline block mt-2" onClick={() => setShowMenu(false)}>Reapply Now</Link>}
                        </div>
                      ) : (
                        <Link to="/vendor-application" className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors border border-green-200 dark:border-green-800" onClick={() => setShowMenu(false)}><span className="text-xl">🏪</span><div className="flex-1"><span className="font-medium text-green-700 dark:text-green-400 block">Become a Vendor</span><span className="text-xs text-green-600 dark:text-green-500">Start selling on our platform</span></div></Link>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                <Link to="/about" className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setShowMenu(false)}><span className="text-xl">ℹ️</span><span className="font-medium">About Us</span></Link>
                <Link to="/contact" className="flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onClick={() => setShowMenu(false)}><span className="text-xl">📞</span><span className="font-medium">Contact</span></Link>
              </div>
            </nav>

            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              {currentUser ? (
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"><span className="text-xl">🚪</span><span>Logout</span></button>
              ) : (
                <div className="space-y-2">
                  <Link to="/login" className="w-full flex items-center justify-center gap-2 p-3 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors" onClick={() => setShowMenu(false)}><span className="text-xl">🔑</span><span>Login</span></Link>
                  <Link to="/register" className="w-full flex items-center justify-center gap-2 p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors" onClick={() => setShowMenu(false)}><span className="text-xl">✨</span><span>Register</span></Link>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Filter Sidebar */}
      {showFilters && (
        <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setShowFilters(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-white dark:bg-gray-800 p-6 overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Filters & Sort</h3>
              <button onClick={() => setShowFilters(false)} className="text-2xl hover:bg-gray-100 dark:hover:bg-gray-700 w-8 h-8 rounded-full transition-colors">✕</button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Sort By</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent">
                  <option value="newest">Newest First</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="name">Name A-Z</option>
                  <option value="rating">Highest Rated</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">Price Range</label>
                <div className="space-y-2">
                  <input type="range" min="0" max="1000000" step="10000" value={priceRange.max} onChange={(e) => setPriceRange({ ...priceRange, max: parseInt(e.target.value) })} className="w-full accent-orange-500" />
                  <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
                    <span>₦0</span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">₦{priceRange.max.toLocaleString()}</span>
                    <span>₦1M</span>
                  </div>
                </div>
              </div>
              <button onClick={resetFilters} className="w-full p-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors">Reset All Filters</button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Scrolling Banner */}
      <div className="relative h-40 md:h-48 overflow-hidden bg-gray-200 dark:bg-gray-800">
        {banners.map((banner, index) => (
          <Link key={banner.id} to={banner.link} className={`absolute inset-0 transition-opacity duration-1000 ${index === currentBanner ? 'opacity-100' : 'opacity-0'}`}>
            <img src={banner.image} alt={`Banner ${index + 1}`} className="w-full h-full object-cover" />
          </Link>
        ))}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {banners.map((_, index) => (
            <button key={index} onClick={() => setCurrentBanner(index)} className={`h-2 rounded-full transition-all ${index === currentBanner ? 'bg-orange-500 w-8' : 'bg-white/50 w-2 hover:bg-white/80'}`} />
          ))}
        </div>
      </div>

      {/* Flash Sales Section */}
      {flashSales.length > 0 && (
        <div className="max-w-7xl mx-auto p-4">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <span className="text-red-600">⚡ Flash Sales</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">Limited Time Offers</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {flashSales.map(sale => (
              <div key={sale.id} className="bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-lg p-6 shadow-xl">
                <h3 className="text-xl font-bold mb-2">{sale.title}</h3>
                <p className="text-sm opacity-90 mb-3">{sale.description}</p>
                <div className="bg-white/20 rounded-lg p-3 mb-3">
                  <p className="text-4xl font-bold text-center">{sale.discountPercentage}% OFF</p>
                </div>
                <p className="text-sm mb-2">🔥 Only {sale.totalStock - (sale.soldCount || 0)} items left!</p>
                <Link to={`/flash-sale/${sale.id}`} className="block mt-3 bg-white text-red-600 text-center py-2 rounded-lg font-bold hover:bg-gray-100 transition">Shop Now →</Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="bg-white dark:bg-gray-800 p-4 overflow-x-auto border-b border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="flex gap-2 min-w-max">
          {categories.map((cat) => (
            <button key={cat} onClick={() => setSelectedCategory(cat.toLowerCase())} className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all ${selectedCategory === cat.toLowerCase() ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>{cat}</button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto p-4 pb-24">
        <div className="flex justify-between items-center mb-4">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found</p>
          {searchQuery && <button onClick={() => setSearchQuery('')} className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1">Clear search ✕</button>}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading amazing products...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-6xl mb-4">📦</p>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">No products found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mb-4">{searchQuery ? `No results for "${searchQuery}". Try different keywords.` : 'Try adjusting your search or filters'}</p>
            <button onClick={resetFilters} className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors">Reset All Filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>


      {/* ==================== AI RECOMMENDATIONS SECTION ==================== */}
      {!loading && filteredProducts.length > 0 && (
        <div className="mt-12">
          <AIRecommendations />
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-around py-2">
            <Link to="/shop" className="flex flex-col items-center text-orange-500 py-2 px-3 transition-colors">
              <span className="text-2xl mb-1">🏪</span>
              <span className="text-xs font-medium">Shop</span>
            </Link>
            <Link to="/cart" className="flex flex-col items-center text-gray-600 dark:text-gray-400 hover:text-orange-500 py-2 px-3 transition-colors">
              <span className="text-2xl mb-1 relative">
                🛒
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">0</span>
              </span>
              <span className="text-xs font-medium">Cart</span>
            </Link>
            <Link to="/buyer/orders" className="flex flex-col items-center text-gray-600 dark:text-gray-400 hover:text-orange-500 py-2 px-3 transition-colors">
              <span className="text-2xl mb-1">📦</span>
              <span className="text-xs font-medium">Orders</span>
            </Link>
            <Link to="/buyer/wishlist" className="flex flex-col items-center text-gray-600 dark:text-gray-400 hover:text-orange-500 py-2 px-3 transition-colors">
              <span className="text-2xl mb-1">❤️</span>
              <span className="text-xs font-medium">Wishlist</span>
            </Link>
            <Link to="/buyer/profile" className="flex flex-col items-center text-gray-600 dark:text-gray-400 hover:text-orange-500 py-2 px-3 transition-colors">
              <span className="text-2xl mb-1">👤</span>
              <span className="text-xs font-medium">Account</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shop;