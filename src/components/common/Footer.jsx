import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, Phone, MapPin, Facebook, Instagram, Twitter, MessageCircle,
  Send, ShieldCheck, Zap, Lock, Truck, RefreshCw, CheckCircle2,
  Download, ArrowRight, ExternalLink, Award
} from 'lucide-react';

export default function Footer() {
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setSubscribed(true);
    setTimeout(() => {
      setSubscribed(false);
      setNewsletterEmail('');
    }, 4000);
  };

  return (
    <footer className="bg-[#0A192F] text-slate-300 font-sans border-t border-slate-800">
      {/* ─── 1. TRUST BADGES STRIP ─── */}
      <div className="border-b border-slate-800/80 bg-[#112240]/60 py-6 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#00BFA5]/10 border border-[#00BFA5]/20 flex items-center justify-center text-[#00BFA5] shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">100% Escrow Vault</p>
              <p className="text-[11px] text-slate-400">Funds released upon inspection</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-[#D9A73A] shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">36 States Doorstep</p>
              <p className="text-[11px] text-slate-400">Live GPS tracking</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">7-Day Free Returns</p>
              <p className="text-[11px] text-slate-400">Dispute resolution guarantee</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">CBN-Licensed Gateways</p>
              <p className="text-[11px] text-slate-400">Paystack & Flutterwave 256-bit</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. MAIN FOOTER CONTENT ─── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand Info */}
          <div className="lg:col-span-2 space-y-4">
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Abu Mafhal" className="w-9 h-9 object-contain rounded-xl" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              <div>
                <span className="text-xl font-black text-white tracking-tight">ABU MAFHAL</span>
                <span className="block text-[10px] text-[#00BFA5] font-bold uppercase tracking-widest">Marketplace</span>
              </div>
            </Link>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Nigeria&apos;s premier multi-vendor marketplace connecting verified merchants across 36 states with buyers via bank-grade escrow protection and instant logistics.
            </p>

            <div className="pt-2 space-y-2 text-xs">
              <div className="flex items-center gap-2.5 text-slate-400">
                <MapPin className="w-4 h-4 text-[#00BFA5] shrink-0" />
                <span>Goni Aji Street, Gashua, Yobe State, Nigeria</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-400">
                <Phone className="w-4 h-4 text-[#00BFA5] shrink-0" />
                <a href="tel:+2348145853539" className="hover:text-white transition-colors">+234 814 585 3539</a>
              </div>
              <div className="flex items-center gap-2.5 text-slate-400">
                <Mail className="w-4 h-4 text-[#00BFA5] shrink-0" />
                <a href="mailto:support@abumafhal.com" className="hover:text-white transition-colors">support@abumafhal.com</a>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-2.5 pt-2">
              {[
                { icon: Facebook, href: '#' },
                { icon: Instagram, href: '#' },
                { icon: Twitter, href: '#' },
                { icon: MessageCircle, href: 'https://wa.me/2348145853539' }
              ].map((s, i) => (
                <a
                  key={i}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-[#00BFA5] hover:text-white text-slate-400 flex items-center justify-center transition-colors"
                >
                  <s.icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Marketplace</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/shop" className="hover:text-[#00BFA5] transition-colors">All Products</Link></li>
              <li><Link to="/stores" className="hover:text-[#00BFA5] transition-colors">Verified Merchant Stores</Link></li>
              <li><Link to="/pay-small-small" className="hover:text-[#D9A73A] transition-colors text-amber-400 font-semibold">Pay Small Small (PSS)</Link></li>
              <li><Link to="/track-order" className="hover:text-[#00BFA5] transition-colors">Track Consignment</Link></li>
              <li><Link to="/compare" className="hover:text-[#00BFA5] transition-colors">Compare Products</Link></li>
              <li><Link to="/cart" className="hover:text-[#00BFA5] transition-colors">Shopping Cart</Link></li>
            </ul>
          </div>

          {/* Trust & Policy */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Trust & Security</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/terms" className="hover:text-[#00BFA5] transition-colors">100% Escrow Protocol</Link></li>
              <li><Link to="/privacy" className="hover:text-[#00BFA5] transition-colors">Privacy & Data Protection</Link></li>
              <li><Link to="/terms" className="hover:text-[#00BFA5] transition-colors">Terms of Service</Link></li>
              <li><Link to="/vendor-application" className="hover:text-[#00BFA5] transition-colors text-emerald-400 font-bold">Become a Seller</Link></li>
              <li><Link to="/contact" className="hover:text-[#00BFA5] transition-colors">Customer Help Desk</Link></li>
            </ul>
          </div>

          {/* Newsletter Box */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">Get ₦2,500 Voucher</h4>
            <p className="text-xs text-slate-400">
              Subscribe to weekly deals, flash sales, and new arrivals directly in your inbox.
            </p>

            <form onSubmit={handleSubscribe} className="space-y-2">
              <input
                type="email"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter your email address..."
                className="w-full text-xs px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder:text-slate-500 focus:outline-none focus:border-[#00BFA5]"
                required
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#00BFA5] hover:bg-[#00a896] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                {subscribed ? '✓ Subscribed!' : 'Subscribe'}
              </button>
            </form>

            {subscribed && (
              <p className="text-[11px] text-emerald-400 font-bold">
                🎉 Welcome! Use code <span className="underline">ABUMAFHAL2500</span> at checkout.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. COPYRIGHT & DISCLAIMER ─── */}
      <div className="border-t border-slate-800/80 py-6 px-4 sm:px-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Abu Mafhal Marketplace Ltd. RC-1849204. All rights reserved.</p>
          <div className="flex items-center gap-4 text-[11px]">
            <span>Payments powered by Paystack & Flutterwave</span>
            <span>•</span>
            <span className="text-[#00BFA5] font-bold">abumafhal.com</span>
          </div>
        </div>
      </div>
    </footer>
  );
}