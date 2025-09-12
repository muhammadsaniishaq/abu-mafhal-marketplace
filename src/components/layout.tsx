import Link from "next/link";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Navbar */}
      <header className="bg-blue-600 text-white p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">
          <Link href="/">Abu Mafhal</Link>
        </h1>
        <nav className="space-x-6">
          <Link href="/">Home</Link>
          <Link href="/products">Products</Link>
          <Link href="/vendors">Vendors</Link>
          <Link href="/auth/sign-in">Sign In</Link>
          <Link href="/auth/sign-up">Sign Up</Link>
        </nav>
      </header>

      {/* Page Content */}
      <main className="flex-1 p-6">{children}</main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white text-center p-3 text-sm">
        © {new Date().getFullYear()} Abu Mafhal Marketplace. All rights reserved.
      </footer>
    </div>
  );
}
