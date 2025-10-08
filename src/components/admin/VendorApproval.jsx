import React, { useState, useEffect } from 'react';
import { collection, getDocs, updateDoc, doc, getDoc, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { sendProductNotification } from '../../services/notificationService';

const VendorApproval = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [selectedApp, setSelectedApp] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'vendorApplications'));
      const appsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setApplications(appsData);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (appId, userId) => {
    if (!window.confirm('Are you sure you want to approve this vendor application?')) return;

    try {
      // Update application status
      await updateDoc(doc(db, 'vendorApplications', appId), {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        reviewedBy: 'admin'
      });

      // Update user role to vendor
      await updateDoc(doc(db, 'users', userId), {
        role: 'vendor',
        vendorApproved: true,
        approvedAt: new Date().toISOString()
      });

      alert('Vendor application approved successfully!');
      fetchApplications();
    } catch (error) {
      console.error('Error approving vendor:', error);
      alert('Failed to approve vendor application');
    }
  };

  const handleReject = async (appId, userId) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    try {
      await updateDoc(doc(db, 'vendorApplications', appId), {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectionReason: rejectReason,
        reviewedBy: 'admin'
      });

      alert('Vendor application rejected');
      setShowModal(false);
      setRejectReason('');
      fetchApplications();
    } catch (error) {
      alert('Failed to reject application');
    }
  };

  const filteredApplications = applications.filter(app => {
    if (filter === 'all') return true;
    return app.status === filter;
  });

  const stats = {
    all: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    processing: applications.filter(a => a.status === 'processing').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Vendor Applications</h1>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          All ({stats.all})
        </button>
        <button
          onClick={() => setFilter('pending')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'pending' ? 'bg-yellow-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          Pending ({stats.pending})
        </button>
        <button
          onClick={() => setFilter('processing')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'processing' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          Processing ({stats.processing})
        </button>
        <button
          onClick={() => setFilter('approved')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'approved' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          Approved ({stats.approved})
        </button>
        <button
          onClick={() => setFilter('rejected')}
          className={`px-4 py-2 rounded-lg ${
            filter === 'rejected' ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          Rejected ({stats.rejected})
        </button>
      </div>

      {/* Applications Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="text-left py-3 px-4">Applicant</th>
              <th className="text-left py-3 px-4">Business Name</th>
              <th className="text-left py-3 px-4">Applied Date</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredApplications.map(app => (
              <tr key={app.id} className="border-b dark:border-gray-700">
                <td className="py-3 px-4">
                  <p className="font-medium">{app.fullName}</p>
                  <p className="text-sm text-gray-600">{app.email}</p>
                </td>
                <td className="py-3 px-4">{app.businessName}</td>
                <td className="py-3 px-4">
                  {new Date(app.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <span className={`px-3 py-1 rounded-full text-xs ${
                    app.status === 'approved' ? 'bg-green-100 text-green-800' :
                    app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                    app.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {app.status}
                  </span>
                </td>
                <td className="py-3 px-4 space-x-2">
                  <button
                    onClick={() => {
                      setSelectedApp(app);
                      setShowModal(true);
                    }}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    View Details
                  </button>
                  {app.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleApprove(app.id, app.userId)}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          setSelectedApp(app);
                          setShowModal(true);
                        }}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredApplications.length === 0 && (
          <div className="text-center py-10">
            <p className="text-gray-600 dark:text-gray-400">No applications found</p>
          </div>
        )}
      </div>

      {/* Application Details Modal */}
      {showModal && selectedApp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Application Details</h2>
              <button onClick={() => setShowModal(false)} className="text-2xl">×</button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Applicant Name</p>
                <p className="font-medium">{selectedApp.fullName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Email</p>
                <p className="font-medium">{selectedApp.email}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <p className="font-medium">{selectedApp.phone}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Business Name</p>
                <p className="font-medium">{selectedApp.businessName}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Business Type</p>
                <p className="font-medium">{selectedApp.businessType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Business Address</p>
                <p className="font-medium">{selectedApp.businessAddress}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Product Categories</p>
                <p className="font-medium">{selectedApp.productCategories?.join(', ')}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Business Description</p>
                <p className="font-medium">{selectedApp.businessDescription}</p>
              </div>

              {selectedApp.status === 'pending' && (
                <div className="pt-4 border-t space-y-3">
                  <button
                    onClick={() => handleApprove(selectedApp.id, selectedApp.userId)}
                    className="w-full py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    Approve Application
                  </button>
                  <div>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                      rows="3"
                    />
                    <button
                      onClick={() => handleReject(selectedApp.id, selectedApp.userId)}
                      className="w-full mt-2 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                    >
                      Reject Application
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorApproval;