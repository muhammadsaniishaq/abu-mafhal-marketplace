import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Loader from '../common/Loader';

const CMS = () => {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [newContent, setNewContent] = useState({
    type: 'banner',
    title: '',
    content: '',
    active: true
  });

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'cms'));
      const contentList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setContent(contentList);
    } catch (error) {
      console.error('Error fetching content:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'cms'), {
        ...newContent,
        createdAt: new Date()
      });
      alert('Content added successfully!');
      fetchContent();
      setNewContent({ type: 'banner', title: '', content: '', active: true });
    } catch (error) {
      console.error('Error adding content:', error);
      alert('Error adding content');
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await updateDoc(doc(db, 'cms', id), data);
      alert('Content updated successfully!');
      fetchContent();
      setEditing(null);
    } catch (error) {
      console.error('Error updating content:', error);
      alert('Error updating content');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this content?')) return;
    try {
      await deleteDoc(doc(db, 'cms', id));
      alert('Content deleted successfully!');
      fetchContent();
    } catch (error) {
      console.error('Error deleting content:', error);
      alert('Error deleting content');
    }
  };

  if (loading) return <Loader />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Content Management System
      </h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Add New Content</h2>
        <form onSubmit={handleAdd}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-2">Type</label>
              <select
                value={newContent.type}
                onChange={(e) => setNewContent({ ...newContent, type: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              >
                <option value="banner">Banner</option>
                <option value="blog">Blog Post</option>
                <option value="faq">FAQ</option>
                <option value="page">Page</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <input
                type="text"
                value={newContent.title}
                onChange={(e) => setNewContent({ ...newContent, title: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
                required
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">Content</label>
            <textarea
              value={newContent.content}
              onChange={(e) => setNewContent({ ...newContent, content: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700"
              rows="4"
              required
            />
          </div>

          <label className="flex items-center mb-4">
            <input
              type="checkbox"
              checked={newContent.active}
              onChange={(e) => setNewContent({ ...newContent, active: e.target.checked })}
              className="mr-2"
            />
            <span>Active</span>
          </label>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
          >
            Add Content
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {content.map((item) => (
          <div key={item.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                    {item.type}
                  </span>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    item.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {item.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <h3 className="font-semibold text-lg">{item.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">{item.content}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(item.id)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CMS;