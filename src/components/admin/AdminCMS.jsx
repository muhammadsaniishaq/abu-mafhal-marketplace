import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const AdminCMS = () => {
  const [activeTab, setActiveTab] = useState('banners');
  const [banners, setBanners] = useState([]);
  const [pages, setPages] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Form states
  const [bannerForm, setBannerForm] = useState({
    title: '',
    subtitle: '',
    imageUrl: '',
    link: '',
    active: true,
    order: 0
  });

  const [pageForm, setPageForm] = useState({
    title: '',
    slug: '',
    content: '',
    published: true
  });

  const [faqForm, setFaqForm] = useState({
    question: '',
    answer: '',
    category: 'general',
    order: 0
  });

  useEffect(() => {
    fetchAllContent();
  }, []);

  const fetchAllContent = async () => {
    try {
      const bannersSnap = await getDocs(collection(db, 'banners'));
      setBanners(bannersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const pagesSnap = await getDocs(collection(db, 'pages'));
      setPages(pagesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const faqsSnap = await getDocs(collection(db, 'faqs'));
      setFaqs(faqsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setLoading(false);
    }
  };

  // Banner Functions
  const handleSaveBanner = async () => {
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'banners', editingItem.id), {
          ...bannerForm,
          updatedAt: new Date().toISOString()
        });
        alert('Banner updated successfully');
      } else {
        await addDoc(collection(db, 'banners'), {
          ...bannerForm,
          createdAt: new Date().toISOString()
        });
        alert('Banner created successfully');
      }
      setShowModal(false);
      setBannerForm({ title: '', subtitle: '', imageUrl: '', link: '', active: true, order: 0 });
      setEditingItem(null);
      fetchAllContent();
    } catch (error) {
      alert('Failed to save banner');
    }
  };

  const handleDeleteBanner = async (id) => {
    if (!window.confirm('Delete this banner?')) return;
    try {
      await deleteDoc(doc(db, 'banners', id));
      alert('Banner deleted');
      fetchAllContent();
    } catch (error) {
      alert('Failed to delete banner');
    }
  };

  // Page Functions
  const handleSavePage = async () => {
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'pages', editingItem.id), {
          ...pageForm,
          updatedAt: new Date().toISOString()
        });
        alert('Page updated successfully');
      } else {
        await addDoc(collection(db, 'pages'), {
          ...pageForm,
          createdAt: new Date().toISOString()
        });
        alert('Page created successfully');
      }
      setShowModal(false);
      setPageForm({ title: '', slug: '', content: '', published: true });
      setEditingItem(null);
      fetchAllContent();
    } catch (error) {
      alert('Failed to save page');
    }
  };

  const handleDeletePage = async (id) => {
    if (!window.confirm('Delete this page?')) return;
    try {
      await deleteDoc(doc(db, 'pages', id));
      alert('Page deleted');
      fetchAllContent();
    } catch (error) {
      alert('Failed to delete page');
    }
  };

  // FAQ Functions
  const handleSaveFAQ = async () => {
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'faqs', editingItem.id), {
          ...faqForm,
          updatedAt: new Date().toISOString()
        });
        alert('FAQ updated successfully');
      } else {
        await addDoc(collection(db, 'faqs'), {
          ...faqForm,
          createdAt: new Date().toISOString()
        });
        alert('FAQ created successfully');
      }
      setShowModal(false);
      setFaqForm({ question: '', answer: '', category: 'general', order: 0 });
      setEditingItem(null);
      fetchAllContent();
    } catch (error) {
      alert('Failed to save FAQ');
    }
  };

  const handleDeleteFAQ = async (id) => {
    if (!window.confirm('Delete this FAQ?')) return;
    try {
      await deleteDoc(doc(db, 'faqs', id));
      alert('FAQ deleted');
      fetchAllContent();
    } catch (error) {
      alert('Failed to delete FAQ');
    }
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
      <h1 className="text-3xl font-bold mb-6">Content Management</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('banners')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'banners'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Banners ({banners.length})
        </button>
        <button
          onClick={() => setActiveTab('pages')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'pages'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Pages ({pages.length})
        </button>
        <button
          onClick={() => setActiveTab('faqs')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'faqs'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          FAQs ({faqs.length})
        </button>
      </div>

      {/* Banners Tab */}
      {activeTab === 'banners' && (
        <div>
          <button
            onClick={() => {
              setEditingItem(null);
              setBannerForm({ title: '', subtitle: '', imageUrl: '', link: '', active: true, order: 0 });
              setShowModal(true);
            }}
            className="mb-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add New Banner
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {banners.map(banner => (
              <div key={banner.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                {banner.imageUrl && (
                  <img src={banner.imageUrl} alt={banner.title} className="w-full h-32 object-cover rounded mb-3" />
                )}
                <h3 className="font-bold mb-1">{banner.title}</h3>
                <p className="text-sm text-gray-600 mb-2">{banner.subtitle}</p>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs px-2 py-1 rounded ${banner.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {banner.active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-xs text-gray-500">Order: {banner.order}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingItem(banner);
                      setBannerForm(banner);
                      setShowModal(true);
                    }}
                    className="flex-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteBanner(banner.id)}
                    className="flex-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pages Tab */}
      {activeTab === 'pages' && (
        <div>
          <button
            onClick={() => {
              setEditingItem(null);
              setPageForm({ title: '', slug: '', content: '', published: true });
              setShowModal(true);
            }}
            className="mb-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add New Page
          </button>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="text-left py-3 px-4">Title</th>
                  <th className="text-left py-3 px-4">Slug</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pages.map(page => (
                  <tr key={page.id} className="border-b dark:border-gray-700">
                    <td className="py-3 px-4 font-medium">{page.title}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">/pages/{page.slug}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs ${page.published ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {page.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="py-3 px-4 space-x-2">
                      <button
                        onClick={() => {
                          setEditingItem(page);
                          setPageForm(page);
                          setShowModal(true);
                        }}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePage(page.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FAQs Tab */}
      {activeTab === 'faqs' && (
        <div>
          <button
            onClick={() => {
              setEditingItem(null);
              setFaqForm({ question: '', answer: '', category: 'general', order: 0 });
              setShowModal(true);
            }}
            className="mb-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Add New FAQ
          </button>

          <div className="space-y-4">
            {faqs.map(faq => (
              <div key={faq.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 mr-2">{faq.category}</span>
                    <span className="text-xs text-gray-500">Order: {faq.order}</span>
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => {
                        setEditingItem(faq);
                        setFaqForm(faq);
                        setShowModal(true);
                      }}
                      className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteFAQ(faq.id)}
                      className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <h3 className="font-bold mb-2">{faq.question}</h3>
                <p className="text-sm text-gray-600">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">
                {editingItem ? 'Edit' : 'Add New'} {activeTab.slice(0, -1)}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-2xl">×</button>
            </div>

            {/* Banner Form */}
            {activeTab === 'banners' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={bannerForm.title}
                    onChange={(e) => setBannerForm({ ...bannerForm, title: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Subtitle</label>
                  <input
                    type="text"
                    value={bannerForm.subtitle}
                    onChange={(e) => setBannerForm({ ...bannerForm, subtitle: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Image URL</label>
                  <input
                    type="text"
                    value={bannerForm.imageUrl}
                    onChange={(e) => setBannerForm({ ...bannerForm, imageUrl: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Link</label>
                  <input
                    type="text"
                    value={bannerForm.link}
                    onChange={(e) => setBannerForm({ ...bannerForm, link: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Order</label>
                  <input
                    type="number"
                    value={bannerForm.order}
                    onChange={(e) => setBannerForm({ ...bannerForm, order: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={bannerForm.active}
                    onChange={(e) => setBannerForm({ ...bannerForm, active: e.target.checked })}
                  />
                  <label className="text-sm font-medium">Active</label>
                </div>
                <button
                  onClick={handleSaveBanner}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Banner
                </button>
              </div>
            )}

            {/* Page Form */}
            {activeTab === 'pages' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={pageForm.title}
                    onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Slug (URL)</label>
                  <input
                    type="text"
                    value={pageForm.slug}
                    onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })}
                    placeholder="about-us"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Content</label>
                  <textarea
                    value={pageForm.content}
                    onChange={(e) => setPageForm({ ...pageForm, content: e.target.value })}
                    rows="10"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={pageForm.published}
                    onChange={(e) => setPageForm({ ...pageForm, published: e.target.checked })}
                  />
                  <label className="text-sm font-medium">Published</label>
                </div>
                <button
                  onClick={handleSavePage}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save Page
                </button>
              </div>
            )}

            {/* FAQ Form */}
            {activeTab === 'faqs' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Question</label>
                  <input
                    type="text"
                    value={faqForm.question}
                    onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Answer</label>
                  <textarea
                    value={faqForm.answer}
                    onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                    rows="5"
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={faqForm.category}
                    onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  >
                    <option value="general">General</option>
                    <option value="orders">Orders</option>
                    <option value="payments">Payments</option>
                    <option value="shipping">Shipping</option>
                    <option value="returns">Returns</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Order</label>
                  <input
                    type="number"
                    value={faqForm.order}
                    onChange={(e) => setFaqForm({ ...faqForm, order: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                  />
                </div>
                <button
                  onClick={handleSaveFAQ}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Save FAQ
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCMS;