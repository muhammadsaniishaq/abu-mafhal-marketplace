import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { triggerWelcomeEmail } from '../../utils/emailTriggers';
import { sendOtpEmail } from '../../services/emailService';
import { User, Mail, Phone, Lock, Eye, EyeOff, Building2, Loader2, Bell, MessageSquare } from 'lucide-react';

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
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .single();
      if (data) setSettings(data);
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
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

  const handleSendOtp = async () => {
    setError('');
    setLoading(true);

    // Basic validation before OTP
    if (!formData.name || !formData.email || !formData.password) {
        setError('Please fill in all required fields');
        setLoading(false);
        return;
    }

    if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        setLoading(false);
        return;
    }

    try {
      // 1. Check if email already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formData.email)
        .single();

      if (existingUser) {
        setError('An account with this email already exists');
        setLoading(false);
        return;
      }

      // 2. Generate 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setOtpCode(code);

      // 3. Send OTP Email
      await sendOtpEmail(formData.email, code);
      
      setIsOtpSent(true);
      setCountdown(60);
      console.log('OTP Sent successfully');
    } catch (err) {
      setError('Failed to send verification code. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!isOtpSent) {
      handleSendOtp();
      return;
    }

    // Verify OTP
    if (userEnteredOtp !== otpCode) {
      setError('Invalid verification code');
      return;
    }

    setLoading(true);

    try {
      const userCredential = await register(formData.email, formData.password, {
        name: formData.name,
        phone: formData.phone,
        role: formData.role
      });

      // Send welcome email
      try {
        await triggerWelcomeEmail({
          name: formData.name,
          email: formData.email
        });
      } catch (emailError) {
        console.error('Error sending welcome email:', emailError);
      }

      // Handle referral code if present
      if (formData.referralCode) {
        try {
          const { data: referrer } = await supabase
            .from('profiles')
            .select('id')
            .eq('referral_code', formData.referralCode.trim().toUpperCase())
            .single();

          if (referrer && referrer.id !== userCredential.id) {
            await supabase.rpc('process_referral_reward', {
              p_new_user_id: userCredential.id,
              p_referrer_id: referrer.id
            });
          }
        } catch (error) {
          console.error('Error processing referral:', error.message);
        }
      }

      // Redirect based on role
      if (formData.role === 'vendor') {
        navigate('/vendor-application');
      } else {
        navigate('/buyer');
      }
    } catch (error) {
      setError(error.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-slate-50 overflow-hidden flex flex-col md:flex-row">
      {/* MOBILE-STYLE DECORATIONS (Copied exactly from theme.js authContainer circles) */}
      <div className="absolute top-[-100px] left-[-60px] w-[300px] h-[300px] rounded-full bg-blue-100 opacity-60 pointer-events-none" />
      <div className="absolute bottom-[-50px] right-[-60px] w-[250px] h-[250px] rounded-full bg-purple-100 opacity-60 pointer-events-none" />
      <div className="absolute top-[40%] right-[-40px] w-[100px] h-[100px] rounded-full bg-amber-100 opacity-50 pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-30px] w-[80px] h-[80px] rounded-full bg-red-200 opacity-50 pointer-events-none" />
      
      {/* Dynamic Mobile Symbols (Mail & Notification Icons) */}
      <div className="absolute top-[15%] left-[10%] opacity-20 rotate-12 pointer-events-none">
          <Mail size={80} className="text-blue-400" />
      </div>
      <div className="absolute bottom-[10%] right-[15%] opacity-20 -rotate-12 pointer-events-none">
          <Bell size={100} className="text-purple-400" />
      </div>

      {/* Decoration Strip */}
      <div className="absolute top-[100px] left-[-40px] w-[120px] h-[12px] bg-slate-100 -rotate-45 pointer-events-none" />
      <div className="absolute top-[15%] right-[40px] w-[40px] h-[40px] bg-indigo-200 rounded-lg opacity-40 rotate-[30deg] pointer-events-none" />

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto px-6 py-12 md:py-24 flex items-center justify-center relative z-10 w-full">
        <div className="w-full max-w-[480px]">
          
          {/* Back Button (Mobile Header style) */}
          <div className="mb-8">
             <Link to="/" className="inline-flex p-3 -ml-3 rounded-full hover:bg-slate-200/50 transition-colors">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                     <path d="M19 12H5M12 19l-7-7 7-7"/>
                 </svg>
             </Link>
          </div>

          {/* Auth Header */}
          <div className="mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center p-2 mb-4 overflow-hidden">
                <img 
                src={settings?.logo_url || "/logo.png"} 
                alt="Abu Mafhal" 
                className="w-full h-full object-contain"
                />
            </div>
            <h1 className="text-4xl font-black text-slate-800 leading-[1.1] tracking-tight">
              {isOtpSent ? 'Verify\nEmail' : 'Create\nAccount'}
            </h1>
          </div>

          {/* Main Auth Card */}
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.05)] border border-slate-100">

            {urlRefCode && (
              <div className="mb-6 flex items-center gap-3 bg-emerald-50 p-3 rounded-2xl border border-emerald-400">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                     <path fillRule="evenodd" d="M10 2a4 4 0 00-4 4v1H5a1 1 0 00-.994.89l-1 9A1 1 0 004 18h12a1 1 0 00.994-1.11l-1-9A1 1 0 0015 7h-1V6a4 4 0 00-4-4zm2 5V6a2 2 0 10-4 0v1h4zm-6 3a1 1 0 112 0 1 1 0 01-2 0zm7-1a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd"></path>
                  </svg>
                </div>
                <p className="text-sm font-bold text-emerald-800">
                  🎉 You've been referred! You'll get bonus rewards.
                </p>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              {!isOtpSent ? (
                <>
                  {/* Full Name */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-500 mb-2">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder="John Doe"
                      className="w-full bg-slate-100 rounded-xl px-4 py-3.5 text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
                    />
                  </div>

                  {/* Phone Number */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-500 mb-2">Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      required
                      placeholder="08012345678"
                      className="w-full bg-slate-100 rounded-xl px-4 py-3.5 text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
                    />
                  </div>

                  {/* Email Address */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-500 mb-2">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="user@example.com"
                      className="w-full bg-slate-100 rounded-xl px-4 py-3.5 text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
                    />
                  </div>

                  {/* Referral Code (Optional) */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-500 mb-2">Referral Code (Optional)</label>
                    <input
                      type="text"
                      name="referralCode"
                      value={formData.referralCode}
                      onChange={handleChange}
                      placeholder="ABU-XXXXXX"
                      className="w-full bg-slate-100 rounded-xl px-4 py-3.5 text-slate-800 font-semibold uppercase placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-500 mb-2">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                        placeholder="••••••••"
                        className="w-full bg-slate-100 rounded-xl pl-4 pr-12 py-3.5 text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-500 mb-2">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        required
                        placeholder="••••••••"
                        className="w-full bg-slate-100 rounded-xl pl-4 pr-12 py-3.5 text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-5 h-5" />
                        ) : (
                          <Eye className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-4">
                  <p className="text-slate-600 font-medium mb-6 text-center">
                    Enter the 6-digit code sent to <br/>
                    <span className="text-slate-900 font-bold">{formData.email}</span>
                  </p>
                  
                  <div className="flex gap-2 justify-center mb-8">
                     <input
                        type="text"
                        maxLength="6"
                        value={userEnteredOtp}
                        onChange={(e) => setUserEnteredOtp(e.target.value.replace(/\D/g, ''))}
                        placeholder="000000"
                        className="w-full max-w-[200px] bg-slate-100 rounded-2xl px-6 py-4 text-center text-3xl font-black tracking-[10px] text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-200 transition-all"
                        autoFocus
                     />
                  </div>

                  <div className="text-center">
                      {countdown > 0 ? (
                        <p className="text-slate-400 text-sm font-medium">
                            Resend code in <span className="text-slate-600">{countdown}s</span>
                        </p>
                      ) : (
                        <button 
                            type="button"
                            onClick={handleSendOtp}
                            className="text-slate-900 font-extrabold text-sm hover:underline"
                        >
                            Resend Verification Code
                        </button>
                      )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full mt-4 flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all shadow-[0_4px_12px_rgba(15,23,42,0.3)] disabled:opacity-75 disabled:cursor-not-allowed transform active:scale-95"
              >
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5 mr-3 text-white" />
                ) : (
                  isOtpSent ? 'Verify & Sign Up' : 'Continue'
                )}
              </button>

              <div className="flex items-center justify-center gap-2 mt-4 text-[13px]">
                <span className="text-slate-500 font-medium">
                    {isOtpSent ? "Wrong email?" : "Already have an account?"}
                </span>
                <button 
                  type="button"
                  onClick={() => isOtpSent ? setIsOtpSent(false) : navigate('/login')}
                  className="text-slate-900 font-extrabold hover:underline"
                >
                  {isOtpSent ? "Change Email" : "Login"}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;