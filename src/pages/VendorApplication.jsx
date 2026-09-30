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
    badge: 'No CAC Needed',
    desc: 'Artisan, local merchant or informal retailer',
    cacLabel: '',
    cacPlaceholder: '',
    cacRequired: false
  },
  {
    id: 'partnership',
    label: 'Partnership / Cooperative',
    badge: 'Cooperative',
    desc: 'Trade cooperative or multi-partner business',
    cacLabel: 'Cooperative Reg Number',
    cacPlaceholder: 'e.g. COOP-48291',
    cacRequired: true
  }
];

const SALES_MODELS = [
  { id: 'both', label: 'Retail & Bulk Wholesale', badge: 'Recommended 🌟', desc: 'Accept both single unit and wholesale carton orders' },
  { id: 'retail', label: 'Retail Only', badge: 'Single Items', desc: 'Direct sales to individual consumers' },
  { id: 'wholesale', label: 'Bulk Wholesale Only', badge: 'B2B Suppliers', desc: 'Supply cartons and bulk quantities to other merchants' }
];

const LOCATION_TYPES = [
  { id: 'shop', label: 'Physical Walk-in Store / Showroom' },
  { id: 'warehouse', label: 'Warehouse / Central Depot' },
  { id: 'home_online', label: 'Home-Based / Online Inventory' }
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

const NIGERIAN_BANKS = [
  { name: 'OPay (Paycom)', code: '999992', type: 'Fintech / MFB', popular: true },
  { name: 'PalmPay', code: '999991', type: 'Fintech / MFB', popular: true },
  { name: 'Flutterwave MFB', code: '090107', type: 'Fintech / MFB', popular: true },
  { name: 'Kuda Bank', code: '50211', type: 'Digital Bank', popular: true },
  { name: 'Guaranty Trust Bank (GTBank)', code: '058', type: 'Commercial Bank', popular: true },
  { name: 'Access Bank', code: '044', type: 'Commercial Bank', popular: true },
  { name: 'Zenith Bank', code: '057', type: 'Commercial Bank', popular: true },
  { name: 'First Bank of Nigeria', code: '011', type: 'Commercial Bank', popular: true },
  { name: 'United Bank for Africa (UBA)', code: '033', type: 'Commercial Bank', popular: true },
  { name: 'Stanbic IBTC Bank', code: '221', type: 'Commercial Bank', popular: false },
  { name: 'FCMB (First City Monument Bank)', code: '214', type: 'Commercial Bank', popular: false },
  { name: 'Union Bank of Nigeria', code: '032', type: 'Commercial Bank', popular: false },
  { name: 'Fidelity Bank', code: '070', type: 'Commercial Bank', popular: false },
  { name: 'Sterling Bank', code: '232', type: 'Commercial Bank', popular: false },
  { name: 'Wema Bank (ALAT)', code: '035', type: 'Commercial Bank', popular: false },
  { name: 'Polaris Bank', code: '076', type: 'Commercial Bank', popular: false },
  { name: 'Jaiz Bank', code: '301', type: 'Non-Interest Bank', popular: false },
  { name: 'TAJBank', code: '302', type: 'Non-Interest Bank', popular: false },
  { name: 'Lotus Bank', code: '303', type: 'Non-Interest Bank', popular: false },
  { name: 'Ecobank Nigeria', code: '050', type: 'Commercial Bank', popular: false },
  { name: 'Keystone Bank', code: '082', type: 'Commercial Bank', popular: false },
  { name: 'Unity Bank', code: '215', type: 'Commercial Bank', popular: false },
  { name: 'Providus Bank', code: '101', type: 'Commercial Bank', popular: false }
];

const STEPS = [
  { id: 1, title: 'Personal Info', desc: 'Contact & Legal Identity' },
  { id: 2, title: 'Business Profile', desc: 'Structure & Store Details' },
  { id: 3, title: 'Compliance Docs', desc: 'Documents & Verification' },
  { id: 4, title: 'Settlement & Logistics', desc: 'Banking & Payout Account' }
];

const VendorApplication = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.location.replace('/mobile#vendor-register');
      }
    } catch (_) {}
  }, []);

  const getInitialStep = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = parseInt(window.localStorage.getItem('@abumafhal_desktop_vendor_step'), 10);
        if (saved && saved >= 1 && saved <= 4) return saved;
      }
    } catch (_) {}
    return 1;
  };

  const getInitialFormData = () => {
    const base = {
      fullName: currentUser?.name || currentUser?.user_metadata?.full_name || '',
      email: currentUser?.email || '',
      phone: currentUser?.phone || currentUser?.user_metadata?.phone_number || '',
      ninNumber: '',
      bvnNumber: '',
      businessType: 'limited_company',
      businessCategory: 'Electronics',
      salesModel: 'both',
      locationType: 'shop',
      businessName: '',
      businessAddress: '',
      businessLocation: 'Kano (Kantin Kwari / Singa / Sabon Gari)',
      cacNumber: '',
      businessDescription: '',
      whatsapp: currentUser?.phone || currentUser?.user_metadata?.phone_number || '',
      instagram: '',
      website: '',
      bankName: 'OPay (Paycom)',
      bankCode: '999992',
      accountNumber: '',
      accountName: '',
      deliveryType: 'marketplace',
      dispatchSla: 'same_day',
      returnPolicy: '7_days'
    };
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem('@abumafhal_desktop_vendor_draft');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return { ...base, ...parsed };
        }
      }
    } catch (_) {}
    return base;
  };

  const [step, setStep] = useState(getInitialStep);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState(getInitialFormData);

  // Autosave step and formData
  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('@abumafhal_desktop_vendor_step', String(step));
      }
    } catch (_) {}
  }, [step]);

  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('@abumafhal_desktop_vendor_draft', JSON.stringify(formData));
      }
    } catch (_) {}
  }, [formData]);

  const [files, setFiles] = useState({
    businessImage: null,
    businessVideo: null,
    ninDocument: null,
    cacDocument: null,
    cacStatusDocument: null,
    memorandumDocument: null
  });

  const [previews, setPreviews] = useState({
    businessImage: null,
    businessVideo: null,
    ninDocument: null,
    cacDocument: null,
    cacStatusDocument: null,
    memorandumDocument: null
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
      // ONLY check CAC if NOT individual
      if (formData.businessType !== 'sole_proprietor' && activeBusinessType.cacRequired && !formData.cacNumber.trim()) {
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
      if (formData.businessType === 'limited_company') {
        if (!files.cacDocument) {
          setError('CAC Certificate of Incorporation is required for Limited Liability Companies.');
          return false;
        }
        if (!files.cacStatusDocument) {
          setError('CAC Status Report (Particulars of Directors & Shares) is required for Limited Companies.');
          return false;
        }
        if (!files.memorandumDocument) {
          setError('Memorandum & Articles of Association (MEMART) is required for Limited Companies.');
          return false;
        }
      } else if (formData.businessType === 'business_name') {
        if (!files.cacDocument) {
          setError('CAC Business Name Registration Certificate is required.');
          return false;
        }
        if (!files.cacStatusDocument) {
          setError('CAC Status Report (Particulars of Proprietor) is required.');
          return false;
        }
      } else if (formData.businessType === 'partnership') {
        if (!files.cacDocument) {
          setError('Cooperative / Partnership Certificate is required.');
          return false;
        }
        if (!files.cacStatusDocument) {
          setError('Cooperative Status Report or Bylaws is required.');
          return false;
        }
      }
      if (!files.ninDocument) {
        setError('NIN slip or identity document is required.');
        return false;
      }
    }
    if (step === 4) {
      if (!formData.bankName) {
        setError('Please select your commercial or digital settlement bank.');
        return false;
      }
      if (!formData.accountNumber || formData.accountNumber.trim().length !== 10) {
        setError('Please enter a valid 10-digit NUBAN account number.');
        return false;
      }
      if (!formData.accountName) {
        if (formData.fullName) {
          setFormData(prev => ({ ...prev, accountName: prev.fullName }));
        } else {
          setError('Please provide the account beneficiary name.');
          return false;
        }
      }
    }
    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep(prev => Math.min(prev + 1, 4));
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
    if (!validateStep(4)) return;

    setLoading(true);
    setError('');

    try {
      const userId = currentUser?.id || currentUser?.uid;
      if (!userId) {
        throw new Error('Please sign in or create an account before applying.');
      }

      const { data: existingApp, error: checkError } = await supabase
        .from('vendor_applications')
        .select('status')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .maybeSingle();

      if (checkError) {
        console.warn('Check existing application notice:', checkError.message);
      }

      if (existingApp) {
        setError('You already have an application under review. Our compliance team will contact you shortly.');
        setLoading(false);
        return;
      }

      // Upload files concurrently
      const uploadPromises = [
        uploadFile(files.businessImage, 'images'),
        uploadFile(files.businessVideo, 'videos'),
        uploadFile(files.ninDocument, 'documents')
      ];

      // 1. CAC Certificate
      if (formData.businessType !== 'sole_proprietor' && files.cacDocument) {
        uploadPromises.push(uploadFile(files.cacDocument, 'documents'));
      } else {
        uploadPromises.push(Promise.resolve(null));
      }

      // 2. CAC Status Report
      if (formData.businessType !== 'sole_proprietor' && files.cacStatusDocument) {
        uploadPromises.push(uploadFile(files.cacStatusDocument, 'documents'));
      } else {
        uploadPromises.push(Promise.resolve(null));
      }

      // 3. Memorandum (Company only)
      if (formData.businessType === 'limited_company' && files.memorandumDocument) {
        uploadPromises.push(uploadFile(files.memorandumDocument, 'documents'));
      } else {
        uploadPromises.push(Promise.resolve(null));
      }

      const [businessImageUrl, businessVideoUrl, ninDocUrl, cacDocUrl, cacStatusDocUrl, memorandumDocUrl] = await Promise.all(uploadPromises);

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
        cac_number: formData.businessType === 'sole_proprietor' ? 'INDIVIDUAL_PASS' : (formData.cacNumber || null),
        business_description: formData.businessDescription,
        logo_url: businessImageUrl,
        video_url: businessVideoUrl,
        nin_url: ninDocUrl,
        cac_url: cacDocUrl,
        bank_name: formData.bankName,
        account_number: formData.accountNumber,
        account_name: formData.accountName || formData.fullName,
        status: 'pending',
        socials: {
          business_type: formData.businessType,
          sales_model: formData.salesModel,
          location_type: formData.locationType,
          operating_hub: formData.businessLocation,
          whatsapp: formData.whatsapp,
          instagram: formData.instagram,
          website: formData.website,
          cac_status_url: cacStatusDocUrl,
          memorandum_url: memorandumDocUrl,
          delivery_type: formData.deliveryType,
          dispatch_sla: formData.dispatchSla,
          return_policy: formData.returnPolicy,
          compliance_documents: {
            cac_certificate: cacDocUrl,
            cac_status_report: cacStatusDocUrl,
            memorandum_art: memorandumDocUrl,
            nin_slip: ninDocUrl
          }
        },
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // 1. Guaranteed storage in stores table for Logistics & Banking Hub
      try {
        const storePayload = {
          user_id: userId,
          name: formData.businessName || 'My Store',
          about: formData.businessDescription || '',
          logo: businessImageUrl || null,
          category: formData.businessCategory || 'Electronics',
          phone: formData.phone || formData.whatsapp || '',
          address: formData.businessAddress || '',
          state: formData.businessLocation || 'Kano',
          whatsapp: formData.whatsapp || formData.phone || '',
          custom_shipping_enabled: formData.deliveryType === 'self',
          supports_pickup: true,
          supports_express: formData.dispatchSla === 'same_day',
          policy: `Return window: ${formData.returnPolicy}. Dispatch SLA: ${formData.dispatchSla}. Bank: ${formData.bankName} (${formData.accountNumber} - ${formData.accountName || formData.fullName})`,
          updated_at: new Date().toISOString()
        };

        const { data: existingStore } = await supabase
          .from('stores')
          .select('id')
          .eq('user_id', userId)
          .maybeSingle();

        if (existingStore?.id) {
          await supabase.from('stores').update(storePayload).eq('id', existingStore.id);
        } else {
          await supabase.from('stores').insert([storePayload]);
        }
      } catch (stErr) {
        console.warn('Store sync notice:', stErr);
      }

      // 2. Update profile business info (preserve current role until approved)
      try {
        await supabase.from('profiles').update({
          business_name: formData.businessName,
          business_category: formData.businessCategory,
          about: formData.businessDescription,
          state: formData.businessLocation,
          phone: formData.phone || formData.whatsapp,
          whatsapp: formData.whatsapp || formData.phone,
          updated_at: new Date().toISOString()
        }).eq('id', userId);
      } catch (_) {}

      // 3. Save to localStorage for VendorWallet compatibility
      try {
        const bankRecord = [{
          id: `BANK-${Date.now()}`,
          bank_name: formData.bankName,
          bank_code: formData.bankCode || '',
          account_number: formData.accountNumber,
          account_name: formData.accountName || formData.fullName,
          is_default: true
        }];
        localStorage.setItem(`@abumafhal_vendor_banks_${userId}`, JSON.stringify(bankRecord));
      } catch (_) {}

      // 4. Record application in vendor_applications if table exists
      try {
        await supabase
          .from('vendor_applications')
          .upsert([applicationData], { onConflict: 'user_id' });
      } catch (appErr) {
        console.warn('vendor_applications sync notice:', appErr);
      }

      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem('@abumafhal_desktop_vendor_draft');
          window.localStorage.removeItem('@abumafhal_desktop_vendor_step');
        }
      } catch (_) {}

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
        <div className="max-w-md w-full bg-white border border-[#0A192F]/20 rounded-2xl shadow-xl p-8 text-center animate-fade-in">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-[#0A192F] mb-2 tracking-tight">
            Application Submitted!
          </h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            Your vendor application has been securely received with priority status. Our compliance team will review your account within 24 hours.
          </p>
          <div className="bg-[#0A192F]/5 border border-[#D9A73A]/40 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-1">
              <span>APPLICATION STATUS</span>
              <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold border border-amber-300">Pending Review</span>
            </div>
            <p className="text-[#0A192F] text-sm font-bold">{formData.businessName}</p>
            <p className="text-slate-500 text-xs mt-0.5">{formData.email}</p>
          </div>
          <Link
            to="/buyer"
            className="w-full inline-flex items-center justify-center px-6 py-3.5 bg-gradient-to-r from-[#D9A73A] to-[#B38128] hover:from-[#E5B548] hover:to-[#C49033] text-[#0A192F] font-black rounded-xl transition shadow-lg shadow-[#D9A73A]/20"
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
        {/* Header Title with Navy & Gold Styling */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#0A192F] border border-[#D9A73A] text-[#D9A73A] text-xs font-black tracking-wider uppercase mb-3 shadow-xs">
            <span>👑 Official Merchant Accreditation</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-[#0A192F] tracking-tight">
            Become a Verified Vendor
          </h1>
          <p className="text-slate-600 text-sm sm:text-base mt-2 max-w-lg mx-auto">
            Sell authentic products nationwide on Abu Mafhal Marketplace with verified escrow payments.
          </p>
        </div>

        {/* Merchant Perks Banner with Navy & Gold Gradient */}
        <div className="bg-gradient-to-r from-[#0A192F] via-[#102444] to-[#1E3A5F] border border-[#D9A73A]/50 rounded-2xl p-5 mb-8 shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white/10 border border-[#D9A73A] flex items-center justify-center text-lg">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">Abu Mafhal Verified Merchant Suite</h3>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-[#D9A73A] text-[#0A192F]">PRO</span>
              </div>
              <p className="text-xs text-slate-300">0% Commission Trial • Same-Day Settlements • Dedicated Support</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            <div className="bg-white/10 border border-[#D9A73A]/40 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-bold text-white shadow-xs">
              <span className="text-[#D9A73A]">✓</span> 100% Escrow
            </div>
            <div className="bg-white/10 border border-[#D9A73A]/40 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-bold text-white shadow-xs">
              <span className="text-[#D9A73A]">⚡</span> Same-Day Payout
            </div>
            <div className="bg-white/10 border border-[#D9A73A]/40 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-bold text-white shadow-xs">
              <span className="text-[#D9A73A]">🚚</span> Nationwide Logistics
            </div>
            <div className="bg-white/10 border border-[#D9A73A]/40 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-xs font-bold text-white shadow-xs">
              <span className="text-[#D9A73A]">🎖️</span> Gold Badge
            </div>
          </div>
        </div>

        {/* Stepper Progress Bar (Navy & Gold) */}
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
                        ? 'bg-[#0A192F] text-[#D9A73A] border-2 border-[#D9A73A] shadow-xs'
                        : isCurrent
                        ? 'bg-amber-50 text-[#0A192F] border-2 border-[#D9A73A] ring-4 ring-[#D9A73A]/20'
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
                  <span className={`text-xs mt-2 font-bold tracking-tight text-center ${isCurrent ? 'text-[#0A192F] font-black' : isCompleted ? 'text-[#B45309]' : 'text-slate-400'}`}>
                    {s.title}
                  </span>
                </div>
              );
            })}
            <div className="absolute top-5 left-12 right-12 h-0.5 bg-slate-200 -z-0">
              <div
                className="h-full bg-gradient-to-r from-[#0A192F] via-[#D9A73A] to-[#F59E0B] transition-all duration-500"
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
                <h2 className="text-lg sm:text-xl font-bold text-[#0A192F] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D9A73A]" />
                  Applicant Identity & Contact
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">
                  Enter your official legal name as registered on government identity databases.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
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
                  <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
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
                  <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
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
                  <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
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
                  <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
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
                <h2 className="text-lg sm:text-xl font-bold text-[#0A192F] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#D9A73A]" />
                  Business Structure & Store Profile
                </h2>
                <p className="text-slate-500 text-xs sm:text-sm mt-1">
                  Information regarding your commercial enterprise and marketplace storefront.
                </p>
              </div>

              {/* Business Registration Structure */}
              <div>
                <label className="block text-xs font-bold text-[#0A192F] mb-2">
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
                          isSelected ? 'border-[#0A192F] bg-[#0A192F]' : 'border-slate-300'
                        }`}>
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[#D9A73A]" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#0A192F]">{bt.label}</span>
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-[#0A192F] text-[#D9A73A]' : 'bg-white text-slate-600 border border-slate-200'
                            }`}>
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
                <label className="block text-xs font-bold text-[#0A192F] mb-2">
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
                          <p className="text-xs font-bold text-[#0A192F]">{cat.label}</p>
                          <p className="text-[10px] text-slate-500">{cat.sub}</p>
                        </div>
                        {isSelected && <span className="text-[#0A192F] font-black text-sm">✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sales Model: Retail vs Wholesale */}
              <div>
                <label className="block text-xs font-bold text-[#0A192F] mb-2">
                  Sales & Distribution Focus <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {SALES_MODELS.map(model => {
                    const isSelected = formData.salesModel === model.id;
                    return (
                      <div
                        key={model.id}
                        onClick={() => setFormData(prev => ({ ...prev, salesModel: model.id }))}
                        className={`p-3 rounded-xl border cursor-pointer transition ${
                          isSelected
                            ? 'bg-amber-50/80 border-[#D9A73A]'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-[#0A192F]">{model.label}</span>
                          {isSelected && <span className="text-[#0A192F] font-bold text-xs">✓</span>}
                        </div>
                        <p className="text-[10px] text-slate-500">{model.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
                    Store / Enterprise Trading Name <span className="text-red-500">*</span>
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

                {/* HIDE CAC COMPLETELY IF INDIVIDUAL */}
                {formData.businessType !== 'sole_proprietor' ? (
                  <div>
                    <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
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
                ) : (
                  <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-2.5">
                    <span className="text-emerald-700 font-bold text-lg">✓</span>
                    <div>
                      <p className="text-xs font-bold text-emerald-900">Individual Merchant Pass</p>
                      <p className="text-[11px] text-emerald-700">No CAC registration required for individual traders.</p>
                    </div>
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
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
                  <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
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
                  <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
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
                <h2 className="text-lg sm:text-xl font-bold text-[#0A192F] flex items-center gap-2">
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
                  <label className="block text-xs font-bold text-[#0A192F] mb-2">
                    Storefront / Product Showcase Image <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    name="businessImage"
                    onChange={handleFileChange}
                    accept="image/*"
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#0A192F] file:text-[#D9A73A] hover:file:bg-[#1E3A5F] cursor-pointer"
                  />
                  {previews.businessImage && (
                    <div className="mt-3 relative rounded-lg overflow-hidden h-28 border border-slate-200">
                      <img src={previews.businessImage} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>

                {/* CONDITIONAL COMPLIANCE DOCUMENTS BY BUSINESS TYPE */}
                {formData.businessType === 'limited_company' && (
                  <div className="sm:col-span-2 space-y-3">
                    <div className="bg-[#0A192F]/5 border-l-4 border-[#D9A73A] p-3 rounded-r-xl">
                      <p className="text-xs font-bold text-[#0A192F]">
                        🏢 Limited Liability Company Accreditation (3 Documents Required)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Please upload your Certificate of Incorporation, CAC Status Report, and Memorandum & Articles (MEMART).
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* 1. CAC Certificate */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <label className="block text-xs font-bold text-[#0A192F] mb-1">
                          1. CAC Certificate <span className="text-red-500">*</span>
                        </label>
                        <p className="text-[10px] text-slate-400 mb-2">Certificate of Incorporation (RC)</p>
                        <input
                          type="file"
                          name="cacDocument"
                          onChange={handleFileChange}
                          accept="image/*,application/pdf"
                          className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#0A192F] file:text-[#D9A73A] hover:file:bg-[#1E3A5F] cursor-pointer"
                        />
                        {previews.cacDocument && (
                          <p className="mt-2 text-[11px] text-emerald-600 font-semibold truncate">
                            ✓ Attached: {previews.cacDocument}
                          </p>
                        )}
                      </div>

                      {/* 2. CAC Status Report */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <label className="block text-xs font-bold text-[#0A192F] mb-1">
                          2. CAC Status Report <span className="text-red-500">*</span>
                        </label>
                        <p className="text-[10px] text-slate-400 mb-2">Particulars of Directors & Shares</p>
                        <input
                          type="file"
                          name="cacStatusDocument"
                          onChange={handleFileChange}
                          accept="image/*,application/pdf"
                          className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#0A192F] file:text-[#D9A73A] hover:file:bg-[#1E3A5F] cursor-pointer"
                        />
                        {previews.cacStatusDocument && (
                          <p className="mt-2 text-[11px] text-emerald-600 font-semibold truncate">
                            ✓ Attached: {previews.cacStatusDocument}
                          </p>
                        )}
                      </div>

                      {/* 3. Memorandum (MEMART) */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <label className="block text-xs font-bold text-[#0A192F] mb-1">
                          3. Memorandum (MEMART) <span className="text-red-500">*</span>
                        </label>
                        <p className="text-[10px] text-slate-400 mb-2">Articles of Association Document</p>
                        <input
                          type="file"
                          name="memorandumDocument"
                          onChange={handleFileChange}
                          accept="image/*,application/pdf"
                          className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#0A192F] file:text-[#D9A73A] hover:file:bg-[#1E3A5F] cursor-pointer"
                        />
                        {previews.memorandumDocument && (
                          <p className="mt-2 text-[11px] text-emerald-600 font-semibold truncate">
                            ✓ Attached: {previews.memorandumDocument}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {formData.businessType === 'business_name' && (
                  <div className="sm:col-span-2 space-y-3">
                    <div className="bg-[#0A192F]/5 border-l-4 border-[#D9A73A] p-3 rounded-r-xl">
                      <p className="text-xs font-bold text-[#0A192F]">
                        🏪 Registered Business Name Accreditation (2 Documents Required)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Please upload your CAC Business Name Registration Certificate and CAC Status Report.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 1. CAC BN Certificate */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <label className="block text-xs font-bold text-[#0A192F] mb-1">
                          1. CAC BN Certificate <span className="text-red-500">*</span>
                        </label>
                        <p className="text-[10px] text-slate-400 mb-2">Business Name Registration Certificate</p>
                        <input
                          type="file"
                          name="cacDocument"
                          onChange={handleFileChange}
                          accept="image/*,application/pdf"
                          className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#0A192F] file:text-[#D9A73A] hover:file:bg-[#1E3A5F] cursor-pointer"
                        />
                        {previews.cacDocument && (
                          <p className="mt-2 text-[11px] text-emerald-600 font-semibold truncate">
                            ✓ Attached: {previews.cacDocument}
                          </p>
                        )}
                      </div>

                      {/* 2. CAC Status Report */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <label className="block text-xs font-bold text-[#0A192F] mb-1">
                          2. CAC Status Report <span className="text-red-500">*</span>
                        </label>
                        <p className="text-[10px] text-slate-400 mb-2">Particulars of Proprietor</p>
                        <input
                          type="file"
                          name="cacStatusDocument"
                          onChange={handleFileChange}
                          accept="image/*,application/pdf"
                          className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#0A192F] file:text-[#D9A73A] hover:file:bg-[#1E3A5F] cursor-pointer"
                        />
                        {previews.cacStatusDocument && (
                          <p className="mt-2 text-[11px] text-emerald-600 font-semibold truncate">
                            ✓ Attached: {previews.cacStatusDocument}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {formData.businessType === 'partnership' && (
                  <div className="sm:col-span-2 space-y-3">
                    <div className="bg-[#0A192F]/5 border-l-4 border-[#D9A73A] p-3 rounded-r-xl">
                      <p className="text-xs font-bold text-[#0A192F]">
                        👥 Cooperative / Partnership Accreditation (2 Documents Required)
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <label className="block text-xs font-bold text-[#0A192F] mb-1">
                          1. Registration Certificate <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="file"
                          name="cacDocument"
                          onChange={handleFileChange}
                          accept="image/*,application/pdf"
                          className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#0A192F] file:text-[#D9A73A] hover:file:bg-[#1E3A5F] cursor-pointer"
                        />
                        {previews.cacDocument && (
                          <p className="mt-2 text-[11px] text-emerald-600 font-semibold truncate">
                            ✓ Attached: {previews.cacDocument}
                          </p>
                        )}
                      </div>

                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <label className="block text-xs font-bold text-[#0A192F] mb-1">
                          2. Status Report / Bylaws <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="file"
                          name="cacStatusDocument"
                          onChange={handleFileChange}
                          accept="image/*,application/pdf"
                          className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-[#0A192F] file:text-[#D9A73A] hover:file:bg-[#1E3A5F] cursor-pointer"
                        />
                        {previews.cacStatusDocument && (
                          <p className="mt-2 text-[11px] text-emerald-600 font-semibold truncate">
                            ✓ Attached: {previews.cacStatusDocument}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {formData.businessType === 'sole_proprietor' && (
                  <div className="sm:col-span-2 p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center gap-3">
                    <span className="text-2xl text-emerald-600 font-bold">✓</span>
                    <div>
                      <p className="text-xs font-bold text-emerald-900">Individual Merchant Pass Active</p>
                      <p className="text-[11px] text-emerald-700">
                        CAC Certificate, Status Report, and Memorandum are not required for individual artisans and retailers. Simply upload your NIN identity document below.
                      </p>
                    </div>
                  </div>
                )}

                {/* NIN Document */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="block text-xs font-bold text-[#0A192F] mb-2">
                    NIN Slip / Card (Image or PDF) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    name="ninDocument"
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#0A192F] file:text-[#D9A73A] hover:file:bg-[#1E3A5F] cursor-pointer"
                  />
                  {previews.ninDocument && (
                    <p className="mt-3 text-xs text-emerald-600 font-semibold truncate">
                      📄 Document Attached: {previews.ninDocument}
                    </p>
                  )}
                </div>

                {/* Intro Video */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="block text-xs font-bold text-[#0A192F] mb-2">
                    Store Intro Video <span className="text-slate-400 text-xs font-normal">(Optional)</span>
                  </label>
                  <input
                    type="file"
                    name="businessVideo"
                    onChange={handleFileChange}
                    accept="video/*"
                    className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#0A192F] file:text-[#D9A73A] hover:file:bg-[#1E3A5F] cursor-pointer"
                  />
                  {previews.businessVideo && (
                    <p className="mt-3 text-xs text-emerald-600 font-semibold truncate">
                      📹 Video Attached: {previews.businessVideo}
                    </p>
                  )}
                </div>
              </div>

              {/* Agreement Notice */}
              <div className="p-4 bg-[#0A192F]/5 border border-[#D9A73A]/40 rounded-xl">
                <p className="text-xs text-[#0A192F] leading-relaxed font-semibold">
                  All documents are verified under strict regulatory compliance and encrypted with banking-grade security.
                </p>
              </div>
            </div>
          )}

          {/* STEP 4: SETTLEMENT BANKING & LOGISTICS */}
          {step === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-lg sm:text-xl font-black text-[#0A192F]">
                  Payout Banking & Logistics Hub
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Connect your settlement account for automated sales remittances and choose fulfillment preferences.
                </p>
              </div>

              {/* ROYAL NAVY & GOLD VIRTUAL ATM SETTLEMENT CARD */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#071324] via-[#0F274B] to-[#1E3E6E] p-6 text-white shadow-xl border-2 border-[#D9A73A]/40 max-w-md mx-auto">
                <div className="flex items-center justify-between mb-6">
                  {/* EMV Gold Chip */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-7 rounded-md bg-[#E5B94E] border border-[#B45309] flex items-center justify-center shadow-inner">
                      <div className="w-6 h-4 border border-[#92400E] rounded-xs" />
                    </div>
                    <svg className="w-5 h-5 text-[#D9A73A]/80 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                    </svg>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-[#D9A73A]/40 text-xs font-bold text-slate-100">
                    <span>🏦</span>
                    <span className="truncate max-w-[140px]">{formData.bankName || 'SETTLEMENT BANK'}</span>
                  </div>
                </div>

                {/* Account Number */}
                <div className="my-5">
                  <p className="text-xl sm:text-2xl font-black tracking-widest font-mono text-white">
                    {formData.accountNumber
                      ? formData.accountNumber.padEnd(10, '•').replace(/(\d{3}|\W{3})(\d{3}|\W{3})(\d{4}|\W{4})/, '$1  $2  $3')
                      : '••••   ••••   ••••'}
                  </p>
                </div>

                {/* Beneficiary Name & Auto-pay Badge */}
                <div className="flex items-end justify-between pt-2">
                  <div>
                    <p className="text-[9px] font-black uppercase text-[#D9A73A] tracking-wider">
                      Settlement Beneficiary
                    </p>
                    <p className="text-sm font-black uppercase tracking-wide text-white truncate max-w-[220px]">
                      {(formData.accountName || formData.fullName || 'MERCHANT BENEFICIARY').toUpperCase()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-500/20 border border-emerald-400 text-[10px] font-black text-emerald-300">
                    <span>✓</span> AUTO-PAY
                  </div>
                </div>
              </div>

              {/* POPULAR NIGERIAN BANKS (1-TAP QUICK SELECT) */}
              <div>
                <label className="block text-xs font-bold text-[#0A192F] uppercase tracking-wider mb-2">
                  Quick Select Popular Banks
                </label>
                <div className="flex flex-wrap gap-2">
                  {NIGERIAN_BANKS.filter(b => b.popular).map(b => {
                    const isSelected = formData.bankName === b.name;
                    return (
                      <button
                        type="button"
                        key={b.code}
                        onClick={() => setFormData(prev => ({ ...prev, bankName: b.name, bankCode: b.code }))}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#0A192F] text-[#D9A73A] border-[#D9A73A] shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{isSelected ? '✓' : '🏦'}</span>
                        <span>{b.name.split(' (')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bank Selector Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
                    Settlement Commercial / Digital Bank <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="bankName"
                    value={formData.bankName}
                    onChange={(e) => {
                      const selected = NIGERIAN_BANKS.find(b => b.name === e.target.value);
                      setFormData(prev => ({
                        ...prev,
                        bankName: e.target.value,
                        bankCode: selected ? selected.code : ''
                      }));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-[#D9A73A]"
                  >
                    {NIGERIAN_BANKS.map((b, i) => (
                      <option key={`${b.code}-${i}`} value={b.name}>
                        {b.name} ({b.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* 10-Digit NUBAN Account Number */}
                <div>
                  <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
                    10-Digit NUBAN Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="accountNumber"
                    maxLength={10}
                    value={formData.accountNumber}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setFormData(prev => ({ ...prev, accountNumber: val }));
                    }}
                    placeholder="0123456789"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold tracking-widest text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D9A73A]"
                  />
                </div>
              </div>

              {/* Account Beneficiary Name */}
              <div>
                <label className="block text-xs font-bold text-[#0A192F] mb-1.5">
                  Account Beneficiary Legal Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleChange}
                  placeholder={formData.fullName || "Full Name as registered on your bank account"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#D9A73A]"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Deposits and automated sales disbursements are transferred directly to this account.
                </p>
              </div>

              {/* LOGISTICS & RETURN POLICY PREFERENCES */}
              <div className="pt-4 border-t border-slate-100 space-y-4">
                <h3 className="text-sm font-black text-[#0A192F] uppercase tracking-wider">
                  🚚 Store Fulfillment & Logistics Setup
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setFormData(prev => ({ ...prev, deliveryType: 'marketplace' }))}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      formData.deliveryType === 'marketplace'
                        ? 'bg-amber-50/50 border-[#D9A73A] shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🛡️</span>
                      <p className="text-xs font-black text-[#0A192F]">Abu Mafhal Fulfillment</p>
                      {formData.deliveryType === 'marketplace' && (
                        <span className="ml-auto text-xs text-amber-600 font-bold">✓ Selected</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Nationwide doorstep dispatch handled by marketplace courier network with live tracking.
                    </p>
                  </div>

                  <div
                    onClick={() => setFormData(prev => ({ ...prev, deliveryType: 'self' }))}
                    className={`p-4 rounded-xl border cursor-pointer transition ${
                      formData.deliveryType === 'self'
                        ? 'bg-amber-50/50 border-[#D9A73A] shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🚴</span>
                      <p className="text-xs font-black text-[#0A192F]">Self Dispatch & Waybill Fleet</p>
                      {formData.deliveryType === 'self' && (
                        <span className="ml-auto text-xs text-amber-600 font-bold">✓ Selected</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Deliver using your own dedicated riders, local dispatch, and bus park waybill services.
                    </p>
                  </div>
                </div>
              </div>

              {/* Agreement Notice */}
              <div className="p-4 bg-[#0A192F]/5 border border-[#D9A73A]/40 rounded-xl">
                <p className="text-xs text-[#0A192F] leading-relaxed font-semibold">
                  By submitting this application, you declare that all information provided are authentic and compliant with Abu Mafhal Marketplace Merchant Terms of Service.
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
                className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0A192F] font-bold text-sm transition"
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

            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex-1 py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#D9A73A] to-[#B38128] hover:from-[#E5B548] hover:to-[#C49033] text-[#0A192F] font-black text-sm tracking-wide transition shadow-lg shadow-[#D9A73A]/20"
              >
                Next Step
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3.5 px-6 rounded-xl bg-[#0A192F] hover:bg-[#152B4E] text-[#D9A73A] border border-[#D9A73A] font-black text-sm tracking-wide transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-[#D9A73A]" fill="none" viewBox="0 0 24 24">
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