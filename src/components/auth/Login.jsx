import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { 
  Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck, 
  CheckCircle2, Sparkles, Building2, User, ChevronRight, Crown
} from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [detectedRole, setDetectedRole] = useState(null);
  const [redirecting, setRedirecting] = useState(false);
  const [settings, setSettings] = useState(null);

  const [searchParams] = useSearchParams();
  const redirectParam = searchParams.get('redirect') || searchParams.get('returnUrl');

  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setDetectedRole(null);
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter both your email address and password.');
      return;
    }

    setLoading(true);

    try {
      const userData = await login(cleanEmail, cleanPassword);
      if (userData) {
        const resolvedRole = (userData.role || 'buyer').toLowerCase();
        setDetectedRole(resolvedRole);
        setRedirecting(true);

        // Allow 900ms for user to see the role recognition feedback
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
        setError('Incorrect email address or password. Please try again.');
      } else {
        setError(msg);
      }
      setLoading(false);
      setRedirecting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col items-center justify-center px-4 py-12 selection:bg-[#00BFA5]/20 font-sans">
      {/* Light modern ambient mesh gradients */}
      <div className="absolute top-0 right-1/4 w-[550px] h-[550px] bg-gradient-to-b from-[#00BFA5]/10 via-teal-100/30 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse-slow" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-t from-amber-100/40 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-[480px] relative z-10">
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
            Welcome Back
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-1.5 font-medium max-w-sm mx-auto">
            Sign in to manage your verified orders, smart wallet, and multi-vendor dashboard
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/90 rounded-3xl p-6 sm:p-9 shadow-xl shadow-slate-200/60 relative overflow-hidden">
          {/* Segmented Switch */}
          <div className="flex bg-slate-100/90 rounded-2xl p-1.5 mb-6 border border-slate-200/60">
            <button
              type="button"
              className="flex-1 py-2.5 text-xs font-black rounded-xl bg-white text-[#0A192F] shadow-sm transition-all cursor-default flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00BFA5]" />
              <span>Sign In</span>
            </button>
            <Link
              to="/register"
              className="flex-1 py-2.5 text-xs font-bold text-center text-slate-500 hover:text-[#0A192F] rounded-xl transition-all"
            >
              Create Account
            </Link>
          </div>

          {/* Role Detected Notification Toast */}
          {redirecting && detectedRole && (
            <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-3 animate-in fade-in zoom-in-95 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                {detectedRole === 'admin' ? (
                  <Crown className="w-5 h-5 text-amber-600" />
                ) : detectedRole === 'vendor' ? (
                  <Building2 className="w-5 h-5 text-[#00BFA5]" />
                ) : (
                  <User className="w-5 h-5 text-blue-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-[#0A192F] font-extrabold capitalize">
                  {detectedRole === 'admin' ? 'Superadmin Authenticated' : detectedRole === 'vendor' ? 'Verified Merchant Authenticated' : 'Shopper Authenticated'}
                </p>
                <p className="text-[11px] text-emerald-700 font-medium">
                  {detectedRole === 'admin' ? 'Launching Admin Console...' : detectedRole === 'vendor' ? 'Opening Vendor Management Portal...' : 'Redirecting to your Buyer Hub...'}
                </p>
              </div>
              <Loader2 className="w-4 h-4 text-emerald-600 animate-spin shrink-0" />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-semibold flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 ml-1">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="name@example.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#00BFA5] focus:bg-white rounded-xl pl-10 pr-4 py-3 text-sm text-[#0A192F] placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#00BFA5]/10 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-xs font-bold text-slate-700">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-bold text-[#00BFA5] hover:text-[#008f80] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 focus:border-[#00BFA5] focus:bg-white rounded-xl pl-10 pr-12 py-3 text-sm text-[#0A192F] placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-[#00BFA5]/10 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1.5 text-slate-400 hover:text-slate-600 focus:outline-none rounded-lg"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Escrow Status */}
            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-600 hover:text-slate-900">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#00BFA5] focus:ring-[#00BFA5] cursor-pointer"
                />
                <span>Stay signed in</span>
              </label>
              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Escrow Vault Secured
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || redirecting}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-[#00BFA5] hover:bg-[#00a896] text-white font-extrabold py-3.5 rounded-xl transition-all shadow-lg shadow-[#00BFA5]/25 hover:shadow-[#00BFA5]/40 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-[0.98] cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin h-5 w-5 text-white" />
                  <span>Verifying Credentials...</span>
                </div>
              ) : (
                <>
                  <span>Sign In to Your Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Role Guidance Banner */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Automatic Role Routing
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span className="truncate font-bold text-slate-700">Merchants → Vendor Hub</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0A192F] shrink-0" />
                <span className="truncate font-bold text-slate-700">Buyers → Orders & Wallet</span>
              </div>
            </div>
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

export default Login;