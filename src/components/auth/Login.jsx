import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      navigate('/', { replace: true });
    }
  }, [currentUser, navigate]);

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
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter both your email and password.');
      return;
    }

    setLoading(true);

    try {
      const userData = await login(cleanEmail, cleanPassword);
      if (userData) {
        navigate('/', { replace: true });
      }
    } catch (err) {
      const msg = err.message || 'Failed to login. Please check your credentials.';
      if (msg.toLowerCase().includes('invalid login credentials')) {
        setError('Incorrect email address or password. Please try again.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070F1E] relative overflow-hidden flex flex-col items-center justify-center px-4 py-10 selection:bg-amber-400 selection:text-slate-900">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[400px] h-[300px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[440px] relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 mb-4 group">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 p-2 flex items-center justify-center backdrop-blur-md shadow-lg group-hover:border-amber-400/40 transition-colors">
              <img
                src={settings?.logo_url || "/logo.png"}
                alt="Abu Mafhal"
                className="w-full h-full object-contain"
                onError={(e) => { e.target.src = "/logo.png"; }}
              />
            </div>
            <div className="text-left">
              <h2 className="text-xl font-black text-white tracking-wide">
                ABU <span className="text-[#00D2FF]">MAFHAL</span>
              </h2>
              <p className="text-[9px] font-bold text-slate-400 tracking-widest uppercase">
                Your Marketplace, Your Choice.
              </p>
            </div>
          </Link>

          <h1 className="text-2xl font-black text-white mt-2">
            Welcome Back 👋
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Sign in to access your orders, wishlist, and vendor stores
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-[#0D1A30]/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          {/* Segmented Switch */}
          <div className="flex bg-[#070F1E] rounded-2xl p-1.5 mb-6 border border-slate-700/50">
            <button
              type="button"
              className="flex-1 py-2 text-xs font-black rounded-xl bg-amber-400 text-slate-950 shadow-md transition-all"
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

          {error && (
            <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
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
                  placeholder="user@example.com"
                  className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-amber-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all font-medium"
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
                  className="text-xs font-bold text-[#00D2FF] hover:underline"
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
                  className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-amber-400 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all font-medium"
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

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-3 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-[0.98]"
            >
              {loading ? (
                <Loader2 className="animate-spin h-5 w-5" />
              ) : (
                <>
                  <span>Sign In to Marketplace</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Security note */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>256-Bit SSL Encrypted • Trusted Across Nigeria</span>
          </div>
        </div>

        {/* Back to Home Link */}
        <div className="text-center mt-6">
          <Link
            to="/"
            className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
          >
            ← Return to Marketplace Homepage
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;