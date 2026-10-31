import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import {
  Zap, ShieldCheck, CheckCircle2, Calculator, Calendar,
  CreditCard, ArrowRight, Sparkles, AlertCircle, ShoppingBag
} from 'lucide-react';

export default function PaySmallSmall() {
  const [purchaseAmount, setPurchaseAmount] = useState('150000');
  const [installments, setInstallments] = useState(4); // 2, 3, or 4

  const total = Number(purchaseAmount) || 0;
  const perInstallment = total > 0 ? Math.round(total / installments) : 0;
  const downPayment = perInstallment;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-12 w-full space-y-12">
        {/* Hero Section */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0A192F] via-[#112240] to-[#0A192F] text-white p-8 sm:p-14 shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[#D9A73A]/20 via-[#00BFA5]/20 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D9A73A]/20 border border-[#D9A73A]/30 text-[#D9A73A] text-xs font-extrabold uppercase tracking-widest">
              <Zap className="w-3.5 h-3.5 fill-current" />
              Abu Mafhal BNPL
            </div>

            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              Pay Small Small (PSS) — <br />
              <span className="text-[#00BFA5]">Zero Interest.</span> Split into 4.
            </h1>

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              Shop gadgets, fashion, phones, and home appliances today. Pay just 25% down, and the remaining balance is comfortably split over weekly or monthly installments.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-3">
              <Link
                to="/shop"
                className="px-6 py-3.5 rounded-2xl bg-[#00BFA5] hover:bg-[#00a896] text-white font-bold text-xs sm:text-sm shadow-lg shadow-[#00BFA5]/25 transition-all flex items-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                Shop Eligible Items
              </Link>
              <a
                href="#calculator"
                className="px-6 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs sm:text-sm transition-all"
              >
                Calculate Installments
              </a>
            </div>
          </div>
        </div>

        {/* 3 Step Process */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: '01',
              title: 'Select PSS at Checkout',
              desc: 'Choose Pay Small Small on eligible orders above ₦20,000 on abumafhal.com.',
              icon: ShoppingBag,
              color: 'text-[#00BFA5]',
              bg: 'bg-teal-50'
            },
            {
              step: '02',
              title: '25% Down Payment',
              desc: 'Pay your initial installment via Paystack or Flutterwave. Escrow vault locks the item immediately.',
              icon: CreditCard,
              color: 'text-[#D9A73A]',
              bg: 'bg-amber-50'
            },
            {
              step: '03',
              title: 'Zero Interest Balance',
              desc: 'Automatic scheduled debits with zero hidden fees. Track each payment live on your dashboard.',
              icon: ShieldCheck,
              color: 'text-indigo-600',
              bg: 'bg-indigo-50'
            }
          ].map(s => (
            <div key={s.step} className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className={`w-12 h-12 rounded-2xl ${s.bg} flex items-center justify-center ${s.color}`}>
                  <s.icon className="w-6 h-6" />
                </div>
                <span className="text-2xl font-black text-slate-300">{s.step}</span>
              </div>
              <h3 className="text-base font-extrabold text-[#0A192F]">{s.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Interactive PSS Calculator */}
        <div id="calculator" className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-[#D9A73A]">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-[#0A192F]">Interactive Installment Calculator</h2>
              <p className="text-xs text-slate-500">Estimate your payment breakdown before checking out.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            {/* Controls */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Cart Total Amount (₦)
                </label>
                <input
                  type="number"
                  value={purchaseAmount}
                  onChange={(e) => setPurchaseAmount(e.target.value)}
                  className="w-full text-lg font-bold px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#00BFA5]"
                  step="5000"
                  min="20000"
                />
                <div className="flex gap-2">
                  {[50000, 100000, 200000, 500000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPurchaseAmount(String(amt))}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold"
                    >
                      ₦{amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Number of Installments
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {[2, 3, 4].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setInstallments(n)}
                      className={`py-3 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                        installments === n
                          ? 'bg-[#0A192F] text-white border-[#0A192F] shadow-sm'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {n} Installments
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Breakdown Card */}
            <div className="p-6 sm:p-8 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-4">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#00BFA5]">
                Plan Breakdown
              </span>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-slate-200/60">
                  <span className="text-xs text-slate-600 font-medium">Down Payment Today (25%)</span>
                  <span className="text-sm font-extrabold text-[#0A192F]">₦{downPayment.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200/60">
                  <span className="text-xs text-slate-600 font-medium">Remaining Installments</span>
                  <span className="text-sm font-extrabold text-slate-800">{installments - 1} × ₦{perInstallment.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-200/60">
                  <span className="text-xs text-slate-600 font-medium">Interest & Hidden Charges</span>
                  <span className="text-sm font-extrabold text-emerald-600">₦0 (0% Interest)</span>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm font-extrabold text-[#0A192F]">Total Repayment</span>
                  <span className="text-xl font-black text-[#00BFA5]">₦{total.toLocaleString()}</span>
                </div>
              </div>

              <Link
                to="/shop"
                className="w-full mt-4 py-3.5 rounded-2xl bg-[#00BFA5] hover:bg-[#00a896] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-[#00BFA5]/20"
              >
                Start Shopping with PSS
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
