import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useNavigate, useParams } from 'react-router-dom';

const EditProduct = () => {
  const { currentUser } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState('');

  const [productData, setProductData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    originalPrice: '',
    stock: '',
    sku: '',
    brand: '',
    weight: '',
    dimensions: '',
    discount: '',
    keywords: '',
    shippingInfo: '',
    returnPolicy: '',
    affiliateLink: ''
  });

  const [existingImages, setExistingImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [newImagePreviews, setNewImagePreviews] = useState([]);

  const categories = ['Electronics', 'Fashion', 'Home', 'Sports', 'Books', 'Beauty', 'Toys', 'Food', 'Other'];

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      const productDoc = await getDoc(doc(db, 'products', id));
      if (productDoc.exists()) {
        const data = productDoc.data();
        setProductData({
          name: data.name || '',
          description: data.description || '',
          category: data.category || '',
          price: data.price?.toString() || '',
          originalPrice: data.originalPrice?.toString() || '',
          stock: data.stock?.toString() || '',
          sku: data.sku || '',
          brand: data.brand || '',
          weight: data.weight || '',
          dimensions: data.dimensions || '',
          discount: data.discount?.toString() || '',
          keywords: data.keywords?.join(', ') || '',
          shippingInfo: data.shippingInfo || '',
          returnPolicy: data.returnPolicy || '',
          affiliateLink: data.affiliateLink || ''
        });
        setExistingImages(data.images || []);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      setError('Failed to load product');
    } finally {
      setFetchLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProductData({ ...productData, [name]: value });
  };

  const handleNewImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (existingImages.length + newImages.length + files.length > 5) {
      setError('Maximum 5 images allowed');
      return;
    }

    setNewImages([...newImages, ...files]);
    const previews = files.map(file => URL.createObjectURL(file));
    setNewImagePreviews([...newImagePreviews, ...previews]);
  };

  const removeExistingImage = (index) => {
    setExistingImages(existingImages.filter((_, i) => i !== index));
  };

  const removeNewImage = (index) => {
    setNewImages(newImages.filter((_, i) => i !== index));
    setNewImagePreviews(newImagePreviews.filter((_, i) => i !== index));
  };

  const uploadNewImages = async () => {
    const imageUrls = [];
    for (let i = 0; i < newImages.length; i++) {
      const image = newImages[i];
      const timestamp = Date.now();
      const imageRef = ref(storage, `products/${currentUser.uid}/${timestamp}_${image.name}`);
      await uploadBytes(imageRef, image);
      const url = await getDownloadURL(imageRef);
      imageUrls.push(url);
    }
    return imageUrls;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const newImageUrls = await uploadNewImages();
      const allImageUrls = [...existingImages, ...newImageUrls];

      const updatedProduct = {
        ...productData,
        price: parseFloat(productData.price),
        originalPrice: productData.originalPrice ? parseFloat(productData.originalPrice) : parseFloat(productData.price),
        stock: parseInt(productData.stock),
        discount: productData.discount ? parseInt(productData.discount) : 0,
        images: allImageUrls,
        keywords: productData.keywords ? productData.keywords.split(',').map(k => k.trim()) : [],
        updatedAt: new Date().toISOString()
      };

      await updateDoc(doc(db, 'products', id), updatedProduct);
      alert('Product updated successfully!');
      navigate('/vendor/products');
    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Failed to update product');
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Edit Product</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Images */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Product Images</h2>
          
          {existingImages.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-medium mb-2">Current Images:</p>
              <div className="grid grid-cols-5 gap-4">
                {existingImages.map((img, index) => (
                  <div key={index} className="relative">
                    <img src={img} alt={`Current ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                    <button type="button" onClick={() => removeExistingImage(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6">×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Add New Images</label>
            <input type="file" accept="image/*" multiple onChange={handleNewImageChange} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
          </div>

          {newImagePreviews.length > 0 && (
            <div className="mt-4 grid grid-cols-5 gap-4">
              {newImagePreviews.map((preview, index) => (
                <div key={index} className="relative">
                  <img src={preview} alt={`New ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                  <button type="button" onClick={() => removeNewImage(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Basic Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Product Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Product Name</label>
              <input type="text" name="name" value={productData.name} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea name="description" value={productData.description} onChange={handleChange} required rows="5" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Category</label>
              <select name="category" value={productData.category} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700">
                <option value="">Select Category</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Brand</label>
              <input type="text" name="brand" value={productData.brand} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Price (₦)</label>
              <input type="number" name="price" value={productData.price} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Stock</label>
              <input type="number" name="stock" value={productData.stock} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400">
            {loading ? 'Updating...' : 'Update Product'}
          </button>
          <button type="button" onClick={() => navigate('/vendor/products')} className="px-6 py-3 bg-gray-200 dark:bg-gray-700 rounded-lg">Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default EditProduct;