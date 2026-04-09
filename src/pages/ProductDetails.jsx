import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { useCart } from '../context/CartContext';
import AddToWishlistButton from '../components/common/AddToWishlistButton';
import ProductReviews from '../components/common/ProductReviews';
import { Skeleton } from '../components/ui/Skeleton';

const ProductDetails = () => {
  const { id } = useParams();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariation, setSelectedVariation] = useState({});

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
        
      if (productError) throw productError;

      if (productData) {
        setProduct(productData);

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

  const handleAddToCart = () => {
    if (product.stock === 0) {
      alert('Product is out of stock');
      return;
    }

    if (quantity > product.stock) {
      alert(`Only ${product.stock} items available`);
      return;
    }

    addToCart(product, quantity, selectedVariation);
    alert('Added to cart!');
  };

  // ❌ No more blocking spinner!

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto text-center py-20">
          <p className="text-6xl mb-4">📦</p>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Product Not Found</h2>
          <Link to="/shop" className="text-blue-600 hover:underline">
            Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm">
          {!product ? <Skeleton className="h-4 w-48" /> : (
            <>
              <Link to="/" className="text-blue-600 hover:underline">Home</Link>
              {' > '}
              <Link to="/shop" className="text-blue-600 hover:underline">Shop</Link>
              {' > '}
              <span className="text-slate-400 font-medium">{product.name}</span>
            </>
          )}
        </div>

        {/* Product Section */}
        <div className="bg-white/70 backdrop-blur-xl border border-slate-200 rounded-3xl shadow-xl shadow-slate-200/50 p-6 md:p-8 mb-8 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            
            {/* Left: Images */}
            <div className="space-y-4">
              {!product ? (
                <Skeleton className="aspect-square w-full rounded-2xl" />
              ) : (
                <div className="aspect-square bg-slate-50 rounded-2xl overflow-hidden border border-slate-100 shadow-inner group relative">
                  <img
                    src={product.images?.[selectedImage] || 'https://via.placeholder.com/500'}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  {product.discount && (
                    <div className="absolute top-4 left-4 bg-rose-500 text-white font-black text-xs px-3 py-1.5 rounded-full shadow-lg shadow-rose-500/30">
                      -{product.discount}% OFF
                    </div>
                  )}
                </div>
              )}
              
              {(!product || product.images?.length > 1) && (
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                  {!product ? [1,2,3,4].map(i => <Skeleton key={i} className="w-20 h-20 rounded-xl flex-shrink-0" />) : 
                    product.images.map((img, index) => (
                      <button
                        key={index}
                        onClick={() => setSelectedImage(index)}
                        className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                          selectedImage === index ? 'border-blue-600 shadow-md scale-95' : 'border-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <img src={img} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                      </button>
                    ))
                  }
                </div>
              )}
            </div>

            {/* Right: Info */}
            <div className="flex flex-col">
              {!product ? (
                <div className="space-y-6">
                  <Skeleton className="h-10 w-3/4" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-20 w-full" />
                  <div className="flex gap-4">
                    <Skeleton className="h-12 w-32" />
                    <Skeleton className="h-12 w-32" />
                  </div>
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-2">{product.name}</h1>
                    <div className="flex items-center gap-4 text-sm font-bold">
                       <span className="text-blue-600 uppercase tracking-widest text-[10px]">{product.category}</span>
                       <span className="w-1 h-1 bg-slate-300 rounded-full" />
                       <span className="text-slate-400">{product.brand}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mb-8">
                    <p className="text-5xl font-black text-slate-900 tracking-tighter">
                      ₦{product.price?.toLocaleString()}
                    </p>
                    {(product.original_price || product.originalPrice) && (product.original_price || product.originalPrice) > product.price && (
                      <p className="text-2xl text-slate-300 line-through font-bold">
                        ₦{(product.original_price || product.originalPrice)?.toLocaleString()}
                      </p>
                    )}
                  </div>

                  {product.rating && (
                    <div className="flex items-center gap-3 mb-8 p-3 bg-amber-50 rounded-2xl border border-amber-100/50 w-fit">
                      <div className="flex text-amber-500">
                        {"★".repeat(Math.floor(product.rating))}
                      </div>
                      <span className="font-black text-amber-700 text-sm">{product.rating}</span>
                      <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                        ({product.reviews || 0} reviews)
                      </span>
                    </div>
                  )}

                  <div className="mb-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">About this product</h3>
                    <p className="text-slate-600 font-medium leading-relaxed">{product.description}</p>
                  </div>

                  <div className="mt-auto space-y-6">
                    {/* Quantity & Stock */}
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                         <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 flex items-center justify-center font-black text-slate-600 hover:bg-white rounded-xl transition-all">-</button>
                         <span className="w-10 text-center font-black text-slate-900">{quantity}</span>
                         <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="w-10 h-10 flex items-center justify-center font-black text-slate-600 hover:bg-white rounded-xl transition-all">+</button>
                       </div>
                       <p className={`text-xs font-black uppercase tracking-widest ${
                          product.stock > 10 ? 'text-emerald-500' : 'text-rose-500'
                       }`}>
                          {product.stock > 10 ? '● In Stock' : product.stock > 0 ? `● Only ${product.stock} Left` : '● Out of Stock'}
                       </p>
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={handleAddToCart}
                        disabled={product.stock === 0}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black py-5 rounded-2xl shadow-xl shadow-slate-900/20 disabled:bg-slate-300 disabled:shadow-none transition-all active:scale-95"
                      >
                        {product.stock === 0 ? 'Out of Stock' : 'Add to Shopping Cart'}
                      </button>
                      <AddToWishlistButton product={product} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RELATED SECTION */}
        <div className="space-y-8">
           <h2 className="text-2xl font-black text-slate-900 tracking-tight">You might also like</h2>
           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {!product ? [1,2,3,4].map(i => <div key={i} className="space-y-4"><Skeleton className="aspect-[4/5] w-full rounded-2xl" /><Skeleton className="h-4 w-3/4" /></div>) : 
                relatedProducts.map(rel => (
                  <Link key={rel.id} to={`/product/${rel.id}`} className="group space-y-4">
                     <div className="aspect-[4/5] bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm transition-all group-hover:shadow-xl group-hover:shadow-slate-200/50 group-hover:-translate-y-1">
                        <img src={rel.images?.[0]} alt={rel.name} className="w-full h-full object-cover" />
                     </div>
                     <div>
                        <h3 className="font-bold text-slate-900 line-clamp-1 group-hover:text-blue-600 transition-colors uppercase text-[10px] tracking-widest">{rel.name}</h3>
                        <p className="font-black text-slate-950">₦{rel.price?.toLocaleString()}</p>
                     </div>
                  </Link>
                ))
              }
           </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetails;