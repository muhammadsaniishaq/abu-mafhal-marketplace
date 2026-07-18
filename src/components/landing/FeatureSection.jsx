import React from 'react';
import { Shield, Sparkles, Truck, Tag } from 'lucide-react';

const FEATURES = [
  {
    icon: Shield,
    title: 'Secure Payments',
    desc: '100% safe & encrypted escrow protection on every order.',
    color: 'text-emerald-500 border-emerald-500/20 bg-emerald-50/40',
    iconBg: 'bg-emerald-500/10'
  },
  {
    icon: Sparkles,
    title: 'AI Smart Assistant',
    desc: 'Shop smarter everyday with customized AI concierge recommendations.',
    color: 'text-indigo-500 border-indigo-500/20 bg-indigo-50/40',
    iconBg: 'bg-indigo-500/10'
  },
  {
    icon: Truck,
    title: 'Fast Delivery',
    desc: 'Priority air cargo logistics delivering across Nigeria and globally.',
    color: 'text-amber-500 border-amber-500/20 bg-amber-50/40',
    iconBg: 'bg-amber-500/10'
  },
  {
    icon: Tag,
    title: 'Best Prices',
    desc: 'Enjoy unmatched deals and direct wholesale vendor pricing.',
    color: 'text-blue-500 border-blue-500/20 bg-blue-50/40',
    iconBg: 'bg-blue-500/10'
  }
];

export const FeatureSection = () => {
  return (
    <section className="py-20 bg-white font-['Inter'] relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Title */}
        <div className="text-center space-y-4 mb-16">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#D9A73A]">
            Why Abu Mafhal
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0E1A2E] tracking-tight font-['Poppins']">
            Ecosystem Features
          </h2>
          <div className="w-12 h-1 bg-[#D9A73A] rounded-full mx-auto" />
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((item, index) => (
            <div
              key={index}
              className={`p-8 rounded-3xl border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-[#D9A73A]/40 flex flex-col justify-between text-left ${item.color} backdrop-blur-md`}
            >
              <div className="space-y-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.iconBg} ${item.color.split(' ')[0]} transition-transform duration-500 hover:rotate-[360deg]`}>
                  <item.icon className="w-6 h-6 stroke-[2]" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-[#0E1A2E] font-['Poppins']">
                    {item.title}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
export default FeatureSection;
