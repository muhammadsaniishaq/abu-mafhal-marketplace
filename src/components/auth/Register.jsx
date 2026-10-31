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
    <div className="min-h-screen bg-[#070F1E] relative overflow-hidden flex flex-col items-center justify-center px-4 py-10 selection:bg-amber-400 selection:text-slate-900 font-sans">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-[#00BFA5]/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[450px] h-[350px] bg-[#D9A73A]/10 rounded-full blur-[110px] pointer-events-none" />

      <div className="w-full max-w-[480px] relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-7">
          <Link to="/" className="inline-flex items-center gap-3 mb-4 group">
            <div className="w-13 h-13 rounded-2xl bg-white/5 border border-white/10 p-2.5 flex items-center justify-center backdrop-blur-md shadow-xl group-hover:border-[#D9A73A]/50 transition-colors">
              <img
                src={settings?.logo_url || "/logo.png"}
                alt="Abu Mafhal"
                className="w-full h-full object-contain"
                onError={(e) => { e.target.src = "/logo.png"; }}
              />
            </div>
            <div className="text-left">
              <h2 className="text-xl font-black text-white tracking-wider flex items-center gap-1">
                ABU <span className="text-[#00BFA5]">MAFHAL</span>
              </h2>
              <p className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">
                Your Marketplace, Your Choice.
              </p>
            </div>
          </Link>

          <h1 className="text-2xl font-black text-white mt-1 flex items-center justify-center gap-2">
            Create Account <span className="text-[#D9A73A]">🚀</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-medium">
            Join thousands of buyers & verified merchants across Nigeria
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-[#0D1A30]/85 backdrop-blur-2xl border border-slate-700/70 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50">
          {/* Sign In vs Register Switch */}
          <div className="flex bg-[#070F1E] rounded-2xl p-1.5 mb-5 border border-slate-700/60">
            <Link
              to="/login"
              className="flex-1 py-2 text-xs font-bold text-center text-slate-400 hover:text-white rounded-xl transition-all"
            >
              Sign In
            </Link>
            <button
              type="button"
              className="flex-1 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-[#D9A73A] to-amber-500 text-slate-950 shadow-md transition-all cursor-default"
            >
              Create Account
            </button>
          </div>

          {/* Account Type Selector (Matching Mobile) */}
          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-300 mb-2 ml-1">
              Select Account Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccountType('buyer')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                  accountType === 'buyer'
                    ? 'bg-[#00BFA5]/15 border-[#00BFA5] text-white shadow-md'
                    : 'bg-[#070F1E] border-slate-750 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <ShoppingBag className={`w-4 h-4 ${accountType === 'buyer' ? 'text-[#00BFA5]' : 'text-slate-400'}`} />
                  {accountType === 'buyer' && <CheckCircle2 className="w-3.5 h-3.5 text-[#00BFA5]" />}
                </div>
                <span className="text-xs font-bold text-white mt-1">Buyer / Shopper</span>
                <span className="text-[10px] text-slate-400 leading-tight">Shop & track orders with escrow</span>
              </button>

              <button
                type="button"
                onClick={() => setAccountType('vendor')}
                className={`p-3 rounded-2xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${
                  accountType === 'vendor'
                    ? 'bg-[#D9A73A]/15 border-[#D9A73A] text-white shadow-md'
                    : 'bg-[#070F1E] border-slate-750 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Store className={`w-4 h-4 ${accountType === 'vendor' ? 'text-[#D9A73A]' : 'text-slate-400'}`} />
                  {accountType === 'vendor' && <CheckCircle2 className="w-3.5 h-3.5 text-[#D9A73A]" />}
                </div>
                <span className="text-xs font-bold text-white mt-1">Merchant / Seller</span>
                <span className="text-[10px] text-slate-400 leading-tight">Sell items & receive payouts</span>
              </button>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 ml-1">
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
                  className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-[#00BFA5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00BFA5]/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 ml-1">
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
                  className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-[#00BFA5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00BFA5]/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 ml-1">
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
                  className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-[#00BFA5] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00BFA5]/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 ml-1">
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
                    className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-[#00BFA5] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00BFA5]/20 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 p-1 text-slate-400 hover:text-white focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5 ml-1">
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
                    className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-[#00BFA5] rounded-xl pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00BFA5]/20 transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 p-1 text-slate-400 hover:text-white focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Referral Code (Optional) with Bonus Tag */}
            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-xs font-bold text-slate-300">
                  Referral Code (Optional)
                </label>
                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1">
                  <Gift className="w-3 h-3" /> ₦1,000 Welcome Bonus
                </span>
              </div>
              <div className="relative flex items-center">
                <Gift className="absolute left-3.5 w-4 h-4 text-[#D9A73A] pointer-events-none" />
                <input
                  type="text"
                  name="referralCode"
                  value={formData.referralCode}
                  onChange={handleChange}
                  placeholder="e.g. ABU-88210"
                  className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-[#D9A73A] rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#D9A73A]/20 transition-all font-medium uppercase"
                />
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="pt-1">
              <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-[#070F1E] text-[#00BFA5] focus:ring-0 cursor-pointer shrink-0"
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
              className="w-full mt-3 flex items-center justify-center gap-2 bg-gradient-to-r from-[#D9A73A] to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-[0.98] cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin h-5 w-5 text-slate-950" />
                  <span>Creating Your Account...</span>
                </div>
              ) : (
                <>
                  <span>
                    {accountType === 'vendor' ? 'Register as Merchant Store' : 'Complete Registration'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security Guarantee Strip */}
          <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>256-Bit SSL Encrypted • CBN-Compliant Escrow Protection</span>
          </div>
        </div>

        {/* Return to Marketplace */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-xs font-bold text-slate-400 hover:text-[#00BFA5] transition-colors inline-flex items-center gap-1.5"
          >
            ← Return to Abu Mafhal Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;