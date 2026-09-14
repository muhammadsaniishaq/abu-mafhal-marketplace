import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { useCart } from '../context/CartContext';
import AddToWishlistButton from '../components/common/AddToWishlistButton';
import ProductReviews from '../components/common/ProductReviews';
import { Skeleton } from '../components/ui/Skeleton';
import { 
  ShieldCheck, 
  Truck, 
  RotateCcw, 
  MessageCircle, 
  Store, 
  CheckCircle2, 
  Share2, 
  ShoppingBag, 
  Zap, 
  ChevronRight, 
  Star, 
  Minus, 
  Plus, 
  Award,
  Package,
  Check
} from 'lucide-react';

const ProductDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [product, setProduct] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingVendor, setLoadingVendor] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    setLoading(true);
    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
        
      if (productError) throw productError;

      if (productData) {
        setProduct(productData);
        fetchVendor(productData);

        // Fetch related products
        if (productData.category) {
          const { data: relatedData, error: relatedError } = await supabase
            .from('products')
            .select('*')
            .eq('category', productData.category)
            .eq('status', 'approved')
            .neq('id', id)
            .limit(4);

          if (!relatedError && relatedData) {
            setRelatedProducts(relatedData);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching product:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchVendor = async (currentProd) => {
    setLoadingVendor(true);
    const vId = currentProd?.vendor_id || currentProd?.user_id;

    // Default Abu Mafhal Official Store
    const officialStore = {
      id: 'official',
      name: 'Abu Mafhal Official Store',
      business_name: 'Abu Mafhal Official Store',
      role: 'admin',
      isOfficial: true,
      is_verified: true,
      rating: 5.0,
      reviews: '3.8K+',
      phone: '2349021486162',
      whatsapp: '2349021486162',
      avatar: null,
      tagline: 'Official Flagship Mall • 100% Genuine Guaranteed'
    };

    if (!vId || vId === 'admin') {
      setVendor(officialStore);
      setLoadingVendor(false);
      return;
    }

    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', vId)
        .maybeSingle();

      if (data) {
        let vAddr = {};
        if (data.address && typeof data.address === 'string') {
          try {
            if (data.address.startsWith('{') && data.address.endsWith('}')) {
              vAddr = JSON.parse(data.address);
            }
          } catch (_) {}
        }

        setVendor({
          id: data.id,
          name: data.business_name || data.full_name || 'Verified Merchant',
          business_name: data.business_name || data.full_name || 'Verified Merchant',
          role: data.role || 'vendor',
          isOfficial: data.role === 'admin',
          is_verified: true,
          rating: 4.9,
          reviews: '120+',
          phone: data.phone || data.phone_number || '2349021486162',
          whatsapp: vAddr.whatsapp || data.phone || data.phone_number || '2349021486162',
          avatar: data.avatar_url || null,
          tagline: vAddr.tagline || 'Verified Marketplace Merchant'
        });
      } else {
        setVendor(officialStore);
      }
    } catch {
      setVendor(officialStore);
    } finally {
      setLoadingVendor(false);
    }
  };

  // Image list parsing
  const getImages = () => {
    if (!product) return [];
    let list = [];
    if (Array.isArray(product.images) && product.images.length > 0) {
      list = product.images;
    } else if (typeof product.images === 'string' && product.images.startsWith('[')) {
      try { list = JSON.parse(product.images); } catch (_) {}
    } else if (product.image_url) {
      list = [product.image_url];
    }
    return list.filter(img => typeof img === 'string' && img.trim().length > 0);
  };

  const images = getImages();
  const currentStock = product?.stock ?? product?.stock_quantity ?? 0;
  const originalPrice = product?.compare_at_price || product?.original_price || product?.originalPrice;
  const hasDiscount = originalPrice && originalPrice > product?.price;
  const discountPercent = hasDiscount ? Math.round(((originalPrice - product.price) / originalPrice) * 100) : 0;

  const handleAddToCart = () => {
    if (currentStock === 0) {
      alert('This product is currently out of stock');
      return;
    }
    if (quantity > currentStock) {
      alert(`Only ${currentStock} items available in stock`);
      return;
    }
    addToCart(product, quantity, selectedVariants);
    alert('Added to cart successfully!');
  };

  const handleBuyNow = () => {
    if (currentStock === 0) {
      alert('This product is currently out of stock');
      return;
    }
    addToCart(product, quantity, selectedVariants);
    navigate('/checkout');
  };

  const handleVendorWhatsApp = () => {
    if (!vendor || !product) return;
    const rawNum = (vendor.whatsapp || vendor.phone || '2349021486162').replace(/[^0-9]/g, '');
    const cleanNum = rawNum.startsWith('0') ? '234' + rawNum.substring(1) : rawNum.startsWith('234') ? rawNum : '234' + rawNum;
    const msg = encodeURIComponent(
      `Hello ${vendor.name || 'Seller'}, I am interested in purchasing:\n\n*${product.name}*\nPrice: ₦${Number(product.price).toLocaleString()}\nProduct ID: ${product.id}\n\nPlease confirm availability and delivery.`
    );
    window.open(`https://wa.me/${cleanNum}?text=${msg}`, '_blank');
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name,
        text: `Check out ${product?.name} on Abu Mafhal Marketplace!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-7xl mx-auto space-y-8">
          <Skeleton className="h-6 w-48 rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-6 space-y-4">
              <Skeleton className="aspect-square w-full rounded-3xl" />
              <div className="flex gap-3">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="w-20 h-20 rounded-2xl" />
                ))}
              </div>
            </div>
            <div className="lg:col-span-6 space-y-6">
              <Skeleton className="h-10 w-3/4 rounded-xl" />
              <Skeleton className="h-6 w-1/3 rounded-lg" />
              <Skeleton className="h-12 w-1/2 rounded-2xl" />
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="max-w-md w-full text-center py-16 px-6 bg-white rounded-3xl border border-slate-200 shadow-xl">
          <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            📦
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Product Not Found</h2>
          <p className="text-slate-500 text-sm mb-6">
            The product you are looking for does not exist or has been removed.
          </p>
          <Link
            to="/shop"
            className="inline-flex items-center justify-center px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl shadow-lg transition-all"
          >
            Explore Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 py-6 px-4 md:px-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        
        {/* Breadcrumbs & Share */}
        <div className="flex items-center justify-between mb-6 text-sm">
          <div className="flex items-center gap-2 text-slate-500 overflow-x-auto whitespace-nowrap py-1">
            <Link to="/" className="hover:text-blue-600 transition-colors font-semibold">Home</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <Link to="/shop" className="hover:text-blue-600 transition-colors font-semibold">Shop</Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <Link to={`/category/${product.category}`} className="hover:text-blue-600 transition-colors font-semibold capitalize">
              {product.category || 'General'}
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
            <span className="text-slate-900 font-bold truncate max-w-xs">{product.name}</span>
          </div>

          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50 shadow-sm transition-all"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copiedLink ? 'Link Copied!' : 'Share'}</span>
          </button>
        </div>

        {/* Main Product Hero Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 mb-12">
          
          {/* Left Column: Multi-Image Gallery */}
          <div className="lg:col-span-6 space-y-4">
            <div className="relative aspect-square bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xl shadow-slate-200/40 group">
              <img
                src={images[selectedImage] || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80'}
                alt={product.name}
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              
              {/* Discount Tag */}
              {hasDiscount && (
                <div className="absolute top-4 left-4 bg-rose-600 text-white font-black text-xs px-3.5 py-1.5 rounded-full shadow-lg shadow-rose-600/30 flex items-center gap-1">
                  <Zap className="w-3 h-3 fill-white" />
                  <span>-{discountPercent}% OFF</span>
                </div>
              )}

              {/* Verified Badge */}
              <div className="absolute top-4 right-4 bg-emerald-500/90 backdrop-blur-md text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified Item</span>
              </div>
            </div>

            {/* Thumbnail Selector */}
            {images.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(idx)}
                    className={`relative w-20 h-20 rounded-2xl overflow-hidden border-2 transition-all flex-shrink-0 bg-white ${
                      selectedImage === idx 
                        ? 'border-blue-600 shadow-md ring-2 ring-blue-600/20 scale-95' 
                        : 'border-slate-200 hover:border-slate-400 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt={`${product.name} thumb ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Escrow Buyer Protection Strip */}
            <div className="p-5 bg-gradient-to-r from-blue-50/80 via-indigo-50/40 to-emerald-50/50 rounded-3xl border border-blue-100/60 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-blue-900 font-extrabold text-sm">
                <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0" />
                <span>Abu Mafhal Buyer Protection</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>7 Days Return Guarantee</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Truck className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                  <span>Fast Tracked Dispatch</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <Award className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span>100% Genuine Inspected</span>
                </div>
                <div className="flex items-center gap-2 text-slate-700">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                  <span>Secure Escrow Payment</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Product Info & Actions */}
          <div className="lg:col-span-6 flex flex-col justify-between">
            <div>
              {/* Category & Brand Pill */}
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 font-black text-xs uppercase tracking-wider">
                  {product.category || 'General'}
                </span>
                {product.brand && (
                  <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-wider">
                    {product.brand}
                  </span>
                )}
                {product.condition && (
                  <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700 font-bold text-xs uppercase tracking-wider">
                    {product.condition}
                  </span>
                )}
              </div>

              {/* Product Title */}
              <h1 className="text-3xl lg:text-4xl font-black text-slate-950 tracking-tight mb-4 leading-tight">
                {product.name}
              </h1>

              {/* Price & Discount Bar */}
              <div className="flex items-baseline gap-4 mb-6">
                <div className="text-4xl lg:text-5xl font-black text-slate-950 tracking-tight">
                  ₦{Number(product.price || 0).toLocaleString()}
                </div>
                {hasDiscount && (
                  <div className="text-2xl text-slate-400 line-through font-bold">
                    ₦{Number(originalPrice).toLocaleString()}
                  </div>
                )}
              </div>

              {/* Stock Status Badge */}
              <div className="mb-6">
                {currentStock > 10 ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    In Stock ({currentStock} available)
                  </div>
                ) : currentStock > 0 ? (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-black uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Low Stock: Only {currentStock} left!
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-black uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Out of Stock
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Description</h3>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line bg-white/80 border border-slate-200/70 p-4 rounded-2xl">
                  {product.description || 'No detailed description provided for this product.'}
                </p>
              </div>

              {/* Live Real Vendor Card */}
              <div className="p-5 bg-white border border-slate-200 rounded-3xl shadow-sm mb-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white flex items-center justify-center font-black text-lg overflow-hidden shadow-md flex-shrink-0">
                      {vendor?.avatar ? (
                        <img src={vendor.avatar} alt={vendor.name} className="w-full h-full object-cover" />
                      ) : (
                        vendor?.name?.[0] || 'A'
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-extrabold text-slate-900 text-sm">{vendor?.name || 'Verified Merchant'}</h4>
                        <CheckCircle2 className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      </div>
                      <p className="text-slate-400 text-xs font-medium">{vendor?.tagline || 'Verified Marketplace Merchant'}</p>
                    </div>
                  </div>
                  {vendor?.id && vendor?.id !== 'official' && (
                    <Link
                      to={`/store/${vendor.id}`}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors flex items-center gap-1"
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>Visit Store</span>
                    </Link>
                  )}
                </div>

                {/* Direct WhatsApp Chat with Seller */}
                <button
                  onClick={handleVendorWhatsApp}
                  className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  <MessageCircle className="w-4 h-4 fill-white" />
                  <span>Chat Direct with Seller on WhatsApp</span>
                </button>
              </div>

              {/* Quantity Selector & Action Buttons */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">Quantity</span>
                  <div className="flex items-center bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="w-9 h-9 flex items-center justify-center rounded-xl font-black text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-all"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center font-black text-slate-900 text-sm">{quantity}</span>
                    <button
                      onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                      disabled={quantity >= currentStock}
                      className="w-9 h-9 flex items-center justify-center rounded-xl font-black text-slate-600 hover:bg-slate-100 disabled:opacity-30 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <button
                    onClick={handleAddToCart}
                    disabled={currentStock === 0}
                    className="sm:col-span-7 py-4 px-6 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white font-black text-sm rounded-2xl shadow-xl shadow-slate-900/20 disabled:shadow-none flex items-center justify-center gap-2.5 transition-all active:scale-98"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{currentStock === 0 ? 'Out of Stock' : 'Add to Shopping Cart'}</span>
                  </button>

                  <button
                    onClick={handleBuyNow}
                    disabled={currentStock === 0}
                    className="sm:col-span-4 py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-black text-sm rounded-2xl shadow-xl shadow-blue-600/20 disabled:shadow-none flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    <Zap className="w-4 h-4 fill-white" />
                    <span>Buy Now</span>
                  </button>

                  <div className="sm:col-span-1 flex items-center justify-center">
                    <AddToWishlistButton product={product} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Product Specifications Section */}
        <div className="mb-12 bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Package className="w-5 h-5 text-blue-600" />
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Product Specifications</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">Brand</span>
              <span className="font-bold text-slate-900 text-sm">{product.brand || 'Authentic Brand'}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">Category</span>
              <span className="font-bold text-slate-900 text-sm capitalize">{product.category || 'General'}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">SKU</span>
              <span className="font-mono font-bold text-slate-900 text-sm">{product.sku || product.id?.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">Condition</span>
              <span className="font-bold text-slate-900 text-sm">{product.condition || 'Brand New (100% Genuine)'}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">Warranty</span>
              <span className="font-bold text-slate-900 text-sm">{product.warranty || 'Official Merchant Warranty Included'}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block mb-1">Stock Availability</span>
              <span className="font-bold text-slate-900 text-sm">{currentStock > 0 ? `${currentStock} Units Ready to Ship` : 'Currently Sold Out'}</span>
            </div>
          </div>
        </div>

        {/* Live Customer Reviews Section */}
        <div className="mb-12">
          <ProductReviews productId={product.id} vendorId={product.vendor_id} />
        </div>

        {/* Related Products Section */}
        {relatedProducts.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950 tracking-tight">More in this Category</h2>
                <p className="text-slate-500 text-xs font-semibold">Hand-picked recommendations you might like</p>
              </div>
              <Link
                to={`/category/${product.category}`}
                className="text-xs font-black text-blue-600 hover:text-blue-800 uppercase tracking-wider flex items-center gap-1"
              >
                <span>View All</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {relatedProducts.map(rel => {
                let relImg = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&q=80';
                if (Array.isArray(rel.images) && rel.images.length > 0) relImg = rel.images[0];
                else if (rel.image_url) relImg = rel.image_url;

                return (
                  <Link
                    key={rel.id}
                    to={`/product/${rel.id}`}
                    className="group bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all duration-300 flex flex-col"
                  >
                    <div className="aspect-square bg-slate-50 overflow-hidden relative">
                      <img
                        src={relImg}
                        alt={rel.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-4 flex flex-col flex-1 justify-between">
                      <div>
                        <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">
                          {rel.category || 'General'}
                        </span>
                        <h3 className="font-extrabold text-slate-900 text-xs md:text-sm line-clamp-1 group-hover:text-blue-600 transition-colors">
                          {rel.name}
                        </h3>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="font-black text-slate-950 text-sm md:text-base">
                          ₦{Number(rel.price || 0).toLocaleString()}
                        </span>
                        <span className="text-[11px] font-bold text-blue-600 group-hover:underline">
                          View
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetails;