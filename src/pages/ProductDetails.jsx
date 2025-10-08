import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useCart } from '../context/CartContext';
import AddToWishlistButton from '../components/common/AddToWishlistButton';
import ProductReviews from '../components/common/ProductReviews';

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
      const productDoc = await getDoc(doc(db, 'products', id));
      if (productDoc.exists()) {
        const productData = { id: productDoc.id, ...productDoc.data() };
        setProduct(productData);

        // Fetch related products
        if (productData.category) {
          const q = query(
            collection(db, 'products'),
            where('category', '==', productData.category),
            where('status', '==', 'approved')
          );
          const snapshot = await getDocs(q);
          const related = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter(p => p.id !== id)
            .slice(0, 4);
          setRelatedProducts(related);
        }
      }
    } catch (error) {
      console.error('Error fetching product:', error);
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

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <div className="mb-6 text-sm">
          <Link to="/" className="text-blue-600 hover:underline">Home</Link>
          {' > '}
          <Link to="/shop" className="text-blue-600 hover:underline">Shop</Link>
          {' > '}
          <span className="text-gray-600 dark:text-gray-400">{product.name}</span>
        </div>

        {/* Product Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Images */}
            <div>
              <div className="mb-4 aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
                <img
                  src={product.images?.[selectedImage] || 'https://via.placeholder.com/500'}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              {product.images?.length > 1 && (
                <div className="grid grid-cols-5 gap-2">
                  {product.images.map((img, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImage(index)}
                      className={`aspect-square rounded-lg overflow-hidden border-2 ${
                        selectedImage === index ? 'border-blue-600' : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <img src={img} alt={`${product.name} ${index + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">{product.name}</h1>

              {product.category && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Category: <span className="font-medium">{product.category}</span>
                </p>
              )}

              {product.brand && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Brand: <span className="font-medium">{product.brand}</span>
                </p>
              )}

              {product.rating && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-yellow-500">⭐</span>
                  <span className="font-medium">{product.rating}</span>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    ({product.reviews || 0} reviews)
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4 mb-6">
                <p className="text-4xl font-bold text-orange-600">
                  ₦{product.price?.toLocaleString()}
                </p>
                {product.originalPrice && product.originalPrice > product.price && (
                  <p className="text-xl text-gray-500 line-through">
                    ₦{product.originalPrice?.toLocaleString()}
                  </p>
                )}
                {product.discount && (
                  <span className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold">
                    -{product.discount}% OFF
                  </span>
                )}
              </div>

              <p className={`text-sm mb-6 ${
                product.stock > 10 ? 'text-green-600' : 
                product.stock > 0 ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {product.stock > 10 ? 'In Stock' : 
                 product.stock > 0 ? `Only ${product.stock} left in stock` : 'Out of Stock'}
              </p>

              <div className="mb-6">
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-gray-700 dark:text-gray-300">{product.description}</p>
              </div>

              {/* Quantity Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium mb-2">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 text-center px-4 py-2 border rounded-lg dark:bg-gray-700"
                    min="1"
                    max={product.stock}
                  />
                  <button
                    onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                    className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mb-6">
                <button
                  onClick={handleAddToCart}
                  disabled={product.stock === 0}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
                </button>
                <AddToWishlistButton product={product} />
              </div>

              {/* Additional Info */}
              {product.shippingInfo && (
                <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h4 className="font-semibold mb-2">🚚 Shipping Information</h4>
                  <p className="text-sm">{product.shippingInfo}</p>
                </div>
              )}

              {product.returnPolicy && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <h4 className="font-semibold mb-2">↩️ Return Policy</h4>
                  <p className="text-sm">{product.returnPolicy}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* REVIEWS SECTION - NEW */}
        <div className="mb-6">
          <ProductReviews productId={id} />
          <ProductReviews productId={id} vendorId={product.vendorId} />

        </div>


        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold mb-6">Related Products</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map(relatedProduct => (
                <Link
                  key={relatedProduct.id}
                  to={`/product/${relatedProduct.id}`}
                  className="bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden hover:shadow-lg transition"
                >
                  <img
                    src={relatedProduct.images?.[0] || 'https://via.placeholder.com/200'}
                    alt={relatedProduct.name}
                    className="w-full h-40 object-cover"
                  />
                  <div className="p-3">
                    <h3 className="font-semibold text-sm line-clamp-2 mb-2">{relatedProduct.name}</h3>
                    <p className="text-orange-600 font-bold">₦{relatedProduct.price?.toLocaleString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetails;