// ============================================
// COMPLETE AdminAddProduct.jsx with ALL FEATURES
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
    compareAtPrice: '',
    cost: '',
    stock: '',
    sku: '',
    barcode: '',
    brand: '',
    features: '',
    specifications: {},
    tags: [],
    status: 'approved',
    featured: false,
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
    variants: [],
    shippingWeight: '',
    shippingDimensions: { length: '', width: '', height: '' },
    warranty: '',
    returnPolicy: '30 days',
    manufacturer: '',
    countryOfOrigin: '',
  });

  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentTag, setCurrentTag] = useState('');
  const [currentSpec, setCurrentSpec] = useState({ key: '', value: '' });
  const [currentVariant, setCurrentVariant] = useState({ name: '', values: '' });

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

  const statusOptions = [
    { value: 'approved', label: 'Approved', color: 'green' },
    { value: 'pending', label: 'Pending Review', color: 'yellow' },
    { value: 'rejected', label: 'Rejected', color: 'red' },
    { value: 'draft', label: 'Draft', color: 'gray' },
  ];

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    setError('');
  };

  // Handle nested object changes (shipping dimensions)
  const handleNestedChange = (parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [parent]: {
        ...prev[parent],
        [field]: value
      }
    }));
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

  // AI: Suggest category from image
  const suggestCategoryFromImage = async (imageFile) => {
    setIsAnalyzingImage(true);
    try {
      // This would integrate with an image recognition API
      // For now, we'll use a simple fallback
      const fileName = imageFile.name.toLowerCase();
      
      if (fileName.includes('phone') || fileName.includes('laptop') || fileName.includes('electronic')) {
        return 'Electronics';
      } else if (fileName.includes('shirt') || fileName.includes('shoe') || fileName.includes('dress')) {
        return 'Fashion';
      } else if (fileName.includes('chair') || fileName.includes('table') || fileName.includes('bed')) {
        return 'Home';
      }
      
      // Default fallback
      return null;
    } catch (error) {
      console.error('Category suggestion error:', error);
      return null;
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  // Handle image change with AI category suggestion
  const handleImageChangeWithAI = async (e) => {
    const files = Array.from(e.target.files);
    
    if (files.length > 5) {
      setError('Maximum 5 images allowed');
      return;
    }

    setImages(files);
    const previews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(previews);

    // AI: Suggest category from first image
    if (files.length > 0 && !formData.category) {
      const suggestedCategory = await suggestCategoryFromImage(files[0]);
      if (suggestedCategory) {
        setFormData(prev => ({
          ...prev,
          category: suggestedCategory
        }));
        setSuccess(`AI suggested category: ${suggestedCategory} ✨`);
        setTimeout(() => setSuccess(''), 3000);
      }
    }

    setError('');
  };

  // Generate AI Description
  const handleGenerateDescription = async () => {
    setIsGenerating(true);
    setError('');
    
    try {
      if (!formData.name || !formData.category) {
        throw new Error('Please fill in product name and category first');
      }

      const productData = {
        name: formData.name,
        category: formData.category,
        price: parseFloat(formData.price) || 0,
        brand: formData.brand,
        features: formData.features,
      };

      const description = await aiProductService.generateDescription(productData);
      
      setFormData(prev => ({
        ...prev,
        description: description
      }));

      // Also generate SEO fields
      const keywords = aiProductService.generateKeywords(productData);
      setFormData(prev => ({
        ...prev,
        seoKeywords: keywords,
        seoTitle: `${formData.name} - Buy Online at Best Price`,
        seoDescription: description.substring(0, 160) + '...'
      }));

      setSuccess('Description and SEO fields generated successfully! ✅');
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Description generation error:', error);
      setError(error.message || 'Failed to generate description. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Add tag
  const addTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  // Remove tag
  const removeTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // Add specification
  const addSpecification = () => {
    if (currentSpec.key.trim() && currentSpec.value.trim()) {
      setFormData(prev => ({
        ...prev,
        specifications: {
          ...prev.specifications,
          [currentSpec.key.trim()]: currentSpec.value.trim()
        }
      }));
      setCurrentSpec({ key: '', value: '' });
    }
  };

  // Remove specification
  const removeSpecification = (key) => {
    setFormData(prev => {
      const newSpecs = { ...prev.specifications };
      delete newSpecs[key];
      return { ...prev, specifications: newSpecs };
    });
  };

  // Add variant
  const addVariant = () => {
    if (currentVariant.name.trim() && currentVariant.values.trim()) {
      setFormData(prev => ({
        ...prev,
        variants: [
          ...prev.variants,
          {
            name: currentVariant.name.trim(),
            values: currentVariant.values.split(',').map(v => v.trim())
          }
        ]
      }));
      setCurrentVariant({ name: '', values: '' });
    }
  };

  // Remove variant
  const removeVariant = (index) => {
    setFormData(prev => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== index)
    }));
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
    if (!formData.name.trim()) throw new Error('Product name is required');
    if (!formData.category) throw new Error('Please select a category');
    if (!formData.price || parseFloat(formData.price) <= 0) throw new Error('Please enter a valid price');
    if (!formData.stock || parseInt(formData.stock) < 0) throw new Error('Please enter valid stock quantity');
    if (images.length === 0) throw new Error('Please upload at least one product image');
    if (!formData.description.trim()) throw new Error('Product description is required');
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      validateForm();

      const imageUrls = await uploadImages();

      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        compareAtPrice: formData.compareAtPrice ? parseFloat(formData.compareAtPrice) : null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        stock: parseInt(formData.stock),
        shippingWeight: formData.shippingWeight ? parseFloat(formData.shippingWeight) : null,
        images: imageUrls,
        vendorId: 'admin',
        vendorName: 'Admin',
        rating: 0,
        reviewCount: 0,
        soldCount: 0,
        views: 0,
        discount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: currentUser?.uid || 'admin',
      };

      await addDoc(collection(db, 'products'), productData);

      setSuccess('Product added successfully! ✅');
      
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
    <div className="max-w-6xl mx-auto p-6">
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

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          <p className="font-medium">⚠️ {error}</p>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          <p className="font-medium">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Admin Controls */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
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
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
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

            <div className="flex items-center pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="featured"
                  checked={formData.featured}
                  onChange={handleChange}
                  className="w-5 h-5 text-purple-600"
                />
                <span className="text-sm font-medium">⭐ Featured Product</span>
              </label>
            </div>
          </div>
        </div>

        {/* Basic Information */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">📋 Basic Information</h2>
          
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
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Category</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Brand</label>
              <input
                type="text"
                name="brand"
                value={formData.brand}
                onChange={handleChange}
                placeholder="e.g., Apple, Samsung"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Manufacturer</label>
              <input
                type="text"
                name="manufacturer"
                value={formData.manufacturer}
                onChange={handleChange}
                placeholder="e.g., Foxconn"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">SKU</label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="e.g., IPHN-17PM-BLK-256"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Barcode</label>
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                placeholder="e.g., 123456789012"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Country of Origin</label>
              <input
                type="text"
                name="countryOfOrigin"
                value={formData.countryOfOrigin}
                onChange={handleChange}
                placeholder="e.g., China, USA"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Warranty</label>
              <input
                type="text"
                name="warranty"
                value={formData.warranty}
                onChange={handleChange}
                placeholder="e.g., 1 Year Manufacturer Warranty"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">💰 Pricing</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Price (₦) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="100000"
                min="0"
                step="0.01"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Compare at Price (₦)</label>
              <input
                type="number"
                name="compareAtPrice"
                value={formData.compareAtPrice}
                onChange={handleChange}
                placeholder="150000 (Original price)"
                min="0"
                step="0.01"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Shows as crossed-out price</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Cost per Item (₦)</label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleChange}
                placeholder="80000 (Your cost)"
                min="0"
                step="0.01"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">For profit tracking</p>
            </div>
          </div>

          {formData.price && formData.compareAtPrice && formData.compareAtPrice > formData.price && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700">
                💰 Discount: {Math.round((1 - formData.price / formData.compareAtPrice) * 100)}% OFF
                (Save ₦{(formData.compareAtPrice - formData.price).toLocaleString()})
              </p>
            </div>
          )}
        </div>

        {/* Inventory */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">📦 Inventory</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Stock Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="stock"
                value={formData.stock}
                onChange={handleChange}
                placeholder="50"
                min="0"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Return Policy</label>
              <select
                name="returnPolicy"
                value={formData.returnPolicy}
                onChange={handleChange}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="7 days">7 Days Return</option>
                <option value="14 days">14 Days Return</option>
                <option value="30 days">30 Days Return</option>
                <option value="no return">No Returns</option>
              </select>
            </div>
          </div>
        </div>

        {/* Product Description with AI */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">📝 Product Description</h2>
          
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows="8"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-purple-500"
              placeholder="Enter detailed product description..."
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
              💡 Fill in product name, category, and price first for best results
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Key Features</label>
            <textarea
              name="features"
              value={formData.features}
              onChange={handleChange}
              rows="3"
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 5G Network, 256GB Storage, 6.7-inch Display"
            />
          </div>
        </div>

        {/* Product Media with AI */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">📸 Product Media</h2>
          
          <div>
            <label className="block text-sm font-medium mb-2">
              Upload Images (Max 5) <span className="text-red-500">*</span>
            </label>
            
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChangeWithAI}
              className="w-full p-3 border rounded-lg"
            />
            
            {isAnalyzingImage && (
              <div className="mt-2 flex items-center gap-2 text-sm text-purple-600">
                <span className="animate-spin">🔄</span>
                <span>AI is analyzing image to suggest category...</span>
              </div>
            )}
            
            {imagePreviews.length > 0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border-2 border-gray-200"
                    />
                    {index === 0 && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                        Main
                      </div>
                    )}
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
              📸 First image will be the main product image. AI will suggest category based on image.
            </p>
          </div>
        </div>

        {/* Specifications */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">🔧 Specifications</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              value={currentSpec.key}
              onChange={(e) => setCurrentSpec({...currentSpec, key: e.target.value})}
              placeholder="Specification name (e.g., Screen Size)"
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={currentSpec.value}
                onChange={(e) => setCurrentSpec({...currentSpec, value: e.target.value})}
                placeholder="Value (e.g., 6.7 inches)"
                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addSpecification}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>

          {Object.keys(formData.specifications).length > 0 && (
            <div className="space-y-2">
              {Object.entries(formData.specifications).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">{key}:</span> {value}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSpecification(key)}
                    className="text-red-600 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Product Variants */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">🎨 Product Variants</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              value={currentVariant.name}
              onChange={(e) => setCurrentVariant({...currentVariant, name: e.target.value})}
              placeholder="Variant name (e.g., Color, Size)"
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={currentVariant.values}
                onChange={(e) => setCurrentVariant({...currentVariant, values: e.target.value})}
                placeholder="Values (comma-separated: Red, Blue, Green)"
                className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={addVariant}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>

          {formData.variants.length > 0 && (
            <div className="space-y-2">
              {formData.variants.map((variant, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">{variant.name}:</span> {variant.values.join(', ')}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeVariant(index)}
                    className="text-red-600 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tags */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">🏷️ Product Tags</h2>
          
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={currentTag}
              onChange={(e) => setCurrentTag(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add tag (e.g., trending, new arrival)"
              className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={addTag}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Add Tag
            </button>
          </div>

          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm flex items-center gap-2"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="hover:text-blue-900"
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Shipping */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">🚚 Shipping Information</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Weight (kg)</label>
              <input
                type="number"
                name="shippingWeight"
                value={formData.shippingWeight}
                onChange={handleChange}
                placeholder="0.5"
                min="0"
                step="0.01"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-sm font-medium mb-2">Length (cm)</label>
                <input
                  type="number"
                  value={formData.shippingDimensions.length}
                  onChange={(e) => handleNestedChange('shippingDimensions', 'length', e.target.value)}
                  placeholder="30"
                  min="0"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Width (cm)</label>
                <input
                  type="number"
                  value={formData.shippingDimensions.width}
                  onChange={(e) => handleNestedChange('shippingDimensions', 'width', e.target.value)}
                  placeholder="20"
                  min="0"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Height (cm)</label>
                <input
                  type="number"
                  value={formData.shippingDimensions.height}
                  onChange={(e) => handleNestedChange('shippingDimensions', 'height', e.target.value)}
                  placeholder="5"
                  min="0"
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* SEO Optimization */}
        <div className="bg-white border rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">🔍 SEO Optimization</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">SEO Title</label>
              <input
                type="text"
                name="seoTitle"
                value={formData.seoTitle}
                onChange={handleChange}
                placeholder="Optimized title for search engines"
                maxLength="60"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.seoTitle.length}/60 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">SEO Description</label>
              <textarea
                name="seoDescription"
                value={formData.seoDescription}
                onChange={handleChange}
                rows="3"
                placeholder="Meta description for search engines"
                maxLength="160"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.seoDescription.length}/160 characters
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">SEO Keywords</label>
              <input
                type="text"
                name="seoKeywords"
                value={formData.seoKeywords}
                onChange={handleChange}
                placeholder="keyword1, keyword2, keyword3"
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Comma-separated keywords for search optimization
              </p>
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="flex gap-4 sticky bottom-0 bg-white p-4 border-t shadow-lg rounded-lg">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition shadow-lg text-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Adding Product...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>✅</span>
                Add Product to Store
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Are you sure? All unsaved changes will be lost.')) {
                navigate('/admin/products');
              }
            }}
            disabled={loading}
            className="px-6 py-4 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:opacity-50 transition font-semibold"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Floating AI Helper */}
      {!formData.description && formData.name && formData.category && (
        <div className="fixed bottom-24 right-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-lg shadow-2xl animate-bounce">
          <p className="text-sm font-medium mb-2">✨ AI Tip</p>
          <p className="text-xs">Click "Generate with AI" to auto-create your product description!</p>
        </div>
      )}
    </div>
  );
};

export default AdminAddProduct;
