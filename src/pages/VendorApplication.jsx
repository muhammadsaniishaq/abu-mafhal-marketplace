import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { useNavigate, Link } from 'react-router-dom';

const VendorApplication = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    fullName: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: '',
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
    
    setFiles({
      ...files,
      [name]: file
    });

    // Create preview
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviews({...previews, [name]: reader.result});
        };
        reader.readAsDataURL(file);
      } else {
        setPreviews({...previews, [name]: file.name});
      }
    }
  };

  const uploadFile = async (file, path) => {
    if (!file) return null;
    const timestamp = Date.now();
    const fileRef = ref(storage, `vendor-applications/${currentUser.uid}/${path}/${timestamp}_${file.name}`);
    await uploadBytes(fileRef, file);
    return await getDownloadURL(fileRef);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Check if user already has a pending application
      const existingApp = await getDoc(doc(db, 'vendorApplications', currentUser.uid));
      if (existingApp.exists() && existingApp.data().status === 'pending') {
        setError('You already have a pending application');
        setLoading(false);
        return;
      }

      // Upload files
      const [businessImageUrl, businessVideoUrl, ninDocUrl, cacDocUrl] = await Promise.all([
        uploadFile(files.businessImage, 'images'),
        uploadFile(files.businessVideo, 'videos'),
        uploadFile(files.ninDocument, 'documents'),
        uploadFile(files.cacDocument, 'documents')
      ]);

      // Create vendor application
      const applicationData = {
        ...formData,
        userId: currentUser.uid,
        businessImageUrl,
        businessVideoUrl,
        ninDocumentUrl: ninDocUrl,
        cacDocumentUrl: cacDocUrl,
        status: 'pending', // pending, processing, approved, rejected
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'vendorApplications', currentUser.uid), applicationData);

      setSuccess(true);
      setTimeout(() => {
        navigate('/buyer');
      }, 3000);

    } catch (err) {
      console.error('Error submitting application:', err);
      setError(err.message || 'Failed to submit application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Application Submitted!
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Your vendor application is under review. You'll be notified via email once it's processed.
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-400">
              Status: <strong>Pending Review</strong>
            </p>
          </div>
          <Link 
            to="/buyer" 
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Become a Vendor
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Fill out the form below to apply as a vendor on Abu Mafhal
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-700 rounded-lg">
              <p className="text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Information */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    BVN Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="bvnNumber"
                    value={formData.bvnNumber}
                    onChange={handleChange}
                    required
                    maxLength="11"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    NIN Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="ninNumber"
                    value={formData.ninNumber}
                    onChange={handleChange}
                    required
                    maxLength="11"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Business Information */}
            <div className="border-b border-gray-200 dark:border-gray-700 pb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Business Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessName"
                    value={formData.businessName}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    CAC Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="cacNumber"
                    value={formData.cacNumber}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Business Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessAddress"
                    value={formData.businessAddress}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Business Location (State/City) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="businessLocation"
                    value={formData.businessLocation}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Business Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="businessDescription"
                    value={formData.businessDescription}
                    onChange={handleChange}
                    required
                    rows="4"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Describe your business and what you plan to sell..."
                  />
                </div>
              </div>
            </div>

            {/* Document Uploads */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Required Documents
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Business/Store Image <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    name="businessImage"
                    onChange={handleFileChange}
                    accept="image/*"
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  {previews.businessImage && (
                    <img src={previews.businessImage} alt="Preview" className="mt-2 w-full h-32 object-cover rounded" />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Business/Store Video (Optional)
                  </label>
                  <input
                    type="file"
                    name="businessVideo"
                    onChange={handleFileChange}
                    accept="video/*"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  {previews.businessVideo && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">📹 {previews.businessVideo}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    NIN Document (Image/PDF) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    name="ninDocument"
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  {previews.ninDocument && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">📄 {previews.ninDocument}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    CAC Document (Image/PDF) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    name="cacDocument"
                    onChange={handleFileChange}
                    accept="image/*,application/pdf"
                    required
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                  {previews.cacDocument && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">📄 {previews.cacDocument}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition"
              >
                {loading ? 'Submitting...' : 'Submit Application'}
              </button>
              <Link
                to="/buyer"
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg font-medium transition"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default VendorApplication;