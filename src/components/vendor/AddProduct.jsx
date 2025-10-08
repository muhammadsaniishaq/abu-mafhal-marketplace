import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useNavigate } from 'react-router-dom';

const AddProduct = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [aiLoading, setAiLoading] = useState({ description: false, category: false, price: false });

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

  const [variations, setVariations] = useState([]);
  const [currentVariation, setCurrentVariation] = useState({ type: '', values: '' });
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [video, setVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);

  const categories = ['Electronics', 'Fashion', 'Home', 'Sports', 'Books', 'Beauty', 'Toys', 'Food', 'Other'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProductData({ ...productData, [name]: value });

    if (name === 'originalPrice' || name === 'price') {
      const original = name === 'originalPrice' ? parseFloat(value) : parseFloat(productData.originalPrice);
      const current = name === 'price' ? parseFloat(value) : parseFloat(productData.price);
      if (original && current && original > current) {
        const discountPercent = Math.round(((original - current) / original) * 100);
        setProductData(prev => ({...prev, discount: discountPercent.toString()}));
      }
    }
  };

  // AI Description Generation
  const generateAIDescription = async () => {
    if (!productData.name) {
      setError('Please enter a product name first');
      return;
    }

    setAiLoading({...aiLoading, description: true});
    setError('');

    try {
      const keywords = productData.keywords || productData.name;
      const prompt = `Generate a compelling and professional e-commerce product description.

Product Name: ${productData.name}
Keywords: ${keywords}
Category: ${productData.category || 'general product'}

Create a description that:
- Highlights key features and benefits
- Is SEO-friendly and persuasive
- 2-3 paragraphs long
- Professional and engaging tone
- Focuses on value to customer

Write only the description, no extra commentary:`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      setProductData(prev => ({ ...prev, description: data.content[0].text.trim() }));
    } catch (error) {
      console.error('AI Error:', error);
      setError('Failed to generate description. Please try again.');
    } finally {
      setAiLoading({...aiLoading, description: false});
    }
  };

  // AI Category Suggestion
  const suggestCategoryFromImage = async (imageFile) => {
    setAiLoading({...aiLoading, category: true});
    try {
      const base64Image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 50,
          messages: [{
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: imageFile.type, data: base64Image }
              },
              {
                type: "text",
                text: `Analyze this product image and suggest the most appropriate category from: ${categories.join(', ')}. Respond with ONLY the category name.`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      const suggestedCategory = data.content[0].text.trim();
      
      if (categories.includes(suggestedCategory)) {
        setProductData(prev => ({ ...prev, category: suggestedCategory }));
      }
    } catch (error) {
      console.error('AI Category Error:', error);
    } finally {
      setAiLoading({...aiLoading, category: false});
    }
  };

  // AI Price Optimization
  const optimizePrice = async () => {
    if (!productData.name || !productData.category) {
      setError('Please enter product name and category first');
      return;
    }

    setAiLoading({...aiLoading, price: true});
    setError('');

    try {
      const prompt = `Suggest a competitive price in Nigerian Naira (₦) for this product.

Product: ${productData.name}
Category: ${productData.category}
Keywords: ${productData.keywords || 'N/A'}

Consider:
- Typical market prices for similar products in Nigeria
- Product category pricing standards
- Competitive pricing strategy

Respond with ONLY a single number (the suggested price in Naira), nothing else:`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 100,
          messages: [{ role: "user", content: prompt }]
        })
      });

      const data = await response.json();
      const suggestedPrice = data.content[0].text.trim().replace(/[^0-9.]/g, '');
      
      if (suggestedPrice && !isNaN(parseFloat(suggestedPrice))) {
        setProductData(prev => ({ ...prev, price: suggestedPrice }));
      }
    } catch (error) {
      console.error('AI Price Error:', error);
      setError('Failed to optimize price. Please try again.');
    } finally {
      setAiLoading({...aiLoading, price: false});
    }
  };

  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length + images.length > 5) {
      setError('Maximum 5 images allowed');
      return;
    }

    const invalidFiles = files.filter(file => file.size > 5 * 1024 * 1024);
    if (invalidFiles.length > 0) {
      setError('Some images are too large. Maximum 5MB per image.');
      return;
    }

    if (images.length === 0 && files.length > 0 && !productData.category) {
      await suggestCategoryFromImage(files[0]);
    }

    setImages([...images, ...files]);
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviews([...imagePreviews, ...newPreviews]);
    setError('');
  };

  const handleVideoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      setError('Video too large. Maximum 50MB.');
      return;
    }

    setVideo(file);
    setVideoPreview(URL.createObjectURL(file));
    setError('');
  };

  const removeImage = (index) => {
    setImages(images.filter((_, i) => i !== index));
    setImagePreviews(imagePreviews.filter((_, i) => i !== index));
  };

  const removeVideo = () => {
    setVideo(null);
    setVideoPreview(null);
  };

  const addVariation = () => {
    if (!currentVariation.type || !currentVariation.values) {
      setError('Fill in variation type and values');
      return;
    }

    const valuesArray = currentVariation.values.split(',').map(v => v.trim()).filter(v => v);
    setVariations([...variations, { type: currentVariation.type, values: valuesArray }]);
    setCurrentVariation({ type: '', values: '' });
    setError('');
  };

  const removeVariation = (index) => {
    setVariations(variations.filter((_, i) => i !== index));
  };

  const uploadImages = async () => {
    const imageUrls = [];
    const totalFiles = images.length + (video ? 1 : 0);
    let uploadedCount = 0;

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const timestamp = Date.now();
      const imageRef = ref(storage, `products/${currentUser.uid}/${timestamp}_${image.name}`);
      await uploadBytes(imageRef, image);
      const url = await getDownloadURL(imageRef);
      imageUrls.push(url);
      uploadedCount++;
      setUploadProgress(Math.round((uploadedCount / totalFiles) * 50));
    }

    let videoUrl = null;
    if (video) {
      const timestamp = Date.now();
      const videoRef = ref(storage, `products/${currentUser.uid}/videos/${timestamp}_${video.name}`);
      await uploadBytes(videoRef, video);
      videoUrl = await getDownloadURL(videoRef);
      uploadedCount++;
      setUploadProgress(Math.round((uploadedCount / totalFiles) * 50));
    }

    return { imageUrls, videoUrl };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setUploadProgress(0);

    try {
      if (images.length === 0) {
        setError('Add at least one product image');
        setLoading(false);
        return;
      }

      if (!productData.name || !productData.description || !productData.category || !productData.price || !productData.stock) {
        setError('Fill in all required fields');
        setLoading(false);
        return;
      }

      const { imageUrls, videoUrl } = await uploadImages();
      setUploadProgress(60);

      const newProduct = {
        ...productData,
        price: parseFloat(productData.price),
        originalPrice: productData.originalPrice ? parseFloat(productData.originalPrice) : parseFloat(productData.price),
        stock: parseInt(productData.stock),
        discount: productData.discount ? parseInt(productData.discount) : 0,
        images: imageUrls,
        video: videoUrl,
        variations: variations,
        keywords: productData.keywords ? productData.keywords.split(',').map(k => k.trim()) : [],
        vendorId: currentUser.uid,
        vendorName: currentUser.name || currentUser.email,
        status: 'pending',
        views: 0,
        sales: 0,
        rating: 0,
        reviews: 0,
        isAffiliate: !!productData.affiliateLink,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      setUploadProgress(80);
      await addDoc(collection(db, 'products'), newProduct);
      setUploadProgress(100);

      alert('Product added successfully! Pending admin approval.');
      navigate('/vendor/products');

    } catch (err) {
      console.error('Error:', err);
      setError(err.message || 'Failed to add product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Add New Product</h1>
        <p className="text-gray-600 dark:text-gray-400">AI-powered product creation with smart suggestions</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 rounded-lg">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Uploading...</span>
            <span className="text-sm font-semibold text-blue-600">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{width: `${uploadProgress}%`}}></div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Product Media */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Product Media</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Upload Images (Max 5) <span className="text-red-500">*</span>
            </label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              disabled={images.length >= 5 || aiLoading.category}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700"
            />
            <p className="text-xs text-gray-500 mt-1">
              {aiLoading.category ? 'AI analyzing image...' : 'AI will auto-suggest category from first image'}
            </p>
          </div>

          {imagePreviews.length > 0 && (
            <div className="grid grid-cols-5 gap-4 mb-4">
              {imagePreviews.map((preview, index) => (
                <div key={index} className="relative">
                  <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                  <button type="button" onClick={() => removeImage(index)} className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 hover:bg-red-600">×</button>
                  {index === 0 && <span className="absolute bottom-1 left-1 bg-blue-500 text-white text-xs px-2 py-1 rounded">Main</span>}
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Upload Video (Optional)</label>
            <input type="file" accept="video/*" onChange={handleVideoChange} disabled={video !== null} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-purple-50 file:text-purple-700" />
            <p className="text-xs text-gray-500 mt-1">Max 50MB. MP4, MOV, AVI formats</p>
          </div>

          {videoPreview && (
            <div className="mt-4 relative">
              <video src={videoPreview} controls className="w-full h-64 rounded-lg" />
              <button type="button" onClick={removeVideo} className="absolute top-2 right-2 bg-red-500 text-white rounded-full px-3 py-1 text-sm hover:bg-red-600">Remove Video</button>
            </div>
          )}
        </div>

        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Product Name <span className="text-red-500">*</span></label>
              <input type="text" name="name" value={productData.name} onChange={handleChange} required placeholder="e.g., Samsung Galaxy S21" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Keywords (comma separated)</label>
              <input type="text" name="keywords" value={productData.keywords} onChange={handleChange} placeholder="e.g., stylish, high-quality, comfortable" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-blue-500" />
              <p className="text-xs text-gray-500 mt-1">Used for AI description generation</p>
            </div>

            <div className="md:col-span-2">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Description <span className="text-red-500">*</span></label>
                <button type="button" onClick={generateAIDescription} disabled={aiLoading.description || !productData.name} className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm rounded-lg disabled:opacity-50">
                  {aiLoading.description ? '⏳ Generating...' : '🪄 AI Generate'}
                </button>
              </div>
              <textarea name="description" value={productData.description} onChange={handleChange} required rows="5" placeholder="AI will generate based on name and keywords..." className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Category <span className="text-red-500">*</span></label>
              <select name="category" value={productData.category} onChange={handleChange} required className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-blue-500">
                <option value="">AI suggests from image</option>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Brand</label>
              <input type="text" name="brand" value={productData.brand} onChange={handleChange} placeholder="e.g., Samsung" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">SKU</label>
              <input type="text" name="sku" value={productData.sku} onChange={handleChange} placeholder="e.g., SKU-12345" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Affiliate Link */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg shadow-md p-6 border border-green-200 dark:border-green-800">
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">🔗 Affiliate Link (Optional)</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Add external partner link. Button will change to "View Deal" instead of "Add to Cart"</p>
          <input type="url" name="affiliateLink" value={productData.affiliateLink} onChange={handleChange} placeholder="https://partner-site.com/product" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-green-500" />
        </div>

        {/* Product Variations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Product Variations (Optional)</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Add variations like size, color, material</p>
          
          <div className="flex gap-2 mb-4">
            <input type="text" placeholder="Type (e.g., Size)" value={currentVariation.type} onChange={(e) => setCurrentVariation({...currentVariation, type: e.target.value})} className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700" />
            <input type="text" placeholder="Values (S, M, L)" value={currentVariation.values} onChange={(e) => setCurrentVariation({...currentVariation, values: e.target.value})} className="flex-1 px-4 py-2 border rounded-lg dark:bg-gray-700" />
            <button type="button" onClick={addVariation} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">Add</button>
          </div>

          {variations.length > 0 && (
            <div className="space-y-2">
              {variations.map((variation, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div><span className="font-semibold">{variation.type}:</span> {variation.values.join(', ')}</div>
                  <button type="button" onClick={() => removeVariation(index)} className="text-red-600 hover:text-red-800">Remove</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Pricing & Inventory</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium">Price (₦) <span className="text-red-500">*</span></label>
                <button type="button" onClick={optimizePrice} disabled={aiLoading.price || !productData.name || !productData.category} className="text-purple-600 hover:text-purple-700 text-sm disabled:opacity-50">
                  {aiLoading.price ? '⏳' : '🪄 AI'}
                </button>
              </div>
              <input type="number" name="price" value={productData.price} onChange={handleChange} required min="0" step="0.01" placeholder="0.00" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Original Price (₦)</label>
              <input type="number" name="originalPrice" value={productData.originalPrice} onChange={handleChange} min="0" step="0.01" placeholder="0.00" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Discount (%)</label>
              <input type="number" name="discount" value={productData.discount} onChange={handleChange} min="0" max="100" placeholder="Auto" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-blue-500" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Stock <span className="text-red-500">*</span></label>
              <input type="number" name="stock" value={productData.stock} onChange={handleChange} required min="0" placeholder="0" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {/* Physical Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Physical Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Weight (kg)</label>
              <input type="text" name="weight" value={productData.weight} onChange={handleChange} placeholder="0.5" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Dimensions (L×W×H cm)</label>
              <input type="text" name="dimensions" value={productData.dimensions} onChange={handleChange} placeholder="15×10×5" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
            </div>
          </div>
        </div>

        {/* Shipping */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Shipping & Returns</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Shipping Info</label>
              <textarea name="shippingInfo" value={productData.shippingInfo} onChange={handleChange} rows="2" placeholder="Ships in 2-3 days" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Return Policy</label>
              <textarea name="returnPolicy" value={productData.returnPolicy} onChange={handleChange} rows="2" placeholder="7-day return policy" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400 transition">
            {loading ? '⏳ Adding...' : 'Add Product'}
          </button>
          <button type="button" onClick={() => navigate('/vendor/products')} className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 text-gray-900 dark:text-white rounded-lg font-medium">Cancel</button>
        </div>
      </form>
    </div>
  );
};

export default AddProduct;