import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ChatProvider } from './context/ChatContext';
import { WishlistProvider } from './context/WishlistContext';


const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <CartProvider>
        <ChatProvider>
          <App />
        </ChatProvider>
      </CartProvider>
    </AuthProvider>
  </React.StrictMode>
);

root.render(
  <React.StrictMode>
    <AuthProvider>
      <CartProvider>
        <ChatProvider>
          <WishlistProvider>
            <App />
          </WishlistProvider>
        </ChatProvider>
      </CartProvider>
    </AuthProvider>
  </React.StrictMode>
);