import React, { useState } from 'react';
import { aiService } from '../services/aiService';

const AITest = () => {
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState({});

  const testDescription = async () => {
    setLoading({ ...loading, description: true });
    const result = await aiService.generateDescription(
      'Samsung Galaxy S21',
      'smartphone, 5G, high-quality camera',
      'Electronics'
    );
    setResults({ ...results, description: result });
    setLoading({ ...loading, description: false });
  };

  const testPrice = async () => {
    setLoading({ ...loading, price: true });
    const result = await aiService.optimizePrice(
      'Samsung Galaxy S21',
      'Electronics',
      'smartphone, 5G'
    );
    setResults({ ...results, price: result });
    setLoading({ ...loading, price: false });
  };

  const testKeywords = async () => {
    setLoading({ ...loading, keywords: true });
    const result = await aiService.generateKeywords(
      'Samsung Galaxy S21',
      'Premium smartphone with advanced features',
      'Electronics'
    );
    setResults({ ...results, keywords: result });
    setLoading({ ...loading, keywords: false });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">AI Features Test</h1>
      
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <button
            onClick={testDescription}
            disabled={loading.description}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading.description ? 'Testing...' : 'Test Description AI'}
          </button>
          {results.description && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <p className="font-semibold">Result:</p>
              <p className="text-sm">{results.description.success ? results.description.description : `Error: ${results.description.error}`}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <button
            onClick={testPrice}
            disabled={loading.price}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            {loading.price ? 'Testing...' : 'Test Price AI'}
          </button>
          {results.price && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <p className="font-semibold">Result:</p>
              <p className="text-sm">{results.price.success ? `₦${results.price.price}` : `Error: ${results.price.error}`}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <button
            onClick={testKeywords}
            disabled={loading.keywords}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
          >
            {loading.keywords ? 'Testing...' : 'Test Keywords AI'}
          </button>
          {results.keywords && (
            <div className="mt-4 p-4 bg-gray-50 rounded">
              <p className="font-semibold">Result:</p>
              <p className="text-sm">{results.keywords.success ? results.keywords.keywords : `Error: ${results.keywords.error}`}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AITest;