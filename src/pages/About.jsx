import React from 'react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';

const About = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">About Abu Mafhal</h1>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-6">
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            Abu Mafhal is Nigeria's premier multi-vendor marketplace, connecting buyers with trusted sellers across the country.
          </p>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            We offer a secure, AI-powered platform that supports multiple payment methods including Paystack, Flutterwave, and cryptocurrency.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Our Mission</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Empowering Nigerian businesses</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">💡</div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Our Vision</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Leading marketplace in Africa</p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">⭐</div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2">Our Values</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">Trust, quality, innovation</p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default About;