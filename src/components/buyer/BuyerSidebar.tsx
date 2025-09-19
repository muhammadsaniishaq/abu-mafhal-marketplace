'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Heart,
  Wallet,
  Star,
  Bell,
  MessageSquareWarning,
  Settings,
  LogOut,
} from 'lucide-react';
import { getAuth, signOut } from 'firebase/auth';
import { app } from '@/lib/firebase'; // Ensure your firebase export is correct

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/orders', icon: ShoppingBag, label: 'Orders' },
  { href: '/wallet', icon: Wallet, label: 'Wallet' },
  { href: '/wishlist', icon: Heart, label: 'Wishlist' },
  { href: '/reviews', icon: Star, label: 'Reviews' },
  { href: '/notifications', icon: Bell, label: 'Notifications' },
  { href: '/disputes', icon: MessageSquareWarning, label: 'Disputes' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function BuyerSidebar() {
  const pathname = usePathname();
  const auth = getAuth(app);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // The redirect will be handled by the layout's auth check
      window.location.href = '/auth/login';
    } catch (error) {
      console.error('Error signing out: ', error);
      // Handle logout error (e.g., show a notification)
    }
  };

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-gray-800 p-4 flex flex-col justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
          Abu Mafhal
        </h1>
        <nav className="space-y-2">
          {navItems.map((item) => {
            // Using startsWith to handle nested routes, e.g., /orders/123
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={`/buyer${item.href}`} // Assuming routes are nested under /buyer
                className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center space-x-3 p-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-800/50 transition-colors"
      >
        <LogOut className="h-5 w-5" />
        <span>Logout</span>
      </button>
    </aside>
  );
}
