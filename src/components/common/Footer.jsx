import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Instagram, Twitter, MessageCircle, Send, ShieldCheck, Zap } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-slate-100">
      {/* Top separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-blue-600/30 to-transparent" />

      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg">
                A
              </div>
              <span className="text-xl font-black text-slate-900 tracking-tighter">ABU MAFHAL</span>
            </div>
            <p className="text-slate-500 leading-relaxed font-medium text-sm">
              Nigeria's premier multi-vendor marketplace — connecting elite sellers with a global audience through AI-driven logistics.
            </p>
            <div className="flex gap-3">
              {[Facebook, Instagram, Twitter, MessageCircle].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all"
                >
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Explore */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-8">Explore</h3>
            <ul className="space-y-4">
              {[
                { label: 'Shop Elite', path: '/shop' },
                { label: 'Become a Vendor', path: '/vendor-application' },
                { label: 'Global Logistics', path: '/shop' },
                { label: 'AI Support', path: '/contact' },
              ].map((link, i) => (
                <li key={i}>
                  <Link
                    to={link.path}
                    className="text-sm text-slate-500 hover:text-slate-900 transition-colors font-bold flex items-center gap-2 group"
                  >
                    <span className="h-px w-0 group-hover:w-4 bg-blue-600 transition-all rounded-full" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-8">Company</h3>
            <ul className="space-y-4">
              {[
                { label: 'About the Founder', path: '/about' },
                { label: 'Privacy Policy', path: '/privacy' },
                { label: 'Terms of Service', path: '/terms' },
                { label: 'Help Center', path: '/contact' },
              ].map((link, i) => (
                <li key={i}>
                  <Link
                    to={link.path}
                    className="text-sm text-slate-500 hover:text-slate-900 transition-colors font-bold flex items-center gap-2 group"
                  >
                    <span className="h-px w-0 group-hover:w-4 bg-blue-600 transition-all rounded-full" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-600">Contact</h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3 text-slate-500">
                <Mail className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium">support@abumafhal.com</span>
              </div>
              <div className="flex items-start gap-3 text-slate-500">
                <Phone className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium">+234 814 585 3539</span>
              </div>
              <div className="flex items-start gap-3 text-slate-500">
                <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm font-medium">Goni Aji Street, Gashua, Yobe State, Nigeria</span>
              </div>
            </div>
            {/* Security badge */}
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <ShieldCheck className="text-blue-600 w-7 h-7 flex-shrink-0" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-blue-600">Secure Platform</p>
                <p className="text-xs font-bold text-slate-500 mt-0.5">SSL 256-bit Encrypted</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="space-y-1 text-center md:text-left">
            <p className="text-sm font-bold text-slate-400">
              © {new Date().getFullYear()} Abu Mafhal Marketplace. Built for the Elite.
            </p>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">
              Lagos · Kano · Abuja · Worldwide
            </p>
          </div>
          <div className="flex items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="flex items-center gap-2 hover:text-blue-600 transition-colors"
            >
              <Zap className="w-3 h-3 text-yellow-500" /> Back to Top
            </button>
            <span className="text-slate-200">V 2.1.2-ELITE</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;