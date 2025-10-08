// src/utils/constants.js

// User Roles
export const USER_ROLES = {
  ADMIN: 'admin',
  VENDOR: 'vendor',
  BUYER: 'buyer'
};

// Order Status
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded'
};

// Payment Status
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
  PROCESSING: 'processing'
};

// Product Status
export const PRODUCT_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DRAFT: 'draft',
  OUT_OF_STOCK: 'out_of_stock'
};

// Dispute Status
export const DISPUTE_STATUS = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  RESOLVED: 'resolved',
  CLOSED: 'closed'
};

// Payment Methods
export const PAYMENT_METHODS = {
  PAYSTACK: 'paystack',
  FLUTTERWAVE: 'flutterwave',
  CRYPTO: 'crypto',
  WALLET: 'wallet'
};

// Product Categories
export const PRODUCT_CATEGORIES = [
  'Electronics',
  'Fashion',
  'Home & Garden',
  'Beauty & Personal Care',
  'Sports & Outdoors',
  'Books & Stationery',
  'Toys & Games',
  'Automotive',
  'Health & Wellness',
  'Food & Beverages',
  'Jewelry & Accessories',
  'Arts & Crafts',
  'Pet Supplies',
  'Baby & Kids',
  'Office Supplies'
];

// Nigerian States
export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
  'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'FCT'
];

// Delivery Options
export const DELIVERY_OPTIONS = {
  STANDARD: { name: 'Standard Delivery', days: '3-5 days', fee: 1500 },
  EXPRESS: { name: 'Express Delivery', days: '1-2 days', fee: 3000 },
  SAME_DAY: { name: 'Same Day Delivery', days: 'Same day', fee: 5000 }
};

// File Upload Limits
export const FILE_LIMITS = {
  IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  DOCUMENT_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  MAX_PRODUCT_IMAGES: 5,
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
};

// Pagination
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PRODUCTS_PER_PAGE: 24,
  ORDERS_PER_PAGE: 15,
  REVIEWS_PER_PAGE: 10
};

// Time Constants
export const TIME = {
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  ONE_WEEK: 7 * 24 * 60 * 60 * 1000
};

// Currency
export const CURRENCY = {
  SYMBOL: '₦',
  CODE: 'NGN',
  NAME: 'Nigerian Naira'
};

// App Config
export const APP_CONFIG = {
  NAME: 'Abu Mafhal',
  DESCRIPTION: 'Multi-Vendor Marketplace',
  SUPPORT_EMAIL: 'support@abumafhal.com',
  SUPPORT_PHONE: '+234 800 000 0000',
  MIN_PASSWORD_LENGTH: 6,
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  LOYALTY_POINTS_PER_NAIRA: 0.01, // 1 point per ₦100 spent
  VENDOR_COMMISSION: 0.15 // 15% platform fee
};

// Validation Patterns
export const VALIDATION_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^(\+234|0)[789][01]\d{8}$/,
  PASSWORD: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/,
  URL: /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your internet connection.',
  AUTH_FAILED: 'Authentication failed. Please login again.',
  INVALID_EMAIL: 'Please enter a valid email address.',
  INVALID_PHONE: 'Please enter a valid Nigerian phone number.',
  WEAK_PASSWORD: 'Password must be at least 6 characters with letters and numbers.',
  PASSWORDS_DONT_MATCH: 'Passwords do not match.',
  REQUIRED_FIELD: 'This field is required.',
  FILE_TOO_LARGE: 'File size is too large.',
  INVALID_FILE_TYPE: 'Invalid file type.',
  UPLOAD_FAILED: 'File upload failed. Please try again.',
  PAYMENT_FAILED: 'Payment failed. Please try again.',
  INSUFFICIENT_STOCK: 'Insufficient stock available.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'Resource not found.',
  SERVER_ERROR: 'Server error. Please try again later.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Logged in successfully!',
  REGISTER_SUCCESS: 'Account created successfully!',
  LOGOUT_SUCCESS: 'Logged out successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  PRODUCT_CREATED: 'Product created successfully!',
  PRODUCT_UPDATED: 'Product updated successfully!',
  PRODUCT_DELETED: 'Product deleted successfully!',
  ORDER_PLACED: 'Order placed successfully!',
  ORDER_UPDATED: 'Order updated successfully!',
  PAYMENT_SUCCESS: 'Payment successful!',
  REVIEW_SUBMITTED: 'Review submitted successfully!',
  MESSAGE_SENT: 'Message sent successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!'
};

// Social Media Links
export const SOCIAL_LINKS = {
  FACEBOOK: 'https://facebook.com/abumafhal',
  TWITTER: 'https://twitter.com/abumafhal',
  INSTAGRAM: 'https://instagram.com/abumafhal',
  LINKEDIN: 'https://linkedin.com/company/abumafhal'
};

// API Endpoints (if using external APIs)
export const API_ENDPOINTS = {
  PAYSTACK_INITIALIZE: 'https://api.paystack.co/transaction/initialize',
  PAYSTACK_VERIFY: 'https://api.paystack.co/transaction/verify',
  FLUTTERWAVE_INITIALIZE: 'https://api.flutterwave.com/v3/payments',
  NOWPAYMENTS_ESTIMATE: 'https://api.nowpayments.io/v1/estimate'
};

// Crypto Currencies
export const CRYPTO_CURRENCIES = [
  { code: 'btc', name: 'Bitcoin', symbol: '₿' },
  { code: 'eth', name: 'Ethereum', symbol: 'Ξ' },
  { code: 'usdt', name: 'Tether', symbol: '₮' },
  { code: 'bnb', name: 'Binance Coin', symbol: 'BNB' },
  { code: 'usdc', name: 'USD Coin', symbol: 'USDC' },
  { code: 'ltc', name: 'Litecoin', symbol: 'Ł' },
  { code: 'trx', name: 'Tron', symbol: 'TRX' },
  { code: 'doge', name: 'Dogecoin', symbol: 'Ð' }
];

// Rating Stars
export const RATING_OPTIONS = [1, 2, 3, 4, 5];

// Chart Colors
export const CHART_COLORS = {
  PRIMARY: '#3b82f6',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  DANGER: '#ef4444',
  INFO: '#06b6d4',
  PURPLE: '#8b5cf6',
  PINK: '#ec4899'
};