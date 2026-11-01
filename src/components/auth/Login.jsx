import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { 
  Mail, Phone, Lock, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, 
  Sparkles, CheckCircle2, ChevronRight, Globe
} from 'lucide-react';

const Login = () => {
  const [lang, setLang] = useState('en'); // 'en' | 'ha'
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' | 'phone'
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detectedRole, setDetectedRole] = useState(null);
  const [redirecting, setRedirecting] = useState(false);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState('');

  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect') || searchParams.get('returnUrl');

  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  // Translations matching mobile AuthPage
  const t = {
    en: {
      welcomeBack: 'Welcome Back 👋',
      welcomeSub: 'Sign in to access your orders, wallet and favourite stores.',
      signIn: 'Sign In',
      createAccount: 'Create Account',
      emailTab: 'Email Address',
      phoneTab: 'Phone Number',
      emailLabel: 'Email Address',
      emailPlaceholder: 'user@example.com',
      phoneLabel: 'Phone Number',
      phonePlaceholder: '08012345678',
      passwordLabel: 'Password',
      passwordPlaceholder: '••••••••',
      forgotPassword: 'Forgot Password?',
      rememberMe: 'Remember Me',
      escrowSecured: '256-BIT SSL ENCRYPTED',
      officialApp: 'OFFICIAL APP',
      signInBtn: 'Sign In',
      verifying: 'Verifying Credentials...',
      dontHaveAccount: "Don't have an account yet?",
      registerNow: 'Create an Account'
    },
    ha: {
      welcomeBack: 'Barka da Dawowa 👋',
      welcomeSub: 'Shiga don duba ododinka, asusunka da kuma amintattun shaguna.',
      signIn: 'Shiga Ciki',
      createAccount: 'Buɗe Asusu',
      emailTab: 'Adireshin Email',
      phoneTab: 'Lambar Waya',
      emailLabel: 'Adireshin Email',
      emailPlaceholder: 'user@example.com',
      phoneLabel: 'Lambar Waya',
      phonePlaceholder: '08012345678',
      passwordLabel: 'Kalmar Sirri',
      passwordPlaceholder: '••••••••',
      forgotPassword: 'Manta Kalmar Sirri?',
      rememberMe: 'Ka Tuna Dani',
      escrowSecured: 'TSARON 256-BIT SSL',
      officialApp: 'KASUWA TA GASKIYA',
      signInBtn: 'Shiga Ciki',
      verifying: 'Ana tantance bayanan ka...',
      dontHaveAccount: 'Ba ka da asusu tukuna?',
      registerNow: 'Buɗe Asusu Yanzu'
    }
  }[lang];

  // If already logged in, redirect based on their actual role
  useEffect(() => {
    if (currentUser) {
      const role = (currentUser.role || '').toLowerCase();
      if (redirectParam) {
        navigate(redirectParam, { replace: true });
      } else if (role === 'admin' || role === 'superadmin') {
        navigate('/admin', { replace: true });
      } else if (role === 'vendor') {
        navigate('/vendor', { replace: true });
      } else {
        navigate('/profile', { replace: true });
      }
    }
  }, [currentUser, navigate, redirectParam]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setDetectedRole(null);
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      setError(lang === 'ha' ? 'Da fatan za a shigar da email da kalmar sirri.' : 'Please enter both your email address and password.');
      return;
    }

    setLoading(true);

    try {
      const userData = await login(cleanEmail, cleanPassword);
      if (userData) {
        const resolvedRole = (userData.role || 'buyer').toLowerCase();
        setDetectedRole(resolvedRole);
        setRedirecting(true);

        setTimeout(() => {
          if (redirectParam) {
            navigate(redirectParam, { replace: true });
          } else if (resolvedRole === 'admin' || resolvedRole === 'superadmin') {
            navigate('/admin', { replace: true });
          } else if (resolvedRole === 'vendor') {
            navigate('/vendor', { replace: true });
          } else if (resolvedRole === 'driver') {
            navigate('/track-order', { replace: true });
          } else {
            navigate('/profile', { replace: true });
          }
        }, 900);
      }
    } catch (err) {
      const msg = err.message || 'Failed to sign in. Please verify your credentials.';
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setError(lang === 'ha' ? 'Email ko kalmar sirri ba daidai ba ne. Da fatan a sake gwadawa.' : 'Incorrect email address or password. Please try again.');
      } else {
        setError(msg);
      }
      setLoading(false);
      setRedirecting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    setForgotSuccess('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase());
      if (error) throw error;
      setForgotSuccess(lang === 'ha' ? 'An tura hanyar sauya kalmar sirri zuwa email dinka!' : 'Password reset instructions sent to your email.');
    } catch (err) {
      setError(err.message || 'Could not send reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070F1E] flex flex-col items-center justify-center px-4 py-8 selection:bg-[#D9A73A]/20 font-sans relative">
      {/* Subtle Navy-Gold Ambient Glows */}
      <div className="absolute top-0 right-1/4 w-[450px] h-[450px] bg-gradient-to-b from-[#D9A73A]/10 via-[#0E2A4D]/20 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-[450px] h-[450px] bg-gradient-to-t from-emerald-500/10 via-[#0A192F]/20 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-100">
            <h3 className="text-base font-black text-[#0A192F]">Reset Password</h3>
            <p className="text-xs text-slate-500">
              Enter your email address and we will send you a password reset link.
            </p>
            {forgotSuccess ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl">
                {forgotSuccess}
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-[#D9A73A]"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="px-5 py-2 rounded-xl bg-[#D9A73A] text-[#0A192F] text-xs font-black hover:bg-[#e5b347]"
                  >
                    {forgotLoading ? 'Sending...' : 'Send Link'}
                  </button>
                </div>
              </form>
            )}
            {forgotSuccess && (
              <button
                onClick={() => setShowForgotModal(false)}
                className="w-full py-2 rounded-xl bg-[#0A192F] text-white text-xs font-bold"
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

      <div className="w-full max-w-[440px] relative z-10 flex flex-col">
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
            {t.welcomeBack}
          </h1>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed font-normal">
            {t.welcomeSub}
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Role Recognition Banner */}
        {redirecting && detectedRole && (
          <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Welcome back! Redirecting to your dashboard...</span>
            </div>
            <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
          </div>
        )}

        {/* ── MAIN CARD CONTAINER (Matching Mobile s.cardContainer) ── */}
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4">
          {/* SEGMENTED SWITCH: SIGN IN vs CREATE ACCOUNT (Mobile s.segmentedContainer) */}
          <div className="flex bg-[#F1F5F9] rounded-xl p-1 border border-slate-200">
            <button
              type="button"
              className="flex-1 py-2.5 rounded-lg text-xs font-black bg-[#D9A73A] text-[#0A192F] shadow-sm flex items-center justify-center gap-1.5 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>{t.signIn}</span>
            </button>
            <Link
              to="/register"
              className="flex-1 py-2.5 rounded-lg text-xs font-bold text-center text-slate-500 hover:text-[#0A192F] transition-all flex items-center justify-center gap-1.5"
            >
              <span>{t.createAccount}</span>
            </Link>
          </div>

          {/* METHOD TABS: EMAIL vs PHONE (Mobile s.methodTabsRow) */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLoginMethod('email')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                loginMethod === 'email'
                  ? 'bg-emerald-50 border-[#00BFA5] text-[#00BFA5] font-black'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{t.emailTab}</span>
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod('phone')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                loginMethod === 'phone'
                  ? 'bg-emerald-50 border-[#00BFA5] text-[#00BFA5] font-black'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>{t.phoneTab}</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
            {/* EMAIL OR PHONE INPUT */}
            {loginMethod === 'email' ? (
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800">
                  {t.emailLabel}
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder={t.emailPlaceholder}
                    className="w-full bg-[#F8FAFC] border-1.5 border-slate-200 focus:border-[#D9A73A] focus:bg-white rounded-xl pl-9 pr-4 py-2.5 text-xs sm:text-sm text-[#0A192F] placeholder-slate-400 outline-none transition-all font-semibold"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-xs font-extrabold text-slate-800">
                  {t.phoneLabel}
                </label>
                <div className="flex items-center bg-[#F8FAFC] border-1.5 border-slate-200 focus-within:border-[#D9A73A] focus-within:bg-white rounded-xl overflow-hidden px-3 py-1 transition-all">
                  <div className="flex items-center gap-1 pr-2.5 mr-2 border-r border-slate-300 shrink-0 text-xs font-black text-slate-800">
                    <span>🇳🇬</span>
                    <span>+234</span>
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setEmail(`${e.target.value.trim()}@phone.abumafhal.com`);
                    }}
                    placeholder={t.phonePlaceholder}
                    className="w-full bg-transparent text-xs sm:text-sm text-[#0A192F] placeholder-slate-400 outline-none font-semibold py-1.5"
                  />
                </div>
              </div>
            )}

            {/* PASSWORD INPUT */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-extrabold text-slate-800">
                  {t.passwordLabel}
                </label>
                <button
                  type="button"
                  onClick={() => { setForgotEmail(email); setShowForgotModal(true); }}
                  className="text-[11px] font-black text-[#D9A73A] hover:underline"
                >
                  {t.forgotPassword}
                </button>
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t.passwordPlaceholder}
                  className="w-full bg-[#F8FAFC] border-1.5 border-slate-200 focus:border-[#D9A73A] focus:bg-white rounded-xl pl-9 pr-10 py-2.5 text-xs sm:text-sm text-[#0A192F] placeholder-slate-400 outline-none transition-all font-semibold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* REMEMBER ME & ESCROW VAULT SECURED */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#D9A73A] focus:ring-[#D9A73A]"
                />
                <span>{t.rememberMe}</span>
              </label>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Escrow Safe</span>
              </div>
            </div>

            {/* PRIMARY NAVY & GOLD ACTION BUTTON (Matching Mobile s.primaryBtn) */}
            <button
              type="submit"
              disabled={loading || redirecting}
              className="w-full mt-2 py-3.5 rounded-xl bg-[#D9A73A] hover:bg-[#c9952a] text-[#0A192F] font-black text-sm tracking-wide shadow-md shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#0A192F]" />
                  <span>{t.verifying}</span>
                </>
              ) : (
                <>
                  <span>{t.signInBtn}</span>
                  <ArrowRight className="w-4 h-4 text-[#0A192F]" />
                </>
              )}
            </button>
          </form>

          {/* Quick Footer Prompt */}
          <div className="pt-2 text-center text-xs text-slate-500 font-medium">
            <span>{t.dontHaveAccount} </span>
            <Link to="/register" className="font-black text-[#D9A73A] hover:underline">
              {t.registerNow}
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

export default Login;