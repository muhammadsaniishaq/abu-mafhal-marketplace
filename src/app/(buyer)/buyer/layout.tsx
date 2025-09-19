import React from 'react';
import BuyerSidebar from '@/components/buyer/BuyerSidebar';
import { AuthProvider, useAuth } from '@/hooks/useAuth'; // We will create this hook
import { useRouter } from 'next/navigation';
import Spinner from '@/components/Spinner'; // A simple loading spinner component

// This component will protect the route and handle loading/redirects
const BuyerLayoutContent = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    // In a real app, you might want a delay or a message before redirecting
    // For now, we redirect immediately if not logged in
    if (typeof window !== 'undefined') {
      router.push('/auth/login');
    }
    return null; // Return null while redirecting
  }
  
  // Optional: Add a check for buyer role if you have custom claims set up
  // if (user.role !== 'buyer') { ... handle unauthorized access ... }

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
      <BuyerSidebar />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        {children}
      </main>
    </div>
  );
};


export default function BuyerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <BuyerLayoutContent>{children}</BuyerLayoutContent>
    </AuthProvider>
  );
}
