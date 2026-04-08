import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { useAuth } from '../../context/AuthContext';
import { aiProductService } from '../../services/aiProductService';
import { 
  FiInfo, FiDollarSign, FiImage, FiList, FiLayers, FiSettings, FiSearch,
  FiUploadCloud, FiZap, FiX, FiCheck, FiChevronDown, FiAlertCircle,
  FiTrash2, FiPlus, FiBox, FiTrendingUp, FiAnchor, FiTag
} from 'react-icons/fi';

const TABS = [
  { id: 'vital', label: 'Vital Info', icon: <FiInfo /> },
  { id: 'offer', label: 'Pricing', icon: <FiDollarSign /> },
  { id: 'images', label: 'Media', icon: <FiImage /> },
  { id: 'details', label: 'Specs', icon: <FiList /> },
  { id: 'variants', label: 'Variants', icon: <FiLayers /> },
  { id: 'advanced', label: 'Advanced', icon: <FiSettings /> },
  { id: 'shipping', label: 'SEO & Meta', icon: <FiSearch /> },
];

const CATEGORIES = [
  'Electronics', 'Fashion', 'Home', 'Beauty', 'Sports', 
  'Books', 'Toys', 'Food', 'Automotive', 'Other'
];

const AdminAddProduct = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { currentUser } = useAuth();
  const isEditing = !!id;

  const [activeTab, setActiveTab] = useState('vital');
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Vendor State
  const [vendors, setVendors] = useState([]);
  const [vendorSearch, setVendorSearch] = useState('');
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);

  // Form State
  const [form, setForm] = useState({
    name: '',
    description: '',
    category: '',
    brand: '',
    price: '',
    originalPrice: '',
    cost: '',
    stock: '',
    sku: '',
    status: 'approved',
    barcode: '',
    specifications: [{ key: '', value: '' }],
    variants: [],
    isAffiliate: false,
    affiliateLink: '',
    weight: '',
    seoTitle: '',
    seoDesc: '',
    keywords: '',
    tags: '',
    saleStart: '',
    saleEnd: '',
    isDigital: false,
    lowStockThreshold: '5',
    allowBackorders: false,
    taxClass: 'standard',
    maxQuantity: '',
    freeShipping: false,
  });

  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [video, setVideo] = useState(null);

  useEffect(() => {
    loadVendors();
    if (isEditing) {
      loadProduct();
    }
  }, [id]);

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role')
        .or('role.eq.vendor,role.eq.admin')
        .order('full_name');
        
      if (data) setVendors(data);
    } catch (err) {
      console.error('Error loading vendors:', err);
    }
  };

  const loadProduct = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, vendor:vendor_id(id, full_name, email, avatar_url)')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setForm({
          name: data.name || '',
          description: data.description || '',
          category: data.category || '',
          brand: data.brand || '',
          price: data.price?.toString() || '',
          originalPrice: data.original_price?.toString() || '',
          cost: data.cost?.toString() || '',
          stock: data.stock_quantity?.toString() || '',
          sku: data.sku || '',
          status: data.status || 'approved',
          barcode: data.barcode || '',
          specifications: data.metadata?.specifications || [{ key: '', value: '' }],
          variants: data.metadata?.variants || [],
          isAffiliate: data.is_affiliate || false,
          affiliateLink: data.affiliate_link || '',
          weight: data.shipping_weight?.toString() || '',
          seoTitle: data.seo_title || '',
          seoDesc: data.seo_description || '',
          keywords: data.metadata?.keywords || '',
          tags: (data.tags || []).join(', '),
          saleStart: data.metadata?.sale_start_date || '',
          saleEnd: data.metadata?.sale_end_date || '',
          isDigital: data.metadata?.is_digital || false,
          lowStockThreshold: data.metadata?.low_stock_threshold?.toString() || '5',
          allowBackorders: data.metadata?.allow_backorders || false,
          taxClass: data.metadata?.tax_class || 'standard',
          maxQuantity: data.metadata?.max_quantity?.toString() || '',
          freeShipping: data.free_shipping || false,
        });

        if (data.vendor) {
           setSelectedVendor(data.vendor);
        }

        if (data.images?.length > 0) {
          setImagePreviews(data.images);
        }
        if (data.video_url) setVideo(data.video_url);
      }
    } catch (err) {
      console.error('Error loading product:', err);
      setError('Failed to load product for editing');
    } finally {
      setLoading(false);
    }
  };

  const setField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  // Dynamic Array Handlers
  const handleAddSpec = () => setField('specifications', [...form.specifications, { key: '', value: '' }]);
  const handleRemoveSpec = (index) => setField('specifications', form.specifications.filter((_, i) => i !== index));
  const handleSpecChange = (index, key, val) => {
    const newSpecs = [...form.specifications];
    newSpecs[index][key] = val;
    setField('specifications', newSpecs);
  };

  const handleAddVariant = () => setField('variants', [...form.variants, { name: '', price: '', stock: '' }]);
  const handleRemoveVariant = (index) => setField('variants', form.variants.filter((_, i) => i !== index));
  const handleVariantChange = (index, key, val) => {
    const newVariants = [...form.variants];
    newVariants[index][key] = val;
    setField('variants', newVariants);
  };

  // Image Handling
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files);
    if (images.length + files.length > 10) {
      setError('Maximum 10 images allowed');
      return;
    }
    
    setImages(prev => [...prev, ...files]);
    const newPreviews = files.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImagesToSupabase = async () => {
    const urls = [];
    for (const image of images) {
      const fileExt = image.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `product_images/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, image);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('products').getPublicUrl(filePath);
      urls.push(data.publicUrl);
    }
    return urls;
  };

  // AI Generation
  const handleAIGeneration = async (type) => {
    if (!form.name) {
      setError('Please enter a product name first before generating content.');
      return;
    }
    
    setAiLoading(true);
    setError(null);
    try {
      if (type === 'description') {
        const desc = await aiProductService.generateDescription(form);
        setField('description', desc);
      } else {
        const keywords = await aiProductService.generateKeywords(form);
        setForm(p => ({ 
          ...p, 
          seoTitle: `${p.name} - Buy Best Quality Online`, 
          seoDesc: p.description?.substring(0, 155) || `Buy ${p.name} from Abu Mafhal Marketplace. Best deals on ${p.category}.`,
          keywords: keywords
        }));
      }
    } catch (err) {
      console.error(err);
      setError('AI Generation Failed. ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.price || !form.description) {
      setError('Missing required fields: Name, Price, or Description.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Session expired.');

      let imageUrls = [...imagePreviews.filter(url => url.startsWith('http'))]; 
      if (images.length > 0) {
        const newUrls = await uploadImagesToSupabase();
        imageUrls = [...imageUrls, ...newUrls];
      }

      if (imageUrls.length === 0) throw new Error('At least one product image is required.');

      const payload = {
        vendor_id: selectedVendor?.id || user.id,
        name: form.name,
        description: form.description,
        category: form.category,
        brand: form.brand,
        price: parseFloat(form.price),
        original_price: form.originalPrice ? parseFloat(form.originalPrice) : null,
        cost: form.cost ? parseFloat(form.cost) : null,
        stock_quantity: parseInt(form.stock) || 0,
        sku: form.sku,
        images: imageUrls,
        video_url: video,
        status: form.status,
        is_affiliate: form.isAffiliate,
        affiliate_link: form.affiliateLink,
        is_new: !isEditing,
        shipping_weight: parseFloat(form.weight) || null,
        free_shipping: form.freeShipping,
        seo_title: form.seoTitle,
        seo_description: form.seoDesc,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        barcode: form.barcode,
        metadata: {
          keywords: form.keywords,
          specifications: form.specifications.filter(s => s.key && s.value),
          variants: form.variants,
          is_digital: form.isDigital,
          low_stock_threshold: parseInt(form.lowStockThreshold) || 5,
          allow_backorders: form.allowBackorders,
          tax_class: form.taxClass,
          max_quantity: parseInt(form.maxQuantity) || null,
          sale_start_date: form.saleStart || null,
          sale_end_date: form.saleEnd || null,
        }
      };

      if (isEditing) {
        const { error: updateError } = await supabase.from('products').update(payload).eq('id', id);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from('products').insert(payload);
        if (insertError) throw insertError;
      }

      navigate('/admin/products');

    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  // Helper Input Component
  const InputGroup = ({ label, type = "text", value, onChange, placeholder, required, icon, prefix, hint, multi }) => (
    <div className="space-y-1">
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">{label} {required && <span className="text-red-500">*</span>}</label>
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>}
        {prefix && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">{prefix}</div>}
        {multi ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className={`w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none`}
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all ${icon ? 'pl-10' : ''} ${prefix ? 'pl-8' : ''}`}
          />
        )}
      </div>
      {hint && <p className="text-[10px] text-gray-400 font-medium pl-1">{hint}</p>}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-24 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
            {isEditing ? 'Edit Product Catalog' : 'New Listing Workshop'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Total parity with mobile app schema and premium styling.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => navigate('/admin/products')}
            className="px-6 py-3 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="group flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-bold transition-all shadow-xl shadow-indigo-500/20 hover:-translate-y-0.5"
          >
            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <FiCheck size={18} />}
            {isEditing ? 'Sync Changes' : 'Publish to Market'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-2xl flex items-start gap-3 text-red-700 dark:text-red-400 max-w-lg">
           <FiAlertCircle className="shrink-0 mt-0.5" size={20} />
           <p className="font-medium text-sm">{error}</p>
        </div>
      )}

      {/* Primary Layout */}
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        
        {/* Navigation Sidebar */}
        <div className="lg:w-64 w-full sticky top-28 z-20">
          <div className="bg-white/80 dark:bg-[#111111]/80 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 dark:border-white/5 p-2 flex lg:flex-col overflow-x-auto lg:overflow-visible gap-1 no-scrollbar">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-sm lg:w-full ${
                  activeTab === tab.id 
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 shadow-sm' 
                    : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 dark:text-gray-400 border border-transparent hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                <span className={`text-lg ${activeTab === tab.id ? 'scale-110' : ''} transition-transform`}>{tab.icon}</span>
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Workspace */}
        <div className="flex-1 w-full bg-white dark:bg-[#111111] rounded-3xl shadow-2xl border border-gray-100 dark:border-white/5 p-6 sm:p-10 min-h-[70vh]">
          
          {/* VITAL INFO TAB */}
          {activeTab === 'vital' && (
            <div className="space-y-10 animate-fade-in">
              <div className="border-b border-gray-100 dark:border-white/5 pb-6">
                <h2 className="text-2xl font-black mb-1">Vital Product Information</h2>
                <p className="text-gray-500 text-sm">Every listing starts with the basics. Complete these to make identifying your product easy.</p>
              </div>

              {/* Vendor Selector Block */}
              <div className="bg-gray-50/50 dark:bg-black/20 p-6 rounded-2xl border border-gray-200 dark:border-white/5">
                 <div className="flex items-center gap-2 mb-4">
                    <FiAnchor className="text-indigo-500" />
                    <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Merchant Ownership</h3>
                 </div>
                 <button 
                   onClick={() => setShowVendorModal(true)}
                   className="w-full flex items-center justify-between p-4 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/10 rounded-xl hover:border-indigo-500 hover:shadow-lg transition-all text-left"
                 >
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold overflow-hidden border-2 border-white dark:border-black shadow-md">
                          {selectedVendor?.avatar_url ? <img src={selectedVendor.avatar_url} alt="" className="w-full h-full object-cover" /> : selectedVendor?.full_name?.[0] || 'A'}
                       </div>
                       <div>
                          <p className="font-black text-gray-900 dark:text-white leading-none">{selectedVendor?.full_name || 'System / Unassigned'}</p>
                          <p className="text-xs text-gray-500 mt-1.5">{selectedVendor?.email || 'Choose a vendor account to assign this product'}</p>
                       </div>
                    </div>
                    <FiChevronDown className="text-gray-400" />
                 </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <InputGroup label="Product Identity" value={form.name} onChange={v => setField('name', v)} required placeholder="e.g. Ultra HD Smart Display 55\" />
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Industry Category *</label>
                  <div className="relative">
                    <select
                      value={form.category}
                      onChange={(e) => setField('category', e.target.value)}
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer font-medium"
                    >
                      <option value="" disabled>Select Segment</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <InputGroup label="Brand / Manufacturer" value={form.brand} onChange={v => setField('brand', v)} placeholder="e.g. Masterbrand" />
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest">Market Lifecycle</label>
                  <div className="relative">
                    <select
                      value={form.status}
                      onChange={(e) => setField('status', e.target.value)}
                      className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer font-bold"
                    >
                      <option value="approved">Published (Live Now)</option>
                      <option value="draft">Archived Draft</option>
                      <option value="pending">Review Pending</option>
                    </select>
                    <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Product Narrative *</label>
                  <button 
                    type="button"
                    onClick={() => handleAIGeneration('description')}
                    disabled={aiLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg font-bold text-xs hover:shadow-sm disabled:opacity-50 transition-all border border-indigo-100 dark:border-indigo-500/20"
                  >
                    {aiLoading ? <span className="animate-spin text-lg">⚙️</span> : <FiZap />} 
                    AI MAGIC
                  </button>
                </div>
                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Tell your customers why they need this..."
                  rows={8}
                  className="w-full bg-gray-50 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-2xl px-5 py-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-y leading-relaxed"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex items-center justify-between p-5 bg-indigo-500/5 rounded-2xl border border-indigo-500/10">
                   <div>
                      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><FiBox /> Digital Delivery</h3>
                      <p className="text-xs text-gray-500 mt-1">Check if no physical shipping is required.</p>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer scale-110">
                      <input type="checkbox" checked={form.isDigital} onChange={(e) => setField('isDigital', e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                </div>
                <div className="flex-1 flex items-center justify-between p-5 bg-amber-500/5 rounded-2xl border border-amber-500/10">
                   <div>
                      <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2"><FiTag /> Affiliate Link</h3>
                      <p className="text-xs text-gray-500 mt-1">Check if linking to an external site.</p>
                   </div>
                   <label className="relative inline-flex items-center cursor-pointer scale-110">
                      <input type="checkbox" checked={form.isAffiliate} onChange={(e) => setField('isAffiliate', e.target.checked)} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                </div>
              </div>

              {form.isAffiliate && (
                <div className="animate-fade-in-up">
                  <InputGroup label="Destination URL" icon={<FiAnchor />} value={form.affiliateLink} onChange={v => setField('affiliateLink', v)} placeholder="https://external-store.com/product" />
                </div>
              )}
            </div>
          )}

          {/* PRICING TAB */}
          {activeTab === 'offer' && (
            <div className="space-y-10 animate-fade-in">
              <div className="border-b border-gray-100 dark:border-white/5 pb-6">
                <h2 className="text-2xl font-black mb-1">Pricing & Payout Strategy</h2>
                <p className="text-gray-500 text-sm">Balanced pricing ensures profitability. Define your offer structure here.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                   <InputGroup label="Retail Listing Price *" prefix="₦" type="number" value={form.price} onChange={v => setField('price', v)} required hint="Visible buyer price" />
                </div>
                <div className="md:col-span-1">
                   <InputGroup label="Market Reference" prefix="₦" type="number" value={form.originalPrice} onChange={v => setField('originalPrice', v)} hint="Shown as strike-through" />
                </div>
                <div className="md:col-span-1">
                   <InputGroup label="Internal Unit Cost" prefix="₦" type="number" value={form.cost} onChange={v => setField('cost', v)} hint="Profit calculation only" />
                </div>
              </div>

              <div className="p-6 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-200 dark:border-white/5">
                <div className="flex items-center gap-2 mb-6">
                   <FiTrendingUp className="text-emerald-500" />
                   <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">Inventory Sync</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  <InputGroup label="Primary Stock Count *" type="number" value={form.stock} onChange={v => setField('stock', v)} required icon={<FiPlus />} />
                  <InputGroup label="Universal SKU" value={form.sku} onChange={v => setField('sku', v)} placeholder="PROD-102-X" />
                  <InputGroup label="Barcode / GTIN" value={form.barcode} onChange={v => setField('barcode', v)} placeholder="81729381723" />
                </div>
              </div>

              <div className="flex items-center justify-between p-6 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                 <div className="flex gap-4">
                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl flex items-center justify-center shadow-inner">
                       <FiZap size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-emerald-900 dark:text-emerald-400">Complimentary Logistics</h3>
                      <p className="text-xs text-emerald-700/60 dark:text-emerald-500/60 mt-1">Selecting this provides ₦0 delivery fees for buyers of this specific item.</p>
                    </div>
                 </div>
                 <label className="relative inline-flex items-center cursor-pointer scale-125">
                    <input type="checkbox" checked={form.freeShipping} onChange={(e) => setField('freeShipping', e.target.checked)} className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 dark:bg-gray-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 pl-1">Promotional Window</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 border border-gray-100 dark:border-white/5 rounded-2xl">
                    <InputGroup label="Campaign Launch Date" type="date" value={form.saleStart} onChange={v => setField('saleStart', v)} />
                    <InputGroup label="Campaign End Date" type="date" value={form.saleEnd} onChange={v => setField('saleEnd', v)} />
                 </div>
              </div>
            </div>
          )}

          {/* MEDIA TAB */}
          {activeTab === 'images' && (
             <div className="space-y-8 animate-fade-in">
                <div className="border-b border-gray-100 dark:border-white/5 pb-6">
                  <h2 className="text-2xl font-black mb-1">Visual Media Studio</h2>
                  <p className="text-gray-500 text-sm">Images are your primary conversion tool. Use clear, lifestyle-focused visuals.</p>
                </div>
                
                <div className="relative border-4 border-dashed border-indigo-200 dark:border-indigo-500/20 rounded-[2.5rem] p-16 bg-gray-50/50 dark:bg-black/30 text-center flex flex-col items-center justify-center hover:bg-white hover:border-indigo-400 dark:hover:bg-indigo-500/5 transition-all shadow-inner overflow-hidden cursor-pointer group">
                   <div className="absolute inset-0 bg-indigo-50 dark:bg-indigo-900/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                   <div className="relative z-10">
                      <div className="w-20 h-20 bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 flex items-center justify-center rounded-3xl mb-6 mx-auto group-hover:scale-110 group-hover:rotate-3 shadow-xl border border-indigo-100 dark:border-white/10 transition-all">
                        <FiUploadCloud size={40} />
                      </div>
                      <p className="text-xl font-black text-gray-900 dark:text-white mb-2 tracking-tight">Drop your visual assets here</p>
                      <p className="text-sm font-bold text-gray-500">Optimized for high-resolution PNG, JPG (Max. 10MB per file)</p>
                      <div className="mt-8 inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-full font-black text-xs shadow-lg shadow-indigo-500/30">
                         {imagePreviews.length} / 10 ASSETS LOADED
                      </div>
                   </div>
                   <input 
                     type="file" 
                     multiple 
                     accept="image/*"
                     onChange={handleImageSelect}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                   />
                </div>

                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                     {imagePreviews.map((preview, index) => (
                       <div key={index} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-gray-100 dark:border-white/5 group shadow-sm hover:shadow-xl transition-all">
                         <img src={preview} alt="" className="w-full h-full object-cover" />
                         <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[2px]">
                            <button onClick={() => removeImage(index)} className="w-10 h-10 bg-red-600 text-white rounded-2xl flex items-center justify-center hover:bg-red-700 transition-all font-bold">
                               <FiTrash2 size={20} />
                            </button>
                         </div>
                         {index === 0 && (
                           <div className="absolute top-2 left-2 px-3 py-1 bg-white/90 dark:bg-black/90 text-indigo-700 dark:text-indigo-400 text-[9px] font-black uppercase rounded-lg shadow-xl backdrop-blur-md border border-indigo-100/50 dark:border-white/10">COVER ASSET</div>
                         )}
                       </div>
                     ))}
                  </div>
                )}

                <div className="pt-10 border-t border-gray-100 dark:border-white/5 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 pl-1 flex items-center gap-2"><FiZap /> Demo Video (URL)</h3>
                  <div className="flex gap-4">
                     <div className="flex-1">
                        <InputGroup placeholder="Paste YouTube, Vimeo, or S3 public URL..." value={video} onChange={v => setVideo(v)} icon={<FiImage />} />
                     </div>
                  </div>
                </div>
             </div>
          )}

          {/* SPECS TAB */}
          {activeTab === 'details' && (
             <div className="space-y-10 animate-fade-in">
                <div className="border-b border-gray-100 dark:border-white/5 pb-6">
                  <h2 className="text-2xl font-black mb-1">Technical Specifications</h2>
                  <p className="text-gray-500 text-sm">Define technical rows that help buyers compare performance and fits.</p>
                </div>

                <div className="space-y-4">
                  {form.specifications.map((spec, index) => (
                    <div key={index} className="flex flex-col sm:flex-row gap-4 p-5 bg-gray-50 dark:bg-black/20 rounded-2xl border border-gray-200 dark:border-white/5 group relative transition-all hover:bg-white dark:hover:bg-white/5">
                       <div className="sm:w-1/3">
                         <InputGroup label="Attribute Name" value={spec.key} onChange={v => handleSpecChange(index, 'key', v)} placeholder="e.g. Battery Life" />
                       </div>
                       <div className="flex-1">
                         <InputGroup label="Metric Value" value={spec.value} onChange={v => handleSpecChange(index, 'value', v)} placeholder="e.g. 24 Hours Active" />
                       </div>
                       <div className="sm:pt-6 flex justify-end items-center">
                          <button 
                            type="button"
                            onClick={() => handleRemoveSpec(index)}
                            className="p-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <FiTrash2 size={20} />
                          </button>
                       </div>
                    </div>
                  ))}

                  <button 
                    type="button"
                    onClick={handleAddSpec}
                    className="w-full flex items-center justify-center gap-2 py-5 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl text-gray-400 font-bold hover:border-indigo-500 hover:text-indigo-500 transition-all hover:bg-indigo-50 dark:hover:bg-indigo-500/5 group"
                  >
                    <FiPlus className="group-hover:rotate-90 transition-transform" />
                    ADD SPECIFICATION ROW
                  </button>
                </div>
             </div>
          )}

          {/* VARIANTS TAB */}
          {activeTab === 'variants' && (
             <div className="space-y-10 animate-fade-in">
                <div className="border-b border-gray-100 dark:border-white/5 pb-6">
                  <h2 className="text-2xl font-black mb-1">Product Variants</h2>
                  <p className="text-gray-500 text-sm">Offer different versions like sizes, colors, or materials.</p>
                </div>

                <div className="space-y-6">
                  {form.variants.map((variant, index) => (
                    <div key={index} className="p-8 bg-gray-50 dark:bg-black/20 rounded-3xl border border-gray-200 dark:border-white/5 relative">
                       <button 
                         type="button"
                         onClick={() => handleRemoveVariant(index)}
                         className="absolute top-6 right-6 p-2 text-gray-400 hover:text-red-500 transition-colors"
                       >
                         <FiX size={20} />
                       </button>
                       
                       <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <div className="md:col-span-1">
                             <InputGroup label="Variant Identity" value={variant.name} onChange={v => handleVariantChange(index, 'name', v)} placeholder="e.g. Ocean Blue, Large" required />
                          </div>
                          <div className="md:col-span-1">
                             <InputGroup label="Price Adjustment" prefix="₦" type="number" value={variant.price} onChange={v => handleVariantChange(index, 'price', v)} placeholder="0.00" />
                          </div>
                          <div className="md:col-span-1">
                             <InputGroup label="Unique Stock" type="number" value={variant.stock} onChange={v => handleVariantChange(index, 'stock', v)} placeholder="0" />
                          </div>
                       </div>
                    </div>
                  ))}

                  <button 
                    type="button"
                    onClick={handleAddVariant}
                    className="w-full flex items-center justify-center gap-2 py-5 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl text-gray-400 font-bold hover:border-indigo-500 hover:text-indigo-500 transition-all hover:bg-indigo-50 dark:hover:bg-indigo-500/5 group"
                  >
                    <FiPlus className="group-hover:rotate-90 transition-transform" />
                    CREATE NEW VARIANT
                  </button>
                </div>
             </div>
          )}

          {/* ADVANCED TAB */}
          {activeTab === 'advanced' && (
             <div className="space-y-12 animate-fade-in">
                <div className="border-b border-gray-100 dark:border-white/5 pb-6">
                  <h2 className="text-2xl font-black mb-1">Inventory & Tax Controls</h2>
                  <p className="text-gray-500 text-sm">Fine-tune how stock behaves and legal taxation classes.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="space-y-8">
                      <InputGroup label="Low Stock Warning Limit" type="number" value={form.lowStockThreshold} onChange={v => setField('lowStockThreshold', v)} icon={<FiAlertCircle />} hint="We'll notify the merchant when stock hits this level." />
                      <InputGroup label="Purchase Limit Per Customer" type="number" value={form.maxQuantity} onChange={v => setField('maxQuantity', v)} icon={<FiBox />} hint="Limit excessive buying of rare items." />
                   </div>
                   
                   <div className="space-y-8">
                     <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest pl-1 mb-2">Fiscal Tax Class</label>
                        <div className="grid grid-cols-3 gap-3">
                           {['standard', 'reduced', 'zero'].map(tc => (
                             <button
                               key={tc}
                               type="button"
                               onClick={() => setField('taxClass', tc)}
                               className={`px-4 py-3 rounded-xl font-bold text-xs uppercase tracking-tighter transition-all border ${
                                 form.taxClass === tc 
                                   ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' 
                                   : 'bg-white dark:bg-black/30 text-gray-500 border-gray-200 dark:border-white/10 hover:border-indigo-300'
                               }`}
                             >
                               {tc} 
                             </button>
                           ))}
                        </div>
                     </div>

                     <div className="flex items-center justify-between p-6 bg-amber-500/5 rounded-3xl border border-amber-500/10">
                        <div>
                          <h3 className="font-bold text-gray-900 dark:text-white">Allow Backorders</h3>
                          <p className="text-xs text-gray-500 mt-1">Customers can purchase item even if it's out of stock.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer scale-110">
                          <input type="checkbox" checked={form.allowBackorders} onChange={(e) => setField('allowBackorders', e.target.checked)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-gray-200 dark:bg-gray-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                     </div>
                   </div>
                </div>
             </div>
          )}

          {/* SEO TAB */}
          {activeTab === 'shipping' && (
             <div className="space-y-10 animate-fade-in">
                <div className="border-b border-gray-100 dark:border-white/5 pb-6">
                  <h2 className="text-2xl font-black mb-1">Discoverability & Optimization</h2>
                  <p className="text-gray-500 text-sm">How your product appears on Google and internal search engines.</p>
                </div>

                {!form.isDigital && (
                  <div className="p-6 bg-indigo-500/5 rounded-3xl border border-indigo-500/10 max-w-sm">
                    <InputGroup label="Unit Shipping Weight (KG)" type="number" value={form.weight} onChange={v => setField('weight', v)} icon={<FiZap />} />
                  </div>
                )}

                <div className="space-y-8 bg-gray-50/50 dark:bg-black/20 p-8 rounded-[2rem] border border-gray-200 dark:border-white/5 relative">
                   <div className="absolute top-8 right-8">
                      <button 
                        type="button"
                        onClick={() => handleAIGeneration('seo')}
                        disabled={aiLoading}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-br from-indigo-600 to-purple-700 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
                      >
                         {aiLoading ? <span className="animate-pulse">Optimizing...</span> : <><FiZap /> AI SEO OPTIMIZE</>}
                      </button>
                   </div>
                   
                   <div className="max-w-2xl space-y-8">
                     <InputGroup label="Search Engine Title" value={form.seoTitle} onChange={v => setField('seoTitle', v)} placeholder="Optimized title for SERP" hint="Recommend 60 chars maximum" />
                     <InputGroup label="Meta Description" value={form.seoDesc} onChange={v => setField('seoDesc', v)} placeholder="Catchy summary for search results" multi hint="Ideally 150-160 characters" />
                     <InputGroup label="Search Tokens (Internal)" value={form.keywords} onChange={v => setField('keywords', v)} placeholder="bluetooth, audio, hd, electronics" multi hint="Comma separated words used by marketplace search engine" />
                     <InputGroup label="Navigational Tags" value={form.tags} onChange={v => setField('tags', v)} placeholder="Hot Deals, Summer Sale, Tech" hint="Used for filtering on storefront" />
                   </div>
                </div>
             </div>
          )}

        </div>
      </div>

      {/* Profile/Vendor Selection Overlay */}
      {showVendorModal && (
         <div className="fixed inset-0 z-[100] flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md transition-all duration-500" onClick={() => setShowVendorModal(false)} />
            <div className="relative w-full max-w-lg bg-white dark:bg-[#0A0A0A] shadow-[0_0_80px_rgba(0,0,0,0.4)] h-full p-8 animate-slide-in-right flex flex-col border-l border-gray-200 dark:border-white/5">
               <div className="flex justify-between items-center mb-10">
                 <div>
                   <h2 className="text-2xl font-black tracking-tight">Merchant Lookup</h2>
                   <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mt-1">Assign product to an owner</p>
                 </div>
                 <button onClick={() => setShowVendorModal(false)} className="w-12 h-12 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded-2xl flex items-center justify-center transition-all"><FiX size={24} /></button>
               </div>
               
               <div className="relative mb-8">
                 <FiSearch className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                 <input 
                   type="text" 
                   placeholder="Enter merchant name or email..." 
                   value={vendorSearch}
                   onChange={e => setVendorSearch(e.target.value)}
                   className="w-full pl-14 pr-6 py-4 bg-gray-50 dark:bg-black/50 border-2 border-transparent focus:border-indigo-500 dark:focus:border-indigo-400 rounded-2xl outline-none font-bold shadow-inner transition-all"
                 />
               </div>

               <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-10">
                  {vendors.filter(v => 
                    v.full_name?.toLowerCase().includes(vendorSearch.toLowerCase()) || 
                    v.email?.toLowerCase().includes(vendorSearch.toLowerCase())
                  ).map(vendor => (
                    <button
                      key={vendor.id}
                      onClick={() => { setSelectedVendor(vendor); setShowVendorModal(false); }}
                      className={`w-full flex items-center gap-5 p-5 rounded-3xl transition-all text-left border-2 ${
                        selectedVendor?.id === vendor.id 
                        ? 'bg-indigo-50/50 border-indigo-600/50 scale-[0.98]' 
                        : 'bg-white dark:bg-white/5 border-transparent hover:border-indigo-500/30'
                      }`}
                    >
                      <img src={vendor.avatar_url || 'https://via.placeholder.com/48'} alt="" className="w-14 h-14 rounded-2xl object-cover shadow-lg" />
                      <div className="flex-1">
                        <p className="font-black text-gray-900 dark:text-white text-lg tracking-tight">{vendor.full_name || 'Anonymous Merchant'}</p>
                        <p className="text-xs text-gray-500 font-medium truncate max-w-[200px]">{vendor.email}</p>
                        <div className="mt-2 flex">
                           <span className={`px-2 py-0.5 text-[10px] font-black uppercase rounded-lg shadow-sm border ${
                             vendor.role === 'admin' 
                             ? 'bg-amber-100 text-amber-700 border-amber-200' 
                             : 'bg-indigo-100 text-indigo-700 border-indigo-200'
                           }`}>{vendor.role}</span>
                        </div>
                      </div>
                      {selectedVendor?.id === vendor.id && <FiCheck size={24} className="text-indigo-600" />}
                    </button>
                  ))}
               </div>
               
               <div className="pt-6 border-t border-gray-100 dark:border-white/10">
                  <button onClick={() => setShowVendorModal(false)} className="w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl font-black transition-all hover:opacity-90 active:scale-95">CLOSE LOOKUP</button>
               </div>
            </div>
         </div>
      )}

    </div>
  );
};

export default AdminAddProduct;
