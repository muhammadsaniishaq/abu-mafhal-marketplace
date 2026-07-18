import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Search, Sparkles, Smartphone, ArrowRight, Zap } from 'lucide-react';

export const HeroSection = () => {
  const [activeTab, setActiveTab] = useState('shop');
  const [typedText, setTypedText] = useState('');
  const fullPhrase = 'Search premium products...';

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setTypedText(fullPhrase.slice(0, index));
      index = (index + 1) % (fullPhrase.length + 1);
    }, 180);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative pt-12 pb-24 overflow-hidden bg-[#F5F3EB]/40 font-['Inter']">
      {/* Back glow circles */}
      <div className="absolute top-[10%] left-[-5%] w-96 h-96 rounded-full bg-[#D9A73A]/10 blur-3xl pointer-events-none" />
      <div className="absolute top-[30%] right-[-5%] w-[30rem] h-[30rem] rounded-full bg-[#0E1A2E]/5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          {/* Left Column (Content) */}
          <div className="lg:col-span-7 space-y-8 text-left z-10">
            {/* Trust Badge */}
            <div className="inline-flex items-center gap-2 bg-[#0E1A2E]/5 border border-[#0E1A2E]/10 rounded-full px-4 py-1.5 text-xs font-bold text-[#0E1A2E] tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-[#D9A73A]" />
              <span>Trusted by thousands across Nigeria</span>
            </div>

            {/* Headline */}
            <h1 className="text-5xl md:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.1] text-[#0E1A2E] font-['Poppins']">
              Shop Smart.<br />
              Sell Fast.<br />
              <span className="text-[#D9A73A] bg-gradient-to-r from-[#D9A73A] to-[#B8860B] bg-clip-text text-transparent">
                Grow Together.
              </span>
            </h1>

            {/* Subtext */}
            <p className="text-base md:text-lg text-slate-600 leading-relaxed font-medium max-w-xl">
              The all-in-one marketplace for everyone. Buy, sell, earn and grow with secure payments and fast delivery you can trust.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap gap-4 items-center">
              <Link
                to="/shop"
                className="inline-flex items-center justify-center gap-2.5 bg-[#0E1A2E] hover:bg-[#1A2D4C] text-[#F5F3EB] px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 shadow-xl shadow-slate-900/10 hover:-translate-y-0.5"
              >
                <span>Start Shopping</span>
                <ArrowRight className="w-4 h-4 text-[#D9A73A]" />
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center justify-center gap-2 bg-white border border-[#0E1A2E]/20 text-[#0E1A2E] hover:bg-slate-50 px-8 py-4 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 hover:-translate-y-0.5"
              >
                <span>Start Selling</span>
              </Link>
            </div>

            {/* Feature pill highlights */}
            <div className="flex flex-wrap gap-6 pt-4 border-t border-slate-200/60 max-w-lg">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
                <span className="text-xs font-bold text-[#0E1A2E] opacity-80">256-Bit Escrow Secured</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#D9A73A]" />
                <span className="text-xs font-bold text-[#0E1A2E] opacity-80">Priority Air Cargo Delivery</span>
              </div>
            </div>
          </div>

          {/* Right Column (Interactive Visual Device) */}
          <div className="lg:col-span-5 relative flex justify-center z-10">
            {/* Outline Card back decoration */}
            <div className="absolute -top-6 -left-6 w-[22rem] h-[32rem] border-2 border-dashed border-[#D9A73A]/30 rounded-[3rem] pointer-events-none" />

            <div className="w-[20rem] h-[30rem] bg-white rounded-[2.8rem] border-[10px] border-[#0E1A2E] shadow-2xl relative overflow-hidden flex flex-col justify-between p-4 transition-transform duration-500 hover:scale-[1.02]">
              {/* Phone Camera Notch */}
              <div className="w-24 h-4.5 bg-[#0E1A2E] rounded-full mx-auto mb-2 relative flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-slate-800 absolute left-4" />
              </div>

              {/* Mock App Header */}
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-[#0E1A2E] flex items-center justify-center border border-[#D9A73A]/50">
                    <span className="text-white text-[8px] font-black">AM</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-[#0E1A2E] tracking-wider font-['Poppins']">ABU MAFHAL</span>
                </div>
                <ShoppingBag className="w-4 h-4 text-[#D9A73A]" />
              </div>

              {/* Search Simulator */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-2 flex items-center gap-2 my-2">
                <Search className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] text-slate-400 font-semibold italic">{typedText}</span>
              </div>

              {/* App screen sliding tabs */}
              <div className="flex gap-1 bg-[#F5F3EB] p-1 rounded-xl">
                <button
                  onClick={() => setActiveTab('shop')}
                  className={`flex-1 text-[8px] py-1.5 font-bold uppercase tracking-widest rounded-lg transition-all ${
                    activeTab === 'shop' ? 'bg-[#0E1A2E] text-white' : 'text-slate-500'
                  }`}
                >
                  Shop
                </button>
                <button
                  onClick={() => setActiveTab('cargo')}
                  className={`flex-1 text-[8px] py-1.5 font-bold uppercase tracking-widest rounded-lg transition-all ${
                    activeTab === 'cargo' ? 'bg-[#0E1A2E] text-white' : 'text-slate-500'
                  }`}
                >
                  Logistics
                </button>
              </div>

              {/* App Interactive view body */}
              <div className="flex-1 my-3 justify-center relative overflow-hidden bg-slate-50 rounded-2xl p-3 border border-slate-100 flex flex-col justify-between">
                
                {activeTab === 'shop' ? (
                  <div className="space-y-2 flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase">Featured Deal</span>
                      <span className="text-[8px] font-extrabold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">15% OFF</span>
                    </div>

                    <div className="h-28 rounded-xl overflow-hidden relative border border-slate-100">
                      <img
                        src="https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300"
                        alt="iPhone 15"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div>
                      <p className="text-[10px] font-extrabold text-[#0E1A2E]">iPhone 15 Pro Max</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs font-black text-[#10B981]">₦1,250,000</span>
                        <span className="text-[9px] text-slate-400 line-through">₦1,470,000</span>
                      </div>
                    </div>

                    <div className="bg-[#0E1A2E] text-[#F5F3EB] rounded-lg p-2 text-center text-[9px] font-extrabold uppercase tracking-wider">
                      Secured Escrow Trade Active
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <span className="text-[9px] font-bold text-slate-400 uppercase text-left">Air Cargo Route</span>
                      <span className="text-[8px] font-extrabold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase">In Air</span>
                    </div>

                    <div className="h-28 bg-[#0E1A2E] rounded-xl overflow-hidden relative border border-[#D9A73A]/20 p-2 flex flex-col justify-between">
                      {/* Map lines */}
                      <div className="flex justify-between items-center">
                        <div className="text-left">
                          <p className="text-[7px] text-slate-400 font-bold">Origin</p>
                          <p className="text-[9px] text-white font-extrabold">Kano, NG</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[7px] text-slate-400 font-bold">Dest</p>
                          <p className="text-[9px] text-white font-extrabold">London, UK</p>
                        </div>
                      </div>

                      {/* Flight path curve */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                        <Smartphone className="w-16 h-16 text-[#D9A73A] rotate-45 animate-pulse" />
                      </div>

                      <div className="bg-[#D9A73A] text-[#0E1A2E] text-center text-[8px] font-extrabold rounded py-1 px-1 flex items-center justify-center gap-1">
                        <Zap className="w-2.5 h-2.5 fill-[#0E1A2E]" />
                        <span>FLIGHT CODE: AM-9921</span>
                      </div>
                    </div>

                    <div className="bg-white border border-slate-150 rounded-lg p-2.5 space-y-1 text-left">
                      <div className="flex justify-between text-[8px] text-slate-500 font-bold">
                        <span>EST. DELIVERY</span>
                        <span>4 hrs 15 mins</span>
                      </div>
                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#10B981] rounded-full" style={{ width: '60%' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Brand Watermark Badge */}
              <div className="flex items-center justify-center gap-1 bg-[#F5F3EB] rounded-xl py-1 text-[#0E1A2E] text-[8px] font-extrabold tracking-wider border border-[#D9A73A]/30">
                <span>© ABU MAFHAL ECOSYSTEM</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
export default HeroSection;
