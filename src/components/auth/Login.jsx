import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../config/supabase';
import { Mail, Lock, Eye, EyeOff, Loader2, Bell } from 'lucide-react';

const redirectByRole = (role, navigate) => {
  if (role === 'admin') navigate('/admin', { replace: true });
  else if (role === 'vendor') navigate('/vendor', { replace: true });
  else navigate('/buyer', { replace: true });
};

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState(null);
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  // If already logged in (e.g. cached session), redirect immediately
  useEffect(() => {
    if (currentUser) {
      redirectByRole(currentUser.role, navigate);
    }
  }, [currentUser]);

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
    } catch (err) { /* silent */ }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const userData = await login(email, password);
      if (userData) {
        redirectByRole(userData.role, navigate);
      }
    } catch (error) {
      setError(error.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative bg-slate-50 overflow-hidden flex flex-col items-center justify-center px-6 py-12">
      {/* MOBILE-STYLE DECORATIONS */}
      <div className="absolute top-[-100px] left-[-60px] w-[300px] h-[300px] rounded-full bg-blue-100 opacity-60 pointer-events-none" />
      <div className="absolute bottom-[-50px] right-[-60px] w-[250px] h-[250px] rounded-full bg-purple-100 opacity-60 pointer-events-none" />
      <div className="absolute top-[40%] right-[-40px] w-[100px] h-[100px] rounded-full bg-amber-100 opacity-50 pointer-events-none" />
      <div className="absolute bottom-[20%] left-[-30px] w-[80px] h-[80px] rounded-full bg-red-200 opacity-50 pointer-events-none" />
      
      {/* Dynamic Mobile Symbols */}
      <div className="absolute top-[15%] left-[10%] opacity-20 rotate-12 pointer-events-none">
          <Mail size={80} className="text-blue-400" />
      </div>
      <div className="absolute bottom-[10%] right-[15%] opacity-20 -rotate-12 pointer-events-none">
          <Bell size={100} className="text-purple-400" />
      </div>

      {/* Decoration Strip */}
      <div className="absolute top-[100px] left-[-40px] w-[120px] h-[12px] bg-slate-100 -rotate-45 pointer-events-none" />
      <div className="absolute top-[15%] right-[40px] w-[40px] h-[40px] bg-indigo-200 rounded-lg opacity-40 rotate-[30deg] pointer-events-none" />

      <div className="w-full max-w-[480px] relative z-10">
        <div className="mb-8">
            <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center p-2 mb-4 overflow-hidden">
                <img 
                    src={settings?.logo_url || "/logo.png"} 
                    alt="Abu Mafhal" 
                    className="w-full h-full object-contain"
                />
            </div>
            <h1 className="text-4xl font-black text-slate-800 leading-[1.1] tracking-tight">
              Welcome<br/>Back
            </h1>
        </div>

        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-[0_10px_30px_rgba(0,0,0,0.05)] border border-slate-100">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="block text-sm font-semibold text-slate-500 mb-2 ml-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-100 rounded-xl px-4 py-3.5 text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all font-medium"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-500 mb-2 ml-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-100 rounded-xl pl-4 pr-12 py-3.5 text-slate-800 font-semibold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 transition-all font-medium"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-end">
              <Link to="/forgot-password" size="sm" className="text-sm font-bold text-slate-900 hover:underline">
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl transition-all shadow-[0_4px_12_rgba(15,23,42,0.3)] disabled:opacity-75 disabled:cursor-not-allowed transform active:scale-95"
            >
              {loading ? (
                <Loader2 className="animate-spin h-5 w-5 mr-3 text-white" />
              ) : (
                'Sign In'
              )}
            </button>

            <div className="flex items-center justify-center gap-2 mt-4 text-[13px]">
              <span className="text-slate-500 font-medium">Don't have an account?</span>
              <Link to="/register" className="text-slate-900 font-extrabold hover:underline">
                Create Account
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;