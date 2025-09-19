 export type BuyerProfile = {
  uid: string;
  email?: string;
  name?: string;
  phone?: string;
  avatarUrl?: string;
  defaultAddressId?: string;
  createdAt?: any;
  lastLoginAt?: any;
  loyaltyPoints?: number;
  currency?: string; // "NGN" | "USD" | etc
};

export type Address = {
  id?: string;
  label: "home" | "office" | "other";
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  country: string;
  zip?: string;
  isDefault?: boolean;
  createdAt?: any;
};

export type CartItem = {
  productId: string;
  title: string;
  price: number;
  qty: number;
  imageUrl?: string;
  variant?: Record<string, string>;
  vendorId?: string;
};

export type Order = {
  id?: string;
  buyerId: string;
  items: CartItem[];
  totalAmount: number;
  currency: string;
  status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentMethod: "paystack" | "stripe" | "paypal";
  paymentStatus: "pending" | "paid" | "refunded";
  address: Address;
  createdAt: any;
  timeline?: { status: string; at: string }[];
  invoiceUrl?: string;
};

export type Wallet = {
  buyerId: string;
  balance: number;
  currency: string;
  updatedAt?: any;
};

export type WalletTxn = {
  id?: string;
  buyerId: string;
  type: "topup" | "debit" | "refund" | "reward";
  amount: number;
  currency: string;
  ref?: string;
  note?: string;
  createdAt: any;
};

export type Review = {
  id?: string;
  buyerId: string;
  productId: string;
  rating: number; // 1..5
  comment?: string;
  createdAt: any;
};

export type WishlistItem = {
  id?: string;
  buyerId: string;
  productId: string;
  addedAt: any;
};

export type NotificationDoc = {
  id?: string;
  to: string;              // buyerId
  title: string;
  body: string;
  type: "order" | "promo" | "system";
  read?: boolean;
  createdAt: any;
};

export type Dispute = {
  id?: string;
  orderId: string;
  buyerId: string;
  vendorId?: string;
  reason: string;
  status: "pending" | "resolved" | "rejected";
  thread?: { from: "buyer" | "vendor" | "admin"; msg: string; at: any }[];
  createdAt: any;
};


export type VendorProfile = {
  uid: string;
  email?: string;
  businessName?: string;
  phone?: string;
  logoUrl?: string;
  bannerUrl?: string;
  description?: string;
  kycDocs?: string[];
  status: "pending" | "approved" | "suspended";
  createdAt?: any;
};

export type VendorProduct = {
  id?: string;
  vendorId: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  images: string[];
  variants?: Record<string, string[]>; // size: ["S","M"], color: ["red","blue"]
  active: boolean;
  views?: number;
  favorites?: number;
  sales?: number;
  createdAt: any;
};

export type VendorOrder = {
  id?: string;
  vendorId: string;
  buyerId: string;
  items: { productId: string; qty: number; price: number }[];
  totalAmount: number;
  currency: string;
  status: "pending" | "processing" | "shipped" | "completed";
  createdAt: any;
};

export type VendorWallet = {
  vendorId: string;
  balance: number;
  pending: number;
  totalEarnings: number;
  updatedAt?: any;
};

export type VendorReview = {
  id?: string;
  vendorId: string;
  productId: string;
  buyerId: string;
  rating: number;
  comment?: string;
  createdAt: any;
};

export type VendorNotification = {
  id?: string;
  vendorId: string;
  title: string;
  body: string;
  type: "order" | "system" | "promo";
  read?: boolean;
  createdAt: any;
};

export type VendorDispute = {
  id?: string;
  vendorId: string;
  orderId: string;
  buyerId: string;
  reason: string;
  status: "pending" | "resolved" | "rejected";
  createdAt: any;
};
