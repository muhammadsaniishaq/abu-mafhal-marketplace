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

// ==================== PROTECTED ROUTE COMPONENT ====================
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">Loading Abu Mafhal Marketplace...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
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
                  <Route path="products/add" element={<AdminAddProduct />} />
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

                {/* ==================== 404 NOT FOUND ==================== */}
                <Route 
                  path="*" 
                  element={
                    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                      <div className="text-center">
                        <h1 className="text-9xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
                        <p className="text-2xl text-gray-600 dark:text-gray-400 mb-2">Page Not Found</p>
                        <p className="text-gray-500 dark:text-gray-500 mb-8">
                          The page you're looking for doesn't exist.
                        </p>
                        <a 
                          href="/" 
                          className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2 font-medium shadow-lg"
                        >
                          <span>🏠</span>
                          <span>Go to Home</span>
                        </a>
                      </div>
                    </div>
                  } 
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