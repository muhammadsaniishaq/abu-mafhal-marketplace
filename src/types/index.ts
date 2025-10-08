export type UserRole = "admin" | "vendor" | "buyer";

export type UserProfile = {
  uid: string;
  email: string | null;
  name?: string;
  avatarUrl?: string;
  role: UserRole;
  lastLoginAt?: number;
  phone?: string;
  addresses?: Array<{
    label: string; // home, office
    line1: string; city: string; state?: string; country?: string;
  }>;
};

export type Product = {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  price: number;
  images: string[];
  stock: number;
  status: "draft"|"active"|"disabled"|"pending";
  categories?: string[];
  variants?: Array<{ name: string; options: string[] }>;
  createdAt: number;
};

export type Order = {
  id: string;
  buyerId: string;
  vendorId: string;
  items: Array<{ productId: string; qty: number; price: number }>;
  amount: number;
  currency: string;       // NGN, USD, etc.
  status: "pending"|"paid"|"shipped"|"delivered"|"refunded"|"cancelled";
  paymentRef?: string;
  createdAt: number;
};

export type NotificationDoc = {
  id: string;
  toRole?: UserRole;
  toUserId?: string;
  title: string;
  body: string;
  createdAt: number;
};
