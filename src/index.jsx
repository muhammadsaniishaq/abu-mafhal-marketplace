import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import MobileLoader from './components/common/MobileLoader';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { ChatProvider } from './context/ChatContext';
import { WishlistProvider } from './context/WishlistContext';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Route mobile visitors to the dedicated mobile experience
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const isForcedWeb = window.location.search.indexOf('force=web') !== -1;
const isRootPath = window.location.pathname === '/' || window.location.pathname === '';

if (isMobileDevice && !isForcedWeb && isRootPath) {
  root.render(
    <React.StrictMode>
      <MobileLoader />
    </React.StrictMode>
  );
} else {
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
}