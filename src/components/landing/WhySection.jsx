import React from 'react';
import { ShoppingBag, Landmark, Sparkles, CreditCard, Check } from 'lucide-react';

const WHY_DATA = [
  {
    icon: ShoppingBag,
    title: 'For Buyers',
    bgColor: 'bg-white',
    bullets: [
      'Discover unique quality products',
      'Secure escrow safe shopping',
      'Smart customized recommendations'
    ]
  },
  {
    icon: Landmark,
    title: 'For Sellers',
    bgColor: 'bg-white',
    bullets: [
      'Robust online storefront tools',
      'Detailed real-time sales analytics',
      'Direct access to thousands of buyers'
    ]
  },
  {
    icon: Sparkles,
    title: 'AI Technology',
    bgColor: 'bg-[#0E1A2E] text-white border-none shadow-xl',
    bullets: [
      'High speed semantic AI search',
      '24/7 smart assistant support',
      'Automated personalized listings'
    ],
    isDark: true
  },
  {
    icon: CreditCard,
    title: 'Payments',
    bgColor: 'bg-white',
    bullets: [
      'Direct secure card payments',
      'Instant local bank transfers',
      'Stable crypto payment support'
    ]
  }
];

export const WhySection = () => {
  return (
    <section className="py-24 bg-[#F5F3EB]/30 font-['Inter'] relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#D9A73A]">
            Why Abu Mafhal
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-[#0E1A2E] tracking-tight font-['Poppins']">
            Tailored Marketplace Ecosystem
          </h2>
          <div className="w-12 h-1 bg-[#D9A73A] rounded-full mx-auto" />
        </div>

        {/* Why Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {WHY_DATA.map((card, idx) => (
            <div
              key={idx}
              className={`p-8 rounded-3xl border border-slate-200/60 shadow-sm flex flex-col justify-between text-left hover:shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-[#D9A73A]/30 ${card.bgColor}`}
            >
              <div className="space-y-6">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  card.isDark ? 'bg-white/10 text-[#D9A73A]' : 'bg-[#0E1A2E]/5 text-[#0E1A2E]'
                }`}>
                  <card.icon className="w-6 h-6 stroke-[2]" />
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-bold font-['Poppins']">{card.title}</h3>
                  <ul className="space-y-3">
                    {card.bullets.map((bullet, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2 text-xs font-semibold">
                        <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                          card.isDark ? 'text-[#D9A73A]' : 'text-[#10B981]'
                        }`} />
                        <span className={card.isDark ? 'text-slate-300' : 'text-slate-600'}>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
export default WhySection;
