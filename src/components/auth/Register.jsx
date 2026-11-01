import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { triggerWelcomeEmail } from '../../utils/emailTriggers';
import {
  User, Mail, Phone, Lock, Eye, EyeOff, Loader2,
  ArrowRight, ShieldCheck, Gift, Globe, Sparkles
} from 'lucide-react';

const Register = () => {
  const [lang, setLang] = useState('en'); // 'en' | 'ha'
  const [searchParams] = useSearchParams();
  const urlRefCode = searchParams.get('ref') || searchParams.get('code');

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

  const { register } = useAuth();
  const navigate = useNavigate();

  // Translations matching mobile AuthPage
  const t = {
    en: {
      joinUs: 'Join Abu Mafhal 🚀',
      joinSub: 'Create an account to shop from verified stores across Nigeria.',
      signIn: 'Sign In',
      createAccount: 'Create Account',
      fullName: 'Full Name',
      fullNamePlaceholder: 'e.g. Aminu Bello',
      emailLabel: 'Email Address',
      emailPlaceholder: 'user@example.com',
      phoneLabel: 'Phone Number (WhatsApp & SMS)',
      phonePlaceholder: '08012345678',
      passwordLabel: 'Password',
      passwordPlaceholder: '••••••••',
      confirmPasswordLabel: 'Confirm Password',
      referralLabel: 'Referral Code (Optional)',
      referralPlaceholder: 'e.g. ABU-12345',
      referralReward: '🎁 ₦1,000 Welcome Voucher',
      termsAgree: 'I agree to the Terms of Service & Escrow Policy',
      createAccountBtn: 'Create Account',
      creating: 'Creating Account...',
      alreadyHaveAccount: 'Already have an account?',
      loginNow: 'Sign In Now',
      escrowSecured: '256-BIT SSL ENCRYPTED',
      officialApp: 'OFFICIAL APP'
    },
    ha: {
      joinUs: 'Shiga Abu Mafhal 🚀',
      joinSub: 'Buɗe asusu don cinikin kaya daga masu sayarwa a faɗin Najeriya.',
      signIn: 'Shiga Ciki',
      createAccount: 'Buɗe Asusu',
      fullName: 'Cikakken Suna',
      fullNamePlaceholder: 'Misali: Aminu Bello',
      emailLabel: 'Adireshin Email',
      emailPlaceholder: 'user@example.com',
      phoneLabel: 'Lambar Waya (WhatsApp & SMS)',
      phonePlaceholder: '08012345678',
      passwordLabel: 'Kalmar Sirri',
      passwordPlaceholder: '••••••••',
      confirmPasswordLabel: 'Maimaita Kalmar Sirri',
      referralLabel: 'Lambar Gayyata (Na Zaɓi)',
      referralPlaceholder: 'Misali: ABU-12345',
      referralReward: '🎁 Kyautar ₦1,000 Na Maraba',
      termsAgree: "Na amince da Ƙa'idojin Sabis da Tsaron Escrow",
      createAccountBtn: 'Buɗe Asusu',
      creating: 'Ana ƙirƙirar asusunka...',
      alreadyHaveAccount: 'Kana da asusu a baya?',
      loginNow: 'Shiga Ciki Yanzu',
      escrowSecured: 'TSARON 256-BIT SSL',
      officialApp: 'KASUWA TA GASKIYA'
    }
  }[lang];

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
      setError(lang === 'ha' ? 'Da fatan a cika dukkan bayanan da ake buƙata.' : 'Please fill in all required fields.');
      return;
    }

    if (formData.password.length < 6) {
      setError(lang === 'ha' ? 'Kalmar sirri dole ta kasance aƙalla haruffa 6.' : 'Password must contain at least 6 characters.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(lang === 'ha' ? 'Kalmomin sirri ba su yi daidai ba.' : 'Passwords do not match. Please verify.');
      return;
    }

    if (!agreedToTerms) {
      setError(lang === 'ha' ? "Da fatan a amince da ƙa'idojin sabis." : 'Please agree to the Terms of Service & Escrow Policy.');
      return;
    }

    setLoading(true);

    try {
      // 1. Check if email already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (existingUser) {
        setError(lang === 'ha' ? 'Wannan email din yana da asusu a baya. Da fatan a shiga kawai.' : 'An account with this email address already exists. Please sign in instead.');
        setLoading(false);
        return;
      }

      // 2. Direct account creation via Supabase Auth - strictly as Buyer
      const userCredential = await register(cleanEmail, formData.password, {
        name: cleanName,
        phone: cleanPhone,
        role: 'buyer'
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

      // 5. Successful registration routing directly to user profile/dashboard
      navigate('/profile', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070F1E] flex flex-col items-center justify-center px-4 py-8 selection:bg-[#D9A73A]/20 font-sans relative">
      {/* Subtle Navy-Gold Ambient Glows */}
      <div className="absolute top-0 right-1/4 w-[450px] h-[450px] bg-gradient-to-b from-[#D9A73A]/10 via-[#0E2A4D]/20 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[450px] h-[450px] bg-gradient-to-t from-emerald-500/10 via-[#0A192F]/20 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[460px] relative z-10 flex flex-col">
        {/* ── TOP NAV HEADER (MATCHING MOBILE TOP BAR) ── */}
        <div className="flex items-center justify-between pb-4">
          {/* Back to Home */}
          <Link
            to="/"
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            title="Back to Home"
          >
            ←
          </Link>

          {/* Central Compact Brand Badge (Fixed Compact Size matching mobile: 28-30px) */}
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src="/logo.png"
              alt="Abu Mafhal"
              className="w-7 h-7 object-contain rounded-lg group-hover:scale-105 transition-transform"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="flex flex-col">
              <span className="text-sm font-black text-white tracking-wider leading-none">
                ABU <span className="text-[#00D2FF]">MAFHAL</span>
              </span>
              <span className="text-[8px] font-bold text-white/50 uppercase tracking-widest mt-0.5">
                MARKETPLACE
              </span>
            </div>
          </Link>

          {/* Language Switcher Badge */}
          <button
            onClick={() => setLang(l => l === 'en' ? 'ha' : 'en')}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#00D2FF]/10 border border-[#00D2FF]/30 text-[#00D2FF] text-[10px] font-black cursor-pointer hover:bg-[#00D2FF]/20 transition-all"
          >
            <Globe className="w-3 h-3 text-[#00D2FF]" />
            <span>{lang === 'en' ? 'EN' : 'HA'}</span>
          </button>
        </div>

        {/* ── HERO BANNER CARD (Identical to Mobile s.heroBanner) ── */}
        <div className="rounded-2xl p-5 bg-gradient-to-br from-[#0A192F] via-[#0E2A4D] to-[#163E6D] border border-white/10 shadow-xl mb-4 text-white">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-[9px] font-black tracking-wider text-[#00BFA5]">
              <ShieldCheck className="w-3 h-3" />
              <span>{t.escrowSecured}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/10 text-[9px] font-black tracking-wider text-[#F59E0B]">
              <Sparkles className="w-3 h-3" />
              <span>{t.officialApp}</span>
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            {t.joinUs}
          </h1>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed font-normal">
            {t.joinSub}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── MAIN CARD CONTAINER (Matching Mobile s.cardContainer) ── */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4">
          {/* SEGMENTED SWITCH: SIGN IN vs CREATE ACCOUNT (Mobile s.segmentedContainer) */}
          <div className="flex bg-[#F1F5F9] rounded-xl p-1 border border-slate-200">
            <Link
              to="/login"
              className="flex-1 py-2.5 rounded-lg text-xs font-bold text-center text-slate-500 hover:text-[#0A192F] transition-all flex items-center justify-center gap-1.5"
            >
              <span>{t.signIn}</span>
            </Link>
            <button
              type="button"
              className="flex-1 py-2.5 rounded-lg text-xs font-black bg-[#D9A73A] text-[#0A192F] shadow-sm flex items-center justify-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>{t.createAccount}</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 pt-1">
            {/* FULL NAME */}
            <div className="space-y-1">
              <label className="block text-xs font-extrabold text-slate-800">
                {t.fullName}
              </label>
              <div className="relative flex items-center">
                <User className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder={t.fullNamePlaceholder}
                  className="w-full bg-[#F8FAFC] border-1.5 border-slate-200 focus:border-[#D9A73A] focus:bg-white rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-[#0A192F] placeholder-slate-400 outline-none transition-all font-semibold"
                />
              </div>
            </div>

            {/* EMAIL ADDRESS */}
            <div className="space-y-1">
              <label className="block text-xs font-extrabold text-slate-800">
                {t.emailLabel}
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder={t.emailPlaceholder}
                  className="w-full bg-[#F8FAFC] border-1.5 border-slate-200 focus:border-[#D9A73A] focus:bg-white rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-[#0A192F] placeholder-slate-400 outline-none transition-all font-semibold"
                />
              </div>
            </div>

            {/* PHONE NUMBER */}
            <div className="space-y-1">
              <label className="block text-xs font-extrabold text-slate-800">
                {t.phoneLabel}
              </label>
              <div className="relative flex items-center">
                <Phone className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder={t.phonePlaceholder}
                  className="w-full bg-[#F8FAFC] border-1.5 border-slate-200 focus:border-[#D9A73A] focus:bg-white rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-[#0A192F] placeholder-slate-400 outline-none transition-all font-semibold"
                />
              </div>
            </div>

            {/* PASSWORD & CONFIRM PASSWORD */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800">
                  {t.passwordLabel}
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder={t.passwordPlaceholder}
                    className="w-full bg-[#F8FAFC] border-1.5 border-slate-200 focus:border-[#D9A73A] focus:bg-white rounded-xl pl-9 pr-9 py-2.5 text-xs text-[#0A192F] placeholder-slate-400 outline-none transition-all font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800">
                  {t.confirmPasswordLabel}
                </label>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder={t.passwordPlaceholder}
                    className="w-full bg-[#F8FAFC] border-1.5 border-slate-200 focus:border-[#D9A73A] focus:bg-white rounded-xl pl-9 pr-9 py-2.5 text-xs text-[#0A192F] placeholder-slate-400 outline-none transition-all font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* REFERRAL CODE (OPTIONAL) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-extrabold text-slate-800">
                  {t.referralLabel}
                </label>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {t.referralReward}
                </span>
              </div>
              <div className="relative flex items-center">
                <Gift className="absolute left-3 w-4 h-4 text-amber-500 pointer-events-none" />
                <input
                  type="text"
                  name="referralCode"
                  value={formData.referralCode}
                  onChange={handleChange}
                  placeholder={t.referralPlaceholder}
                  className="w-full bg-[#F8FAFC] border-1.5 border-slate-200 focus:border-[#D9A73A] focus:bg-white rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-[#0A192F] placeholder-slate-400 outline-none transition-all font-semibold uppercase"
                />
              </div>
            </div>

            {/* TERMS AGREEMENT */}
            <div className="pt-1">
              <label className="flex items-start gap-2 cursor-pointer text-xs text-slate-600 font-medium">
                <input
                  type="checkbox"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#D9A73A] focus:ring-[#D9A73A] cursor-pointer"
                />
                <span>{t.termsAgree}</span>
              </label>
            </div>

            {/* PRIMARY NAVY & GOLD ACTION BUTTON */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3.5 rounded-xl bg-[#D9A73A] hover:bg-[#c9952a] text-[#0A192F] font-black text-sm tracking-wide shadow-md shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#0A192F]" />
                  <span>{t.creating}</span>
                </>
              ) : (
                <>
                  <span>{t.createAccountBtn}</span>
                  <ArrowRight className="w-4 h-4 text-[#0A192F]" />
                </>
              )}
            </button>
          </form>

          {/* Quick Footer Prompt */}
          <div className="pt-2 text-center text-xs text-slate-500 font-medium">
            <span>{t.alreadyHaveAccount} </span>
            <Link to="/login" className="font-black text-[#D9A73A] hover:underline">
              {t.loginNow}
            </Link>
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-5">
          <Link to="/" className="text-xs font-bold text-slate-400 hover:text-white transition-colors">
            ← Return to Abu Mafhal Marketplace
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;