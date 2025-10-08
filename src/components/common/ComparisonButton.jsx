import React from 'react';
import { useComparison } from '../../context/ComparisonContext';
import { useNavigate } from 'react-router-dom';

const ComparisonButton = () => {
  const { comparisonCount, comparisonItems } = useComparison();
  const navigate = useNavigate();

  if (comparisonCount === 0) return null;

  return (
    <button
      onClick={() => navigate('/compare')}
      className="fixed bottom-6 right-6 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-2 z-40"
    >
      <span className="text-xl">📊</span>
      <span className="font-semibold">Compare ({comparisonCount})</span>
    </button>
  );
};

export default ComparisonButton;