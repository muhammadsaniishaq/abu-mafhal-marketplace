// ============================================
// FIXED: AdminAddProduct.jsx
// src/components/admin/AdminAddProduct.jsx
// ============================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { aiProductService } from '../../services/aiProductService';

const AdminAddProduct = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    price: '',
    stock: '',
    brand: '',
    features: '',
    status: 'approved',
    featured: false
  });

  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const categories = [
    'Electronics',
    'Fashion',
    'Home',
    'Sports',
    'Books',
    'Beauty',
    'Toys',
    'Food',
    'Other'
  ];

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError(''); // Clear error when user types
  };

  // Handle image selection
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length > 5) {
      setError('Maximum 5 images allowed');
      return;
    }

    setImages(files);

    // Create preview URLs
    const previews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(previews);
    setError('');
  };

  // Remove image
  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Generate AI Description
  const handleGenerateDescription = async () => {
    setIsGenerating(true);
    setError('');
    
    try {
      // Validate required fields
      if (!formData.name || !formData.category) {
        throw new Error('Please fill in product name and category first');
      }

      // Prepare product data
      const productData = {
        name: formData.name,
        category: formData.category,
        price: parseFloat(formData.price) || 0,
        brand: formData.brand,
        features: formData.features,
      };

      // Generate description using AI service
      const description = await aiProductService.generateDescription(productData);
      
      // Update form with generated description
      setFormData(prev => ({
        ...prev,
        description: description
      }));

      setSuccess('Description generated successfully! ✅');
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Description generation error:', error);
      setError(error.message || 'Failed to generate description. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Upload images to Firebase Storage
  const uploadImages = async () => {
    const uploadPromises = images.map(async (image, index) => {
      const imageRef = ref(storage, `products/${Date.now()}_${index}_${image.name}`);
      await uploadBytes(imageRef, image);
      const url = await getDownloadURL(imageRef);
      return url;
    });

    return await Promise.all(uploadPromises);
  };

  // Validate form
  const validateForm = () => {
    if (!formData.name.trim()) {
      throw new Error('Product name is required');
    }
    if (!formData.category) {
      throw new Error('Please select a category');
    }
    if (!formData.price || parseFloat(formData.price) <= 0) {
      throw new Error('Please enter a valid price');
    }
    if (!formData.stock || parseInt(formData.stock) < 0) {
      throw new Error('Please enter valid stock quantity');
    }
    if (images.length === 0) {
      throw new Error('Please upload at least one product image');
    }
    if (!formData.description.trim()) {
      throw new Error('Product description is required');
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate form
      validateForm();

      // Upload images
      const imageUrls = await uploadImages();

      // Prepare product data
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        stock: parseInt(formData.stock),
        images: imageUrls,
        vendorId: 'admin',
        vendorName: 'Admin',
        rating: 0,
        reviewCount: 0,
        soldCount: 0,
        views: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'admin',
      };

      // Add to Firestore
      await addDoc(collection(db, 'products'), productData);

      setSuccess('Product added successfully! ✅');
      
      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/admin/products');
      }, 2000);

    } catch (error) {
      console.error('Error adding product:', error);
      setError(error.message || 'Failed to add product. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Product (Admin)</h1>
          <p className="text-gray-600 mt-1">AI-powered product creation with admin privileges</p>
        </div>
        <button
          onClick={() => navigate('/admin/products')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
        >
          Back to Products
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p className="font-medium">⚠️ {error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <p className="font-medium">✅ {success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Admin Controls */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span>👑</span> Admin Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Product Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg"
              >
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Vendor Name</label>
              <input
                type="text"
                value="Admin"
                disabled
                className="w-full p-3 border rounded-lg bg-gray-100"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="featured"
                  checked={formData.featured}
                  onChange={handleChange}
                  className="w-5 h-5"
                />
                <span className="text-sm font-medium">Featured Product</span>
              </label>
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Basic Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., iPhone 17 Pro Max"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Price (₦) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="e.g., 100000"
                min="0"
                step="0.01"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Stock Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleChange}
                placeholder="e.g., 50"
                min="0"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Brand</label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="e.g., Apple, Samsung, Nike"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Key Features</label>
              <input
                type="text"
                name="features"
                value={formData.features}
                onChange={handleChange}
                placeholder="e.g., 5G, 128GB, Dual Camera"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Product Description with AI */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Product Description</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="6"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Enter product description or click 'Generate with AI' below"
              required
            />
            
            <button
              type="button"
              onClick={handleGenerateDescription}
              disabled={isGenerating || !formData.name || !formData.category}
              className="mt-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all shadow-lg"
            >
              {isGenerating ? (
                <>
                  <span className="animate-spin">⚙️</span>
                  <span>Generating with AI...</span>
                </>
              ) : (
                <>
                  <span>✨</span>
                  <span>Generate Description with AI</span>
                </>
              )}
            </button>
            
            <p className="text-xs text-gray-500 mt-2">
              💡 Fill in product name and category first, then click to auto-generate a professional description
            </p>
          </div>
        </div>

        {/* Product Media */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">Product Media</h2>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Upload Images (Max 5) <span className="text-red-500">*</span>
            </label>
            
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              className="w-full p-3 border rounded-lg"
            />
            
            {/* Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            <p className="text-xs text-gray-500 mt-2">
              📸 Upload high-quality product images. First image will be the main display image.
            </p>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Adding Product...
              </span>
            ) : (
              '✅ Add Product'
            )}
          </button>

          <button
            type="button"
            onClick={() => navigate('/admin/products')}
            disabled={loading}
            className="px-6 py-3 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminAddProduct;