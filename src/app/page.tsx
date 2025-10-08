// src/app/page.tsx
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebaseClient";

type Product = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  vendorName: string;
};

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);

  // Fetch products from Firestore
  useEffect(() => {
    const fetchProducts = async () => {
      const snapshot = await getDocs(collection(db, "products"));
      const items: Product[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
      setProducts(items.slice(0, 6)); // Show first 6 products
    };
    fetchProducts();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      {/* Hero Section */}
      <Hero />

      {/* Features Section */}
      <Features />

      {/* Live Products Preview */}
      <section className="py-20 px-6 max-w-6xl mx-auto text-center">
        <h2 className="text-3xl font-bold mb-12">Latest Products</h2>

        {products.length === 0 ? (
          <p className="text-gray-500">No products available yet.</p>
        ) : (
          <div className="grid gap-8 md:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* FAQ */}
      <FAQ />

      {/* Call to Action */}
      <CTA />
    </main>
  );
}

function Hero() {
  return (
    <section className="flex flex-col items-center justify-center text-center py-20 px-6 bg-gradient-to-b from-blue-900 to-blue-600 text-white relative overflow-hidden">
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <Image
          src="/logo.png"
          alt="Abu Mafhal Logo"
          width={100}
          height={100}
          className="rounded-full shadow-lg"
        />
      </motion.div>

      {/* Title */}
      <motion.h1
        className="text-4xl md:text-6xl font-bold mt-6"
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        Welcome to Abu Mafhal Marketplace
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        className="mt-4 max-w-2xl text-lg md:text-xl text-blue-100"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
      >
        A secure multi-vendor platform where buyers, vendors, and admins connect —
        powered by Firebase and AI.
      </motion.p>

      {/* CTA Buttons */}
      <motion.div
        className="mt-8 flex gap-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.6 }}
      >
        <a
          href="/(auth)/signup"
          className="px-6 py-3 bg-white text-blue-700 font-semibold rounded-lg shadow hover:bg-gray-100"
        >
          Get Started
        </a>
        <a
          href="/(auth)/login"
          className="px-6 py-3 bg-transparent border border-white text-white font-semibold rounded-lg hover:bg-white hover:text-blue-700"
        >
          Sign In
        </a>
      </motion.div>
    </section>
  );
}

function Features() {
  return (
    <section className="py-20 px-6 max-w-6xl mx-auto text-center">
      <h2 className="text-3xl font-bold mb-12">Why Choose Abu Mafhal?</h2>

      <div className="grid gap-8 md:grid-cols-3">
        <FeatureCard
          title="For Buyers"
          desc="Shop easily, track orders in real-time, earn loyalty points, and pay with NGN, USD, or crypto."
        />
        <FeatureCard
          title="For Vendors"
          desc="Manage products, track sales, withdraw earnings, and boost visibility with AI-powered insights."
        />
        <FeatureCard
          title="For Admins"
          desc="Monitor vendors, manage disputes, approve payments, and oversee marketplace growth securely."
        />
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: Product }) {
  return (
    <motion.div
      className="border rounded-xl p-4 bg-white shadow hover:shadow-lg transition text-left"
      whileHover={{ scale: 1.03 }}
    >
      <Image
        src={product.imageUrl || "/placeholder.png"}
        alt={product.name}
        width={400}
        height={250}
        className="rounded-lg w-full h-48 object-cover"
      />
      <h3 className="text-lg font-semibold mt-3">{product.name}</h3>
      <p className="text-blue-700 font-bold">₦{product.price}</p>
      <p className="text-sm text-gray-500">By {product.vendorName}</p>
    </motion.div>
  );
}

function Testimonials() {
  return (
    <section className="bg-gray-100 py-20 px-6 text-center">
      <h2 className="text-3xl font-bold mb-12">What People Are Saying</h2>
      <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
        <TestimonialCard
          name="Aisha, Buyer"
          feedback="Shopping on Abu Mafhal is smooth and reliable. I love how I can track my orders in real-time!"
        />
        <TestimonialCard
          name="Musa, Vendor"
          feedback="As a vendor, I’ve doubled my sales in just two months. The analytics and payout system are amazing."
        />
        <TestimonialCard
          name="Fatima, Admin"
          feedback="Managing vendors and orders has never been this easy. The platform is secure and efficient."
        />
      </div>
    </section>
  );
}

function FAQ() {
  return (
    <section className="py-20 px-6 max-w-4xl mx-auto">
      <h2 className="text-3xl font-bold mb-12 text-center">Frequently Asked Questions</h2>
      <div className="space-y-6">
        <FAQItem
          question="How do I sign up as a vendor?"
          answer="Click 'Get Started', choose 'Vendor' during sign-up, and upload your KYC documents for approval."
        />
        <FAQItem
          question="What payment methods are supported?"
          answer="We support Paystack (NGN), Flutterwave (international), and NowPayments (crypto)."
        />
        <FAQItem
          question="Is my data secure?"
          answer="Yes. We use Firebase Authentication, Firestore security rules, and role-based access to keep your account safe."
        />
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="bg-blue-700 text-white py-16 px-6 text-center">
      <h2 className="text-3xl font-bold">Ready to join the future of e-commerce?</h2>
      <p className="mt-4 text-blue-100">
        Whether you're a Buyer, Vendor, or Admin — Abu Mafhal Marketplace is built for you.
      </p>
      <div className="mt-6">
        <a
          href="/(auth)/signup"
          className="px-8 py-4 bg-white text-blue-700 font-semibold rounded-lg shadow hover:bg-gray-100"
        >
          Create Your Account
        </a>
      </div>
    </section>
  );
}

// Reusable Components
function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <motion.div
      className="border rounded-xl p-6 bg-white shadow hover:shadow-lg transition"
      whileHover={{ scale: 1.05 }}
    >
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-gray-600">{desc}</p>
    </motion.div>
  );
}

function TestimonialCard({ name, feedback }: { name: string; feedback: string }) {
  return (
    <motion.div
      className="p-6 bg-white border rounded-lg shadow hover:shadow-md transition"
      whileHover={{ scale: 1.03 }}
    >
      <p className="text-gray-700 italic">“{feedback}”</p>
      <h4 className="mt-4 font-semibold text-blue-700">{name}</h4>
    </motion.div>
  );
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="p-4 border rounded-lg bg-white shadow-sm">
      <h3 className="font-semibold text-lg">{question}</h3>
      <p className="mt-2 text-gray-600">{answer}</p>
    </div>
  );
}
