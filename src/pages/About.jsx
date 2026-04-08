import React from 'react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import { Target, Eye, Heart, Rocket, Users, Award, Shield, Globe, Cpu, Zap } from 'lucide-react';

const About = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 transition-colors">
      <Navbar />

      {/* Hero Section */}
      <div className="relative overflow-hidden pt-24 pb-16 lg:pt-32 lg:pb-24">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-100/20 via-transparent to-transparent dark:from-blue-900/10" />
        <div className="max-w-7xl mx-auto px-4 relative">
          <div className="text-center max-w-3xl mx-auto space-y-6">
            <h1 className="text-5xl lg:text-7xl font-black text-gray-900 dark:text-white tracking-tighter leading-tight">
              Bridging Dreams to <span className="text-blue-600">Reality</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 font-medium leading-relaxed">
              Abu Mafhal isn't just a marketplace. It's a technological bridge connecting the rich potential of Nigerian vendors with a global elite audience.
            </p>
          </div>
        </div>
      </div>

      {/* Founder Section */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="bg-white dark:bg-gray-900 rounded-[3rem] shadow-2xl overflow-hidden border border-white/20 dark:border-gray-800">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="relative h-[600px] lg:h-full group">
              <img 
                src="/founder.png" 
                alt="Abu Mafhal Founder" 
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-blue-600 via-transparent to-transparent opacity-10" />
               <div className="absolute bottom-10 left-10 text-white drop-shadow-lg">
                <p className="text-sm font-black uppercase tracking-widest mb-1 text-blue-400">The Architect</p>
                <h2 className="text-4xl font-black tracking-tight">Muhammad Sani Ishaq</h2>
              </div>
            </div>
            <div className="p-10 lg:p-20 space-y-10">
              <div className="inline-flex items-center gap-2 px-6 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-full border border-blue-100 dark:border-blue-800">
                <Rocket className="w-4 h-4 text-blue-600 animate-bounce" />
                <span className="text-xs font-black uppercase tracking-widest text-blue-600">Established 2024</span>
              </div>
              <h3 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter leading-tight">Empowering Africa's <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">Elite Vendors.</span></h3>
              <div className="space-y-6 text-gray-600 dark:text-gray-400 font-medium text-xl leading-relaxed">
                <p>
                  My vision was never just a marketplace. It was a bridge—built on the pillars of extreme reliability, advanced AI, and the unmatched entrepreneurial spirit of the North.
                </p>
                <p>
                  Today, Abu Mafhal stands as a beacon of digital transformation, proving that when trust is your currency, scaling has no limits.
                </p>
              </div>
              <div className="pt-8 flex flex-wrap gap-16">
                <div className="text-center md:text-left">
                  <p className="text-4xl font-black text-blue-600">12k+</p>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mt-2">Active Users</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-4xl font-black text-blue-600">750+</p>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mt-2">Elite Partners</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-4xl font-black text-blue-600">99%</p>
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest mt-2">SLA Uptime</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: Interactive Philosophy Pillars */}
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { 
              title: "Our Vision", 
              desc: "To be the heartbeat of African trade, where every transaction is a bridge to prosperity.", 
              icon: Eye, 
              color: "blue" 
            },
            { 
              title: "Our Mission", 
              desc: "Empowering elite vendors with AI-driven tools that redefine logistics and scale limits.", 
              icon: Target, 
              color: "indigo" 
            },
            { 
              title: "Our Values", 
              desc: "Integrity first, reliability always. We build ecosystems that stand the test of time.", 
              icon: Heart, 
              color: "rose" 
            }
          ].map((pillar, i) => (
            <div key={i} className="group p-10 rounded-[3rem] bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-xl hover:shadow-2xl hover:-translate-y-4 transition-all duration-500 overflow-hidden relative">
              <div className={`absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-bl-[5rem] -mr-8 -mt-8 group-hover:w-40 group-hover:h-40 transition-all`} />
              <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-8 border border-blue-100 dark:border-blue-800">
                <pillar.icon className="w-8 h-8 text-blue-600" />
              </div>
              <h4 className="text-2xl font-black text-gray-900 dark:text-white mb-4 uppercase tracking-tighter">{pillar.title}</h4>
              <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed">{pillar.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* NEW: Enhanced Roadmap */}
      <div className="bg-white dark:bg-gray-950 py-32 overflow-hidden border-y border-gray-100 dark:border-gray-900">
        <div className="max-w-7xl mx-auto px-4 text-center">
            <span className="text-blue-600 font-black tracking-[0.4em] text-xs uppercase block mb-4">Discovery Phase</span>
            <h2 className="text-6xl font-black text-gray-900 dark:text-white tracking-tighter uppercase italic mb-20">The Evolution</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
              {[
                { year: "2024", phase: "Alpha", title: "The Inception", desc: "Northern Nigeria's first multi-vendor bridge launched." },
                { year: "2025", phase: "Scaling", title: "AI Integration", desc: "Launched predictive logs & regional analytics." },
                { year: "2026", phase: "Expansion", title: "Global Access", desc: "Connecting local vendors to West African trade corridors." },
                { year: "2027", phase: "Vision", title: "Autonomous VC", desc: "Full decentralised vendor governance ecosystem." },
              ].map((item, i) => (
                <div key={i} className="p-8 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-[2.5rem] relative overflow-hidden group hover:bg-blue-600 transition-all duration-700">
                   <div className="text-9xl font-black absolute -bottom-10 -right-10 text-gray-100 dark:text-gray-800 opacity-20 group-hover:text-white group-hover:opacity-10 transition-all italic">{i+1}</div>
                   <div className="relative z-10">
                     <div className="font-black text-xs text-blue-600 group-hover:text-blue-200 mb-2 uppercase tracking-widest">{item.year} • {item.phase}</div>
                     <h4 className="text-2xl font-black text-gray-900 dark:text-white group-hover:text-white mb-4 uppercase tracking-tighter">{item.title}</h4>
                     <p className="text-gray-500 dark:text-gray-400 group-hover:text-blue-100 font-medium leading-relaxed">{item.desc}</p>
                   </div>
                </div>
              ))}
            </div>
        </div>
      </div>

      {/* Testimonials */}
      <div className="bg-slate-100 dark:bg-gray-900/50 py-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Trusted by Visionaries</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-4 font-medium">Real stories from our elite community.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { name: "Alhaji Ibrahim", role: "Premium Vendor", text: "Abu Mafhal transformed my traditional business into a global brand. The AI tools are unparalleled." },
              { name: "Sadiya Yusuf", role: "Verified Buyer", text: "Finally, a marketplace where trust and speed are the priorities. The logistics are incredibly reliable." },
              { name: "Engr. Bello", role: "Logistics Partner", text: "Being part of this ecosystem has streamlined our operation. The UI is clean, and the support is 24/7." },
            ].map((t, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 p-8 rounded-[2rem] border border-gray-100 dark:border-gray-800 shadow-lg italic">
                <div className="flex gap-1 text-yellow-500 mb-6">
                  {[...Array(5)].map((_, i) => <Award key={i} className="w-4 h-4" />)}
                </div>
                <p className="text-gray-700 dark:text-gray-300 font-medium leading-relaxed mb-6">"{t.text}"</p>
                <div className="flex items-center gap-4 not-italic">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center text-blue-600 font-black">
                    {t.name[0]}
                  </div>
                  <div>
                    <h5 className="font-black text-gray-900 dark:text-white">{t.name}</h5>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* NEW: App Download CTA - Futuristic Section */}
      <div className="max-w-7xl mx-auto px-4 py-32">
        <div className="relative bg-blue-600 rounded-[4rem] overflow-hidden shadow-2xl p-12 md:p-24">
          {/* Abstract Decorations */}
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <Globe className="w-full h-full scale-150 -translate-y-1/2" />
          </div>
          
          <div className="relative z-10 flex flex-col items-center text-center space-y-8 max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-md rounded-full border border-white/30 text-white">
              <Zap className="w-4 h-4 fill-white" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">The Elite App</span>
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-white tracking-tighter leading-tight">
              Trade Anywhere. <br />Scale Faster.
            </h2>
            <p className="text-blue-50 text-xl font-medium max-w-xl">
              Take the Abu Mafhal ecosystem in your pocket. Real-time AI logs, instant secure payments, and elite support at your fingertips.
            </p>
            <div className="flex flex-wrap justify-center gap-6 pt-8">
              <button className="bg-white text-blue-600 px-10 py-5 rounded-3xl font-black text-lg shadow-xl hover:scale-105 transition-transform flex items-center gap-4 group">
                Download for iOS
                <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Rocket className="w-4 h-4" />
                </div>
              </button>
              <button className="bg-blue-700 text-white border border-blue-500/30 px-10 py-5 rounded-3xl font-black text-lg shadow-xl hover:scale-105 transition-transform flex items-center gap-4 group">
                Download for Android
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center group-hover:bg-white group-hover:text-blue-600 transition-colors">
                  <Rocket className="w-4 h-4" />
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default About;