import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../config/supabase';
import { useNavigate, Link } from 'react-router-dom';

const STEPS = [
  { id: 1, title: 'Personal Info', desc: 'Contact details' },
  { id: 2, title: 'Business Profile', desc: 'Store identity' },
  { id: 3, title: 'Documents & KYC', desc: 'Verification docs' }
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
    bvnNumber: '',
    businessName: '',
    businessAddress: '',
    businessLocation: '',
    ninNumber: '',
    cacNumber: '',
    businessDescription: ''
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
      if (!formData.fullName.trim() || !formData.email.trim() || !formData.phone.trim()) {
        setError('Please provide your full name, email address, and phone number.');
        return false;
      }
      if (!formData.ninNumber.trim() || formData.ninNumber.trim().length < 11) {
        setError('A valid 11-digit NIN is required for vendor KYC verification.');
        return false;
      }
    }
    if (currentStep === 2) {
      if (!formData.businessName.trim() || !formData.businessAddress.trim() || !formData.businessLocation.trim()) {
        setError('Please provide your business name, address, and city/state location.');
        return false;
      }
      if (!formData.cacNumber.trim()) {
        setError('CAC Registration Number is required.');
        return false;
      }
      if (!formData.businessDescription.trim()) {
        setError('Please enter a brief description of the products you plan to sell.');
        return false;
      }
    }
    if (currentStep === 3) {
      if (!files.businessImage) {
        setError('Store/Business image is required.');
        return false;
      }
      if (!files.ninDocument) {
        setError('NIN document image or PDF is required.');
        return false;
      }
      if (!files.cacDocument) {
        setError('CAC registration document is required.');
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
        setError('You already have an application under review. Our team will contact you shortly.');
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
        bvn_number: formData.bvnNumber,
        business_name: formData.businessName,
        business_address: formData.businessAddress,
        business_location: formData.businessLocation,
        nin_number: formData.ninNumber,
        cac_number: formData.cacNumber,
        business_description: formData.businessDescription,
        business_image_url: businessImageUrl,
        business_video_url: businessVideoUrl,
        nin_document_url: ninDocUrl,
        cac_document_url: cacDocUrl,
        status: 'pending',
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
      <div className="min-h-screen flex items-center justify-center bg-[#070D1B] px-4 py-12">
        <div className="max-w-md w-full bg-[#0E1A2E] border border-[#D9A73A]/30 rounded-2xl shadow-2xl p-8 text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-white mb-2 tracking-tight">
            Application Submitted!
          </h2>
          <p className="text-slate-300 text-sm mb-6 leading-relaxed">
            Your vendor application has been securely received. Our compliance desk is reviewing your CAC and NIN records. You will receive an email once approved.
          </p>
          <div className="bg-[#14233D] border border-amber-500/30 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
              <span>APPLICATION STATUS</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-[#D9A73A] font-bold">Pending Review</span>
            </div>
            <p className="text-white text-sm font-bold">{formData.businessName}</p>
            <p className="text-slate-400 text-xs mt-0.5">{formData.email}</p>
          </div>
          <Link
            to="/buyer"
            className="w-full inline-flex items-center justify-center px-6 py-3.5 bg-gradient-to-r from-[#D9A73A] to-[#B38128] hover:from-[#E5B548] hover:to-[#C49033] text-[#070D1B] font-extrabold rounded-xl transition shadow-lg shadow-[#D9A73A]/20"
          >
            Go to Buyer Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070D1B] py-8 sm:py-12 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D9A73A]/10 border border-[#D9A73A]/30 text-[#D9A73A] text-xs font-extrabold tracking-wider uppercase mb-3">
            <span>Official Merchant Accreditation</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Become a Verified Vendor
          </h1>
          <p className="text-slate-400 text-sm sm:text-base mt-2 max-w-lg mx-auto">
            Sell authentic products nationwide on Abu Mafhal Marketplace with verified escrow payments.
          </p>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-[#0E1A2E] border border-white/10 rounded-2xl p-4 sm:p-6 mb-8 shadow-xl">
          <div className="flex items-center justify-between relative">
            {STEPS.map((s, idx) => {
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
                        ? 'bg-[#D9A73A] text-[#070D1B] ring-2 ring-[#D9A73A]/40'
                        : isCurrent
                        ? 'bg-[#14233D] text-[#D9A73A] border-2 border-[#D9A73A] ring-4 ring-[#D9A73A]/10'
                        : 'bg-[#14233D] text-slate-500 border border-white/10'
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
                  <span className={`text-xs mt-2 font-bold tracking-tight text-center ${isCurrent ? 'text-[#D9A73A]' : isCompleted ? 'text-white' : 'text-slate-500'}`}>
                    {s.title}
                  </span>
                </div>
              );
            })}
            {/* Progress line */}
            <div className="absolute top-5 left-8 right-8 h-0.5 bg-slate-800 -z-0">
              <div
                className="h-full bg-gradient-to-r from-[#D9A73A] to-[#F59E0B] transition-all duration-500"
                style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/40 border border-red-500/40 rounded-xl flex items-start gap-3">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-300 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* Form Container */}
        <div className="bg-[#0E1A2E] border border-white/10 rounded-2xl p-6 sm:p-8 shadow-2xl">
          {/* STEP 1: PERSONAL INFORMATION */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-white/10 pb-4 mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D9A73A]" />
                  Applicant Identity & Contact
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  Enter your official legal name as registered on government identity databases.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Full Legal Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Muhammad Sani"
                    className="w-full px-4 py-3 bg-[#14233D] border border-white/10 rounded-xl text-white text-base focus:outline-none focus:border-[#D9A73A] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Official Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="vendor@example.com"
                    className="w-full px-4 py-3 bg-[#14233D] border border-white/10 rounded-xl text-white text-base focus:outline-none focus:border-[#D9A73A] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Mobile Phone Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="+234 800 000 0000"
                    className="w-full px-4 py-3 bg-[#14233D] border border-white/10 rounded-xl text-white text-base focus:outline-none focus:border-[#D9A73A] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    National Identity Number (NIN) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="ninNumber"
                    value={formData.ninNumber}
                    onChange={handleChange}
                    required
                    maxLength="11"
                    placeholder="11-digit NIN Number"
                    className="w-full px-4 py-3 bg-[#14233D] border border-white/10 rounded-xl text-white text-base focus:outline-none focus:border-[#D9A73A] transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Bank Verification Number (BVN) <span className="text-slate-400 text-xs font-normal">(Optional for payouts)</span>
                  </label>
                  <input
                    type="text"
                    name="bvnNumber"
                    value={formData.bvnNumber}
                    onChange={handleChange}
                    maxLength="11"
                    placeholder="11-digit BVN Number"
                    className="w-full px-4 py-3 bg-[#14233D] border border-white/10 rounded-xl text-white text-base focus:outline-none focus:border-[#D9A73A] transition"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: BUSINESS INFORMATION */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-white/10 pb-4 mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D9A73A]" />
                  Business & Store Details
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  Information regarding your commercial enterprise and marketplace storefront.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Business / Store Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Sani Enterprise Ltd"
                    className="w-full px-4 py-3 bg-[#14233D] border border-white/10 rounded-xl text-white text-base focus:outline-none focus:border-[#D9A73A] transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    CAC Registration Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="cacNumber"
                    value={formData.cacNumber}
                    onChange={handleChange}
                    required
                    placeholder="RC-123456 or BN-123456"
                    className="w-full px-4 py-3 bg-[#14233D] border border-white/10 rounded-xl text-white text-base focus:outline-none focus:border-[#D9A73A] transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Physical Store Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessAddress"
                    value={formData.businessAddress}
                    onChange={handleChange}
                    required
                    placeholder="Shop/Office number, street address"
                    className="w-full px-4 py-3 bg-[#14233D] border border-white/10 rounded-xl text-white text-base focus:outline-none focus:border-[#D9A73A] transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    City and State <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessLocation"
                    value={formData.businessLocation}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Kano, Kano State"
                    className="w-full px-4 py-3 bg-[#14233D] border border-white/10 rounded-xl text-white text-base focus:outline-none focus:border-[#D9A73A] transition"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">
                    Business / Inventory Description <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    name="businessDescription"
                    value={formData.businessDescription}
                    onChange={handleChange}
                    required
                    rows="3"
                    placeholder="Describe your products, categories, and target customers..."
                    className="w-full px-4 py-3 bg-[#14233D] border border-white/10 rounded-xl text-white text-base focus:outline-none focus:border-[#D9A73A] transition resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: DOCUMENTS & VERIFICATION */}
          {step === 3 && (
            <div className="space-y-5 animate-fade-in">
              <div className="border-b border-white/10 pb-4 mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#D9A73A]" />
                  Required Compliance Documents
                </h2>
                <p className="text-slate-400 text-xs sm:text-sm mt-1">
                  Upload clear photos or PDF documents to verify merchant accreditation.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Storefront Image */}
                <div className="p-4 bg-[#14233D] border border-white/10 rounded-xl">
                  <label className="block text-xs font-bold text-white mb-2">
                    Storefront / Product Showcase Image <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="file"
                    name="businessImage"
                    onChange={handleFileChange}
                    accept="image/*"
                    className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#D9A73A] file:text-[#070D1B] hover:file:bg-[#F59E0B] cursor-pointer"
                  />
                  {previews.businessImage && (
                    <div className="mt-3 relative rounded-lg overflow-hidden h-28 border border-white/10">
                      <img src={previews.businessImage} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* Intro Video */}
                <div className="p-4 bg-[#14233D] border border-white/10 rounded-xl">
                  <label className="block text-xs font-bold text-white mb-2">
                    Store Intro Video <span className="text-slate-400 text-xs font-normal">(Optional)</span>
                  </label>
                  <input
                    type="file"
                    name="businessVideo"
                    onChange={handleFileChange}
                    accept="video/*"
                    className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#D9A73A] file:text-[#070D1B] hover:file:bg-[#F59E0B] cursor-pointer"
                  />
                  {previews.businessVideo && (
                    <p className="mt-3 text-xs text-emerald-400 font-semibold truncate">
                      📹 Attached: {previews.businessVideo}
                    </p>
                  )}
                </div>

                {/* NIN Document */}
                <div className="p-4 bg-[#14233D] border border-white/10 rounded-xl">
                  <label className="block text-xs font-bold text-white mb-2">
                    NIN Slip / Card (Image or PDF) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="file"
                    name="ninDocument"
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#D9A73A] file:text-[#070D1B] hover:file:bg-[#F59E0B] cursor-pointer"
                  />
                  {previews.ninDocument && (
                    <p className="mt-3 text-xs text-emerald-400 font-semibold truncate">
                      📄 Document Ready: {previews.ninDocument}
                    </p>
                  )}
                </div>

                {/* CAC Document */}
                <div className="p-4 bg-[#14233D] border border-white/10 rounded-xl">
                  <label className="block text-xs font-bold text-white mb-2">
                    CAC Certificate (Image or PDF) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="file"
                    name="cacDocument"
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="w-full text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#D9A73A] file:text-[#070D1B] hover:file:bg-[#F59E0B] cursor-pointer"
                  />
                  {previews.cacDocument && (
                    <p className="mt-3 text-xs text-emerald-400 font-semibold truncate">
                      📄 Document Ready: {previews.cacDocument}
                    </p>
                  )}
                </div>
              </div>

              {/* Agreement Notice */}
              <div className="p-4 bg-emerald-950/20 border border-emerald-500/20 rounded-xl">
                <p className="text-xs text-slate-300 leading-relaxed">
                  By submitting this application, you declare that all CAC, NIN, and store information provided are authentic and compliant with Abu Mafhal Marketplace Merchant Terms of Service.
                </p>
              </div>
            </div>
          )}

          {/* Stepper Navigation Buttons */}
          <div className="flex items-center gap-3 pt-6 mt-6 border-t border-white/10">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-sm transition"
              >
                Back
              </button>
            ) : (
              <Link
                to="/buyer"
                className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 font-bold text-sm transition"
              >
                Cancel
              </Link>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#D9A73A] to-[#B38128] hover:from-[#E5B548] hover:to-[#C49033] text-[#070D1B] font-black text-sm tracking-wide transition shadow-lg shadow-[#D9A73A]/20"
              >
                Next Step
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black text-sm tracking-wide transition shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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