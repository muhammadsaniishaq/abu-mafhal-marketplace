import React from 'react';
import { Users, Building, ShieldCheck } from 'lucide-react';

export const MissionSection = () => {
  return (
    <section className="py-24 bg-white font-['Inter'] relative z-10">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Left Column: Mission Description */}
          <div className="lg:col-span-6 space-y-8 text-left">
            <div className="space-y-4">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#D9A73A]">
                Our Core Mission
              </span>
              <h2 className="text-4xl md:text-5xl font-extrabold text-[#0E1A2E] leading-tight font-['Poppins']">
                Empowering People.<br />
                Building Opportunities.<br />
                Stronger Community.
              </h2>
              <div className="w-16 h-1.5 bg-[#D9A73A] rounded-full" />
            </div>

            <p className="text-sm md:text-base text-slate-600 leading-relaxed font-semibold">
              Abu Mafhal is more than a marketplace. It is a movement built to empower local entrepreneurs, support growing businesses, and connect local communities to the global marketplace with security, transparency, and pride.
            </p>

            {/* Sub points */}
            <div className="space-y-4 pt-4">
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#0E1A2E]/5 flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-[#0E1A2E]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0E1A2E]">Empowering Sellers</h4>
                  <p className="text-xs text-slate-500 font-semibold mt-1">Providing tools, analytics, and instant capital settlement to scale operations.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#0E1A2E]/5 flex items-center justify-center flex-shrink-0">
                  <Building className="w-5 h-5 text-[#0E1A2E]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0E1A2E]">Supporting Businesses</h4>
                  <p className="text-xs text-slate-500 font-semibold mt-1">Seamless air-cargo logistics lines bridging African production to international ports.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-[#0E1A2E]/5 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-5 h-5 text-[#0E1A2E]" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#0E1A2E]">Connecting Communities</h4>
                  <p className="text-xs text-slate-500 font-semibold mt-1">Fostering trust via secure escrow wallets, verified identities, and 24/7 service support.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: High Quality African Business Photo Mockup */}
          <div className="lg:col-span-6 relative">
            <div className="absolute -bottom-6 -right-6 w-96 h-96 rounded-full bg-[#D9A73A]/5 blur-3xl pointer-events-none" />
            
            {/* Visual Frame */}
            <div className="rounded-[2rem] overflow-hidden shadow-2xl border-4 border-[#0E1A2E] relative bg-[#0E1A2E]">
              <img
                src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=800"
                alt="African Businesses and Community"
                className="w-full h-96 object-cover opacity-90"
              />
              {/* Bottom floating banner inside image */}
              <div className="absolute bottom-6 left-6 right-6 bg-[#0E1A2E]/90 backdrop-blur-md border border-white/10 p-5 rounded-2xl flex items-center gap-4 text-left">
                <div className="w-10 h-10 rounded-full bg-[#D9A73A] flex items-center justify-center text-white shadow-lg">
                  <Users className="w-5 h-5 text-[#0E1A2E]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-black text-[#F5F3EB]">Stronger Together</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Join thousands of smart buyers & sellers today!</p>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
export default MissionSection;
