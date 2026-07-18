import React from 'react';
import { Link } from 'react-router-dom';
import { Laptop, Shirt, Smartphone, Home, Sparkles, Wrench, FileCode } from 'lucide-react';

const CATEGORIES = [
  { name: 'Electronics', query: 'electronics', icon: Laptop, color: 'text-blue-500 bg-blue-50 hover:bg-blue-100/60' },
  { name: 'Fashion', query: 'fashion', icon: Shirt, color: 'text-pink-500 bg-pink-50 hover:bg-pink-100/60' },
  { name: 'Phones', query: 'phones', icon: Smartphone, color: 'text-indigo-500 bg-indigo-50 hover:bg-indigo-100/60' },
  { name: 'Home & Living', query: 'home', icon: Home, color: 'text-amber-500 bg-amber-50 hover:bg-amber-100/60' },
  { name: 'Beauty', query: 'beauty', icon: Sparkles, color: 'text-red-500 bg-red-50 hover:bg-red-100/60' },
  { name: 'Services', query: 'services', icon: Wrench, color: 'text-emerald-500 bg-emerald-50 hover:bg-emerald-100/60' },
  { name: 'Digital Products', query: 'digital', icon: FileCode, color: 'text-purple-500 bg-purple-50 hover:bg-purple-100/60' }
];

export const CategorySection = () => {
  return (
    <section className="py-20 bg-white font-['Inter'] relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
          <div className="space-y-4 text-left">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#D9A73A]">
              Explore Marketplace
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0E1A2E] tracking-tight font-['Poppins']">
              Browse Categories
            </h2>
          </div>
          <Link
            to="/shop"
            className="text-xs font-bold text-[#D9A73A] hover:underline uppercase tracking-wider flex items-center gap-1.5"
          >
            <span>View All Products</span>
            <span>→</span>
          </Link>
        </div>

        {/* Categories grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {CATEGORIES.map((cat, idx) => (
            <Link
              key={idx}
              to={`/shop?category=${cat.query}`}
              className={`p-6 rounded-2xl flex flex-col items-center justify-center text-center transition-all duration-300 hover:scale-[1.03] border border-slate-100 hover:border-[#D9A73A]/40 shadow-sm hover:shadow-md ${cat.color}`}
            >
              <div className="p-3 bg-white rounded-xl shadow-sm mb-4">
                <cat.icon className="w-6 h-6 stroke-[1.8]" />
              </div>
              <span className="text-xs font-bold text-[#0E1A2E] tracking-tight">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>

      </div>
    </section>
  );
};
export default CategorySection;
