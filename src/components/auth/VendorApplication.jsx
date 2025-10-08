import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const VendorApplication = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    businessType: 'individual',
    businessAddress: '',
    city: '',
    state: '',
    phone: currentUser?.phone || '',
    email: currentUser?.email || '',
    taxId: '',
    bankName: '',
    accountNumber: '',
    accountName: '',
    businessDescription: '',
    productCategories: [],
    estimatedMonthlyRevenue: '',
    yearsInBusiness: '',
    website: '',
    socialMedia: {
      facebook: '',
      instagram: '',
      twitter: ''
    }
  });

  const businessTypes = [
    { value: 'individual', label: 'Individual/Sole Proprietor' },
    { value: 'partnership', label: 'Partnership' },
    { value: 'company', label: 'Registered Company' },
    { value: 'cooperative', label: 'Cooperative' }
  ];

  const categories = [
    'Electronics', 'Fashion', 'Home & Garden', 'Sports & Outdoors',
    'Books & Media', 'Beauty & Health', 'Toys & Games', 'Food & Beverages',
    'Automotive', 'Arts & Crafts', 'Other'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData({
        ...formData,
        [parent]: {
          ...formData[parent],
          [child]: value
        }
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleCategoryChange = (category) => {
    const updatedCategories = formData.productCategories.includes(category)
      ? formData.productCategories.filter(c => c !== category)
      : [...formData.productCategories, category];
    
    setFormData({
      ...formData,
      productCategories: updatedCategories
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!currentUser) {
      alert('Please login first');
      navigate('/login');
      return;
    }

    if (currentUser.role !== 'buyer') {
      alert('Only buyers can apply to become vendors');
      return;
    }

    if (formData.productCategories.length === 0) {
      alert('Please select at least one product category');
      return;
    }

    setLoading(true);

    try {
      // Check if already applied
      const existingApp = await getDoc(doc(db, 'vendorApplications', currentUser.uid));
      
      if (existingApp.exists() && existingApp.data().status === 'pending') {
        alert('You already have a pending application. Please wait for admin review.');
        navigate('/buyer');
        return;
      }

      // Submit application
      await setDoc(doc(db, 'vendorApplications', currentUser.uid), {
        userId: currentUser.uid,
        userName: currentUser.name,
        userEmail: currentUser.email,
        ...formData,
        status: 'pending',
        submittedAt: new Date().toISOString(),
        reviewedAt: null,
        reviewedBy: null,
        rejectionReason: null
      });

      alert('Application submitted successfully! We will review it within 2-3 business days.');
      navigate('/buyer');
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-xl mb-4">Please login to apply as a vendor</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Vendor Application
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Fill out this form to start selling on Abu Mafhal Marketplace
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Business Information */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Business Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Business Name *</label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="Your Business Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Business Type *</label>
                  <select
                    name="businessType"
                    value={formData.businessType}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  >
                    {businessTypes.map(type => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Business Address *</label>
                  <input
                    type="text"
                    name="businessAddress"
                    value={formData.businessAddress}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="Street address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">City *</label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">State *</label>
                  <input
                    type="text"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Phone *</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Email *</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tax ID (Optional)</label>
                  <input
                    type="text"
                    name="taxId"
                    value={formData.taxId}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="Tax identification number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Years in Business</label>
                  <input
                    type="number"
                    name="yearsInBusiness"
                    value={formData.yearsInBusiness}
                    onChange={handleChange}
                    min="0"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Business Description *</label>
                  <textarea
                    name="businessDescription"
                    value={formData.businessDescription}
                    onChange={handleChange}
                    required
                    rows="4"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="Describe your business, products, and what makes you unique..."
                  />
                </div>
              </div>
            </div>

            {/* Banking Information */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Banking Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Bank Name *</label>
                  <input
                    type="text"
                    name="bankName"
                    value={formData.bankName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Account Number *</label>
                  <input
                    type="text"
                    name="accountNumber"
                    value={formData.accountNumber}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-2">Account Name *</label>
                  <input
                    type="text"
                    name="accountName"
                    value={formData.accountName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
              </div>
            </div>

            {/* Product Categories */}
            <div className="border-b pb-6">
              <h2 className="text-xl font-semibold mb-4">Product Categories *</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select all categories that apply to your products
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {categories.map(category => (
                  <label
                    key={category}
                    className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <input
                      type="checkbox"
                      checked={formData.productCategories.includes(category)}
                      onChange={() => handleCategoryChange(category)}
                      className="mr-2"
                    />
                    <span className="text-sm">{category}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Additional Information */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Additional Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Estimated Monthly Revenue</label>
                  <select
                    name="estimatedMonthlyRevenue"
                    value={formData.estimatedMonthlyRevenue}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  >
                    <option value="">Select range</option>
                    <option value="0-100k">₦0 - ₦100,000</option>
                    <option value="100k-500k">₦100,000 - ₦500,000</option>
                    <option value="500k-1m">₦500,000 - ₦1,000,000</option>
                    <option value="1m+">Above ₦1,000,000</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Website (Optional)</label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="https://yourwebsite.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Facebook (Optional)</label>
                  <input
                    type="text"
                    name="socialMedia.facebook"
                    value={formData.socialMedia.facebook}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="Facebook page URL"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Instagram (Optional)</label>
                  <input
                    type="text"
                    name="socialMedia.instagram"
                    value={formData.socialMedia.instagram}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                    placeholder="Instagram handle"
                  />
                </div>
              </div>
            </div>

            {/* Terms and Submit */}
            <div className="pt-6">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-6">
                <p className="text-sm text-blue-800 dark:text-blue-400">
                  By submitting this application, you agree to our vendor terms and conditions. 
                  We will review your application within 2-3 business days and notify you via email.
                </p>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/buyer')}
                  className="flex-1 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold disabled:bg-gray-400"
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VendorApplication;