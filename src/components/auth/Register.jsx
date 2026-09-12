import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { triggerWelcomeEmail } from '../../utils/emailTriggers';
import { sendOtpEmail } from '../../services/emailService';
import {
  User, Mail, Phone, Lock, Eye, EyeOff,
  Loader2, ArrowRight, ShieldCheck, Gift, CheckCircle2, RotateCcw
} from 'lucide-react';

const Register = () => {
  const [searchParams] = useSearchParams();
  const urlRefCode = searchParams.get('ref');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    referralCode: urlRefCode || '',
    password: '',
    confirmPassword: '',
    role: 'buyer'
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);

  // OTP States
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [userEnteredOtp, setUserEnteredOtp] = useState('');
  const [countdown, setCountdown] = useState(0);

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

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

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
      setError('Password must be at least 6 characters.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
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
        setError('An account with this email address already exists. Please sign in.');
        setLoading(false);
        return;
      }

      // 2. Direct account creation via Supabase Auth
      const userCredential = await register(cleanEmail, formData.password, {
        name: cleanName,
        phone: cleanPhone,
        role: formData.role
      });

      // 3. Send welcome email in background (non-blocking)
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

          if (referrer && referrer.id !== userCredential.id) {
            await supabase.rpc('process_referral_reward', {
              p_new_user_id: userCredential.id,
              p_referrer_id: referrer.id
            });
          }
        } catch (_) {}
      }

      // 5. Successful registration - redirect to home page
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Registration failed:', error);
      setError(error.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = () => {
    handleSubmit();
  };

  return (
    <div className="min-h-screen bg-[#070F1E] relative overflow-hidden flex flex-col items-center justify-center px-4 py-10 selection:bg-amber-400 selection:text-slate-900">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-1/3 w-[400px] h-[300px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-[460px] relative z-10">
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
            {isOtpSent ? 'Verify Email' : 'Create Account 🚀'}
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            {isOtpSent
              ? `Enter the 6-digit code sent to ${formData.email}`
              : 'Join thousands of buyers & sellers on Abu Mafhal'}
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-[#0D1A30]/80 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          {!isOtpSent && (
            <div className="flex bg-[#070F1E] rounded-2xl p-1.5 mb-6 border border-slate-700/50">
              <Link
                to="/login"
                className="flex-1 py-2 text-xs font-bold text-center text-slate-400 hover:text-white rounded-xl transition-all"
              >
                Sign In
              </Link>
              <button
                type="button"
                className="flex-1 py-2 text-xs font-black rounded-xl bg-amber-400 text-slate-950 shadow-md transition-all"
              >
                Create Account
              </button>
            </div>
          )}

          {urlRefCode && !isOtpSent && (
            <div className="mb-5 flex items-center gap-3 bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
              <Gift className="w-5 h-5 text-emerald-400 flex-shrink-0" />
              <span>You were invited with a referral code! Welcome bonus applies upon signup.</span>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!isOtpSent ? (
              <>
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
                      className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-amber-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all font-medium"
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
                      className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-amber-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 ml-1">
                    Phone Number
                  </label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="08012345678"
                      className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-amber-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all font-medium"
                    />
                  </div>
                </div>

                {/* Password */}
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
                      placeholder="At least 6 characters"
                      className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-amber-400 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 p-1 text-slate-400 hover:text-white focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
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
                      placeholder="Repeat password"
                      className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-amber-400 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all font-medium"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 p-1 text-slate-400 hover:text-white focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Referral Code */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1.5 ml-1">
                    Referral Code (Optional)
                  </label>
                  <div className="relative flex items-center">
                    <Gift className="absolute left-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      name="referralCode"
                      value={formData.referralCode}
                      onChange={handleChange}
                      placeholder="e.g. ABU-12345"
                      className="w-full bg-[#070F1E] border border-slate-700/70 focus:border-amber-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/20 transition-all font-medium uppercase"
                    />
                  </div>
                </div>

                {/* Create Account Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-3 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-[0.98]"
                >
                  {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <>
                      <span>Create Account</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </>
            ) : (
              /* OTP Code Input Step */
              <div className="flex flex-col gap-4 text-center">
                <div className="w-16 h-16 rounded-full bg-sky-500/10 border border-sky-400/30 flex items-center justify-center mx-auto mb-2 text-sky-400">
                  <Mail className="w-8 h-8" />
                </div>

                <div className="relative">
                  <input
                    type="text"
                    maxLength={6}
                    value={userEnteredOtp}
                    onChange={(e) => setUserEnteredOtp(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    autoFocus
                    className="w-full bg-[#070F1E] border-2 border-sky-400 rounded-2xl py-4 text-center text-3xl tracking-[14px] text-white font-black placeholder-slate-700 focus:outline-none focus:ring-4 focus:ring-sky-400/20 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-3.5 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-60 disabled:cursor-not-allowed transform active:scale-[0.98]"
                >
                  {loading ? (
                    <Loader2 className="animate-spin h-5 w-5" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Account Creation Directly</span>
                    </>
                  )}
                </button>

                {/* Resend & Back */}
                <div className="flex flex-col items-center gap-2 mt-3 text-xs">
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={countdown > 0 || loading}
                    className="inline-flex items-center gap-1.5 text-sky-400 hover:underline font-bold disabled:text-slate-500 disabled:no-underline"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {countdown > 0 ? `Resend Code in ${countdown}s` : 'Resend Verification Code'}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setIsOtpSent(false); setUserEnteredOtp(''); }}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    Wrong email address? Edit Details
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Security badge */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Buyer Protection & Verified Sellers Guaranteed</span>
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

export default Register;