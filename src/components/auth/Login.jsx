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
    <div className="min-h-screen bg-[#070F1E] relative overflow-hidden flex flex-col items-center justify-center px-4 py-10 selection:bg-amber-400 selection:text-slate-900 font-sans">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[450px] bg-[#00BFA5]/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[450px] h-[350px] bg-[#D9A73A]/10 rounded-full blur-[110px] pointer-events-none" />

      <div className="w-full max-w-[460px] relative z-10">
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
            Welcome Back <span className="animate-pulse">👋</span>
          </h1>
          <p className="text-slate-400 text-xs mt-1 font-medium">
            Sign in to access your orders, wallet, stores, and dashboard
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-[#0D1A30]/85 backdrop-blur-2xl border border-slate-700/70 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/50 relative overflow-hidden">
          {/* Segmented Switch */}
          <div className="flex bg-[#070F1E] rounded-2xl p-1.5 mb-6 border border-slate-700/60">
            <button
              type="button"
              className="flex-1 py-2 text-xs font-black rounded-xl bg-gradient-to-r from-[#D9A73A] to-amber-500 text-slate-950 shadow-md transition-all cursor-default"
            >
              Sign In
            </button>
            <Link
              to="/register"
              className="flex-1 py-2 text-xs font-bold text-center text-slate-400 hover:text-white rounded-xl transition-all"
            >
              Create Account
            </Link>
          </div>

          {/* Role Detected Notification Toast */}
          {redirecting && detectedRole && (
            <div className="mb-5 p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-3 animate-fade-in shadow-lg">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                {detectedRole === 'admin' ? (
                  <Crown className="w-5 h-5 text-[#D9A73A]" />
                ) : detectedRole === 'vendor' ? (
                  <Building2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <User className="w-5 h-5 text-[#00BFA5]" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-white font-extrabold capitalize">
                  {detectedRole === 'admin' ? 'Superadmin Authenticated' : detectedRole === 'vendor' ? 'Verified Merchant Authenticated' : 'Buyer Authenticated'}
                </p>
                <p className="text-[11px] text-emerald-300 font-medium">
                  {detectedRole === 'admin' ? 'Redirecting to Admin Control Console...' : detectedRole === 'vendor' ? 'Redirecting to Vendor Hub...' : 'Redirecting to Marketplace Profile...'}
                </p>
              </div>
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin shrink-0" />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-300 text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 ml-1">
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
                  className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-[#00BFA5] rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00BFA5]/20 transition-all font-medium"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="block text-xs font-bold text-slate-300">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-bold text-[#00BFA5] hover:text-[#00d2ff] hover:underline"
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
                  className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-[#00BFA5] rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00BFA5]/20 transition-all font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1 text-slate-400 hover:text-white focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-[#070F1E] text-[#00BFA5] focus:ring-0 cursor-pointer"
                />
                <span>Stay signed in</span>
              </label>
              <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                <ShieldCheck className="w-3.5 h-3.5 text-[#00BFA5]" /> Escrow Secured
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || redirecting}
              className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-[#D9A73A] to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-[0.98] cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin h-5 w-5 text-slate-950" />
                  <span>Verifying Credentials...</span>
                </div>
              ) : (
                <>
                  <span>Sign In & Enter Marketplace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Role Guidance Banner */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
              Role-Aware Sign In
            </p>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
              <div className="p-2 rounded-xl bg-[#070F1E] border border-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="truncate font-semibold text-slate-300">Merchants auto-open Vendor Hub</span>
              </div>
              <div className="p-2 rounded-xl bg-[#070F1E] border border-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="truncate font-semibold text-slate-300">Admins auto-open Console</span>
              </div>
            </div>
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

export default Login;