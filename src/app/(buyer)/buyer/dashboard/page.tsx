'use client';
// This will be the main dashboard page at your-site.com/buyer/dashboard

import { DollarSign, ShoppingBag, Heart } from 'lucide-react';

// This is a placeholder for your actual data fetching logic
// In a real app, you would fetch this from Firestore
const useBuyerStats = () => {
  // TODO: Implement Firestore queries to get real data
  return {
    loading: false,
    stats: {
      walletBalance: 1250.75,
      totalOrders: 24,
      wishlistItems: 8,
    },
  };
};

// A reusable KPI Card component
const KpiCard = ({ title, value, icon: Icon, currency = '' }) => (
  <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md flex items-center space-x-4">
    <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full">
      <Icon className="h-6 w-6 text-blue-600 dark:text-blue-300" />
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{title}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {currency}{typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  </div>
);

export default function BuyerDashboardPage() {
  const { stats, loading } = useBuyerStats();
  
  // TODO: Add a real user object from your auth hook
  const user = { name: 'Valued Customer' };

  if (loading) {
    return <div>Loading dashboard...</div>;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user.name}!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Here's a summary of your account activity.
        </p>
      </header>

      {/* KPI Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <KpiCard
          title="Wallet Balance"
          value={stats.walletBalance}
          icon={DollarSign}
          currency="$"
        />
        <KpiCard
          title="Total Orders"
          value={stats.totalOrders}
          icon={ShoppingBag}
        />
        <KpiCard
          title="Items in Wishlist"
          value={stats.wishlistItems}
          icon={Heart}
        />
      </div>

      {/* Recent Orders Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Recent Orders
        </h2>
        {/* TODO: Create a table component and fetch recent orders from Firestore */}
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p>Order history will be displayed here.</p>
        </div>
      </div>
      
      {/* AI-Powered Recommendations Section */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
          Just For You
        </h2>
        {/* We will integrate Gemini AI here to provide product recommendations */}
        <div className="text-center text-gray-500 dark:text-gray-400 py-8">
          <p>Personalized recommendations powered by Gemini AI are coming soon!</p>
        </div>
      </div>
    </div>
  );
}
