import React from 'react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';

const Terms = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">Terms and Conditions</h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">1. Acceptance of Terms</h2>
            <p>By accessing and using Abu Mafhal marketplace, you accept and agree to be bound by these terms and conditions.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">2. User Accounts</h2>
            <p>Users must provide accurate information when creating accounts. You are responsible for maintaining account security.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">3. Vendor Responsibilities</h2>
            <p>Vendors must provide accurate product descriptions, honor prices, and fulfill orders promptly.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">4. Payment Terms</h2>
            <p>All payments are processed securely through our payment partners. Refund policies apply as stated.</p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">5. Prohibited Activities</h2>
            <p>Users must not engage in fraud, sale of prohibited items, or any illegal activities on the platform.</p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Terms;