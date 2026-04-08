import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';

const VendorProfile = () => {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('personal');
  
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    avatar: '',
    businessName: '',
    businessDescription: '',
    businessAddress: '',
    businessLocation: '',
    businessPhone: '',
    businessEmail: '',
    businessWebsite: '',
    taxId: '',
    businessLicense: '',
    socialMedia: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: ''
    },
    bankDetails: {
      bankName: '',
      accountNumber: '',
      accountName: '',
      routingNumber: ''
    },
    shippingInfo: {
      returnAddress: '',
      warehouseLocation: '',
      shippingMethods: []
    },
    operatingHours: {
      monday: { open: '09:00', close: '17:00', closed: false },
      tuesday: { open: '09:00', close: '17:00', closed: false },
      wednesday: { open: '09:00', close: '17:00', closed: false },
      thursday: { open: '09:00', close: '17:00', closed: false },
      friday: { open: '09:00', close: '17:00', closed: false },
      saturday: { open: '10:00', close: '14:00', closed: false },
      sunday: { open: '', close: '', closed: true }
    },
    policies: {
      returnPolicy: '',
      shippingPolicy: '',
      privacyPolicy: ''
    }
  });

  const [bannerImage, setBannerImage] = useState(null);
  const [bannerPreview, setBannerPreview] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, [currentUser]);

  const fetchProfile = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.uid)
        .single();

      if (fetchError) throw fetchError;
      
      if (data) {
        setProfileData({
          ...profileData,
          name: data.full_name || data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          avatar: data.avatar_url || data.avatar || '',
          businessName: data.business_name || data.businessName || '',
          businessDescription: data.business_description || data.businessDescription || '',
          businessAddress: data.business_address || data.businessAddress || '',
          businessLocation: data.business_location || data.businessLocation || '',
          businessPhone: data.business_phone || data.businessPhone || '',
          businessEmail: data.business_email || data.businessEmail || '',
          businessWebsite: data.business_website || data.businessWebsite || '',
          taxId: data.tax_id || data.taxId || '',
          businessLicense: data.business_license || data.businessLicense || '',
          socialMedia: data.social_media || data.socialMedia || profileData.socialMedia,
          bankDetails: data.bank_details || data.bankDetails || profileData.bankDetails,
          shippingInfo: data.shipping_info || data.shippingInfo || profileData.shippingInfo,
          operatingHours: data.operating_hours || data.operatingHours || profileData.operatingHours,
          policies: data.policies || profileData.policies,
          bannerImage: data.banner_image || data.bannerImage || ''
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error.message);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData({...profileData, [name]: value});
  };

  const handleNestedChange = (parent, field, value) => {
    setProfileData({
      ...profileData,
      [parent]: {
        ...profileData[parent],
        [field]: value
      }
    });
  };

  const handleHoursChange = (day, field, value) => {
    setProfileData({
      ...profileData,
      operatingHours: {
        ...profileData.operatingHours,
        [day]: {
          ...profileData.operatingHours[day],
          [field]: value
        }
      }
    });
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const timestamp = Date.now();
      const fileName = `${currentUser.uid}/${timestamp}_${file.name}`;
      
      const { data, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      setProfileData({...profileData, avatar: publicUrl});
      setMessage({ type: 'success', text: 'Avatar uploaded!' });
    } catch (error) {
      console.error('Avatar upload error:', error.message);
      setMessage({ type: 'error', text: 'Failed to upload avatar' });
    }
  };

  const handleBannerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBannerImage(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      let bannerUrl = profileData.bannerImage;
      
      if (bannerImage) {
        const timestamp = Date.now();
        const fileName = `${currentUser.uid}/${timestamp}_${bannerImage.name}`;
        
        const { data, error: uploadError } = await supabase.storage
          .from('banners')
          .upload(fileName, bannerImage);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('banners')
          .getPublicUrl(fileName);
        
        bannerUrl = publicUrl;
      }

      const updatedProfile = {
        full_name: profileData.name,
        phone: profileData.phone,
        avatar_url: profileData.avatar,
        business_name: profileData.businessName,
        business_description: profileData.businessDescription,
        business_address: profileData.businessAddress,
        business_location: profileData.businessLocation,
        business_phone: profileData.businessPhone,
        business_email: profileData.businessEmail,
        business_website: profileData.businessWebsite,
        tax_id: profileData.taxId,
        business_license: profileData.businessLicense,
        social_media: profileData.socialMedia,
        bank_details: profileData.bankDetails,
        shipping_info: profileData.shippingInfo,
        operating_hours: profileData.operatingHours,
        policies: profileData.policies,
        banner_image: bannerUrl,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabase
        .from('users')
        .update(updatedProfile)
        .eq('id', currentUser.uid);

      if (updateError) throw updateError;
      
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
    } catch (error) {
      console.error('Error updating profile:', error.message);
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: '👤' },
    { id: 'business', label: 'Business Info', icon: '🏢' },
    { id: 'banking', label: 'Banking', icon: '💳' },
    { id: 'shipping', label: 'Shipping', icon: '📦' },
    { id: 'social', label: 'Social Media', icon: '🌐' },
    { id: 'hours', label: 'Operating Hours', icon: '🕐' },
    { id: 'policies', label: 'Policies', icon: '📋' }
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">Vendor Profile</h1>

      {message.text && (
        <div className={`mb-6 p-4 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      {/* Banner Image */}
      <div className="mb-6 relative h-48 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg overflow-hidden">
        {(bannerPreview || profileData.bannerImage) && (
          <img src={bannerPreview || profileData.bannerImage} alt="Banner" className="w-full h-full object-cover" />
        )}
        <label className="absolute bottom-4 right-4 px-4 py-2 bg-white hover:bg-gray-100 text-gray-800 rounded-lg cursor-pointer shadow-lg">
          Change Banner
          <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
        </label>
      </div>

      {/* Avatar & Basic Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 -mt-20">
        <div className="flex items-end gap-6">
          <div className="w-32 h-32 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden border-4 border-white shadow-lg">
            {profileData.avatar ? (
              <img src={profileData.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-5xl">👤</div>
            )}
          </div>
          <div className="flex-1 mt-20">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{profileData.name || 'Vendor Name'}</h2>
            <p className="text-gray-600 dark:text-gray-400">{profileData.businessName || 'Business Name'}</p>
            <label className="inline-block mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer">
              Change Avatar
              <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                activeTab === tab.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Personal Info Tab */}
        {activeTab === 'personal' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
            <h3 className="text-xl font-semibold mb-4">Personal Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Full Name</label>
                <input type="text" name="name" value={profileData.name} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input type="email" name="email" value={profileData.email} disabled className="w-full px-4 py-2 border rounded-lg bg-gray-100 dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Phone</label>
                <input type="tel" name="phone" value={profileData.phone} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
            </div>
          </div>
        )}

        {/* Business Info Tab */}
        {activeTab === 'business' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
            <h3 className="text-xl font-semibold mb-4">Business Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Business Name</label>
                <input type="text" name="businessName" value={profileData.businessName} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Business Phone</label>
                <input type="tel" name="businessPhone" value={profileData.businessPhone} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Business Email</label>
                <input type="email" name="businessEmail" value={profileData.businessEmail} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Website</label>
                <input type="url" name="businessWebsite" value={profileData.businessWebsite} onChange={handleChange} placeholder="https://" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Business Description</label>
                <textarea name="businessDescription" value={profileData.businessDescription} onChange={handleChange} rows="3" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2">Business Address</label>
                <input type="text" name="businessAddress" value={profileData.businessAddress} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Tax ID / TIN</label>
                <input type="text" name="taxId" value={profileData.taxId} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Business License #</label>
                <input type="text" name="businessLicense" value={profileData.businessLicense} onChange={handleChange} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
            </div>
          </div>
        )}

        {/* Banking Tab */}
        {activeTab === 'banking' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
            <h3 className="text-xl font-semibold mb-4">Banking Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Bank Name</label>
                <input type="text" value={profileData.bankDetails.bankName} onChange={(e) => handleNestedChange('bankDetails', 'bankName', e.target.value)} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Account Name</label>
                <input type="text" value={profileData.bankDetails.accountName} onChange={(e) => handleNestedChange('bankDetails', 'accountName', e.target.value)} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Account Number</label>
                <input type="text" value={profileData.bankDetails.accountNumber} onChange={(e) => handleNestedChange('bankDetails', 'accountNumber', e.target.value)} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Routing Number</label>
                <input type="text" value={profileData.bankDetails.routingNumber} onChange={(e) => handleNestedChange('bankDetails', 'routingNumber', e.target.value)} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
            </div>
          </div>
        )}

        {/* Shipping Tab */}
        {activeTab === 'shipping' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
            <h3 className="text-xl font-semibold mb-4">Shipping Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Return Address</label>
                <input type="text" value={profileData.shippingInfo.returnAddress} onChange={(e) => handleNestedChange('shippingInfo', 'returnAddress', e.target.value)} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Warehouse Location</label>
                <input type="text" value={profileData.shippingInfo.warehouseLocation} onChange={(e) => handleNestedChange('shippingInfo', 'warehouseLocation', e.target.value)} className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
            </div>
          </div>
        )}

        {/* Social Media Tab */}
        {activeTab === 'social' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
            <h3 className="text-xl font-semibold mb-4">Social Media Links</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Facebook</label>
                <input type="url" value={profileData.socialMedia.facebook} onChange={(e) => handleNestedChange('socialMedia', 'facebook', e.target.value)} placeholder="https://facebook.com/..." className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Instagram</label>
                <input type="url" value={profileData.socialMedia.instagram} onChange={(e) => handleNestedChange('socialMedia', 'instagram', e.target.value)} placeholder="https://instagram.com/..." className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Twitter</label>
                <input type="url" value={profileData.socialMedia.twitter} onChange={(e) => handleNestedChange('socialMedia', 'twitter', e.target.value)} placeholder="https://twitter.com/..." className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">LinkedIn</label>
                <input type="url" value={profileData.socialMedia.linkedin} onChange={(e) => handleNestedChange('socialMedia', 'linkedin', e.target.value)} placeholder="https://linkedin.com/..." className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
              </div>
            </div>
          </div>
        )}

        {/* Operating Hours Tab */}
        {activeTab === 'hours' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
            <h3 className="text-xl font-semibold mb-4">Operating Hours</h3>
            {Object.keys(profileData.operatingHours).map(day => (
              <div key={day} className="flex items-center gap-4">
                <div className="w-32 capitalize font-medium">{day}</div>
                <input type="checkbox" checked={!profileData.operatingHours[day].closed} onChange={(e) => handleHoursChange(day, 'closed', !e.target.checked)} className="w-5 h-5" />
                <span className="text-sm">Open</span>
                {!profileData.operatingHours[day].closed && (
                  <>
                    <input type="time" value={profileData.operatingHours[day].open} onChange={(e) => handleHoursChange(day, 'open', e.target.value)} className="px-3 py-2 border rounded-lg dark:bg-gray-700" />
                    <span>to</span>
                    <input type="time" value={profileData.operatingHours[day].close} onChange={(e) => handleHoursChange(day, 'close', e.target.value)} className="px-3 py-2 border rounded-lg dark:bg-gray-700" />
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Policies Tab */}
        {activeTab === 'policies' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 space-y-4">
            <h3 className="text-xl font-semibold mb-4">Store Policies</h3>
            <div>
              <label className="block text-sm font-medium mb-2">Return Policy</label>
              <textarea value={profileData.policies.returnPolicy} onChange={(e) => handleNestedChange('policies', 'returnPolicy', e.target.value)} rows="4" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Shipping Policy</label>
              <textarea value={profileData.policies.shippingPolicy} onChange={(e) => handleNestedChange('policies', 'shippingPolicy', e.target.value)} rows="4" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Privacy Policy</label>
              <textarea value={profileData.policies.privacyPolicy} onChange={(e) => handleNestedChange('policies', 'privacyPolicy', e.target.value)} rows="4" className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700" />
            </div>
          </div>
        )}

        <button type="submit" disabled={loading} className="w-full mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:bg-gray-400">
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
};

export default VendorProfile;