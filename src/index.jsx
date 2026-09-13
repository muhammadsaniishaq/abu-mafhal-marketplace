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

const isMobileDevice = 
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(navigator.userAgent) || 
  (typeof window !== 'undefined' && window.innerWidth <= 768);
const isForcedWeb = typeof window !== 'undefined' && 
  (window.location.search.indexOf('force=web') !== -1 || window.location.search.indexOf('force=desktop') !== -1);
const isAlreadyMobile = typeof window !== 'undefined' && window.location.pathname.startsWith('/mobile');

if (isMobileDevice && !isForcedWeb && !isAlreadyMobile) {
  const currentPath = (window.location.pathname || '').toLowerCase();
  let targetHash = '';
  if (currentPath.includes('admin')) targetHash = '#admin';
  else if (currentPath.includes('vendor')) targetHash = '#vendor';
  else if (currentPath.includes('driver')) targetHash = '#driver';
  else if (currentPath.includes('shop')) targetHash = '#shop';
  else if (currentPath.includes('cart')) targetHash = '#cart';
  else if (currentPath.includes('checkout')) targetHash = '#checkout';
  else if (currentPath.includes('order') || currentPath.includes('track')) targetHash = '#orders';
  else if (currentPath.includes('login') || currentPath.includes('auth') || currentPath.includes('register') || currentPath.includes('join')) {
    const parts = (window.location.pathname || '').split('/').filter(Boolean);
    const lastPart = parts[parts.length - 1];
    if (currentPath.includes('join') && lastPart && lastPart !== 'join') {
      targetHash = '#auth?code=' + encodeURIComponent(lastPart);
    } else {
      targetHash = '#auth';
    }
  }
  else if (currentPath.includes('profile')) targetHash = '#profile';
  else if (currentPath.includes('wishlist')) targetHash = '#wishlist';
  else if (currentPath.includes('wallet')) targetHash = '#wallet';
  else if (currentPath.includes('product')) {
    const parts = (window.location.pathname || '').split('/').filter(Boolean);
    const prodId = parts[parts.length - 1];
    if (prodId && prodId !== 'product') {
      targetHash = '#product/' + encodeURIComponent(prodId);
    }
  }

  window.location.replace('/mobile' + targetHash);
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