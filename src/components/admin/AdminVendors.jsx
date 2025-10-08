import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const AdminVendors = () => {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const q = query(collection(db, 'users'), where('role', '==', 'vendor'));
      const snapshot = await getDocs(q);
      const vendorsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVendors(vendorsData);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuspendVendor = async (vendorId) => {
    if (!window.confirm('Are you sure you want to suspend this vendor?')) return;
    
    try {
      await updateDoc(doc(db, 'users', vendorId), {
        suspended: true,
        suspendedAt: new Date().toISOString()
      });
      alert('Vendor suspended successfully');
      fetchVendors();
    } catch (error) {
      alert('Failed to suspend vendor');
    }
  };

  const handleActivateVendor = async (vendorId) => {
    try {
      await updateDoc(doc(db, 'users', vendorId), {
        suspended: false,
        activatedAt: new Date().toISOString()
      });
      alert('Vendor activated successfully');
      fetchVendors();
    } catch (error) {
      alert('Failed to activate vendor');
    }
  };

  const filteredVendors = vendors.filter(vendor => {
    if (filter === 'active') return !vendor.suspended;
    if (filter === 'suspended') return vendor.suspended;
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Vendor Management</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <p className="text-gray-600 dark:text-gray-400 text-sm">Total Vendors</p>
          <p className="text-3xl font-bold">{vendors.length}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 shadow">
          <p className="text-green-700 dark:text-green-400 text-sm">Active Vendors</p>
          <p className="text-3xl font-bold text-green-800 dark:text-green-300">
            {vendors.filter(v => !v.suspended).length}
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-6 shadow">
          <p className="text-red-700 dark:text-red-400 text-sm">Suspended</p>
          <p className="text-3xl font-bold text-red-800 dark:text-red-300">
            {vendors.filter(v => v.suspended).length}
          </p>
        </div>
      </div>

      {/* Filter */}
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-6 px-4 py-2 border rounded-lg dark:bg-gray-700"
      >
        <option value="all">All Vendors</option>
        <option value="active">Active Only</option>
        <option value="suspended">Suspended Only</option>
      </select>

      {/* Vendors Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left py-3 px-4">Vendor Name</th>
              <th className="text-left py-3 px-4">Email</th>
              <th className="text-left py-3 px-4">Joined Date</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredVendors.map(vendor => (
              <tr key={vendor.id} className="border-b dark:border-gray-700">
                <td className="py-3 px-4 font-medium">{vendor.name}</td>
                <td className="py-3 px-4">{vendor.email}</td>
                <td className="py-3 px-4">
                  {vendor.createdAt ? new Date(vendor.createdAt).toLocaleDateString() : 'N/A'}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-3 py-1 rounded-full text-xs ${
                    vendor.suspended 
                      ? 'bg-red-100 text-red-800' 
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {vendor.suspended ? 'Suspended' : 'Active'}
                  </span>
                </td>
                <td className="py-3 px-4 space-x-2">
                  <button
                    onClick={() => {
                      setSelectedVendor(vendor);
                      setShowModal(true);
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    View
                  </button>
                  {vendor.suspended ? (
                    <button
                      onClick={() => handleActivateVendor(vendor.id)}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                    >
                      Activate
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSuspendVendor(vendor.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      Suspend
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vendor Details Modal */}
      {showModal && selectedVendor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Vendor Details</h2>
              <button onClick={() => setShowModal(false)} className="text-2xl">×</button>
            </div>
            <div className="space-y-3">
              <p><strong>Name:</strong> {selectedVendor.name}</p>
              <p><strong>Email:</strong> {selectedVendor.email}</p>
              <p><strong>Phone:</strong> {selectedVendor.phone || 'N/A'}</p>
              <p><strong>Business Name:</strong> {selectedVendor.businessName || 'N/A'}</p>
              <p><strong>Status:</strong> {selectedVendor.suspended ? 'Suspended' : 'Active'}</p>
              <p><strong>Joined:</strong> {selectedVendor.createdAt ? new Date(selectedVendor.createdAt).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVendors;