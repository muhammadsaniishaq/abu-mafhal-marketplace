import React, { createContext, useContext, useState, useEffect } from 'react';

const CartContext = createContext();

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
};

export const CartProvider = ({ children }) => {
  const [cartItems, setCartItems] = useState([]);

  useEffect(() => {
    const savedCart = localStorage.getItem('cart');
    if (savedCart) {
      setCartItems(JSON.parse(savedCart));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (product, quantity = 1, selectedVariation = null) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(
        item => item.id === product.id && 
        JSON.stringify(item.selectedVariation) === JSON.stringify(selectedVariation)
      );

      if (existingItem) {
        return prevItems.map(item =>
          item.id === product.id && 
          JSON.stringify(item.selectedVariation) === JSON.stringify(selectedVariation)
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }

      return [...prevItems, { ...product, quantity, selectedVariation }];
    });
  };

  const removeFromCart = (productId, selectedVariation = null) => {
    setCartItems(prevItems =>
      prevItems.filter(
        item => !(item.id === productId && 
        JSON.stringify(item.selectedVariation) === JSON.stringify(selectedVariation))
      )
    );
  };

  const updateQuantity = (productId, quantity, selectedVariation = null) => {
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === productId && 
        JSON.stringify(item.selectedVariation) === JSON.stringify(selectedVariation)
          ? { ...item, quantity: Math.max(1, quantity) }
          : item
      )
    );
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getCartCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
        getCartCount
      }}
    >
      {children}
    </CartContext.Provider>
  );
};