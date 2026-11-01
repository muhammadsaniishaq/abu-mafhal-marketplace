import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { triggerWelcomeEmail } from '../../utils/emailTriggers';
import {
  User, Mail, Phone, Lock, Eye, EyeOff,
  Loader2, ArrowRight, ShieldCheck, Gift, CheckCircle2,
  Store, ShoppingBag, Sparkles
} from 'lucide-react';

const Register = () => {
  const [searchParams] = useSearchParams();
  const urlRefCode = searchParams.get('ref') || searchParams.get('code');

  const [accountType, setAccountType] = useState('buyer'); // 'buyer' | 'vendor'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    referralCode: urlRefCode || '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .single();
      if (data) setSettings(data);
    } catch (_) {}
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setError('');

    const cleanEmail = (formData.email || '').trim().toLowerCase();
    const cleanName = (formData.name || '').trim();
    const cleanPhone = (formData.phone || '').trim();

    if (!cleanName || !cleanEmail || !formData.password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match. Please verify.');
      return;
    }

    if (!agreedToTerms) {
      setError('Please agree to the Terms of Service & Escrow Policy.');
      return;
    }

    setLoading(true);

    try {
      // 1. Check if email already exists in profiles
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingUser) {
        setError('An account with this email address already exists. Please sign in instead.');
        setLoading(false);
        return;
      }

      // 2. Direct account creation via Supabase Auth
      const userCredential = await register(cleanEmail, formData.password, {
        name: cleanName,
        phone: cleanPhone,
        role: accountType
      });

      // 3. Send welcome email in background
      try {
        await triggerWelcomeEmail({
          name: cleanName,
          email: cleanEmail
        });
      } catch (_) {}

      // 4. Process referral code if provided
      if (formData.referralCode) {
        try {
          const { data: referrer } = await supabase
            .from('profiles')
            .select('id')
            .eq('referral_code', formData.referralCode.trim().toUpperCase())
            .maybeSingle();

          if (referrer && referrer.id !== userCredential?.id) {
            await supabase.rpc('process_referral_reward', {
              p_new_user_id: userCredential.id,
              p_referrer_id: referrer.id
            });
          }
        } catch (_) {}
      }

      // 5. Successful registration routing based on account type
      if (accountType === 'vendor') {
        navigate('/vendor-application', { replace: true });
      } else {
        navigate('/profile', { replace: true });
      }
    } catch (err) {
      console.error('Registration failed:', err);
      setError(err.message || 'Failed to create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col items-center justify-center px-4 py-12 selection:bg-[#00BFA5]/20 font-sans">
      {/* Light modern ambient mesh gradients */}
      <div className="absolute top-0 right-1/4 w-[550px] h-[550px] bg-gradient-to-b from-[#00BFA5]/10 via-teal-100/30 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-t from-amber-100/40 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[500px] relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-4 group">
            <div className="w-13 h-13 rounded-2xl bg-white border border-slate-200/80 p-2.5 flex items-center justify-center shadow-lg shadow-slate-200/50 group-hover:border-[#00BFA5] transition-all">
              <img
                src={settings?.logo_url || "/logo.png"}
                alt="Abu Mafhal"
                className="w-full h-full object-contain"
                onError={(e) => { e.target.src = "/logo.png"; }}
              />
            </div>
            <div className="text-left">
              <h2 className="text-xl font-black text-[#0A192F] tracking-wider flex items-center gap-1">
                ABU <span className="text-[#00BFA5]">MAFHAL</span>
              </h2>
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                Zero-Risk Verified Marketplace
              </p>
            </div>
          </Link>

          <h1 className="text-2xl sm:text-3xl font-black text-[#0A192F] tracking-tight">
            Create Your Account
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium max-w-sm mx-auto">
            Join 50,000+ shoppers and verified merchants across Nigeria
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-6 sm:p-9 shadow-xl shadow-slate-200/60 relative">
          {/* Sign In vs Register Switch */}
          <div className="flex bg-slate-100/90 rounded-2xl p-1.5 mb-6 border border-slate-200/60">
            <Link
              to="/login"
              className="flex-1 py-2.5 text-xs font-bold text-center text-slate-500 hover:text-[#0A192F] rounded-xl transition-all"
            >
              Sign In
            </Link>
            <button
              type="button"
              className="flex-1 py-2.5 text-xs font-black rounded-xl bg-white text-[#0A192F] shadow-sm transition-all cursor-default flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00BFA5]" />
              <span>Create Account</span>
            </button>
          </div>

          {/* Account Type Selector (Modern Elevated Cards) */}
          <div className="mb-6">
            <label className="block text-xs font-bold text-slate-700 mb-2 ml-1">
              Select Your Marketplace Role
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccountType('buyer')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                  accountType === 'buyer'
                    ? 'bg-emerald-50/70 border-[#00BFA5] shadow-sm ring-2 ring-[#00BFA5]/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accountType === 'buyer' ? 'bg-[#00BFA5] text-white' : 'bg-slate-200 text-slate-500'}`}>
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  {accountType === 'buyer' && <CheckCircle2 className="w-4 h-4 text-[#00BFA5]" />}
                </div>
                <div>
                  <span className="text-xs font-black text-[#0A192F] block">Buyer / Shopper</span>
                  <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">Shop with escrow protection</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccountType('vendor')}
                className={`p-3.5 rounded-2xl border text-left transition-all flex flex-col gap-1.5 cursor-pointer ${
                  accountType === 'vendor'
                    ? 'bg-amber-50/70 border-amber-500 shadow-sm ring-2 ring-amber-500/20'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100/60 text-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${accountType === 'vendor' ? 'bg-amber-500 text-slate-950' : 'bg-slate-200 text-slate-500'}`}>
                    <Store className="w-4 h-4" />
                  </div>
                  {accountType === 'vendor' && <CheckCircle2 className="w-4 h-4 text-amber-600" />}
                </div>
                <div>
                  <span className="text-xs font-black text-[#0A192F] block">Merchant / Seller</span>
                  <span className="text-[10px] text-slate-500 leading-tight block mt-0.5">Open store & receive payouts</span>
                </div>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                Full Name
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Aminu Bello"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#00BFA5] focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0A192F] placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#00BFA5]/10 transition-all font-medium"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  placeholder="user@example.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#00BFA5] focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0A192F] placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#00BFA5]/10 transition-all font-medium"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                Phone Number (WhatsApp & SMS)
              </label>
              <div className="relative flex items-center">
                <Phone className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="08012345678"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#00BFA5] focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0A192F] placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#00BFA5]/10 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                  Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#00BFA5] focus:bg-white rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#0A192F] placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#00BFA5]/10 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                  Confirm Password
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 focus:border-[#00BFA5] focus:bg-white rounded-xl pl-10 pr-10 py-2.5 text-sm text-[#0A192F] placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#00BFA5]/10 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Referral Code (Optional) with Bonus Tag */}
            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-xs font-bold text-slate-700">
                  Referral Code (Optional)
                </label>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                  <Gift className="w-3 h-3 text-emerald-600" /> ₦1,000 Welcome Reward
                </span>
              </div>
              <div className="relative flex items-center">
                <Gift className="absolute left-3.5 w-4 h-4 text-amber-500 pointer-events-none" />
                <input
                  type="text"
                  name="referralCode"
                  value={formData.referralCode}
                  onChange={handleChange}
                  placeholder="e.g. ABU-88210"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:bg-white rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#0A192F] placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-amber-500/10 transition-all font-medium uppercase"
                />
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-600 hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#00BFA5] focus:ring-[#00BFA5] cursor-pointer shrink-0"
                />
                <span>
                  I agree to the{' '}
                  <Link to="/terms" className="text-[#00BFA5] hover:underline font-bold">
                    Terms of Service
                  </Link>{' '}
                  and 100% Escrow Protection Policy.
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 flex items-center justify-center gap-2 bg-[#00BFA5] hover:bg-[#00a896] text-white font-extrabold py-3.5 rounded-xl transition-all shadow-lg shadow-[#00BFA5]/25 hover:shadow-[#00BFA5]/40 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-[0.98] cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin h-5 w-5 text-white" />
                  <span>Creating Your Account...</span>
                </div>
              ) : (
                <>
                  <span>
                    {accountType === 'vendor' ? 'Register Store & Start Selling' : 'Complete Registration'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Guarantee Strip */}
          <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>256-Bit SSL Encrypted • CBN-Compliant Escrow Protection</span>
          </div>
        </div>

        {/* Return to Marketplace */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-xs font-bold text-slate-500 hover:text-[#00BFA5] transition-colors inline-flex items-center gap-1.5"
          >
            ← Return to Abu Mafhal Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;