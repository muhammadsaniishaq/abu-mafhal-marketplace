import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { useNavigate, Link } from 'react-router-dom';

const BUSINESS_TYPES = [
  {
    id: 'limited_company',
    label: 'Limited Liability Company (Ltd / RC)',
    badge: 'RC Reg',
    desc: 'Incorporated company with CAC RC number',
    cacLabel: 'CAC RC Number',
    cacPlaceholder: 'e.g. RC-1849202',
    cacRequired: true
  },
  {
    id: 'business_name',
    label: 'Registered Business Name (BN)',
    badge: 'BN Reg',
    desc: 'Sole proprietorship / Enterprise with CAC BN number',
    cacLabel: 'CAC BN Number',
    cacPlaceholder: 'e.g. BN-3849202',
    cacRequired: true
  },
  {
    id: 'sole_proprietor',
    label: 'Individual Trader / Artisan',
    badge: 'Individual',
    desc: 'Artisan, local merchant or informal retailer',
    cacLabel: 'CAC / Business ID (Optional)',
    cacPlaceholder: 'Optional (e.g. Tax ID or RC)',
    cacRequired: false
  },
  {
    id: 'partnership',
    label: 'Partnership / Cooperative',
    badge: 'Co-op',
    desc: 'Cooperative society or multi-partner business',
    cacLabel: 'Cooperative Reg Number',
    cacPlaceholder: 'Coop Reg / CAC Number',
    cacRequired: true
  }
];

const BUSINESS_CATEGORIES = [
  { id: 'Electronics', label: 'Tech & Gadgets', sub: 'Phones, Computers & Accessories', emoji: '📱' },
  { id: 'Fashion', label: 'Fashion & Wear', sub: 'Men & Women Wear, Abayas, Shoes', emoji: '👗' },
  { id: 'Beauty', label: 'Beauty & Skincare', sub: 'Cosmetics, Perfumes & Hair Care', emoji: '💄' },
  { id: 'Groceries', label: 'Groceries & Provisions', sub: 'Foodstuff, Spices & Goods', emoji: '🍎' },
  { id: 'Automotive', label: 'Auto & Spare Parts', sub: 'Car Parts, Oils & Accessories', emoji: '🚗' },
  { id: 'Home', label: 'Home & Living', sub: 'Furniture, Kitchen & Decor', emoji: '🛋️' },
  { id: 'General', label: 'General Wholesale', sub: 'Bulk Supplies & Sundry Goods', emoji: '📦' }
];

const OPERATING_HUBS = [
  'Kano (Kantin Kwari / Singa / Sabon Gari)',
  'Lagos (Alaba / Trade Fair / Balogun / Ikeja)',
  'Abuja (FCT - Wuse / Garki)',
  'Kaduna (Central Market / Kasuwan Barchi)',
  'Katsina (Central Market)',
  'Sokoto',
  'Other State / Location'
];

const STEPS = [
  { id: 1, title: 'Personal Info', desc: 'Contact & Legal Identity' },
  { id: 2, title: 'Business Profile', desc: 'Structure & Store Details' },
  { id: 3, title: 'Compliance Docs', desc: 'Documents & Verification' }
];

const VendorApplication = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    fullName: currentUser?.name || currentUser?.user_metadata?.full_name || '',
    email: currentUser?.email || '',
    phone: currentUser?.phone || currentUser?.user_metadata?.phone_number || '',
    ninNumber: '',
    bvnNumber: '',
    businessType: 'limited_company',
    businessCategory: 'Electronics',
    businessName: '',
    businessAddress: '',
    businessLocation: 'Kano (Kantin Kwari / Singa / Sabon Gari)',
    cacNumber: '',
    businessDescription: '',
    whatsapp: currentUser?.phone || currentUser?.user_metadata?.phone_number || '',
    instagram: '',
    website: ''
  });

  const [files, setFiles] = useState({
    businessImage: null,
    businessVideo: null,
    ninDocument: null,
    cacDocument: null
  });

  const [previews, setPreviews] = useState({
    businessImage: null,
    businessVideo: null,
    ninDocument: null,
    cacDocument: null
  });

  const activeBusinessType = BUSINESS_TYPES.find(b => b.id === formData.businessType) || BUSINESS_TYPES[0];

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    const { name, files: selectedFiles } = e.target;
    const file = selectedFiles[0];
    if (!file) return;

    setFiles(prev => ({
      ...prev,
      [name]: file
    }));

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => ({ ...prev, [name]: reader.result }));
      };
      reader.readAsDataURL(file);
    } else {
      setPreviews(prev => ({ ...prev, [name]: file.name }));
    }
  };

  const validateStep = (currentStep) => {
    setError('');
    if (currentStep === 1) {
      if (!formData.fullName.trim()) {
        setError('Please enter your full legal name.');
        return false;
      }
      if (!formData.email.trim()) {
        setError('Please enter your official email address.');
        return false;
      }
      if (!formData.phone.trim()) {
        setError('Please enter your mobile phone number.');
        return false;
      }
      if (!formData.ninNumber.trim() || formData.ninNumber.trim().length < 11) {
        setError('A valid 11-digit National Identity Number (NIN) is required.');
        return false;
      }
    }
    if (currentStep === 2) {
      if (!formData.businessName.trim()) {
        setError('Please enter your store or business name.');
        return false;
      }
      if (activeBusinessType.cacRequired && !formData.cacNumber.trim()) {
        setError(`Please enter your ${activeBusinessType.cacLabel}.`);
        return false;
      }
      if (!formData.businessAddress.trim()) {
        setError('Please provide your physical store address.');
        return false;
      }
      if (!formData.businessDescription.trim()) {
        setError('Please provide a brief description of your merchandise.');
        return false;
      }
    }
    if (currentStep === 3) {
      if (!files.businessImage) {
        setError('Storefront or product showcase image is required.');
        return false;
      }
      if (activeBusinessType.cacRequired && !files.cacDocument) {
        setError('CAC registration certificate or document is required.');
        return false;
      }
      if (!files.ninDocument) {
        setError('NIN slip or identity document is required.');
        return false;
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 3));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const prevStep = () => {
    setError('');
    setStep(prev => Math.max(prev - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const uploadFile = async (file, path) => {
    if (!file) return null;
    const timestamp = Date.now();
    const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `${currentUser?.id || currentUser?.uid || 'guest'}/${path}/${timestamp}_${cleanName}`;
    const { error: uploadErr } = await supabase.storage.from('vendor-applications').upload(filePath, file);
    if (uploadErr) throw uploadErr;
    const { data } = supabase.storage.from('vendor-applications').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateStep(3)) return;

    setLoading(true);
    setError('');

    try {
      const userId = currentUser?.id || currentUser?.uid;
      if (!userId) {
        throw new Error('Please sign in or create an account before applying.');
      }

      // Check if user already has a pending application
      const { data: existingApp, error: checkError } = await supabase
        .from('vendor_applications')
        .select('status')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingApp) {
        setError('You already have an application under review. Our compliance team will contact you shortly.');
        setLoading(false);
        return;
      }

      // Upload files concurrently
      const [businessImageUrl, businessVideoUrl, ninDocUrl, cacDocUrl] = await Promise.all([
        uploadFile(files.businessImage, 'images'),
        uploadFile(files.businessVideo, 'videos'),
        uploadFile(files.ninDocument, 'documents'),
        uploadFile(files.cacDocument, 'documents')
      ]);

      // Create or upsert vendor application
      const applicationData = {
        user_id: userId,
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        bvn: formData.bvnNumber,
        business_name: formData.businessName,
        business_address: formData.businessAddress,
        business_location: formData.businessLocation,
        business_category: formData.businessCategory,
        nin: formData.ninNumber,
        cac_number: formData.cacNumber,
        business_description: formData.businessDescription,
        logo_url: businessImageUrl,
        video_url: businessVideoUrl,
        nin_url: ninDocUrl,
        cac_url: cacDocUrl,
        status: 'pending',
        socials: {
          business_type: formData.businessType,
          operating_hub: formData.businessLocation,
          whatsapp: formData.whatsapp,
          instagram: formData.instagram,
          website: formData.website
        },
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error: insertError } = await supabase
        .from('vendor_applications')
        .upsert([applicationData], { onConflict: 'user_id' });

      if (insertError) throw insertError;

      setSuccess(true);
      setTimeout(() => {
        navigate('/buyer');
      }, 3500);

    } catch (err) {
      console.error('Error submitting application:', err);
      setError(err.message || 'Failed to submit application. Please check your network and try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
            Application Submitted!
          </h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            Your vendor application has been securely received. Our compliance desk is reviewing your CAC and NIN records. You will receive an email once approved.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>APPLICATION STATUS</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">Pending Review</span>
            </div>
            <p className="text-slate-900 text-sm font-bold">{formData.businessName}</p>
            <p className="text-slate-500 text-xs mt-0.5">{formData.email}</p>
          </div>
          <Link
            to="/buyer"
            className="w-full inline-flex items-center justify-center px-6 py-3.5 bg-gradient-to-r from-[#D9A73A] to-[#B38128] hover:from-[#E5B548] hover:to-[#C49033] text-slate-950 font-extrabold rounded-xl transition shadow-lg shadow-[#D9A73A]/20"
          >
            Go to Buyer Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-extrabold tracking-wider uppercase mb-3">
            <span>Official Merchant Accreditation</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Become a Verified Vendor
          </h1>
          <p className="text-slate-600 text-sm sm:text-base mt-2 max-w-lg mx-auto">
            Sell authentic products nationwide on Abu Mafhal Marketplace with verified escrow payments.
          </p>
        </div>

        {/* Merchant Perks Showcase Banner */}
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200/80 rounded-2xl p-5 mb-8 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-white shadow-sm flex items-center justify-center text-amber-700 font-black">
              👑
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Abu Mafhal Verified Merchant Privileges</h3>
              <p className="text-xs text-slate-600">Accelerate your brand with premium buyer confidence</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="bg-white border border-amber-200/60 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-800 shadow-xs">
              <span className="text-emerald-600">✓</span> 100% Escrow
            </div>
            <div className="bg-white border border-amber-200/60 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-800 shadow-xs">
              <span className="text-amber-600">⚡</span> Same-Day Payout
            </div>
            <div className="bg-white border border-amber-200/60 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-800 shadow-xs">
              <span className="text-blue-600">🚚</span> Nationwide Logistics
            </div>
            <div className="bg-white border border-amber-200/60 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-bold text-slate-800 shadow-xs">
              <span className="text-amber-600">🎖️</span> Gold Badge
            </div>
          </div>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between relative">
            {STEPS.map((s) => {
              const isCompleted = step > s.id;
              const isCurrent = step === s.id;
              return (
                <div key={s.id} className="flex-1 flex flex-col items-center relative z-10">
                  <button
                    type="button"
                    onClick={() => s.id < step && setStep(s.id)}
                    disabled={s.id > step}
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                      isCompleted
                        ? 'bg-[#D9A73A] text-slate-950 ring-2 ring-[#D9A73A]/40'
                        : isCurrent
                        ? 'bg-amber-50 text-amber-800 border-2 border-[#D9A73A] ring-4 ring-[#D9A73A]/20'
                        : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      s.id
                    )}
                  </button>
                  <span className={`text-xs mt-2 font-bold tracking-tight text-center ${isCurrent ? 'text-amber-800 font-extrabold' : isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                    {s.title}
                  </span>
                </div>
              );
            })}
            {/* Progress line */}
            <div className="absolute top-5 left-12 right-12 h-0.5 bg-slate-200 -z-0">
              <div
                className="h-full bg-gradient-to-r from-[#D9A73A] to-[#F59E0B] transition-all duration-500"
                style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 text-sm font-semibold">{error}</p>
          </div>
        )}

        {/* Form Container */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          {/* STEP 1: PERSONAL INFORMATION */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D9A73A]" />
                  Applicant Identity & Contact
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">
                  Enter your official legal name as registered on government identity databases.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Full Legal Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Muhammad Sani"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:outline-none focus:bg-white focus:border-[#D9A73A] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Official Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="vendor@example.com"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:outline-none focus:bg-white focus:border-[#D9A73A] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Mobile Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="+234 800 000 0000"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:outline-none focus:bg-white focus:border-[#D9A73A] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    National Identity Number (NIN) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="ninNumber"
                    value={formData.ninNumber}
                    onChange={handleChange}
                    required
                    maxLength="11"
                    placeholder="11-digit NIN Number"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:outline-none focus:bg-white focus:border-[#D9A73A] transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Bank Verification Number (BVN) <span className="text-slate-400 text-xs font-normal">(Optional for payouts)</span>
                  </label>
                  <input
                    type="text"
                    name="bvnNumber"
                    value={formData.bvnNumber}
                    onChange={handleChange}
                    maxLength="11"
                    placeholder="11-digit BVN Number"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:outline-none focus:bg-white focus:border-[#D9A73A] transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: BUSINESS INFORMATION & STRUCTURE */}
          {step === 2 && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 mb-4">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D9A73A]" />
                  Business Structure & Store Profile
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">
                  Information regarding your commercial enterprise and marketplace storefront.
                </p>
              </div>

              {/* Business Registration Structure */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Business Registration Structure <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BUSINESS_TYPES.map(bt => {
                    const isSelected = formData.businessType === bt.id;
                    return (
                      <div
                        key={bt.id}
                        onClick={() => setFormData(prev => ({ ...prev, businessType: bt.id }))}
                        className={`p-3.5 rounded-xl border cursor-pointer transition flex items-start gap-3 ${
                          isSelected
                            ? 'bg-amber-50/80 border-[#D9A73A] shadow-xs'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full mt-0.5 border-2 flex items-center justify-center ${
                          isSelected ? 'border-[#B45309]' : 'border-slate-300'
                        }`}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-[#B45309]" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">{bt.label}</span>
                            <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200">
                              {bt.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">{bt.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Primary Category Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Primary Store Category <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {BUSINESS_CATEGORIES.map(cat => {
                    const isSelected = formData.businessCategory === cat.id;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setFormData(prev => ({ ...prev, businessCategory: cat.id }))}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center gap-3 ${
                          isSelected
                            ? 'bg-amber-50/80 border-[#D9A73A]'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                        }`}
                      >
                        <span className="text-xl">{cat.emoji}</span>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-900">{cat.label}</p>
                          <p className="text-[10px] text-slate-500">{cat.sub}</p>
                        </div>
                        {isSelected && <span className="text-amber-700 font-bold text-sm">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Store / Enterprise Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Sani Ventures Ltd"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:outline-none focus:bg-white focus:border-[#D9A73A] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {activeBusinessType.cacLabel} {activeBusinessType.cacRequired && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="text"
                    name="cacNumber"
                    value={formData.cacNumber}
                    onChange={handleChange}
                    placeholder={activeBusinessType.cacPlaceholder}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:outline-none focus:bg-white focus:border-[#D9A73A] transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Primary Commercial Trading Hub <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="businessLocation"
                    value={formData.businessLocation}
                    onChange={handleChange}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:outline-none focus:bg-white focus:border-[#D9A73A] transition"
                  >
                    {OPERATING_HUBS.map(hub => (
                      <option key={hub} value={hub}>{hub}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Physical Store Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessAddress"
                    value={formData.businessAddress}
                    onChange={handleChange}
                    required
                    placeholder="Shop/Office number, street address"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:outline-none focus:bg-white focus:border-[#D9A73A] transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Business / Inventory Overview <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="businessDescription"
                    value={formData.businessDescription}
                    onChange={handleChange}
                    required
                    rows="3"
                    placeholder="Describe your products, categories, and customer warranty..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-base focus:outline-none focus:bg-white focus:border-[#D9A73A] transition resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: DOCUMENTS & VERIFICATION */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-slate-100 pb-4 mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D9A73A]" />
                  Required Compliance Documents
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">
                  Upload clear photos or PDF documents to verify merchant accreditation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Storefront Image */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    Storefront / Product Showcase Image <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    name="businessImage"
                    onChange={handleFileChange}
                    accept="image/*"
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#D9A73A] file:text-slate-950 hover:file:bg-[#F59E0B] cursor-pointer"
                  />
                  {previews.businessImage && (
                    <div className="mt-3 relative rounded-lg overflow-hidden h-28 border border-slate-200">
                      <img src={previews.businessImage} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* CAC Document */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    CAC Certificate (Image or PDF) {activeBusinessType.cacRequired && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    type="file"
                    name="cacDocument"
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#D9A73A] file:text-slate-950 hover:file:bg-[#F59E0B] cursor-pointer"
                  />
                  {previews.cacDocument && (
                    <p className="mt-3 text-xs text-emerald-600 font-semibold truncate">
                      📄 Document Attached: {previews.cacDocument}
                    </p>
                  )}
                </div>

                {/* NIN Document */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    NIN Slip / Card (Image or PDF) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    name="ninDocument"
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#D9A73A] file:text-slate-950 hover:file:bg-[#F59E0B] cursor-pointer"
                  />
                  {previews.ninDocument && (
                    <p className="mt-3 text-xs text-emerald-600 font-semibold truncate">
                      📄 Document Attached: {previews.ninDocument}
                    </p>
                  )}
                </div>

                {/* Intro Video */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    Store Intro Video <span className="text-slate-400 text-xs font-normal">(Optional)</span>
                  </label>
                  <input
                    type="file"
                    name="businessVideo"
                    onChange={handleFileChange}
                    accept="video/*"
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#D9A73A] file:text-slate-950 hover:file:bg-[#F59E0B] cursor-pointer"
                  />
                  {previews.businessVideo && (
                    <p className="mt-3 text-xs text-emerald-600 font-semibold truncate">
                      📹 Video Attached: {previews.businessVideo}
                    </p>
                  )}
                </div>
              </div>

              {/* Agreement Notice */}
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                  By submitting this application, you declare that all CAC, NIN, and store information provided are authentic and compliant with Abu Mafhal Marketplace Merchant Terms of Service.
                </p>
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center gap-3 pt-6 mt-6 border-t border-slate-100">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm transition"
              >
                Back
              </button>
            ) : (
              <Link
                to="/buyer"
                className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm transition"
              >
                Cancel
              </Link>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#D9A73A] to-[#B38128] hover:from-[#E5B548] hover:to-[#C49033] text-slate-950 font-black text-sm tracking-wide transition shadow-lg shadow-[#D9A73A]/20"
              >
                Next Step
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-black text-sm tracking-wide transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Uploading & Submitting...</span>
                  </>
                ) : (
                  <span>Submit Vendor Application</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorApplication;