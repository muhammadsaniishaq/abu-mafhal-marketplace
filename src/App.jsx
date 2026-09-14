import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { WishlistProvider } from './context/WishlistContext';
import { ComparisonProvider } from "./context/ComparisonContext";

// ==================== AI COMPONENTS ====================
import AIAssistant from './components/ai/AIAssistant';

// ==================== AUTH COMPONENTS ====================
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import ForgotPassword from './components/auth/ForgotPassword';

// ==================== PUBLIC PAGES ====================
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetails from './pages/ProductDetails';
import About from './pages/About';
import Contact from './pages/Contact';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import VendorApplication from './pages/VendorApplication';
import Notifications from './pages/Notifications';
import AITest from './pages/AITest';
import CheckoutPage from './pages/CheckoutPage';
import Stores from './pages/Stores';

// ==================== DASHBOARD LAYOUTS ====================
import AdminDashboard from './pages/AdminDashboard';
import VendorDashboard from './pages/VendorDashboard';
import BuyerDashboard from './pages/BuyerDashboard';

// ==================== ADMIN COMPONENTS ====================
import AdminAnalytics from './components/admin/AdminAnalytics';
import AdminUsers from './components/admin/AdminUsers';
import AdminVendors from './components/admin/AdminVendors';
import VendorApproval from './components/admin/VendorApproval';
import AdminProducts from './components/admin/AdminProducts';
import AdminCategories from './components/admin/AdminCategories';
import AdminAddProduct from './components/admin/AdminAddProduct';
import AdminOrders from './components/admin/AdminOrders';
import AdminDisputes from './components/admin/AdminDisputes';
import AdminPayments from './components/admin/AdminPayments';
import AdminCoupons from './components/admin/AdminCoupons';
import AdminFlashSales from './components/admin/AdminFlashSales';
import AdminPayouts from './components/admin/AdminPayouts';
import AdminFinancials from './components/admin/AdminFinancials';
import AdminCMS from './components/admin/AdminCMS';
import AdminAuditLogs from './components/admin/AdminAuditLogs';
import AdminReviews from './components/admin/AdminReviews';
import AdminSettings from './components/admin/AdminSettings';
import AdminAbandonedCarts from './components/admin/AdminAbandonedCarts';
import AdminStoreProfile from './components/admin/AdminStoreProfile';

// ==================== VENDOR COMPONENTS ====================
import VendorAnalytics from './components/vendor/VendorAnalytics';
import VendorProducts from './components/vendor/VendorProducts';
import AddProduct from './components/vendor/AddProduct';
import EditProduct from './components/vendor/EditProduct';
import VendorOrders from './components/vendor/VendorOrders';
import VendorProfile from './components/vendor/VendorProfile';
import VendorSettings from './components/vendor/VendorSettings';
import VendorWallet from './components/vendor/VendorWallet';
import VendorDisputes from './components/vendor/VendorDisputes';

// ==================== BUYER COMPONENTS ====================
import BuyerOrders from './components/buyer/BuyerOrders';
import OrderTracking from './components/buyer/OrderTracking';
import BuyerWishlist from './components/buyer/BuyerWishlist';
import BuyerProfile from './components/buyer/BuyerProfile';
import BuyerSettings from './components/buyer/BuyerSettings';
import EmailPreferences from './components/buyer/EmailPreferences';
import Cart from './components/buyer/Cart';
import Wallet from './components/buyer/Wallet';
import Reviews from './components/buyer/Reviews';
import Disputes from './components/buyer/Disputes';
import LoyaltyRewards from './components/buyer/LoyaltyRewards';

// ==================== CHAT & MESSAGES ====================
import Messages from './components/common/Messages';
import ChatWindow from './components/common/ChatWindow';

// ==================== COMMON COMPONENTS ====================
import LoadingScreen from './components/common/LoadingScreen';
import MobileLoader from './components/common/MobileLoader';

const MobileRedirect = () => {
  React.useEffect(() => {
    window.location.replace('/mobile/index.html' + (window.location.hash || ''));
  }, []);
  return <MobileLoader />;
};

// ==================== PROTECTED ROUTE COMPONENT ====================
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
    if (currentUser.role === 'admin') return <Navigate to="/admin" replace />;
    if (currentUser.role === 'vendor') return <Navigate to="/vendor" replace />;
    if (currentUser.role === 'buyer') return <Navigate to="/buyer" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
};

// ==================== MAIN APP COMPONENT ====================
function App() {
  React.useEffect(() => {
    const ua = (typeof navigator !== 'undefined' ? (navigator.userAgent || navigator.vendor || window.opera || '') : '');
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk/i.test(ua);
    const isTouch = (typeof window !== 'undefined') && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0));
    const isSmallScreen = (typeof window !== 'undefined') && ((window.innerWidth && window.innerWidth <= 820) || (window.screen && window.screen.width <= 820));

    const isMobileDevice = isMobileUA || (isTouch && isSmallScreen);
    const isForcedWeb = typeof window !== 'undefined' && (
      window.location.search.indexOf('force=web') !== -1 || 
      window.location.search.indexOf('force=desktop') !== -1 ||
      (() => { try { return sessionStorage.getItem('abumafhal_force_web') === 'true'; } catch (_) { return false; } })()
    );
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
        const parts = currentPath.split('/').filter(Boolean);
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
      else if (currentPath.includes('stores')) targetHash = '#stores';
      else if (currentPath.includes('product')) {
        const parts = currentPath.split('/').filter(Boolean);
        const prodId = parts[parts.length - 1];
        if (prodId && prodId !== 'product') {
          targetHash = '#product/' + encodeURIComponent(prodId);
        }
      }

      window.location.replace('/mobile' + targetHash);
    }
  }, []);

  return (
    <AuthProvider>
      <CartProvider>
        <WishlistProvider>
          <ComparisonProvider>
            <Router>
              <Routes>
                {/* ==================== PUBLIC ROUTES ==================== */}
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:id" element={<ProductDetails />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/terms" element={<Terms />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/ai-test" element={<AITest />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/stores" element={<Stores />} />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />

                {/* ==================== AUTH ROUTES ==================== */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />

                {/* ==================== VENDOR APPLICATION ==================== */}
                <Route
                  path="/vendor-application"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <VendorApplication />
                    </ProtectedRoute>
                  }
                />

                {/* ==================== CART & CHECKOUT ==================== */}
                <Route
                  path="/cart"
                  element={
                    <ProtectedRoute>
                      <Cart />
                    </ProtectedRoute>
                  }
                />

                {/* ==================== MESSAGES/CHAT ==================== */}
                <Route
                  path="/messages"
                  element={
                    <ProtectedRoute>
                      <Messages />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/messages/:conversationId"
                  element={
                    <ProtectedRoute>
                      <ChatWindow />
                    </ProtectedRoute>
                  }
                />

                {/* ==================== ADMIN ROUTES ==================== */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['admin']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/admin/analytics" replace />} />
                  <Route path="analytics" element={<AdminAnalytics />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="vendors" element={<AdminVendors />} />
                  <Route path="vendor-approvals" element={<VendorApproval />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="categories" element={<AdminCategories />} />
                  <Route path="products/add" element={<AdminAddProduct />} />
                  <Route path="products/edit/:id" element={<AdminAddProduct />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="disputes" element={<AdminDisputes />} />
                  <Route path="payments" element={<AdminPayments />} />
                  <Route path="payouts" element={<AdminPayouts />} />
                  <Route path="coupons" element={<AdminCoupons />} />
                  <Route path="flash-sales" element={<AdminFlashSales />} />
                  <Route path="financials" element={<AdminFinancials />} />
                  <Route path="cms" element={<AdminCMS />} />
                  <Route path="audit-logs" element={<AdminAuditLogs />} />
                  <Route path="abandoned-carts" element={<AdminAbandonedCarts />} />
                  <Route path="reviews" element={<AdminReviews />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="store-profile" element={<AdminStoreProfile />} />
                </Route>

                {/* ==================== VENDOR ROUTES ==================== */}
                <Route
                  path="/vendor"
                  element={
                    <ProtectedRoute allowedRoles={['vendor']}>
                      <VendorDashboard />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/vendor/analytics" replace />} />
                  <Route path="analytics" element={<VendorAnalytics />} />
                  <Route path="products" element={<VendorProducts />} />
                  <Route path="products/add" element={<AddProduct />} />
                  <Route path="products/edit/:id" element={<EditProduct />} />
                  <Route path="orders" element={<VendorOrders />} />
                  <Route path="profile" element={<VendorProfile />} />
                  <Route path="wallet" element={<VendorWallet />} />
                  <Route path="disputes" element={<VendorDisputes />} />
                  <Route path="settings" element={<VendorSettings />} />
                </Route>

                {/* ==================== BUYER ROUTES ==================== */}
                <Route
                  path="/buyer"
                  element={
                    <ProtectedRoute allowedRoles={['buyer']}>
                      <BuyerDashboard />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Navigate to="/buyer/orders" replace />} />
                  <Route path="orders" element={<BuyerOrders />} />
                  <Route path="orders/track/:id" element={<OrderTracking />} />
                  <Route path="wishlist" element={<BuyerWishlist />} />
                  <Route path="profile" element={<BuyerProfile />} />
                  <Route path="wallet" element={<Wallet />} />
                  <Route path="reviews" element={<Reviews />} />
                  <Route path="disputes" element={<Disputes />} />
                  <Route path="settings" element={<BuyerSettings />} />
                  <Route path="email-preferences" element={<EmailPreferences />} />
                  <Route path="loyalty" element={<LoyaltyRewards />} />
                </Route>

                {/* ==================== MOBILE & ALIAS ROUTES (NEVER 404) ==================== */}
                <Route path="/mobile" element={<MobileRedirect />} />
                <Route path="/mobile/*" element={<MobileRedirect />} />
                <Route path="/join" element={<Navigate to="/register" replace />} />
                <Route path="/join/*" element={<Navigate to="/register" replace />} />
                <Route path="/auth" element={<Navigate to="/login" replace />} />

                {/* ==================== 404 NOT FOUND / SAFE FALLBACK ==================== */}
                <Route
                  path="*"
                  element={<Navigate to="/" replace />}
                />
              </Routes>

              {/* ==================== AI ASSISTANT (GLOBAL) ==================== */}
              <AIAssistant />
            </Router>
          </ComparisonProvider>
        </WishlistProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;