// src/components/vendor/AIAssistant.jsx
import React, { useState } from 'react';
import { generateProductDescription, optimizeDescription } from '../../services/aiService';
const AIAssistant = () => {
  const [activeTab, setActiveTab] = useState('description');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Description Generator
  const [productData, setProductData] = useState({
    name: '',
    category: '',
    features: '',
    price: '',
    targetAudience: ''
  });

  // Description Optimizer
  const [optimizeData, setOptimizeData] = useState({
    productName: '',
    category: '',
    currentDescription: ''
  });

  // Marketing Copy
  const [marketingData, setMarketingData] = useState({
    name: '',
    category: '',
    price: '',
    features: '',
    campaignType: 'email'
  });

  const handleGenerateDescription = async () => {
    setLoading(true);
    try {
      const featuresArray = productData.features.split(',').map(f => f.trim());
      const response = await generateProductDescription({
        ...productData,
        features: featuresArray
      });
      setResult(response);
    } catch (error) {
      alert('Error generating description: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOptimizeDescription = async () => {
    setLoading(true);
    try {
      const response = await optimizeProductDescription(
        optimizeData.currentDescription,
        optimizeData.productName,
        optimizeData.category
      );
      setResult({ optimizedDescription: response });
    } catch (error) {
      alert('Error optimizing description: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMarketing = async () => {
    setLoading(true);
    try {
      const featuresArray = marketingData.features.split(',').map(f => f.trim());
      const response = await generateMarketingCopy(
        { ...marketingData, features: featuresArray },
        marketingData.campaignType
      );
      setResult(response);
    } catch (error) {
      alert('Error generating marketing copy: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">
          AI Assistant
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Use AI to generate product descriptions, optimize content, and create marketing copy
        </p>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('description')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'description'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-blue-600'
          }`}
        >
          Generate Description
        </button>
        <button
          onClick={() => setActiveTab('optimize')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'optimize'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-blue-600'
          }`}
        >
          Optimize Description
        </button>
        <button
          onClick={() => setActiveTab('marketing')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'marketing'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 dark:text-gray-400 hover:text-blue-600'
          }`}
        >
          Marketing Copy
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            {activeTab === 'description' && 'Product Information'}
            {activeTab === 'optimize' && 'Current Description'}
            {activeTab === 'marketing' && 'Campaign Details'}
          </h3>

          {activeTab === 'description' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product Name
                </label>
                <input
                  type="text"
                  value={productData.name}
                  onChange={(e) => setProductData({ ...productData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Wireless Bluetooth Headphones"
                />
              </div>
              <React.Fragment>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={productData.category}
                    onChange={(e) => setProductData({ ...productData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Electronics"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Features (comma-separated)
                  </label>
                  <textarea
                    value={productData.features}
                    onChange={(e) => setProductData({ ...productData, features: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    rows="3"
                    placeholder="e.g., Noise cancellation, 20-hour battery, comfortable design"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Price (₦)
                  </label>
                  <input
                    type="number"
                    value={productData.price}
                    onChange={(e) => setProductData({ ...productData, price: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., 25000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Target Audience
                  </label>
                  <input
                    type="text"
                    value={productData.targetAudience}
                    onChange={(e) => setProductData({ ...productData, targetAudience: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Music lovers, professionals"
                  />
                </div>
                <button
                  onClick={handleGenerateDescription}
                  disabled={loading || !productData.name}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg disabled:bg-gray-400"
                >
                  {loading ? 'Generating...' : 'Generate Description'}
                </button>
              </React.Fragment>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
            AI Generated Result
          </h3>

          {!result ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🤖</div>
              <p className="text-gray-600 dark:text-gray-400">
                Fill in the form and click generate to see AI results here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {result.title && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Title
                    </label>
                    <button
                      onClick={() => copyToClipboard(result.title)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-gray-800 dark:text-white">{result.title}</p>
                  </div>
                </div>
              )}

              {result.description && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <button
                      onClick={() => copyToClipboard(result.description)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-gray-800 dark:text-white whitespace-pre-wrap">
                      {result.description}
                    </p>
                  </div>
                </div>
              )}

              {result.optimizedDescription && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Optimized Description
                    </label>
                    <button
                      onClick={() => copyToClipboard(result.optimizedDescription)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-gray-800 dark:text-white whitespace-pre-wrap">
                      {result.optimizedDescription}
                    </p>
                  </div>
                </div>
              )}

              {result.features && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Key Features
                  </label>
                  <ul className="space-y-2">
                    {result.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-blue-600 mr-2">✓</span>
                        <span className="text-gray-800 dark:text-white">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.keywords && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    SEO Keywords
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {result.keywords.map((keyword, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.subject && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email Subject
                    </label>
                    <button
                      onClick={() => copyToClipboard(result.subject)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-gray-800 dark:text-white">{result.subject}</p>
                  </div>
                </div>
              )}

              {result.headline && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Headline
                    </label>
                    <button
                      onClick={() => copyToClipboard(result.headline)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-gray-800 dark:text-white font-semibold">
                      {result.headline}
                    </p>
                  </div>
                </div>
              )}

              {result.body && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Body Copy
                    </label>
                    <button
                      onClick={() => copyToClipboard(result.body)}
                      className="text-blue-600 hover:text-blue-700 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <p className="text-gray-800 dark:text-white whitespace-pre-wrap">
                      {result.body}
                    </p>
                  </div>
                </div>
              )}

              {result.cta && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                    Call to Action
                  </label>
                  <button className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold">
                    {result.cta}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;