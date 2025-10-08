import React, { createContext, useContext, useState, useEffect } from 'react';

const ComparisonContext = createContext();

export const useComparison = () => {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error('useComparison must be used within ComparisonProvider');
  }
  return context;
};

export const ComparisonProvider = ({ children }) => {
  const [comparisonItems, setComparisonItems] = useState(() => {
    const saved = localStorage.getItem('comparisonItems');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('comparisonItems', JSON.stringify(comparisonItems));
  }, [comparisonItems]);

  const addToComparison = (product) => {
    if (comparisonItems.length >= 4) {
      alert('You can only compare up to 4 products at a time');
      return;
    }
    
    if (comparisonItems.find(item => item.id === product.id)) {
      alert('Product already in comparison');
      return;
    }

    setComparisonItems([...comparisonItems, product]);
  };

  const removeFromComparison = (productId) => {
    setComparisonItems(comparisonItems.filter(item => item.id !== productId));
  };

  const clearComparison = () => {
    setComparisonItems([]);
  };

  const isInComparison = (productId) => {
    return comparisonItems.some(item => item.id === productId);
  };

  return (
    <ComparisonContext.Provider
      value={{
        comparisonItems,
        addToComparison,
        removeFromComparison,
        clearComparison,
        isInComparison,
        comparisonCount: comparisonItems.length
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
};